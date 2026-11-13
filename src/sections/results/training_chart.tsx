import { useState } from "react";
import type { TrainingRun } from "../../data/data_types";
import { useElementWidth } from "../../hooks/use_element_width";

type TrainingChartProps = {
  runs: Record<string, TrainingRun>;
};

type MetricKey = "return" | "recovered";

// Both warm-start seeds are the agent, so they share its colour and differ
// by line style; the cold start uses the cold-agent colour.
const training_run_meta: Record<string, { label: string; color_var: string; dash: string | undefined }> = {
  sac_per_s0: { label: "Warm start, seed 0", color_var: "var(--color_agent)", dash: undefined },
  sac_per_s1: { label: "Warm start, seed 1", color_var: "var(--color_agent)", dash: "2 4" },
  sac_per_cold_s0: { label: "Cold start", color_var: "var(--color_agent_cold)", dash: "7 5" },
};

const rolling_window = 20;
const chart_height = 300;
const margin = { top: 16, right: 18, bottom: 34, left: 52 };

function rolling_median(values: number[], window: number): number[] {
  return values.map((_, value_index) => {
    const slice = values.slice(Math.max(0, value_index - window + 1), value_index + 1).sort((first, second) => first - second);
    const middle = Math.floor(slice.length / 2);
    return slice.length % 2 ? (slice[middle] ?? 0) : ((slice[middle - 1] ?? 0) + (slice[middle] ?? 0)) / 2;
  });
}

function rolling_share(flags: (boolean | null)[], window: number): (number | null)[] {
  return flags.map((_, flag_index) => {
    const slice = flags.slice(Math.max(0, flag_index - window + 1), flag_index + 1).filter((flag) => flag !== null);
    if (slice.length === 0) {
      return null;
    }
    return slice.filter(Boolean).length / slice.length;
  });
}

// Training curves from the live cluster: per-episode return (dots) with a
// rolling median, or the rolling share of fault episodes that recovered.
export function TrainingChart({ runs }: TrainingChartProps) {
  const [metric, set_metric] = useState<MetricKey>("return");
  const { element_ref, width } = useElementWidth<HTMLDivElement>(640);
  const run_names = Object.keys(training_run_meta).filter((run_name) => runs[run_name]);
  const max_episode = Math.max(...run_names.map((run_name) => Math.max(...(runs[run_name]?.episode ?? [1]))));
  const min_return = Math.min(...run_names.flatMap((run_name) => runs[run_name]?.return ?? [0]));
  const y_min = metric === "return" ? Math.floor(min_return) : 0;
  const y_max = metric === "return" ? 0 : 1;
  const plot_width = Math.max(160, width - margin.left - margin.right);
  const plot_height = chart_height - margin.top - margin.bottom;
  const x_of = (episode: number) => margin.left + ((episode - 1) / Math.max(1, max_episode - 1)) * plot_width;
  const y_of = (value: number) => margin.top + ((y_max - value) / (y_max - y_min)) * plot_height;
  const y_ticks = metric === "return" ? [0, Math.round(y_min / 2), y_min] : [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="training_chart">
      <div className="chart_toolbar" role="group" aria-label="Training metric">
        <button type="button" aria-pressed={metric === "return"} onClick={() => set_metric("return")}>
          Episode return
        </button>
        <button type="button" aria-pressed={metric === "recovered"} onClick={() => set_metric("recovered")}>
          Faults recovered
        </button>
      </div>
      <div ref={element_ref}>
        <svg width={width} height={chart_height} role="img" aria-label="Training curves for the warm-start and cold-start agents">
          {y_ticks.map((value) => (
            <g key={value}>
              <line x1={margin.left} x2={margin.left + plot_width} y1={y_of(value)} y2={y_of(value)} className="grid_line" />
              <text x={margin.left - 8} y={y_of(value) + 4} className="axis_label" textAnchor="end">
                {metric === "return" ? value : `${Math.round(value * 100)}%`}
              </text>
            </g>
          ))}
          {[1, 50, 100, 150, 200].filter((episode) => episode <= max_episode).map((episode) => (
            <text key={episode} x={x_of(episode)} y={chart_height - 14} className="axis_label" textAnchor="middle">
              {episode}
            </text>
          ))}
          <text x={margin.left + plot_width} y={chart_height - 1} className="axis_label" textAnchor="end">
            training episode
          </text>

          {run_names.map((run_name) => {
            const run = runs[run_name];
            const meta = training_run_meta[run_name];
            if (!run || !meta) {
              return null;
            }
            if (metric === "return") {
              const smoothed = rolling_median(run.return, rolling_window);
              const path = smoothed.map((value, value_index) => `${value_index === 0 ? "M" : "L"}${x_of(run.episode[value_index] ?? 1).toFixed(1)},${y_of(value).toFixed(1)}`).join("");
              return (
                <g key={run_name}>
                  {run.return.map((value, value_index) => (
                    <circle key={value_index} cx={x_of(run.episode[value_index] ?? 1)} cy={y_of(value)} r={1.8} fill={meta.color_var} fillOpacity={0.28} />
                  ))}
                  <path d={path} fill="none" stroke={meta.color_var} strokeWidth={2.4} strokeDasharray={meta.dash} />
                </g>
              );
            }
            const fault_flags = run.fault.map((fault, flag_index) => (fault === "NULL" ? null : Boolean(run.recovered[flag_index])));
            const shares = rolling_share(fault_flags, rolling_window);
            let path = "";
            shares.forEach((share, share_index) => {
              if (share === null) {
                return;
              }
              path += `${path ? "L" : "M"}${x_of(run.episode[share_index] ?? 1).toFixed(1)},${y_of(share).toFixed(1)}`;
            });
            return <path key={run_name} d={path} fill="none" stroke={meta.color_var} strokeWidth={2.4} strokeDasharray={meta.dash} />;
          })}
        </svg>
      </div>
      <ul className="chart_legend">
        {run_names.map((run_name) => (
          <li key={run_name} style={{ ["--legend_color" as string]: training_run_meta[run_name]?.color_var }}>
            <svg className="legend_line" width="26" height="8" aria-hidden="true">
              <line x1="0" x2="26" y1="4" y2="4" stroke="var(--legend_color)" strokeWidth="2.4" strokeDasharray={training_run_meta[run_name]?.dash} />
            </svg>
            {training_run_meta[run_name]?.label} ({runs[run_name]?.episode.length} episodes)
          </li>
        ))}
      </ul>
      <p className="chart_note">
        {metric === "return"
          ? `Dots are single episodes; lines are the rolling median of the last ${rolling_window}. Return is the sum of rewards, so 0 is the best possible.`
          : `Rolling share of the last ${rolling_window} episodes with a fault that ended recovered (fault-free episodes are skipped).`}
      </p>
    </div>
  );
}
