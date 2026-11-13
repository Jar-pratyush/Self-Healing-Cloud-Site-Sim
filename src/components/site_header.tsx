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

  return (
    <header className="site_header">
      <div className="page_width site_header_row">
        <a className="brand_link" href="#top" aria-label="Self-Healing Cloud, back to top">
          <BrandMark size={30} />
          <span className="brand_text">
            <span className="brand_title">Self-Healing Cloud</span>
            <span className="brand_subtitle">RL on a live Kubernetes cluster</span>
          </span>
        </a>

        <nav className="section_nav" aria-label="Sections">
          {section_list.map((entry) => (
            <a
              key={entry.section_id}
              href={`#${entry.section_id}`}
              className={entry.section_id === active_id ? "section_nav_link is_active" : "section_nav_link"}
              aria-current={entry.section_id === active_id ? "location" : undefined}
            >
              <span className="section_nav_number">§{entry.section_number}</span>
              {entry.nav_label}
            </a>
          ))}
        </nav>

        <div className="header_controls">
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
    </header>
  );
}
