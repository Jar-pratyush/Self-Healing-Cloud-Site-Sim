import { format_ms, format_number, format_percent, format_service } from "../../content/format_values";
import { policy_color, policy_label } from "../../content/policy_meta";
import type { EpisodeLane, SiteConfig } from "../../data/data_types";
import { LatencyChart } from "./latency_chart";
import { action_records, record_at, relative_ticks } from "./replay_model";

type LanePanelProps = {
  lane: EpisodeLane;
  role_label: string;
  range: [number, number];
  playhead: number;
  config: SiteConfig;
  fault_target: string | null;
};

function signed_seconds(seconds: number): string {
  if (seconds === 0) {
    return "0 s";
  }
  return `${seconds > 0 ? "+" : "−"}${Math.abs(seconds)} s`;
}

export function LanePanel({ lane, role_label, range, playhead, config, fault_target }: LanePanelProps) {
  const offsets = relative_ticks(lane);
  const record_index = record_at(lane, playhead);
  const shown_index = Math.max(0, record_index);
  const has_ended = record_index === offsets.length - 1 && playhead >= (offsets[offsets.length - 1] ?? 0);
  const color = policy_color(lane.policy);
  const action_names = config.actions.map((action) => action.name);
  const latency_now = lane.ticks.latency_ms[shown_index] ?? 0;
  const is_healthy = latency_now <= config.sla.latency_ms && (lane.ticks.fail_ratio[shown_index] ?? 0) <= config.sla.error_ratio;
  const actions_so_far = action_records(lane).filter((action_index) => (offsets[action_index] ?? 0) <= playhead);

  let status_text = record_index < 0 ? "waiting" : is_healthy ? "healthy" : "SLA breached";
  if (has_ended) {
    status_text = lane.recovered ? `recovered · ${lane.mttr_s?.toFixed(1)} s` : "not recovered";
  }
  const status_class = has_ended ? (lane.recovered ? "is_good" : "is_bad") : is_healthy ? "is_good" : "is_bad";

  return (
    <article className="lane_panel" style={{ ["--lane_color" as string]: color }}>
      <header className="lane_head">
        <span className="lane_swatch" aria-hidden="true" />
        <div className="lane_names">
          <span className="lane_role">{role_label}</span>
          <h4 className="lane_title">{policy_label(lane.policy)}</h4>
        </div>
        <span className={`lane_status ${status_class}`} aria-live="polite">
          {status_text}
        </span>
      </header>

      <LatencyChart
        lane={lane}
        range={range}
        playhead={playhead}
        sla_ms={config.sla.latency_ms}
        tick_s={config.tick_s}
        color={color}
        action_names={action_names}
      />

      <dl className="lane_readouts">
        <div>
          <dt>Latency p95</dt>
          <dd className={latency_now > config.sla.latency_ms ? "is_bad" : undefined}>{record_index < 0 ? "n/a" : format_ms(latency_now)}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{record_index < 0 ? "n/a" : format_percent(lane.ticks.fail_ratio[shown_index])}</dd>
        </div>
        <div>
          <dt>Requests/s</dt>
          <dd>{record_index < 0 ? "n/a" : format_number(lane.ticks.requests_per_s[shown_index], 1)}</dd>
        </div>
        <div className="only_technical">
          <dt>Reward</dt>
          <dd>{record_index < 0 ? "n/a" : format_number(lane.ticks.reward[shown_index], 3)}</dd>
        </div>
      </dl>

      <table className="service_table">
        <caption className="visually_hidden">Managed services at this tick</caption>
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col">Pods</th>
            <th scope="col">CPU</th>
            <th scope="col" className="only_technical">
              Throttle
            </th>
          </tr>
        </thead>
        <tbody>
          {config.managed_services.map((service_name) => {
            const series = lane.services[service_name];
            if (!series) {
              return null;
            }
            const spec_replicas = series.spec_replicas[shown_index] ?? 0;
            const available_replicas = series.available_replicas[shown_index] ?? 0;
            const max_replicas = config.replicas.max[service_name] ?? spec_replicas;
            const restarted = (series.restarts[shown_index] ?? 0) > 0;
            return (
              <tr key={service_name} className={service_name === fault_target ? "is_target" : undefined}>
                <th scope="row">
                  {format_service(service_name)}
                  {service_name === fault_target ? <span className="target_tag">fault target</span> : null}
                </th>
                <td>
                  <span className="pod_dots" aria-label={`${available_replicas} of ${spec_replicas} pods ready`}>
                    {Array.from({ length: Math.max(max_replicas, spec_replicas, 1) }, (_, slot_index) => (
                      <span
                        key={slot_index}
                        className={
                          slot_index < available_replicas ? "pod_dot is_ready" : slot_index < spec_replicas ? "pod_dot is_pending" : "pod_dot"
                        }
                      />
                    ))}
                    {restarted ? <span className="restart_mark" title="restarted this tick">↻</span> : null}
                  </span>
                </td>
                <td className="mono">{Math.round((series.cpu_cores[shown_index] ?? 0) * 1000)}m</td>
                <td className="mono only_technical">{format_percent(series.throttle[shown_index], 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="action_log">
        <p className="action_log_title">Actions so far</p>
        {actions_so_far.length === 0 ? (
          <p className="action_log_empty">none</p>
        ) : (
          <ol>
            {actions_so_far.slice(-4).map((action_index) => (
              <li key={action_index}>
                <span className="mono">{signed_seconds((offsets[action_index] ?? 0) * config.tick_s)}</span>
                <code>{action_names[lane.ticks.action[action_index] ?? 0]}</code>
              </li>
            ))}
            {actions_so_far.length > 4 ? <li className="action_log_more">and {actions_so_far.length - 4} earlier</li> : null}
          </ol>
        )}
      </div>

      <p className="lane_clock mono" aria-hidden="true">
        {record_index < 0 ? "" : `window ${shown_index + 1} of ${offsets.length} · ${signed_seconds((offsets[shown_index] ?? 0) * config.tick_s)} from the fault`}
      </p>
    </article>
  );
}
