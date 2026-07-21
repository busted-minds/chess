import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/server/security";

const confirmationSchema = z.object({
  token_hash: z.string().min(16).max(2048),
  type: z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]),
});

export async function GET(request: NextRequest) {
  const parsed = confirmationSchema.safeParse({
    token_hash: request.nextUrl.searchParams.get("token_hash"),
    type: request.nextUrl.searchParams.get("type"),
  });
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await getSupabaseServerClient();

  if (parsed.success && supabase) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: parsed.data.token_hash,
      type: parsed.data.type as EmailOtpType,
    });
    if (!error) {
      const destination = new URL(nextPath, request.nextUrl.origin);
      if (nextPath === "/dashboard") destination.searchParams.set("welcome", "1");
      return NextResponse.redirect(destination, 303);
    }
  }

  const authUrl = new URL("/auth", request.nextUrl.origin);
  authUrl.searchParams.set("error", "confirmation_failed");
  authUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(authUrl, 303);
}
