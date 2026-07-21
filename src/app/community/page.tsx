import { Activity, ArrowRight, MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";
import { housePlayers } from "@/lib/data/content";

export default function CommunityPage() {
  return <AppShell title="Community" description="Find players, build a club, share games, and keep the conversation about chess." actions={<ButtonLink href="/clubs"><Users size={16} />Explore clubs</ButtonLink>}>
    <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
      <div className="space-y-4"><Surface className="p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-cyan-400/10 text-[var(--accent)]"><Activity size={21} /></span><div><p className="font-bold">Community pulse</p><p className="text-xs text-[var(--text-muted)]">Curated games, milestones, and club activity</p></div></div></Surface>{[
        ["MiraTempo", "earned the Fork Finder badge after a 22-puzzle streak.", "4 min ago", "♞"],
        ["Endgame Atelier", "published a new rook ending study for members.", "18 min ago", "♜"],
        ["KnightShift", "annotated a wild Sicilian draw and shared the critical position.", "36 min ago", "♟"],
      ].map(([name, body, time, piece]) => <Surface key={name} className="p-5"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-400/10 text-2xl text-violet-300">{piece}</span><div><p className="text-sm leading-6"><strong>{name}</strong> {body}</p><div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-faint)]"><span>{time}</span><button className="flex items-center gap-1 hover:text-[var(--accent)]"><Sparkles size={13} />React</button><button className="flex items-center gap-1 hover:text-[var(--accent)]"><MessageCircle size={13} />Reply</button></div></div></div></Surface>)}</div>
      <div className="space-y-5"><Surface className="p-5"><div className="flex items-center justify-between"><h2 className="font-bold">Suggested rivals</h2><Pill>Near your level</Pill></div><div className="mt-3 divide-y divide-[var(--border)]">{housePlayers.slice(0, 3).map((player) => <div key={player.id} className="flex items-center gap-3 py-3"><span className="grid size-9 place-items-center rounded-xl text-xl" style={{ color: player.color, backgroundColor: `${player.color}18` }}>♞</span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{player.name}</p><p className="text-[10px] text-[var(--text-faint)]">{player.rating} · {player.style}</p></div><ButtonLink href={`/play/ai?profile=${player.id}`} variant="ghost" size="sm">Play</ButtonLink></div>)}</div></Surface><Surface className="border-emerald-400/15 bg-emerald-400/5 p-5"><ShieldCheck size={22} className="text-emerald-400" /><h2 className="mt-4 font-bold">Chess-first conversations</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Block, mute, and report controls are always close. House players use only a small safe set of game messages.</p><ButtonLink href="/guidelines" variant="ghost" size="sm" className="mt-3 px-0 text-emerald-300">Community guidelines<ArrowRight size={14} /></ButtonLink></Surface></div>
    </div>
  </AppShell>;
}
