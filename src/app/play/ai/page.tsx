import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ChessRoom } from "@/components/chess/chess-room";
import { Pill } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Play vs AI", description: "Challenge Stockfish and personality-driven chess opponents in your browser." };

export default async function AiPlayPage({ searchParams }: { searchParams: Promise<{ profile?: string; color?: string }> }) {
  const query = await searchParams;
  return <AppShell title="Vs AI" description="Stockfish loads lazily in a browser worker. Your position never needs a long-running server calculation." actions={<Pill className="text-violet-300"><BrainCircuit size={13} />Browser engine</Pill>}><ChessRoom mode="ai" aiProfileId={query.profile} humanColor={query.color === "black" ? "b" : "w"} /></AppShell>;
}
