import type { Metadata } from "next";
import { ArrowRight, CircleHelp, LockKeyhole, Radio, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { PublicPage, BetaNotice } from "../features/_components/public-page";
import { ButtonLink } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Frequently asked questions", description: "Answers about accounts, online chess, house players, analysis, privacy, ratings, accessibility, and the Busted Minds Chess beta." };

const categories = [
  { title: "Playing", icon: Radio, items: [
    ["Can I play without an account?", "Yes. Local Hotseat and Vs AI are available without signing in and run primarily in your browser. A permanent account is required for rated online games, persistent ratings, tournaments, clubs, friends, messages, achievements, and saved progress."],
    ["What happens when few people are online?", "Matchmaking first searches for a compatible opponent. Depending on your settings and the active configuration, it can then offer a clearly identified fictional house player at a suitable clock and strength."],
    ["Are house players real people?", "No. House players are system-controlled chess opponents with fictional profiles and distinct playing styles. Their profiles identify them as House Players, and they use only a small set of chess-specific messages."],
    ["Do Local and Vs AI work offline?", "After the required app and engine assets have loaded, Local is designed for offline play and Vs AI can work offline when its browser engine is available. Saving or sharing may wait until you reconnect."],
  ]},
  { title: "Accounts & competition", icon: UserRound, items: [
    ["Which sign-in methods are supported?", "Permanent accounts can use Google or email and password through Supabase Auth. Authentication emails are delivered through the project’s configured SMTP provider. Only basic Google identity scopes are requested."],
    ["Can I keep guest progress?", "The account-upgrade flow is designed to preserve eligible guest games and local progress. The interface will show exactly what can be moved before you confirm."],
    ["How do ratings work?", "Bullet, blitz, rapid, and classical ratings are tracked separately. Only completed rated games change ratings, and both sides are updated atomically by trusted server logic."],
    ["Can I play a house player in a rated game?", "Only when administrators enable fixed-strength rated house play for that time control. Casual bot games remain separate, and configured rankings can exclude house players."],
  ]},
  { title: "Analysis, privacy & safety", icon: LockKeyhole, items: [
    ["Where does Stockfish run?", "Long engine analysis and direct AI play run in a browser Web Worker. Busted Minds Chess does not run long analysis jobs inside serverless functions, and large engine output is not saved by default."],
    ["What data is stored for a game?", "Online games need compact moves, clocks, participants, result, and integrity metadata. Local and direct AI games do not use cloud storage unless you explicitly save eligible progress."],
    ["How do reports and blocking work?", "Permanent accounts can block, mute, and report. Reports are reviewed in a restricted moderation workflow. House players cannot create reports or behave as personal contacts."],
    ["Is the service free?", "The beta is designed around a useful free experience and efficient shared infrastructure. If paid options are ever introduced, their price and impact will be explained before any purchase; competitive integrity will not be sold."],
  ]},
  { title: "Beta & accessibility", icon: Sparkles, items: [
    ["What does public beta mean?", "The product is still being validated with early players. Features, limits, and presentation may change; maintenance windows and occasional defects are possible. We aim to label preview states honestly."],
    ["Which accessibility options are available?", "The interface is designed for keyboard navigation, screen-reader move announcements, reduced motion, high contrast, board coordinates, responsive layouts, and color-aware themes. Please report anything that blocks play."],
    ["How can I send feedback?", "Use the Contact page and choose Product feedback, bug report, safety concern, or another relevant topic. Do not include passwords, access tokens, or sensitive identity documents."],
  ]},
];

export default function FaqPage() { return <PublicPage eyebrow="Good questions, straight answers" title="What would you like to know?" intro="Start with the essentials below. We explain system-controlled opponents, browser-based analysis, account boundaries, and beta limits without hiding the interesting details." aside={<BetaNotice>Policies and capabilities may mature during beta. The Privacy and Terms pages are the authoritative source when an answer involves your data or legal rights.</BetaNotice>}>
  <div className="mx-auto max-w-4xl">
    <Surface className="mb-10 flex items-center gap-3 p-4"><CircleHelp size={18} className="shrink-0 text-[var(--accent)]" /><p className="text-sm text-[var(--text-muted)]"><strong className="text-[var(--text)]">Looking for a phrase?</strong> Use your browser’s Find command (Ctrl+F or Command+F) to search every answer on this page.</p></Surface>
    <div className="space-y-12">{categories.map(({ title, icon: Icon, items }) => <section key={title}><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={19} /></span><h2 className="text-xl font-bold">{title}</h2></div><div className="space-y-3">{items.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] open:border-[var(--border-strong)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]">{question}<CircleHelp size={17} className="shrink-0 text-[var(--text-faint)] transition group-open:rotate-45 group-open:text-[var(--accent)]" /></summary><p className="border-t border-[var(--border)] px-5 py-4 text-sm leading-7 text-[var(--text-muted)]">{answer}</p></details>)}</div></section>)}</div>
    <Surface className="mt-12 border-emerald-400/15 bg-emerald-400/[.05] p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><ShieldCheck size={21} className="shrink-0 text-emerald-300" /><div><h2 className="font-bold">Still unsure?</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Send a focused note and include the page, device, and what you expected to happen.</p></div></div><ButtonLink href="/contact" variant="secondary">Contact us<ArrowRight size={15} /></ButtonLink></div></Surface>
  </div>
  </PublicPage>; }
