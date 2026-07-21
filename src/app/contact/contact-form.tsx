"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type FormState = { status: "idle" | "sending" | "sent" | "error"; message?: string };

export function ContactForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("company")) return;
    setState({ status: "sending" });
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          category: data.get("category"),
          message: data.get("message"),
          page: data.get("page"),
          consent: data.get("consent") === "on",
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || "We could not send your message right now.");
      form.reset();
      setState({ status: "sent", message: "Thanks—your note reached the feedback queue." });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "We could not send your message right now." });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby="form-privacy">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" hint="Optional"><input name="name" autoComplete="name" maxLength={80} className={inputClass} /></Field>
        <Field label="Email" hint="For a reply"><input name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} /></Field>
      </div>
      <Field label="Topic"><select name="category" required defaultValue="feedback" className={inputClass}><option value="feedback">Product feedback</option><option value="bug">Bug report</option><option value="account">Account or sign-in</option><option value="safety">Safety or moderation</option><option value="privacy">Privacy request</option><option value="other">Something else</option></select></Field>
      <Field label="Page or game link" hint="Optional"><input name="page" type="text" inputMode="url" maxLength={500} placeholder="https://… or a game ID" className={inputClass} /></Field>
      <Field label="Message" hint="20–4,000 characters"><textarea name="message" required minLength={20} maxLength={4000} rows={7} placeholder="What happened, what did you expect, and how can we help?" className={`${inputClass} h-auto resize-y py-3`} /></Field>
      <div className="absolute -left-[10000px]" aria-hidden><label>Company<input name="company" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-3 text-xs leading-5 text-[var(--text-muted)]"><input name="consent" type="checkbox" required className="mt-1 size-4 accent-[var(--accent)]" /><span>I agree that Busted Minds Chess may use this information to respond and address the request. I have not included a password, API key, payment detail, or sensitive identity document.</span></label>
      <p id="form-privacy" className="text-xs leading-5 text-[var(--text-faint)]">Feedback is rate-limited and retained only as needed to resolve the request, keep a safety record where applicable, and improve the beta. See the Privacy Policy for details.</p>
      {state.status === "sent" && <Status icon={CheckCircle2} tone="text-emerald-300 bg-emerald-400/10 border-emerald-400/20">{state.message}</Status>}
      {state.status === "error" && <Status icon={AlertCircle} tone="text-red-300 bg-red-400/10 border-red-400/20">{state.message} Please wait a moment and try again.</Status>}
      <Button type="submit" size="lg" disabled={state.status === "sending"} className="w-full sm:w-auto">{state.status === "sending" ? <><LoaderCircle size={17} className="animate-spin" />Sending…</> : <><Send size={17} />Send message</>}</Button>
    </form>
  );
}

const inputClass = "mt-2 h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent-muted)] focus:ring-2 focus:ring-[var(--accent-soft)]";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block text-sm font-bold">{label}{hint && <span className="ml-2 text-xs font-normal text-[var(--text-faint)]">{hint}</span>}{children}</label>; }
function Status({ icon: Icon, tone, children }: { icon: typeof CheckCircle2; tone: string; children?: React.ReactNode }) { return <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${tone}`}><Icon size={18} className="mt-0.5 shrink-0" /><span>{children}</span></div>; }
