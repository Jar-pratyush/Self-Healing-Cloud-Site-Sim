// Display names and colours for the policies in the capstone's data.
// Keys are the policy ids used by the capstone's evaluation logs.

export type PolicyMeta = {
  label: string;
  short_label: string;
  color_var: string;
  plain_description: string;
};

export const policy_meta: Record<string, PolicyMeta> = {
  sac_per: {
    label: "RL agent",
    short_label: "Agent",
    color_var: "var(--color_agent)",
    plain_description: "Our agent, warmed up on runbook examples, then trained for 200 episodes on the live cluster.",
  },
  sac_per_s1: {
    label: "RL agent, second seed",
    short_label: "Agent s1",
    color_var: "var(--color_agent)",
    plain_description: "The same recipe trained again from a different random seed.",
  },
  sac_per_cold: {
    label: "RL agent, cold start",
    short_label: "Cold agent",
    color_var: "var(--color_agent_cold)",
    plain_description: "The same agent trained from scratch for 100 episodes, with no runbook examples first.",
  },
  runbook: {
    label: "Scripted runbook",
    short_label: "Runbook",
    color_var: "var(--color_runbook)",
    plain_description: "Hand-written if-this-then-that rules, written by us with knowledge of the faults.",
  },
  k8s_hpa: {
    label: "Kubernetes + autoscaler",
    short_label: "K8s + HPA",
    color_var: "var(--color_hpa)",
    plain_description: "Kubernetes with its Horizontal Pod Autoscaler, which adds copies when CPU runs hot.",
  },
  k8s_default: {
    label: "Kubernetes alone",
    short_label: "K8s",
    color_var: "var(--color_k8s)",
    plain_description: "Plain Kubernetes: it restarts crashed containers, but nothing else.",
  },
};

export const policy_order = ["sac_per", "sac_per_s1", "runbook", "k8s_hpa", "k8s_default", "sac_per_cold"];

export function policy_label(policy_id: string): string {
  return policy_meta[policy_id]?.label ?? policy_id;
}

export function policy_color(policy_id: string): string {
  return policy_meta[policy_id]?.color_var ?? "var(--color_text_muted)";
}
