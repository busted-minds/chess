import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Pill } from "@/components/ui/surface";
import { AdminConsole } from "./admin-console";

export const metadata: Metadata = { title: "Administration", description: "Restricted operational console for Busted Minds Chess.", robots: { index: false, follow: false } };
export default function AdminPage() { return <AppShell title="Administration" description="Users, House Players, moderation, feature policy, health, and capacity—designed for server-verified roles and audited mutations." actions={<Pill className="border-emerald-400/20 text-emerald-300"><ShieldCheck size={13} />Restricted area</Pill>}><AdminConsole /></AppShell>; }
