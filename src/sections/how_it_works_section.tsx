import { DeepPanel } from "../components/deep_panel";
import { SectionFrame } from "../components/section_frame";
import type { SiteConfig } from "../data/data_types";
import { useSiteData } from "../data/use_site_data";
import { ArchitectureDiagram } from "./architecture_diagram";
import { ControlLoop } from "./control_loop";
import "./how_it_works_section.css";

export function HowItWorksSection() {
  const { data: config } = useSiteData<SiteConfig>("config.json");

  return (
    <SectionFrame
      section_id="how_it_works"
      section_number={2}
      kicker="How it works"
      title="Watch, decide, act. Every 20 seconds."
      lede={
        <>
          <p>
            Two machines. One runs a real online shop on Kubernetes, and we break it on purpose. The other runs the
            agent, which watches the shop and repairs it over a Wi-Fi link.
          </p>
          <p className="only_plain">
            Nothing here is a simulation. Every fault was really injected, every repair really executed, and every
            measurement really taken. That is slower and messier than a simulator, which is the point.
          </p>
        </>
      }
    >
      <figure className="figure_block">
        <ArchitectureDiagram />
        <figcaption className="figure_caption">
          <strong>Fig. 1</strong>
          The testbed. Shopper traffic, faults and repairs all go through the real cluster; the agent sees only what
          the telemetry reports.
        </figcaption>
      </figure>

      <figure className="figure_block">
        <ControlLoop
          tick_s={config?.tick_s ?? null}
          observation_count={config?.observation_names.length ?? null}
          updates_per_tick={typeof config?.rl.updates_per_tick === "number" ? config.rl.updates_per_tick : null}
        />
        <figcaption className="figure_caption">
          <strong>Fig. 2</strong>
          One tick of the control loop. The animation is compressed; on the cluster each lap took {config?.tick_s ?? 20}{" "}
          seconds.
        </figcaption>
      </figure>

      {config ? (
        <>
          <DeepPanel title="The tick protocol">
            <p>
              A fixed {config.tick_s} s clock runs on the controller (Machine B), which is also the timestamp authority
              for every measurement. At each boundary the environment collects Prometheus, the Kubernetes API, the
              Locust tick endpoint and the frontend's own request logs in parallel under a {config.collect_deadline_s}{" "}
              s deadline. Missing values are imputed by fixed rules; a tick with stale telemetry is flagged, and a stale
              next state is never stored for training.
            </p>
            <p>
              The policy then picks an action, which is dispatched asynchronously. A global lock keeps at most one
              action in flight until its rollout completes, and the executor re-checks replica bounds before every
              call. Load is {config.calibration.users} Locust users (about {config.calibration.requests_per_s}{" "}
              requests/s), with one TCP connection per request.
            </p>
          </DeepPanel>

          <DeepPanel title={`The ${config.observation_names.length} numbers the agent sees`}>
            <p>
              Five global signals, {config.observation_names.filter((name) => name.includes(".")).length / config.managed_services.length}{" "}
              per managed service, and three about the controller itself. Every value is normalised to the range −1 to
              1.
            </p>
            <ObservationTable config={config} />
          </DeepPanel>

          <DeepPanel title={`The ${config.actions.length} actions and their guards`}>
            <ActionTable config={config} />
            <p className="table_note">
              An action mask removes any action that would break a replica limit or the current state. The agent's
              Kubernetes credential is limited to one namespace, cannot delete pods, and the executor only accepts the
              four managed deployments.
            </p>
          </DeepPanel>
        </>
      ) : null}
    </SectionFrame>
  );
}

function ObservationTable({ config }: { config: SiteConfig }) {
  const global_names = config.observation_names.filter((name) => !name.includes(".")).slice(0, 5);
  const controller_names = config.observation_names.slice(-3);
  const service_features = config.observation_names
    .filter((name) => name.startsWith(`${config.managed_services[0]}.`))
    .map((name) => name.split(".")[1] ?? name);

  return (
    <div className="observation_groups">
      <div>
        <p className="observation_group_title">Global</p>
        <ul className="token_list">
          {global_names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="observation_group_title">Per service ({config.managed_services.join(", ")})</p>
        <ul className="token_list">
          {service_features.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="observation_group_title">Controller</p>
        <ul className="token_list">
          {controller_names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ActionTable({ config }: { config: SiteConfig }) {
  return (
    <div className="table_scroll">
      <table className="data_table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Action</th>
            <th scope="col">Cost in reward</th>
            <th scope="col">Replica limit</th>
          </tr>
        </thead>
        <tbody>
          {config.actions.map((action) => (
            <tr key={action.id}>
              <td className="mono">{action.id}</td>
              <td>
                <code>{action.name}</code>
              </td>
              <td className="mono">{config.reward.action_cost[action.kind]}</td>
              <td className="mono">
                {action.kind === "SCALE" && action.target
                  ? `${config.replicas.base[action.target]} to ${config.replicas.max[action.target]}`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
