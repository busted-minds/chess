import type { NextRequest } from "next/server";
import { z } from "zod";
import { ChessDomainError } from "@/lib/chess/types";
import {
  houseEngineAttestationMatches,
  houseMoveContextSchema,
} from "@/lib/engine/house-move-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  databaseTermination,
  loadAuthoritativeGame,
  participantForUser,
  replayAuthoritativeGame,
} from "@/lib/server/games";
import { apiError, apiSuccess, logServerEvent, parseJson, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { moveSubmissionSchema } from "@/lib/server/schemas";
import { authenticateRequest, rejectUntrustedOrigin, sha256Hex } from "@/lib/server/security";

type RouteContext = { params: Promise<{ gameId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const gameId = z.uuid().safeParse((await context.params).gameId);
  if (!gameId.success) return apiError(400, "BAD_REQUEST", "The game ID is invalid.", { requestId });
  const parsed = await parseJson(request, moveSubmissionSchema, requestId);
  if (parsed.response) return parsed.response;

  const rateLimit = await consumeRateLimit({
    request,
    scope: "game_move",
    actorId: auth.user.id,
    limit: 180,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Move submissions are arriving too quickly.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 2) },
    });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return apiError(503, "NOT_CONFIGURED", "Online games require the Supabase server key.", { requestId });
  const submittedUci = `${parsed.data.move.from}${parsed.data.move.to}${parsed.data.move.promotion ?? ""}`;
  const requestHash = await sha256Hex(JSON.stringify({
    gameId: gameId.data,
    expectedVersion: parsed.data.expectedVersion,
    move: parsed.data.move,
    engine: parsed.data.engine ?? null,
  }));
  const previous = await callServiceRpc<Record<string, unknown> | null>(
    "service_get_game_mutation_response",
    {
      p_actor_user_id: auth.user.id,
      p_game_id: gameId.data,
      p_request_id: parsed.data.idempotencyKey,
      p_request_hash: requestHash,
    },
  );
  if (previous.error) {
    return apiError(previous.error.status, previous.error.code, previous.error.message, {
      requestId,
    });
  }
  if (previous.data) {
    return apiSuccess({ ...previous.data, duplicate: true }, { requestId });
  }

  const loaded = await loadAuthoritativeGame(admin, gameId.data);
  if (loaded.error) return apiError(503, "DEPENDENCY_UNAVAILABLE", "The authoritative game state could not be loaded.", { requestId });
  if (!loaded.data) return apiError(404, "NOT_FOUND", "Game not found.", { requestId });

  const { game } = loaded.data;
  if (game.status !== "active") return apiError(409, "GAME_NOT_ACTIVE", "This game is not active.", { requestId });
  if (game.version !== parsed.data.expectedVersion) {
    return apiError(409, "STALE_VERSION", "The game changed. Reload before submitting another move.", {
      requestId,
      details: { currentVersion: game.version },
    });
  }
  const participant = participantForUser(loaded.data, auth.user.id);
  if (!participant) return apiError(403, "FORBIDDEN", "Only a player in this game can submit a move.", { requestId });
  const activeParticipant = loaded.data.participants.find(
    (candidate) => candidate.color === game.active_color,
  );
  if (!activeParticipant) {
    return apiError(503, "AUTHORITATIVE_STATE_INVALID", "The active player seat is missing.", { requestId });
  }

  const isHumanMove =
    activeParticipant.participant_kind === "user" &&
    activeParticipant.user_id === auth.user.id;
  const isBrowserComputedHouseMove =
    activeParticipant.participant_kind === "house" &&
    Boolean(activeParticipant.house_player_id) &&
    participant.color !== game.active_color &&
    game.bot_move_policy === "browser_legal";
  if (!isHumanMove && !isBrowserComputedHouseMove) {
    return apiError(409, "NOT_YOUR_TURN", "Wait for your opponent's move.", { requestId });
  }
  if (isHumanMove && parsed.data.engine) {
    return apiError(422, "ENGINE_METADATA_NOT_ALLOWED", "Human moves cannot include engine metadata.", {
      requestId,
    });
  }
  if (isBrowserComputedHouseMove && game.rated) {
    return apiError(403, "RATED_HOUSE_MOVE_DISABLED", "Browser-computed house moves are limited to casual games.", {
      requestId,
    });
  }
  if (isBrowserComputedHouseMove && !parsed.data.engine) {
    return apiError(422, "ENGINE_ATTESTATION_REQUIRED", "House-player moves require the approved engine assignment.", {
      requestId,
    });
  }

  let approvedEngine: {
    profile: string;
    version: string;
    seed: string | number;
    level: number;
  } | null = null;
  if (isBrowserComputedHouseMove) {
    const submittedEngine = parsed.data.engine;
    // Narrowed by ENGINE_ATTESTATION_REQUIRED above. Keep the guard explicit so
    // a future schema change cannot silently reintroduce unstamped house moves.
    if (!submittedEngine) {
      return apiError(422, "ENGINE_ATTESTATION_REQUIRED", "House-player moves require the approved engine assignment.", {
        requestId,
      });
    }
    const context = await callServiceRpc<Record<string, unknown>>(
      "service_house_move_context",
      { p_actor_user_id: auth.user.id, p_game_id: game.id },
    );
    if (context.error) {
      return apiError(context.error.status, context.error.code, context.error.message, {
        requestId,
      });
    }
    const approvedContext = houseMoveContextSchema.safeParse(context.data);
    if (!approvedContext.success) {
      logServerEvent("error", "invalid_house_move_context", {
        requestId,
        gameId: game.id,
        issues: approvedContext.error.issues.map(({ path, code }) => ({ path: path.join("."), code })),
      });
      return apiError(503, "AUTHORITATIVE_STATE_INVALID", "The approved house-player assignment is invalid.", {
        requestId,
      });
    }
    const assignment = approvedContext.data;
    if (
      assignment.expected_version !== game.version ||
      assignment.house_player_id !== activeParticipant.house_player_id
    ) {
      return apiError(409, "STALE_VERSION", "The house-player assignment changed. Reload before submitting its move.", {
        requestId,
        details: { currentVersion: game.version },
      });
    }
    if (!houseEngineAttestationMatches(assignment, submittedEngine)) {
      return apiError(403, "ENGINE_ATTESTATION_REJECTED", "The house-player engine details do not match the approved assignment.", {
        requestId,
      });
    }
    approvedEngine = {
      profile: assignment.engine_profile,
      version: assignment.engine_version,
      seed: assignment.deterministic_seed,
      level: assignment.difficulty,
    };
  }

  try {
    const chess = replayAuthoritativeGame(loaded.data);
    const expectedTurn = game.active_color === "white" ? "w" : "b";
    if (chess.turn !== expectedTurn) throw new Error("The stored active color does not match the position.");
    // The database is authoritative for whether the clock expired. This
    // prospective result is derived from the durable pre-move position so a
    // late move cannot turn a material draw into a timeout win.
    const timeoutResult = chess.timeoutOutcome(expectedTurn).result;
    const applied = chess.applyMove(submittedUci);
    const state = chess.status();
    const positionKey = await sha256Hex(state.fen.split(" ").slice(0, 4).join(" "));
    const result = await callServiceRpc("service_submit_move", {
      p_actor_user_id: isHumanMove ? auth.user.id : null,
      p_actor_house_player_id: isBrowserComputedHouseMove
        ? activeParticipant.house_player_id
        : null,
      p_computed_by_user_id: isBrowserComputedHouseMove ? auth.user.id : null,
      p_game_id: game.id,
      p_expected_version: parsed.data.expectedVersion,
      p_request_id: parsed.data.idempotencyKey,
      p_request_hash: requestHash,
      p_uci: applied.uci,
      p_san: applied.san,
      p_resulting_fen: state.fen,
      p_resulting_pgn: state.pgn,
      p_position_key: positionKey.slice(0, 32),
      p_status: state.outcome.status === "finished" ? "completed" : "active",
      p_result: state.outcome.status === "finished" ? state.outcome.result : "*",
      p_termination: state.outcome.status === "finished"
        ? databaseTermination(state.outcome.termination)
        : null,
      p_timeout_result: timeoutResult,
      p_engine_profile: approvedEngine?.profile ?? null,
      p_engine_version: approvedEngine?.version ?? null,
      p_engine_level: approvedEngine?.level ?? null,
      p_engine_seed: approvedEngine?.seed ?? null,
    });
    if (result.error) {
      return apiError(result.error.status, result.error.code, result.error.message, {
        requestId,
        details: result.error.details,
      });
    }
    return apiSuccess(result.data, { requestId });
  } catch (error) {
    if (error instanceof ChessDomainError) {
      return apiError(422, error.code, error.message, { requestId });
    }
    logServerEvent("error", "authoritative_replay_failed", {
      requestId,
      gameId: game.id,
      message: error instanceof Error ? error.message : "unknown",
    });
    return apiError(503, "AUTHORITATIVE_STATE_INVALID", "The saved game could not be validated safely.", {
      requestId,
    });
  }
}
