import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;

function isFFmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

describe("repeat export (state restoration)", () => {
  const ffmpegAvailable = isFFmpegAvailable();
  const tmpDir = path.join(os.tmpdir(), `simpleffmpeg-repeat-test-${process.pid}`);

  beforeAll(() => {
    if (ffmpegAvailable && !fs.existsSync(path.join(FIXTURES_DIR, "test-video-2s.mp4"))) {
      try {
        execSync("node tests/fixtures/generate-fixtures.js", {
          cwd: path.join(__dirname, "..", ".."),
          stdio: "pipe",
        });
      } catch (err) {
        console.warn("Could not generate fixtures:", err.message);
      }
    }
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      const files = await fsPromises.readdir(tmpDir);
      await Promise.all(
        files.map((f) => fsPromises.unlink(path.join(tmpDir, f)).catch(() => {})),
      );
    } catch {
      /* ignore */
    }
  });

  const skipIfNoFFmpeg = ffmpegAvailable ? it : it.skip;

  const GRADIENT_CLIPS = [
    {
      type: "color",
      color: { type: "linear-gradient", colors: ["navy", "white"], direction: 45 },
      position: 0,
      end: 1,
    },
  ];

  skipIfNoFFmpeg(
    "preview() then export() works on a gradient project",
    async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30, tempDir: tmpDir });
      await project.load(GRADIENT_CLIPS);

      const preview = await project.preview();
      expect(preview.command).toContain("ffmpeg");

      const out = path.join(tmpDir, "after-preview.mp4");
      await project.export({ outputPath: out });
      expect(fs.existsSync(out)).toBe(true);
    },
    60000,
  );

  skipIfNoFFmpeg(
    "export() twice from one load produces two valid outputs",
    async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30, tempDir: tmpDir });
      await project.load(GRADIENT_CLIPS);

      const out1 = path.join(tmpDir, "take1.mp4");
      const out2 = path.join(tmpDir, "take2.mp4");
      await project.export({ outputPath: out1 });
      await project.export({ outputPath: out2 });
      expect(fs.existsSync(out1)).toBe(true);
      expect(fs.existsSync(out2)).toBe(true);
      expect(fs.statSync(out2).size).toBeGreaterThan(0);
    },
    60000,
  );

  skipIfNoFFmpeg(
    "twoPass export with an image watermark builds a valid graph",
    async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30, tempDir: tmpDir });
      await project.load([
        { type: "video", url: path.join(FIXTURES_DIR, "test-video-2s.mp4"), position: 0, end: 2 },
      ]);

      const out = path.join(tmpDir, "twopass-wm.mp4");
      await project.export({
        outputPath: out,
        twoPass: true,
        videoBitrate: "500k",
        watermark: {
          type: "image",
          url: path.join(FIXTURES_DIR, "test-watermark.png"),
          position: "bottom-right",
        },
      });
      expect(fs.existsSync(out)).toBe(true);
    },
    120000,
  );
});
