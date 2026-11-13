// Number formatting shared by every section, so the same value never
// appears with two different roundings on the page.

export function format_seconds(seconds: number | null | undefined, digits = 1): string {
  if (seconds === null || seconds === undefined) {
    return "n/a";
  }
  return `${seconds.toFixed(digits)} s`;
}

export function format_ms(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined) {
    return "n/a";
  }
  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }
  return `${Math.round(milliseconds)} ms`;
}

export function format_percent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) {
    return "n/a";
  }
  return `${(ratio * 100).toFixed(digits)} %`;
}

export function format_number(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return value.toFixed(digits);
}

// p-values follow the capstone's reporting: three significant figures, and
// scientific notation below 0.001.
export function format_p_value(p_value: number | null | undefined): string {
  if (p_value === null || p_value === undefined) {
    return "n/a";
  }
  if (p_value < 0.001) {
    const [mantissa, exponent] = p_value.toExponential(1).split("e");
    return `${mantissa}×10${superscript(Number(exponent))}`;
  }
  return p_value.toPrecision(2);
}

const superscript_digits: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function superscript(value: number): string {
  return String(value)
    .split("")
    .map((character) => superscript_digits[character] ?? character)
    .join("");
}

export function format_service(service_name: string | null): string {
  if (!service_name) {
    return "";
  }
  return service_name.replace("service", "");
}
