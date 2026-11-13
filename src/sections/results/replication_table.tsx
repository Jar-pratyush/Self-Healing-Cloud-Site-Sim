import { format_seconds } from "../../content/format_values";
import { policy_color, policy_label } from "../../content/policy_meta";
import type { ResultsData, SiteConfig, TestRow } from "../../data/data_types";

type ReplicationTableProps = {
  results: ResultsData;
  tests: TestRow[];
  config: SiteConfig;
};

type BlockSpec = {
  block: string;
  title: string;
  description: string;
  test_hypothesis: string;
};

function find_pooled_test(tests: TestRow[], hypothesis: string): TestRow | undefined {
  return tests.find((row) => row.hypothesis === hypothesis && row.scope === "pooled" && row.metric === "mttr");
}

// The second-seed and degraded-link blocks next to the main evaluation, each
// with its pre-registered non-inferiority check against the runbook.
export function ReplicationTable({ results, tests, config }: ReplicationTableProps) {
  const block_specs: BlockSpec[] = [
    {
      block: "main",
      title: "Main evaluation",
      description: "Seed-0 agent, all five policies, normal link.",
      test_hypothesis: "H2",
    },
    {
      block: "seed1",
      title: "Second training seed",
      description: "The whole training recipe repeated with a different seed; the runbook ran alongside as a drift check.",
      test_hypothesis: "seed1-H2",
    },
    {
      block: "edge",
      title: "Degraded link",
      description: `Control traffic slowed by ${config.edge_link.delay ?? "?"} delay and ${config.edge_link.loss ?? "?"} packet loss (netem), a subset of the schedule.`,
      test_hypothesis: "H5",
    },
  ];

  return (
    <div className="replication_grid">
      {block_specs.map((spec) => {
        const block = results.blocks[spec.block];
        if (!block) {
          return null;
        }
        const test = find_pooled_test(tests, spec.test_hypothesis);
        const shown_policies = block.policies.filter((policy) => policy.startsWith("sac_per") && policy !== "sac_per_cold" || policy === "runbook");
        return (
          <article key={spec.block} className="replication_card">
            <h4>{spec.title}</h4>
            <p className="replication_description">{spec.description}</p>
            <table className="data_table">
              <thead>
                <tr>
                  <th scope="col">Policy</th>
                  <th scope="col">Recovered</th>
                  <th scope="col">Median MTTR</th>
                </tr>
              </thead>
              <tbody>
                {shown_policies.map((policy) => {
                  const pooled = block.pooled[policy];
                  return pooled ? (
                    <tr key={policy}>
                      <td>
                        <span className="policy_dot" style={{ background: policy_color(policy) }} />
                        {policy_label(policy)}
                      </td>
                      <td className="mono">
                        {pooled.recovered}/{pooled.fault_episodes}
                      </td>
                      <td className="mono">{format_seconds(pooled.mttr_median_censored_s)}</td>
                    </tr>
                  ) : null;
                })}
              </tbody>
            </table>
            {test && test.ci_low !== null && test.ci_high !== null ? (
              <p className={test.non_inferior ? "verdict is_pass" : "verdict is_open"}>
                <strong>{test.non_inferior ? "Non-inferior to the runbook" : "Non-inferiority not established"}</strong>
                <span>
                  {Math.round(config.statistics.ci_level * 100)} % CI of the median difference [{test.ci_low.toFixed(1)},{" "}
                  {test.ci_high.toFixed(1)}] s against a {config.statistics.non_inferiority_margin_s} s margin, n = {test.n_a}{" "}
                  per policy.
                </span>
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
