import { useEffect, useRef, useState } from "react";
import { section_list } from "../content/section_list";
import { useActiveSection } from "../hooks/use_active_section";
import { useViewMode, type AudienceMode } from "../state/view_mode_context";
import { BrandMark } from "./brand_mark";
import "./site_header.css";

const audience_options: { mode: AudienceMode; label: string; hint: string }[] = [
  { mode: "plain", label: "Plain", hint: "Plain-language explanations" },
  { mode: "technical", label: "Technical", hint: "Formulas, settings and statistics" },
];

const section_ids = section_list.map((entry) => entry.section_id);

export function SiteHeader() {
  const { audience_mode, set_audience_mode, theme_mode, toggle_theme_mode } = useViewMode();
  const active_id = useActiveSection(section_ids);
  const next_theme_label = theme_mode === "dark" ? "Switch to paper theme" : "Switch to night theme";
  const [is_menu_open, set_is_menu_open] = useState(false);
  const header_ref = useRef<HTMLElement>(null);
  const menu_button_ref = useRef<HTMLButtonElement>(null);
  const active_entry = section_list.find((entry) => entry.section_id === active_id);

  // The phone menu closes on Escape (returning focus to its button) and on
  // any press outside the header.
  useEffect(() => {
    if (!is_menu_open) {
      return;
    }
    const close_on_escape = (key_event: KeyboardEvent) => {
      if (key_event.key === "Escape") {
        set_is_menu_open(false);
        menu_button_ref.current?.focus();
      }
    };
    const close_on_outside = (pointer_event: PointerEvent) => {
      if (header_ref.current && !header_ref.current.contains(pointer_event.target as Node)) {
        set_is_menu_open(false);
      }
    };
    document.addEventListener("keydown", close_on_escape);
    document.addEventListener("pointerdown", close_on_outside);
    return () => {
      document.removeEventListener("keydown", close_on_escape);
      document.removeEventListener("pointerdown", close_on_outside);
    };
  }, [is_menu_open]);

  const section_links = (link_class: string) =>
    section_list.map((entry) => (
      <a
        key={entry.section_id}
        href={`#${entry.section_id}`}
        className={entry.section_id === active_id ? `${link_class} is_active` : link_class}
        aria-current={entry.section_id === active_id ? "location" : undefined}
        onClick={() => set_is_menu_open(false)}
      >
        <span className="section_nav_number">§{entry.section_number}</span>
        {entry.nav_label}
      </a>
    ));

  return (
    <header className="site_header" ref={header_ref}>
      <div className="page_width site_header_row">
        <a className="brand_link" href="#top" aria-label="Self-Healing Cloud, back to top">
          <BrandMark size={30} />
          <span className="brand_text">
            <span className="brand_title">Self-Healing Cloud</span>
            <span className="brand_subtitle">RL on a live Kubernetes cluster</span>
          </span>
        </a>

        <nav className="section_nav" aria-label="Sections">
          {section_links("section_nav_link")}
        </nav>

        <div className="header_controls">
          <button
            ref={menu_button_ref}
            type="button"
            className="menu_button"
            aria-expanded={is_menu_open}
            aria-controls="section_menu"
            onClick={() => set_is_menu_open((was_open) => !was_open)}
          >
            <span className="menu_button_label">{active_entry ? `§${active_entry.section_number}` : "Menu"}</span>
            <span className="menu_button_icon" aria-hidden="true" />
            <span className="visually_hidden">Sections</span>
          </button>
          <div className="audience_switch" role="group" aria-label="Level of detail">
            {audience_options.map((option) => (
              <button
                key={option.mode}
                type="button"
                className="audience_option"
                aria-pressed={audience_mode === option.mode}
                title={option.hint}
                onClick={() => set_audience_mode(option.mode)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button type="button" className="theme_button" onClick={toggle_theme_mode} aria-label={next_theme_label} title={next_theme_label}>
            {theme_mode === "dark" ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <nav id="section_menu" className={is_menu_open ? "section_menu is_open" : "section_menu"} aria-label="Sections">
        <div className="page_width section_menu_list">{section_links("section_menu_link")}</div>
      </nav>
    </header>
  );
}
