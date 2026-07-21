"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";

type InviteAcceptorProps = {
  gameId: string;
  inviteToken: string;
};

type JoinError = {
  code?: string;
  error?: string;
  message?: string;
};

const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const joinErrorMessage = (status: number, body: JoinError): string => {
  if (status === 401) return "Sign in or continue as a guest before accepting this challenge.";
  if (status === 403) return "This invitation is invalid or expired. Rated challenges also require a permanent account.";
  if (status === 404) return "This challenge no longer exists or is not available to this account.";
  if (status === 409) return "This challenge is already full, has started, or is no longer accepting players.";
  if (status === 422) return "This invitation link is malformed and cannot be accepted.";
  if (status === 503) return "Online games are temporarily unavailable. Please try again in a moment.";
  return body.error ?? body.message ?? "The challenge could not be accepted.";
};

export function InviteAcceptor({ gameId, inviteToken }: InviteAcceptorProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [pending, setPending] = useState<"guest" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validLink = gameIdPattern.test(gameId) && inviteToken.trim().length >= 16 && inviteToken.length <= 512;
  const returnPath = `/play/invite?gameId=${encodeURIComponent(gameId)}&token=${encodeURIComponent(inviteToken)}`;

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setCheckingAuth(false));
      return;
    }

    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setCheckingAuth(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function postJoin() {
    const idempotencyKey = crypto.randomUUID();
    const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/join`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ inviteToken, idempotencyKey }),
    });
    const body = await response.json().catch(() => ({})) as JoinError;
    if (!response.ok) throw new Error(joinErrorMessage(response.status, body));
    router.replace(`/game/${gameId}`);
    router.refresh();
  }

  async function joinChallenge() {
    if (!validLink || pending) return;
    setPending("join");
    setError(null);
    try {
      await postJoin();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The challenge could not be accepted.");
      setPending(null);
    }
  }

  async function continueAsGuest() {
    if (!supabase || pending) return;
    setPending("guest");
    setError(null);
    const { data, error: guestError } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: "Guest Player" } },
    });
    if (guestError || !data.user) {
      setError(guestError?.message ?? "A guest session could not be created.");
      setPending(null);
      return;
    }
    setUser(data.user);
    setPending("join");
    try {
      await postJoin();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The challenge could not be accepted.");
      setPending(null);
    }
  }

  if (!validLink) {
    return (
      <Surface className="mx-auto max-w-xl p-8 text-center">
        <CircleAlert size={32} className="mx-auto text-orange-300" />
        <h2 className="mt-4 text-2xl font-bold">This invite link is incomplete.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
          Ask the challenger to copy the complete private link again. It must include both the game and its secret invitation token.
        </p>
        <ButtonLink href="/play/invite" variant="secondary" className="mt-6">Create a new challenge</ButtonLink>
      </Surface>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Surface className="relative overflow-hidden p-7 sm:p-9">
        <div aria-hidden className="absolute -right-20 -top-20 size-64 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative">
          <span className="grid size-14 place-items-center rounded-2xl bg-violet-400/10 text-violet-300"><LockKeyhole size={25} /></span>
          <Pill className="mt-6 border-violet-300/20 text-violet-200">Private invitation</Pill>
          <h2 className="mt-4 text-3xl font-bold tracking-[-.04em]">Your opponent is waiting.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
            Accepting reserves the open seat for this account and takes you straight to the durable live game room.
          </p>

          {checkingAuth ? (
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-muted)]">
              <LoaderCircle size={18} className="animate-spin text-[var(--accent)]" />Checking your player session…
            </div>
          ) : !supabase ? (
            <div role="alert" className="mt-8 rounded-2xl border border-orange-400/20 bg-orange-400/7 p-4 text-sm leading-6 text-orange-200">
              Online accounts are not configured in this environment, so this invitation cannot be accepted here.
            </div>
          ) : user ? (
            <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/6 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><UserRound size={19} /></span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">Ready as {user.is_anonymous ? "Guest Player" : (user.email ?? "signed-in player")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{user.is_anonymous ? "Guest accounts can accept casual challenges. Rated games require a permanent account." : "The server will verify the invitation before assigning your color."}</p>
                </div>
              </div>
              <Button onClick={() => void joinChallenge()} size="lg" className="mt-5 w-full" disabled={pending !== null}>
                {pending === "join" ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {pending === "join" ? "Accepting challenge…" : "Accept challenge"}
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ButtonLink href={`/auth?next=${encodeURIComponent(returnPath)}`} size="lg"><LogIn size={18} />Sign in to accept</ButtonLink>
              <Button onClick={() => void continueAsGuest()} size="lg" variant="secondary" disabled={pending !== null}>
                {pending === "guest" ? <LoaderCircle size={18} className="animate-spin" /> : <UserRound size={18} />}
                {pending === "guest" ? "Starting guest…" : "Continue as guest"}
              </Button>
            </div>
          )}

          {error && <div role="alert" className="mt-4 flex gap-3 rounded-2xl border border-red-400/20 bg-red-400/8 p-4 text-sm leading-6 text-red-200"><CircleAlert size={18} className="mt-0.5 shrink-0" />{error}</div>}
        </div>
      </Surface>

      <div className="space-y-5">
        <Surface className="p-5">
          <ShieldCheck size={21} className="text-emerald-300" />
          <h3 className="mt-4 font-bold">Server-verified seat</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">The server checks the secret token, expiry, game capacity, account eligibility, and duplicate joins before the game starts.</p>
        </Surface>
        <Surface className="p-5">
          <LockKeyhole size={21} className="text-violet-300" />
          <h3 className="mt-4 font-bold">Keep this link private</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">The first eligible player to use the one-time invitation takes the open seat. Do not repost it publicly.</p>
        </Surface>
        <ButtonLink href="/play" variant="ghost" className="w-full">Decline and return to play</ButtonLink>
      </div>
    </div>
  );
}
