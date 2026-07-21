import type { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, parseJson, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { callServiceRpc } from "@/lib/server/rpc";
import { feedbackSchema } from "@/lib/server/schemas";
import { rejectUntrustedOrigin, sha256Hex } from "@/lib/server/security";

export async function POST(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;
  if (!getSupabaseAdminClient()) {
    return apiError(503, "NOT_CONFIGURED", "Feedback is unavailable until Supabase is configured.", {
      requestId,
    });
  }

  const parsed = await parseJson(request, feedbackSchema, requestId);
  if (parsed.response) return parsed.response;

  // Honeypot fields are intentionally acknowledged without storing anything.
  if (parsed.data.website) return apiSuccess({ accepted: true }, { status: 202, requestId });

  const supabase = await getSupabaseServerClient();
  const { data: authData } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const actorId = authData.user?.id;
  const rateLimit = await consumeRateLimit({
    request,
    scope: "feedback",
    actorId,
    limit: 5,
    windowSeconds: 3_600,
  });
  if (!rateLimit.allowed) {
    return apiError(429, "RATE_LIMITED", "Too many feedback submissions. Please try again later.", {
      requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 3_600) },
    });
  }

  const forwardedAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await callServiceRpc("service_submit_feedback", {
    p_actor_user_id: actorId ?? null,
    p_request_id: parsed.data.idempotencyKey,
    p_category: parsed.data.category,
    p_message: parsed.data.message,
    p_email: parsed.data.email ?? null,
    p_page: parsed.data.page ?? null,
    p_ip_hash: await sha256Hex(forwardedAddress),
  });
  if (result.error) {
    return apiError(result.error.status, result.error.code, result.error.message, {
      requestId,
      details: result.error.details,
    });
  }
  return apiSuccess({ accepted: true, submission: result.data }, { status: 202, requestId });
}
