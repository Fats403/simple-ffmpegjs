#!/usr/bin/env node

/**
 * simple-ffmpeg Examples
 *
 * This script generates test media fixtures and demonstrates all major features
 * of the simple-ffmpeg library. Run it to verify your installation and see
 * examples of different capabilities.
 *
 * Usage: node examples/run-examples.js
 *
 * Output will be saved to examples/output/
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import SIMPLEFFMPEG
import SIMPLEFFMPEG from "../index.mjs";

const OUTPUT_DIR = path.join(__dirname, "output");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

// ============================================================================
// Utility Functions
// ============================================================================

function ensureDirectories() {
  [OUTPUT_DIR, FIXTURES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function log(message) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${message}`);
  console.log("=".repeat(60));
}

function checkFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Fixture Generation
// ============================================================================

async function generateFixtures() {
  log("Generating test fixtures...");

  const fixtures = [
    {
      name: "test-video-red-3s.mp4",
      cmd: `ffmpeg -y -f lavfi -i "color=c=red:s=640x480:d=3,format=yuv420p" -f lavfi -i "sine=frequency=440:duration=3" -shortest -c:v libx264 -preset ultrafast -c:a aac`,
    },
    {
      name: "test-video-blue-3s.mp4",
      cmd: `ffmpeg -y -f lavfi -i "color=c=blue:s=640x480:d=3,format=yuv420p" -f lavfi -i "sine=frequency=550:duration=3" -shortest -c:v libx264 -preset ultrafast -c:a aac`,
    },
    {
      name: "test-video-green-3s.mp4",
      cmd: `ffmpeg -y -f lavfi -i "color=c=green:s=640x480:d=3,format=yuv420p" -f lavfi -i "sine=frequency=660:duration=3" -shortest -c:v libx264 -preset ultrafast -c:a aac`,
    },
    {
      name: "test-audio-5s.mp3",
      cmd: `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" -c:a libmp3lame -b:a 128k`,
    },
    {
      name: "test-image.jpg",
      // Grid pattern with corner labels (A,B,C,D) and center marker - makes Ken Burns effects visible
      cmd: `ffmpeg -y -f lavfi -i "color=c=#336699:s=640x480:d=1,drawgrid=w=80:h=80:t=2:c=white@0.5,drawtext=text='A':fontsize=100:fontcolor=white:x=60:y=40,drawtext=text='B':fontsize=100:fontcolor=white:x=520:y=40,drawtext=text='C':fontsize=100:fontcolor=white:x=60:y=340,drawtext=text='D':fontsize=100:fontcolor=white:x=520:y=340,drawbox=x=280:y=200:w=80:h=80:c=yellow:t=fill" -frames:v 1`,
    },
    {
      name: "test-watermark.png",
      cmd: `ffmpeg -y -f lavfi -i "color=c=white:s=64x64:d=1,format=rgba" -frames:v 1`,
    },
  ];

  for (const fixture of fixtures) {
    const outputPath = path.join(FIXTURES_DIR, fixture.name);
    if (!fs.existsSync(outputPath)) {
      console.log(`  Creating ${fixture.name}...`);
      try {
        execSync(`${fixture.cmd} "${outputPath}"`, { stdio: "ignore" });
      } catch (e) {
        console.error(`  Failed to create ${fixture.name}: ${e.message}`);
      }
    } else {
      console.log(`  ${fixture.name} already exists`);
    }
  }
}

// ============================================================================
// Example Functions
// ============================================================================

async function example01_BasicConcatenation() {
  log("Example 01: Basic Video Concatenation");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 3,
      end: 6,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "01-basic-concat.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example02_CrossfadeTransitions() {
  log("Example 02: Crossfade Transitions");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 3,
      end: 6,
      transition: { type: "fade", duration: 0.5 },
    },
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"),
      position: 6,
      end: 9,
      transition: { type: "wipeleft", duration: 0.5 },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "02-crossfade.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example03_TextOverlays() {
  log("Example 03: Text Overlays with Animations");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      text: "Hello World!",
      position: 0.5,
      end: 2.5,
      fontSize: 48,
      fontColor: "white",
      yPercent: 0.5,
      animation: { type: "fade-in-out", in: 0.3, out: 0.3 },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "03-text-overlays.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example04_BackgroundMusic() {
  log("Example 04: Background Music");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
      volume: 0.3,
    },
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 3,
      end: 6,
      volume: 0.3,
    },
    {
      type: "music",
      url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"),
      volume: 0.5,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "04-background-music.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example05_KenBurnsImages() {
  log("Example 05: Ken Burns Effects Demo");

  // Each effect: 4s duration + 1s black gap = 5s per effect, 6 effects = 30s total
  const effects = [
    { name: "zoom-in", start: 0 },
    { name: "zoom-out", start: 5 },
    { name: "pan-left", start: 10 },
    { name: "pan-right", start: 15 },
    { name: "pan-up", start: 20 },
    { name: "pan-down", start: 25 },
  ];

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
    fillGaps: "black", // 1 second black gaps between each effect
  });

  const clips = [];

  // Add image clips with Ken Burns effects and text labels
  for (const effect of effects) {
    // Image with Ken Burns effect (4 seconds)
    clips.push({
      type: "image",
      url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: effect.start,
      end: effect.start + 4,
      kenBurns: effect.name,
    });

    // Label showing which effect is playing
    clips.push({
      type: "text",
      text: effect.name,
      position: effect.start,
      end: effect.start + 4,
      fontSize: 36,
      fontColor: "white",
      borderColor: "black",
      borderWidth: 2,
      yPercent: 0.9,
    });
  }

  await project.load(clips);

  const output = path.join(OUTPUT_DIR, "05-ken-burns.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example05b_ImageSlideshow() {
  log("Example 05b: Image Slideshow with Transitions");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  // A typical slideshow: images with crossfade transitions and Ken Burns for movement
  await project.load([
    {
      type: "image",
      url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: 0,
      end: 4,
      kenBurns: "zoom-in",
    },
    {
      type: "image",
      url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: 4,
      end: 8,
      kenBurns: "pan-right",
      transition: { type: "fade", duration: 1 },
    },
    {
      type: "image",
      url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: 8,
      end: 12,
      kenBurns: "zoom-out",
      transition: { type: "fade", duration: 1 },
    },
    // Background music for slideshow feel
    {
      type: "music",
      url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"),
      volume: 0.4,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "05b-slideshow.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example06_GapFilling() {
  log("Example 06: Gap Filling with Black Frames");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
    fillGaps: "black",
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 1,
      end: 4,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "06-gap-filling.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example07_QualitySettings() {
  log("Example 07: Quality Settings (CRF comparison)");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "07-high-quality.mp4");
  await project.export({
    outputPath: output,
    crf: 18,
    preset: "slow",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example08_ResolutionScaling() {
  log("Example 08: Resolution Scaling");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "08-scaled.mp4");
  await project.export({
    outputPath: output,
    outputWidth: 320,
    outputHeight: 240,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example09_Metadata() {
  log("Example 09: Metadata Embedding");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "09-with-metadata.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    metadata: {
      title: "Simple FFmpeg Example",
      artist: "Demo",
      date: new Date().getFullYear().toString(),
    },
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example10_Thumbnail() {
  log("Example 10: Thumbnail Generation");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "10-with-thumbnail.mp4");
  const thumbnailOutput = path.join(OUTPUT_DIR, "10-thumbnail.jpg");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    thumbnail: {
      outputPath: thumbnailOutput,
      time: 1.5,
      width: 320,
    },
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
  console.log(`  Thumbnail: ${thumbnailOutput}`);
}

async function example11_ComplexComposition() {
  log("Example 11: Complex Multi-Track Composition");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 3,
      end: 6,
      transition: { type: "fade", duration: 0.5 },
    },
    {
      type: "text",
      text: "Title Card",
      position: 0.5,
      end: 2.5,
      fontSize: 56,
      fontColor: "white",
      yPercent: 0.3,
      animation: { type: "pop", in: 0.3 },
    },
    {
      type: "text",
      text: "The End",
      position: 4,
      end: 5.5,
      fontSize: 48,
      fontColor: "yellow",
      yPercent: 0.5,
      animation: { type: "fade-in-out", in: 0.3, out: 0.3 },
    },
    {
      type: "music",
      url: path.join(FIXTURES_DIR, "test-audio-5s.mp3"),
      volume: 0.3,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "11-complex-composition.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example12_WordByWordText() {
  log("Example 12: Word-by-Word Text Animation");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      mode: "word-replace",
      text: "One Two Three",
      position: 0.5,
      end: 2.5,
      wordTimestamps: [0.5, 1.0, 1.5, 2.0],
      fontSize: 64,
      fontColor: "white",
      yPercent: 0.5,
      animation: { type: "pop", in: 0.15 },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "12-word-by-word.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

// ============================================================================
// New Feature Examples
// ============================================================================

async function example13_PlatformPresets() {
  log("Example 13: Platform Presets (TikTok)");

  // Show available presets
  console.log("  Available presets:", SIMPLEFFMPEG.getPresetNames().join(", "));

  const project = new SIMPLEFFMPEG({
    preset: "tiktok", // Uses 1080x1920 @ 30fps
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      text: "TikTok Ready!",
      position: 0.5,
      end: 2.5,
      fontSize: 72,
      fontColor: "white",
      yPercent: 0.5,
      animation: { type: "pop-bounce", in: 0.3 },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "13-tiktok-preset.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example14_TextAnimationTypewriter() {
  log("Example 14: Typewriter Text Animation");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      text: "Typewriter Effect!",
      position: 0.5,
      end: 2.5,
      fontSize: 48,
      fontColor: "white",
      yPercent: 0.5,
      animation: {
        type: "typewriter",
        speed: 15, // characters per second
      },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "14-typewriter.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example15_TextAnimationScaleIn() {
  log("Example 15: Scale-In Text Animation");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      text: "Growing Text!",
      position: 0.3,
      end: 2.7,
      fontSize: 56,
      fontColor: "white",
      yPercent: 0.5,
      animation: {
        type: "scale-in",
        in: 0.5,
      },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "15-scale-in.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example16_TextAnimationPulse() {
  log("Example 16: Pulse Text Animation");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      text: "Pulsing Text",
      position: 0.3,
      end: 2.7,
      fontSize: 52,
      fontColor: "cyan",
      yPercent: 0.5,
      animation: {
        type: "pulse",
        speed: 3, // pulses per second
        intensity: 0.2, // 20% size variation
      },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "16-pulse.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example17_TextAnimationFadeOut() {
  log("Example 17: Fade-Out Text Animation");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      text: "Goodbye!",
      position: 0.3,
      end: 2.7,
      fontSize: 64,
      fontColor: "white",
      yPercent: 0.5,
      animation: {
        type: "fade-out",
        out: 1.0,
      },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "17-fade-out.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example18_WatermarkText() {
  log("Example 18: Text Watermark");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 3,
      end: 6,
      transition: { type: "fade", duration: 0.5 },
    },
  ]);

  const output = path.join(OUTPUT_DIR, "18-text-watermark.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    watermark: {
      type: "text",
      text: "@simple-ffmpeg",
      position: "bottom-right",
      fontSize: 24,
      fontColor: "#FFFFFF",
      opacity: 0.7,
      margin: 15,
    },
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example19_WatermarkImage() {
  log("Example 19: Image Watermark");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "19-image-watermark.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    watermark: {
      type: "image",
      url: path.join(FIXTURES_DIR, "test-watermark.png"),
      position: "top-right",
      opacity: 0.8,
      scale: 0.5,
      margin: 10,
    },
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example20_TimedWatermark() {
  log("Example 20: Timed Watermark");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 3,
      end: 6,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "20-timed-watermark.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    watermark: {
      type: "text",
      text: "Appears 2-5s",
      position: "top-left",
      fontSize: 20,
      fontColor: "yellow",
      opacity: 0.9,
      margin: 10,
      startTime: 2,
      endTime: 5,
    },
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example21_KaraokeBasic() {
  log("Example 21: Karaoke Text (Evenly Distributed)");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      mode: "karaoke",
      text: "Never gonna give you up",
      position: 0.5,
      end: 2.5,
      fontSize: 36,
      fontColor: "#FFFFFF",
      highlightColor: "#FFFF00", // Yellow highlight
      yPercent: 0.85,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "21-karaoke-basic.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example22_KaraokeTimestamps() {
  log("Example 22: Karaoke Text (With Word Timestamps)");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-green-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      mode: "karaoke",
      text: "One Two Three Four",
      position: 0,
      end: 3,
      words: [
        { text: "One", start: 0, end: 0.7 },
        { text: "Two", start: 0.7, end: 1.4 },
        { text: "Three", start: 1.4, end: 2.1 },
        { text: "Four", start: 2.1, end: 2.8 },
      ],
      fontSize: 48,
      fontColor: "#FFFFFF",
      highlightColor: "#00FF00", // Green highlight
      yPercent: 0.8,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "22-karaoke-timestamps.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example23_SubtitleSRT() {
  log("Example 23: SRT Subtitle Import");

  // Create a test SRT file
  const srtPath = path.join(FIXTURES_DIR, "test-subtitles.srt");
  const srtContent = `1
00:00:00,500 --> 00:00:01,500
First subtitle line

2
00:00:01,800 --> 00:00:02,800
Second subtitle line
`;
  fs.writeFileSync(srtPath, srtContent);

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "subtitle",
      url: srtPath,
      fontSize: 28,
      fontColor: "#FFFFFF",
      borderColor: "#000000",
      borderWidth: 2,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "23-subtitle-srt.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example24_SubtitleVTT() {
  log("Example 24: VTT Subtitle Import");

  // Create a test VTT file
  const vttPath = path.join(FIXTURES_DIR, "test-subtitles.vtt");
  const vttContent = `WEBVTT

00:00.500 --> 00:01.500
First WebVTT cue

00:01.800 --> 00:02.800
Second WebVTT cue
`;
  fs.writeFileSync(vttPath, vttContent);

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "subtitle",
      url: vttPath,
      fontSize: 28,
      fontColor: "#FFFF00", // Yellow subtitles
      borderColor: "#000000",
    },
  ]);

  const output = path.join(OUTPUT_DIR, "24-subtitle-vtt.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example25_KaraokeMultiLine() {
  log("Example 25: Multi-Line Karaoke Text");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-blue-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      mode: "karaoke",
      text: "First line here\nSecond line below", // Use \n for line breaks
      position: 0.3,
      end: 2.7,
      fontSize: 32,
      fontColor: "#FFFFFF",
      highlightColor: "#FFFF00",
      yPercent: 0.8,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "25-karaoke-multiline.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example26_KaraokeInstant() {
  log("Example 26: Karaoke Instant Highlight Style");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    {
      type: "text",
      mode: "karaoke",
      text: "Words change instantly",
      position: 0.3,
      end: 2.7,
      fontSize: 36,
      fontColor: "#FFFFFF",
      highlightColor: "#00FFFF", // Cyan highlight
      highlightStyle: "instant", // Instant color change instead of gradual fill
      yPercent: 0.85,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "26-karaoke-instant.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

async function example27_MixedTextAndKaraoke() {
  log("Example 27: Mixed Text Overlays and Karaoke");

  const project = new SIMPLEFFMPEG({
    width: 640,
    height: 480,
    fps: 30,
  });

  await project.load([
    {
      type: "video",
      url: path.join(FIXTURES_DIR, "test-video-red-3s.mp4"),
      position: 0,
      end: 3,
    },
    // Static text at top (drawtext-based)
    {
      type: "text",
      text: "Music Video",
      position: 0,
      end: 3,
      mode: "static",
      fontSize: 32,
      fontColor: "#FFFFFF",
      yPercent: 0.1,
      animation: { type: "fade-in", in: 0.3 },
    },
    // Karaoke text at bottom (ASS-based)
    {
      type: "text",
      mode: "karaoke",
      text: "Sing along with me",
      position: 0.5,
      end: 2.5,
      fontSize: 28,
      fontColor: "#FFFFFF",
      highlightColor: "#FF00FF", // Magenta highlight
      yPercent: 0.85,
    },
  ]);

  const output = path.join(OUTPUT_DIR, "27-mixed-text-karaoke.mp4");
  await project.export({
    outputPath: output,
    preset: "ultrafast",
    onProgress: ({ percent }) =>
      process.stdout.write(`\r  Progress: ${percent || 0}%`),
  });

  console.log(`\n  Output: ${output}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n🎬 simple-ffmpeg Examples Runner\n");

  if (!checkFFmpeg()) {
    console.error("❌ FFmpeg is not installed or not in PATH.");
    console.error("   Please install FFmpeg: https://ffmpeg.org/download.html");
    process.exit(1);
  }

  console.log("✓ FFmpeg is available");

  ensureDirectories();
  await generateFixtures();

  const examples = [
    example01_BasicConcatenation,
    example02_CrossfadeTransitions,
    example03_TextOverlays,
    example04_BackgroundMusic,
    example05_KenBurnsImages,
    example05b_ImageSlideshow,
    example06_GapFilling,
    example07_QualitySettings,
    example08_ResolutionScaling,
    example09_Metadata,
    example10_Thumbnail,
    example11_ComplexComposition,
    example12_WordByWordText,
    // New feature examples
    example13_PlatformPresets,
    example14_TextAnimationTypewriter,
    example15_TextAnimationScaleIn,
    example16_TextAnimationPulse,
    example17_TextAnimationFadeOut,
    example18_WatermarkText,
    example19_WatermarkImage,
    example20_TimedWatermark,
    // Karaoke and subtitle examples
    example21_KaraokeBasic,
    example22_KaraokeTimestamps,
    example23_SubtitleSRT,
    example24_SubtitleVTT,
    example25_KaraokeMultiLine,
    example26_KaraokeInstant,
    example27_MixedTextAndKaraoke,
  ];

  let succeeded = 0;
  let failed = 0;

  for (const example of examples) {
    try {
      await example();
      succeeded++;
    } catch (error) {
      console.error(`\n  ❌ Failed: ${error.message}`);
      if (error.stderr) {
        console.error(`  FFmpeg stderr: ${error.stderr.slice(-500)}`);
      }
      failed++;
    }
  }

  log("Summary");
  console.log(`  ✓ ${succeeded} examples completed successfully`);
  if (failed > 0) {
    console.log(`  ✗ ${failed} examples failed`);
  }
  console.log(`\n  Output directory: ${OUTPUT_DIR}`);
  console.log("\n  View the outputs to verify rendering:");
  console.log(`    open "${OUTPUT_DIR}"  # macOS`);
  console.log(`    xdg-open "${OUTPUT_DIR}"  # Linux`);
  console.log();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
