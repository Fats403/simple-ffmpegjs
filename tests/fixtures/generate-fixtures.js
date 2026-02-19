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
    // Grid pattern image - makes Ken Burns zoom/pan effects visible
    cmd: `ffmpeg -y -f lavfi -i "color=c=#336699:s=640x480:d=1,drawgrid=w=80:h=80:t=2:c=white@0.5,drawtext=text='A':fontsize=120:fontcolor=white:x=80:y=60,drawtext=text='B':fontsize=120:fontcolor=white:x=440:y=60,drawtext=text='C':fontsize=120:fontcolor=white:x=80:y=300,drawtext=text='D':fontsize=120:fontcolor=white:x=440:y=300,drawbox=x=280:y=200:w=80:h=80:c=yellow:t=fill" -frames:v 1`,
  },
  {
    name: "test-image-portrait.png",
    // Portrait grid pattern image (480x640) for testing aspect ratio mismatch with imageFit
    cmd: `ffmpeg -y -f lavfi -i "color=c=#996633:s=480x640:d=1,drawgrid=w=80:h=80:t=2:c=white@0.5,drawtext=text='P':fontsize=120:fontcolor=white:x=180:y=60,drawtext=text='Q':fontsize=120:fontcolor=white:x=180:y=480,drawbox=x=200:y=280:w=80:h=80:c=cyan:t=fill" -frames:v 1`,
  },
  {
    name: "test-watermark.png",
    // Small 64x64 white circle on transparent background for watermark testing
    cmd: `ffmpeg -y -f lavfi -i "color=c=white:s=64x64:d=1,format=rgba" -frames:v 1`,
  },
  {
    name: "test-video-multiscene-6s.mp4",
    // 6 second video with 3 distinct scenes (red→blue→green, 2s each) for keyframe extraction tests
    cmd: `ffmpeg -y -f lavfi -i "color=c=red:s=320x240:d=2:r=25,format=yuv420p" -f lavfi -i "color=c=blue:s=320x240:d=2:r=25,format=yuv420p" -f lavfi -i "color=c=green:s=320x240:d=2:r=25,format=yuv420p" -f lavfi -i "anullsrc=r=44100:cl=stereo" -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]" -map "[v]" -map 3:a -t 6 -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 64k -shortest`,
  },
];

// Text-based fixtures (subtitles)
const textFixtures = [
  {
    name: "test-subtitles.srt",
    content: `1
00:00:00,500 --> 00:00:01,500
First subtitle

2
00:00:01,800 --> 00:00:02,800
Second subtitle
`,
  },
  {
    name: "test-subtitles.vtt",
    content: `WEBVTT

00:00.500 --> 00:01.500
First cue

00:01.800 --> 00:02.800
Second cue
`,
  },
];

function generateFixtures() {
  console.log("Generating test fixtures...\n");

  // Generate FFmpeg-based fixtures (video, audio, images)
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

  // Generate text-based fixtures (subtitles)
  for (const fixture of textFixtures) {
    const outputPath = path.join(FIXTURES_DIR, fixture.name);

    console.log(`Creating ${fixture.name}...`);
    try {
      fs.writeFileSync(outputPath, fixture.content);
      const stats = fs.statSync(outputPath);
      console.log(`  ✓ Created (${stats.size} bytes)\n`);
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
