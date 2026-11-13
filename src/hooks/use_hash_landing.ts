import { useEffect } from "react";

// How long to keep a deep-linked section in place while data and charts are
// still settling the page layout.
const settle_window_ms = 4000;

// The page renders after the browser has already tried to jump to the URL's
// #section, so that jump lands nowhere. This scrolls to the section once it
// exists and keeps it in place as content above it loads, until the visitor
// scrolls on their own or the layout has had time to settle.
export function useHashLanding() {
  useEffect(() => {
    const target_id = decodeURIComponent(window.location.hash.slice(1));
    if (!target_id) {
      return;
    }
    let is_done = false;
    const land = () => {
      if (!is_done) {
        document.getElementById(target_id)?.scrollIntoView({ behavior: "auto", block: "start" });
      }
    };
    const stop = () => {
      is_done = true;
    };
    const resize_watch = new ResizeObserver(land);
    resize_watch.observe(document.body);
    const user_events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    user_events.forEach((event_name) => window.addEventListener(event_name, stop, { passive: true, once: true }));
    const stop_timer = window.setTimeout(stop, settle_window_ms);
    land();
    return () => {
      stop();
      resize_watch.disconnect();
      window.clearTimeout(stop_timer);
      user_events.forEach((event_name) => window.removeEventListener(event_name, stop));
    };
  }, []);
}
