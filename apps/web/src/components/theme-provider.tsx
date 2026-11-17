"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const themes = [
  { id: "ghar", name: "Ghar Green", color: "#287b63" }, { id: "ocean", name: "Ocean", color: "#167b9b" },
  { id: "violet", name: "Violet", color: "#7357b7" }, { id: "rose", name: "Rose", color: "#bd5870" },
  { id: "amber", name: "Amber", color: "#b37b24" }, { id: "teal", name: "Teal", color: "#16877e" },
  { id: "slate", name: "Slate", color: "#586b83" }, { id: "midnight", name: "Midnight", color: "#526be0" },
] as const;
export type ThemeMode = typeof themes[number]["id"] | "system";
const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({ mode: "system", setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const saved = localStorage.getItem("gharsync-theme") as ThemeMode | null;
    if (saved && (saved === "system" || themes.some((theme) => theme.id === saved))) setMode(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("gharsync-theme", mode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = mode === "system" ? (media.matches ? "midnight" : "ghar") : mode;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeMode = mode;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
