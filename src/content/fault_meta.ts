import type { FaultCode } from "../data/data_types";

// How each injected fault is explained on the page. The injection methods and
// the matching repair follow the capstone README's fault table.

export type FaultMeta = {
  code: FaultCode;
  name: string;
  plain_story: string;
  injection: string;
  correct_repair: string;
};

export const fault_meta: Record<FaultCode, FaultMeta> = {
  F1: {
    code: "F1",
    name: "Bad deploy",
    plain_story: "A new version of the product catalogue ships with a built-in delay. Every page that lists products slows down.",
    injection: "EXTRA_LATENCY added to productcatalogservice through the Kubernetes API",
    correct_repair: "RESTORE productcatalogservice to its known-good template",
  },
  F2: {
    code: "F2",
    name: "Hot pod",
    plain_story: "Something inside the cart or currency service starts burning CPU. It is still up, but it crawls.",
    injection: "Chaos Mesh StressChaos (1 or 2 CPU workers) on cartservice or currencyservice",
    correct_repair: "RESTART the stressed service",
  },
  F3: {
    code: "F3",
    name: "Scaled to zero",
    plain_story: "The cart or currency service is switched off entirely. Checkout and prices simply fail.",
    injection: "cartservice or currencyservice set to 0 replicas through the Kubernetes API",
    correct_repair: "RESTORE the service (or SCALE_UP it)",
  },
  F4: {
    code: "F4",
    name: "Traffic surge",
    plain_story: "Two and a half to three times the usual shoppers arrive at once, and the front door gets congested.",
    injection: "Locust load multiplied by 2.5 or 3.0",
    correct_repair: "SCALE_UP frontend",
  },
  NULL: {
    code: "NULL",
    name: "No fault",
    plain_story: "Nothing is broken. The right move is to do nothing at all.",
    injection: "None (fault-free control episode)",
    correct_repair: "NOOP",
  },
};

export const fault_codes: FaultCode[] = ["F1", "F2", "F3", "F4", "NULL"];

// Severity as recorded: F1 extra latency, F2 CPU workers, F4 load multiplier.
export function severity_label(fault: FaultCode, severity: string | number | null): string | null {
  if (severity === null || severity === undefined) {
    return null;
  }
  if (fault === "F1") {
    return `+${severity} latency`;
  }
  if (fault === "F2") {
    return `${severity} CPU worker${Number(severity) === 1 ? "" : "s"}`;
  }
  if (fault === "F4") {
    return `${severity}× load`;
  }
  return String(severity);
}
