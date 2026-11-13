import type { SiteConfig } from "../../data/data_types";

export type RewardTerms = {
  latency_term: number;
  error_term: number;
  violation: number;
  surplus_ratio: number;
  action_cost: number;
  reward: number;
};

function clip_unit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// Same arithmetic as env/reward.py in the capstone, with every constant read
// from the exported contract.
export function compute_reward(
  config: SiteConfig,
  latency_ms: number,
  fail_ratio: number,
  action_kind: string,
  surplus_replicas: number,
): RewardTerms {
  const latency_sla = config.sla.latency_ms;
  const latency_term =
    latency_ms <= latency_sla ? 0 : clip_unit(Math.log2(latency_ms / latency_sla) / config.reward.latency_log2_span);
  const error_term = clip_unit((fail_ratio - config.sla.error_ratio) / (config.sla.error_ratio_max - config.sla.error_ratio));
  const violation = clip_unit(latency_term + error_term);
  const surplus_ratio = surplus_replicas / config.reward.replica_denominator;
  const action_cost = config.reward.action_cost[action_kind] ?? 0;
  const reward = -(violation + action_cost + config.reward.w_replica * surplus_ratio);
  return { latency_term, error_term, violation, surplus_ratio, action_cost, reward };
}

export function max_surplus_replicas(config: SiteConfig): number {
  return Object.entries(config.replicas.max).reduce(
    (total, [service_name, max_count]) => total + Math.max(0, max_count - (config.replicas.base[service_name] ?? 0)),
    0,
  );
}
