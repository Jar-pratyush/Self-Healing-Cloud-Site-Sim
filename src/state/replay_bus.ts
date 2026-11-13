import { useEffect } from "react";

// Lets any chart open a specific incident in the replay section.
const open_replay_event = "open_replay_entry";

export function open_replay(entry_index: number): void {
  window.dispatchEvent(new CustomEvent<number>(open_replay_event, { detail: entry_index }));
  document.getElementById("replay")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function useOpenReplayListener(on_open: (entry_index: number) => void): void {
  useEffect(() => {
    const handle_event = (event: Event) => {
      const entry_index = (event as CustomEvent<number>).detail;
      if (Number.isInteger(entry_index)) {
        on_open(entry_index);
      }
    };
    window.addEventListener(open_replay_event, handle_event);
    return () => window.removeEventListener(open_replay_event, handle_event);
  }, [on_open]);
}
