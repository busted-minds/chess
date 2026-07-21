import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const destination = new URL(nextPath, request.nextUrl.origin);
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    const authUrl = new URL("/auth", request.nextUrl.origin);
    authUrl.searchParams.set("error", "not_configured");
    return NextResponse.redirect(authUrl, 303);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(destination, 303);
  }

  const authUrl = new URL("/auth", request.nextUrl.origin);
  authUrl.searchParams.set("error", "callback_failed");
  authUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(authUrl, 303);
}
