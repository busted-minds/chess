import type { Metadata } from "next";
import { Flame, Gauge, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ChessRoom } from "@/components/chess/chess-room";
import { ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Puzzles" };
const puzzleFen = "7k/8/5QK1/8/8/8/8/8 w - - 0 1";

export default function PuzzlesPage() { return <AppShell title="Puzzle gym" description="Pattern recognition that meets you at the edge of your current ability." actions={<Pill className="text-orange-300"><Flame size={13} />6 day streak</Pill>}><div className="mb-5 grid gap-3 sm:grid-cols-3"><Stat icon={Target} label="Puzzle rating" value="1,426" /><Stat icon={Gauge} label="Today" value="7 / 10" /><Stat icon={Trophy} label="Best streak" value="34" /></div><Surface className="mb-5 border-orange-400/15 bg-orange-400/5 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-orange-200">Daily position · White to move</p><p className="mt-1 text-xs text-[var(--text-muted)]">Mate in one. Find the square the king cannot touch.</p></div><div className="flex gap-2"><Pill>Rated 1,520</Pill><ButtonLink href={`/analysis?fen=${encodeURIComponent(puzzleFen)}`} variant="ghost" size="sm">Analyze later</ButtonLink></div></div></Surface><ChessRoom mode="analysis" initialFen={puzzleFen} compact initialTimeMs={5 * 60_000} /></AppShell>; }
function Stat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) { return <Surface className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-xl bg-orange-400/10 text-orange-300"><Icon size={18} /></span><div><p className="text-lg font-black">{value}</p><p className="text-[10px] text-[var(--text-faint)]">{label}</p></div></Surface>; }
