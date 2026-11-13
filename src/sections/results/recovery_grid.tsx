import { fault_codes, fault_meta } from "../../content/fault_meta";
import { policy_color, policy_label } from "../../content/policy_meta";
import type { EpisodeRow, ResultsBlock } from "../../data/data_types";
import { open_replay } from "../../state/replay_bus";

type RecoveryGridProps = {
  block: ResultsBlock;
  policies: string[];
  can_open_replay: boolean;
};

function cell_title(row: EpisodeRow): string {
  const fault = fault_meta[row.fault];
  const head = `Incident #${String(row.index).padStart(2, "0")}, ${row.fault} ${fault.name}${row.target ? ` on ${row.target}` : ""}`;
  if (row.fault === "NULL") {
    return `${head}: ${row.actions > 0 ? `${row.actions} needless actions` : "no action, correct"}`;
  }
  return `${head}: ${row.recovered ? `recovered in ${row.mttr_censored_s.toFixed(1)} s` : "not recovered"}`;
}

// One square per episode: filled when the fault was repaired. In the
// fault-free group a marked square is a false alarm.
export function RecoveryGrid({ block, policies, can_open_replay }: RecoveryGridProps) {
  return (
    <div className="recovery_grid">
      <div className="recovery_grid_head" aria-hidden="true">
        <span />
        {fault_codes.map((code) => (
          <span key={code} className="recovery_group_title">
            <span className="mono">{code === "NULL" ? "—" : code}</span> {fault_meta[code].name}
          </span>
        ))}
        <span />
      </div>
      {policies.map((policy) => {
        const pooled = block.pooled[policy];
        const rows = block.episodes.filter((row) => row.policy === policy);
        return (
          <div key={policy} className="recovery_row" style={{ ["--row_color" as string]: policy_color(policy) }}>
            <span className="recovery_policy">{policy_label(policy)}</span>
            {fault_codes.map((code) => {
              const group = rows.filter((row) => row.fault === code).sort((first, second) => first.index - second.index);
              return (
                <span key={code} className="recovery_group" aria-label={`${fault_meta[code].name}`}>
                  {group.map((row) => {
                    const class_names = ["recovery_cell"];
                    if (code === "NULL") {
                      class_names.push(row.actions > 0 ? "is_false_alarm" : "is_quiet");
                    } else if (row.recovered) {
                      class_names.push("is_recovered");
                    }
                    const title = cell_title(row);
                    return can_open_replay ? (
                      <button
                        key={row.index}
                        type="button"
                        className={class_names.join(" ")}
                        title={`${title}. Open in the replay.`}
                        aria-label={`${title}. Open in the replay.`}
                        onClick={() => open_replay(row.index)}
                      />
                    ) : (
                      <span key={row.index} className={class_names.join(" ")} title={title} />
                    );
                  })}
                </span>
              );
            })}
            <span className="recovery_total mono">
              {pooled ? `${pooled.recovered}/${pooled.fault_episodes}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
