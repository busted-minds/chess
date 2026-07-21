import type { NextRequest } from "next/server";
import { apiError, apiSuccess, requestIdFor } from "@/lib/server/http";
import { callServiceRpc } from "@/lib/server/rpc";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const requestId = requestIdFor(request);
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return apiError(503, "NOT_CONFIGURED", "Scheduled cleanup requires CRON_SECRET.", {
      requestId,
    });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return apiError(401, "UNAUTHENTICATED", "Invalid cleanup authorization.", {
      requestId,
    });
  }

  const result = await callServiceRpc("service_cleanup_expired_data", {
    p_requested_by: "system",
    p_batch_size: 500,
  });
  if (result.error) {
    return apiError(result.error.status, result.error.code, result.error.message, {
      requestId,
      details: result.error.details,
    });
  }
  return apiSuccess({ completedAt: new Date().toISOString(), result: result.data }, { requestId });
}
