import type { ReactNode } from "react";
import { CircleDot, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow, Surface } from "@/components/ui/surface";

export function PublicPage({
  eyebrow,
  title,
  intro,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <>
      <main className="relative overflow-hidden bg-[var(--page)]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_72%_10%,rgba(25,198,237,.13),transparent_36%),radial-gradient(circle_at_18%_2%,rgba(255,122,26,.08),transparent_30%)]" />
        <div className="relative mx-auto max-w-[1180px] px-5 pb-20 pt-16 sm:px-8 sm:pt-20">
          <div className={aside ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end" : "max-w-3xl"}>
            <div>
              <Eyebrow>{eyebrow}</Eyebrow>
              <h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-6xl">{title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">{intro}</p>
            </div>
            {aside}
          </div>
          <div className="mt-12 sm:mt-16">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function BetaNotice({ children }: { children?: ReactNode }) {
  return (
    <Surface className="border-cyan-300/20 bg-cyan-400/[.06] p-5">
      <div className="flex gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-[var(--accent)]"><CircleDot size={17} /></span>
        <div>
          <p className="text-sm font-bold">Public beta, built with care</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{children ?? "Features may evolve while we learn from early players. Core chess rules are validated, and competitive or social actions clearly identify when an account is required."}</p>
        </div>
      </div>
    </Surface>
  );
}

export function PolicyLayout({
  updated,
  summary,
  sections,
}: {
  updated: string;
  summary: ReactNode;
  sections: Array<{ id: string; title: string; body: ReactNode }>;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Surface className="p-4">
          <p className="px-2 text-xs font-bold text-[var(--text-faint)]">On this page</p>
          <nav aria-label="Policy sections" className="mt-2">
            {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="block rounded-xl px-2 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">{section.title}</a>)}
          </nav>
        </Surface>
      </aside>
      <article className="min-w-0">
        <Surface className="mb-5 border-emerald-400/15 bg-emerald-400/[.05] p-5">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-300" size={19} /><div><p className="text-sm font-bold">Plain-language summary</p><div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{summary}</div></div></div>
        </Surface>
        <p className="mb-8 text-xs text-[var(--text-faint)]">Effective and last updated: {updated}</p>
        <div className="space-y-10">
          {sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-28"><h2 className="text-2xl font-bold tracking-[-.03em]">{section.title}</h2><div className="mt-4 space-y-4 text-sm leading-7 text-[var(--text-muted)]">{section.body}</div></section>)}
        </div>
      </article>
    </div>
  );
}

export function ProseList({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-2 marker:text-[var(--accent)]">{children}</ul>;
}
