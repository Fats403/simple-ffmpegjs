#!/usr/bin/env node

/**
 * Demo: Color Clips — Flat Colors, Gradients & Transitions
 *
 * Demonstrates the new type: "color" clip introduced in v0.4.0.
 * Color clips replace the old fillGaps behavior with explicit, composable
 * timeline entries that support flat colors, gradients, and transitions.
 *
 * Usage: node examples/demo-color-clips.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Flat color clip (intro screen)                          ~5s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 2.0s  BLACK screen with "Coming Soon..." title (white, fade-in)
 *   2.0s - 5.0s  RED video with "Main Content" label
 *
 * DEMO 2: Color clip with transition (fade from black)            ~5.5s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 2.0s  BLACK screen with "Opening" text
 *   ~1.5s        Fade transition (0.5s) from black to video
 *   2.0s - 5.0s  RED video (3s)
 *   Total: 2 + 3 - 0.5 = 4.5s compressed
 *
 * DEMO 3: Linear gradient background                              ~4s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 4.0s  Linear gradient (dark blue -> purple) with title text
 *
 * DEMO 4: Radial gradient background                              ~4s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 4.0s  Radial gradient (warm center -> dark edges) with title text
 *
 * DEMO 5: Multi-stop gradient with direction                      ~4s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 4.0s  Horizontal linear gradient (red -> yellow -> green)
 *
 * DEMO 6: Full composition — gradient intro, video, gradient outro ~10s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  Linear gradient intro with title
 *   ~2.5s        Fade transition (0.5s) from gradient to video
 *   3.0s - 7.0s  RED video with "Main Content" label
 *   ~6.5s        Fade transition (0.5s) from video to gradient
 *   7.0s - 10.0s Radial gradient outro with "The End" text
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-color-clips");

// ============================================================================
// Demos
// ============================================================================

async function demo1_FlatColorIntro() {
  log("DEMO 1: Flat color intro screen");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "color", color: "black", position: 0, end: 2 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 2, end: 5 },
    { type: "text", text: "Coming Soon...", position: 0.3, end: 1.8, fontSize: 44, fontColor: "white", yPercent: 0.5, animation: { type: "fade-in", in: 0.5 } },
    { type: "text", text: "Main Content", position: 2.5, end: 4.5, fontSize: 32, fontColor: "white", yPercent: 0.15 },
  ]);
  const out = path.join(OUTPUT_DIR, "01-flat-color-intro.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_ColorWithTransition() {
  log("DEMO 2: Fade from black into video");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "color", color: "black", position: 0, end: 2 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 2, end: 5, transition: { type: "fade", duration: 0.5 } },
    { type: "text", text: "Opening", position: 0.3, end: 1.5, fontSize: 44, fontColor: "white", yPercent: 0.5 },
  ]);
  const out = path.join(OUTPUT_DIR, "02-color-transition-fade.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_LinearGradient() {
  log("DEMO 3: Linear gradient background");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    {
      type: "color",
      color: { type: "linear-gradient", colors: ["#0a0a2e", "#4a148c"] },
      position: 0,
      end: 4,
    },
    { type: "text", text: "Linear Gradient", position: 0.5, end: 3.5, fontSize: 48, fontColor: "white", yPercent: 0.4, animation: { type: "fade-in-out", in: 0.5, out: 0.5 } },
    { type: "text", text: "Dark Blue → Purple", position: 1, end: 3, fontSize: 24, fontColor: "#B0B0B0", yPercent: 0.6 },
  ]);
  const out = path.join(OUTPUT_DIR, "03-linear-gradient.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_RadialGradient() {
  log("DEMO 4: Radial gradient background");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    {
      type: "color",
      color: { type: "radial-gradient", colors: ["#ff8c00", "#1a0000"] },
      position: 0,
      end: 4,
    },
    { type: "text", text: "Radial Gradient", position: 0.5, end: 3.5, fontSize: 48, fontColor: "white", yPercent: 0.4, animation: { type: "pop", in: 0.3 } },
    { type: "text", text: "Warm Center → Dark Edges", position: 1, end: 3, fontSize: 24, fontColor: "#FFD700", yPercent: 0.6 },
  ]);
  const out = path.join(OUTPUT_DIR, "04-radial-gradient.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_MultiStopGradient() {
  log("DEMO 5: Multi-stop horizontal gradient");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    {
      type: "color",
      color: {
        type: "linear-gradient",
        colors: ["#e74c3c", "#f1c40f", "#2ecc71"],
        direction: "horizontal",
      },
      position: 0,
      end: 4,
    },
    { type: "text", text: "Multi-Stop Gradient", position: 0.5, end: 3.5, fontSize: 44, fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.5 },
  ]);
  const out = path.join(OUTPUT_DIR, "05-multi-stop-gradient.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo6_FullComposition() {
  log("DEMO 6: Full composition — gradient intro, video, gradient outro");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    // Gradient intro
    {
      type: "color",
      color: { type: "linear-gradient", colors: ["#1a1a2e", "#16213e", "#0f3460"] },
      position: 0,
      end: 3,
    },
    // Main video
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 3,
      end: 7,
      transition: { type: "fade", duration: 0.5 },
    },
    // Gradient outro
    {
      type: "color",
      color: { type: "radial-gradient", colors: ["#2c3e50", "#000000"] },
      position: 7,
      end: 10,
      transition: { type: "fade", duration: 0.5 },
    },
    // Text overlays
    { type: "text", text: "Welcome", position: 0.5, end: 2.5, fontSize: 56, fontColor: "white", yPercent: 0.4, animation: { type: "fade-in", in: 0.5 } },
    { type: "text", text: "A Color Clips Demo", position: 1, end: 2.5, fontSize: 24, fontColor: "#B0B0B0", yPercent: 0.6 },
    { type: "text", text: "Main Content", position: 3.5, end: 6.5, fontSize: 32, fontColor: "white", yPercent: 0.15 },
    { type: "text", text: "The End", position: 7.5, end: 9.5, fontSize: 56, fontColor: "white", yPercent: 0.5, animation: { type: "fade-in-out", in: 0.5, out: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "06-full-composition.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Color Clips — Visual Demo", OUTPUT_DIR, [
  demo1_FlatColorIntro,
  demo2_ColorWithTransition,
  demo3_LinearGradient,
  demo4_RadialGradient,
  demo5_MultiStopGradient,
  demo6_FullComposition,
]);

console.log(`  WHAT TO CHECK:
  01  BLACK intro screen for 2s, then video — clean cut
  02  BLACK intro fading smoothly into video at ~1.5s
  03  Vertical linear gradient (dark blue -> purple) with centered text
  04  Radial gradient (warm orange center fading to dark) with text
  05  Horizontal 3-color gradient (red -> yellow -> green)
  06  Gradient intro fading to video fading to gradient outro with text throughout
`);

if (fail > 0) process.exit(1);
