import type { Metadata } from "next";
import { ArrowRight, Bot, BrainCircuit, CloudOff, Gauge, Globe2, GraduationCap, LockKeyhole, MessageSquare, ShieldCheck, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { PublicPage, BetaNotice } from "./_components/public-page";
import { ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";

export const metadata: Metadata = {
  title: "Features",
  description: "Explore online, local, and computer chess, learning tools, tournaments, social play, and privacy-minded analysis in Busted Minds Chess.",
};

const modes = [
  { icon: Globe2, title: "Online", note: "Account for rated play", body: "Match by clock and rating, invite a friend, reconnect after a drop, or meet a calibrated house player when the live pool is quiet.", color: "text-cyan-300 bg-cyan-400/10" },
  { icon: BrainCircuit, title: "Vs AI", note: "No account needed", body: "Choose a strength and style. Browser-based Stockfish keeps analysis and move calculation on your device whenever possible.", color: "text-orange-300 bg-orange-400/10" },
  { icon: Swords, title: "Local", note: "Works offline", body: "Share one screen for hotseat chess with clocks, legal move guidance, board flipping, and no sign-in or database usage.", color: "text-violet-300 bg-violet-400/10" },
];

const groups = [
  { icon: GraduationCap, title: "Learn from every position", body: "Daily puzzles, opening practice, focused lessons, mistake review, endgame drills, and an analysis board that grows with you.", tags: ["Puzzles", "Openings", "Engine lines", "Accuracy"] },
  { icon: Trophy, title: "Compete with context", body: "Separate time-control ratings, provisional placement, leaderboards, achievements, Arena and Swiss events, plus private club tournaments.", tags: ["Ratings", "Events", "Streaks", "Standings"] },
  { icon: Users, title: "A chess-first community", body: "Public profiles, clubs, challenges, annotated games, reactions, safe messages, and visible block, mute, and report controls.", tags: ["Clubs", "Profiles", "Challenges", "Safety"] },
  { icon: Gauge, title: "Made for real devices", body: "Responsive boards, keyboard controls, move announcements, reduced motion, high contrast, low-bandwidth preferences, and installable PWA support.", tags: ["Accessible", "Responsive", "PWA", "Themes"] },
  { icon: LockKeyhole, title: "Private by default", body: "Local and direct AI games avoid cloud writes unless you choose to save. Large engine results stay in your browser by default.", tags: ["Local compute", "Optional saves", "Minimal data"] },
  { icon: Bot, title: "Useful from day one", body: "Distinct fictional house players can support queues, demonstrations, and configured events without pretending to be human players.", tags: ["Clear identity", "Calibrated", "Configurable"] },
];

export default function FeaturesPage() {
  return (
    <PublicPage eyebrow="Everything in one chess home" title="More ways to play. Better reasons to return." intro="Busted Minds Chess brings quick games, deliberate study, and welcoming competition into one polished home—designed to stay useful whether the room is busy or you are the only player awake." aside={<BetaNotice>We are launching in public beta. Availability may change as reliability, accessibility, and fair-play systems are validated; the core Local and Vs AI experiences remain free.</BetaNotice>}>
      <section aria-labelledby="play-your-way">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><Pill><Sparkles size={13} />Three distinct modes</Pill><h2 id="play-your-way" className="mt-4 text-3xl font-bold tracking-[-.04em]">Play your way</h2></div><ButtonLink href="/play">Compare play options<ArrowRight size={16} /></ButtonLink></div>
        <div className="mt-7 grid gap-5 lg:grid-cols-3">{modes.map(({ icon: Icon, title, note, body, color }) => <Surface key={title} className="group p-6 transition hover:-translate-y-1 hover:border-[var(--border-strong)]"><span className={`grid size-12 place-items-center rounded-2xl ${color}`}><Icon size={22} /></span><div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-xl font-bold">{title}</h3><span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{note}</span></div><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{body}</p></Surface>)}</div>
      </section>

      <section className="mt-20" aria-labelledby="built-around-you"><p className="eyebrow">One connected platform</p><h2 id="built-around-you" className="mt-3 text-3xl font-bold tracking-[-.04em]">Built around the player, not the queue</h2><div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{groups.map(({ icon: Icon, title, body, tags }) => <Surface key={title} className="p-6"><Icon size={22} className="text-[var(--accent)]" /><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{body}</p><div className="mt-5 flex flex-wrap gap-2">{tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div></Surface>)}</div></section>

      <section className="mt-20 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(25,198,237,.12),rgba(167,139,250,.06)_54%,rgba(255,122,26,.10))] p-7 sm:p-10"><div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-2 text-emerald-300"><ShieldCheck size={18} /><span className="text-xs font-bold uppercase tracking-[.16em]">Free-tier thoughtful</span></div><h2 className="mt-4 text-3xl font-bold tracking-[-.04em]">Serious chess without an always-on engine bill.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">Clocks render locally. Stockfish runs in a Web Worker. Local and AI play avoid cloud traffic until you save. Online state is compact and authoritative. That architecture keeps the service responsive while respecting shared-resource limits.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1"><SmallSignal icon={CloudOff} label="Offline-ready" /><SmallSignal icon={MessageSquare} label="Safe social tools" /><SmallSignal icon={ShieldCheck} label="Server-validated" /></div></div></section>

      <section className="mt-20 text-center"><p className="eyebrow">Your move</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">Start with a board. Keep what matters.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">Play instantly as a guest, then create a permanent account when you want ratings, events, friends, and saved progress.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><ButtonLink href="/play">Choose a mode<ArrowRight size={16} /></ButtonLink><ButtonLink href="/how-to-play" variant="secondary">Learn the basics</ButtonLink></div></section>
    </PublicPage>
  );
}

function SmallSignal({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) { return <div className="flex min-w-36 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3 text-xs font-bold"><Icon size={15} className="text-[var(--accent)]" />{label}</div>; }
