"use client";

import { Moon, Sun, X } from "lucide-react";
import { useEffect } from "react";
import { usePreferences } from "@/components/providers/app-providers";

export function PreferencesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const preferences = usePreferences();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!open) return null;

  const toggles = [
    ["coordinates", "Board coordinates", "Show files and ranks on the board"],
    ["sound", "Move sounds", "Play subtle move and game sounds"],
    ["highContrast", "High contrast", "Increase borders and text separation"],
    ["reducedMotion", "Reduced motion", "Minimize transitions and animation"],
  ] as const;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/55 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="preferences-title" className="h-full w-full max-w-md border-l border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between">
          <div><p className="eyebrow">Make it yours</p><h2 id="preferences-title" className="mt-1 text-2xl font-bold">Display & accessibility</h2></div>
          <button onClick={onClose} className="icon-button" aria-label="Close settings"><X size={20} /></button>
        </div>
        <div className="mt-8">
          <p className="text-sm font-bold">Theme</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={() => preferences.setTheme("dark")} className={`preference-choice ${preferences.theme === "dark" ? "preference-choice-active" : ""}`}><Moon size={18} />Dark</button>
            <button onClick={() => preferences.setTheme("light")} className={`preference-choice ${preferences.theme === "light" ? "preference-choice-active" : ""}`}><Sun size={18} />Light</button>
          </div>
        </div>
        <div className="mt-8 divide-y divide-[var(--border)]">
          {toggles.map(([key, label, description]) => (
            <label key={key} className="flex cursor-pointer items-center gap-4 py-4">
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{description}</span></span>
              <input type="checkbox" className="toggle" checked={preferences[key]} onChange={(event) => preferences.updateSetting(key, event.target.checked)} />
            </label>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold">Board palette<select value={preferences.boardTheme} onChange={(event) => preferences.updateSetting("boardTheme", event.target.value as typeof preferences.boardTheme)} className="form-control mt-2"><option value="ocean">Ocean</option><option value="walnut">Walnut</option><option value="colorblind">Color-safe</option></select></label>
          <label className="text-xs font-bold">Piece style<select value={preferences.pieceSet} onChange={(event) => preferences.updateSetting("pieceSet", event.target.value as typeof preferences.pieceSet)} className="form-control mt-2"><option value="classic">Classic</option><option value="minimal">Minimal symbols</option></select></label>
        </div>
        <label className="mt-5 block text-xs font-bold">Interface language<select value={preferences.language} onChange={(event) => preferences.updateSetting("language", event.target.value as typeof preferences.language)} className="form-control mt-2"><option value="en">English</option><option value="ja">日本語</option><option value="es">Español</option></select></label>
        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <p className="text-sm font-bold">Keyboard board controls</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Focus the board, use arrow keys to choose a square, press Enter to select a piece and Enter again to move. Moves are announced to screen readers.</p>
        </div>
      </section>
    </div>
  );
}
