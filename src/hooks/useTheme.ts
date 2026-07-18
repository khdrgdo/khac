import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "theme";

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function initTheme() {
  if (typeof window === "undefined") return;
  const saved = (localStorage.getItem(KEY) as Theme | null);
  const t: Theme = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(t);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(KEY) as Theme | null) ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  useEffect(() => { applyTheme(theme); }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  }
  function toggle() { setTheme(theme === "dark" ? "light" : "dark"); }
  return { theme, setTheme, toggle };
}
