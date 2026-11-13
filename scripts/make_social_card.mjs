// Renders public/social_card.png, the 1200 x 630 preview shown when the site
// is shared. The trace on the card is the featured replay episode, read from
// public/data, so run this after export_data.
// Run with: npm run make_social_card
// Needs a Chromium for playwright-core: npx playwright-core install chromium
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root_dir = path.resolve(import.meta.dirname, "..");
const data_dir = path.join(root_dir, "public", "data");
const output_path = path.join(root_dir, "public", "social_card.png");
const card_width = 1200;
const card_height = 630;

const palette = {
  background: "#0b1016",
  panel: "#101821",
  line: "#243344",
  grid: "rgba(132, 170, 210, 0.07)",
  text: "#ece6da",
  muted: "#a3adb8",
  faint: "#838f9b",
  agent: "#2fbf8f",
  baseline: "#8e9aa7",
  fault: "#f05a3c",
};

async function font_face(family, file_path, weight) {
  const font_data = await readFile(path.join(root_dir, "node_modules", file_path));
  return `@font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${font_data.toString("base64")}) format("woff2"); font-weight: ${weight}; }`;
}

// Latency on a log scale from 10 ms to 10 s, ticks relative to the fault.
function trace_path(lane, chart, first_tick, last_tick) {
  const points = [];
  lane.ticks.latency_ms.forEach((latency_ms, tick_index) => {
    const relative_tick = tick_index - lane.injection_tick + 0.5;
    if (relative_tick < first_tick || relative_tick > last_tick) {
      return;
    }
    const x = chart.left + ((relative_tick - first_tick) / (last_tick - first_tick)) * chart.width;
    const clamped = Math.min(10000, Math.max(10, latency_ms));
    const y = chart.top + ((4 - Math.log10(clamped)) / 3) * chart.height;
    points.push([x, y]);
  });
  return points;
}

function to_path(points) {
  return points.map(([x, y], point_index) => `${point_index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
}

async function render_card() {
  const episode_index = JSON.parse(await readFile(path.join(data_dir, "episodes", "index.json"), "utf8"));
  const entry_name = `entry_${String(episode_index.featured_entry).padStart(2, "0")}.json`;
  const entry = JSON.parse(await readFile(path.join(data_dir, "episodes", entry_name), "utf8"));
  const agent_lane = entry.lanes.sac_per;
  const baseline_lane = entry.lanes.k8s_default;
  if (!agent_lane || !baseline_lane) {
    throw new Error(`${entry_name}: needs sac_per and k8s_default lanes`);
  }

  const chart = { left: 640, top: 150, width: 500, height: 300 };
  const first_tick = -4;
  const last_tick = 14;
  const agent_points = trace_path(agent_lane, chart, first_tick, last_tick);
  const baseline_points = trace_path(baseline_lane, chart, first_tick, last_tick);
  const fault_x = chart.left + ((0 - first_tick) / (last_tick - first_tick)) * chart.width;
  const sla_y = chart.top + ((4 - Math.log10(70)) / 3) * chart.height;
  const last_agent = agent_points[agent_points.length - 1] ?? [0, 0];
  const last_baseline = baseline_points[baseline_points.length - 1] ?? [0, 0];

  const fonts = [
    await font_face("Fraunces", "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2", "100 900"),
    await font_face("Plex Sans", "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", 400),
    await font_face("Plex Sans", "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2", 500),
    await font_face("Plex Mono", "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", 400),
  ].join("\n");
  const favicon = await readFile(path.join(root_dir, "public", "favicon.svg"), "utf8");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fonts}
* { margin: 0; box-sizing: border-box; }
body { width: ${card_width}px; height: ${card_height}px; background: ${palette.background}; color: ${palette.text}; font-family: "Plex Sans"; overflow: hidden;
  background-image: linear-gradient(${palette.grid} 1px, transparent 1px), linear-gradient(90deg, ${palette.grid} 1px, transparent 1px); background-size: 30px 30px; }
.text { position: absolute; left: 72px; top: 70px; width: 520px; }
.brand { display: flex; align-items: center; gap: 14px; font-family: "Plex Mono"; font-size: 17px; letter-spacing: 0.14em; text-transform: uppercase; color: ${palette.faint}; }
.brand svg { width: 44px; height: 44px; }
h1 { margin-top: 64px; font-family: "Fraunces"; font-weight: 600; font-size: 74px; line-height: 0.98; letter-spacing: -0.02em; font-variation-settings: "opsz" 144; }
p { margin-top: 30px; font-size: 25px; line-height: 1.4; color: ${palette.muted}; }
.foot { position: absolute; left: 72px; bottom: 56px; font-family: "Plex Mono"; font-size: 16px; color: ${palette.faint}; letter-spacing: 0.04em; }
svg.chart text { font-family: "Plex Mono"; font-size: 15px; }
</style></head><body>
<div class="text">
  <div class="brand">${favicon}<span>Reinforcement learning capstone</span></div>
  <h1>Self-Healing Cloud Infrastructure</h1>
  <p>An agent that learned to repair a live Kubernetes cluster, replayed from real recorded incidents.</p>
</div>
<div class="foot">K3s · Online Boutique · Chaos Mesh · discrete SAC</div>
<svg class="chart" width="${card_width}" height="${card_height}" style="position:absolute;left:0;top:0">
  <rect x="${chart.left - 24}" y="${chart.top - 46}" width="${chart.width + 48}" height="${chart.height + 110}" rx="18" fill="${palette.panel}" stroke="${palette.line}"/>
  <text x="${chart.left}" y="${chart.top - 16}" fill="${palette.faint}">p95 latency, one recorded incident</text>
  <line x1="${chart.left}" x2="${chart.left + chart.width}" y1="${sla_y}" y2="${sla_y}" stroke="${palette.faint}" stroke-dasharray="4 6"/>
  <text x="${chart.left + chart.width}" y="${sla_y - 8}" fill="${palette.faint}" text-anchor="end">SLA 70 ms</text>
  <rect x="${fault_x}" y="${chart.top}" width="${chart.left + chart.width - fault_x}" height="${chart.height}" fill="${palette.fault}" fill-opacity="0.07"/>
  <line x1="${fault_x}" x2="${fault_x}" y1="${chart.top}" y2="${chart.top + chart.height}" stroke="${palette.fault}" stroke-width="2"/>
  <text x="${fault_x - 10}" y="${chart.top + 18}" fill="${palette.fault}" text-anchor="end">fault</text>
  <path d="${to_path(baseline_points)}" fill="none" stroke="${palette.baseline}" stroke-width="3" stroke-dasharray="8 7" stroke-linejoin="round"/>
  <path d="${to_path(agent_points)}" fill="none" stroke="${palette.agent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${last_agent[0]}" cy="${last_agent[1]}" r="6" fill="${palette.agent}"/>
  <text x="${last_agent[0] + 14}" y="${last_agent[1] + 5}" fill="${palette.agent}">RL agent: recovered</text>
  <text x="${last_baseline[0]}" y="${last_baseline[1] - 14}" fill="${palette.baseline}" text-anchor="end">Kubernetes alone</text>
  <text x="${chart.left}" y="${chart.top + chart.height + 40}" fill="${palette.faint}">${entry.fault} · ${entry.target ?? ""} · ${entry.severity ?? ""}</text>
</svg>
</body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: card_width, height: card_height } });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate("document.fonts.ready");
  await page.screenshot({ path: output_path, type: "png" });
  await browser.close();
  console.log(`wrote ${path.relative(root_dir, output_path)}`);
}

render_card();
