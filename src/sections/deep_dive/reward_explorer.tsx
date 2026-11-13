import { useId, useState } from "react";
import type { SiteConfig } from "../../data/data_types";
import { compute_reward, max_surplus_replicas } from "./reward_model";

type RewardExplorerProps = {
  config: SiteConfig;
};

// Slider positions map to latency on a log scale, so the region just above
// the SLA gets as much travel as the multi-second tail.
const latency_min_ms = 10;
const latency_max_ms = 5000;
const slider_steps = 400;
const fail_ratio_max = 0.3;

type ScaleMark = { label: string; at: number; is_marker?: boolean };

// Labels under a slider, each placed at its true position on the track.
function ScaleMarks({ marks }: { marks: ScaleMark[] }) {
  return (
    <span className="reward_scale mono" aria-hidden="true">
      {marks.map((mark) => (
        <span key={mark.label} className={mark.is_marker ? "is_marker" : undefined} style={{ left: `${mark.at * 100}%` }}>
          {mark.label}
        </span>
      ))}
    </span>
  );
}

function latency_from_step(step: number): number {
  const ratio = step / slider_steps;
  return latency_min_ms * Math.pow(latency_max_ms / latency_min_ms, ratio);
}

function step_from_latency(latency_ms: number): number {
  return Math.round((Math.log(latency_ms / latency_min_ms) / Math.log(latency_max_ms / latency_min_ms)) * slider_steps);
}

// Lets a reader move the inputs of one reward step and watch each term of
// the penalty respond.
export function RewardExplorer({ config }: RewardExplorerProps) {
  const field_id = useId();
  const [latency_ms, set_latency_ms] = useState(180);
  const [fail_ratio, set_fail_ratio] = useState(0);
  const [action_kind, set_action_kind] = useState("NOOP");
  const [surplus_replicas, set_surplus_replicas] = useState(0);
  const surplus_limit = max_surplus_replicas(config);
  const terms = compute_reward(config, latency_ms, fail_ratio, action_kind, surplus_replicas);
  const worst_reward = -(1 + Math.max(...Object.values(config.reward.action_cost)) + config.reward.w_replica * (surplus_limit / config.reward.replica_denominator));
  const action_kinds = Object.keys(config.reward.action_cost);

  const bars = [
    { key: "violation", label: "SLA violation v", value: terms.violation, class_name: "is_violation" },
    { key: "cost", label: "action cost c(a)", value: terms.action_cost, class_name: "is_cost" },
    { key: "replica", label: `replicas ${config.reward.w_replica}·ρ`, value: config.reward.w_replica * terms.surplus_ratio, class_name: "is_replica" },
  ];

  return (
    <div className="reward_explorer">
      <div className="reward_inputs">
        <label className="reward_field" htmlFor={`${field_id}_latency`}>
          <span className="reward_field_head">
            <span>p95 latency (server-side)</span>
            <span className="mono">{latency_ms < 1000 ? `${Math.round(latency_ms)} ms` : `${(latency_ms / 1000).toFixed(2)} s`}</span>
          </span>
          <input
            id={`${field_id}_latency`}
            type="range"
            min={0}
            max={slider_steps}
            value={step_from_latency(latency_ms)}
            onChange={(change_event) => set_latency_ms(latency_from_step(Number(change_event.target.value)))}
          />
          <ScaleMarks
            marks={[
              { label: `${latency_min_ms} ms`, at: 0 },
              { label: `SLA ${config.sla.latency_ms} ms`, at: step_from_latency(config.sla.latency_ms) / slider_steps, is_marker: true },
              { label: `${latency_max_ms / 1000} s`, at: 1 },
            ]}
          />
        </label>

        <label className="reward_field" htmlFor={`${field_id}_fail`}>
          <span className="reward_field_head">
            <span>failed requests</span>
            <span className="mono">{(fail_ratio * 100).toFixed(1)} %</span>
          </span>
          <input
            id={`${field_id}_fail`}
            type="range"
            min={0}
            max={fail_ratio_max * 1000}
            value={Math.round(fail_ratio * 1000)}
            onChange={(change_event) => set_fail_ratio(Number(change_event.target.value) / 1000)}
          />
          <ScaleMarks
            marks={[
              { label: "0 %", at: 0 },
              { label: `cap ${config.sla.error_ratio_max * 100} %`, at: config.sla.error_ratio_max / fail_ratio_max, is_marker: true },
              { label: `${fail_ratio_max * 100} %`, at: 1 },
            ]}
          />
        </label>

        <fieldset className="reward_field">
          <legend className="reward_field_head">action taken this tick</legend>
          <div className="chart_toolbar">
            {action_kinds.map((kind_name) => (
              <button key={kind_name} type="button" aria-pressed={action_kind === kind_name} onClick={() => set_action_kind(kind_name)}>
                {kind_name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="reward_field" htmlFor={`${field_id}_surplus`}>
          <span className="reward_field_head">
            <span>replicas above the baseline</span>
            <span className="mono">
              {surplus_replicas} of {surplus_limit}
            </span>
          </span>
          <input
            id={`${field_id}_surplus`}
            type="range"
            min={0}
            max={surplus_limit}
            value={surplus_replicas}
            onChange={(change_event) => set_surplus_replicas(Number(change_event.target.value))}
          />
        </label>
      </div>

      <div className="reward_output" aria-live="polite">
        <p className="reward_value">
          <span className="reward_value_label">reward r</span>
          <span className="mono">{terms.reward.toFixed(3)}</span>
        </p>
        <div className="reward_bars">
          {bars.map((bar) => (
            <div key={bar.key} className={`reward_bar_row ${bar.class_name}`}>
              <span className="reward_bar_label">{bar.label}</span>
              <span className="reward_bar_track">
                <span className="reward_bar_fill" style={{ width: `${(bar.value / Math.abs(worst_reward)) * 100}%` }} />
              </span>
              <span className="reward_bar_value mono">{bar.value.toFixed(3)}</span>
            </div>
          ))}
        </div>
        <dl className="reward_terms mono">
          <div>
            <dt>ℓ</dt>
            <dd>{terms.latency_term.toFixed(3)}</dd>
          </div>
          <div>
            <dt>e</dt>
            <dd>{terms.error_term.toFixed(3)}</dd>
          </div>
          <div>
            <dt>v</dt>
            <dd>{terms.violation.toFixed(3)}</dd>
          </div>
          <div>
            <dt>ρ</dt>
            <dd>{terms.surplus_ratio.toFixed(3)}</dd>
          </div>
        </dl>
        <p className="chart_note">
          Bars are drawn against the worst possible step, {worst_reward.toFixed(2)}. A healthy tick with no action and
          no extra replicas scores exactly 0.
        </p>
      </div>
    </div>
  );
}
