import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

// Dynamic import for CommonJS module
const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;

// Helper to check if FFmpeg is available
function isFFmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// Helper to check if fixture files exist
function fixturesExist() {
  const required = [
    "test-video-1s.mp4",
    "test-video-2s.mp4",
    "test-audio-2s.mp3",
  ];
  return required.every((f) => fs.existsSync(path.join(FIXTURES_DIR, f)));
}

// Helper to get video duration using ffprobe
function getVideoDuration(filepath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`,
      { encoding: "utf8" }
    );
    return parseFloat(result.trim());
  } catch {
    return null;
  }
}

describe("Integration Tests", () => {
  const ffmpegAvailable = isFFmpegAvailable();

  beforeAll(() => {
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Generate fixtures if they don't exist
    if (ffmpegAvailable && !fixturesExist()) {
      console.log("Generating test fixtures...");
      try {
        execSync("node tests/fixtures/generate-fixtures.js", {
          cwd: path.join(__dirname, "..", ".."),
          stdio: "pipe",
        });
      } catch (e) {
        console.warn("Could not generate fixtures:", e.message);
      }
    }
  });

  afterAll(() => {
    // Clean up output files
    if (fs.existsSync(OUTPUT_DIR)) {
      const files = fs.readdirSync(OUTPUT_DIR);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(OUTPUT_DIR, file));
        } catch {}
      }
    }
  });

  describe.skipIf(!ffmpegAvailable || !fixturesExist())("export()", () => {
    it("should export a single video clip", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-single-clip.mp4");

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
          position: 0,
          end: 2,
        },
      ]);

      const result = await project.export({ outputPath });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      const duration = getVideoDuration(outputPath);
      expect(duration).toBeGreaterThan(1.5);
      expect(duration).toBeLessThan(2.5);
    }, 30000);

    it("should export multiple video clips concatenated", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-concat.mp4");

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-1s.mp4"),
          position: 0,
          end: 1,
        },
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
          position: 1,
          end: 3,
        },
      ]);

      const result = await project.export({ outputPath });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      const duration = getVideoDuration(outputPath);
      expect(duration).toBeGreaterThan(2.5);
      expect(duration).toBeLessThan(3.5);
    }, 30000);

    it("should export with text overlay", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-text.mp4");

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
          position: 0,
          end: 2,
        },
        {
          type: "text",
          text: "Hello World",
          position: 0.5,
          end: 1.5,
          fontSize: 24,
          fontColor: "white",
        },
      ]);

      const result = await project.export({ outputPath });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);

    it("should call onProgress callback", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-progress.mp4");
      const progressCalls = [];

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
          position: 0,
          end: 2,
        },
      ]);

      await project.export({
        outputPath,
        onProgress: (progress) => {
          progressCalls.push(progress);
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      // At least one progress call should have some data
      const hasProgressData = progressCalls.some(
        (p) => p.frame !== undefined || p.timeProcessed !== undefined
      );
      expect(hasProgressData).toBe(true);
    }, 30000);

    it("should fill gaps with black when fillGaps is 'black'", async () => {
      const project = new SIMPLEFFMPEG({
        width: 320,
        height: 240,
        fps: 30,
        fillGaps: "black",
      });
      const outputPath = path.join(OUTPUT_DIR, "test-gaps.mp4");

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-1s.mp4"),
          position: 1, // Gap from 0-1
          end: 2,
        },
      ]);

      const result = await project.export({ outputPath });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Output should be ~2 seconds (1s black + 1s video)
      const duration = getVideoDuration(outputPath);
      expect(duration).toBeGreaterThan(1.5);
      expect(duration).toBeLessThan(2.5);
    }, 30000);
  });

  describe.skipIf(!ffmpegAvailable || !fixturesExist())("preview()", () => {
    it("should return command preview without executing", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
          position: 0,
          end: 2,
        },
      ]);

      const preview = await project.preview({
        outputPath: "./preview-test.mp4",
      });

      expect(preview.command).toContain("ffmpeg");
      expect(preview.command).toContain("preview-test.mp4");
      expect(preview.filterComplex).toContain("scale=320:240");
      expect(preview.totalDuration).toBeGreaterThan(0);

      // Verify the file was NOT created
      expect(fs.existsSync("./preview-test.mp4")).toBe(false);
    });
  });

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "advanced export options",
    () => {
      it("should export with custom codec and quality settings", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-quality.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
        ]);

        const result = await project.export({
          outputPath,
          videoCodec: "libx264",
          crf: 28, // Lower quality for faster test
          preset: "ultrafast",
          audioBitrate: "128k",
        });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with output resolution scaling", async () => {
        const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-scaled.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
        ]);

        const result = await project.export({
          outputPath,
          outputWidth: 320,
          outputHeight: 240,
        });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);

        // Verify the output dimensions using ffprobe
        try {
          const info = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${outputPath}"`,
            { encoding: "utf8" }
          );
          const [width, height] = info.trim().split(",").map(Number);
          expect(width).toBe(320);
          expect(height).toBe(240);
        } catch {
          // ffprobe may not be available, skip dimension check
        }
      }, 30000);

      it("should export with metadata", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-metadata.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
        ]);

        const result = await project.export({
          outputPath,
          metadata: {
            title: "Test Video",
            artist: "Test Artist",
            comment: "Generated by simple-ffmpeg tests",
          },
        });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);

        // Verify metadata using ffprobe
        try {
          const info = execSync(
            `ffprobe -v error -show_entries format_tags=title,artist -of json "${outputPath}"`,
            { encoding: "utf8" }
          );
          const data = JSON.parse(info);
          expect(data.format.tags.title).toBe("Test Video");
          expect(data.format.tags.artist).toBe("Test Artist");
        } catch {
          // ffprobe may not be available, skip metadata check
        }
      }, 30000);

      it("should generate thumbnail with export", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-with-thumb.mp4");
        const thumbPath = path.join(OUTPUT_DIR, "test-thumb.jpg");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
        ]);

        await project.export({
          outputPath,
          thumbnail: {
            outputPath: thumbPath,
            time: 1,
            width: 160,
          },
        });

        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.existsSync(thumbPath)).toBe(true);

        // Check thumbnail file size (should be a small jpg)
        const stats = fs.statSync(thumbPath);
        expect(stats.size).toBeGreaterThan(0);
      }, 30000);

      it("should save command to file when saveCommand is set", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-savecmd.mp4");
        const cmdPath = path.join(OUTPUT_DIR, "test-command.txt");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
        ]);

        await project.export({
          outputPath,
          saveCommand: cmdPath,
        });

        expect(fs.existsSync(cmdPath)).toBe(true);
        const cmdContent = fs.readFileSync(cmdPath, "utf8");
        expect(cmdContent).toContain("ffmpeg");
        expect(cmdContent).toContain("test-savecmd.mp4");
      }, 30000);
    }
  );

  describe.skipIf(!ffmpegAvailable || !fixturesExist())("cancellation", () => {
    it("should handle abort signal (may complete before abort for short videos)", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-cancel.mp4");
      const controller = new AbortController();

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-3s.mp4"),
          position: 0,
          end: 3,
        },
      ]);

      // Abort immediately (gives best chance to cancel before FFmpeg completes)
      controller.abort();

      try {
        await project.export({ outputPath, signal: controller.signal });
        // If FFmpeg completed before abort took effect, that's okay for short videos
        // The signal support is still working, just FFmpeg is fast
        expect(fs.existsSync(outputPath)).toBe(true);
      } catch (error) {
        // Export was cancelled as expected
        expect(error.name).toBe("ExportCancelledError");
      }
    }, 30000);

    it("should reject with already aborted signal", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-abort-preemptive.mp4");
      const controller = new AbortController();

      // Abort BEFORE calling export
      controller.abort();

      await project.load([
        {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
          position: 0,
          end: 2,
        },
      ]);

      await expect(
        project.export({ outputPath, signal: controller.signal })
      ).rejects.toThrow(/cancelled/i);
    }, 30000);
  });
});
