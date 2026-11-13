import { useEffect, useRef, useState } from "react";

// Measures an element's width so SVG charts can be drawn at real pixel size
// (text and strokes then never stretch on narrow screens).
export function useElementWidth<T extends HTMLElement>(fallback_width = 600) {
  const element_ref = useRef<T | null>(null);
  const [width, set_width] = useState(fallback_width);

  useEffect(() => {
    const element = element_ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) {
        set_width(Math.round(measured));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { element_ref, width };
}
