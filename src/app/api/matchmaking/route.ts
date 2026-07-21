import type { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, parseJson, requestIdFor } from "@/lib/server/http";
import { isPermanentAccount } from "@/lib/server/identity";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { cancelMatchmakingSchema, matchmakingSchema, ratingPoolFor, uuidSchema } from "@/lib/server/schemas";
import { authenticateRequest, rejectUntrustedOrigin } from "@/lib/server/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = requestIdFor(request);
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;

  const ticketIdValue = request.nextUrl.searchParams.get("ticketId");
  const ticketId = ticketIdValue ? uuidSchema.safeParse(ticketIdValue) : null;
  if (ticketId && !ticketId.success) {
    return apiError(400, "BAD_REQUEST", "The matchmaking ticket ID is invalid.", { requestId });
  }

  const loadTickets = () => {
    let query = auth.client
      .from("matchmaking_tickets")
      .select("id,status,variant,rating_pool,rated,base_time_ms,increment_ms,color_preference,rating_range,allow_house_players,matched_game_id,matched_house_player_id,queued_at,expires_at")
      .eq("user_id", auth.user.id)
      .order("queued_at", { ascending: false })
      .limit(ticketId?.success ? 1 : 5);
    query = ticketId?.success
      ? query.eq("id", ticketId.data)
      : query.in("status", ["queued", "offered", "matched"]);
    return query;
  };

  const { data, error } = await loadTickets();
  if (error) return apiError(503, "DEPENDENCY_UNAVAILABLE", "Matchmaking status could not be loaded.", { requestId });
  return apiSuccess({ tickets: data ?? [], serverTime: new Date().toISOString() }, { requestId });
}

export async function PATCH(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const parsed = await parseJson(request, cancelMatchmakingSchema, requestId);
  if (parsed.response) return parsed.response;

  const rateLimit = await consumeRateLimit({
    request,
    scope: "matchmaking_poll",
    actorId: auth.user.id,
    limit: 200,
    windowSeconds: 300,
  });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Matchmaking status was checked too frequently.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 5) },
    });
  }

  const result = await callServiceRpc("service_poll_matchmaking", {
    p_actor_user_id: auth.user.id,
    p_ticket_id: parsed.data.ticketId,
    p_request_id: parsed.data.idempotencyKey,
  });
  if (result.error) {
    return apiError(result.error.status, result.error.code, result.error.message, {
      requestId,
      details: result.error.details,
    });
  }

  const { data, error } = await auth.client
    .from("matchmaking_tickets")
    .select("id,status,variant,rating_pool,rated,base_time_ms,increment_ms,color_preference,rating_range,allow_house_players,matched_game_id,matched_house_player_id,queued_at,expires_at")
    .eq("user_id", auth.user.id)
    .eq("id", parsed.data.ticketId)
    .limit(1);
  if (error) {
    return apiError(503, "DEPENDENCY_UNAVAILABLE", "Matchmaking status could not be refreshed.", { requestId });
  }
  return apiSuccess({ tickets: data ?? [], advanced: result.data, serverTime: new Date().toISOString() }, { requestId });
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const parsed = await parseJson(request, matchmakingSchema, requestId);
  if (parsed.response) return parsed.response;

  const rateLimit = await consumeRateLimit({ request, scope: "matchmaking", actorId: auth.user.id, limit: 20, windowSeconds: 300 });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many matchmaking requests. Wait a moment and try again.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 30) },
    });
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return apiError(503, "NOT_CONFIGURED", "Matchmaking requires the Supabase server key.", { requestId });
  if (parsed.data.rated && !(await isPermanentAccount(admin, auth.user.id))) {
    return apiError(403, "PERMANENT_ACCOUNT_REQUIRED", "Upgrade your guest account to enter rated matchmaking.", { requestId });
  }
  if (parsed.data.variant === "chess960") {
    return apiError(422, "VARIANT_UNAVAILABLE", "Chess960 matchmaking is not enabled yet.", { requestId });
  }

  const result = await callServiceRpc("service_matchmake", {
    p_actor_user_id: auth.user.id,
    p_request_id: parsed.data.idempotencyKey,
    p_variant: parsed.data.variant,
    p_rating_pool: ratingPoolFor(parsed.data.baseTimeMs, parsed.data.incrementMs),
    p_rated: parsed.data.rated,
    p_base_time_ms: parsed.data.baseTimeMs,
    p_increment_ms: parsed.data.incrementMs,
    p_color_preference: parsed.data.colorPreference,
    p_rating_range: parsed.data.ratingRange,
    p_allow_house_players: parsed.data.allowHousePlayers,
  });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  return apiSuccess(result.data, { status: 201, requestId });
}

export async function DELETE(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const parsed = await parseJson(request, cancelMatchmakingSchema, requestId);
  if (parsed.response) return parsed.response;
  const result = await callServiceRpc("service_cancel_matchmaking", {
    p_actor_user_id: auth.user.id,
    p_ticket_id: parsed.data.ticketId,
    p_request_id: parsed.data.idempotencyKey,
  });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  return apiSuccess(result.data, { requestId });
}
