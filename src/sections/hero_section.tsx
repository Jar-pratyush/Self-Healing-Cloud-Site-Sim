import { PulseTrace } from "../components/pulse_trace";
import "./hero_section.css";

export function HeroSection() {
  return (
    <section className="hero_section" aria-labelledby="hero_heading">
      <div className="page_width">
        <p className="eyebrow hero_eyebrow">B.Tech capstone · Reinforcement learning · Kubernetes</p>
        <h1 id="hero_heading" className="hero_title">
          Self-Healing Cloud <em>Infrastructure</em>
        </h1>
        <p className="hero_subtitle">
          An agent watches a live online shop every 20 seconds. When something breaks, it picks one repair: restart a
          service, scale it, or put it back the way it was. It learned on a real cluster with real faults, not in a
          simulator.
        </p>
        <div className="hero_actions">
          <a className="hero_button hero_button_primary" href="#replay">
            Watch a recorded incident
          </a>
          <a className="hero_button" href="#results">
            See the results
          </a>
        </div>
      </div>
      <div className="hero_trace_band">
        <PulseTrace />
      </div>
      <div className="page_width">
        <p className="hero_credit">
          Researched, experimented and brought to you by <span>Pratyush, Zaid and Team</span>.
        </p>
      </div>
    </section>
  );
}
