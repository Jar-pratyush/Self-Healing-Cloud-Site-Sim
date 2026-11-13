import { useId } from "react";
import type { EpisodeLane } from "../../data/data_types";
import { useElementWidth } from "../../hooks/use_element_width";
import { action_records, relative_ticks } from "./replay_model";

type LatencyChartProps = {
  lane: EpisodeLane;
  range: [number, number];
  playhead: number;
  sla_ms: number;
  tick_s: number;
  color: string;
  action_names: string[];
};

const chart_height = 206;
const failure_band_height = 28;
const margin = { top: 24, right: 12, bottom: 26, left: 46 };
const latency_floor_ms = 10;
const latency_ceiling_ms = 8000;
const latency_gridlines = [10, 100, 1000];

function latency_label(value_ms: number): string {
  return value_ms >= 1000 ? `${value_ms / 1000} s` : `${value_ms} ms`;
}

// Server-side p95 latency per tick on a log scale, with the SLA line, the
// fault window, the agent's actions and a band of failed requests below.
export function LatencyChart({ lane, range, playhead, sla_ms, tick_s, color, action_names }: LatencyChartProps) {
  const { element_ref, width } = useElementWidth<HTMLDivElement>();
  const clip_id = useId().replace(/:/g, "_");
  const offsets = relative_ticks(lane);
  const plot_width = Math.max(120, width - margin.left - margin.right);
  const latency_bottom = chart_height - margin.bottom - failure_band_height - 10;
  const domain_start = range[0];
  const domain_end = range[1] + 1;

  const x_of = (position: number) => margin.left + ((position - domain_start) / (domain_end - domain_start)) * plot_width;
  const log_floor = Math.log10(latency_floor_ms);
  const log_span = Math.log10(latency_ceiling_ms) - log_floor;
  const y_of = (value_ms: number) => {
    const clamped = Math.min(latency_ceiling_ms, Math.max(latency_floor_ms, value_ms));
    return latency_bottom - ((Math.log10(clamped) - log_floor) / log_span) * (latency_bottom - margin.top);
  };

  const points = offsets.map((offset, record_index) => ({
    x: x_of(offset + 0.5),
    y: y_of(lane.ticks.latency_ms[record_index] ?? latency_floor_ms),
    offset,
    record_index,
  }));
  const line_path = points.map((point, point_index) => `${point_index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("");
  const playhead_x = x_of(Math.min(domain_end, playhead + 1));
  // Reveal up to the last measured point (plus its marker), never part of a
  // segment leading to a tick that has not been reached yet.
  const recovery_offset = lane.recovery_tick !== null && lane.injection_tick !== null ? lane.recovery_tick - lane.injection_tick : null;
  const fault_end = recovery_offset ?? domain_end;
  const band_top = latency_bottom + 10;
  const band_inner = failure_band_height - 6;
  const band_bar_width = Math.max(2, plot_width / (domain_end - domain_start) - 4);
  const revealed_right = x_of(Math.min(domain_end, playhead + 0.5)) + Math.max(4, band_bar_width / 2 + 1);

  const tick_labels: number[] = [];
  for (let offset = Math.ceil(domain_start / 3) * 3; offset <= domain_end; offset += 3) {
    tick_labels.push(offset);
  }

  return (
    <div ref={element_ref} className="latency_chart">
      <svg width={width} height={chart_height} role="img" aria-label={`Latency per tick for ${lane.policy}`}>
        <defs>
          <clipPath id={clip_id}>
            <rect className="reveal_rect" x={0} y={0} width={revealed_right} height={chart_height} />
          </clipPath>
        </defs>

        {lane.injection_tick !== null && playhead >= 0 ? (
          <rect
            x={x_of(0)}
            y={margin.top}
            width={Math.max(0, x_of(Math.min(fault_end, playhead + 1)) - x_of(0))}
            height={chart_height - margin.top - margin.bottom}
            className="fault_window"
          />
        ) : null}

        {latency_gridlines.map((value_ms) => (
          <g key={value_ms}>
            <line x1={margin.left} x2={margin.left + plot_width} y1={y_of(value_ms)} y2={y_of(value_ms)} className="grid_line" />
            <text x={margin.left - 6} y={y_of(value_ms) + 4} className="axis_label" textAnchor="end">
              {latency_label(value_ms)}
            </text>
          </g>
        ))}

        <line x1={margin.left} x2={margin.left + plot_width} y1={y_of(sla_ms)} y2={y_of(sla_ms)} className="sla_line" />
        <text x={margin.left + plot_width} y={y_of(sla_ms) - 5} className="sla_label" textAnchor="end">
          target {sla_ms} ms
        </text>

        <g clipPath={`url(#${clip_id})`}>
          <path d={line_path} className="latency_line" style={{ stroke: color }} />
          {points.map((point) => (
            <circle
              key={point.record_index}
              cx={point.x}
              cy={point.y}
              r={3}
              className={lane.ticks.stale[point.record_index] ? "latency_point is_stale" : "latency_point"}
              style={{ fill: color }}
            />
          ))}
          {points.map((point) => {
            const ratio = lane.ticks.fail_ratio[point.record_index] ?? 0;
            const bar_height = ratio * band_inner;
            return (
              <rect
                key={`fail_${point.record_index}`}
                x={point.x - band_bar_width / 2}
                y={band_top + band_inner - bar_height}
                width={band_bar_width}
                height={bar_height}
                className="failure_bar"
              />
            );
          })}
        </g>

        <text x={margin.left - 6} y={band_top + band_inner - 2} className="axis_label" textAnchor="end">
          failed
        </text>
        <line x1={margin.left} x2={margin.left + plot_width} y1={band_top + band_inner} y2={band_top + band_inner} className="grid_line" />

        {lane.injection_tick !== null && playhead >= 0 ? (
          <g className="event_marker event_fault">
            <line x1={x_of(0)} x2={x_of(0)} y1={margin.top - 10} y2={chart_height - margin.bottom} />
            <text x={x_of(0)} y={margin.top - 13} textAnchor="middle">
              fault
            </text>
          </g>
        ) : null}

        {action_records(lane).map((record_index) => {
          const offset = offsets[record_index] ?? 0;
          if (offset > playhead) {
            return null;
          }
          const marker_x = x_of(offset);
          return (
            <g key={`action_${record_index}`} className="event_marker event_action">
              <line x1={marker_x} x2={marker_x} y1={margin.top + 10} y2={chart_height - margin.bottom} />
              <path d={`M${marker_x},${margin.top + 4} l5,6 l-5,6 l-5,-6z`} />
              <title>{action_names[lane.ticks.action[record_index] ?? 0]}</title>
            </g>
          );
        })}

        {recovery_offset !== null && recovery_offset <= playhead ? (
          <g className="event_marker event_recovery">
            <line x1={x_of(recovery_offset)} x2={x_of(recovery_offset)} y1={margin.top - 10} y2={chart_height - margin.bottom} />
            <text x={x_of(recovery_offset) + 4} y={margin.top - 13}>
              recovered
            </text>
          </g>
        ) : null}

        <line x1={playhead_x} x2={playhead_x} y1={margin.top} y2={chart_height - margin.bottom} className="playhead_line" />

        {tick_labels.map((offset) => (
          <text key={offset} x={x_of(offset)} y={chart_height - 8} className="axis_label" textAnchor="middle">
            {offset === 0 ? "0 s" : `${offset > 0 ? "+" : "−"}${Math.abs(offset * tick_s)}`}
          </text>
        ))}
      </svg>
    </div>
  );
}
