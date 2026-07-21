import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "./config";

let adminClient: SupabaseClient | null | undefined;

/** Server-only client. Never import this module from a Client Component. */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;

  const config = getSupabaseAdminConfig();
  adminClient = config
    ? createClient(config.url, config.secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { "X-Client-Info": "bustedminds-chess-server" } },
      })
    : null;

  return adminClient;
}

export const createAdminSupabaseClient = getSupabaseAdminClient;
