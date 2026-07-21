import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { rejectUntrustedOrigin } from "@/lib/server/security";
import { requestIdFor } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  const requestId = requestIdFor(request);
  const originError = rejectUntrustedOrigin(request, requestId);
  if (originError) return originError;

  const supabase = await getSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
