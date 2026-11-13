// Shapes of the JSON files written by scripts/export_site_data.py.

export type FaultCode = "F1" | "F2" | "F3" | "F4" | "NULL";

export type ActionEntry = {
  id: number;
  kind: "NOOP" | "RESTART" | "SCALE" | "RESTORE";
  target: string | null;
  delta: number;
  name: string;
};

export type SiteConfig = {
  tick_s: number;
  collect_deadline_s: number;
  managed_services: string[];
  sla: {
    latency_ms: number;
    latency_quantile: number;
    error_ratio: number;
    error_ratio_max: number;
    recovery_ticks: number;
  };
  calibration: { users: number; requests_per_s: number };
  episode: {
    lead_in_ticks: number[];
    fault_max_ticks: number;
    censor_s: number;
    null_extra_ticks: number;
    fault_probs: Record<string, number>;
    f1_latency: string[];
    f2_targets: string[];
    f2_workers: number[];
    f3_targets: string[];
    f4_multiplier: number[];
  };
  replicas: { base: Record<string, number>; max: Record<string, number> };
  reward: { action_cost: Record<string, number>; w_replica: number; replica_denominator: number };
  rl: Record<string, number | number[]>;
  per: Record<string, number>;
  runbook: Record<string, number>;
  locust: { wait_s: number[]; request_timeout_s: number };
  actions: ActionEntry[];
  observation_names: string[];
  statistics: { bootstrap_resamples: number; ci_level: number; non_inferiority_margin_s: number; alpha: number };
  edge_link: { delay: string | null; jitter: string | null; loss: string | null };
};

export type SummaryRow = {
  policy: string;
  fault: string;
  n: number;
  recovered: number | null;
  mttr_median_censored_s: number | null;
  mttr_median_recovered_s: number | null;
  sla_penalty_mean: number;
  actions_mean: number;
  null_with_action: number | null;
};

export type PooledResult = {
  fault_episodes: number;
  recovered: number;
  mttr_median_censored_s: number | null;
  mttr_median_recovered_s: number | null;
  sla_penalty_mean: number | null;
  actions_mean: number | null;
  null_episodes: number;
  null_with_action: number;
};

export type EpisodeRow = {
  index: number;
  policy: string;
  fault: FaultCode;
  target: string | null;
  severity: string | number | null;
  recovered: boolean;
  mttr_censored_s: number;
  sla_penalty: number;
  actions: number;
};

export type ActionRow = {
  policy: string;
  fault: string;
  target: string | null;
  executed_actions: string;
  episodes: number;
};

export type ResultsBlock = {
  block: string;
  policies: string[];
  entries: number;
  summary: SummaryRow[];
  pooled: Record<string, PooledResult>;
  episodes: EpisodeRow[];
  actions: ActionRow[];
};

export type KmPoint = { t_s: number; p_not_recovered: number; n: number };

export type ContextRow = {
  block: string;
  ticks: number;
  decision_latency_median_s: number;
  decision_latency_p95_s: number;
  decision_latency_max_s: number;
  lead_in_ticks: number;
  lead_in_server_p95_median_ms: number;
  lead_in_client_p99_median_ms: number;
  lead_in_client_p99_p95_ms: number;
};

export type ResultsData = {
  blocks: Record<string, ResultsBlock>;
  km_curves: Record<string, KmPoint[]>;
  context: Record<string, ContextRow>;
};

export type TestRow = {
  hypothesis: string;
  scope: string;
  metric: string;
  a: string;
  b: string;
  n_a: number;
  n_b: number;
  median_a: number | null;
  median_b: number | null;
  u: number | null;
  p: number | null;
  p_holm: number | null;
  cliffs_delta: number | null;
  ci_low: number | null;
  ci_high: number | null;
  non_inferior: boolean | null;
};

export type TrainingRun = {
  episode: number[];
  fault: FaultCode[];
  target: (string | null)[];
  severity: (string | number | null)[];
  return: number[];
  recovered: (boolean | null)[];
  mttr_s: (number | null)[];
  actions: number[];
  stale_ticks: number[];
};

export type TrainingInternals = {
  episode: number[];
  critic_loss: (number | null)[];
  actor_loss: (number | null)[];
  entropy: (number | null)[];
  q_mean: (number | null)[];
  alpha: (number | null)[];
  beta: (number | null)[];
  buffer: (number | null)[];
};

export type SafetyTotals = { episodes: number; mask_violations: number; exec_errors: number; ticks: number };

export type MeasurementData = Record<string, Record<string, string | number | boolean | null>[]>;

export type ServiceSeries = {
  cpu_cores: number[];
  throttle: number[];
  spec_replicas: number[];
  available_replicas: number[];
  restarts: number[];
};

export type EpisodeLane = {
  policy: string;
  episode: number;
  recovered: boolean;
  mttr_s: number | null;
  mttr_censored_s: number;
  sla_penalty: number;
  actions: number;
  injection_tick: number | null;
  recovery_tick: number | null;
  ticks: {
    tick: number[];
    phase: number[];
    latency_ms: number[];
    client_p99_ms: number[];
    fail_ratio: number[];
    requests_per_s: number[];
    action: number[];
    chosen_action: number[];
    mask: string[];
    reward: number[];
    decision_latency_s: number[];
    stale: boolean[];
    imputed: boolean[];
    observation: number[][];
  };
  services: Record<string, ServiceSeries>;
};

export type EpisodeEntry = {
  index: number;
  fault: FaultCode;
  target: string | null;
  severity: string | number | null;
  lanes: Record<string, EpisodeLane>;
};

export type EpisodeIndexEntry = {
  index: number;
  fault: FaultCode;
  target: string | null;
  severity: string | number | null;
  outcomes: Record<string, { recovered: boolean; mttr_censored_s: number; actions: number }>;
};

export type EpisodeIndex = {
  block: string;
  featured_entry: number;
  entries: EpisodeIndexEntry[];
};

export type Provenance = {
  exporter_version: number;
  exported_at: string;
  capstone_commit: string | null;
  capstone_commit_date: string | null;
  capstone_tracked_changes: boolean | null;
  raw_data_included: boolean;
  rounding_note: string;
};
