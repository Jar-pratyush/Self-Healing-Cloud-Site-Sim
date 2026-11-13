import { training_run_meta } from "../../content/policy_meta";
import type { TrainingInternals } from "../../data/data_types";
import { useElementWidth } from "../../hooks/use_element_width";

type InternalsChartsProps = {
  internals: Record<string, TrainingInternals>;
};

type SeriesKey = "critic_loss" | "actor_loss" | "entropy" | "q_mean";

type PanelSpec = {
  key: SeriesKey;
  title: string;
  note: string;
  log_scale: boolean;
};

const panel_specs: PanelSpec[] = [
  { key: "critic_loss", title: "Critic loss", note: "TD error plus the CQL penalty, both critics", log_scale: false },
  { key: "q_mean", title: "Mean Q value", note: "first critic, at the actions in the batch", log_scale: false },
  { key: "actor_loss", title: "Actor loss", note: "α·log π − Q, averaged under the policy", log_scale: false },
  { key: "entropy", title: "Policy entropy (nats, log scale)", note: "how spread out the action choice is", log_scale: true },
];

const chart_height = 170;
const margin = { top: 10, right: 10, bottom: 24, left: 44 };

function nice_ticks(low: number, high: number, log_scale: boolean): number[] {
  if (log_scale) {
    const ticks: number[] = [];
    for (let power = Math.floor(Math.log10(low)); power <= Math.ceil(Math.log10(high)); power += 1) {
      ticks.push(10 ** power);
    }
    return ticks;
  }
  const span = high - low || 1;
  const step = 10 ** Math.floor(Math.log10(span / 2));
  const scaled_step = span / step > 8 ? step * 2 : step;
  const ticks: number[] = [];
  for (let value = Math.ceil(low / scaled_step) * scaled_step; value <= high + 1e-9; value += scaled_step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

function format_tick(value: number, log_scale: boolean): string {
  if (log_scale) {
    return value >= 1 ? String(value) : value.toExponential(0).replace("e-", "e−");
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function SmallChart({ spec, internals, width }: { spec: PanelSpec; internals: Record<string, TrainingInternals>; width: number }) {
  const run_names = Object.keys(training_run_meta).filter((run_name) => internals[run_name]);
  const points_of = (run_name: string) => {
    const run = internals[run_name];
    if (!run) {
      return [];
    }
    return run.episode
      .map((episode, row_index) => ({ episode, value: run[spec.key][row_index] ?? null }))
      .filter((point): point is { episode: number; value: number } => point.value !== null && (!spec.log_scale || point.value > 0));
  };
  const all_points = run_names.flatMap(points_of);
  const max_episode = Math.max(...all_points.map((point) => point.episode));
  const min_value = Math.min(...all_points.map((point) => point.value));
  const max_value = Math.max(...all_points.map((point) => point.value));
  const ticks = nice_ticks(min_value, max_value, spec.log_scale);
  const y_low = spec.log_scale ? (ticks[0] ?? min_value) : Math.min(min_value, ticks[0] ?? min_value);
  const y_high = spec.log_scale ? (ticks[ticks.length - 1] ?? max_value) : Math.max(max_value, ticks[ticks.length - 1] ?? max_value);
  const transform = (value: number) => (spec.log_scale ? Math.log10(value) : value);
  const plot_width = Math.max(120, width - margin.left - margin.right);
  const plot_height = chart_height - margin.top - margin.bottom;
  const x_of = (episode: number) => margin.left + ((episode - 1) / Math.max(1, max_episode - 1)) * plot_width;
  const y_of = (value: number) =>
    margin.top + ((transform(y_high) - transform(value)) / (transform(y_high) - transform(y_low) || 1)) * plot_height;

  return (
    <figure className="internals_panel">
      <figcaption>
        <span className="internals_title">{spec.title}</span>
        <span className="internals_note">{spec.note}</span>
      </figcaption>
      <svg width={width} height={chart_height} role="img" aria-label={`${spec.title} per training episode for each run`}>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={margin.left} x2={margin.left + plot_width} y1={y_of(value)} y2={y_of(value)} className="grid_line" />
            <text x={margin.left - 6} y={y_of(value) + 4} className="axis_label" textAnchor="end">
              {format_tick(value, spec.log_scale)}
            </text>
          </g>
        ))}
        {[1, 100, 200].filter((episode) => episode <= max_episode).map((episode) => (
          <text key={episode} x={x_of(episode)} y={chart_height - 6} className="axis_label" textAnchor="middle">
            {episode}
          </text>
        ))}
        {run_names.map((run_name) => {
          const meta = training_run_meta[run_name];
          const path = points_of(run_name)
            .map((point, point_index) => `${point_index === 0 ? "M" : "L"}${x_of(point.episode).toFixed(1)},${y_of(point.value).toFixed(1)}`)
            .join("");
          return <path key={run_name} d={path} fill="none" stroke={meta?.color_var} strokeWidth={1.8} strokeDasharray={meta?.dash} />;
        })}
      </svg>
    </figure>
  );
}

// Learner diagnostics logged once per training episode, one small chart per
// quantity, all runs overlaid.
export function InternalsCharts({ internals }: InternalsChartsProps) {
  const { element_ref, width } = useElementWidth<HTMLDivElement>(300);
  const run_names = Object.keys(training_run_meta).filter((run_name) => internals[run_name]);
  return (
    <div className="internals_charts">
      <div className="internals_grid">
        {panel_specs.map((spec, spec_index) => (
          <div key={spec.key} ref={spec_index === 0 ? element_ref : undefined}>
            <SmallChart spec={spec} internals={internals} width={width} />
          </div>
        ))}
      </div>
      <ul className="chart_legend">
        {run_names.map((run_name) => (
          <li key={run_name} style={{ ["--legend_color" as string]: training_run_meta[run_name]?.color_var }}>
            <svg className="legend_line" width="26" height="8" aria-hidden="true">
              <line x1="0" x2="26" y1="4" y2="4" stroke="var(--legend_color)" strokeWidth="2.4" strokeDasharray={training_run_meta[run_name]?.dash} />
            </svg>
            {training_run_meta[run_name]?.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
