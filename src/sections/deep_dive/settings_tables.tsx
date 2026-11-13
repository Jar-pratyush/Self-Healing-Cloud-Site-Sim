import type { SiteConfig } from "../../data/data_types";
import { TableScroll } from "../../components/table_scroll";

type ConfigProps = {
  config: SiteConfig;
};

type SettingRow = { key: string; label: string; value: string };

function show_value(value: number | number[] | undefined): string {
  if (value === undefined) {
    return "n/a";
  }
  if (Array.isArray(value)) {
    return value.join(" × ");
  }
  if (value !== 0 && Math.abs(value) < 0.01) {
    return value.toExponential(0).replace("e-", "e−");
  }
  return String(value);
}

// Readable names for the locked rl and per blocks of the contract. Keys not
// listed here still appear, under their own name.
const rl_labels: Record<string, string> = {
  gamma: "discount γ",
  n_step: "n-step return",
  tau: "target network Polyak τ",
  hidden: "hidden layers (actor and both critics)",
  lr_actor: "actor learning rate",
  lr_critic: "critic learning rate",
  lr_alpha: "temperature learning rate (not used: α is fixed)",
  batch_size: "batch size",
  buffer_size: "replay capacity (transitions)",
  updates_per_tick: "gradient updates per 20 s tick",
  alpha_init: "temperature α (held fixed online)",
  target_entropy_frac: "target entropy, fraction of log n_valid",
  offline_warmstart_steps: "offline warm-start gradient steps",
  offline_cql_weight: "CQL penalty weight (offline and online)",
  torch_threads: "CPU threads for PyTorch",
};

const per_labels: Record<string, string> = {
  alpha: "priority exponent",
  beta_start: "importance weight β, start",
  beta_end: "importance weight β, end",
  beta_anneal_grad_steps: "β annealing length (gradient steps)",
  eps: "priority floor ε",
  priority_cap: "priority cap on |δ|",
};

function rows_from(block: Record<string, number | number[]>, labels: Record<string, string>): SettingRow[] {
  return Object.entries(block).map(([key, value]) => ({ key, label: labels[key] ?? key, value: show_value(value) }));
}

function SettingTable({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <div className="setting_table">
      <p className="setting_table_title">{title}</p>
      <table className="data_table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.label}
                <code className="setting_key">{row.key}</code>
              </th>
              <td className="mono">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HyperparameterTables({ config }: ConfigProps) {
  return (
    <div className="setting_grid">
      <SettingTable title="Soft actor-critic (rl)" rows={rows_from(config.rl, rl_labels)} />
      <SettingTable title="Prioritised replay (per)" rows={rows_from(config.per, per_labels)} />
    </div>
  );
}

// The runbook's rules in the order it checks them; the first match fires.
// Thresholds are read from the contract's runbook block.
export function RunbookRules({ config }: ConfigProps) {
  const runbook = config.runbook;
  const debounce = runbook.debounce_ticks ?? 0;
  const rules: [string, string][] = [
    ["R0", "An action is still rolling out: wait."],
    ["R1", "A service has fewer replicas than its baseline: restore it."],
    [
      "R2",
      `Unhealthy for ${debounce} ticks and a deployment changed in the last ${runbook.change_window_ticks} ticks, not by the runbook: restore the most recent change.`,
    ],
    [
      "R3",
      `Unhealthy for ${debounce} ticks, traffic at least ${runbook.surge_rps_factor}× the calibrated rate and the frontend throttled at least ${Math.round((runbook.throttle_threshold ?? 0) * 100)} %: add a frontend replica.`,
    ],
    [
      "R4",
      `Unhealthy for ${debounce} ticks without a surge, and a service throttled at least ${Math.round((runbook.throttle_threshold ?? 0) * 100)} % on each of those ticks: restart the most throttled one (not again within ${runbook.restart_cooldown_ticks} ticks).`,
    ],
    [
      "R5",
      `Healthy for ${runbook.scaleback_healthy_ticks} ticks and traffic below ${runbook.scaleback_rps_factor}× the calibrated rate: remove an extra frontend replica, or restore a scaled-up service.`,
    ],
    ["R6", "Otherwise: do nothing."],
  ];
  return (
    <ol className="rule_list">
      {rules.map(([rule_id, text]) => (
        <li key={rule_id}>
          <span className="rule_id mono">{rule_id}</span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

// Readable names for the pinned *_VERSION entries of config/cluster.env.
const version_labels: Record<string, string> = {
  k3s_version: "K3s (Kubernetes)",
  ob_version: "Online Boutique",
  chaos_mesh_version: "Chaos Mesh",
  helm_version: "Helm",
};

export function TestbedTable({ config }: ConfigProps) {
  const rows: [string, string][] = [
    ...Object.entries(config.versions).map(([key, value]): [string, string] => [version_labels[key] ?? key, value]),
    ["Services the agent manages", config.managed_services.join(", ")],
    [
      "Load",
      `${config.calibration.users} Locust users, ${config.locust.wait_s.join(" to ")} s between requests, about ${Math.round(config.calibration.requests_per_s)} requests per second`,
    ],
    ["Request timeout", `${config.locust.request_timeout_s} s (why some latencies sit at exactly 5 s)`],
    ["Control tick", `${config.tick_s} s, with a ${config.collect_deadline_s} s deadline to collect metrics`],
    ["Replicas (baseline / max)", Object.keys(config.replicas.base).map((service_name) => `${service_name} ${config.replicas.base[service_name]}/${config.replicas.max[service_name]}`).join(", ")],
  ];
  return (
    <TableScroll label="Testbed">
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
    </TableScroll>
  );
}
