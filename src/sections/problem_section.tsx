import { DeepPanel } from "../components/deep_panel";
import { SectionFrame } from "../components/section_frame";
import { StatTile } from "../components/stat_tile";
import { fault_codes, fault_meta } from "../content/fault_meta";
import { format_seconds } from "../content/format_values";
import type { ResultsData, SiteConfig } from "../data/data_types";
import { useSiteData } from "../data/use_site_data";
import "./problem_section.css";

export function ProblemSection() {
  const { data: results } = useSiteData<ResultsData>("results.json");
  const { data: config } = useSiteData<SiteConfig>("config.json");

  const main_block = results?.blocks.main;
  const agent = main_block?.pooled.sac_per;
  const runbook = main_block?.pooled.runbook;
  const kubernetes = main_block?.pooled.k8s_default;
  const autoscaler = main_block?.pooled.k8s_hpa;
  const censor_s = config?.episode.censor_s;

  return (
    <SectionFrame
      section_id="problem"
      section_number={1}
      kicker="The problem"
      title="Things break at 3 a.m. Someone has to notice, and fix them."
      lede={
        <>
          <p>
            Modern apps are dozens of small services talking to each other. When one slows down, crashes or
            disappears, the whole shop feels it. Today a person on call reads the alarms and decides what to do.
          </p>
          <p className="only_plain">
            We asked a different question: can a program learn that job by doing it? Think of a night-shift engineer
            who glances at the dashboard every 20 seconds and, when something looks wrong, does one thing about it,
            then waits to see if it helped. Ours had to learn which thing to do from experience.
          </p>
          <p className="only_technical">
            We train a masked discrete Soft Actor-Critic agent online, on the live cluster it repairs, to choose one of
            twelve remediation actions per 20 s tick from telemetry alone, with no fault label as input, and compare it
            with three baselines under a pre-registered protocol.
          </p>
        </>
      }
    >
      {main_block && agent && runbook && kubernetes && autoscaler ? (
        <div className="headline_grid" aria-label="Headline results from the main evaluation">
          <StatTile
            value={`${agent.recovered}/${agent.fault_episodes}`}
            label="faults repaired by the agent"
            comparison={
              <>
                Hand-written runbook: {runbook.recovered}/{runbook.fault_episodes}. Kubernetes alone:{" "}
                {kubernetes.recovered}/{kubernetes.fault_episodes}. With its autoscaler: {autoscaler.recovered}/
                {autoscaler.fault_episodes}.
              </>
            }
          />
          <StatTile
            value={agent.mttr_median_censored_s?.toFixed(1)}
            unit="s"
            label="median time to recovery"
            comparison={
              <>
                Runbook: {format_seconds(runbook.mttr_median_censored_s)}. Kubernetes alone did not recover any fault
                within the {censor_s} s window.
              </>
            }
          />
          <StatTile
            value={`${agent.null_with_action}/${agent.null_episodes}`}
            label="fault-free episodes where the agent acted anyway"
            tone="neutral"
            comparison={
              agent.null_with_action === 0 ? (
                <>When nothing was broken, it left the system alone every time.</>
              ) : (
                <>Acting when nothing is broken counts as a false alarm.</>
              )
            }
          />
        </div>
      ) : (
        <div className="headline_grid headline_grid_loading" aria-hidden="true" />
      )}
      {main_block && agent ? (
        <p className="source_note headline_source">
          Main evaluation: {main_block.entries} scheduled incidents per policy ({agent.fault_episodes} faults,{" "}
          {agent.null_episodes} fault-free). Source: paper_a/figure_data/episodes_main.csv
        </p>
      ) : null}

      <h3 className="fault_heading">What we broke, on purpose</h3>
      <div className="fault_grid">
        {fault_codes.map((code) => {
          const fault = fault_meta[code];
          return (
            <article key={code} className={code === "NULL" ? "fault_card fault_card_null" : "fault_card"}>
              <p className="fault_code">{code === "NULL" ? "Control" : code}</p>
              <h4 className="fault_name">{fault.name}</h4>
              <p className="fault_story">{fault.plain_story}</p>
              <dl className="fault_facts only_technical">
                <dt>Injected by</dt>
                <dd>{fault.injection}</dd>
                <dt>Correct repair</dt>
                <dd>
                  <code>{fault.correct_repair}</code>
                </dd>
              </dl>
            </article>
          );
        })}
      </div>

      {config ? (
        <DeepPanel title="What counts as broken, and what counts as fixed">
          <p>
            <strong>Healthy tick.</strong> Server-side p{Math.round(config.sla.latency_quantile * 100)} latency of the
            frontend at or below {config.sla.latency_ms} ms, and at most {config.sla.error_ratio * 100} % failed
            requests, measured over one {config.tick_s} s tick.
          </p>
          <p>
            <strong>Recovered.</strong> {config.sla.recovery_ticks} consecutive healthy ticks after the injection,
            with the fault's own cure condition met (for example, the bad deploy actually rolled back). Time to recovery
            (MTTR) runs from the injection to the start of that healthy run, so it moves in {config.tick_s} s steps.
          </p>
          <p>
            <strong>Not recovered.</strong> An episode that is still unhealthy after {config.episode.fault_max_ticks}{" "}
            ticks is stopped and counted as {config.episode.censor_s} s. Medians therefore include failures instead of
            hiding them.
          </p>
          <p>
            <strong>Blind agent.</strong> The agent is never told which fault was injected, where, how strong it is, or
            when. It sees only the telemetry.
          </p>
        </DeepPanel>
      ) : null}
    </SectionFrame>
  );
}
