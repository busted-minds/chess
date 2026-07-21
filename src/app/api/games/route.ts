import type { NextRequest } from "next/server";
import { createGameFromFen, createStandardGame } from "@/lib/chess/rules";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, parseJson, requestIdFor } from "@/lib/server/http";
import { isPermanentAccount } from "@/lib/server/identity";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { createGameSchema, ratingPoolFor } from "@/lib/server/schemas";
import { authenticateRequest, rejectUntrustedOrigin } from "@/lib/server/security";

export async function POST(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;

  const parsed = await parseJson(request, createGameSchema, requestId);
  if (parsed.response) return parsed.response;
  const input = parsed.data;

  const rateLimit = await consumeRateLimit({
    request,
    scope: "create_game",
    actorId: auth.user.id,
    limit: 20,
    windowSeconds: 3_600,
  });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "You are creating games too quickly.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
    });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "NOT_CONFIGURED", "Online games require the Supabase server key.", {
      requestId,
    });
  }
  if (input.rated && !(await isPermanentAccount(admin, auth.user.id))) {
    return apiError(403, "PERMANENT_ACCOUNT_REQUIRED", "Upgrade your guest account to play rated games.", {
      requestId,
    });
  }
  if (input.variant === "chess960") {
    return apiError(422, "VARIANT_UNAVAILABLE", "Chess960 online validation is not enabled yet.", {
      requestId,
    });
  }

  let initialFen: string;
  try {
    initialFen = input.variant === "from_position"
      ? createGameFromFen(input.initialFen!).fen
      : createStandardGame().fen;
  } catch {
    return apiError(422, "INVALID_FEN", "The starting position is not a valid FEN.", {
      requestId,
    });
  }

  const ratingPool = ratingPoolFor(input.baseTimeMs, input.incrementMs);
  const result = await callServiceRpc("service_create_game", {
    p_actor_user_id: auth.user.id,
    p_request_id: input.idempotencyKey,
    p_variant: input.variant,
    p_initial_fen: initialFen,
    p_base_time_ms: input.baseTimeMs,
    p_increment_ms: input.incrementMs,
    p_rated: input.rated,
    p_rating_pool: input.rated ? ratingPool : null,
    p_visibility: input.visibility,
    p_color_preference: input.colorPreference,
  });
  if (result.error) {
    return apiError(result.error.status, result.error.code, result.error.message, {
      requestId,
      details: result.error.details,
    });
  }

  const response = result.data && typeof result.data === "object"
    ? result.data as Record<string, unknown>
    : { result: result.data };
  const gameId = typeof response.game_id === "string" ? response.game_id : null;
  const inviteToken = typeof response.invite_token === "string" ? response.invite_token : null;
  const inviteUrl = gameId && inviteToken
    ? new URL(`/play/invite?gameId=${encodeURIComponent(gameId)}&token=${encodeURIComponent(inviteToken)}`, request.nextUrl.origin).toString()
    : null;
  return apiSuccess({ ...response, ...(inviteUrl ? { inviteUrl } : {}) }, { status: 201, requestId });
}
