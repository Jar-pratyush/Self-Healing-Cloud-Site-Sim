import { SectionFrame } from "../components/section_frame";

export function ReplaySection() {
  return (
    <SectionFrame
      section_id="replay"
      section_number={3}
      kicker="Recorded replay"
      title="One real incident, tick by tick."
      lede={
        <p>
          Everything below is replayed from the measurement log of a real episode on the cluster. Pick a different
          incident, or compare the agent with what Kubernetes does on its own.
        </p>
      }
    />
  );
}
