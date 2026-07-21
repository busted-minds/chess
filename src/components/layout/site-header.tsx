"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Settings2, Sun, X } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ButtonLink } from "@/components/ui/button";
import { primaryNavigation } from "@/lib/data/content";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/app-providers";
import { PreferencesPanel } from "@/components/layout/preferences-panel";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme, language } = usePreferences();
  const copy = {
    en: { Home: "Home", Play: "Play", Learn: "Learn", Watch: "Watch", Community: "Community", signIn: "Sign in", playNow: "Play now", settings: "Settings" },
    ja: { Home: "ホーム", Play: "対局", Learn: "学ぶ", Watch: "観戦", Community: "コミュニティ", signIn: "ログイン", playNow: "今すぐ対局", settings: "設定" },
    es: { Home: "Inicio", Play: "Jugar", Learn: "Aprender", Watch: "Ver", Community: "Comunidad", signIn: "Entrar", playNow: "Jugar ahora", settings: "Ajustes" },
  }[language];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color:var(--header)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Busted Minds Chess home" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <BrandLogo className="h-14 w-36 sm:w-40" priority />
          </Link>
          <nav aria-label="Primary navigation" className="ml-3 hidden items-center gap-1 lg:flex">
            {primaryNavigation.map(({ href, label }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              return <Link key={href} href={href} className={cn("rounded-xl px-3.5 py-2 text-sm font-semibold transition", active ? "bg-[var(--surface-raised)] text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]")}>{copy[label as keyof typeof copy] ?? label}</Link>;
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="icon-button hidden sm:grid" aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setSettingsOpen(true)} className="icon-button hidden sm:grid" aria-label="Open display and accessibility settings"><Settings2 size={18} /></button>
            <ButtonLink href="/auth" variant="ghost" className="hidden sm:inline-flex">{copy.signIn}</ButtonLink>
            <ButtonLink href="/play/online" size="sm">{copy.playNow}</ButtonLink>
            <button onClick={() => setMenuOpen((open) => !open)} className="icon-button lg:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        {menuOpen && (
          <nav aria-label="Mobile navigation" className="border-t border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {primaryNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"><Icon size={17} />{copy[label as keyof typeof copy] ?? label}</Link>)}
              <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} className="flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"><Settings2 size={17} />{copy.settings}</button>
              <Link href="/auth" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">{copy.signIn}</Link>
            </div>
          </nav>
        )}
      </header>
      <PreferencesPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
