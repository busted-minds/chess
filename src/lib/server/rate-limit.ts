import "server-only";

import type { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logServerEvent } from "./http";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  enforced: boolean;
};

const requesterAddress = (request: NextRequest): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip")?.trim() ||
  "unknown";

const digest = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
};

const normalizeResult = (data: unknown): RateLimitResult | null => {
  const value = Array.isArray(data) ? data[0] : data;
  if (typeof value === "boolean") return { allowed: value, enforced: true };
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const allowed = row.allowed ?? row.is_allowed;
  if (typeof allowed !== "boolean") return null;
  const retry = row.retry_after_seconds ?? row.retry_after;
  return {
    allowed,
    enforced: true,
    ...(typeof retry === "number" ? { retryAfterSeconds: Math.max(1, Math.ceil(retry)) } : {}),
  };
};

/** Database-backed and shared across Vercel instances; fails open only if the optional RPC is absent. */
export async function consumeRateLimit(options: {
  request: NextRequest;
  scope: string;
  actorId?: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { allowed: true, enforced: false };

  const identity = options.actorId ?? (await digest(requesterAddress(options.request)));
  const bucketKey = `${options.scope}:${identity}`.slice(0, 256);
  const { data, error } = await admin.rpc("service_consume_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    logServerEvent("warn", "rate_limit_unavailable", {
      scope: options.scope,
      code: error.code,
    });
    return { allowed: true, enforced: false };
  }

  return normalizeResult(data) ?? { allowed: true, enforced: false };
}
