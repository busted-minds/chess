import { ArrowRight, Bot, ChevronRight, Clock3, Gauge, Settings2, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { housePlayers, playModes } from "@/lib/data/content";

const clocks = [
  { label: "Bullet", value: "1+0", hint: "Pure instinct" },
  { label: "Blitz", value: "3+2", hint: "Fast, with room" },
  { label: "Rapid", value: "10+0", hint: "Most popular" },
  { label: "Classical", value: "30+20", hint: "Think deeply" },
];

export default function PlayPage() {
  return <AppShell title="Choose your board." description="Go online, play the computer, share the device, or send a private challenge.">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{playModes.map((mode) => { const Icon = mode.icon; return <Link href={mode.href} key={mode.id} className="group min-h-64 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-cyan-400/30"><div className="grid size-12 place-items-center rounded-2xl bg-cyan-400/10 text-[var(--accent)]"><Icon size={22} /></div><h2 className="mt-7 text-2xl font-bold">{mode.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{mode.description}</p><div className="mt-6 flex items-center justify-between text-xs font-bold text-[var(--accent)]"><span>{mode.stat}</span><ArrowRight size={16} className="transition group-hover:translate-x-1" /></div></Link>; })}</div>
    <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Surface className="p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Quick online</p><h2 className="mt-2 text-2xl font-bold">Pick a clock</h2></div><ButtonLink href="/play/online?custom=true" variant="ghost" size="sm"><Settings2 size={15} />Custom</ButtonLink></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{clocks.map((clock, index) => <Link href={`/play/online?clock=${encodeURIComponent(clock.value)}`} key={clock.label} className={`group flex items-center gap-4 rounded-2xl border p-4 transition ${index === 2 ? "border-cyan-300/25 bg-cyan-400/7" : "border-[var(--border)] bg-[var(--surface-soft)] hover:border-[var(--border-strong)]"}`}><span className="grid size-11 place-items-center rounded-xl bg-[var(--surface-raised)] text-[var(--accent)]"><Clock3 size={20} /></span><div className="flex-1"><p className="text-sm font-bold">{clock.label} <span className="ml-1 font-mono text-[var(--accent)]">{clock.value}</span></p><p className="mt-1 text-xs text-[var(--text-faint)]">{clock.hint}</p></div><ChevronRight size={16} className="text-[var(--text-faint)] transition group-hover:translate-x-1" /></Link>)}</div></Surface>
      <Surface className="p-6"><div className="flex items-center justify-between"><div><p className="eyebrow text-orange-300">Computer personalities</p><h2 className="mt-2 text-2xl font-bold">Choose a style</h2></div><Bot size={23} className="text-orange-300" /></div><div className="mt-4 space-y-2">{housePlayers.slice(0, 3).map((player) => <Link href={`/play/ai?profile=${player.id}`} key={player.id} className="group flex items-center gap-3 rounded-xl p-3 hover:bg-[var(--surface-hover)]"><span className="grid size-10 place-items-center rounded-xl text-xl" style={{ color: player.color, backgroundColor: `${player.color}18` }}>♞</span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{player.name} <span className="text-xs font-normal text-[var(--text-faint)]">{player.rating}</span></p><p className="truncate text-xs text-[var(--text-muted)]">{player.style} · {player.opening}</p></div><Gauge size={16} className="text-[var(--text-faint)]" /></Link>)}</div><ButtonLink href="/play/ai" variant="secondary" className="mt-3 w-full"><Sparkles size={16} />Meet every opponent</ButtonLink></Surface>
    </div>
  </AppShell>;
}
