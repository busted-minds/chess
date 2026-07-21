"use client";

import { useState } from "react";
import { Check, Copy, Link2, LockKeyhole, Mail, Send, Share2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

export function InviteBuilder() {
  const [clock, setClock] = useState("10+0");
  const [color, setColor] = useState("random");
  const [rated, setRated] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  async function createInvite() {
    setLoading(true); setMessage(null); setAuthRequired(false);
    const [minutes, increment] = clock.split("+").map(Number);
    try {
      const response = await fetch("/api/games", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ visibility: "private", rated, colorPreference: color, initialTimeMs: (minutes ?? 10) * 60_000, incrementMs: (increment ?? 0) * 1000, variant: "standard" }) });
      const body = await response.json().catch(() => ({})) as { inviteUrl?: string; gameId?: string; error?: string };
      if (!response.ok) {
        setAuthRequired(response.status === 401);
        throw new Error(body.error ?? "The private challenge could not be created.");
      }
      setInvite(body.inviteUrl ?? `${location.origin}/game/${body.gameId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The private challenge could not be created.");
    } finally { setLoading(false); }
  }

  async function copyInvite() { if (!invite) return; await navigator.clipboard.writeText(invite); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }

  return <div className="grid gap-5 xl:grid-cols-[1fr_350px]"><Surface className="p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Private challenge</p><h2 className="mt-2 text-2xl font-bold">Set the table.</h2></div><span className="grid size-12 place-items-center rounded-2xl bg-violet-400/10 text-violet-300"><Link2 size={22} /></span></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Time control"><select value={clock} onChange={(event) => setClock(event.target.value)} className="form-control"><option>3+2</option><option>5+3</option><option>10+0</option><option>15+10</option><option>30+20</option></select></Field><Field label="Your color"><select value={color} onChange={(event) => setColor(event.target.value)} className="form-control"><option value="random">Random</option><option value="white">White</option><option value="black">Black</option></select></Field></div><label className="mt-5 flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><span><span className="block text-sm font-bold">Rated game</span><span className="mt-1 block text-xs text-[var(--text-muted)]">Both players need permanent accounts</span></span><input type="checkbox" className="toggle" checked={rated} onChange={(event) => setRated(event.target.checked)} /></label>{message && <div className="mt-4 rounded-xl border border-orange-400/15 bg-orange-400/6 p-3 text-xs leading-5 text-orange-200"><p>{message}</p>{authRequired && <ButtonLink href="/auth?next=/play/invite" size="sm" variant="secondary" className="mt-3">Sign in to create</ButtonLink>}</div>}{!invite ? <Button onClick={createInvite} size="lg" className="mt-7 w-full" disabled={loading}><Share2 size={18} />{loading ? "Creating…" : "Create challenge link"}</Button> : <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/6 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><Check size={16} />Challenge ready</div><div className="mt-3 flex gap-2"><input readOnly value={invite} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-deep)] px-3 font-mono text-xs" /><Button onClick={copyInvite} variant="secondary"><Copy size={16} />{copied ? "Copied" : "Copy"}</Button></div><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="ghost"><Mail size={15} />Email</Button><Button variant="ghost"><Send size={15} />Share</Button></div></div>}</Surface><div className="space-y-5"><Surface className="p-5"><LockKeyhole size={21} className="text-violet-300" /><h3 className="mt-4 font-bold">Only invited players</h3><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">The server stores only a hash of the invite token. The secret exists in the link and is shown once.</p></Surface><Surface className="p-5"><h3 className="font-bold">Challenge details</h3><div className="mt-4 space-y-3 text-xs"><Summary label="Clock" value={clock} /><Summary label="Color" value={color} /><Summary label="Rating" value={rated ? "Rated" : "Casual"} /><Summary label="Variant" value="Standard" /></div></Surface><ButtonLink href="/play/local" variant="secondary" className="w-full">Same room? Play hotseat</ButtonLink></div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold text-[var(--text-muted)]">{label}</span>{children}</label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">{label}</span><span className="font-bold capitalize">{value}</span></div>; }
