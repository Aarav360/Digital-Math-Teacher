import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "theme";
const listeners = new Set<() => void>();

let currentTheme: Theme = "light";
let resolvedTheme: "light" | "dark" = "light";
let initialized = false;
let mediaQuery: MediaQueryList | null = null;

const notify = () => {
  listeners.forEach((listener) => listener());
};

const getSystemTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (nextTheme: Theme) => {
  if (typeof document === "undefined") return;
  const nextResolved = nextTheme === "system" ? getSystemTheme() : nextTheme;
  resolvedTheme = nextResolved;
  document.documentElement.classList.toggle("dark", nextResolved === "dark");
};

const setThemeInternal = (nextTheme: Theme, persist: boolean) => {
  currentTheme = nextTheme;
  if (persist && typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }
  applyTheme(nextTheme);
  notify();
};

const initTheme = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    currentTheme = stored;
  } else {
    currentTheme = "light";
  }

  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    if (currentTheme === "system") {
      applyTheme("system");
      notify();
    }
  };
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handleChange);
  } else {
    mediaQuery.addListener(handleChange);
  }

  applyTheme(currentTheme);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => {
      initTheme();
      return currentTheme;
    },
    () => "light"
  );

  const resolved = useSyncExternalStore(
    subscribe,
    () => {
      initTheme();
      return resolvedTheme;
    },
    () => "light"
  );

  useEffect(() => {
    initTheme();
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeInternal(nextTheme, true);
  }, []);

  return { theme, resolvedTheme: resolved, setTheme };
}
