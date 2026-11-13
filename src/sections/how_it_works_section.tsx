import { SectionFrame } from "../components/section_frame";

export function HowItWorksSection() {
  return (
    <SectionFrame
      section_id="how_it_works"
      section_number={2}
      kicker="How it works"
      title="Watch, decide, act. Every 20 seconds."
      lede={
        <p>
          Two machines: one runs the shop on Kubernetes and breaks it on purpose, the other runs the agent that watches
          and repairs it.
        </p>
      }
    />
  );
}
