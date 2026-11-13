import "./pulse_trace.css";

// Decorative signal for the hero: steady, then a fault, then the repair.
// It carries no data; the recorded traces live in the replay section.
export function PulseTrace() {
  return (
    <svg className="pulse_trace" viewBox="0 0 1200 160" aria-hidden="true">
      <path className="pulse_baseline" d="M0 96 H1200" />
      <path
        className="pulse_healthy"
        pathLength={100}
        d="M0 96 H180 l14 -10 l12 18 l10 -8 H360"
      />
      <path
        className="pulse_fault"
        pathLength={100}
        d="M360 96 l18 -62 l16 104 l14 -84 l18 70 l14 -56 l16 48 l16 -30 H560"
      />
      <path
        className="pulse_repair"
        pathLength={100}
        d="M560 96 l20 -8 l18 10 l22 -4 H760 l14 -10 l12 18 l10 -8 H1200"
      />
      <circle className="pulse_marker pulse_marker_fault" cx="378" cy="34" r="5" />
      <circle className="pulse_marker pulse_marker_repair" cx="560" cy="96" r="5" />
    </svg>
  );
}
