import { SectionFrame } from "../components/section_frame";

export function ResultsSection() {
  return (
    <SectionFrame
      section_id="results"
      section_number={4}
      kicker="Results"
      title="How often it fixed things, and how fast."
      lede={
        <p>
          Every policy faced the same 50 scheduled incidents. The numbers here come straight from those episodes,
          including the cases where the agent lost.
        </p>
      }
    />
  );
}
