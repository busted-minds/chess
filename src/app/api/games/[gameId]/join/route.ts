import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseJson, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { joinGameSchema } from "@/lib/server/schemas";
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
  const parsed = await parseJson(request, joinGameSchema, requestId);
  if (parsed.response) return parsed.response;

  const rateLimit = await consumeRateLimit({
    request,
    scope: "join_game",
    actorId: auth.user.id,
    limit: 30,
    windowSeconds: 300,
  });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many join attempts. Wait a moment and try again.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
    });
  }

  const result = await callServiceRpc("service_join_game", {
    p_actor_user_id: auth.user.id,
    p_game_id: gameId.data,
    p_invite_token: parsed.data.inviteToken ?? null,
    p_request_id: parsed.data.idempotencyKey,
  });
  if (result.error) {
    return apiError(result.error.status, result.error.code, result.error.message, {
      requestId,
      details: result.error.details,
    });
  }
  return apiSuccess(result.data, { requestId });
}
