import { useEffect, useState } from "react";
import type { ThemeMode } from "../store";

export type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode): Theme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function useTheme(mode: ThemeMode): Theme {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(mode));

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = (nextMode: ThemeMode) => {
      setTheme(resolveTheme(nextMode));
    };
    const handler = (e: MediaQueryListEvent) => {
      if (mode === "system") {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    syncTheme(mode);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [mode]);

  return theme;
}
