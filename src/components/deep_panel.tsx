import { useState, type ReactNode } from "react";
import { useViewMode, type AudienceMode } from "../state/view_mode_context";
import "./deep_panel.css";

type DeepPanelProps = {
  title: string;
  children: ReactNode;
};

type ManualChoice = {
  chosen_under: AudienceMode;
  is_open: boolean;
};

// Technical detail that sits inline with the plain story. In technical mode
// every panel starts open; in plain mode it starts closed. A visitor can still
// open or close any single panel, and that choice holds until the global
// switch is flipped again.
export function DeepPanel({ title, children }: DeepPanelProps) {
  const { audience_mode } = useViewMode();
  const [manual_choice, set_manual_choice] = useState<ManualChoice | null>(null);

  const default_open = audience_mode === "technical";
  const is_open =
    manual_choice && manual_choice.chosen_under === audience_mode ? manual_choice.is_open : default_open;

  return (
    <details className="deep_panel" open={is_open}>
      <summary
        className="deep_panel_summary"
        onClick={(click_event) => {
          click_event.preventDefault();
          set_manual_choice({ chosen_under: audience_mode, is_open: !is_open });
        }}
      >
        <span className="deep_panel_tag">Technical</span>
        <span className="deep_panel_title">{title}</span>
        <span className="deep_panel_chevron" aria-hidden="true" />
      </summary>
      <div className="deep_panel_body">{children}</div>
    </details>
  );
}
