import type { Metadata } from "next";
import { AuthPanel } from "./auth-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/server/security";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create your Busted Minds Chess account.",
};

type AuthPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const query = await searchParams;
  const error = first(query.error);
  const confirmed = first(query.confirmed);

  return (
    <AuthPanel
      configured={isSupabaseConfigured()}
      nextPath={safeNextPath(first(query.next))}
      recovery={first(query.recovery) === "1"}
      initialMessage={confirmed ? "Email confirmed. Your account is ready to play." : undefined}
      initialError={error ? "That authentication link is invalid or has expired. Please try again." : undefined}
    />
  );
}
