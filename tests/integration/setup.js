import { execSync } from "child_process";
import { beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

let ffmpegAvailable = false;

beforeAll(() => {
  // Check if FFmpeg is available
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    ffmpegAvailable = true;
  } catch {
    console.warn(
      "\nFFmpeg not found. Integration tests will be skipped.\n" +
        "Install FFmpeg to run integration tests:\n" +
        "  macOS: brew install ffmpeg\n" +
        "  Ubuntu/Debian: apt-get install ffmpeg\n"
    );
  }

  // Generate fixtures if FFmpeg is available
  if (ffmpegAvailable) {
    const requiredFixtures = [
      "test-video-1s.mp4",
      "test-video-2s.mp4",
      "test-video-3s.mp4",
      "test-watermark.png",
    ];
    const missingFixtures = requiredFixtures.filter(
      (f) => !fs.existsSync(path.join(FIXTURES_DIR, f))
    );

    if (missingFixtures.length > 0) {
      console.log("\nGenerating test fixtures...");
      try {
        execSync("node tests/fixtures/generate-fixtures.js", {
          cwd: path.join(__dirname, "..", ".."),
          stdio: "inherit",
        });
      } catch (e) {
        console.warn("Could not generate fixtures:", e.message);
      }
    }
  }
});

// Export helper for tests to check FFmpeg availability
globalThis.__FFMPEG_AVAILABLE__ = () => ffmpegAvailable;

afterAll(() => {
  // Cleanup any test artifacts if needed
});
