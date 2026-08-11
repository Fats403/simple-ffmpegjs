/**
 * Vitest globalSetup — runs once in the main process BEFORE any test file is
 * collected. Fixtures must exist by collection time because several suites
 * evaluate `describe.skipIf(!fixturesExist())` at module scope; generating
 * fixtures in a per-suite beforeAll runs too late and silently skips those
 * suites on any fresh checkout (which is exactly what happened in CI).
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const ROOT = path.join(__dirname, "..");

export default function globalSetup() {
  let ffmpegAvailable = false;
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    ffmpegAvailable = true;
  } catch {
    console.warn(
      "\nFFmpeg not found — integration tests will be skipped.\n" +
      "Install FFmpeg to run them:\n" +
      "  macOS: brew install ffmpeg\n" +
      "  Ubuntu/Debian: apt-get install ffmpeg\n",
    );
  }

  if (!ffmpegAvailable) return;

  // Cheap freshness check: regenerate when any known fixture is missing.
  const sentinels = [
    "test-video-1s.mp4",
    "test-video-2s.mp4",
    "test-video-3s.mp4",
    "test-audio-2s.mp3",
    "test-watermark.png",
    "test-video-odd-dims-1s.mp4",
    "test-video-noaudio-1s.mp4",
    "test-video-busy-5s.mp4",
    "test-speech-gaps.wav",
    "test-speech-padded.wav",
    "test-audio-quiet-2s.wav",
    "test-audio-cover-art.mp3",
  ];
  const missing = sentinels.filter(
    (f) => !fs.existsSync(path.join(FIXTURES_DIR, f)),
  );
  if (missing.length > 0) {
    console.log(`Generating test fixtures (missing: ${missing.join(", ")})...`);
    execSync("node tests/fixtures/generate-fixtures.js", {
      cwd: ROOT,
      stdio: "inherit",
    });
  }
}
