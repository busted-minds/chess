import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAuthoritativeGame, participantForUser, replayAuthoritativeGame } from "@/lib/server/games";
import { apiError, apiSuccess, parseJson, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { gameActionSchema } from "@/lib/server/schemas";
import { authenticateRequest, rejectUntrustedOrigin } from "@/lib/server/security";

type RouteContext = { params: Promise<{ gameId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const gameId = z.uuid().safeParse((await context.params).gameId);
  if (!gameId.success) return apiError(400, "BAD_REQUEST", "The game ID is invalid.", { requestId });
  const parsed = await parseJson(request, gameActionSchema, requestId);
  if (parsed.response) return parsed.response;

  const rateLimit = await consumeRateLimit({ request, scope: "game_action", actorId: auth.user.id, limit: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many game actions. Wait a moment and try again.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 10) },
    });
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return apiError(503, "NOT_CONFIGURED", "Online games require the Supabase server key.", { requestId });
  const loaded = await loadAuthoritativeGame(admin, gameId.data);
  if (loaded.error) return apiError(503, "DEPENDENCY_UNAVAILABLE", "The game could not be loaded.", { requestId });
  if (!loaded.data) return apiError(404, "NOT_FOUND", "Game not found.", { requestId });
  if (!participantForUser(loaded.data, auth.user.id)) return apiError(403, "FORBIDDEN", "Only a player in this game can perform that action.", { requestId });

  let claimTermination: "repetition" | "fifty_move" | null = null;
  let timeoutResult: "1-0" | "0-1" | "1/2-1/2" | null = null;
  if (parsed.data.action === "claim_draw" || parsed.data.action === "claim_timeout") {
    try {
      const chess = replayAuthoritativeGame(loaded.data);
      const expectedTurn = loaded.data.game.active_color === "white" ? "w" : "b";
      if (chess.turn !== expectedTurn) {
        throw new Error("The stored active color does not match the position.");
      }
      if (parsed.data.action === "claim_timeout") {
        timeoutResult = chess.timeoutOutcome(expectedTurn).result;
      } else {
        const outcome = chess.status().outcome;
        const eligible =
          outcome.status === "finished" &&
          (outcome.termination === "threefold-repetition" ||
            outcome.termination === "fifty-move");
        if (!eligible) {
          return apiError(409, "DRAW_NOT_CLAIMABLE", "The current position does not support a repetition or fifty-move draw claim.", {
            requestId,
          });
        }
        claimTermination = outcome.status === "finished" && outcome.termination === "fifty-move"
          ? "fifty_move"
          : "repetition";
      }
    } catch {
      return apiError(503, "AUTHORITATIVE_STATE_INVALID", "The saved game could not be replayed safely.", {
        requestId,
      });
    }
  }

  const rpcAction = parsed.data.action === "request_takeback"
    ? "offer_takeback"
    : parsed.data.action;
  const result = parsed.data.action === "claim_draw"
    ? await callServiceRpc("service_claim_draw", {
        p_actor_user_id: auth.user.id,
        p_game_id: gameId.data,
        p_expected_version: parsed.data.expectedVersion,
        p_request_id: parsed.data.idempotencyKey,
        p_termination: claimTermination,
      })
    : await callServiceRpc("service_game_action", {
        p_actor_user_id: auth.user.id,
        p_game_id: gameId.data,
        p_expected_version: parsed.data.expectedVersion,
        p_request_id: parsed.data.idempotencyKey,
        p_action: rpcAction,
        p_timeout_result: timeoutResult,
      });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  if (
    parsed.data.action === "accept_takeback" &&
    result.data &&
    typeof result.data === "object" &&
    (result.data as Record<string, unknown>).requires_rewind === true
  ) {
    return apiSuccess(
      {
        ...(result.data as Record<string, unknown>),
        applied: false,
        message: "The takeback was accepted and is awaiting an authoritative rewind.",
      },
      { status: 202, requestId },
    );
  }
  return apiSuccess(result.data, { requestId });
}
