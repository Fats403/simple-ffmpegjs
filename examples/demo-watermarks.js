#!/usr/bin/env node

/**
 * Demo: Watermarks
 *
 * Tests text and image watermarks, all positions, timed appearance,
 * styling, and watermarks over transitions.
 *
 * Usage: node examples/demo-watermarks.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Text watermark positions                              ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s   RED video with "@demo" text watermark at bottom-right.
 *          White text, 70% opacity, 15px margin from edge.
 *
 * DEMO 2: All watermark positions                               ~3s each
 * ───────────────────────────────────────────────────────────────────────────
 *   Generates 5 separate files (02a through 02e), each showing the same
 *   video with a text watermark at a different position:
 *   02a: top-left      02b: top-right     02c: bottom-left
 *   02d: bottom-right  02e: center
 *
 * DEMO 3: Image watermark                                       ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s   BLUE video with a small white square watermark at top-right.
 *          Scale 0.5 (32x32 displayed), 80% opacity.
 *
 * DEMO 4: Timed watermark                                       ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-2s   RED video — NO watermark visible
 *   2-5s   RED then BLUE video — "Appears 2-5s" watermark visible at top-left
 *   5-6s   BLUE video — watermark disappears
 *
 * DEMO 5: Styled text watermark                                 ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-6s   RED then BLUE video with styled watermark:
 *          "WATERMARK" with border, shadow, 90% opacity at bottom-right.
 *          Watermark persists across the fade transition at ~2.5s.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-watermarks");

// ============================================================================
// Demos
// ============================================================================

async function demo1_TextWatermark() {
  log("DEMO 1: Text watermark (bottom-right)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
  ]);
  const out = path.join(OUTPUT_DIR, "01-text-watermark.mp4");
  await project.export({
    outputPath: out, preset: "ultrafast", onProgress: progress,
    watermark: { type: "text", text: "@demo", position: "bottom-right", fontSize: 24, fontColor: "#FFFFFF", opacity: 0.7, margin: 15 },
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_AllPositions() {
  const positions = ["top-left", "top-right", "bottom-left", "bottom-right", "center"];
  const labels = ["02a", "02b", "02c", "02d", "02e"];
  for (let i = 0; i < positions.length; i++) {
    log(`DEMO 2${String.fromCharCode(97 + i)}: Watermark at ${positions[i]}`);
    const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
    await project.load([
      { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    ]);
    const out = path.join(OUTPUT_DIR, `${labels[i]}-position-${positions[i]}.mp4`);
    await project.export({
      outputPath: out, preset: "ultrafast", onProgress: progress,
      watermark: { type: "text", text: positions[i], position: positions[i], fontSize: 20, fontColor: "yellow", opacity: 0.9, margin: 10 },
    });
    console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
  }
}

async function demo3_ImageWatermark() {
  log("DEMO 3: Image watermark");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
  ]);
  const out = path.join(OUTPUT_DIR, "03-image-watermark.mp4");
  await project.export({
    outputPath: out, preset: "ultrafast", onProgress: progress,
    watermark: { type: "image", url: path.join(FIXTURES_DIR, "test-watermark.png"), position: "top-right", opacity: 0.8, scale: 0.5, margin: 10 },
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_TimedWatermark() {
  log("DEMO 4: Timed watermark (2-5s only)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6 },
  ]);
  const out = path.join(OUTPUT_DIR, "04-timed-watermark.mp4");
  await project.export({
    outputPath: out, preset: "ultrafast", onProgress: progress,
    watermark: { type: "text", text: "Appears 2-5s", position: "top-left", fontSize: 20, fontColor: "yellow", opacity: 0.9, margin: 10, startTime: 2, endTime: 5 },
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_StyledWatermarkOverTransition() {
  log("DEMO 5: Styled watermark over transition");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "05-styled-over-transition.mp4");
  await project.export({
    outputPath: out, preset: "ultrafast", onProgress: progress,
    watermark: {
      type: "text", text: "WATERMARK", position: "bottom-right", fontSize: 22,
      fontColor: "#FFFFFF", borderColor: "#000000", borderWidth: 1,
      shadowColor: "black", shadowX: 2, shadowY: 2,
      opacity: 0.9, margin: 15,
    },
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Watermarks — Visual Demo", OUTPUT_DIR, [
  demo1_TextWatermark,
  demo2_AllPositions,
  demo3_ImageWatermark,
  demo4_TimedWatermark,
  demo5_StyledWatermarkOverTransition,
]);

console.log(`  WHAT TO CHECK:
  01  "@demo" text at bottom-right, semi-transparent
  02  Five files showing watermark at each of the five positions
  03  Small white square image at top-right
  04  Watermark only visible between 2s and 5s
  05  Styled watermark persists smoothly through fade transition
`);

if (fail > 0) process.exit(1);
