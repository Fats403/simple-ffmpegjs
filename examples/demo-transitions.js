#!/usr/bin/env node

/**
 * Demo: Transitions
 *
 * Tests all major transition types, durations, and interactions with text.
 *
 * Usage: node examples/demo-transitions.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Basic concatenation (no transition)                   ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video
 *   3.0s - 6.0s  BLUE video (hard cut, no crossfade)
 *
 * DEMO 2: Fade crossfade                                        ~5.5s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video
 *   2.5s - 3.0s  Fade crossfade (RED blends into BLUE)
 *   3.0s - 5.5s  BLUE video
 *                 Total = 6 - 0.5 = 5.5s due to 0.5s overlap
 *
 * DEMO 3: Multiple transition types in sequence                 ~13s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s   RED video
 *   ~2.5s         fade -> BLUE
 *   3.0s - 5.5s   BLUE video
 *   ~5.0s         wipeleft -> GREEN
 *   5.5s - 8.0s   GREEN video
 *   ~7.5s         slideright -> RED
 *   8.0s - 10.5s  RED video
 *   ~10.0s        dissolve -> BLUE
 *  10.5s - 13.0s  BLUE video
 *                  5 clips x 3s = 15s - (4 x 0.5s) = 13s
 *                  Watch for each transition type to be visually distinct.
 *
 * DEMO 4: Short vs long transition durations                    ~5.8s / ~4.5s
 * ───────────────────────────────────────────────────────────────────────────
 *   Part A: 0.2s transition → 6s - 0.2 = ~5.8s (barely perceptible flash)
 *   Part B: 1.5s transition → 6s - 1.5 = ~4.5s (slow, obvious blend)
 *   Both are RED -> BLUE. Compare the two output files.
 *
 * DEMO 5: fadeblack and fadewhite                               ~5.5s each
 * ───────────────────────────────────────────────────────────────────────────
 *   Part A (fadeblack): RED fades to BLACK, then BLACK fades to BLUE
 *   Part B (fadewhite): RED fades to WHITE, then WHITE fades to BLUE
 *   Both should show a clear intermediate color in the transition zone.
 *
 * DEMO 6: Transitions between images                            ~7s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  Grid image (zoom-in Ken Burns)
 *   2.0s         fade transition begins
 *   3.0s - 6.0s  Same image (pan-right Ken Burns)
 *   5.0s         wipeleft transition begins
 *   6.0s - 7.0s  Remaining RED video
 *                 Verifies transitions work between image clips, not just video.
 *
 * DEMO 7: Transitions + text compensation                       ~5.5s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video with "Title" text at top
 *   2.5s         fade transition (RED -> BLUE)
 *   3.0s - 5.5s  BLUE video with "Subtitle" text at bottom
 *                 Text should appear correctly aligned despite transition
 *                 compressing the timeline by 0.5s.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-transitions");

// ============================================================================
// Demos
// ============================================================================

async function demo1_BasicConcat() {
  log("DEMO 1: Basic concatenation (no transition)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6 },
  ]);
  const out = path.join(OUTPUT_DIR, "01-basic-concat.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_FadeCrossfade() {
  log("DEMO 2: Fade crossfade");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "02-fade-crossfade.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_MultipleTransitionTypes() {
  log("DEMO 3: Multiple transition types in sequence");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"), position: 6, end: 9, transition: { type: "wipeleft", duration: 0.5 } },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 9, end: 12, transition: { type: "slideright", duration: 0.5 } },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 12, end: 15, transition: { type: "dissolve", duration: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "03-multi-transition-types.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_TransitionDurations() {
  log("DEMO 4a: Short transition (0.2s)");
  const projectA = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await projectA.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 0.2 } },
  ]);
  const outA = path.join(OUTPUT_DIR, "04a-short-transition.mp4");
  await projectA.export({ outputPath: outA, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${outA}  (${getDuration(outA)}s)`);

  log("DEMO 4b: Long transition (1.5s)");
  const projectB = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await projectB.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 1.5 } },
  ]);
  const outB = path.join(OUTPUT_DIR, "04b-long-transition.mp4");
  await projectB.export({ outputPath: outB, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${outB}  (${getDuration(outB)}s)`);
}

async function demo5_FadeBlackWhite() {
  log("DEMO 5a: fadeblack transition");
  const projectA = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await projectA.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fadeblack", duration: 0.5 } },
  ]);
  const outA = path.join(OUTPUT_DIR, "05a-fadeblack.mp4");
  await projectA.export({ outputPath: outA, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${outA}  (${getDuration(outA)}s)`);

  log("DEMO 5b: fadewhite transition");
  const projectB = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await projectB.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fadewhite", duration: 0.5 } },
  ]);
  const outB = path.join(OUTPUT_DIR, "05b-fadewhite.mp4");
  await projectB.export({ outputPath: outB, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${outB}  (${getDuration(outB)}s)`);
}

async function demo6_ImageTransitions() {
  log("DEMO 6: Transitions between images");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"), position: 0, end: 3, kenBurns: "zoom-in" },
    { type: "image", url: path.join(FIXTURES_DIR, "test-image.jpg"), position: 3, end: 6, kenBurns: "pan-right", transition: { type: "fade", duration: 1 } },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 6, end: 9, transition: { type: "wipeleft", duration: 1 } },
  ]);
  const out = path.join(OUTPUT_DIR, "06-image-transitions.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo7_TransitionsTextCompensation() {
  log("DEMO 7: Transitions + text compensation");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, transition: { type: "fade", duration: 0.5 } },
    { type: "text", text: "Title", position: 0.5, end: 2.5, fontSize: 48, fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.15 },
    { type: "text", text: "Subtitle", position: 3.5, end: 5.5, fontSize: 36, fontColor: "yellow", yPercent: 0.85 },
  ]);
  const out = path.join(OUTPUT_DIR, "07-text-compensation.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Transitions — Visual Demo", OUTPUT_DIR, [
  demo1_BasicConcat,
  demo2_FadeCrossfade,
  demo3_MultipleTransitionTypes,
  demo4_TransitionDurations,
  demo5_FadeBlackWhite,
  demo6_ImageTransitions,
  demo7_TransitionsTextCompensation,
]);

console.log(`  WHAT TO CHECK:
  01  Hard cut from RED to BLUE at 3s (no blend)
  02  Smooth crossfade at ~2.5s, total ~5.5s
  03  Four different transition types, each visually distinct
  04a Quick flash crossfade (0.2s) vs 04b slow blend (1.5s)
  05a Fades through black vs 05b fades through white
  06  Smooth transitions between Ken Burns images + video
  07  Text appears at correct times despite transition compression
`);

if (fail > 0) process.exit(1);
