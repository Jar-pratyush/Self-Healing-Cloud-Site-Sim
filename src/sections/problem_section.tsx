import { SectionFrame } from "../components/section_frame";

export function ProblemSection() {
  return (
    <SectionFrame
      section_id="problem"
      section_number={1}
      kicker="The problem"
      title="Things break at 3 a.m. Someone has to notice, and fix them."
      lede={
        <p>
          Modern apps are dozens of small services talking to each other. When one slows down, crashes or disappears,
          the whole shop feels it. Today a human on call usually reads the alarms and decides what to do.
        </p>
      }
    />
  );
}
