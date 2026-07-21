import { cn } from "@/lib/utils";

export function Surface({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]", className)} {...props}>{children}</div>;
}

export function Eyebrow({ className, children }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[11px] font-bold uppercase tracking-[0.19em] text-[var(--accent)]", className)}>{children}</p>;
}

export function Pill({ className, children }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]", className)}>{children}</span>;
}
