import type { ReactNode } from "react";

type TableScrollProps = {
  label: string;
  children: ReactNode;
};

// A wide table that scrolls sideways on narrow screens. The scroll area is a
// labelled, focusable region so keyboard users can reach and scroll it too.
export function TableScroll({ label, children }: TableScrollProps) {
  return (
    <div className="table_scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
