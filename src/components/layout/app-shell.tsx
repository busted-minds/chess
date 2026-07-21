"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, CircleUserRound } from "lucide-react";
import { secondaryNavigation } from "@/lib/data/content";
import { cn } from "@/lib/utils";

export function AppShell({ children, title, description, actions }: { children: React.ReactNode; title?: string; description?: string; actions?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--page)]">
      <div className="mx-auto grid max-w-[1480px] gap-0 lg:grid-cols-[220px_1fr]">
        <aside className="hidden min-h-[calc(100vh-72px)] border-r border-[var(--border)] px-3 py-6 lg:block">
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-[#04111d]"><CircleUserRound size={21} /></div>
            <div className="min-w-0"><p className="truncate text-sm font-bold">Guest player</p><Link href="/auth" className="text-xs text-[var(--accent)]">Save your progress</Link></div>
          </div>
          <nav aria-label="Chess tools" className="space-y-1">
            {secondaryNavigation.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return <Link key={href} href={href} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]")}><Icon size={17} /><span>{label}</span>{active && <ChevronRight size={15} className="ml-auto" />}</Link>;
            })}
          </nav>
          <div className="mt-8 rounded-2xl border border-orange-400/20 bg-orange-400/8 p-4">
            <p className="text-xs font-bold text-orange-300">Daily spark</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">One puzzle keeps your streak alive.</p>
            <Link href="/puzzles" className="mt-3 inline-flex text-xs font-bold text-orange-300">Solve now →</Link>
          </div>
        </aside>
        <section className="min-w-0 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          {(title || actions) && <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{title && <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{title}</h1>}{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{description}</p>}</div>{actions}</div>}
          {children}
        </section>
      </div>
    </main>
  );
}
