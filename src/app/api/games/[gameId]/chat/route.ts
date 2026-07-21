import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadAuthoritativeGame, participantForUser } from "@/lib/server/games";
import { apiError, apiSuccess, parseJson, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { chatMessageSchema } from "@/lib/server/schemas";
import { authenticateRequest, rejectUntrustedOrigin } from "@/lib/server/security";

type RouteContext = { params: Promise<{ gameId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = requestIdFor(request);
  const gameId = z.uuid().safeParse((await context.params).gameId);
  if (!gameId.success) return apiError(400, "BAD_REQUEST", "The game ID is invalid.", { requestId });
  const before = request.nextUrl.searchParams.get("before");
  if (before && !z.iso.datetime({ offset: true }).safeParse(before).success) {
    return apiError(400, "BAD_REQUEST", "The chat cursor is invalid.", { requestId });
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) return apiError(503, "NOT_CONFIGURED", "Game chat is unavailable until Supabase is configured.", { requestId });

  let query = supabase
    .from("game_chat_messages")
    .select("id,game_id,author_kind,author_user_id,author_house_player_id,author_name_snapshot,body,created_at")
    .eq("game_id", gameId.data)
    .eq("moderation_state", "visible")
    .order("created_at", { ascending: false })
    .limit(50);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) return apiError(403, "FORBIDDEN", "This game's chat is not available to you.", { requestId });
  return apiSuccess({ messages: (data ?? []).reverse(), nextCursor: data?.at(-1)?.created_at ?? null }, { requestId });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const gameId = z.uuid().safeParse((await context.params).gameId);
  if (!gameId.success) return apiError(400, "BAD_REQUEST", "The game ID is invalid.", { requestId });
  const parsed = await parseJson(request, chatMessageSchema, requestId);
  if (parsed.response) return parsed.response;

  const rateLimit = await consumeRateLimit({ request, scope: "game_chat", actorId: auth.user.id, limit: 12, windowSeconds: 30 });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "You're sending messages too quickly.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 15) },
    });
  }
  const admin = getSupabaseAdminClient();
  if (!admin) return apiError(503, "NOT_CONFIGURED", "Game chat requires the Supabase server key.", { requestId });
  const loaded = await loadAuthoritativeGame(admin, gameId.data);
  if (loaded.error) return apiError(503, "DEPENDENCY_UNAVAILABLE", "The game could not be loaded.", { requestId });
  if (!loaded.data) return apiError(404, "NOT_FOUND", "Game not found.", { requestId });
  if (!participantForUser(loaded.data, auth.user.id)) return apiError(403, "FORBIDDEN", "Only players can post in this game chat.", { requestId });

  const result = await callServiceRpc("service_send_game_chat", {
    p_actor_user_id: auth.user.id,
    p_game_id: gameId.data,
    p_request_id: parsed.data.idempotencyKey,
    p_body: parsed.data.message,
  });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  return apiSuccess(result.data, { status: 201, requestId });
}
