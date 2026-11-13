import { fault_meta, repair_action } from "../../content/fault_meta";
import { format_service } from "../../content/format_values";
import { policy_color, policy_label } from "../../content/policy_meta";
import type { ActionRow, FaultCode } from "../../data/data_types";

type ActionsTableProps = {
  rows: ActionRow[];
  policies: string[];
};

// "RESTORE cartservice > RESTORE cartservice > SCALE_UP frontend" becomes
// "RESTORE cartservice ×2, SCALE_UP frontend", so long repeats stay readable.
function compress_sequence(sequence: string): string {
  if (sequence === "none") {
    return "no action";
  }
  const steps = sequence.split(" > ");
  const runs: { step: string; count: number }[] = [];
  for (const step of steps) {
    const last = runs[runs.length - 1];
    if (last && last.step === step) {
      last.count += 1;
    } else {
      runs.push({ step, count: 1 });
    }
  }
  return runs.map((run) => (run.count > 1 ? `${run.step} ×${run.count}` : run.step)).join(", ");
}

function remaining_episodes(count: number): string {
  return `${count} more episode${count === 1 ? "" : "s"}`;
}

type GroupKey = { fault: FaultCode; target: string | null };

export function ActionsTable({ rows, policies }: ActionsTableProps) {
  const groups: GroupKey[] = [];
  for (const row of rows) {
    if (!groups.some((group) => group.fault === row.fault && group.target === row.target)) {
      groups.push({ fault: row.fault as FaultCode, target: row.target });
    }
  }
  groups.sort((first, second) => first.fault.localeCompare(second.fault) || String(first.target).localeCompare(String(second.target)));

  return (
    <div className="table_scroll">
      <table className="data_table actions_table">
        <thead>
          <tr>
            <th scope="col">Fault</th>
            <th scope="col">Correct repair</th>
            {policies.map((policy) => (
              <th key={policy} scope="col" style={{ color: policy_color(policy) }}>
                {policy_label(policy)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={`${group.fault}_${group.target}`}>
              <th scope="row">
                <span className="mono">{group.fault}</span> {fault_meta[group.fault].name}
                {group.target ? <span className="actions_target">{format_service(group.target)}</span> : null}
              </th>
              <td>
                <code>{repair_action(group.fault, group.target)}</code>
              </td>
              {policies.map((policy) => {
                const policy_rows = rows
                  .filter((row) => row.policy === policy && row.fault === group.fault && row.target === group.target)
                  .sort((first, second) => second.episodes - first.episodes);
                return (
                  <td key={policy}>
                    <ul className="sequence_list">
                      {policy_rows.slice(0, 3).map((row) => (
                        <li key={row.executed_actions}>
                          <span className="sequence_count mono">{row.episodes}×</span>
                          <span className="sequence_text">{compress_sequence(row.executed_actions)}</span>
                        </li>
                      ))}
                      {policy_rows.length > 3 ? (
                        <li className="sequence_more">
                          and {remaining_episodes(policy_rows.slice(3).reduce((total, row) => total + row.episodes, 0))}
                        </li>
                      ) : null}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
