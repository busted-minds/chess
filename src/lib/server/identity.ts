import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { callServiceRpc } from "./rpc";

export async function isPermanentAccount(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("account_kind,status")
    .eq("id", userId)
    .maybeSingle();
  return !error && data?.account_kind === "permanent" && data.status === "active";
}

export async function userHasRole(
  userId: string,
  roles: readonly ("admin" | "moderator" | "support")[],
): Promise<boolean> {
  const result = await callServiceRpc<boolean | { allowed?: boolean; has_role?: boolean }>(
    "service_has_role",
    { p_user_id: userId, p_roles: roles },
  );
  if (result.error) return false;
  if (typeof result.data === "boolean") return result.data;
  return result.data.allowed === true || result.data.has_role === true;
}
