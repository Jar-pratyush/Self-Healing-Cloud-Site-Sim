// Renders the PNG icon set from public/favicon.svg.
// Run with: npm run make_icons
// The SVG is the single source; every PNG here is generated from it.
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root_dir = path.resolve(import.meta.dirname, "..");
const source_svg = path.join(root_dir, "public", "favicon.svg");
const icon_dir = path.join(root_dir, "public", "icons");

const icon_sizes = [
  { file_name: "icon_32.png", size: 32 },
  { file_name: "apple_touch_icon.png", size: 180 },
  { file_name: "icon_192.png", size: 192 },
  { file_name: "icon_512.png", size: 512 },
];

// Maskable icons need the artwork inside the central 80 % safe zone,
// so the mark is shrunk and centred on a full-bleed background.
const maskable_size = 512;
const maskable_inner = Math.round(maskable_size * 0.72);
const night_background = "#0B1016";

async function render_icons() {
  await mkdir(icon_dir, { recursive: true });
  const svg_buffer = await readFile(source_svg);

  for (const { file_name, size } of icon_sizes) {
    await sharp(svg_buffer, { density: 384 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(icon_dir, file_name));
  }

  const inner_png = await sharp(svg_buffer, { density: 384 })
    .resize(maskable_inner, maskable_inner)
    .png()
    .toBuffer();
  const offset = Math.round((maskable_size - maskable_inner) / 2);
  await sharp({
    create: { width: maskable_size, height: maskable_size, channels: 4, background: night_background },
  })
    .composite([{ input: inner_png, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(icon_dir, "icon_maskable_512.png"));

  console.log(`icons written to ${path.relative(root_dir, icon_dir)}`);
}

render_icons();
