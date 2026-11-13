import { fault_meta } from "../../content/fault_meta";
import { policy_color, policy_meta } from "../../content/policy_meta";
import type { FaultCode, ResultsBlock } from "../../data/data_types";
import { useElementWidth } from "../../hooks/use_element_width";

type MttrStripChartProps = {
  block: ResultsBlock;
  fault: FaultCode;
  policies: string[];
  censor_s: number;
};

const row_height = 26;
const margin = { top: 8, right: 14, bottom: 24, left: 92 };

// Every episode's time to recovery for one fault type, one row per policy.
// Hollow marks at the right edge are episodes that never recovered.
export function MttrStripChart({ block, fault, policies, censor_s }: MttrStripChartProps) {
  const { element_ref, width } = useElementWidth<HTMLDivElement>(420);
  const plot_width = Math.max(120, width - margin.left - margin.right);
  const height = margin.top + policies.length * row_height + margin.bottom;
  const x_of = (seconds: number) => margin.left + (Math.min(seconds, censor_s) / censor_s) * plot_width;
  const axis_ticks = [0, 60, 120, 180, 240, 300, censor_s];
  const summary = block.summary.filter((row) => row.fault === fault);

  return (
    <div ref={element_ref} className="mttr_chart">
      <p className="mttr_chart_title">
        <span className="mono">{fault}</span> {fault_meta[fault].name}
      </p>
      <svg width={width} height={height} role="img" aria-label={`Time to recovery per episode for ${fault_meta[fault].name}`}>
        {axis_ticks.map((seconds) => (
          <g key={seconds}>
            <line x1={x_of(seconds)} x2={x_of(seconds)} y1={margin.top} y2={height - margin.bottom} className="grid_line" />
            <text x={x_of(seconds)} y={height - 8} className="axis_label" textAnchor="middle">
              {seconds === censor_s ? `${seconds}+` : seconds}
            </text>
          </g>
        ))}
        {policies.map((policy, row_index) => {
          const row_y = margin.top + row_index * row_height + row_height / 2;
          const episodes = block.episodes
            .filter((row) => row.policy === policy && row.fault === fault)
            .sort((first, second) => first.index - second.index);
          const median = summary.find((row) => row.policy === policy)?.mttr_median_censored_s;
          const color = policy_color(policy);
          return (
            <g key={policy}>
              <text x={margin.left - 10} y={row_y + 4} className="axis_label strip_row_label" textAnchor="end">
                {policy_meta[policy]?.short_label ?? policy}
              </text>
              {episodes.map((row, episode_index) => {
                const jitter = ((episode_index % 5) - 2) * 2.4;
                return row.recovered ? (
                  <circle key={row.index} cx={x_of(row.mttr_censored_s)} cy={row_y + jitter} r={3.6} fill={color} fillOpacity={0.8}>
                    <title>{`#${row.index}: ${row.mttr_censored_s.toFixed(1)} s`}</title>
                  </circle>
                ) : (
                  <circle key={row.index} cx={x_of(censor_s) + jitter} cy={row_y + jitter} r={3.4} fill="none" stroke={color} strokeWidth={1.3}>
                    <title>{`#${row.index}: not recovered`}</title>
                  </circle>
                );
              })}
              {median !== null && median !== undefined ? (
                <line x1={x_of(median)} x2={x_of(median)} y1={row_y - 10} y2={row_y + 10} stroke={color} strokeWidth={2.4} className="median_tick">
                  <title>{`median ${median.toFixed(1)} s`}</title>
                </line>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
