#!/usr/bin/env node

/**
 * Demo: Timeline & Gap Filling
 *
 * Tests trailing gaps, leading gaps, middle gaps, custom fill colors,
 * fillGaps boolean shorthand, and interactions with transitions.
 *
 * Usage: node examples/demo-timeline-and-gaps.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Basic trailing gap (text on black)                    ~7s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video with "Video plays here" text (white)
 *   3.0s - 7.0s  BLACK screen with "Ending title on black" text (white, pop)
 *
 * DEMO 2: Custom color trailing gap (navy)                      ~7s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  BLUE video with "Video section" text (white)
 *   3.0s - 7.0s  NAVY (#0a0a2e) screen with "Credits on dark blue" (gold)
 *
 * DEMO 3: Trailing gap from audio extending past visual         ~5s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video (muted) with sine tone from audio clip
 *   3.0s - 5.0s  BLACK screen — sine tone continues at same level
 *
 * DEMO 4: Trailing gap + transitions (compensated)              ~8.5s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video
 *   ~2.5s        Fade transition (0.5s overlap, RED -> BLUE)
 *   3.0s - 5.5s  BLUE video (shifted by 0.5s transition)
 *   ~5.5s        BLACK screen begins (trailing gap)
 *   ~8.5s        "Final thoughts" text visible on black until end
 *                1 transition x 0.5s = 0.5s compression.
 *
 * DEMO 5: Leading + middle + trailing gaps (red fill)           ~14s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 2.0s  RED fill (leading gap) with label text
 *   2.0s - 5.0s  RED video clip
 *   5.0s - 7.0s  RED fill (middle gap) with label text
 *   7.0s - 10.0s BLUE video clip
 *  10.0s - 14.0s RED fill (trailing gap) with "Fin" text
 *
 * DEMO 6: fillGaps: true (boolean shorthand)                   ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  GREEN video with "Using fillGaps: true" label
 *   3.0s - 6.0s  BLACK screen with "Boolean shorthand" text
 *
 * DEMO 7: Hex color + multi-transitions + trailing gap          ~10s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video
 *   ~2.5s        Fade (0.5s) -> GREEN video
 *   ~5.0s        Fade (0.5s) -> BLUE video
 *   ~8.0s        DARK PURPLE (#2d1b69) fill (trailing gap)
 *   ~10.0s       "End credits" text visible on purple until end
 *                2 transitions x 0.5s = 1.0s compression.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-timeline-and-gaps");

// ============================================================================
// Demos
// ============================================================================

async function demo1_BasicTrailingGap() {
  log("DEMO 1: Basic trailing gap — text on black");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, fillGaps: "black" });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Video plays here", position: 0.5, end: 2.5, fontSize: 32, fontColor: "white", yPercent: 0.15 },
    { type: "text", text: "Ending title on black", position: 2.5, end: 7, fontSize: 48, fontColor: "white", yPercent: 0.5, animation: { type: "pop", in: 0.3 } },
  ]);
  const out = path.join(OUTPUT_DIR, "01-basic-trailing-gap.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_CustomColorTrailingGap() {
  log("DEMO 2: Custom color trailing gap — navy fill");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, fillGaps: "#0a0a2e" });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Video section", position: 0.5, end: 2.5, fontSize: 32, fontColor: "white", yPercent: 0.15 },
    { type: "text", text: "Credits on dark blue", position: 2.5, end: 7, fontSize: 44, fontColor: "#FFD700", yPercent: 0.5, animation: { type: "fade-in", in: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "02-custom-color-trailing.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_AudioExtendsTrailingGap() {
  log("DEMO 3: Trailing gap from audio extending past visual");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, fillGaps: "black" });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3, volume: 0 },
    { type: "audio", url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"), position: 0, end: 5, volume: 0.8 },
  ]);
  const out = path.join(OUTPUT_DIR, "03-audio-trailing-gap.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_TransitionsTrailingGap() {
  log("DEMO 4: Trailing gap + transitions (compensated)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, fillGaps: "black" });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 0.5 } },
    { type: "text", text: "During video", position: 0.5, end: 2.5, fontSize: 32, fontColor: "white", yPercent: 0.15 },
    { type: "text", text: "Final thoughts", position: 4, end: 9, fontSize: 44, fontColor: "white", yPercent: 0.5, animation: { type: "fade-in-out", in: 0.5, out: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "04-transitions-trailing-gap.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_AllGapTypes() {
  log("DEMO 5: Leading + middle + trailing gaps (red fill)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, fillGaps: "red" });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 2, end: 5 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 7, end: 10 },
    { type: "text", text: "Leading gap (red)", position: 0, end: 2, fontSize: 28, fontColor: "white", yPercent: 0.5 },
    { type: "text", text: "Middle gap (red)", position: 5, end: 7, fontSize: 28, fontColor: "white", yPercent: 0.5 },
    { type: "text", text: "Fin", position: 9, end: 14, fontSize: 64, fontColor: "white", borderColor: "black", borderWidth: 3, yPercent: 0.5, animation: { type: "fade-in", in: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "05-all-gap-types-red.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo6_BooleanShorthand() {
  log("DEMO 6: fillGaps: true (boolean shorthand for black)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, fillGaps: true });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Using fillGaps: true", position: 0.5, end: 2.5, fontSize: 32, fontColor: "white", yPercent: 0.15 },
    { type: "text", text: "Boolean shorthand", position: 2.5, end: 6, fontSize: 44, fontColor: "white", yPercent: 0.5, animation: { type: "fade-in", in: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "06-boolean-shorthand.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo7_HexColorMultiTransitions() {
  log("DEMO 7: Hex color + multiple transitions + trailing gap");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, fillGaps: "#2d1b69" });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 6, end: 9, transition: { type: "fade", duration: 0.5 } },
    { type: "text", text: "End credits", position: 7, end: 11, fontSize: 44, fontColor: "#E0E0E0", yPercent: 0.5, animation: { type: "fade-in-out", in: 0.5, out: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "07-hex-color-multi-transitions.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Timeline & Gap Filling — Visual Demo", OUTPUT_DIR, [
  demo1_BasicTrailingGap,
  demo2_CustomColorTrailingGap,
  demo3_AudioExtendsTrailingGap,
  demo4_TransitionsTrailingGap,
  demo5_AllGapTypes,
  demo6_BooleanShorthand,
  demo7_HexColorMultiTransitions,
]);

console.log(`  WHAT TO CHECK:
  01  Text continues on BLACK past video until 7s
  02  Text continues on DARK NAVY (#0a0a2e) until 7s
  03  Sine tone continues on black from 3-5s at steady volume
  04  Transition at ~2.5s, text on black — no dead silence at end
  05  RED fill in leading (0-2s), middle (5-7s), and trailing (10-14s)
  06  Same as 01 but via fillGaps: true — black fill
  07  Two fade transitions, then DARK PURPLE trailing gap with credits
`);

if (fail > 0) process.exit(1);
