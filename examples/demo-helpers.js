/**
 * Shared helpers for all demo scripts.
 *
 * Provides fixture generation, logging, progress display, and a demo runner.
 * Each demo script imports what it needs from here so boilerplate isn't duplicated.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FIXTURES_DIR = path.join(__dirname, "fixtures");

// ============================================================================
// Utility functions
// ============================================================================

/** Create directories recursively if they don't exist. */
export function ensureDirs(...dirs) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

/** Print a section header. */
export function log(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

/** Inline progress callback for export(). */
export function progress({ percent }) {
  process.stdout.write(`\r  Progress: ${percent || 0}%`);
}

/** Get duration of a media file via ffprobe. */
export function getDuration(filepath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`,
      { encoding: "utf8" },
    );
    return parseFloat(result.trim()).toFixed(2);
  } catch {
    return "?";
  }
}

/** Verify FFmpeg is installed. */
export function checkFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Fixture generation
// ============================================================================

const FIXTURES = [
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
    cmd: `ffmpeg -y -f lavfi -i "color=c=#336699:s=640x480:d=1,drawgrid=w=80:h=80:t=2:c=white@0.5,drawtext=text='A':fontsize=100:fontcolor=white:x=60:y=40,drawtext=text='B':fontsize=100:fontcolor=white:x=520:y=40,drawtext=text='C':fontsize=100:fontcolor=white:x=60:y=340,drawtext=text='D':fontsize=100:fontcolor=white:x=520:y=340,drawbox=x=280:y=200:w=80:h=80:c=yellow:t=fill" -frames:v 1`,
  },
  {
    name: "test-watermark.png",
    cmd: `ffmpeg -y -f lavfi -i "color=c=white:s=64x64:d=1,format=rgba" -frames:v 1`,
  },
];

const TEXT_FIXTURES = [
  {
    name: "test-subtitles.srt",
    content: `1
00:00:00,500 --> 00:00:01,500
First subtitle line

2
00:00:01,800 --> 00:00:02,800
Second subtitle line
`,
  },
  {
    name: "test-subtitles.vtt",
    content: `WEBVTT

00:00.500 --> 00:01.500
First WebVTT cue

00:01.800 --> 00:02.800
Second WebVTT cue
`,
  },
];

/** Generate all shared fixtures. Skips any that already exist. */
export function generateFixtures() {
  ensureDirs(FIXTURES_DIR);

  for (const f of FIXTURES) {
    const out = path.join(FIXTURES_DIR, f.name);
    if (!fs.existsSync(out)) {
      console.log(`  Generating ${f.name}...`);
      try {
        execSync(`${f.cmd} "${out}"`, { stdio: "pipe" });
      } catch (e) {
        console.error(`  Failed to create ${f.name}: ${e.message}`);
      }
    }
  }

  for (const f of TEXT_FIXTURES) {
    const out = path.join(FIXTURES_DIR, f.name);
    if (!fs.existsSync(out)) {
      console.log(`  Generating ${f.name}...`);
      fs.writeFileSync(out, f.content);
    }
  }
}

// ============================================================================
// Demo runner
// ============================================================================

/**
 * Run an array of demo functions sequentially and report results.
 *
 * @param {string} title - Title for this demo suite
 * @param {string} outputDir - Output directory (for summary display)
 * @param {Array<Function>} demos - Array of async demo functions
 * @returns {{ ok: number, fail: number }}
 */
export async function runDemos(title, outputDir, demos) {
  console.log(`\n  ${title}\n`);

  if (!checkFFmpeg()) {
    console.error("FFmpeg not found. Install it first.");
    process.exit(1);
  }

  ensureDirs(outputDir);
  generateFixtures();

  let ok = 0;
  let fail = 0;

  for (const demo of demos) {
    try {
      await demo();
      ok++;
    } catch (err) {
      console.error(`\n  FAILED: ${err.message}`);
      if (err.details?.stderrTail) {
        console.error(`  stderr: ${err.details.stderrTail.slice(-300)}`);
      }
      fail++;
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Results: ${ok} passed, ${fail} failed`);
  console.log(`  Output:  ${outputDir}`);
  console.log(`${"═".repeat(60)}\n`);

  return { ok, fail };
}
