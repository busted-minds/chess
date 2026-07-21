import type { NextRequest } from "next/server";
import { apiError, apiSuccess, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { authenticateRequest, rejectUntrustedOrigin } from "@/lib/server/security";

/** Manual, audited cleanup trigger for the operations dashboard. */
export async function POST(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;

  const role = await callServiceRpc<boolean>("service_has_role", {
    p_user_id: auth.user.id,
    p_roles: ["admin"],
  });
  if (role.error) return apiError(role.error.status, role.error.code, role.error.message, { requestId });
  if (!role.data) return apiError(403, "FORBIDDEN", "Administrator access is required.", { requestId });

  const rateLimit = await consumeRateLimit({
    request,
    scope: "manual_cleanup",
    actorId: auth.user.id,
    limit: 3,
    windowSeconds: 3_600,
  });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Cleanup has already run recently.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 1_200) },
    });
  }

  const result = await callServiceRpc("service_cleanup_expired_data", {
    p_requested_by: auth.user.id,
    p_batch_size: 500,
  });
  if (result.error) return apiError(result.error.status, result.error.code, result.error.message, { requestId, details: result.error.details });
  return apiSuccess({ completedAt: new Date().toISOString(), result: result.data }, { requestId });
}
