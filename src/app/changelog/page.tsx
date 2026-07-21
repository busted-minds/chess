import type { Metadata } from "next";
import { Accessibility, ArrowRight, BrainCircuit, CheckCircle2, CircleDot, CloudCog, Code2, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { PublicPage, BetaNotice } from "../features/_components/public-page";
import { ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Changelog", description: "What is new, changing, and still being validated in the Busted Minds Chess public beta." };

const entries = [
  {
    date: "July 21, 2026",
    title: "Public beta foundation",
    status: "Current build",
    summary: "The first connected product surface for playing, learning, watching, and finding a community.",
    groups: [
      { icon: Sparkles, title: "New", items: ["Distinct Online, Vs AI, Local, and private-invite entry points", "Dashboard, game archive, leaderboards, events, learning, watch, and community surfaces", "House Player profiles with visible system identity and distinct chess styles"] },
      { icon: Accessibility, title: "Experience", items: ["Dark and light themes with reduced-motion and contrast preferences", "Responsive navigation, keyboard focus states, and screen-reader-friendly labeling", "Installable PWA metadata and offline-aware Local and AI architecture"] },
      { icon: ShieldCheck, title: "Trust", items: ["Server-authoritative online game design and compact clock updates", "Public privacy, terms, community, licenses, and contact pages", "Rate-limit, role, moderation, and free-tier operational foundations"] },
    ],
  },
];

export default function ChangelogPage() { return <PublicPage eyebrow="Built in public" title="Changelog" intro="A concise record of meaningful product changes. During beta, we separate what is in the current build from what is being tested or considered." aside={<BetaNotice>This log reflects product-level changes, not every commit. A “planned” item is a direction, not a delivery promise; availability can depend on reliability and capacity.</BetaNotice>}>
  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="space-y-7">{entries.map((entry) => <article key={entry.title}><div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><CircleDot size={16} /></span><div><p className="text-xs font-bold text-[var(--text-faint)]">{entry.date}</p><h2 className="text-2xl font-bold tracking-[-.03em]">{entry.title}</h2></div><Pill className="ml-auto hidden sm:inline-flex"><CheckCircle2 size={12} className="text-emerald-300" />{entry.status}</Pill></div><Surface className="p-6 sm:p-7"><p className="text-sm leading-6 text-[var(--text-muted)]">{entry.summary}</p><div className="mt-7 grid gap-7 md:grid-cols-3">{entry.groups.map(({ icon: Icon, title, items }) => <section key={title}><Icon size={19} className="text-[var(--accent)]" /><h3 className="mt-3 font-bold">{title}</h3><ul className="mt-3 space-y-3">{items.map((item) => <li key={item} className="text-xs leading-5 text-[var(--text-muted)]">{item}</li>)}</ul></section>)}</div></Surface></article>)}</div>
    <aside className="space-y-5"><Surface className="p-5"><div className="flex items-center gap-2"><CloudCog size={18} className="text-[var(--accent)]" /><h2 className="font-bold">Beta signals</h2></div><div className="mt-5 space-y-4"><Signal label="Core game rules" status="Validation active" /><Signal label="Online services" status="Configuration-dependent" /><Signal label="Social & events" status="Early access" /><Signal label="Pricing" status="No paid plan announced" /></div></Surface><Surface className="p-5"><BrainCircuit size={20} className="text-violet-300" /><h2 className="mt-4 font-bold">What we are watching</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Engine loading on low-memory devices, reconnect behavior, clock clarity, accessible board control, and low-population matchmaking quality.</p></Surface><Surface className="p-5"><MessageSquareText size={20} className="text-orange-300" /><h2 className="mt-4 font-bold">Shape the next update</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Specific examples help more than feature votes alone. Tell us the task you were trying to complete.</p><ButtonLink href="/contact" variant="ghost" size="sm" className="mt-3 px-0">Send feedback<ArrowRight size={14} /></ButtonLink></Surface></aside>
  </div>
  </PublicPage>; }

function Signal({ label, status }: { label: string; status: string }) { return <div><p className="text-sm font-bold">{label}</p><p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]"><Code2 size={12} />{status}</p></div>; }
