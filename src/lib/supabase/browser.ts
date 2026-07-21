"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let browserClient: SupabaseClient | null | undefined;

/**
 * Returns one browser client per tab. A null value means environment variables
 * have not been configured; callers can render a useful setup state instead of
 * crashing during static builds or local UI work.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;

  const config = getSupabasePublicConfig();
  browserClient = config
    ? createBrowserClient(config.url, config.publishableKey)
    : null;

  return browserClient;
}

export const createBrowserSupabaseClient = getSupabaseBrowserClient;
