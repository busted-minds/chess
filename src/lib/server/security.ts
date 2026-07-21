import "server-only";

import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { apiError } from "./http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const allowedOrigins = (request: NextRequest): Set<string> => {
  const origins = new Set<string>([request.nextUrl.origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Invalid application URLs are ignored here and surfaced by /api/health.
    }
  }
  return origins;
};

/**
 * Cookie-authenticated mutations must be same-origin. Explicit bearer clients
 * are not vulnerable to ambient-cookie CSRF and may omit Origin.
 */
export function rejectUntrustedOrigin(
  request: NextRequest,
  requestId: string,
) {
  const origin = request.headers.get("origin");
  const authorization = request.headers.get("authorization");
  if (!origin && authorization?.startsWith("Bearer ")) return null;
  if (origin && allowedOrigins(request).has(origin)) return null;

  return apiError(403, "ORIGIN_REJECTED", "This request did not come from an allowed origin.", {
    requestId,
  });
}

export type AuthenticatedRequest = {
  user: User;
  client: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;
};

export async function authenticateRequest(
  requestId: string,
): Promise<AuthenticatedRequest | { response: ReturnType<typeof apiError> }> {
  const client = await getSupabaseServerClient();
  if (!client) {
    return {
      response: apiError(
        503,
        "NOT_CONFIGURED",
        "Online services are not configured. Add the Supabase environment variables and try again.",
        { requestId },
      ),
    };
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return {
      response: apiError(401, "UNAUTHENTICATED", "Sign in to continue.", {
        requestId,
      }),
    };
  }

  return { user: data.user, client };
}

export const safeNextPath = (value: string | null | undefined): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(decoded)
    ) {
      return "/dashboard";
    }
  } catch {
    return "/dashboard";
  }
  return value;
};

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
