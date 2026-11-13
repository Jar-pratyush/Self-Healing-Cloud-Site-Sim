import { fault_meta, severity_label } from "../../content/fault_meta";
import { format_ms, format_percent } from "../../content/format_values";
import { policy_label } from "../../content/policy_meta";
import type { EpisodeEntry, EpisodeIndex, EpisodeLane, SiteConfig } from "../../data/data_types";

// Time in the replay is measured in ticks relative to the injection tick.
// Record k of a lane holds the action taken at the start of window k and the
// telemetry measured during window k, so on the chart record k is drawn at
// the middle of its window and actions at the window's start.

export type BeatKey = "normal" | "fault" | "observe" | "act" | "outcome";

export type ReplayBeat = {
  beat_key: BeatKey;
  title: string;
  body: string;
  relative_tick: number;
};

export function injection_of(lane: EpisodeLane): number {
  return lane.injection_tick ?? lane.ticks.tick.length;
}

export function relative_ticks(lane: EpisodeLane): number[] {
  const injection_tick = injection_of(lane);
  return lane.ticks.tick.map((tick) => tick - injection_tick);
}

export function record_at(lane: EpisodeLane, relative_tick: number): number {
  // Index of the last record at or before the playhead, or -1 before the first.
  const offsets = relative_ticks(lane);
  let found = -1;
  offsets.forEach((offset, record_index) => {
    if (offset <= relative_tick) {
      found = record_index;
    }
  });
  return found;
}

export function relative_range(lanes: EpisodeLane[]): [number, number] {
  let range_start = 0;
  let range_end = 0;
  for (const lane of lanes) {
    const offsets = relative_ticks(lane);
    range_start = Math.min(range_start, offsets[0] ?? 0);
    range_end = Math.max(range_end, offsets[offsets.length - 1] ?? 0);
  }
  return [range_start, range_end];
}

export function action_records(lane: EpisodeLane): number[] {
  return lane.ticks.action.flatMap((action_id, record_index) => (action_id !== 0 ? [record_index] : []));
}

function action_name(config: SiteConfig, action_id: number): string {
  return config.actions[action_id]?.name ?? `action ${action_id}`;
}

function seconds_after(relative_tick: number, tick_s: number): string {
  const seconds = relative_tick * tick_s;
  return seconds === 0 ? "At the moment of the fault" : `${seconds} s after the fault`;
}

// Five story beats for one incident, written from the recorded numbers.
export function build_beats(entry: EpisodeEntry, lane: EpisodeLane, baseline: EpisodeLane | null, config: SiteConfig): ReplayBeat[] {
  // The closing beat sits at the end of the longer lane, so both outcomes show.
  const final_tick = relative_range(baseline ? [lane, baseline] : [lane])[1];
  const fault = fault_meta[entry.fault];
  const tick_s = config.tick_s;
  const offsets = relative_ticks(lane);
  const injection_record = lane.injection_tick === null ? -1 : lane.ticks.tick.indexOf(lane.injection_tick);
  const last_record = offsets.length - 1;
  const before_record = Math.max(0, injection_record - 1);
  const latency = lane.ticks.latency_ms;
  const failures = lane.ticks.fail_ratio;
  const sla_ms = config.sla.latency_ms;
  const actions = action_records(lane);
  const first_action = actions[0];
  const label = policy_label(lane.policy);
  const severity = severity_label(entry.fault, entry.severity);
  const target_text = entry.target ? ` on ${entry.target}` : "";

  const beats: ReplayBeat[] = [
    {
      beat_key: "normal",
      title: "Business as usual",
      body: `Shoppers are browsing. Server-side latency sits at ${format_ms(latency[before_record])}, well under the ${sla_ms} ms target, and almost nothing fails. The agent checks in every ${tick_s} s and, correctly, does nothing.`,
      relative_tick: offsets[before_record] ?? -1,
    },
  ];

  if (entry.fault === "NULL" || injection_record < 0) {
    const acted = actions.length > 0;
    beats.push({
      beat_key: "outcome",
      title: "Nothing breaks",
      body: acted
        ? `This is a fault-free control episode, and ${label} still acted ${actions.length} time${actions.length === 1 ? "" : "s"}. Any action here is a false alarm.`
        : `This is a fault-free control episode. ${label} took no action for the whole episode, which is exactly right.`,
      relative_tick: final_tick,
    });
    return beats;
  }

  beats.push({
    beat_key: "fault",
    title: `Fault: ${fault.name.toLowerCase()}`,
    body: `${fault.plain_story} (${entry.fault}${target_text}${severity ? `, ${severity}` : ""}.) Within one tick, latency goes from ${format_ms(latency[before_record])} to ${format_ms(latency[injection_record])} and ${format_percent(failures[injection_record])} of requests fail.`,
    relative_tick: 0,
  });

  if (first_action !== undefined) {
    const seen_record = Math.max(injection_record, first_action - 1);
    beats.push({
      beat_key: "observe",
      title: "The agent notices",
      body: `It sees ${format_ms(latency[seen_record])} latency and ${format_percent(failures[seen_record])} failed requests, plus CPU, memory, replicas and restarts for four services. It is never told what broke or where.`,
      relative_tick: offsets[seen_record] ?? 0,
    });
    beats.push({
      beat_key: "act",
      title: "One repair",
      body: `${seconds_after(offsets[first_action] ?? 0, tick_s)}, it calls ${action_name(config, lane.ticks.action[first_action] ?? 0)}. ${
        actions.length > 1 ? `It acted ${actions.length} times in this episode in total.` : "That is its only action in this episode."
      } The correct repair for this fault is ${fault.correct_repair}.`,
      relative_tick: offsets[first_action] ?? 0,
    });
  } else {
    const seen_record = Math.min(last_record, injection_record + 2);
    beats.push({
      beat_key: "observe",
      title: "The agent watches",
      body: `Latency reads ${format_ms(latency[seen_record])} and ${format_percent(failures[seen_record])} of requests fail. The agent sees all of it but is never told what broke.`,
      relative_tick: offsets[seen_record] ?? 0,
    });
    beats.push({
      beat_key: "act",
      title: "No repair",
      body: `${label} takes no action in this episode. The correct repair would have been ${fault.correct_repair}.`,
      relative_tick: offsets[Math.min(last_record, injection_record + 4)] ?? 0,
    });
  }

  const baseline_text = baseline
    ? baseline.recovered
      ? ` For comparison, ${policy_label(baseline.policy)} recovered this same incident in ${baseline.mttr_s?.toFixed(1)} s.`
      : ` For comparison, ${policy_label(baseline.policy)} never recovered this incident; its last reading was ${format_ms(baseline.ticks.latency_ms[baseline.ticks.latency_ms.length - 1])}.`
    : "";

  beats.push({
    beat_key: "outcome",
    title: lane.recovered ? "Recovered" : "Not recovered",
    body: lane.recovered
      ? `Latency is back to ${format_ms(latency[last_record])}. After ${config.sla.recovery_ticks} healthy ticks in a row the episode ends: time to recovery ${lane.mttr_s?.toFixed(1)} s.${baseline_text}`
      : `After ${config.episode.fault_max_ticks} ticks the episode is stopped and counted as ${config.episode.censor_s} s. Latency at the end: ${format_ms(latency[last_record])}.${baseline_text}`,
    relative_tick: final_tick,
  });

  return beats;
}

export type ExampleEntry = { label: string; index: number; note: string };

// Picks example incidents from the index itself, so they always match the data.
export function pick_examples(index: EpisodeIndex): ExampleEntry[] {
  const featured = index.entries.find((entry) => entry.index === index.featured_entry);
  const examples: ExampleEntry[] = [
    {
      label: "Featured",
      index: index.featured_entry,
      note: featured ? `${fault_meta[featured.fault].name.toLowerCase()}, start to finish` : "start to finish",
    },
  ];
  const agent_misses = index.entries.find(
    (entry) => entry.fault !== "NULL" && entry.outcomes.sac_per && !entry.outcomes.sac_per.recovered && entry.outcomes.runbook?.recovered,
  );
  if (agent_misses) {
    examples.push({ label: "Agent fails", index: agent_misses.index, note: "the runbook fixes it, the agent does not" });
  }
  const autoscaler_wins = index.entries.find((entry) => {
    const agent = entry.outcomes.sac_per;
    const autoscaler = entry.outcomes.k8s_hpa;
    return agent && autoscaler && autoscaler.recovered && autoscaler.mttr_censored_s < agent.mttr_censored_s;
  });
  if (autoscaler_wins) {
    examples.push({ label: "Autoscaler wins", index: autoscaler_wins.index, note: "the autoscaler is faster on a surge" });
  }
  const fault_free = index.entries.find((entry) => entry.fault === "NULL");
  if (fault_free) {
    examples.push({ label: "No fault", index: fault_free.index, note: "nothing broken, nothing done" });
  }
  return examples;
}
