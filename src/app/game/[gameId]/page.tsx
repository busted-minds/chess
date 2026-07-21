import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { OnlineGameRoom } from "@/components/chess/online-game-room";

export const metadata: Metadata = { title: "Live game", robots: { index: false, follow: false } };

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) { const { gameId } = await params; return <AppShell title="Live game" description="PostgreSQL is the source of truth. Realtime wakes the room; reconnection always reloads the durable position."><OnlineGameRoom gameId={gameId} /></AppShell>; }
