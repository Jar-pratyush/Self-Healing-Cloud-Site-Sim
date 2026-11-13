import { useSyncExternalStore } from "react";

const motion_query = "(prefers-reduced-motion: reduce)";

function subscribe(on_change: () => void): () => void {
  const media_list = window.matchMedia(motion_query);
  media_list.addEventListener("change", on_change);
  return () => media_list.removeEventListener("change", on_change);
}

function read_snapshot(): boolean {
  return window.matchMedia(motion_query).matches;
}

// True when the visitor asked the system for less motion. Scroll-linked
// animation and autoplay are switched off whenever this is true.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, read_snapshot, () => false);
}
