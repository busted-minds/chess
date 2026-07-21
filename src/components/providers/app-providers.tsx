"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";
export type BoardTheme = "ocean" | "walnut" | "colorblind";
export type PieceSet = "classic" | "minimal";
export type Language = "en" | "ja" | "es";
type AppSettings = {
  reducedMotion: boolean;
  highContrast: boolean;
  coordinates: boolean;
  sound: boolean;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  language: Language;
};

type Preferences = AppSettings & {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
};

const PreferenceContext = createContext<Preferences | null>(null);
const storageKey = "bm-chess-preferences-v1";

const defaults: AppSettings = {
  reducedMotion: false,
  highContrast: false,
  coordinates: true,
  sound: true,
  boardTheme: "ocean",
  pieceSet: "classic",
  language: "en",
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [settings, setSettings] = useState(defaults);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Partial<Preferences>;
      const preferred = saved.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      // Client storage is the external source of truth for these preferences.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(preferred);
      setSettings({ ...defaults, ...saved });
    } catch {
      // Preferences are intentionally optional.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.contrast = settings.highContrast ? "high" : "standard";
    root.dataset.motion = settings.reducedMotion ? "reduced" : "full";
    root.lang = settings.language;
    localStorage.setItem(storageKey, JSON.stringify({ theme, ...settings }));
  }, [settings, theme]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => setThemeState(nextTheme), []);
  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const value = useMemo(() => ({ theme, setTheme, ...settings, updateSetting }), [settings, setTheme, theme, updateSetting]);
  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferenceContext);
  if (!value) throw new Error("usePreferences must be used inside AppProviders");
  return value;
}
