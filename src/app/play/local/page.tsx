import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { ChessRoom } from "@/components/chess/chess-room";
import { Pill } from "@/components/ui/surface";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Local hotseat", description: "Play offline hotseat chess on one device." };

export default function LocalPlayPage() {
  return <AppShell title="Local hotseat" description="One device, two players, no account. The game stays on this device and restores after a refresh." actions={<Pill className="text-emerald-300"><WifiOff size={13} />Offline ready</Pill>}><ChessRoom mode="local" /></AppShell>;
}
