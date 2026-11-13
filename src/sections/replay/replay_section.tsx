import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeepPanel } from "../../components/deep_panel";
import { SectionFrame } from "../../components/section_frame";
import { fault_meta, severity_label } from "../../content/fault_meta";
import { policy_color, policy_label } from "../../content/policy_meta";
import type { EpisodeEntry, EpisodeIndex, SiteConfig } from "../../data/data_types";
import { useSiteData } from "../../data/use_site_data";
import { useReducedMotion } from "../../hooks/use_reduced_motion";
import { useOpenReplayListener } from "../../state/replay_bus";
import { LanePanel } from "./lane_panel";
import { ObservationStrip } from "./observation_strip";
import { build_beats, pick_examples, relative_range } from "./replay_model";
import "./replay_section.css";

const agent_policy = "sac_per";
const baseline_choices = ["k8s_default", "k8s_hpa", "runbook", "sac_per_cold"];
const play_interval_ms = 900;
const wide_layout_query = "(min-width: 960px)";

function entry_file(entry_index: number): string {
  return `episodes/entry_${String(entry_index).padStart(2, "0")}.json`;
}

function useWideLayout(): boolean {
  const [is_wide, set_is_wide] = useState(() => window.matchMedia(wide_layout_query).matches);
  useEffect(() => {
    const media_list = window.matchMedia(wide_layout_query);
    const on_change = () => set_is_wide(media_list.matches);
    media_list.addEventListener("change", on_change);
    return () => media_list.removeEventListener("change", on_change);
  }, []);
  return is_wide;
}

export function ReplaySection() {
  const { data: config } = useSiteData<SiteConfig>("config.json");
  const { data: index } = useSiteData<EpisodeIndex>("episodes/index.json");
  const [chosen_entry, set_chosen_entry] = useState<number | null>(null);
  const [baseline_policy, set_baseline_policy] = useState("k8s_default");
  useOpenReplayListener(set_chosen_entry);

  const entry_index = chosen_entry ?? index?.featured_entry ?? null;
  const { data: entry } = useSiteData<EpisodeEntry>(entry_index === null ? null : entry_file(entry_index));

  return (
    <SectionFrame
      section_id="replay"
      section_number={3}
      kicker="Recorded replay"
      title="One real incident, tick by tick."
      lede={
        <>
          <p>
            Everything below is replayed from the measurement log of a real episode on the cluster: no animation is
            invented and no value is smoothed. Pick any of the {index?.entries.length ?? ""} scheduled incidents, and
            compare the agent with what another policy did on the very same incident.
          </p>
          <p className="only_plain">
            Each dot is one 20-second check-up. The dashed red line is the speed target: above it, shoppers are waiting
            too long.
          </p>
        </>
      }
    >
      {config && index ? (
        <ReplayControls
          index={index}
          entry_index={entry_index}
          on_entry_change={set_chosen_entry}
          baseline_policy={baseline_policy}
          on_baseline_change={set_baseline_policy}
        />
      ) : null}

      {config && entry && entry.index === entry_index ? (
        <ReplayStage key={`${entry.index}_${baseline_policy}`} config={config} entry={entry} baseline_policy={baseline_policy} />
      ) : (
        <div className="replay_loading panel" aria-busy="true">
          Loading the recorded episode
        </div>
      )}

      {config ? (
        <DeepPanel title="How to read the replay">
          <p>
            One record is written per {config.tick_s} s tick. A record holds the action dispatched at the start of the
            tick and the telemetry measured during it, so actions are drawn on tick boundaries and measurements in the
            middle of each tick. Latency is the frontend's server-side p{Math.round(config.sla.latency_quantile * 100)}{" "}
            over the tick, on a log scale; the bars under it are the share of failed Locust requests.
          </p>
          <p>
            Readings near 5 s are not a chart limit: Locust times requests out at {config.locust.request_timeout_s} s,
            so a stalled service shows up at about that value. Times are relative to the injection tick, so the time
            to recovery printed for each lane (measured from the injection instant) can differ from the grid by a
            fraction of a second.
          </p>
          <p>
            The policies were run interleaved on each schedule entry, in a random order, on the same cluster, so the
            two lanes faced the same fault, target and severity but not the same instant. Only the drawn fields are
            exported, rounded for size (latency to 0.1 ms).
          </p>
        </DeepPanel>
      ) : null}
    </SectionFrame>
  );
}

type ReplayControlsProps = {
  index: EpisodeIndex;
  entry_index: number | null;
  on_entry_change: (entry_index: number) => void;
  baseline_policy: string;
  on_baseline_change: (policy: string) => void;
};

function ReplayControls({ index, entry_index, on_entry_change, baseline_policy, on_baseline_change }: ReplayControlsProps) {
  const examples = useMemo(() => pick_examples(index), [index]);

  return (
    <div className="replay_controls">
      <div className="example_row" role="group" aria-label="Example incidents">
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            className="example_button"
            aria-pressed={entry_index === example.index}
            onClick={() => on_entry_change(example.index)}
          >
            <span className="example_label">{example.label}</span>
            <span className="example_note">{example.note}</span>
          </button>
        ))}
      </div>

      <div className="picker_row">
        <label className="picker">
          <span className="picker_label">Incident</span>
          <select value={entry_index ?? ""} onChange={(change_event) => on_entry_change(Number(change_event.target.value))}>
            {index.entries.map((item) => {
              const severity = severity_label(item.fault, item.severity);
              const agent = item.outcomes[agent_policy];
              return (
                <option key={item.index} value={item.index}>
                  {`#${String(item.index).padStart(2, "0")} · ${item.fault} ${fault_meta[item.fault].name}${item.target ? ` · ${item.target}` : ""}${severity ? ` · ${severity}` : ""}${
                    agent && item.fault !== "NULL" ? (agent.recovered ? ` · agent ${agent.mttr_censored_s.toFixed(0)} s` : " · agent did not recover") : ""
                  }`}
                </option>
              );
            })}
          </select>
        </label>

        <div className="picker">
          <span className="picker_label" id="baseline_label">
            Compare with
          </span>
          <div className="baseline_switch" role="group" aria-labelledby="baseline_label">
            {baseline_choices.map((policy) => (
              <button
                key={policy}
                type="button"
                aria-pressed={baseline_policy === policy}
                onClick={() => on_baseline_change(policy)}
                style={{ ["--choice_color" as string]: policy_color(policy) }}
              >
                {policy_label(policy)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ReplayStageProps = {
  config: SiteConfig;
  entry: EpisodeEntry;
  baseline_policy: string;
};

function ReplayStage({ config, entry, baseline_policy }: ReplayStageProps) {
  const reduced_motion = useReducedMotion();
  const is_wide = useWideLayout();
  const scroll_linked = is_wide && !reduced_motion;

  const agent_lane = entry.lanes[agent_policy];
  const baseline_lane = entry.lanes[baseline_policy] ?? null;
  const lanes = [agent_lane, baseline_lane].filter((lane) => lane !== undefined && lane !== null);
  const range = relative_range(lanes);
  const beats = useMemo(
    () => (agent_lane ? build_beats(entry, agent_lane, baseline_lane, config) : []),
    [agent_lane, baseline_lane, entry, config],
  );

  const [playhead, set_playhead] = useState(() => beats[0]?.relative_tick ?? range[0]);
  const [is_playing, set_is_playing] = useState(false);
  const [active_beat, set_active_beat] = useState(0);
  const beat_refs = useRef<(HTMLElement | null)[]>([]);

  const go_to_beat = useCallback(
    (beat_index: number) => {
      const beat = beats[beat_index];
      if (!beat) {
        return;
      }
      set_active_beat(beat_index);
      set_playhead(beat.relative_tick);
      set_is_playing(false);
    },
    [beats],
  );

  // Desktop with motion allowed: the beat crossing the middle of the screen
  // drives the playhead, so scrolling through the story plays the episode.
  useEffect(() => {
    if (!scroll_linked) {
      return;
    }
    const observer = new IntersectionObserver(
      (observed) => {
        for (const item of observed) {
          if (item.isIntersecting) {
            const beat_index = Number((item.target as HTMLElement).dataset.beatIndex);
            const beat = beats[beat_index];
            if (beat) {
              set_active_beat(beat_index);
              set_playhead(beat.relative_tick);
              set_is_playing(false);
            }
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const element of beat_refs.current) {
      if (element) {
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, [beats, scroll_linked]);

  useEffect(() => {
    if (!is_playing) {
      return;
    }
    const timer = window.setInterval(() => {
      set_playhead((current) => {
        if (current >= range[1]) {
          set_is_playing(false);
          return current;
        }
        return current + 1;
      });
    }, play_interval_ms);
    return () => window.clearInterval(timer);
  }, [is_playing, range]);

  if (!agent_lane) {
    return <p className="replay_loading panel">This incident has no agent episode.</p>;
  }

  const start_playing = () => {
    if (playhead >= range[1]) {
      set_playhead(range[0]);
    }
    set_is_playing(true);
  };

  const transport = (
    <div className="transport">
      <button type="button" className="transport_button" onClick={() => set_playhead((current) => Math.max(range[0], current - 1))} aria-label="Previous tick">
        ‹
      </button>
      <button
        type="button"
        className="transport_button transport_play"
        onClick={() => (is_playing ? set_is_playing(false) : start_playing())}
        aria-label={is_playing ? "Pause" : "Play the episode"}
      >
        {is_playing ? "Pause" : "Play"}
      </button>
      <button type="button" className="transport_button" onClick={() => set_playhead((current) => Math.min(range[1], current + 1))} aria-label="Next tick">
        ›
      </button>
      <input
        className="transport_scrubber"
        type="range"
        min={range[0]}
        max={range[1]}
        step={1}
        value={playhead}
        aria-label="Tick"
        onChange={(change_event) => {
          set_is_playing(false);
          set_playhead(Number(change_event.target.value));
        }}
      />
      <span className="transport_time mono">
        {playhead * config.tick_s >= 0 ? "+" : "−"}
        {Math.abs(playhead * config.tick_s)} s
      </span>
    </div>
  );

  const fault = fault_meta[entry.fault];
  const severity = severity_label(entry.fault, entry.severity);

  return (
    <div className={scroll_linked ? "replay_stage is_scroll_linked" : "replay_stage"}>
      <div className="beat_column">
        <p className="incident_tag">
          <span className="mono">#{String(entry.index).padStart(2, "0")}</span> {entry.fault} {fault.name}
          {entry.target ? ` · ${entry.target}` : ""}
          {severity ? ` · ${severity}` : ""}
        </p>
        {!scroll_linked ? (
          <ol className="beat_stepper" aria-label="Story steps">
            {beats.map((beat, beat_index) => (
              <li key={beat.beat_key}>
                <button type="button" aria-pressed={active_beat === beat_index} onClick={() => go_to_beat(beat_index)}>
                  <span className="mono">{beat_index + 1}</span> {beat.title}
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        {beats.map((beat, beat_index) => (
          <section
            key={beat.beat_key}
            ref={(element) => {
              beat_refs.current[beat_index] = element;
            }}
            data-beat-index={beat_index}
            className={active_beat === beat_index ? "beat_card is_active" : "beat_card"}
            hidden={!scroll_linked && active_beat !== beat_index}
            aria-live={scroll_linked ? undefined : "polite"}
          >
            <p className="beat_number mono">
              {beat_index + 1} / {beats.length}
            </p>
            <h3 className="beat_title">{beat.title}</h3>
            <p className="beat_body">{beat.body}</p>
            {!scroll_linked && beat_index < beats.length - 1 ? (
              <button type="button" className="beat_next" onClick={() => go_to_beat(beat_index + 1)}>
                Next step
              </button>
            ) : null}
          </section>
        ))}
      </div>

      <div className="instrument_column">
        <div className="instrument_sticky">
          {transport}
          <div className="lane_grid">
            <LanePanel lane={agent_lane} role_label="Agent" range={range} playhead={playhead} config={config} fault_target={entry.target} />
            {baseline_lane ? (
              <LanePanel lane={baseline_lane} role_label="Comparison" range={range} playhead={playhead} config={config} fault_target={entry.target} />
            ) : null}
          </div>
          <ObservationStrip lane={agent_lane} playhead={playhead} config={config} />
        </div>
      </div>
    </div>
  );
}
