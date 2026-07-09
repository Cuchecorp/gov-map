/**
 * generate-brand-assets.mjs
 *
 * Generates all brand static assets from the master SVG geometry (60-SELECTION.md).
 * Run from repo root: node scripts/generate-brand-assets.mjs
 *
 * Outputs:
 *   app/app/favicon.ico              — multi-res 16/32/48 ICO
 *   app/app/apple-icon.png           — 180×180 PNG, cream bg
 *   app/app/opengraph-image.png      — 1200×630 PNG, cream bg + icon + text
 *   app/public/icon-192.png          — 192×192 PNG, cream bg (manifest)
 *   app/public/icon-512.png          — 512×512 PNG, cream bg (manifest)
 *
 * Dependencies (devDep in app/): sharp
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(REPO_ROOT, "app");
const OUT_APP = path.join(APP_DIR, "app");
const OUT_PUBLIC = path.join(APP_DIR, "public");

// Resolve sharp from app/node_modules
const require = createRequire(path.join(APP_DIR, "package.json"));
const sharp = require("sharp");

// ── Colours ───────────────────────────────────────────────────────────────────
const PETROL = "#2A5859";
const CREAM = "#FAF8F3";

// ── Master SVG (exact geometry from 60-SELECTION.md) ─────────────────────────
function masterSvg(size, bgColor = "transparent", iconColor = PETROL) {
  const sw = Math.max(1, Math.round((size / 24) * 2));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  ${bgColor !== "transparent" ? `<rect width="24" height="24" fill="${bgColor}"/>` : ""}
  <path d="M8.8 4.5 L15 12 L8.8 19.5 L2.6 12 Z" fill="none" stroke="${iconColor}" stroke-width="${sw}" stroke-linejoin="round"/>
  <path d="M15.2 4.5 L21.4 12 L15.2 19.5 L9 12 Z" fill="none" stroke="${iconColor}" stroke-width="${sw}" stroke-linejoin="round"/>
  <path d="M12 8.35 L15 12 L12 15.65 L9 12 Z" fill="${iconColor}"/>
</svg>`;
}

// ── OG image SVG template (1200×630) ─────────────────────────────────────────
function ogSvg() {
  // Icon at ~200px centered-left area; text alongside
  const iconSize = 200;
  const iconX = (1200 - iconSize) / 2 - 120;
  const iconY = (630 - iconSize) / 2;
  const textX = iconX + iconSize + 40;
  const textBaseY = 630 / 2 - 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CREAM}"/>

  <!-- Icon at ~200px -->
  <g transform="translate(${iconX}, ${iconY})">
    <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">
      <path d="M8.8 4.5 L15 12 L8.8 19.5 L2.6 12 Z" fill="none" stroke="${PETROL}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M15.2 4.5 L21.4 12 L15.2 19.5 L9 12 Z" fill="none" stroke="${PETROL}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M12 8.35 L15 12 L12 15.65 L9 12 Z" fill="${PETROL}"/>
    </svg>
  </g>

  <!-- "gov-map" wordmark -->
  <text
    x="${textX}" y="${textBaseY + 10}"
    font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
    font-size="80"
    font-weight="700"
    fill="${PETROL}"
    dominant-baseline="middle"
  >gov-map</text>

  <!-- Tagline -->
  <text
    x="${textX}" y="${textBaseY + 80}"
    font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
    font-size="28"
    font-weight="400"
    fill="${PETROL}"
    opacity="0.75"
    dominant-baseline="middle"
  >Datos públicos del Congreso, con la fuente a la vista.</text>
</svg>`;
}

// ── ICO encoder (minimal: palette + BITMAPINFOHEADER per size) ───────────────
// We build a valid ICO from PNG buffers using the ICO binary format.
function buildIco(pngBuffers) {
  // pngBuffers: array of { width, height, data: Buffer<PNG> }
  const count = pngBuffers.length;
  const ICONDIR_SIZE = 6;
  const ICONDIRENTRY_SIZE = 16;
  const headerSize = ICONDIR_SIZE + ICONDIRENTRY_SIZE * count;

  // Calculate offsets
  let offset = headerSize;
  const entries = pngBuffers.map((img) => {
    const entry = { ...img, offset };
    offset += img.data.length;
    return entry;
  });

  const totalSize = offset;
  const buf = Buffer.alloc(totalSize);
  let pos = 0;

  // ICONDIR header
  buf.writeUInt16LE(0, pos); pos += 2; // reserved
  buf.writeUInt16LE(1, pos); pos += 2; // type = 1 (ICO)
  buf.writeUInt16LE(count, pos); pos += 2;

  // ICONDIRENTRY per image
  for (const entry of entries) {
    buf.writeUInt8(entry.width === 256 ? 0 : entry.width, pos); pos += 1;
    buf.writeUInt8(entry.height === 256 ? 0 : entry.height, pos); pos += 1;
    buf.writeUInt8(0, pos); pos += 1; // color count
    buf.writeUInt8(0, pos); pos += 1; // reserved
    buf.writeUInt16LE(1, pos); pos += 2; // planes
    buf.writeUInt16LE(32, pos); pos += 2; // bit count
    buf.writeUInt32LE(entry.data.length, pos); pos += 4;
    buf.writeUInt32LE(entry.offset, pos); pos += 4;
  }

  // Image data
  for (const entry of entries) {
    entry.data.copy(buf, entry.offset);
  }

  return buf;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function svgToPng(svgStr, width, height) {
  return sharp(Buffer.from(svgStr))
    .resize(width, height)
    .png()
    .toBuffer();
}

async function writeFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
  console.log(`  wrote ${path.relative(REPO_ROOT, filePath)} (${Math.round(data.length / 1024)}KB)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Generating brand assets…\n");

  // 1. favicon.ico — 16, 32, 48 with transparent bg
  console.log("favicon.ico (16/32/48)…");
  const icoSizes = [16, 32, 48];
  const icoPngs = await Promise.all(
    icoSizes.map(async (sz) => {
      const data = await svgToPng(masterSvg(sz, "transparent"), sz, sz);
      return { width: sz, height: sz, data };
    })
  );
  await writeFile(path.join(OUT_APP, "favicon.ico"), buildIco(icoPngs));

  // 2. apple-icon.png — 180×180, cream bg
  console.log("apple-icon.png (180×180)…");
  const appleIconSvg = masterSvg(180, CREAM);
  const appleIconPng = await svgToPng(appleIconSvg, 180, 180);
  await writeFile(path.join(OUT_APP, "apple-icon.png"), appleIconPng);

  // 3. opengraph-image.png — 1200×630
  console.log("opengraph-image.png (1200×630)…");
  const ogPng = await svgToPng(ogSvg(), 1200, 630);
  await writeFile(path.join(OUT_APP, "opengraph-image.png"), ogPng);

  // 4. icon-192.png — 192×192, cream bg
  console.log("icon-192.png (192×192)…");
  const icon192 = await svgToPng(masterSvg(192, CREAM), 192, 192);
  await writeFile(path.join(OUT_PUBLIC, "icon-192.png"), icon192);

  // 5. icon-512.png — 512×512, cream bg
  console.log("icon-512.png (512×512)…");
  const icon512 = await svgToPng(masterSvg(512, CREAM), 512, 512);
  await writeFile(path.join(OUT_PUBLIC, "icon-512.png"), icon512);

  console.log("\nAll brand assets generated successfully.");
}

main().catch((err) => {
  console.error("Asset generation failed:", err);
  process.exit(1);
});
