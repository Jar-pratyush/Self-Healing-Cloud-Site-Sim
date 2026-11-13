import type { ReactNode } from "react";
import "./section_frame.css";

type SectionFrameProps = {
  section_id: string;
  section_number: number;
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
};

// Shared shell for every numbered section: paper-style number, kicker,
// display title and an optional lede paragraph.
export function SectionFrame({ section_id, section_number, kicker, title, lede, children }: SectionFrameProps) {
  const heading_id = `${section_id}_heading`;
  return (
    <section id={section_id} className="section_frame" aria-labelledby={heading_id}>
      <div className="page_width">
        <header className="section_head">
          <p className="section_kicker">
            <span className="section_number">§{section_number}</span>
            <span className="section_rule" aria-hidden="true" />
            <span>{kicker}</span>
          </p>
          <h2 id={heading_id} className="section_title">
            {title}
          </h2>
          {lede ? <div className="section_lede prose">{lede}</div> : null}
        </header>
        {children}
      </div>
    </section>
  );
}
