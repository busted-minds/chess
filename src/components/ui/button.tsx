import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const styles = {
  primary: "bg-[var(--accent)] text-[#031421] shadow-[0_12px_38px_rgba(25,198,237,.22)] hover:-translate-y-0.5 hover:bg-[var(--accent-bright)]",
  secondary: "border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text)] hover:border-[var(--accent-muted)] hover:bg-[var(--surface-hover)]",
  ghost: "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
  danger: "bg-red-500/12 text-red-300 ring-1 ring-red-400/20 hover:bg-red-500/20",
};

const sizes = {
  sm: "h-9 rounded-xl px-3 text-sm",
  md: "h-11 rounded-xl px-4 text-sm",
  lg: "h-13 rounded-2xl px-5 text-[15px]",
};

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn("inline-flex items-center justify-center gap-2 font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-45", styles[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({ href, children, className, variant = "primary", size = "md", ...props }: React.ComponentProps<typeof Link> & Pick<ButtonProps, "variant" | "size">) {
  return <Link href={href} className={cn("inline-flex items-center justify-center gap-2 font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]", styles[variant], sizes[size], className)} {...props}>{children}</Link>;
}
