"use client";
import { useEffect, useState } from "react";
import { THEMES, type Theme, type ThemeName } from "@/lib/viz/theme";

import { THEME_KEY as KEY } from "@/lib/viz/themeBoot";

export function readTheme(): ThemeName {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setThemeName(t: ThemeName) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
}

/** The live Theme object; re-renders when the html[data-theme] attribute changes. */
export function useTheme(): Theme {
  const [name, setName] = useState<ThemeName>("dark");
  useEffect(() => {
    setName(readTheme());
    const mo = new MutationObserver(() => setName(readTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return THEMES[name];
}

export function ThemeToggle() {
  const T = useTheme();
  return (
    <label className="theme" title="Light / dark">
      <span className="sun" aria-hidden>☀</span>
      <input type="checkbox" role="switch" aria-label="Dark mode" checked={T.name === "dark"} onChange={(e) => setThemeName(e.target.checked ? "dark" : "light")} />
      <i />
      <span className="moon" aria-hidden>☾</span>
    </label>
  );
}

export function Toggle({ id, label, checked, onChange, disabled }: { id?: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="tog">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <i /><span>{label}</span>
    </label>
  );
}
