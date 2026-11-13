import { useId, useState } from "react";
import { format_p_value } from "../../content/format_values";
import { policy_label } from "../../content/policy_meta";
import type { ResultsData, SafetyTotals, SiteConfig, TestRow, TrainingRun } from "../../data/data_types";
import { TableScroll } from "../../components/table_scroll";

type HypothesisTestsProps = {
  config: SiteConfig;
  tests: TestRow[];
  results: ResultsData;
  safety: Record<string, Record<string, SafetyTotals>>;
  training: Record<string, TrainingRun>;
};

type Verdict = { tone: "pass" | "partial" | "open"; text: string };

type TabEntry = {
  tab_id: string;
  label: string;
  statement: string;
  comparison: string;
  test_groups: string[];
  verdicts: Verdict[];
};

// Names for the two runbook runs compared in the seed-1 drift check.
const side_labels: Record<string, string> = {
  anchor: "Runbook, seed-1 block",
  main: "Runbook, main block",
};

function side_label(side_name: string): string {
  return side_labels[side_name] ?? policy_label(side_name);
}

const metric_labels: Record<string, string> = {
  mttr: "MTTR (s)",
  sla_penalty: "SLA penalty",
  return: "return",
};

function show_scope(scope: string): string {
  if (scope === "train_return_1_100") {
    return "training ep. 1–100";
  }
  if (scope === "eval_mttr") {
    return "evaluation, F1–F4";
  }
  return scope === "pooled" ? "F1–F4 pooled" : scope;
}

function show_median(row: TestRow, value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return row.metric === "mttr" ? value.toFixed(1) : value.toFixed(2);
}

// Cliff's delta is P(a < b) − P(a > b): positive means the first policy's
// values are lower. Lower is better for MTTR and SLA penalty, higher for return.
function favours_first(row: TestRow): boolean {
  const delta = row.cliffs_delta ?? 0;
  return row.metric === "return" ? delta < 0 : delta > 0;
}

// Bounds near zero keep two decimals so a tiny negative value never prints
// as "-0.0".
function show_bound(row: TestRow, value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return row.metric === "mttr" && Math.abs(value) >= 1 ? value.toFixed(1) : value.toFixed(2);
}

function is_significant(row: TestRow, alpha: number): boolean {
  return row.p_holm !== null && row.p_holm < alpha;
}

function uses_margin(row: TestRow): boolean {
  return row.metric === "mttr" && ["H2", "H5", "seed1-H2"].includes(row.hypothesis);
}

function scope_list(rows: TestRow[]): string {
  return rows.map((row) => show_scope(row.scope)).join(", ");
}

function build_tabs({ config, tests, results, safety, training }: HypothesisTestsProps): TabEntry[] {
  const alpha = config.statistics.alpha;
  const margin = config.statistics.non_inferiority_margin_s;
  const rows_of = (group: string, metric?: string) =>
    tests.filter((row) => row.hypothesis === group && (!metric || row.metric === metric));
  const statement_of = (hypothesis_id: string) => config.hypotheses.find((entry) => entry.id === hypothesis_id);

  const h1_rows = rows_of("H1");
  const h1_pass = h1_rows.filter((row) => is_significant(row, alpha) && favours_first(row));
  const h1_fail = h1_rows.filter((row) => !h1_pass.includes(row));

  const non_inferiority_verdict = (group: string): Verdict[] => {
    const mttr_rows = rows_of(group, "mttr");
    const pooled = mttr_rows.find((row) => row.scope === "pooled");
    const per_fault_pass = mttr_rows.filter((row) => row.scope !== "pooled" && row.non_inferior);
    const penalty_rows = rows_of(group, "sla_penalty");
    const penalty_lower = penalty_rows.filter((row) => is_significant(row, alpha) && favours_first(row));
    const verdicts: Verdict[] = [];
    if (pooled) {
      verdicts.push({
        tone: pooled.non_inferior ? "pass" : "open",
        text: pooled.non_inferior
          ? `MTTR non-inferior pooled: the upper 95 % bound of the median difference is ${pooled.ci_high?.toFixed(1)} s, under the ${margin} s margin. Per fault it holds for ${per_fault_pass.length ? scope_list(per_fault_pass) : "none"}.`
          : `MTTR non-inferiority not shown: the upper bound is ${pooled.ci_high?.toFixed(2)} s against a ${margin} s margin. Per fault it holds for ${per_fault_pass.length ? scope_list(per_fault_pass) : "none"}.`,
      });
    }
    if (penalty_rows.length) {
      verdicts.push({
        tone: penalty_lower.length ? "partial" : "open",
        text: penalty_lower.length
          ? `Lower SLA penalty shown for ${scope_list(penalty_lower)}.`
          : `Lower SLA penalty not shown: none of the ${penalty_rows.length} comparisons is significant after Holm correction.`,
      });
    }
    return verdicts;
  };

  const h3_return = rows_of("H3", "return")[0];
  const h3_mttr = rows_of("H3", "mttr")[0];

  const agent_safety = Object.entries(safety)
    .map(([block_name, policies]) => ({ block_name, totals: policies.sac_per ?? policies.sac_per_s1 }))
    .filter((entry) => entry.totals);
  const mask_violations = agent_safety.reduce((total, entry) => total + (entry.totals?.mask_violations ?? 0), 0);
  const exec_errors = agent_safety.reduce((total, entry) => total + (entry.totals?.exec_errors ?? 0), 0);
  const agent_episodes = agent_safety.reduce((total, entry) => total + (entry.totals?.episodes ?? 0), 0);
  const main_null = results.blocks.main?.pooled.sac_per;
  const seed_zero = training.sac_per_s0;
  const training_null = seed_zero ? seed_zero.fault.map((fault, row_index) => ({ fault, actions: seed_zero.actions[row_index] ?? 0 })).filter((row) => row.fault === "NULL") : [];
  const training_false = training_null.filter((row) => row.actions > 0).length;

  const tab_for = (hypothesis_id: string, verdicts: Verdict[], test_groups: string[]): TabEntry => ({
    tab_id: hypothesis_id,
    label: hypothesis_id,
    statement: statement_of(hypothesis_id)?.statement ?? "",
    comparison: statement_of(hypothesis_id)?.comparison ?? "",
    test_groups,
    verdicts,
  });

  return [
    tab_for(
      "H1",
      [
        {
          tone: h1_fail.length ? "partial" : "pass",
          text: `Lower MTTR in ${h1_pass.length} of ${h1_rows.length} comparisons (Holm-adjusted p < ${alpha}).${
            h1_fail.length
              ? ` Not for ${h1_fail.map((row) => `${row.scope} against ${policy_label(row.b)}`).join(", ")}${h1_fail.some((row) => !favours_first(row)) ? ", where the baseline was faster" : ""}.`
              : ""
          }`,
        },
      ],
      ["H1"],
    ),
    tab_for("H2", non_inferiority_verdict("H2"), ["H2"]),
    tab_for(
      "H3",
      [
        h3_return
          ? {
              tone: is_significant(h3_return, alpha) && favours_first(h3_return) ? "pass" : "open",
              text: `Early learning: median return over the first 100 training episodes ${h3_return.median_a?.toFixed(2)} warm vs ${h3_return.median_b?.toFixed(2)} cold, p = ${format_p_value(h3_return.p_holm)}.`,
            }
          : null,
        h3_mttr
          ? {
              tone: is_significant(h3_mttr, alpha) && favours_first(h3_mttr) ? "pass" : "open",
              text: `Final MTTR: median ${h3_mttr.median_a?.toFixed(1)} s warm vs ${h3_mttr.median_b?.toFixed(1)} s cold, p = ${format_p_value(h3_mttr.p_holm)}. The cold agent had half the training episodes, so this is the weaker of the two tests.`,
            }
          : null,
      ].filter((verdict): verdict is Verdict => verdict !== null),
      ["H3"],
    ),
    tab_for(
      "H4",
      [
        {
          tone: mask_violations === 0 && exec_errors === 0 ? "pass" : "open",
          text: `${mask_violations} mask violations and ${exec_errors} execution errors across ${agent_episodes} evaluation episodes of the agent, all blocks.`,
        },
        main_null
          ? {
              tone: main_null.null_with_action === 0 ? "pass" : "open",
              text: `Acted in ${main_null.null_with_action} of ${main_null.null_episodes} fault-free evaluation episodes.`,
            }
          : null,
        seed_zero
          ? {
              tone: training_null.length && training_false / training_null.length <= 0.1 ? "pass" : "open",
              text: `False remediations in training: ${training_false} of ${training_null.length} fault-free episodes, against a limit of 10 %.`,
            }
          : null,
      ].filter((verdict): verdict is Verdict => verdict !== null),
      [],
    ),
    tab_for("H5", non_inferiority_verdict("H5"), ["H5"]),
    {
      tab_id: "seed1",
      label: "Seed 1",
      statement:
        "Replication, not a confirmatory test: the same recipe trained from seed 1, evaluated on the full schedule beside a fresh runbook run that checks for drift between days.",
      comparison: "sac_per_s1 vs runbook; runbook vs runbook; seed 1 vs seed 0",
      test_groups: ["seed1-H2", "seed1-drift", "seed1-vs-seed0"],
      verdicts: non_inferiority_verdict("seed1-H2"),
    },
  ];
}

const group_titles: Record<string, string> = {
  "seed1-H2": "H2 rule within the seed-1 block",
  "seed1-drift": "Drift check: runbook on two different days",
  "seed1-vs-seed0": "Seed 1 against seed 0",
};

function TestTable({ rows, margin_s }: { rows: TestRow[]; margin_s: number }) {
  const show_margin = rows.some(uses_margin);
  return (
    <TableScroll label="Test results">
      <table className="data_table test_table">
        <thead>
          <tr>
            <th scope="col">scope</th>
            <th scope="col">metric</th>
            <th scope="col">n</th>
            <th scope="col">median a / b</th>
            <th scope="col">95 % CI of a − b</th>
            <th scope="col">U</th>
            <th scope="col">p (Holm)</th>
            <th scope="col">
              Cliff's <span className="keep_case">δ</span>
            </th>
            {show_margin ? <th scope="col">NI, {margin_s} s</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.hypothesis}_${row.scope}_${row.metric}_${row.b}`}>
              <td>{show_scope(row.scope)}</td>
              <td>
                {metric_labels[row.metric] ?? row.metric}
                {rows.some((other) => other.b !== row.b) ? <span className="test_versus"> vs {side_label(row.b)}</span> : null}
              </td>
              <td className="mono">
                {row.n_a}/{row.n_b}
              </td>
              <td className="mono">
                {show_median(row, row.median_a)} / {show_median(row, row.median_b)}
              </td>
              <td className="mono">
                [{show_bound(row, row.ci_low)}, {show_bound(row, row.ci_high)}]
              </td>
              <td className="mono">{row.u}</td>
              <td className="mono">{format_p_value(row.p_holm)}</td>
              <td className="mono">{row.cliffs_delta?.toFixed(2)}</td>
              {show_margin ? <td className="mono">{uses_margin(row) ? (row.non_inferior ? "yes" : "no") : ""}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

// The pre-registered hypotheses, one tab each, with verdicts computed from
// the exported test rows rather than written by hand.
export function HypothesisTests(props: HypothesisTestsProps) {
  const tabs = build_tabs(props);
  const [active_id, set_active_id] = useState(tabs[0]?.tab_id ?? "H1");
  const base_id = useId();
  const active_tab = tabs.find((tab) => tab.tab_id === active_id) ?? tabs[0];

  return (
    <div className="hypothesis_tests">
      <div className="hypothesis_tabs" role="tablist" aria-label="Hypotheses">
        {tabs.map((tab, tab_index) => (
          <button
            key={tab.tab_id}
            id={`${base_id}_tab_${tab.tab_id}`}
            type="button"
            role="tab"
            aria-selected={tab.tab_id === active_id}
            aria-controls={`${base_id}_panel`}
            tabIndex={tab.tab_id === active_id ? 0 : -1}
            onClick={() => set_active_id(tab.tab_id)}
            onKeyDown={(key_event) => {
              const step = key_event.key === "ArrowRight" ? 1 : key_event.key === "ArrowLeft" ? -1 : 0;
              if (step) {
                const next_tab = tabs[(tab_index + step + tabs.length) % tabs.length];
                if (next_tab) {
                  set_active_id(next_tab.tab_id);
                  document.getElementById(`${base_id}_tab_${next_tab.tab_id}`)?.focus();
                }
              }
            }}
          >
            <span className="mono">{tab.label}</span>
            <span className={`tab_light is_${tab.verdicts.every((verdict) => verdict.tone === "pass") ? "pass" : tab.verdicts.some((verdict) => verdict.tone !== "open") ? "partial" : "open"}`} aria-hidden="true" />
          </button>
        ))}
      </div>
      {active_tab ? (
        <div id={`${base_id}_panel`} role="tabpanel" aria-labelledby={`${base_id}_tab_${active_tab.tab_id}`} className="hypothesis_panel">
          <p className="hypothesis_statement">{active_tab.statement}</p>
          <p className="hypothesis_comparison mono">{active_tab.comparison}</p>
          <ul className="verdict_list">
            {active_tab.verdicts.map((verdict) => (
              <li key={verdict.text} className={`is_${verdict.tone}`}>
                {verdict.text}
              </li>
            ))}
          </ul>
          {active_tab.test_groups.map((group) => {
            const rows = props.tests.filter((row) => row.hypothesis === group);
            if (!rows.length) {
              return null;
            }
            const first_row = rows[0];
            return (
              <div key={group} className="test_group">
                <p className="setting_table_title">
                  {group_titles[group] ?? `${side_label(first_row?.a ?? "")} (a) vs ${Array.from(new Set(rows.map((row) => side_label(row.b)))).join(", ")} (b)`}
                </p>
                <TestTable rows={rows} margin_s={props.config.statistics.non_inferiority_margin_s} />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
