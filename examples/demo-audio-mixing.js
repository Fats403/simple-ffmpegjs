#!/usr/bin/env node

/**
 * Demo: Audio Mixing
 *
 * Tests video clip audio volumes, background music, standalone audio clips,
 * music looping, and multi-source mixing.
 *
 * Usage: node examples/demo-audio-mixing.js
 *
 * ============================================================================
 * EXPECTED TIMELINE FOR EACH DEMO
 * ============================================================================
 *
 * DEMO 1: Video clip volumes                                    ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s   RED video at volume 0.3 (quiet sine tone at 440Hz)
 *   3-6s   BLUE video at volume 1.0 (loud sine tone at 550Hz)
 *          Listen for a clear volume jump at the 3s mark.
 *
 * DEMO 2: Background music                                      ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-6s   RED then BLUE video, both at volume 0.3
 *          Background music (440Hz sine) at volume 0.5 plays throughout.
 *          Music should be audibly louder than the video clip audio.
 *
 * DEMO 3: Standalone audio clip on timeline                     ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-3s   RED video (muted) — silence
 *   2-5s   Standalone audio clip (sine tone) starts at 2s
 *   3-6s   BLUE video (muted) — audio clip continues
 *          Sine tone should be heard only from 2s to 5s.
 *
 * DEMO 4: Music loop                                            ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-6s   RED then BLUE video (muted). Background music is a 5s clip
 *          with loop: true. Listen for continuous audio for the full 6s
 *          (the 5s clip restarts at 5s to cover the remaining 1s).
 *
 * DEMO 5: Multi-source mix                                      ~6s total
 * ───────────────────────────────────────────────────────────────────────────
 *   0-6s   RED then BLUE video at volume 0.2 (quiet)
 *   1-4s   Standalone audio clip at volume 0.5 (mid)
 *   0-6s   Background music at volume 0.3 (background layer)
 *          Should hear three distinct audio sources blended together.
 *          Video tone + standalone tone + music tone.
 *
 * ============================================================================
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import { FIXTURES_DIR, log, progress, getDuration, runDemos } from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-audio-mixing");

// ============================================================================
// Demos
// ============================================================================

async function demo1_VideoClipVolumes() {
  log("DEMO 1: Video clip volumes (quiet -> loud)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3, volume: 0.3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, volume: 1.0 },
  ]);
  const out = path.join(OUTPUT_DIR, "01-video-volumes.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_BackgroundMusic() {
  log("DEMO 2: Background music");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3, volume: 0.3 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, volume: 0.3 },
    { type: "music", url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"), volume: 0.5 },
  ]);
  const out = path.join(OUTPUT_DIR, "02-background-music.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_StandaloneAudio() {
  log("DEMO 3: Standalone audio clip on timeline");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3, volume: 0 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, volume: 0 },
    { type: "audio", url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"), position: 2, end: 5, volume: 0.8 },
  ]);
  const out = path.join(OUTPUT_DIR, "03-standalone-audio.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo4_MusicLoop() {
  log("DEMO 4: Music loop");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3, volume: 0 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, volume: 0 },
    { type: "music", url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"), volume: 0.6, loop: true },
  ]);
  const out = path.join(OUTPUT_DIR, "04-music-loop.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo5_MultiSourceMix() {
  log("DEMO 5: Multi-source mix (video + audio + music)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
  await project.load([
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"), position: 0, end: 3, volume: 0.2 },
    { type: "video", url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"), position: 3, end: 6, volume: 0.2 },
    { type: "audio", url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"), position: 1, end: 4, volume: 0.5 },
    { type: "music", url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"), volume: 0.3 },
  ]);
  const out = path.join(OUTPUT_DIR, "05-multi-source-mix.mp4");
  await project.export({ outputPath: out, preset: "ultrafast", onProgress: progress });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

// ============================================================================
// Main
// ============================================================================

const { fail } = await runDemos("Audio Mixing — Visual Demo", OUTPUT_DIR, [
  demo1_VideoClipVolumes,
  demo2_BackgroundMusic,
  demo3_StandaloneAudio,
  demo4_MusicLoop,
  demo5_MultiSourceMix,
]);

console.log(`  WHAT TO CHECK (listen carefully):
  01  Quiet tone 0-3s, loud tone 3-6s (clear volume jump)
  02  Background music audibly louder than video audio
  03  Silence until 2s, sine tone from 2-5s, silence after 5s
  04  Continuous audio for full 6s (loop restarts at 5s)
  05  Three layered tones: video + standalone (1-4s) + background
`);

if (fail > 0) process.exit(1);
