import { DeepPanel } from "../../components/deep_panel";
import { SectionFrame } from "../../components/section_frame";
import { fault_meta } from "../../content/fault_meta";
import { format_number, format_seconds } from "../../content/format_values";
import { policy_color, policy_label } from "../../content/policy_meta";
import type { EpisodeIndex, MeasurementData, ResultsData, SafetyTotals, SiteConfig, TestRow, TrainingRun } from "../../data/data_types";
import { useSiteData } from "../../data/use_site_data";
import { ActionsTable } from "./actions_table";
import { MeasurementFindings } from "./measurement_findings";
import { MttrStripChart } from "./mttr_strip_chart";
import { RecoveryGrid } from "./recovery_grid";
import { ReplicationTable } from "./replication_table";
import { SurvivalChart } from "./survival_chart";
import { TrainingChart } from "./training_chart";
import "./results_section.css";

const main_policies = ["sac_per", "runbook", "k8s_hpa", "k8s_default", "sac_per_cold"];
const fault_order = ["F1", "F2", "F3", "F4"] as const;

export function ResultsSection() {
  const { data: results } = useSiteData<ResultsData>("results.json");
  const { data: config } = useSiteData<SiteConfig>("config.json");
  const { data: tests } = useSiteData<TestRow[]>("tests.json");
  const { data: training } = useSiteData<Record<string, TrainingRun>>("training.json");
  const { data: measurement } = useSiteData<MeasurementData>("measurement.json");
  const { data: safety } = useSiteData<Record<string, Record<string, SafetyTotals>>>("safety.json");
  const { data: episode_index } = useSiteData<EpisodeIndex>("episodes/index.json");

  const main_block = results?.blocks.main;
  const agent = main_block?.pooled.sac_per;
  const runbook = main_block?.pooled.runbook;
  const autoscaler = main_block?.pooled.k8s_hpa;
  const cold = main_block?.pooled.sac_per_cold;
  const h4_f4 = tests?.find((row) => row.hypothesis === "H1" && row.scope === "F4" && row.b === "k8s_hpa");
  const h2_pooled = tests?.find((row) => row.hypothesis === "H2" && row.scope === "pooled" && row.metric === "mttr");
  const h3_return = tests?.find((row) => row.hypothesis === "H3" && row.metric === "return");
  const f2_currency_agent = main_block?.episodes.filter(
    (row) => row.policy === "sac_per" && row.fault === "F2" && row.target === "currencyservice",
  );
  const agent_safety = safety?.main?.sac_per;
  const autoscaler_only_surges = Boolean(
    main_block?.episodes.some((row) => row.policy === "k8s_hpa" && row.recovered) &&
      main_block?.episodes.every((row) => row.policy !== "k8s_hpa" || !row.recovered || row.fault === "F4"),
  );
  const context_main = results?.context.main;

  return (
    <SectionFrame
      section_id="results"
      section_number={4}
      kicker="Results"
      title="How often it fixed things, and how fast."
      lede={
        <p>
          Every policy faced the same {main_block?.entries ?? ""} scheduled incidents, run back to back on the same
          cluster. The numbers come straight from those episodes, including the ones the agent lost.
        </p>
      }
    >
      {main_block && config && agent && runbook && autoscaler && cold ? (
        <>
          <div className="results_block">
            <h3 className="results_heading">Who fixed what</h3>
            <p className="results_text prose">
              Each square is one episode. A filled square means the fault was repaired within{" "}
              {config.episode.censor_s} s; in the fault-free column a marked square means the policy acted when nothing
              was wrong. The agent repaired {agent.recovered} of {agent.fault_episodes} faults, the runbook we wrote{" "}
              {runbook.recovered}.
              {autoscaler_only_surges ? " Kubernetes' autoscaler only ever fixed traffic surges." : null} Select any square
              to replay it.
            </p>
            <figure className="figure_block">
              <RecoveryGrid block={main_block} policies={main_policies} can_open_replay={Boolean(episode_index)} />
              <figcaption className="figure_caption">
                <strong>Fig. 3</strong>
                Outcome of every main-block episode by policy and fault type. Source: episodes_main.csv.
              </figcaption>
            </figure>
          </div>

          <div className="results_block">
            <h3 className="results_heading">How fast</h3>
            <p className="results_text prose">
              Median time to recovery over all {agent.fault_episodes} faults was{" "}
              {format_seconds(agent.mttr_median_censored_s)} for the agent and{" "}
              {format_seconds(runbook.mttr_median_censored_s)} for the runbook; a fault that was never fixed counts as{" "}
              {config.episode.censor_s} s. Per fault type the agent's medians were{" "}
              {fault_order
                .map((fault) => {
                  const row = main_block.summary.find((item) => item.policy === "sac_per" && item.fault === fault);
                  return `${fault} ${row?.mttr_median_censored_s?.toFixed(0) ?? "n/a"} s`;
                })
                .join(", ")}
              ; CPU stress was its weak spot.
              {h4_f4 && h4_f4.median_b !== null && h4_f4.median_a !== null ? (
                <>
                  {" "}
                  On traffic surges the autoscaler was faster (median {h4_f4.median_b.toFixed(1)} s against{" "}
                  {h4_f4.median_a.toFixed(1)} s), because it adds copies as CPU climbs, before the SLA is breached.
                </>
              ) : null}
            </p>
            <figure className="figure_block">
              <div className="mttr_grid">
                {fault_order.map((fault) => (
                  <MttrStripChart
                    key={fault}
                    block={main_block}
                    fault={fault}
                    policies={main_policies}
                    censor_s={config.episode.censor_s}
                  />
                ))}
              </div>
              <PolicyLegend policies={main_policies} />
              <figcaption className="figure_caption">
                <strong>Fig. 4</strong>
                Time to recovery of every fault episode; the bar is the median, hollow rings at {config.episode.censor_s}+
                never recovered. Resolution is one {config.tick_s} s tick. Source: episodes_main.csv.
              </figcaption>
            </figure>

            {results ? (
              <figure className="figure_block">
                <SurvivalChart curves={results.km_curves} policies={main_policies} censor_s={config.episode.censor_s} />
                <PolicyLegend policies={main_policies} />
                <figcaption className="figure_caption">
                  <strong>Fig. 5</strong>
                  Share of the {agent.fault_episodes} fault episodes still broken after a given time (Kaplan-Meier,
                  pooled F1 to F4). Lower and further left is better. Source: km_curves.csv.
                </figcaption>
              </figure>
            ) : null}

            <DeepPanel title="Scorecard and the pre-registered comparison">
              <div className="table_scroll">
                <table className="data_table">
                  <thead>
                    <tr>
                      <th scope="col">Policy</th>
                      <th scope="col">Recovered</th>
                      <th scope="col">Median MTTR</th>
                      <th scope="col">Median, recovered only</th>
                      <th scope="col">Mean SLA penalty</th>
                      <th scope="col">Actions per fault</th>
                      <th scope="col">Fault-free with action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {main_policies.map((policy) => {
                      const pooled = main_block.pooled[policy];
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
                          <td className="mono">{format_seconds(pooled.mttr_median_recovered_s)}</td>
                          <td className="mono">{format_number(pooled.sla_penalty_mean, 2)}</td>
                          <td className="mono">{format_number(pooled.actions_mean, 2)}</td>
                          <td className="mono">
                            {pooled.null_with_action}/{pooled.null_episodes}
                          </td>
                        </tr>
                      ) : null;
                    })}
                  </tbody>
                </table>
              </div>
              {h2_pooled && h2_pooled.ci_low !== null && h2_pooled.ci_high !== null ? (
                <p className="table_note">
                  Agent against runbook, pooled MTTR: {Math.round(config.statistics.ci_level * 100)} % bootstrap CI of the
                  median difference [{h2_pooled.ci_low.toFixed(1)}, {h2_pooled.ci_high.toFixed(1)}] s, inside the
                  pre-registered {config.statistics.non_inferiority_margin_s} s margin, so the agent is non-inferior. It
                  is not superior (Mann-Whitney p = {h2_pooled.p?.toFixed(2)}). The SLA penalty is the sum over the
                  episode of a per-tick violation score between 0 and 1.
                </p>
              ) : null}
            </DeepPanel>
          </div>

          <div className="results_block">
            <h3 className="results_heading">What it learned to do</h3>
            <p className="results_text prose">
              Nobody told the agent which repair fits which fault. It learned to restore a bad deploy or a service scaled
              to zero, restart a CPU-starved cartservice, and scale the frontend on a surge, with one or two actions per
              episode. The cold-start agent, trained without the runbook examples, settled on restoring cartservice over
              and over, whatever was broken.
            </p>
            <ActionsTable rows={main_block.actions} policies={["sac_per", "runbook", "sac_per_cold"]} />
            <p className="source_note">Most frequent executed action sequences per fault and target. Source: actions_main.csv.</p>
          </div>

          {training ? (
            <div className="results_block">
              <h3 className="results_heading">Learning on the job</h3>
              <p className="results_text prose">
                All training happened online, on the live cluster, at about one episode every six to eight minutes. Warm
                start means the agent first studied {config.runbook.warmstart_episodes} recorded runbook episodes before
                touching the cluster.
                {h3_return && h3_return.median_a !== null && h3_return.median_b !== null ? (
                  <>
                    {" "}
                    Over the first 100 episodes its median return was {h3_return.median_a.toFixed(2)} against{" "}
                    {h3_return.median_b.toFixed(2)} for the cold start.
                  </>
                ) : null}
              </p>
              <figure className="figure_block">
                <TrainingChart runs={training} />
                <figcaption className="figure_caption">
                  <strong>Fig. 6</strong>
                  Training on the real cluster. Source: training.csv.
                </figcaption>
              </figure>
            </div>
          ) : null}

          {results && tests ? (
            <div className="results_block">
              <h3 className="results_heading">Does it hold up?</h3>
              <p className="results_text prose">
                Two checks beyond the main run: the same recipe trained again from another random seed, and the main
                schedule's subset repeated with the control link deliberately degraded.
              </p>
              <ReplicationTable results={results} tests={tests} config={config} />
            </div>
          ) : null}

          {measurement ? (
            <div className="results_block">
              <h3 className="results_heading">What building it taught us</h3>
              <p className="results_text prose">
                Before any learning could work, the testbed had to measure the right thing. These findings from the
                measurement study shaped what the agent can see.
              </p>
              <MeasurementFindings measurement={measurement} />
            </div>
          ) : null}

          <aside className="limitations panel" aria-labelledby="limitations_heading">
            <h3 id="limitations_heading" className="results_heading">
              Limitations, plainly
            </h3>
            <ul>
              <li>
                <strong>Small scale.</strong> One single-node cluster on a laptop, one application, and a Wi-Fi link
                instead of a wired network.
              </li>
              <li>
                <strong>Few runs.</strong> Two training seeds for the warm agent, sharing the same warm-start data; one
                cold-start run of {training?.sac_per_cold_s0?.episode.length ?? ""} episodes; ten episodes per fault type.
              </li>
              <li>
                <strong>One fault never learned.</strong> CPU stress on currencyservice: the agent recovered{" "}
                {f2_currency_agent?.filter((row) => row.recovered).length ?? 0} of {f2_currency_agent?.length ?? 0} and took no
                action in any of them, in both seeds.
              </li>
              <li>
                <strong>Not better than the runbook.</strong> Non-inferior on recovery time, not superior, and the SLA
                penalty is a tie. We wrote the runbook knowing the fault classes, which favours it.
              </li>
              <li>
                <strong>Autoscaler faster on surges.</strong> {fault_meta.F4.name}s are where Kubernetes' own autoscaler
                beat the agent.
              </li>
              <li>
                <strong>Degraded link inconclusive.</strong> With the slowed link the medians barely moved, but with{" "}
                {results?.blocks.edge?.pooled.sac_per?.fault_episodes ?? ""} fault episodes per policy non-inferiority was
                not established.
              </li>
              <li>
                <strong>Untested pieces.</strong> No uniform-replay ablation, so no claim about prioritised replay
                itself. Neither policy used SCALE_UP on cartservice or currencyservice.
              </li>
              <li>
                <strong>Coarse timing.</strong> Recovery is measured in {config.tick_s} s ticks.
              </li>
            </ul>
            {agent_safety && context_main ? (
              <p className="limitations_safety">
                On safety, across {agent_safety.episodes} main-block episodes ({agent_safety.ticks} ticks) the agent had{" "}
                {agent_safety.mask_violations} mask violations and {agent_safety.exec_errors} execution errors, and its
                median decision took {context_main.decision_latency_median_s.toFixed(2)} s (p95{" "}
                {context_main.decision_latency_p95_s.toFixed(2)} s).
              </p>
            ) : null}
          </aside>
        </>
      ) : (
        <div className="replay_loading panel">Loading results</div>
      )}
    </SectionFrame>
  );
}

function PolicyLegend({ policies }: { policies: string[] }) {
  return (
    <ul className="chart_legend">
      {policies.map((policy) => (
        <li key={policy} style={{ ["--legend_color" as string]: policy_color(policy) }}>
          <span className="legend_dot" />
          {policy_label(policy)}
        </li>
      ))}
    </ul>
  );
}
