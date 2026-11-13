import { SectionFrame } from "../components/section_frame";

export function DeepDiveSection() {
  return (
    <SectionFrame
      section_id="deep_dive"
      section_number={5}
      kicker="Technical deep dive"
      title="The method, in full."
      lede={
        <p>
          State, actions and reward; the learning algorithm; the settings it ran with; and how the evaluation was
          planned before any training began.
        </p>
      }
    />
  );
}
