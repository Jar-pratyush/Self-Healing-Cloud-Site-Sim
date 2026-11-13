import "./control_loop.css";

type ControlLoopProps = {
  tick_s: number | null;
  observation_count: number | null;
  updates_per_tick: number | null;
};

function build_steps(observation_count: number | null, updates_per_tick: number | null) {
  return [
    {
      step_key: "observe",
      title: "Observe",
      plain: "Read the dashboard: response time, errors, traffic, and CPU, memory, copies and restarts for each service.",
      technical: `${observation_count ?? 36}-value state s_t in [−1, 1], built from Prometheus, the Kubernetes API, Locust and frontend logs.`,
    },
    {
      step_key: "decide",
      title: "Decide",
      plain: "Score the twelve possible moves, cross out the unsafe ones, and pick one. Often the best move is to do nothing.",
      technical: "a_t sampled from the masked categorical policy π(a | s_t); invalid actions get zero probability.",
    },
    {
      step_key: "act",
      title: "Act",
      plain: "Make one call to Kubernetes: restart, scale or restore a service. Only one repair can be in progress at a time.",
      technical: "Asynchronous dispatch through a least-privilege credential; global one-action lock until rollout completes.",
    },
    {
      step_key: "learn",
      title: "Learn",
      plain: "One tick later, see what happened and get a score: lose points while the shop is slow or failing, and a little for every action.",
      technical: `r_t = −(v_t+1 + c(a_t) + w·ρ_t+1), stored in a prioritised replay buffer; ${updates_per_tick ?? 4} gradient updates per tick.`,
    },
  ];
}

// The observe, decide, act, learn cycle. Each step lights up in turn; with
// reduced motion all steps stay lit and nothing moves.
export function ControlLoop({ tick_s, observation_count, updates_per_tick }: ControlLoopProps) {
  const loop_steps = build_steps(observation_count, updates_per_tick);
  return (
    <div className="control_loop">
      <div className="loop_clock" aria-hidden="true">
        <span className="loop_clock_label">tick</span>
        <span className="loop_clock_track">
          <span className="loop_clock_fill" />
        </span>
        <span className="loop_clock_label">{tick_s ?? 20} s</span>
      </div>
      <ol className="loop_steps">
        {loop_steps.map((step, step_index) => (
          <li key={step.step_key} className="loop_step" style={{ animationDelay: `${step_index * 2}s` }}>
            <span className="loop_step_index">0{step_index + 1}</span>
            <h3 className="loop_step_title">{step.title}</h3>
            <p className="loop_step_text only_plain">{step.plain}</p>
            <p className="loop_step_text only_technical">{step.technical}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
