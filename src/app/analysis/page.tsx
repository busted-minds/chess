import type { Metadata } from "next";
import { BrainCircuit, Cpu } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ChessRoom } from "@/components/chess/chess-room";
import { Pill } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Analysis board" };
export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ fen?: string }> }) { const { fen } = await searchParams; return <AppShell title="Analysis board" description="Explore any position with multiple Stockfish lines. Analysis runs locally and is not saved unless you choose to keep a compact summary." actions={<div className="flex gap-2"><Pill><Cpu size={13} />Stockfish 18 lite</Pill><Pill className="text-emerald-300"><BrainCircuit size={13} />Local compute</Pill></div>}><ChessRoom mode="analysis" initialFen={fen} compact /></AppShell>; }
