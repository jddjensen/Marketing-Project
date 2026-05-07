"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";
import {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  isColorMode,
  type ColorMode,
} from "@/lib/colorMode";

type AppearanceContextValue = {
  theme: ThemeId;
  colorMode: ColorMode;
  setTheme: (theme: ThemeId) => void;
  setColorMode: (mode: ColorMode) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function readInitialTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  // The inline boot script in layout.tsx sets data-theme before paint, so
  // the DOM is the most up-to-date source even before localStorage is read.
  const fromDom = document.documentElement.dataset.theme;
  if (isThemeId(fromDom)) return fromDom;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    /* localStorage may be blocked */
  }
  return DEFAULT_THEME;
}

function readInitialColorMode(): ColorMode {
  if (typeof window === "undefined") return DEFAULT_COLOR_MODE;
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (isColorMode(stored)) return stored;
  } catch {
    /* localStorage may be blocked */
  }
  return DEFAULT_COLOR_MODE;
}

function resolveColorScheme(mode: ColorMode): "light" | "dark" {
  if (mode === "auto") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);
  const [colorMode, setColorModeState] = useState<ColorMode>(readInitialColorMode);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      if (next === DEFAULT_THEME) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", next);
      }
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* preference stays in-memory */
    }
  }, []);

  const setColorMode = useCallback((next: ColorMode) => {
    setColorModeState(next);
    if (typeof document !== "undefined") {
      const resolved = resolveColorScheme(next);
      document.documentElement.setAttribute("data-color-scheme", resolved);
    }
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    } catch {
      /* preference stays in-memory */
    }
  }, []);

  // Track OS theme changes when the user is on "auto".
  useEffect(() => {
    if (colorMode !== "auto") return;
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved: "light" | "dark" = mql.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-color-scheme", resolved);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [colorMode]);

  return (
    <AppearanceContext.Provider value={{ theme, colorMode, setTheme, setColorMode }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used inside <AppearanceProvider>");
  }
  return ctx;
}
