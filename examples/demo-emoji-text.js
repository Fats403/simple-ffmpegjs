#!/usr/bin/env node

/**
 * Demo: Emoji Text Overlays
 *
 * Tests emoji handling: stripped by default, rendered when emojiFont is configured.
 *
 * Usage: node examples/demo-emoji-text.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Emoji stripped (default)                              ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  BLUE video with text "small dog, big heart"
 *                 Emoji is silently stripped. Clean text, no tofu.
 *
 * DEMO 2: Emoji stripped with fade animation                    ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video with "Movie night!"
 *                 Emoji stripped, fade-in/out animation still works.
 *
 * DEMO 3: Mixed emoji and plain text (stripped)                 ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  GREEN video with two overlays:
 *                 "Plain Text (no emoji)" (top)
 *                 "Emoji Text" (bottom — emoji stripped)
 *
 * DEMO 4: Emoji rendered with opt-in emojiFont                  ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  BLUE video with "Love this! ❤️" with border/shadow.
 *                 IF NotoEmoji font is present at /tmp/emoji-fonts/NotoEmoji-Regular.ttf,
 *                 the heart renders as a white outline shape. Otherwise stripped.
 *
 * DEMO 5: Emoji with pop animation (always stripped)            ~3s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0.0s - 3.0s  RED video with "Pop!" using pop animation.
 *                 Pop is not ASS-compatible, so emoji is stripped even with emojiFont.
 *
 * ============================================================================
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-emoji-text");

const EMOJI_FONT_PATH = "/tmp/emoji-fonts/NotoEmoji-Regular.ttf";
const hasEmojiFont = fs.existsSync(EMOJI_FONT_PATH);

// ============================================================================
// Demos
// ============================================================================

async function demo1_BasicEmojiStripped() {
  log("DEMO 1: Emoji stripped (default — no emojiFont)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "small dog, big heart 🐾", position: 0, end: 3, fontSize: 42, fontColor: "white", yPercent: 0.5 },
  ]);
  const out = path.join(OUTPUT_DIR, "01-emoji-stripped.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_FadeStripped() {
  log("DEMO 2: Emoji stripped with fade animation");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", text: "Movie night! 🎬🍿✨", position: 0.2, end: 2.8,
      fontSize: 44, fontColor: "white", yPercent: 0.5,
      animation: { type: "fade-in-out", in: 0.5, out: 0.5 },
    },
  ]);
  const out = path.join(OUTPUT_DIR, "02-fade-stripped.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_MixedStripped() {
  log("DEMO 3: Mixed emoji and plain text (stripped)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"), position: 0, end: 3 },
    { type: "text", text: "Plain Text (no emoji)", position: 0, end: 3, fontSize: 36, fontColor: "white", yPercent: 0.3 },
    { type: "text", text: "Emoji Text 🌟🎉", position: 0, end: 3, fontSize: 36, fontColor: "yellow", yPercent: 0.7 },
  ]);
  const out = path.join(OUTPUT_DIR, "03-mixed-stripped.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_EmojiOptIn() {
  if (!hasEmojiFont) {
    log("DEMO 4: Emoji opt-in (SKIPPED — no font at " + EMOJI_FONT_PATH + ")");
    console.log("  Download: https://github.com/google/fonts/raw/main/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf");
    console.log("  Save to:  " + EMOJI_FONT_PATH);
    return;
  }
  log("DEMO 4: Emoji rendered with opt-in emojiFont");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, emojiFont: EMOJI_FONT_PATH });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", text: "Love this! ❤️", position: 0, end: 3,
      fontSize: 48, fontColor: "white",
      borderColor: "black", borderWidth: 3,
      shadowColor: "black", shadowX: 2, shadowY: 2,
      yPercent: 0.5,
    },
  ]);
  const out = path.join(OUTPUT_DIR, "04-emoji-optin.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_PopAlwaysStripped() {
  log("DEMO 5: Emoji with pop animation (always stripped)");
  const emojiOpts = hasEmojiFont ? { emojiFont: EMOJI_FONT_PATH } : {};
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30, ...emojiOpts });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3 },
    {
      type: "text", text: "Pop! 🎉", position: 0.3, end: 2.7,
      fontSize: 56, fontColor: "white", yPercent: 0.5,
      animation: { type: "pop", in: 0.3 },
    },
  ]);
  const out = path.join(OUTPUT_DIR, "05-pop-stripped.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Emoji Text — Visual Demo", OUTPUT_DIR, [
  demo1_BasicEmojiStripped,
  demo2_FadeStripped,
  demo3_MixedStripped,
  demo4_EmojiOptIn,
  demo5_PopAlwaysStripped,
]);

console.log(`  WHAT TO CHECK:
  01  "small dog, big heart" — emoji stripped, clean text, no tofu
  02  "Movie night!" — emoji stripped, fade animation works
  03  Plain text (top) + "Emoji Text" (bottom, emoji stripped)
  04  "Love this!" + heart outline IF emojiFont present, otherwise stripped
  05  "Pop!" — emoji always stripped for non-ASS animations

  Emoji font: ${hasEmojiFont ? EMOJI_FONT_PATH : "NOT FOUND (demo 04 skipped)"}
  To enable demo 04, download Noto Emoji:
    curl -L -o ${EMOJI_FONT_PATH} "https://github.com/google/fonts/raw/main/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf"
`);

if (fail > 0) process.exit(1);
