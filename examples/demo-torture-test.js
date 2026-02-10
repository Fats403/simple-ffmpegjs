#!/usr/bin/env node

/**
 * Demo: Torture Test
 *
 * Combines multiple features in complex scenarios to stress-test interactions
 * and catch edge-case regressions. These are intentionally dense compositions.
 *
 * Usage: node examples/demo-torture-test.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Kitchen sink                                         ~13.5s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s    RED video, fade-in "Welcome" text at top, karaoke at bottom
 *   ~2.5s   Fade transition (0.5s) -> BLUE video
 *   3-5.5s  BLUE video, "Chapter 1" text (shifted 0.5s by transition)
 *   5.5-9.5s Image (Ken Burns zoom-in), "Image Section" text
 *   9.5-13.5s DARK GREEN (#0a2e0a) trailing color clip, "The End" text
 *           1 transition x 0.5s = 0.5s compression.
 *           Background music plays throughout. Text watermark at top-right.
 *           Tests: transitions + Ken Burns + effects + text + karaoke + BGM +
 *           watermark + custom color trailing segment, all in one export.
 *
 * DEMO 2: Many clips with color fillers and transitions         ~17s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-1s    NAVY color clip
 *   1-3s    RED video
 *   ~2.5s   wipeleft (0.5s) -> image (Ken Burns pan-right)
 *   3-5s    Image clip (shifted by first transition)
 *   6-7s    NAVY color clip between segments
 *   6-8s    BLUE video
 *   ~7.5s   fade (0.5s) -> GREEN video
 *   8-10.5s GREEN video
 *  10.5-12s RED video
 *  14-18s   NAVY color clip with "Credits" text
 *           2 transitions x 0.5s = 1.0s compression.
 *           Tests: mixed visual types, transitions, and explicit color fillers.
 *
 * DEMO 3: Text-heavy (many simultaneous overlays)              ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s    BLUE video with 6 text overlays at once + timed effects:
 *           - "fade-in" (top-left, fades in)
 *           - "pop" (top-right, pops)
 *           - "typewriter" (center, types out)
 *           - "pulse" (mid-left, pulses)
 *           - "scale-in" (mid-right, scales up)
 *           - "fade-out" (bottom-center, fades out)
 *           All should render without conflict or visual glitches.
 *
 * DEMO 4: Edge cases                                            ~5.75s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-0.5s  Very short RED video clip (0.5s)
 *   ~0.25s  fade (0.25s) -> very short BLUE clip (0.5s)
 *   0.5-0.75s BLUE video clip continues
 *   0.75-2.75s GREEN video (shifted by 0.25s transition)
 *   2.75-5.75s Text on black trailing color clip.
 *           "Boundary Text" at clip boundary, compensated by 0.25s.
 *           Audio starts at 1.5s (mid-timeline), runs to 4.5s.
 *           1 transition x 0.25s = 0.25s compression.
 *           Tests: very short clips, short transitions, text at exact
 *           boundary, audio starting mid-timeline, trailing color clip.
 *
 * DEMO 5: MEGA CHAOS (~3 minutes)                              ~178s total
 * ───────────────────────────────────────────────────────────────────────────
 *   A ~3-minute behemoth exercising EVERY feature simultaneously.
 *   9 sections, 30+ visual clips, 20+ text overlays, every transition type,
 *   every Ken Burns mode, every text animation, karaoke, word-replace,
 *   word-sequential, SRT + VTT subtitles, standalone audio, background
 *   music (looped), text + image watermarks, and explicit color filler
 *   sections — all in a single export. See section comments below for details.
 *
 *   SECTION 1  (0-5s)      MAGENTA COLOR INTRO, karaoke intro
 *   SECTION 2  (5-23s)     OPENING — videos + image, 4 transitions, KB
 *   SECTION 3  (23-62s)    TRANSITION STORM — 13 clips, 12 transition types
 *   SECTION 4  (62-67s)    MAGENTA BREAK 1, "INTERMISSION" text
 *   SECTION 5  (67-103s)   KEN BURNS FESTIVAL — all 8 KB effects, 5 transitions
 *   SECTION 6  (103-106s)  MAGENTA BREAK 2
 *   SECTION 7  (106-140s)  TEXT STORM — every text animation + word modes
 *   SECTION 8  (140-170s)  KARAOKE + SUBTITLES — karaoke, SRT, VTT
 *   SECTION 9  (170-200s)  MAGENTA FINALE — cascading text
 *
 *   Transitions: 21 x 0.5s + 5 x 1.0s = 15.5s compression
 *   Raw end: ~200s → output: ~178.5s ≈ 2m 58s
 *   Background music + standalone audio + video audio all mixed.
 *   Text watermark (top-right) + image watermark (bottom-left) throughout.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-torture-test");

// Shorthand fixture paths
const RED = path.join(FIXTURES_DIR, "test-video-red-3s.mp4");
const BLUE = path.join(FIXTURES_DIR, "test-video-blue-3s.mp4");
const GREEN = path.join(FIXTURES_DIR, "test-video-green-3s.mp4");
const IMG = path.join(FIXTURES_DIR, "test-image.jpg");
const AUDIO = path.join(FIXTURES_DIR, "test-audio-5s.mp3");
const SRT = path.join(FIXTURES_DIR, "test-subtitles.srt");
const VTT = path.join(FIXTURES_DIR, "test-subtitles.vtt");
const WM_IMG = path.join(FIXTURES_DIR, "test-watermark.png");

// ============================================================================
// Demos
// ============================================================================

async function demo1_KitchenSink() {
  log("DEMO 1: Kitchen sink (everything combined)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: RED, position: 0, end: 3, volume: 0.2 },
    { type: "video", url: BLUE, position: 3, end: 6, volume: 0.2, transition: { type: "fade", duration: 0.5 } },
    { type: "image", url: IMG, position: 6, end: 10, kenBurns: "zoom-in" },
    { type: "color", color: "#0a2e0a", position: 10, end: 14 },
    { type: "effect", effect: "vignette", position: 0, end: 4, fadeIn: 0.6, fadeOut: 0.6, params: { amount: 0.6, angle: 0.65 } },
    { type: "effect", effect: "colorAdjust", position: 5.8, end: 10, fadeIn: 0.6, params: { amount: 0.75, contrast: 1.2, saturation: 1.35, gamma: 1.08, brightness: -0.04 } },
    { type: "text", text: "Welcome", position: 0.3, end: 2.5, fontSize: 40, fontColor: "white", yPercent: 0.12, animation: { type: "fade-in", in: 0.5 } },
    { type: "text", text: "Chapter 1", position: 3.5, end: 5.5, fontSize: 36, fontColor: "yellow", yPercent: 0.12 },
    { type: "text", text: "Image Section", position: 6.5, end: 9.5, fontSize: 32, fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.12 },
    { type: "text", text: "The End", position: 9, end: 14, fontSize: 52, fontColor: "white", yPercent: 0.5, animation: { type: "fade-in-out", in: 0.5, out: 0.5 } },
    { type: "text", mode: "karaoke", text: "Sing along now", position: 0.5, end: 2.5, fontSize: 28, fontColor: "#FFFFFF", highlightColor: "#FFFF00", yPercent: 0.88 },
    { type: "music", url: AUDIO, volume: 0.3, loop: true },
  ]);
  const out = path.join(OUTPUT_DIR, "01-kitchen-sink.mp4");
  await project.export({
    outputPath: out, preset: "ultrafast", onProgress: progress,
    watermark: { type: "text", text: "@torture-test", position: "top-right", fontSize: 18, fontColor: "#FFFFFF", opacity: 0.6, margin: 10 },
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_ManyClipsColorFillersTransitions() {
  log("DEMO 2: Many clips with color fillers and transitions");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "color", color: "navy", position: 0, end: 1 },
    { type: "video", url: RED, position: 1, end: 3 },
    { type: "image", url: IMG, position: 3, end: 6, kenBurns: "pan-right", transition: { type: "wipeleft", duration: 0.5 } },
    { type: "color", color: "navy", position: 6, end: 7 },
    { type: "video", url: BLUE, position: 7, end: 9 },
    { type: "video", url: GREEN, position: 9, end: 12, transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: RED, position: 12, end: 14 },
    { type: "color", color: "navy", position: 14, end: 18 },
    { type: "effect", effect: "filmGrain", position: 1, end: 14, fadeIn: 0.4, fadeOut: 0.6, params: { amount: 0.28, temporal: true } },
    { type: "text", text: "Leading filler", position: 0, end: 1, fontSize: 28, fontColor: "white", yPercent: 0.5 },
    { type: "text", text: "Middle filler", position: 6, end: 7, fontSize: 28, fontColor: "white", yPercent: 0.5 },
    { type: "text", text: "Credits", position: 13, end: 18, fontSize: 44, fontColor: "white", yPercent: 0.5, animation: { type: "fade-in", in: 0.5 } },
  ]);
  const out = path.join(OUTPUT_DIR, "02-many-clips-color-fillers.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_TextHeavy() {
  log("DEMO 3: Text-heavy (6 simultaneous animations)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: BLUE, position: 0, end: 3 },
    { type: "effect", effect: "gaussianBlur", position: 0, end: 1.1, fadeOut: 0.35, params: { amount: 0.9, sigma: 8 } },
    { type: "effect", effect: "colorAdjust", position: 1.1, end: 3, fadeIn: 0.35, params: { amount: 0.6, saturation: 1.45, contrast: 1.15, gamma: 1.05 } },
    { type: "text", text: "fade-in", position: 0.2, end: 2.8, fontSize: 28, fontColor: "white", xPercent: 0.2, yPercent: 0.15, animation: { type: "fade-in", in: 0.5 } },
    { type: "text", text: "pop", position: 0.2, end: 2.8, fontSize: 28, fontColor: "yellow", xPercent: 0.8, yPercent: 0.15, animation: { type: "pop", in: 0.3 } },
    { type: "text", text: "typewriter effect!", position: 0.2, end: 2.8, fontSize: 28, fontColor: "cyan", xPercent: 0.5, yPercent: 0.4, animation: { type: "typewriter", speed: 12 } },
    { type: "text", text: "pulse", position: 0.2, end: 2.8, fontSize: 28, fontColor: "#FF8800", xPercent: 0.2, yPercent: 0.65, animation: { type: "pulse", speed: 2, intensity: 0.2 } },
    { type: "text", text: "scale-in", position: 0.2, end: 2.8, fontSize: 28, fontColor: "#88FF00", xPercent: 0.8, yPercent: 0.65, animation: { type: "scale-in", in: 0.5 } },
    { type: "text", text: "fade-out", position: 0.2, end: 2.8, fontSize: 28, fontColor: "white", xPercent: 0.5, yPercent: 0.88, animation: { type: "fade-out", out: 1.0 } },
  ]);
  const out = path.join(OUTPUT_DIR, "03-text-heavy.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_EdgeCases() {
  log("DEMO 4: Edge cases (short clips, boundaries, mid-timeline audio)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: RED, position: 0, end: 0.5 },
    { type: "video", url: BLUE, position: 0.5, end: 1, transition: { type: "fade", duration: 0.25 } },
    { type: "video", url: GREEN, position: 1, end: 3 },
    { type: "color", color: "black", position: 3, end: 6 },
    { type: "effect", effect: "vignette", position: 0, end: 3, fadeIn: 0.2, fadeOut: 0.2, params: { amount: 0.45 } },
    { type: "text", text: "Boundary Text", position: 3, end: 6, fontSize: 44, fontColor: "white", yPercent: 0.5, animation: { type: "fade-in", in: 0.3 } },
    { type: "audio", url: AUDIO, position: 1.5, end: 4.5, volume: 0.6 },
  ]);
  const out = path.join(OUTPUT_DIR, "04-edge-cases.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_MegaChaos() {
  log("DEMO 5: MEGA CHAOS (~3 minutes of pure madness)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });

  await project.load([
    // ═══════════════════════════════════════════════════════════════
    // SECTION 1: Intro color bed (0-5s) — magenta
    // ═══════════════════════════════════════════════════════════════
    { type: "color", color: "#8B008B", position: 0, end: 5 },
    { type: "text", mode: "karaoke", text: "Welcome to the chaos",
      position: 0.3, end: 4.5, fontSize: 48, fontColor: "#FFFFFF",
      highlightColor: "#FFD700", yPercent: 0.45 },
    { type: "text", text: "MEGA TORTURE TEST", position: 0.5, end: 4.5,
      fontSize: 24, fontColor: "#CCCCCC", yPercent: 0.65,
      animation: { type: "pulse", speed: 3, intensity: 0.3 } },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2: Opening salvo (5-23s) — videos + image + transitions
    // ═══════════════════════════════════════════════════════════════
    { type: "effect", effect: "vignette", position: 5, end: 23, fadeIn: 1, fadeOut: 1, params: { amount: 0.5, angle: 0.6 } },
    { type: "video", url: RED, position: 5, end: 8, volume: 0.3 },
    { type: "video", url: BLUE, position: 8, end: 11, volume: 0.3,
      transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: GREEN, position: 11, end: 14,
      transition: { type: "wipeleft", duration: 0.5 } },
    { type: "image", url: IMG, position: 14, end: 19, kenBurns: "zoom-in",
      transition: { type: "fadeblack", duration: 0.5 } },
    { type: "video", url: RED, position: 19, end: 22, volume: 0.5,
      transition: { type: "circleopen", duration: 0.5 } },
    { type: "color", color: "#8B008B", position: 22, end: 23 },
    // Section 2 text
    { type: "text", text: "RED", position: 5.2, end: 7.8, fontSize: 36,
      fontColor: "#FF4444", borderColor: "white", borderWidth: 2,
      yPercent: 0.12, animation: { type: "fade-in", in: 0.3 } },
    { type: "text", text: "FADE → BLUE", position: 8.2, end: 10.5, fontSize: 30,
      fontColor: "#4488FF", yPercent: 0.12, animation: { type: "pop", in: 0.3 } },
    { type: "text", text: "WIPE → GREEN", position: 11.2, end: 13.5, fontSize: 30,
      fontColor: "#44FF44", yPercent: 0.12, animation: { type: "scale-in", in: 0.4 } },
    { type: "text", text: "Ken Burns zoom-in", position: 14.5, end: 18.5, fontSize: 26,
      fontColor: "white", shadowColor: "black", shadowX: 2, shadowY: 2,
      yPercent: 0.12, animation: { type: "typewriter", speed: 15 } },
    { type: "text", text: "CIRCLE OPEN", position: 19.2, end: 21.5, fontSize: 30,
      fontColor: "#FF8800", yPercent: 0.12, animation: { type: "pop-bounce", in: 0.4 } },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3: Transition storm (23-62s) — cycle through transition types
    //   13 clips, 12 different transitions
    // ═══════════════════════════════════════════════════════════════
    { type: "effect", effect: "filmGrain", position: 23, end: 62, fadeIn: 0.8, fadeOut: 1, params: { amount: 0.26, temporal: true } },
    { type: "video", url: BLUE, position: 23, end: 26,
      transition: { type: "wiperight", duration: 0.5 } },
    { type: "video", url: GREEN, position: 26, end: 29,
      transition: { type: "slideright", duration: 0.5 } },
    { type: "image", url: IMG, position: 29, end: 33, kenBurns: "pan-right",
      transition: { type: "slideleft", duration: 0.5 } },
    { type: "video", url: RED, position: 33, end: 36,
      transition: { type: "dissolve", duration: 0.5 } },
    { type: "video", url: BLUE, position: 36, end: 39,
      transition: { type: "pixelize", duration: 0.5 } },
    { type: "video", url: GREEN, position: 39, end: 42,
      transition: { type: "radial", duration: 0.5 } },
    { type: "image", url: IMG, position: 42, end: 46, kenBurns: "pan-left",
      transition: { type: "diagbl", duration: 0.5 } },
    { type: "video", url: RED, position: 46, end: 49,
      transition: { type: "hblur", duration: 0.5 } },
    { type: "video", url: BLUE, position: 49, end: 52,
      transition: { type: "squeezeh", duration: 0.5 } },
    { type: "video", url: GREEN, position: 52, end: 55,
      transition: { type: "fadewhite", duration: 0.5 } },
    { type: "image", url: IMG, position: 55, end: 59, kenBurns: "zoom-out",
      transition: { type: "wipeup", duration: 0.5 } },
    { type: "video", url: RED, position: 59, end: 62,
      transition: { type: "diagtr", duration: 0.5 } },
    // Section 3 persistent text
    { type: "text", text: "TRANSITION STORM", position: 23, end: 62,
      fontSize: 22, fontColor: "yellow", borderColor: "black", borderWidth: 2,
      yPercent: 0.04, animation: { type: "pulse", speed: 2, intensity: 0.15 } },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4: Break 1 (62-67s) — magenta
    // ═══════════════════════════════════════════════════════════════
    { type: "color", color: "#8B008B", position: 62, end: 67 },
    { type: "text", text: "INTERMISSION", position: 62, end: 67,
      fontSize: 56, fontColor: "white", yPercent: 0.35,
      animation: { type: "fade-in-out", in: 0.8, out: 0.8 } },
    { type: "text", text: "...more chaos coming...", position: 63, end: 66,
      fontSize: 24, fontColor: "#AAAAAA", yPercent: 0.55,
      animation: { type: "pulse", speed: 1.5, intensity: 0.2 } },
    { type: "text", text: "Section 5: Ken Burns", position: 64, end: 67,
      fontSize: 20, fontColor: "#FFCC00", yPercent: 0.75,
      animation: { type: "typewriter", speed: 12 } },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5: Ken Burns festival (67-103s) — all 8 effects
    //   6 images, 5 transitions (1s each)
    // ═══════════════════════════════════════════════════════════════
    { type: "effect", effect: "gaussianBlur", position: 67, end: 103, fadeIn: 0.6, fadeOut: 0.6, params: { amount: 0.5, sigma: 5.5 } },
    { type: "image", url: IMG, position: 67, end: 73, kenBurns: "zoom-in" },
    { type: "image", url: IMG, position: 73, end: 79, kenBurns: "zoom-out",
      transition: { type: "fade", duration: 1 } },
    { type: "image", url: IMG, position: 79, end: 85, kenBurns: "pan-left",
      transition: { type: "wipeleft", duration: 1 } },
    { type: "image", url: IMG, position: 85, end: 91, kenBurns: "pan-right",
      transition: { type: "dissolve", duration: 1 } },
    { type: "image", url: IMG, position: 91, end: 97,
      kenBurns: { type: "smart", anchor: "bottom" },
      transition: { type: "circleclose", duration: 1 } },
    { type: "image", url: IMG, position: 97, end: 103,
      kenBurns: { type: "custom", startX: 0.1, startY: 0.9, endX: 0.9, endY: 0.1, startZoom: 1.2, endZoom: 1.5 },
      transition: { type: "fadeblack", duration: 1 } },
    // Section 5 labels
    { type: "text", text: "zoom-in", position: 67.5, end: 72, fontSize: 28,
      fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.88 },
    { type: "text", text: "zoom-out", position: 73.5, end: 78, fontSize: 28,
      fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.88 },
    { type: "text", text: "pan-left", position: 79.5, end: 84, fontSize: 28,
      fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.88 },
    { type: "text", text: "pan-right", position: 85.5, end: 90, fontSize: 28,
      fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.88 },
    { type: "text", text: "smart (bottom)", position: 91.5, end: 96, fontSize: 28,
      fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.88 },
    { type: "text", text: "custom diagonal", position: 97.5, end: 102, fontSize: 28,
      fontColor: "white", borderColor: "black", borderWidth: 2, yPercent: 0.88 },
    { type: "text", text: "KEN BURNS FESTIVAL", position: 67, end: 103,
      fontSize: 22, fontColor: "#FFD700", borderColor: "black", borderWidth: 2,
      yPercent: 0.04 },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6: Break 2 (103-106s) — brief magenta
    // ═══════════════════════════════════════════════════════════════
    { type: "color", color: "#8B008B", position: 103, end: 106 },
    { type: "text", text: "ROUND 3", position: 103, end: 106,
      fontSize: 64, fontColor: "#FF00FF", yPercent: 0.45,
      animation: { type: "pop-bounce", in: 0.5 } },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 7: Text animation storm (106-140s)
    //   Every text animation + word-replace + word-sequential
    // ═══════════════════════════════════════════════════════════════
    { type: "effect", effect: "colorAdjust", position: 106, end: 140, fadeIn: 1, fadeOut: 1, params: { amount: 0.72, saturation: 1.35, contrast: 1.18, gamma: 1.08, brightness: -0.03 } },
    { type: "video", url: RED, position: 106, end: 109, volume: 0.15 },
    { type: "video", url: BLUE, position: 109, end: 112, volume: 0.15,
      transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: GREEN, position: 112, end: 115,
      transition: { type: "wipeleft", duration: 0.5 } },
    { type: "image", url: IMG, position: 115, end: 121, kenBurns: "pan-up",
      transition: { type: "slideright", duration: 0.5 } },
    { type: "video", url: RED, position: 121, end: 124, volume: 0.15,
      transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: BLUE, position: 124, end: 127,
      transition: { type: "dissolve", duration: 0.5 } },
    { type: "image", url: IMG, position: 127, end: 133, kenBurns: "pan-down",
      transition: { type: "wiperight", duration: 0.5 } },
    { type: "video", url: GREEN, position: 133, end: 136,
      transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: RED, position: 136, end: 139,
      transition: { type: "squeezev", duration: 0.5 } },
    { type: "color", color: "#8B008B", position: 139, end: 140 },
    // All text animations in section 7 (overlapping intentionally)
    { type: "text", text: "fade-in here!", position: 106.5, end: 110, fontSize: 26,
      fontColor: "white", xPercent: 0.25, yPercent: 0.15,
      animation: { type: "fade-in", in: 0.5 } },
    { type: "text", text: "fade-out bye!", position: 106.5, end: 110, fontSize: 26,
      fontColor: "#FF8888", xPercent: 0.75, yPercent: 0.15,
      animation: { type: "fade-out", out: 1.5 } },
    { type: "text", text: "POP!", position: 110.5, end: 114, fontSize: 36,
      fontColor: "yellow", xPercent: 0.25, yPercent: 0.15,
      animation: { type: "pop", in: 0.4 } },
    { type: "text", text: "BOUNCE!", position: 110.5, end: 114, fontSize: 36,
      fontColor: "#FF44FF", xPercent: 0.75, yPercent: 0.15,
      animation: { type: "pop-bounce", in: 0.5 } },
    { type: "text", text: "scale it up", position: 114.5, end: 118, fontSize: 30,
      fontColor: "#00FFCC", xPercent: 0.3, yPercent: 0.15,
      animation: { type: "scale-in", in: 0.6 } },
    { type: "text", text: "PULSE PULSE", position: 114.5, end: 118, fontSize: 30,
      fontColor: "#FFCC00", xPercent: 0.7, yPercent: 0.15,
      animation: { type: "pulse", speed: 3, intensity: 0.25 } },
    { type: "text", text: "typing out character by character", position: 118.5, end: 124,
      fontSize: 26, fontColor: "white", yPercent: 0.15,
      animation: { type: "typewriter", speed: 15 } },
    { type: "text", text: "fade in AND out combo", position: 124, end: 130,
      fontSize: 32, fontColor: "#88CCFF", yPercent: 0.15,
      animation: { type: "fade-in-out", in: 0.8, out: 0.8 } },
    // Styled text with background, shadow, border
    { type: "text", text: "STYLED TEXT", position: 118, end: 124,
      fontSize: 32, fontColor: "#FFFFFF", borderColor: "#FF0000", borderWidth: 3,
      shadowColor: "#000000", shadowX: 3, shadowY: 3,
      backgroundColor: "#000000", backgroundOpacity: 0.5, padding: 10,
      yPercent: 0.85 },
    // Word-replace mode
    { type: "text", text: "Word Replace Mode Active Now",
      mode: "word-replace", position: 130, end: 135,
      wordTimestamps: [0, 1, 2, 3, 4],
      fontSize: 40, fontColor: "white", yPercent: 0.5 },
    // Word-sequential mode
    { type: "text", text: "Words Appearing One By One",
      mode: "word-sequential", position: 135, end: 140,
      wordTimestamps: [0, 1, 2, 3, 4],
      fontSize: 36, fontColor: "#FFDD00", yPercent: 0.5 },
    // Section 7 header
    { type: "text", text: "TEXT ANIMATION STORM", position: 106, end: 140,
      fontSize: 20, fontColor: "#FF00FF", borderColor: "black", borderWidth: 2,
      yPercent: 0.04, animation: { type: "pulse", speed: 2, intensity: 0.15 } },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 8: Karaoke + subtitles (140-170s)
    // ═══════════════════════════════════════════════════════════════
    { type: "video", url: BLUE, position: 140, end: 143, volume: 0.2 },
    { type: "video", url: GREEN, position: 143, end: 146,
      transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: RED, position: 146, end: 149, volume: 0.2,
      transition: { type: "wipeleft", duration: 0.5 } },
    { type: "video", url: BLUE, position: 149, end: 152,
      transition: { type: "slideright", duration: 0.5 } },
    { type: "video", url: GREEN, position: 152, end: 155,
      transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: RED, position: 155, end: 158, volume: 0.2,
      transition: { type: "dissolve", duration: 0.5 } },
    { type: "video", url: BLUE, position: 158, end: 161,
      transition: { type: "circleopen", duration: 0.5 } },
    { type: "video", url: GREEN, position: 161, end: 164,
      transition: { type: "wipedown", duration: 0.5 } },
    { type: "video", url: RED, position: 164, end: 167, volume: 0.2,
      transition: { type: "fade", duration: 0.5 } },
    { type: "video", url: BLUE, position: 167, end: 170,
      transition: { type: "hblur", duration: 0.5 } },
    // Karaoke overlay (smooth)
    { type: "text", mode: "karaoke", text: "Karaoke over chaos video",
      position: 140, end: 146, fontSize: 36, fontColor: "#FFFFFF",
      highlightColor: "#FF0000", yPercent: 0.85, highlightStyle: "smooth" },
    // Karaoke overlay (instant)
    { type: "text", mode: "karaoke", text: "Instant highlight mode here",
      position: 147, end: 153, fontSize: 36, fontColor: "#FFFFFF",
      highlightColor: "#00FF00", yPercent: 0.85, highlightStyle: "instant" },
    // SRT subtitles (offset to ~153s on timeline)
    { type: "subtitle", url: SRT, position: 153, fontSize: 32,
      fontColor: "#FFFF00", borderColor: "#000000", borderWidth: 2 },
    // VTT subtitles (offset to ~157s on timeline)
    { type: "subtitle", url: VTT, position: 157, fontSize: 32,
      fontColor: "#00FFFF", borderColor: "#000000", borderWidth: 2 },
    // Karaoke with word timestamps
    { type: "text", mode: "karaoke", text: "Final karaoke words here now",
      position: 162, end: 168, fontSize: 34, fontColor: "#FFFFFF",
      highlightColor: "#FFD700",
      wordTimestamps: [0, 1.2, 2.4, 3.6, 4.8],
      yPercent: 0.85 },
    // Section 8 header
    { type: "text", text: "KARAOKE + SUBTITLES", position: 140, end: 170,
      fontSize: 20, fontColor: "#00FFCC", borderColor: "black", borderWidth: 2,
      yPercent: 0.04 },

    // ═══════════════════════════════════════════════════════════════
    // SECTION 9: Magenta finale bed (170-200s)
    //   Text cascading in and out = grand finale
    // ═══════════════════════════════════════════════════════════════
    { type: "color", color: "#8B008B", position: 170, end: 200 },
    { type: "text", text: "THE CHAOS", position: 170, end: 200,
      fontSize: 52, fontColor: "white", yPercent: 0.25,
      animation: { type: "fade-in", in: 1.0 } },
    { type: "text", text: "IS OVER", position: 173, end: 200,
      fontSize: 52, fontColor: "#FFD700", yPercent: 0.4,
      animation: { type: "fade-in", in: 1.0 } },
    { type: "text", text: "...or is it?", position: 176, end: 185,
      fontSize: 36, fontColor: "#FF44FF", yPercent: 0.55,
      animation: { type: "fade-in-out", in: 0.5, out: 1.0 } },
    { type: "text", text: "SURVIVED", position: 180, end: 195,
      fontSize: 64, fontColor: "#00FF00", yPercent: 0.6,
      animation: { type: "pop-bounce", in: 0.6 } },
    { type: "text", text: "You made it through the torture test", position: 185, end: 198,
      fontSize: 24, fontColor: "#CCCCCC", yPercent: 0.75,
      animation: { type: "typewriter", speed: 15 } },
    { type: "text", text: "THE END", position: 190, end: 200,
      fontSize: 72, fontColor: "white", borderColor: "#8B008B", borderWidth: 4,
      yPercent: 0.45, animation: { type: "fade-in-out", in: 1.0, out: 1.5 } },
    { type: "text", mode: "karaoke", text: "Goodbye from the chaos",
      position: 172, end: 180, fontSize: 30, fontColor: "#FFFFFF",
      highlightColor: "#FF4444", yPercent: 0.88 },

    // ═══════════════════════════════════════════════════════════════
    // AUDIO LAYER: Background music + standalone audio
    // ═══════════════════════════════════════════════════════════════
    { type: "music", url: AUDIO, volume: 0.15, loop: true },
    { type: "audio", url: AUDIO, position: 62, end: 67, volume: 0.5 },
    { type: "audio", url: AUDIO, position: 170, end: 175, volume: 0.4 },
  ]);

  const out = path.join(OUTPUT_DIR, "05-mega-chaos.mp4");
  await project.export({
    outputPath: out, preset: "ultrafast",
    onProgress: progress,
    watermark: { type: "text", text: "CHAOS", position: "top-right",
      fontSize: 16, fontColor: "#FFFFFF", opacity: 0.4, margin: 8 },
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Torture Test — Visual Demo", OUTPUT_DIR, [
  demo1_KitchenSink,
  demo2_ManyClipsColorFillersTransitions,
  demo3_TextHeavy,
  demo4_EdgeCases,
  demo5_MegaChaos,
]);

console.log(`  WHAT TO CHECK:
  01  Everything renders: transition, Ken Burns, text, karaoke,
      watermark, BGM, and dark green outro color clip — no crashes
  02  Leading/middle/trailing navy filler clips; mixed visual types
      and transitions; "Credits" text visible on trailing filler
  03  All 6 text animations render simultaneously without glitches
  04  Short clips don't crash; text starts at clip boundary;
      audio starts at 1.5s; trailing color clip extends to ~5.75s
  05  MEGA: ~3 minute video renders without crashing. Verify:
      - Magenta intro color clip with karaoke intro (0-5s)
      - Rapid transitions through many types (5-60s)
      - Magenta intermission filler clip (60s area)
      - All Ken Burns effects on images with labels (67-103s area)
      - Another brief magenta filler clip (103-106s area)
      - Every text animation type visible (106-140s area)
      - Karaoke smooth + instant, SRT + VTT subtitles (140-170s area)
      - Cascading text on magenta finale color clip (170s+)
      - Background music throughout, standalone audio on filler sections
      - Text watermark ("CHAOS") at top-right
`);

if (fail > 0) process.exit(1);
