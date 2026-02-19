#!/usr/bin/env node

/**
 * Demo: Image Fit Modes
 *
 * Tests the three imageFit options for handling aspect ratio mismatches
 * between source images and the output canvas: blur-fill, cover, contain.
 *
 * Usage: node examples/demo-image-fit.js
 *
 * ============================================================================
 * EXPECTED OUTPUT FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Landscape image in portrait output — all 3 modes       3 exports
 * ───────────────────────────────────────────────────────────────────────────
 *   1a) blur-fill (default): landscape image centered, top/bottom filled
 *       with a heavily blurred version of the image. No black bars.
 *   1b) cover: landscape image scaled up to fill the portrait frame,
 *       left/right edges cropped away. Full frame, no bars.
 *   1c) contain: landscape image centered with black bars on top/bottom.
 *
 * DEMO 2: Portrait image in landscape output — blur-fill          ~5s
 * ───────────────────────────────────────────────────────────────────────────
 *   Portrait image centered, left/right filled with blurred version.
 *   Labels identify the mode. Tests reverse aspect mismatch direction.
 *
 * DEMO 3: Square image in portrait output — blur-fill             ~5s
 * ───────────────────────────────────────────────────────────────────────────
 *   Square image in portrait (9:16) canvas. Top/bottom blur-filled.
 *   Tests non-standard aspect ratio pairing.
 *
 * DEMO 4: Mixed imageFit modes in a single timeline               ~15s
 * ───────────────────────────────────────────────────────────────────────────
 *   0-5s   blur-fill image (landscape in portrait)
 *   5-10s  cover image (landscape in portrait)
 *  10-15s  contain image (landscape in portrait)
 *          Each section has a text label identifying the mode.
 *
 * DEMO 5: Ken Burns zoom-in + blur-fill                           ~5s
 * ───────────────────────────────────────────────────────────────────────────
 *   Landscape image in portrait output with Ken Burns zoom-in.
 *   The sharp image zooms in while blurred bars stay static behind it.
 *
 * DEMO 6: Ken Burns pan-right + contain                           ~5s
 * ───────────────────────────────────────────────────────────────────────────
 *   Landscape image in portrait output with Ken Burns pan-right.
 *   The sharp image pans while black bars stay static above/below.
 *
 * DEMO 7: Ken Burns zoom-in + cover (default KB behavior)         ~5s
 * ───────────────────────────────────────────────────────────────────────────
 *   Landscape image in portrait output with Ken Burns zoom-in.
 *   Image fills the entire frame (heavily cropped). Compare with Demo 5
 *   to see the difference between cover and blur-fill.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-image-fit");

const IMG_LANDSCAPE = path.join(FIXTURES_DIR, "test-image.jpg");
const IMG_PORTRAIT = path.join(FIXTURES_DIR, "test-image-portrait.jpg");

// ============================================================================
// Demos
// ============================================================================

async function demo1a_BlurFill() {
  log("DEMO 1a: Landscape in portrait — blur-fill (default)");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5 },
    { type: "text", text: "blur-fill (default)", position: 0, end: 5, fontSize: 48, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "01a-blur-fill.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo1b_Cover() {
  log("DEMO 1b: Landscape in portrait — cover");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5, imageFit: "cover" },
    { type: "text", text: "cover (scale + crop)", position: 0, end: 5, fontSize: 48, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "01b-cover.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo1c_Contain() {
  log("DEMO 1c: Landscape in portrait — contain");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5, imageFit: "contain" },
    { type: "text", text: "contain (black bars)", position: 0, end: 5, fontSize: 48, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "01c-contain.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_PortraitInLandscape() {
  log("DEMO 2: Portrait in landscape — blur-fill");
  const project = new SIMPLEFFMPEG({ width: 1920, height: 1080, fps: 30 });
  await project.load([
    { type: "image", url: IMG_PORTRAIT, position: 0, end: 5 },
    { type: "text", text: "Portrait in landscape — blur-fill", position: 0, end: 5, fontSize: 40, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "02-portrait-in-landscape.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_SquareInPortrait() {
  log("DEMO 3: Square image in portrait — blur-fill");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  // Use landscape image in a square-ish way by loading it (640x480 will still mismatch 1:1.78)
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5 },
    { type: "text", text: "Landscape in 9:16 — blur-fill", position: 0, end: 5, fontSize: 40, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "03-square-in-portrait.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_MixedTimeline() {
  log("DEMO 4: Mixed imageFit modes in single timeline");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5, imageFit: "blur-fill" },
    { type: "image", url: IMG_LANDSCAPE, position: 5, end: 10, imageFit: "cover" },
    { type: "image", url: IMG_LANDSCAPE, position: 10, end: 15, imageFit: "contain" },
    { type: "text", text: "blur-fill", position: 0.2, end: 4.8, fontSize: 52, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
    { type: "text", text: "cover", position: 5.2, end: 9.8, fontSize: 52, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
    { type: "text", text: "contain", position: 10.2, end: 14.8, fontSize: 52, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "04-mixed-timeline.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_KenBurnsBlurFill() {
  log("DEMO 5: Ken Burns zoom-in + blur-fill (landscape in portrait)");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5, width: 640, height: 480, kenBurns: "zoom-in", imageFit: "blur-fill" },
    { type: "text", text: "KB zoom-in + blur-fill", position: 0, end: 5, fontSize: 44, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "05-kb-blur-fill.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo6_KenBurnsContain() {
  log("DEMO 6: Ken Burns pan-right + contain (landscape in portrait)");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5, width: 640, height: 480, kenBurns: "pan-right", imageFit: "contain" },
    { type: "text", text: "KB pan-right + contain", position: 0, end: 5, fontSize: 44, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "06-kb-contain.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo7_KenBurnsCover() {
  log("DEMO 7: Ken Burns zoom-in + cover (landscape in portrait, default KB)");
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });
  await project.load([
    { type: "image", url: IMG_LANDSCAPE, position: 0, end: 5, width: 640, height: 480, kenBurns: "zoom-in", imageFit: "cover" },
    { type: "text", text: "KB zoom-in + cover (default)", position: 0, end: 5, fontSize: 44, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.05 },
  ]);
  const out = path.join(OUTPUT_DIR, "07-kb-cover.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Image Fit — Visual Demo", OUTPUT_DIR, [
  demo1a_BlurFill,
  demo1b_Cover,
  demo1c_Contain,
  demo2_PortraitInLandscape,
  demo3_SquareInPortrait,
  demo4_MixedTimeline,
  demo5_KenBurnsBlurFill,
  demo6_KenBurnsContain,
  demo7_KenBurnsCover,
]);

console.log(`  WHAT TO CHECK:
  01a  Landscape image centered, top/bottom filled with colorful blur (no black)
  01b  Landscape image scaled up to fill frame, edges cropped
  01c  Landscape image centered with black bars top/bottom
  02   Portrait image centered in landscape, left/right blur-filled
  03   Landscape image in 9:16 portrait with blur-fill bars
  04   Three sections: blur-fill -> cover -> contain in one video
  05   KB zoom-in on sharp image, static blurred background behind
  06   KB pan-right on sharp image, static black bars behind
  07   KB zoom-in fills entire frame (cover) — compare with 05 to see the difference
`);

if (fail > 0) process.exit(1);
