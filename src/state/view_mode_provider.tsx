import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { view_mode_context, type AudienceMode, type ThemeMode } from "./view_mode_context";

const audience_storage_key = "audience_mode";
const theme_storage_key = "theme_mode";

// Storage may be unavailable (private windows, blocked site data), so every
// read and write is wrapped and the page falls back to sensible defaults.
function read_storage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write_storage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the choice simply is not remembered.
  }
}

function initial_audience(): AudienceMode {
  return read_storage(audience_storage_key) === "technical" ? "technical" : "plain";
}

// The night palette is the default; the paper palette is used when the
// visitor chose it before or when the system asks for a light scheme.
function initial_theme(): ThemeMode {
  const saved_theme = read_storage(theme_storage_key);
  if (saved_theme === "light" || saved_theme === "dark") {
    return saved_theme;
  }
  const prefers_light = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  return prefers_light ? "light" : "dark";
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [audience_mode, set_audience_state] = useState<AudienceMode>(initial_audience);
  const [theme_mode, set_theme_state] = useState<ThemeMode>(initial_theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-audience", audience_mode);
  }, [audience_mode]);

  const set_audience_mode = useCallback((next_mode: AudienceMode) => {
    set_audience_state(next_mode);
    write_storage(audience_storage_key, next_mode);
  }, []);

  const toggle_theme_mode = useCallback(() => {
    set_theme_state((current_mode) => {
      const next_mode: ThemeMode = current_mode === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next_mode);
      write_storage(theme_storage_key, next_mode);
      return next_mode;
    });
  }, []);

  const value = useMemo(
    () => ({ audience_mode, theme_mode, set_audience_mode, toggle_theme_mode }),
    [audience_mode, theme_mode, set_audience_mode, toggle_theme_mode],
  );

  return <view_mode_context.Provider value={value}>{children}</view_mode_context.Provider>;
}
