import type { NextRequest } from "next/server";
import { apiError, apiSuccess, parseJson, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc, type ServiceRpcResult } from "@/lib/server/rpc";
import { adminConfigPatchSchema } from "@/lib/server/schemas";
import { authenticateRequest, rejectUntrustedOrigin } from "@/lib/server/security";

const authorizeAdmin = async (userId: string): Promise<ServiceRpcResult<boolean>> => {
  const result = await callServiceRpc<boolean | { allowed?: boolean; has_role?: boolean }>(
    "service_has_role",
    { p_user_id: userId, p_roles: ["admin"] },
  );
  if (result.error) return result;
  const allowed = typeof result.data === "boolean"
    ? result.data
    : result.data.allowed === true || result.data.has_role === true;
  return { data: allowed };
};

export async function GET(request: NextRequest) {
  const requestId = requestIdFor(request);
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const authorization = await authorizeAdmin(auth.user.id);
  if (authorization.error) {
    return apiError(authorization.error.status, authorization.error.code, authorization.error.message, { requestId });
  }
  if (!authorization.data) return apiError(403, "FORBIDDEN", "Administrator access is required.", { requestId });
  const result = await callServiceRpc("service_admin_get_config", { p_actor_user_id: auth.user.id });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  return apiSuccess(result.data, { requestId });
}

export async function PATCH(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const authorization = await authorizeAdmin(auth.user.id);
  if (authorization.error) {
    return apiError(authorization.error.status, authorization.error.code, authorization.error.message, { requestId });
  }
  if (!authorization.data) return apiError(403, "FORBIDDEN", "Administrator access is required.", { requestId });
  const parsed = await parseJson(request, adminConfigPatchSchema, requestId);
  if (parsed.response) return parsed.response;
  const rateLimit = await consumeRateLimit({ request, scope: "admin_config", actorId: auth.user.id, limit: 30, windowSeconds: 300 });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many configuration changes.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 30) },
    });
  }
  const { idempotencyKey, ...patch } = parsed.data;
  const databasePatch = {
    ...(patch.featureFlags
      ? {
          feature_flags: Object.fromEntries(
            patch.featureFlags.map(({ key, enabled, rolloutPercent, minimumPopulation, publicConfig }) => [
              key,
              {
                ...(enabled === undefined ? {} : { enabled }),
                ...(rolloutPercent === undefined ? {} : { rollout_percent: rolloutPercent }),
                ...(minimumPopulation === undefined ? {} : { minimum_population: minimumPopulation }),
                ...(publicConfig === undefined ? {} : { public_config: publicConfig }),
              },
            ]),
          ),
        }
      : {}),
    ...(patch.matchmakingRules
      ? {
          matchmaking_rules: Object.fromEntries(
            patch.matchmakingRules.map(({ pool, botFallbackEnabled, fallbackWaitSeconds, initialRatingRange, ratingRangeGrowthPerSecond, maxRatingRange, casualBotsEnabled, ratedBotsEnabled, tournamentBotsEnabled, maxBotGameRatio }) => [
              pool,
              {
                ...(botFallbackEnabled === undefined ? {} : { bot_fallback_enabled: botFallbackEnabled }),
                ...(fallbackWaitSeconds === undefined ? {} : { fallback_wait_seconds: fallbackWaitSeconds }),
                ...(initialRatingRange === undefined ? {} : { initial_rating_range: initialRatingRange }),
                ...(ratingRangeGrowthPerSecond === undefined ? {} : { rating_range_growth_per_second: ratingRangeGrowthPerSecond }),
                ...(maxRatingRange === undefined ? {} : { max_rating_range: maxRatingRange }),
                ...(casualBotsEnabled === undefined ? {} : { casual_bots_enabled: casualBotsEnabled }),
                ...(ratedBotsEnabled === undefined ? {} : { rated_bots_enabled: ratedBotsEnabled }),
                ...(tournamentBotsEnabled === undefined ? {} : { tournament_bots_enabled: tournamentBotsEnabled }),
                ...(maxBotGameRatio === undefined ? {} : { max_bot_game_ratio: maxBotGameRatio }),
              },
            ]),
          ),
        }
      : {}),
    ...(patch.housePlayers
      ? {
          house_players: Object.fromEntries(
            patch.housePlayers.map(({ id, isEnabled, isListed, estimatedRating, difficulty, allowMatchmaking, allowTournaments, allowRated, ratingMode, paused }) => [
              id,
              {
                ...(isEnabled === undefined ? {} : { is_enabled: isEnabled }),
                ...(isListed === undefined ? {} : { is_listed: isListed }),
                ...(estimatedRating === undefined ? {} : { estimated_rating: estimatedRating }),
                ...(difficulty === undefined ? {} : { difficulty }),
                ...(allowMatchmaking === undefined ? {} : { allow_matchmaking: allowMatchmaking }),
                ...(allowTournaments === undefined ? {} : { allow_tournaments: allowTournaments }),
                ...(allowRated === undefined ? {} : { allow_rated: allowRated }),
                ...(ratingMode === undefined ? {} : { rating_mode: ratingMode }),
                ...(paused === undefined ? {} : { paused }),
              },
            ]),
          ),
        }
      : {}),
    ...(patch.maintenanceMode === undefined
      ? {}
      : { maintenance_mode: patch.maintenanceMode }),
    ...(patch.announcement
      ? {
          announcement: {
            slug: patch.announcement.slug,
            title: patch.announcement.title,
            body: patch.announcement.body,
            severity: patch.announcement.severity,
            is_published: patch.announcement.published,
            ...(patch.announcement.startsAt ? { starts_at: patch.announcement.startsAt } : {}),
            ...(patch.announcement.endsAt ? { ends_at: patch.announcement.endsAt } : {}),
          },
        }
      : {}),
  };
  const result = await callServiceRpc("service_admin_update_config", {
    p_actor_user_id: auth.user.id,
    p_request_id: idempotencyKey,
    p_patch: databasePatch,
  });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  return apiSuccess(result.data, { requestId });
}
