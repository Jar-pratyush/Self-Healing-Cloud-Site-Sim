import type { ReactNode } from "react";
import { DeepPanel } from "../../components/deep_panel";
import { SectionFrame } from "../../components/section_frame";
import type { ResultsData, SafetyTotals, SiteConfig, TestRow, TrainingInternals, TrainingRun } from "../../data/data_types";
import { useSiteData } from "../../data/use_site_data";
import { ActionCatalogTable, EpisodeTable, ObservationTable } from "./decision_tables";
import { HypothesisTests } from "./hypothesis_tests";
import { InternalsCharts } from "./internals_charts";
import { RewardExplorer } from "./reward_explorer";
import { max_surplus_replicas } from "./reward_model";
import { HyperparameterTables, RunbookRules, TestbedTable } from "./settings_tables";
import { TrainingPhases } from "./training_phases";
import "./deep_dive_section.css";

type MethodBlockProps = {
  block_number: string;
  title: string;
  summary: ReactNode;
  children: ReactNode;
};

// One numbered part of the method: a short summary everyone sees, with the
// full detail in a technical panel underneath.
function MethodBlock({ block_number, title, summary, children }: MethodBlockProps) {
  return (
    <article className="method_block">
      <header className="method_head">
        <span className="method_number mono">{block_number}</span>
        <h3 className="method_title">{title}</h3>
      </header>
      <div className="method_summary prose">{summary}</div>
      {children}
    </article>
  );
}

function summarise_entropy(internals: Record<string, TrainingInternals> | null) {
  const warm_values = ["sac_per_s0", "sac_per_s1"].flatMap((run_name) => internals?.[run_name]?.entropy ?? []).filter((value): value is number => value !== null);
  const cold_first = internals?.sac_per_cold_s0?.entropy.find((value): value is number => value !== null);
  if (!warm_values.length || cold_first === undefined) {
    return null;
  }
  return { warm_max: Math.max(...warm_values), cold_first };
}

export function DeepDiveSection() {
  const { data: config } = useSiteData<SiteConfig>("config.json");
  const { data: training } = useSiteData<Record<string, TrainingRun>>("training.json");
  const { data: tests } = useSiteData<TestRow[]>("tests.json");
  const { data: results } = useSiteData<ResultsData>("results.json");
  const { data: internals } = useSiteData<Record<string, TrainingInternals>>("training_internals.json");
  const entropy_summary = summarise_entropy(internals);
  const { data: safety } = useSiteData<Record<string, Record<string, SafetyTotals>>>("safety.json");

  return (
    <SectionFrame
      section_id="deep_dive"
      section_number={5}
      kicker="Technical deep dive"
      title="The method, in full."
      lede={
        <p>
          State, actions and reward; the learning algorithm; the settings it ran with; and how the evaluation was
          planned before any training began. Every number below is read from the project's locked configuration.
        </p>
      }
    >
      {config ? (
        <div className="method_list">
          <MethodBlock
            block_number="5.1"
            title="The decision problem"
            summary={
              <p>
                Every {config.tick_s} seconds the agent reads {config.observation_names.length} numbers about the
                shop and picks one of {config.actions.length} actions. Actions that make no sense right now, like
                scaling a service past its limit, are masked out before it chooses.
              </p>
            }
          >
            <DeepPanel title="Observation, actions and episodes">
              <h4 className="method_subtitle">Observation ({config.observation_names.length} features, each in [0, 1] or [−1, 1])</h4>
              <ObservationTable config={config} />
              <h4 className="method_subtitle">Actions and masks</h4>
              <p>
                While an earlier action is still rolling out, only <code>NOOP</code> is allowed. The masks come from
                the replica counts alone, so they never reveal which fault is active.
              </p>
              <ActionCatalogTable config={config} />
              <h4 className="method_subtitle">Episodes</h4>
              <EpisodeTable config={config} />
            </DeepPanel>
          </MethodBlock>

          <MethodBlock
            block_number="5.2"
            title="The reward"
            summary={
              <p>
                The agent is penalised for every tick the shop breaks its service level, a little for each action
                it takes, and a little for every extra replica it keeps running. There is no bonus for fixing
                things fast; speed comes from wanting the penalty to stop.
              </p>
            }
          >
            <DeepPanel title="Reward function and a live calculator">
              <div className="formula_block mono" role="region" aria-label="Reward function" tabIndex={0}>
                <p>ℓ = clip(log₂(Lat / {config.sla.latency_ms} ms) / {config.reward.latency_log2_span}, 0, 1)</p>
                <p>
                  e = clip((F − {config.sla.error_ratio}) / ({config.sla.error_ratio_max} − {config.sla.error_ratio}), 0, 1)
                </p>
                <p>v = clip(ℓ + e, 0, 1)</p>
                <p>ρ = Σ max(0, replicas − baseline) / {config.reward.replica_denominator}</p>
                <p className="formula_main">
                  r = −( v + c(a) + {config.reward.w_replica}·ρ )
                </p>
              </div>
              <p>
                Lat is the frontend's own p{Math.round(config.sla.latency_quantile * 100)} latency and F the share of
                failed requests, both measured over the tick after the action. The cost c(a) is charged for the
                action that actually ran; a dispatch that fails is charged as <code>NOOP</code>. Latency saturates
                at {2 ** config.reward.latency_log2_span}× the SLA, so one step costs at most{" "}
                {(
                  1 +
                  Math.max(...Object.values(config.reward.action_cost)) +
                  config.reward.w_replica * (max_surplus_replicas(config) / config.reward.replica_denominator)
                ).toFixed(2)}
                .
              </p>
              <RewardExplorer config={config} />
            </DeepPanel>
          </MethodBlock>

          <MethodBlock
            block_number="5.3"
            title="The learning algorithm"
            summary={
              <p>
                The agent is a soft actor-critic adapted to a short list of discrete actions. Before it touched the
                cluster it studied recordings of the runbook at work, so it started out cautious instead of random,
                then kept learning on the live cluster.
              </p>
            }
          >
            <DeepPanel title="Masked discrete SAC with prioritised replay">
              {training ? <TrainingPhases config={config} training={training} /> : null}
            </DeepPanel>
          </MethodBlock>

          <MethodBlock
            block_number="5.4"
            title="Settings and baselines"
            summary={
              <p>
                Every setting was fixed in a contract file before training and never tuned on evaluation results.
                The runbook the agent is compared with is a plain list of if-then rules, written the way an on-call
                engineer would write them.
              </p>
            }
          >
            <DeepPanel title="Hyperparameters, runbook rules and the testbed">
              <h4 className="method_subtitle">Hyperparameters</h4>
              <HyperparameterTables config={config} />
              <h4 className="method_subtitle">Scripted runbook, checked in order every tick</h4>
              <p>
                It reads the same observation as the agent and never sees which fault was injected. "Unhealthy"
                means the SLA was broken on the tick.
              </p>
              <RunbookRules config={config} />
              <h4 className="method_subtitle">Testbed</h4>
              <TestbedTable config={config} />
            </DeepPanel>
          </MethodBlock>

          <MethodBlock
            block_number="5.5"
            title="The evaluation plan"
            summary={
              <p>
                The hypotheses, the tests and the pass marks were written down and dated before any training run.
                Every later change was logged as a dated amendment with its reason. Where a test came out against
                the agent, it is reported as it came out.
              </p>
            }
          >
            <DeepPanel title="Hypotheses and statistical tests">
              <ul className="method_points">
                <li>
                  All five policies ran the same {results?.blocks.main?.entries ?? ""}-incident schedule, interleaved
                  entry by entry, so time-of-day drift hits every policy alike.
                </li>
                <li>
                  Each comparison is a two-sided Mann–Whitney U test, Holm-corrected within its family, with Cliff's
                  δ as the effect size (positive: the first policy's values are lower).
                </li>
                <li>
                  The {Math.round(config.statistics.ci_level * 100)} % interval on the difference of medians comes from{" "}
                  {config.statistics.bootstrap_resamples.toLocaleString("en")} bootstrap resamples. "No worse than the
                  runbook" means its upper bound stays under {config.statistics.non_inferiority_margin_s} s, one tick.
                </li>
                <li>
                  Unrecovered episodes count at the {config.episode.censor_s} s cap; survival curves (Fig. 5) treat
                  them as censored instead.
                </li>
                <li>
                  H5 reruns part of the schedule with the control link degraded by netem:{" "}
                  {[config.edge_link.delay && `${config.edge_link.delay} delay`, config.edge_link.jitter && config.edge_link.jitter !== "0ms" && `${config.edge_link.jitter} jitter`, config.edge_link.loss && `${config.edge_link.loss} loss`].filter(Boolean).join(", ")}.
                </li>
              </ul>
              {tests && results && safety && training ? (
                <HypothesisTests config={config} tests={tests} results={results} safety={safety} training={training} />
              ) : null}
            </DeepPanel>
          </MethodBlock>

          <MethodBlock
            block_number="5.6"
            title="Inside the learner"
            summary={
              <p>
                What the networks were doing while the agent trained: how wrong the critics were, how much value
                they expected, and how decided the policy was. These are diagnostics, not results.
              </p>
            }
          >
            <DeepPanel title="Training diagnostics per episode">
              {internals ? <InternalsCharts internals={internals} /> : null}
              <p className="chart_note">
                Each point is the mean over that episode's gradient updates.
                {entropy_summary
                  ? ` With α held at ${config.rl.alpha_init}, the warm-started policy never exceeds ${entropy_summary.warm_max.toFixed(2)} nats of entropy, against ${Math.log(config.actions.length).toFixed(2)} for a uniform choice over all ${config.actions.length} actions: it refines the runbook's habits rather than exploring. The cold start begins at ${entropy_summary.cold_first.toFixed(2)} nats and collapses too, while its critics settle on far lower values.`
                  : null}
              </p>
            </DeepPanel>
          </MethodBlock>
        </div>
      ) : null}
    </SectionFrame>
  );
}
