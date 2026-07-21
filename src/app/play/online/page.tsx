import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { OnlineMatchmaker } from "@/components/chess/online-matchmaker";

export const metadata: Metadata = { title: "Play online", description: "Find a live chess opponent or a calibrated Busted Minds house player." };

export default function OnlinePlayPage() { return <AppShell title="Online play" description="Fast matchmaking designed to stay useful from the very first player."><OnlineMatchmaker /></AppShell>; }
