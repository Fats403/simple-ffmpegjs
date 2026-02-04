/**
 * Generate test fixtures for integration tests.
 * Run this script to create small test video/audio files.
 *
 * Usage: node tests/fixtures/generate-fixtures.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FIXTURES_DIR = __dirname;

const fixtures = [
  {
    name: "test-video-1s.mp4",
    // 1 second red video with silent audio
    cmd: `ffmpeg -y -f lavfi -i "color=c=red:s=320x240:d=1,format=yuv420p" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 1 -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 64k`,
  },
  {
    name: "test-video-2s.mp4",
    // 2 second blue video with silent audio
    cmd: `ffmpeg -y -f lavfi -i "color=c=blue:s=320x240:d=2,format=yuv420p" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 2 -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 64k`,
  },
  {
    name: "test-video-3s.mp4",
    // 3 second green video with silent audio
    cmd: `ffmpeg -y -f lavfi -i "color=c=green:s=320x240:d=3,format=yuv420p" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 3 -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 64k`,
  },
  {
    name: "test-audio-2s.mp3",
    // 2 second sine wave audio
    cmd: `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=2" -c:a libmp3lame -b:a 64k`,
  },
  {
    name: "test-image.png",
    // Simple 320x240 orange image
    cmd: `ffmpeg -y -f lavfi -i "color=c=orange:s=320x240:d=1" -frames:v 1`,
  },
];

function generateFixtures() {
  console.log("Generating test fixtures...\n");

  for (const fixture of fixtures) {
    const outputPath = path.join(FIXTURES_DIR, fixture.name);
    const fullCmd = `${fixture.cmd} "${outputPath}"`;

    console.log(`Creating ${fixture.name}...`);
    try {
      execSync(fullCmd, { stdio: "pipe" });
      const stats = fs.statSync(outputPath);
      console.log(`  ✓ Created (${(stats.size / 1024).toFixed(1)} KB)\n`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}\n`);
    }
  }

  console.log("Done!");
}

// Check if FFmpeg is available
try {
  execSync("ffmpeg -version", { stdio: "pipe" });
  generateFixtures();
} catch {
  console.error(
    "FFmpeg not found. Please install FFmpeg to generate test fixtures."
  );
  console.error("  macOS: brew install ffmpeg");
  console.error("  Ubuntu/Debian: apt-get install ffmpeg");
  process.exit(1);
}
