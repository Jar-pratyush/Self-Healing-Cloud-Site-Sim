import type { EpisodeLane, SiteConfig } from "../../data/data_types";
import { record_at } from "./replay_model";

type ObservationStripProps = {
  lane: EpisodeLane;
  playhead: number;
  config: SiteConfig;
};

function cell_color(value: number): string {
  // Diverging scale: positive values in indigo, negative in vermilion.
  const strength = Math.min(1, Math.abs(value));
  const tone = value >= 0 ? "var(--color_runbook)" : "var(--color_fault)";
  return `color-mix(in srgb, ${tone} ${Math.round(strength * 100)}%, var(--color_bg_raised))`;
}

// What the policy actually received at the decision: the 36 normalised
// values, and which of the 12 actions the mask allowed.
export function ObservationStrip({ lane, playhead, config }: ObservationStripProps) {
  const record_index = Math.max(0, record_at(lane, playhead));
  const observation = lane.ticks.observation[record_index] ?? [];
  const mask = lane.ticks.mask[record_index] ?? "";
  const executed = lane.ticks.action[record_index] ?? 0;
  const chosen = lane.ticks.chosen_action[record_index] ?? 0;

  return (
    <div className="observation_strip only_technical">
      <p className="strip_title">
        Policy input at this decision <span className="mono">s_t</span> ({observation.length} values)
      </p>
      <div className="strip_cells" role="list">
        {observation.map((value, value_index) => (
          <span
            key={value_index}
            role="listitem"
            className="strip_cell"
            style={{ background: cell_color(value) }}
            title={`${config.observation_names[value_index] ?? value_index}: ${value}`}
          />
        ))}
      </div>
      <p className="strip_legend">
        Hover a cell for its name and value. Groups: 5 global, 7 per service in the order{" "}
        {config.managed_services.join(", ")}, 3 controller.
      </p>

      <p className="strip_title">Action mask and choice</p>
      <ul className="mask_list">
        {config.actions.map((action) => {
          const allowed = mask[action.id] === "1";
          const class_names = ["mask_chip"];
          if (!allowed) {
            class_names.push("is_blocked");
          }
          if (action.id === executed && executed !== 0) {
            class_names.push("is_executed");
          } else if (action.id === 0 && executed === 0) {
            class_names.push("is_executed");
          }
          return (
            <li key={action.id} className={class_names.join(" ")} title={allowed ? "allowed" : "blocked by the mask"}>
              {action.name}
            </li>
          );
        })}
      </ul>
      {chosen !== executed ? (
        <p className="strip_legend">
          The policy chose {config.actions[chosen]?.name}; it was not allowed at that tick (masked or the tick was missed), so NOOP ran.
        </p>
      ) : null}
    </div>
  );
}
