import type { ReactNode } from "react";
import { DeepPanel } from "../../components/deep_panel";
import { SectionFrame } from "../../components/section_frame";
import type { SiteConfig, TrainingRun } from "../../data/data_types";
import { useSiteData } from "../../data/use_site_data";
import { ActionCatalogTable, EpisodeTable, ObservationTable } from "./decision_tables";
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

export function DeepDiveSection() {
  const { data: config } = useSiteData<SiteConfig>("config.json");
  const { data: training } = useSiteData<Record<string, TrainingRun>>("training.json");

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
              <div className="formula_block mono" aria-label="Reward function">
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
        </div>
      ) : null}
    </SectionFrame>
  );
}
