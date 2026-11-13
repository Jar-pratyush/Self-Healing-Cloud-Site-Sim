import type { ActionEntry, SiteConfig } from "../../data/data_types";

type ConfigProps = {
  config: SiteConfig;
};

// Plain-language reading of each observation feature, keyed by the name
// the capstone gives it.
const feature_notes: Record<string, string> = {
  latency: "server-side p95 latency, scaled against the SLA",
  fail_ratio: "share of failed requests",
  request_rate: "requests per second against the calibrated rate",
  latency_change: "change in latency since the last tick",
  fail_ratio_change: "change in failure share since the last tick",
  cpu: "CPU use per pod against its limit",
  throttle: "share of CPU periods throttled",
  memory: "memory use per pod against its limit",
  available_replicas: "ready pods against the baseline count",
  spec_replicas: "requested pods against the maximum",
  restarts: "container restarts since the last tick, capped",
  rollout_recency: "decays from 1 after the deployment last changed",
  action_in_flight: "an earlier action is still rolling out",
  ticks_since_action: "ticks since the agent last acted",
  stale_telemetry: "the last metrics scrape missed its deadline",
};

type FeatureGroup = { title: string; features: string[]; per_service: boolean };

function group_features(observation_names: string[]): FeatureGroup[] {
  const first_service = observation_names.findIndex((name) => name.includes("."));
  const last_service = observation_names.length - 1 - [...observation_names].reverse().findIndex((name) => name.includes("."));
  const service_features = Array.from(
    new Set(observation_names.slice(first_service, last_service + 1).map((name) => name.split(".")[1] ?? name)),
  );
  return [
    { title: "Whole application", features: observation_names.slice(0, first_service), per_service: false },
    { title: "Each managed service", features: service_features, per_service: true },
    { title: "Controller state", features: observation_names.slice(last_service + 1), per_service: false },
  ];
}

export function ObservationTable({ config }: ConfigProps) {
  const groups = group_features(config.observation_names);
  const service_count = config.managed_services.length;
  return (
    <div className="observation_groups">
      {groups.map((group) => (
        <div key={group.title} className="observation_group">
          <p className="observation_group_title">
            {group.title}
            <span className="mono">
              {group.per_service
                ? `${group.features.length} × ${service_count} = ${group.features.length * service_count}`
                : group.features.length}
            </span>
          </p>
          <ul className="observation_list">
            {group.features.map((feature_name) => (
              <li key={feature_name}>
                <code>{feature_name}</code>
                <span>{feature_notes[feature_name] ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function mask_rule(action: ActionEntry, config: SiteConfig): string {
  if (action.kind === "NOOP") {
    return "always allowed";
  }
  if (action.kind === "RESTART") {
    return "target has at least one pod";
  }
  if (action.kind === "SCALE" && action.delta > 0) {
    return `below ${config.replicas.max[action.target ?? ""] ?? "?"} replicas`;
  }
  if (action.kind === "SCALE") {
    return "above 1 replica";
  }
  return "always allowed (never hints at the fault)";
}

export function ActionCatalogTable({ config }: ConfigProps) {
  return (
    <div className="table_scroll">
      <table className="data_table action_catalog">
        <thead>
          <tr>
            <th scope="col">id</th>
            <th scope="col">action</th>
            <th scope="col">cost c(a)</th>
            <th scope="col">allowed when</th>
          </tr>
        </thead>
        <tbody>
          {config.actions.map((action) => (
            <tr key={action.id}>
              <td className="mono">{action.id}</td>
              <td>
                <code>{action.name}</code>
              </td>
              <td className="mono">{(config.reward.action_cost[action.kind] ?? 0).toFixed(2)}</td>
              <td>{mask_rule(action, config)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EpisodeTable({ config }: ConfigProps) {
  const episode = config.episode;
  const fault_share = Object.entries(episode.fault_probs)
    .map(([fault_code, probability]) => `${fault_code} ${Math.round(probability * 100)} %`)
    .join(", ");
  const rows: [string, string][] = [
    ["Healthy lead-in", `${episode.lead_in_ticks[0]} to ${episode.lead_in_ticks[1]} ticks before the fault`],
    ["Fault window", `up to ${episode.fault_max_ticks} ticks (${episode.censor_s} s); unrecovered episodes are censored there`],
    ["Fault-free (NULL) episodes", `lead-in plus ${episode.null_extra_ticks} more ticks, no fault injected`],
    ["Training fault mix", fault_share],
    ["F1 network delay", episode.f1_latency.join(", ")],
    ["F2 CPU stress", `${episode.f2_targets.join(", ")}; ${episode.f2_workers.join(" or ")} workers`],
    ["F3 scaled to zero", episode.f3_targets.join(", ")],
    ["F4 load surge", `${episode.f4_multiplier.join("× or ")}× the calibrated load`],
    ["Recovered", `${config.sla.recovery_ticks} healthy ticks in a row and the cause undone`],
  ];
  return (
    <div className="table_scroll">
      <table className="data_table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
