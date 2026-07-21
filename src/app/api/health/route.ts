import { apiError, apiSuccess, requestIdFor } from "@/lib/server/http";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = requestIdFor(request);
  const publicConfigured = isSupabaseConfigured();
  const adminConfigured = isSupabaseAdminConfigured();
  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);

  if (!publicConfigured || !adminConfigured) {
    return apiError(503, "NOT_CONFIGURED", "Online services are not fully configured.", {
      requestId,
      details: {
        supabasePublic: publicConfigured,
        supabaseServer: adminConfigured,
        applicationUrl: appUrlConfigured,
      },
    });
  }

  const admin = getSupabaseAdminClient();
  const startedAt = performance.now();
  const { error } = await admin!
    .from("feature_flags")
    .select("key", { head: true, count: "exact" })
    .limit(1);
  const latencyMs = Math.round(performance.now() - startedAt);

  if (error) {
    return apiError(503, "DEPENDENCY_UNAVAILABLE", "The database health check failed.", {
      requestId,
      details: { database: "unavailable", latencyMs },
    });
  }

  return apiSuccess(
    {
      status: "healthy",
      service: "bustedminds-chess",
      database: "reachable",
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    { requestId },
  );
}
