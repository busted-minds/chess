import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { authenticateRequest } from "@/lib/server/security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ gameId: string }> };

/** Returns only the approved, non-secret engine settings for an active casual house turn. */
export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = requestIdFor(request);
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  const gameId = z.uuid().safeParse((await context.params).gameId);
  if (!gameId.success) return apiError(400, "BAD_REQUEST", "The game ID is invalid.", { requestId });

  const rateLimit = await consumeRateLimit({
    request,
    scope: "house_move_context",
    actorId: auth.user.id,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "House-player settings were requested too frequently.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 5) },
    });
  }

  const result = await callServiceRpc("service_house_move_context", {
    p_actor_user_id: auth.user.id,
    p_game_id: gameId.data,
  });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  return apiSuccess(result.data, { requestId });
}
