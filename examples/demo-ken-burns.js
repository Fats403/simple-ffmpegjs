#!/usr/bin/env node

/**
 * Demo: Ken Burns Effects
 *
 * Tests all Ken Burns presets, smart mode, custom mode, and interactions
 * with transitions and text overlays.
 *
 * Usage: node examples/demo-ken-burns.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: All 6 preset effects                                 ~24s total
 * ───────────────────────────────────────────────────────────────────────────
 *   Each effect runs for 4s with no visual gaps:
 *   0-4s   zoom-in  (image slowly zooms in toward center)
 *   4-8s   zoom-out (image starts zoomed, pulls back)
 *   8-12s  pan-left (camera pans from right to left)
 *  12-16s  pan-right (camera pans from left to right)
 *  16-20s  pan-up   (camera pans from bottom to top)
 *  20-24s  pan-down (camera pans from top to bottom)
 *          Each section has a label at the bottom naming the effect.
 *          Grid image letters (A,B,C,D) help track the motion.
 *
 * DEMO 2: Smart mode with anchors                               ~8s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-4s   smart mode, anchor=top (zooms toward top of image)
 *   4-8s   smart mode, anchor=bottom (zooms toward bottom)
 *          Watch which corner letters stay visible vs. cropped.
 *
 * DEMO 3: Custom diagonal pan                                   ~4s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-4s   Custom: startX=0.2, startY=0.8 -> endX=0.8, endY=0.2
 *          Camera moves diagonally from bottom-left to top-right.
 *          Should see letter C first, ending near letter B.
 *
 * DEMO 4: Ken Burns + transitions (slideshow)                   ~10s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-4s   Image with zoom-in
 *   3-4s   Fade transition into next image
 *   4-8s   Image with pan-right
 *   7-8s   Fade transition into next image
 *   8-10s  Image with zoom-out
 *          Smooth crossfades between Ken Burns images. Total ~10s
 *          (12s - 2x1s transitions).
 *
 * DEMO 5: Ken Burns + text labels                               ~4s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-4s   Image with zoom-in effect, "Ken Burns Demo" text
 *          at top with fade-in animation, and "zoom-in" label
 *          at bottom. Text should remain stable while image moves.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-ken-burns");

// ============================================================================
// Demos
// ============================================================================

async function demo1_AllPresets() {
  log("DEMO 1: All 6 preset effects");
  const effects = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"];
  const clips = [];
  effects.forEach((name, i) => {
    const start = i * 4;
    clips.push({
      type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: start, end: start + 4, kenBurns: name,
    });
    clips.push({
      type: "text", text: name, position: start, end: start + 4,
      fontSize: 36, fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.9,
    });
  });

  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load(clips);
  const out = path.join(OUTPUT_DIR, "01-all-presets.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_SmartAnchors() {
  log("DEMO 2: Smart mode with anchors");
  const project = new SIMPLEFFMPEG({ width: 640, height: 360, fps: 30 });
  await project.load([
    {
      type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: 0, end: 4, width: 640, height: 480,
      kenBurns: { type: "smart", anchor: "top", startZoom: 1.05, endZoom: 1.2, easing: "ease-in-out" },
    },
    {
      type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: 4, end: 8, width: 640, height: 480,
      kenBurns: { type: "smart", anchor: "bottom", startZoom: 1.05, endZoom: 1.2, easing: "ease-in-out" },
    },
    { type: "text", text: "anchor: top", position: 0, end: 4, fontSize: 28, fontColor: "white", yPercent: 0.9 },
    { type: "text", text: "anchor: bottom", position: 4, end: 8, fontSize: 28, fontColor: "white", yPercent: 0.1 },
  ]);
  const out = path.join(OUTPUT_DIR, "02-smart-anchors.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_CustomDiagonal() {
  log("DEMO 3: Custom diagonal pan");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    {
      type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: 0, end: 4,
      kenBurns: { type: "custom", startX: 0.2, startY: 0.8, endX: 0.8, endY: 0.2, easing: "ease-in-out" },
    },
    { type: "text", text: "Diagonal: C -> B", position: 0, end: 4, fontSize: 28, fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.9 },
  ]);
  const out = path.join(OUTPUT_DIR, "03-custom-diagonal.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_KenBurnsSlideshow() {
  log("DEMO 4: Ken Burns + transitions (slideshow)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"), position: 0, end: 4, kenBurns: "zoom-in" },
    { type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"), position: 4, end: 8, kenBurns: "pan-right", transition: { type: "fade", duration: 1 } },
    { type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"), position: 8, end: 12, kenBurns: "zoom-out", transition: { type: "fade", duration: 1 } },
    { type: "music", url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"), volume: 0.3 },
  ]);
  const out = path.join(OUTPUT_DIR, "04-slideshow.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_KenBurnsWithText() {
  log("DEMO 5: Ken Burns + text labels");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"), position: 0, end: 4, kenBurns: "zoom-in" },
    { type: "text", text: "Ken Burns Demo", position: 0.3, end: 3.7, fontSize: 44, fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.15, animation: { type: "fade-in", in: 0.5 } },
    { type: "text", text: "zoom-in", position: 0, end: 4, fontSize: 28, fontColor: "yellow", yPercent: 0.9 },
  ]);
  const out = path.join(OUTPUT_DIR, "05-ken-burns-text.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Ken Burns — Visual Demo", OUTPUT_DIR, [
  demo1_AllPresets,
  demo2_SmartAnchors,
  demo3_CustomDiagonal,
  demo4_KenBurnsSlideshow,
  demo5_KenBurnsWithText,
]);

console.log(`  WHAT TO CHECK:
  01  Six distinct motions with labels, no visual gaps
  02  Top anchor zooms toward A/B, bottom anchor toward C/D
  03  Camera moves diagonally from bottom-left to top-right
  04  Smooth crossfades between moving images with background audio
  05  Text stable while image zooms underneath
`);

if (fail > 0) process.exit(1);
