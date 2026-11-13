import { policy_color, policy_label } from "../../content/policy_meta";
import type { KmPoint } from "../../data/data_types";
import { useElementWidth } from "../../hooks/use_element_width";

type SurvivalChartProps = {
  curves: Record<string, KmPoint[]>;
  policies: string[];
  censor_s: number;
};

const chart_height = 280;
const margin = { top: 14, right: 18, bottom: 34, left: 48 };

// Kaplan-Meier estimate of the share of fault episodes still not recovered
// after t seconds, pooled over F1 to F4.
export function SurvivalChart({ curves, policies, censor_s }: SurvivalChartProps) {
  const { element_ref, width } = useElementWidth<HTMLDivElement>(640);
  const plot_width = Math.max(160, width - margin.left - margin.right);
  const plot_height = chart_height - margin.top - margin.bottom;
  const x_of = (seconds: number) => margin.left + (Math.min(seconds, censor_s) / censor_s) * plot_width;
  const y_of = (share: number) => margin.top + (1 - share) * plot_height;

  const step_path = (points: KmPoint[]) => {
    let path = `M${x_of(0)},${y_of(1)}`;
    let current = 1;
    for (const point of points) {
      path += `H${x_of(point.t_s).toFixed(1)}V${y_of(point.p_not_recovered).toFixed(1)}`;
      current = point.p_not_recovered;
    }
    return { path: `${path}H${x_of(censor_s)}`, end_share: current };
  };

  return (
    <div ref={element_ref} className="survival_chart">
      <svg width={width} height={chart_height} role="img" aria-label="Share of incidents not yet recovered over time, per policy">
        {[0, 0.25, 0.5, 0.75, 1].map((share) => (
          <g key={share}>
            <line x1={margin.left} x2={margin.left + plot_width} y1={y_of(share)} y2={y_of(share)} className="grid_line" />
            <text x={margin.left - 8} y={y_of(share) + 4} className="axis_label" textAnchor="end">
              {Math.round(share * 100)}%
            </text>
          </g>
        ))}
        {[0, 60, 120, 180, 240, 300, censor_s].map((seconds) => (
          <text key={seconds} x={x_of(seconds)} y={chart_height - 14} className="axis_label" textAnchor="middle">
            {seconds} s
          </text>
        ))}
        {policies.map((policy) => {
          // A policy with no recoveries has no curve in the data: it stays at 100 %.
          const { path, end_share } = step_path(curves[policy] ?? []);
          return (
            <g key={policy}>
              <path d={path} fill="none" stroke={policy_color(policy)} strokeWidth={policy === "sac_per" ? 2.8 : 1.9} strokeLinejoin="round" />
              <title>{`${policy_label(policy)}: ${Math.round(end_share * 100)}% still broken at ${censor_s} s`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
