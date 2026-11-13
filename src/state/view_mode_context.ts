import { createContext, useContext } from "react";

export type AudienceMode = "plain" | "technical";
export type ThemeMode = "dark" | "light";

export type ViewModeValue = {
  audience_mode: AudienceMode;
  theme_mode: ThemeMode;
  set_audience_mode: (next_mode: AudienceMode) => void;
  toggle_theme_mode: () => void;
};

export const view_mode_context = createContext<ViewModeValue | null>(null);

export function useViewMode(): ViewModeValue {
  const value = useContext(view_mode_context);
  if (!value) {
    throw new Error("useViewMode must be used inside ViewModeProvider");
  }
  return value;
}
