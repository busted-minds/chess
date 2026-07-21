"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { BrandLogo } from "@/components/brand-logo";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "login" | "register" | "forgot" | "recovery";

type AuthPanelProps = {
  configured: boolean;
  initialMessage?: string;
  initialError?: string;
  nextPath: string;
  recovery?: boolean;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-deep)] pl-11 pr-4 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent-muted)] focus:ring-2 focus:ring-[var(--accent-soft)]";

export function AuthPanel({
  configured,
  initialMessage,
  initialError,
  nextPath,
  recovery = false,
}: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>(recovery ? "recovery" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState(initialError ?? "");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const supabase = getSupabaseBrowserClient();
  const isGuest = Boolean(currentUser?.is_anonymous);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setCurrentUser(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const clearNotices = () => {
    setMessage("");
    setError("");
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearNotices();
    if (!supabase) {
      setError("Online accounts are not configured in this environment.");
      return;
    }

    setPending("email");
    try {
      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth?recovery=1")}`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (resetError) throw resetError;
        setMessage("Check your inbox for a secure password-reset link.");
        return;
      }

      if (mode === "recovery") {
        if (password.length < 8) {
          setError("Use at least 8 characters for your new password.");
          return;
        }
        const { error: recoveryError } = await supabase.auth.updateUser({ password });
        if (recoveryError) throw recoveryError;
        window.location.assign("/dashboard?password=updated");
        return;
      }

      if (mode === "register") {
        if (password.length < 8) {
          setError("Use at least 8 characters for your password.");
          return;
        }

        if (isGuest) {
          const { error: upgradeError } = await supabase.auth.updateUser({ email, password });
          if (upgradeError) throw upgradeError;
          setMessage("Your games are safe. Confirm your email to finish upgrading this guest account.");
          return;
        }

        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (signUpError) throw signUpError;
        if (data.session) window.location.assign(nextPath);
        else setMessage("One last move: open the confirmation link we sent to your inbox.");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      window.location.assign(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const continueWithGoogle = async () => {
    clearNotices();
    if (!supabase) return setError("Online accounts are not configured in this environment.");
    setPending("google");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const options = {
      redirectTo,
      scopes: "openid email profile",
      queryParams: { prompt: "select_account" },
    };
    const { error: oauthError } = isGuest
      ? await supabase.auth.linkIdentity({ provider: "google", options })
      : await supabase.auth.signInWithOAuth({ provider: "google", options });
    if (oauthError) {
      setError(oauthError.message);
      setPending(null);
    }
  };

  const continueAsGuest = async () => {
    clearNotices();
    if (!supabase) return setError("Online guest play is not configured in this environment.");
    setPending("guest");
    const { error: guestError } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: "Guest Player" } },
    });
    if (guestError) {
      setError(guestError.message);
      setPending(null);
      return;
    }
    window.location.assign(nextPath);
  };

  return (
    <main className="relative isolate min-h-[calc(100vh-72px)] overflow-hidden bg-[var(--page)] px-4 py-10 sm:px-6 lg:py-16">
      <div aria-hidden className="grid-glow absolute inset-0 -z-20 opacity-70" />
      <div aria-hidden className="absolute left-1/2 top-1/3 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-3xl" />

      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden min-h-[650px] overflow-hidden border-r border-[var(--border)] bg-[var(--surface-deep)] p-10 lg:flex lg:flex-col">
          <div aria-hidden className="absolute -right-24 -top-20 size-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <BrandLogo className="relative h-16 w-56" priority />
          <div className="relative mt-auto max-w-md">
            <p className="eyebrow">Your board. Your story.</p>
            <h1 className="mt-4 text-5xl font-bold leading-[1.02] tracking-[-0.055em]">
              Keep every brilliant move.
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-[var(--text-muted)]">
              Sign in to play rated games, reconnect anywhere, track your improvement, and turn today&apos;s positions into tomorrow&apos;s strengths.
            </p>
            <div className="mt-8 grid gap-3">
              {[
                { icon: ShieldCheck, label: "Server-validated live chess" },
                { icon: Sparkles, label: "Progress, puzzles, and analysis saved" },
                { icon: CheckCircle2, label: "Your guest games stay with you when you upgrade" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm font-semibold text-[var(--text-muted)]">
                  <span className="grid size-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon size={16} />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <BrandLogo className="mb-9 h-14 w-48 lg:hidden" priority />
          <p className="eyebrow">Busted Minds account</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.045em]">
            {mode === "register" ? (isGuest ? "Save this guest journey" : "Create your account") : mode === "forgot" ? "Reset your password" : mode === "recovery" ? "Choose a new password" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {mode === "register"
              ? "Build a permanent chess record without losing your current progress."
              : mode === "forgot"
                ? "We’ll email you a secure link to choose a new password."
                : mode === "recovery"
                  ? "Your recovery link is verified. Make the new password one only you know."
                : "Sign in and pick up from the position you left."}
          </p>

          {isGuest && (
            <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-100">
              Guest session found. Registering or linking Google will preserve this player ID and its games.
            </div>
          )}
          {!configured && (
            <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-200">
              Online accounts are unavailable until the Supabase URL and publishable key are configured. Local and Vs AI play still work.
            </div>
          )}
          {(message || error) && (
            <div role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${error ? "border-red-400/25 bg-red-400/8 text-red-200" : "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"}`}>
              {error || message}
            </div>
          )}

          {mode !== "forgot" && mode !== "recovery" && (
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={!configured || pending !== null}
              className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] text-sm font-bold transition hover:border-[var(--accent-muted)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pending === "google" ? <LoaderCircle className="animate-spin" size={18} /> : <span className="grid size-6 place-items-center rounded-full bg-white text-sm font-black text-[#4285f4]">G</span>}
              {isGuest ? "Link Google and keep progress" : "Continue with Google"}
            </button>
          )}

          {mode !== "forgot" && mode !== "recovery" && (
            <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-[var(--text-faint)]">
              <span className="h-px flex-1 bg-[var(--border)]" /> or use email <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
          )}

          <form onSubmit={submitEmail} className={mode === "forgot" ? "mt-7 space-y-4" : "space-y-4"}>
            {mode !== "recovery" && <label className="block">
              <span className="mb-2 block text-xs font-bold text-[var(--text-muted)]">Email address</span>
              <span className="relative block">
                <AtSign aria-hidden className="absolute left-4 top-3.5 text-[var(--text-faint)]" size={18} />
                <input className={fieldClass} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </span>
            </label>}
            {mode !== "forgot" && (
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
                  Password
                  {mode === "login" && <button type="button" onClick={() => { clearNotices(); setMode("forgot"); }} className="text-[var(--accent)] hover:underline">Forgot password?</button>}
                </span>
                <span className="relative block">
                  <KeyRound aria-hidden className="absolute left-4 top-3.5 text-[var(--text-faint)]" size={18} />
                  <input className={`${fieldClass} pr-11`} type={showPassword ? "text" : "password"} autoComplete={mode === "register" || mode === "recovery" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 characters or more" />
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-2.5 grid size-8 place-items-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            )}
            <button type="submit" disabled={!configured || pending !== null} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-extrabold text-[#031421] shadow-[0_12px_38px_rgba(25,198,237,.18)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-bright)] disabled:pointer-events-none disabled:opacity-45">
              {pending === "email" ? <LoaderCircle className="animate-spin" size={18} /> : mode === "register" ? <UserRound size={17} /> : mode === "forgot" ? <AtSign size={17} /> : <ArrowRight size={17} />}
              {mode === "register" ? (isGuest ? "Upgrade guest account" : "Create account") : mode === "forgot" ? "Send reset link" : mode === "recovery" ? "Save new password" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
            {mode === "forgot" || mode === "recovery" ? (
              <button type="button" onClick={() => { clearNotices(); setMode("login"); }} className="font-bold text-[var(--accent)] hover:underline">Back to sign in</button>
            ) : (
              <>
                {mode === "login" ? "New to the club? " : "Already have an account? "}
                <button type="button" onClick={() => { clearNotices(); setMode(mode === "login" ? "register" : "login"); }} className="font-bold text-[var(--accent)] hover:underline">
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </>
            )}
          </div>

          {mode === "login" && !currentUser && (
            <button type="button" onClick={continueAsGuest} disabled={!configured || pending !== null} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-45">
              {pending === "guest" ? <LoaderCircle className="animate-spin" size={17} /> : <UserRound size={17} />}
              Continue as an online guest
            </button>
          )}
          <p className="mt-6 text-center text-[11px] leading-5 text-[var(--text-faint)]">
            By continuing, you agree to our Terms and Community Guidelines. Google access is limited to your basic profile and email.
          </p>
        </section>
      </div>
    </main>
  );
}
