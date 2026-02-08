#!/usr/bin/env node

/**
 * Demo: Text Overlays & Animations
 *
 * Tests all text modes, animation types, positioning, and styling.
 *
 * Usage: node examples/demo-text-and-animations.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Static text positioning                               ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  BLUE video with 5 text labels:
 *                 "Top-Left" at top-left, "Top-Right" at top-right,
 *                 "Center" in the middle, "Bottom-Left" at bottom-left,
 *                 "Bottom-Right" at bottom-right.
 *                 All 5 should be visible simultaneously for the full 3s.
 *
 * DEMO 2: Fade animations                                       ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video with 3 texts stacked vertically:
 *                 "Fade In" (top) — fades in over 0.5s, stays visible
 *                 "Fade Out" (middle) — visible, fades out over last 0.5s
 *                 "Fade In+Out" (bottom) — fades in 0.5s, fades out 0.5s
 *
 * DEMO 3: Pop and pop-bounce                                    ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  GREEN video with 2 texts:
 *                 "Pop!" (top) — scales up quickly from 0 to full size
 *                 "Bounce!" (bottom) — scales up with overshoot bounce
 *
 * DEMO 4: Typewriter                                            ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  BLUE video, text "Hello World!" appears character by
 *                 character at ~15 chars/sec. Full text visible by ~0.8s.
 *
 * DEMO 5: Scale-in                                              ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video, "Growing Text" starts small and scales up
 *                 over 0.5s to full size, then stays.
 *
 * DEMO 6: Pulse                                                 ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  BLUE video, "Pulsing" continuously grows and shrinks
 *                 at ~3 cycles/sec with 20% size variation.
 *
 * DEMO 7: Text styling showcase                                 ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  GREEN video with styled text:
 *                 "Styled Text" with white font, black border (width 3),
 *                 shadow, and a semi-transparent background box.
 *
 * DEMO 8: Word-replace mode                                     ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  BLUE video, single word displayed at a time:
 *                 "One" -> "Two" -> "Three" replacing each other.
 *                 Each word pops in with animation.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-text-and-animations");

// ============================================================================
// Demos
// ============================================================================

async function demo1_StaticPositioning() {
  log("DEMO 1: Static text positioning");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Top-Left", position: 0, end: 3, fontSize: 28, fontColor: "white", xPercent: 0.1, yPercent: 0.08 },
    { type: "text", text: "Top-Right", position: 0, end: 3, fontSize: 28, fontColor: "white", xPercent: 0.9, yPercent: 0.08 },
    { type: "text", text: "Center", position: 0, end: 3, fontSize: 40, fontColor: "yellow", xPercent: 0.5, yPercent: 0.5 },
    { type: "text", text: "Bottom-Left", position: 0, end: 3, fontSize: 28, fontColor: "white", xPercent: 0.1, yPercent: 0.92 },
    { type: "text", text: "Bottom-Right", position: 0, end: 3, fontSize: 28, fontColor: "white", xPercent: 0.9, yPercent: 0.92 },
  ]);
  const out = path.join(OUTPUT_DIR, "01-static-positioning.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_FadeAnimations() {
  log("DEMO 2: Fade animations (in, out, in+out)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Fade In", position: 0.2, end: 2.8, fontSize: 36, fontColor: "white", yPercent: 0.25, animation: { type: "fade-in", in: 0.5 } },
    { type: "text", text: "Fade Out", position: 0.2, end: 2.8, fontSize: 36, fontColor: "white", yPercent: 0.5, animation: { type: "fade-out", out: 0.5 } },
    { type: "text", text: "Fade In+Out", position: 0.2, end: 2.8, fontSize: 36, fontColor: "white", yPercent: 0.75, animation: { type: "fade-in-out", in: 0.5, out: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "02-fade-animations.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_PopBounce() {
  log("DEMO 3: Pop and pop-bounce animations");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Pop!", position: 0.3, end: 2.7, fontSize: 56, fontColor: "white", yPercent: 0.3, animation: { type: "pop", in: 0.3 } },
    { type: "text", text: "Bounce!", position: 0.3, end: 2.7, fontSize: 56, fontColor: "yellow", yPercent: 0.7, animation: { type: "pop-bounce", in: 0.4 } },
  ]);
  const out = path.join(OUTPUT_DIR, "03-pop-bounce.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_Typewriter() {
  log("DEMO 4: Typewriter animation");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Hello World!", position: 0.3, end: 2.7, fontSize: 48, fontColor: "white", yPercent: 0.5, animation: { type: "typewriter", speed: 15 } },
  ]);
  const out = path.join(OUTPUT_DIR, "04-typewriter.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_ScaleIn() {
  log("DEMO 5: Scale-in animation");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Growing Text", position: 0.3, end: 2.7, fontSize: 56, fontColor: "white", yPercent: 0.5, animation: { type: "scale-in", in: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "05-scale-in.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo6_Pulse() {
  log("DEMO 6: Pulse animation");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Pulsing", position: 0.2, end: 2.8, fontSize: 52, fontColor: "cyan", yPercent: 0.5, animation: { type: "pulse", speed: 3, intensity: 0.2 } },
  ]);
  const out = path.join(OUTPUT_DIR, "06-pulse.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo7_TextStyling() {
  log("DEMO 7: Text styling showcase");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", text: "Styled Text", position: 0.2, end: 2.8, fontSize: 48, fontColor: "white",
      borderColor: "black", borderWidth: 3,
      shadowColor: "black", shadowX: 3, shadowY: 3,
      yPercent: 0.35,
    },
    {
      type: "text", text: "With Background", position: 0.2, end: 2.8, fontSize: 36, fontColor: "white",
      backgroundColor: "black", backgroundOpacity: 0.6, padding: 10,
      yPercent: 0.65,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "07-text-styling.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo8_WordReplace() {
  log("DEMO 8: Word-replace mode");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", mode: "word-replace", text: "One Two Three",
      position: 0.5, end: 2.5,
      wordTimestamps: [0.5, 1.0, 1.5, 2.0],
      fontSize: 64, fontColor: "white", yPercent: 0.5,
      animation: { type: "pop", in: 0.15 },
    },
  ]);
  const out = path.join(OUTPUT_DIR, "08-word-replace.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Text & Animations — Visual Demo", OUTPUT_DIR, [
  demo1_StaticPositioning,
  demo2_FadeAnimations,
  demo3_PopBounce,
  demo4_Typewriter,
  demo5_ScaleIn,
  demo6_Pulse,
  demo7_TextStyling,
  demo8_WordReplace,
]);

console.log(`  WHAT TO CHECK:
  01  Five labels visible at all four corners + center
  02  Fade-in (top), fade-out (mid), fade-in-out (bottom)
  03  Pop scales up, pop-bounce overshoots then settles
  04  Characters appear one by one left to right
  05  Text starts small, grows to full size over 0.5s
  06  Text continuously grows/shrinks rhythmically
  07  Border, shadow, and semi-transparent background box
  08  Words swap: "One" -> "Two" -> "Three" with pop animation
`);

if (fail > 0) process.exit(1);
