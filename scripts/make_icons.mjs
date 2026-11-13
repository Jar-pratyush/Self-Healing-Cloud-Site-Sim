// Renders the PNG icon set and public/favicon.ico from public/favicon.svg.
// Run with: npm run make_icons
// The SVG is the single source; every PNG and the ICO are generated from it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const night_background = "#0C0A1D";

// Sizes packed into favicon.ico for browsers and tools that ask for /favicon.ico.
const ico_sizes = [16, 32, 48];

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

  const ico_images = [];
  for (const size of ico_sizes) {
    ico_images.push({ size, png: await sharp(svg_buffer, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer() });
  }
  await writeFile(path.join(root_dir, "public", "favicon.ico"), pack_ico(ico_images));

  console.log(`icons written to ${path.relative(root_dir, icon_dir)} and public/favicon.ico`);
}

// An ICO file is a 6-byte header, one 16-byte directory entry per image,
// then the images. Modern ICO readers accept PNG data as the image payload.
function pack_ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

render_icons();
