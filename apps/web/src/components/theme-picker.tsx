"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { themes, useTheme, type ThemeMode } from "@/components/theme-provider";

export function ThemePicker() {
  const { mode, setMode } = useTheme();
  const options: { id: ThemeMode; name: string; detail: string; color: string; icon: typeof Monitor }[] = [
    ...themes.map((theme) => ({ ...theme, detail: "Custom color palette", icon: theme.id === "midnight" ? Moon : Sun })),
    { id: "system", name: "System", detail: "Device ke light/dark mode ke saath", color: "linear-gradient(135deg,#f2f2ed 50%,#25313c 50%)", icon: Monitor },
  ];
  return <div className="theme-card-grid">{options.map(({ id, name, detail, color, icon: Icon }) => <button type="button" key={id} className={`theme-option ${mode === id ? "selected" : ""}`} aria-pressed={mode === id} onClick={() => setMode(id)}><span className="theme-swatch" style={{ background: color }}><Icon size={18}/></span><span><b>{name}</b><small>{detail}</small></span><i>{mode === id && <Check size={15}/>}</i></button>)}</div>;
}
