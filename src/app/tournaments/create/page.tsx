import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { CreateTournamentForm } from "./create-tournament-form";

export const metadata: Metadata = { title: "Create a tournament", description: "Create a public, unlisted, or private Arena or Swiss chess tournament with clear competition and House Player settings." };
export default function CreateTournamentPage() { return <AppShell title="Create a tournament" description="Set the pace, field, and fair-play boundaries. You can review every choice before the event is created."><ButtonLink href="/tournaments" variant="ghost" size="sm" className="mb-5 px-0"><ArrowLeft size={15} />All tournaments</ButtonLink><CreateTournamentForm /></AppShell>; }
