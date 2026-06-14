import type { ThemeId } from "./theme.types";

const STORAGE_KEY = "wuf:theme";

function setTheme(id: ThemeId, options: { persist?: boolean } = {}): void {
  document.documentElement.dataset.theme = id;
  if (options.persist) {
    localStorage.setItem(STORAGE_KEY, id);
  }
}

function getStoredTheme(): ThemeId | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "dim" || raw === "light") return raw;
  return null;
}

export function applyInitialTheme(defaultTheme: ThemeId = "dim"): ThemeId {
  const stored = getStoredTheme();
  const next = stored ?? defaultTheme;
  document.documentElement.dataset.theme = next;
  return next;
}

