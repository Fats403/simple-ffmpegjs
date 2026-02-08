#!/usr/bin/env node

/**
 * Demo: Karaoke & Subtitles
 *
 * Tests karaoke text (smooth, instant, timestamps, multiline),
 * SRT/VTT subtitle import, and mixed text+karaoke.
 *
 * Usage: node examples/demo-karaoke-and-subtitles.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Karaoke smooth (evenly distributed)                  ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.5-2.5s  "Never gonna give you up" on BLUE video.
 *             Words highlight left-to-right in yellow with smooth
 *             gradual fill. Each word fills proportionally.
 *
 * DEMO 2: Karaoke with word timestamps                          ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s   "One Two Three Four" on GREEN video.
 *          Words highlight according to explicit timestamps:
 *          "One" at 0s, "Two" at 0.7s, "Three" at 1.4s, "Four" at 2.1s.
 *          Green highlight color.
 *
 * DEMO 3: Karaoke instant style                                 ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.3-2.7s  "Words change instantly" on RED video.
 *             Instead of gradual fill, each word snaps to cyan
 *             highlight color all at once.
 *
 * DEMO 4: Multi-line karaoke                                    ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.3-2.7s  Two lines: "First line here" / "Second line below"
 *             on BLUE video. Highlight sweeps across first line,
 *             then continues onto second line.
 *
 * DEMO 5: SRT subtitle import                                   ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.5-1.5s  "First subtitle line" appears (white text, black border)
 *   1.8-2.8s  "Second subtitle line" appears
 *             Subtitles positioned at bottom of RED video.
 *
 * DEMO 6: VTT subtitle import                                   ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.5-1.5s  "First WebVTT cue" appears (yellow text)
 *   1.8-2.8s  "Second WebVTT cue" appears
 *             Subtitles positioned at bottom of BLUE video.
 *
 * DEMO 7: Mixed static text + karaoke                           ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s   RED video with:
 *          - "Music Video" static text at top (fade-in, white)
 *          - "Sing along with me" karaoke at bottom (magenta highlight)
 *          Both should render without interfering with each other.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-karaoke-and-subtitles");

// ============================================================================
// Demos
// ============================================================================

async function demo1_KaraokeSmooth() {
  log("DEMO 1: Karaoke smooth (evenly distributed)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", mode: "karaoke", text: "Never gonna give you up",
      position: 0.5, end: 2.5, fontSize: 36, fontColor: "#FFFFFF",
      highlightColor: "#FFFF00", yPercent: 0.85,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "01-karaoke-smooth.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_KaraokeTimestamps() {
  log("DEMO 2: Karaoke with word timestamps");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", mode: "karaoke", text: "One Two Three Four",
      position: 0, end: 3,
      words: [
        { text: "One", start: 0, end: 0.7 },
        { text: "Two", start: 0.7, end: 1.4 },
        { text: "Three", start: 1.4, end: 2.1 },
        { text: "Four", start: 2.1, end: 2.8 },
      ],
      fontSize: 48, fontColor: "#FFFFFF", highlightColor: "#00FF00", yPercent: 0.8,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "02-karaoke-timestamps.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_KaraokeInstant() {
  log("DEMO 3: Karaoke instant style");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", mode: "karaoke", text: "Words change instantly",
      position: 0.3, end: 2.7, fontSize: 36, fontColor: "#FFFFFF",
      highlightColor: "#00FFFF", highlightStyle: "instant", yPercent: 0.85,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "03-karaoke-instant.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_KaraokeMultiLine() {
  log("DEMO 4: Multi-line karaoke");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", mode: "karaoke", text: "First line here\nSecond line below",
      position: 0.3, end: 2.7, fontSize: 32, fontColor: "#FFFFFF",
      highlightColor: "#FFFF00", yPercent: 0.8,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "04-karaoke-multiline.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_SubtitleSRT() {
  log("DEMO 5: SRT subtitle import");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    {
      type: "subtitle", url: path.join(FIXTURES_DIR, "test-subtitles.srt"),
      fontSize: 28, fontColor: "#FFFFFF", borderColor: "#000000", borderWidth: 2,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "05-subtitle-srt.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo6_SubtitleVTT() {
  log("DEMO 6: VTT subtitle import");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    {
      type: "subtitle", url: path.join(FIXTURES_DIR, "test-subtitles.vtt"),
      fontSize: 28, fontColor: "#FFFF00", borderColor: "#000000",
    },
  ]);
  const out = path.join(OUTPUT_DIR, "06-subtitle-vtt.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo7_MixedTextKaraoke() {
  log("DEMO 7: Mixed static text + karaoke");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", text: "Music Video", position: 0, end: 3,
      mode: "static", fontSize: 32, fontColor: "#FFFFFF", yPercent: 0.1,
      animation: { type: "fade-in", in: 0.3 },
    },
    {
      type: "text", mode: "karaoke", text: "Sing along with me",
      position: 0.5, end: 2.5, fontSize: 28, fontColor: "#FFFFFF",
      highlightColor: "#FF00FF", yPercent: 0.85,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "07-mixed-text-karaoke.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Karaoke & Subtitles — Visual Demo", OUTPUT_DIR, [
  demo1_KaraokeSmooth,
  demo2_KaraokeTimestamps,
  demo3_KaraokeInstant,
  demo4_KaraokeMultiLine,
  demo5_SubtitleSRT,
  demo6_SubtitleVTT,
  demo7_MixedTextKaraoke,
]);

console.log(`  WHAT TO CHECK:
  01  Words highlight smoothly left-to-right in yellow
  02  Words highlight at specified timestamps in green
  03  Words snap to cyan instantly (no gradual fill)
  04  Highlight sweeps across two lines of text
  05  Two SRT subtitles appear at 0.5s and 1.8s (white, bordered)
  06  Two VTT subtitles appear at 0.5s and 1.8s (yellow)
  07  Static "Music Video" at top + karaoke at bottom simultaneously
`);

if (fail > 0) process.exit(1);
