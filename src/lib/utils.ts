import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatClock(totalMs: number) {
  const safeMs = Math.max(0, totalMs);
  if (safeMs < 10_000) return `${(safeMs / 1000).toFixed(1)}`;
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}
