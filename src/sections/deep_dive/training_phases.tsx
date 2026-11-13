import type { SiteConfig, TrainingRun } from "../../data/data_types";

type TrainingPhasesProps = {
  config: SiteConfig;
  training: Record<string, TrainingRun>;
};

function episode_count(training: Record<string, TrainingRun>, run_name: string): number {
  return training[run_name]?.episode.length ?? 0;
}

// The three ways the agent's networks were trained, as a row of stages,
// followed by the update rules that every online step applies.
export function TrainingPhases({ config, training }: TrainingPhasesProps) {
  const warm_episodes = episode_count(training, "sac_per_s0");
  const seed_one_episodes = episode_count(training, "sac_per_s1");
  const cold_episodes = episode_count(training, "sac_per_cold_s0");
  const updates_per_tick = config.rl.updates_per_tick;
  const n_step = config.rl.n_step;

  return (
    <>
      <ol className="phase_track">
        <li className="phase_card is_data">
          <span className="phase_step mono">data</span>
          <h4 className="phase_title">Runbook demonstrations</h4>
          <p>
            {config.runbook.warmstart_episodes} episodes of the scripted runbook on the live cluster, with a random
            valid action instead of the runbook's choice {Math.round((config.runbook.warmstart_epsilon ?? 0) * 100)} %
            of the time so the data also shows what other actions do.
          </p>
        </li>
        <li className="phase_card is_offline">
          <span className="phase_step mono">offline</span>
          <h4 className="phase_title">Warm start</h4>
          <p>
            {config.rl.offline_warmstart_steps} gradient steps on that data, no cluster time. The actor is trained by
            behaviour cloning; the critics by the SAC loss plus a CQL penalty (weight {config.rl.offline_cql_weight})
            that stops them overrating actions the data rarely shows.
          </p>
          <span className="phase_ref mono">Amendment 5</span>
        </li>
        <li className="phase_card is_online">
          <span className="phase_step mono">online</span>
          <h4 className="phase_title">Learning on the cluster</h4>
          <p>
            {warm_episodes} training episodes per seed ({seed_one_episodes ? `seeds 0 and 1` : "seed 0"}),{" "}
            {updates_per_tick} gradient updates every tick. The CQL penalty stays on and the temperature is held at
            α = {config.rl.alpha_init}; with α learned, the agent drifted into acting on healthy states.
          </p>
          <span className="phase_ref mono">Amendments 6 and 8</span>
        </li>
        <li className="phase_card is_cold">
          <span className="phase_step mono">ablation</span>
          <h4 className="phase_title">Cold start</h4>
          <p>
            Same online update with no warm start, for {cold_episodes} episodes, half the warm-start budget because
            of cluster time. It tests whether the runbook data helps.
          </p>
          <span className="phase_ref mono">Amendment 7</span>
        </li>
      </ol>

      <h4 className="method_subtitle">One online update</h4>
      <div className="formula_block mono" role="region" aria-label="Update rules" tabIndex={0}>
        <p>π(a|s) = softmax over valid actions only; masked actions get probability 0</p>
        <p>
          y = Σ<sub>i&lt;{n_step}</sub> γ<sup>i</sup>r<sub>t+i</sub> + γ<sup>{n_step}</sup>(1 − done) · Σ<sub>a valid</sub> π(a|s′)[min Q̄(s′, a) − α log π(a|s′)]
        </p>
        <p>
          L_Q = Σ<sub>j=1,2</sub> [ w · (Q<sub>j</sub>(s, a) − y)² + {config.rl.offline_cql_weight} · (logsumexp<sub>a′ valid</sub> Q<sub>j</sub>(s, a′) − Q<sub>j</sub>(s, a)) ]
        </p>
        <p>L_π = Σ<sub>a valid</sub> π(a|s) · (α log π(a|s) − min Q(s, a))</p>
        <p className="formula_main">
          priority p = min(½(|δ₁| + |δ₂|), {config.per.priority_cap}) + {config.per.eps}, sampled ∝ p<sup>{config.per.alpha}</sup>
        </p>
      </div>
      <p>
        Two critics and slow-moving target copies (τ = {config.rl.tau}) keep the value estimates from running away.
        Transitions with a large TD error δ are replayed more often; the importance weight w, annealed from β ={" "}
        {config.per.beta_start} to {config.per.beta_end}, corrects the critic for that bias. A gradient step with a non-finite loss
        is never applied.
      </p>
    </>
  );
}
