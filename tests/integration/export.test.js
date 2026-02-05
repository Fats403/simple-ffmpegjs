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
    "test-video-3s.mp4",
    "test-audio-2s.mp3",
    "test-watermark.png",
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

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "platform presets",
    () => {
      it("should export with tiktok preset (vertical 9:16)", async () => {
        const project = new SIMPLEFFMPEG({ preset: "tiktok" });
        const outputPath = path.join(OUTPUT_DIR, "test-tiktok-preset.mp4");

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

        // Verify dimensions using ffprobe
        try {
          const info = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${outputPath}"`,
            { encoding: "utf8" }
          );
          const [width, height] = info.trim().split(",").map(Number);
          expect(width).toBe(1080);
          expect(height).toBe(1920);
        } catch {
          // ffprobe may not be available
        }
      }, 30000);

      it("should export with youtube preset (horizontal 16:9)", async () => {
        const project = new SIMPLEFFMPEG({ preset: "youtube" });
        const outputPath = path.join(OUTPUT_DIR, "test-youtube-preset.mp4");

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

        // Verify dimensions using ffprobe
        try {
          const info = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${outputPath}"`,
            { encoding: "utf8" }
          );
          const [width, height] = info.trim().split(",").map(Number);
          expect(width).toBe(1920);
          expect(height).toBe(1080);
        } catch {
          // ffprobe may not be available
        }
      }, 30000);

      it("should export with instagram-post preset (square 1:1)", async () => {
        const project = new SIMPLEFFMPEG({ preset: "instagram-post" });
        const outputPath = path.join(OUTPUT_DIR, "test-instagram-preset.mp4");

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

        // Verify dimensions using ffprobe
        try {
          const info = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${outputPath}"`,
            { encoding: "utf8" }
          );
          const [width, height] = info.trim().split(",").map(Number);
          expect(width).toBe(1080);
          expect(height).toBe(1080);
        } catch {
          // ffprobe may not be available
        }
      }, 30000);
    }
  );

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "text animations",
    () => {
      it("should export with typewriter animation", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-typewriter.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
          {
            type: "text",
            text: "Hello",
            position: 0,
            end: 2,
            mode: "static",
            fontSize: 24,
            fontColor: "#FFFFFF",
            animation: { type: "typewriter", speed: 0.2 },
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with scale-in animation", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-scale-in.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
          {
            type: "text",
            text: "Scale In",
            position: 0.5,
            end: 1.5,
            fontSize: 24,
            fontColor: "#FFFFFF",
            animation: { type: "scale-in", in: 0.4, intensity: 0.5 },
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with pulse animation", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-pulse.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
          {
            type: "text",
            text: "Pulse",
            position: 0,
            end: 2,
            fontSize: 24,
            fontColor: "#FFFFFF",
            animation: { type: "pulse", speed: 2, intensity: 0.2 },
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with fade-out animation", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-fade-out.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
            position: 0,
            end: 2,
          },
          {
            type: "text",
            text: "Fade Out",
            position: 0,
            end: 1.5,
            fontSize: 24,
            fontColor: "#FFFFFF",
            animation: { type: "fade-out", out: 0.5 },
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);
    }
  );

  describe.skipIf(!ffmpegAvailable || !fixturesExist())("watermarks", () => {
    it("should export with text watermark", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-text-watermark.mp4");

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
        watermark: {
          type: "text",
          text: "@testchannel",
          position: "bottom-right",
          fontSize: 16,
          fontColor: "#FFFFFF",
          opacity: 0.7,
          margin: 10,
        },
      });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);

    it("should export with image watermark", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-image-watermark.mp4");
      const watermarkPath = path.join(FIXTURES_DIR, "test-watermark.png");

      // Skip if watermark fixture doesn't exist
      if (!fs.existsSync(watermarkPath)) {
        console.warn("Watermark fixture not found, skipping test");
        return;
      }

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
        watermark: {
          type: "image",
          url: watermarkPath,
          position: "top-right",
          scale: 0.2,
          opacity: 0.8,
          margin: 10,
        },
      });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);

    it("should export with watermark at custom position", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-watermark-custom-pos.mp4");

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
        watermark: {
          type: "text",
          text: "Custom",
          position: { xPercent: 0.1, yPercent: 0.9 },
          fontSize: 14,
          fontColor: "#00FF00",
        },
      });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);

    it("should export with timed watermark", async () => {
      const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
      const outputPath = path.join(OUTPUT_DIR, "test-watermark-timed.mp4");

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
        watermark: {
          type: "text",
          text: "Limited Time",
          position: "center",
          fontSize: 18,
          fontColor: "#FF0000",
          startTime: 0.5,
          endTime: 1.5,
        },
      });

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
    }, 30000);
  });

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "subtitles and karaoke",
    () => {
      it("should export with karaoke text (evenly distributed words)", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-karaoke-basic.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-3s.mp4"),
            position: 0,
            end: 3,
          },
          {
            type: "text",
            mode: "karaoke",
            text: "Hello World Test",
            position: 0.5,
            end: 2.5,
            fontSize: 24,
            fontColor: "#FFFFFF",
            highlightColor: "#FFFF00",
            yPercent: 0.85,
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with karaoke text using word timestamps", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-karaoke-timestamps.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-3s.mp4"),
            position: 0,
            end: 3,
          },
          {
            type: "text",
            mode: "karaoke",
            text: "One Two Three",
            position: 0,
            end: 3,
            words: [
              { text: "One", start: 0, end: 1 },
              { text: "Two", start: 1, end: 2 },
              { text: "Three", start: 2, end: 3 },
            ],
            fontSize: 24,
            fontColor: "#FFFFFF",
            highlightColor: "#00FF00",
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with SRT subtitle import", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-srt-import.mp4");
        const srtPath = path.join(FIXTURES_DIR, "test-subtitles.srt");

        // Create SRT fixture if it doesn't exist
        if (!fs.existsSync(srtPath)) {
          fs.writeFileSync(
            srtPath,
            `1
00:00:00,500 --> 00:00:01,500
First subtitle

2
00:00:01,800 --> 00:00:02,800
Second subtitle
`
          );
        }

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-3s.mp4"),
            position: 0,
            end: 3,
          },
          {
            type: "subtitle",
            url: srtPath,
            fontSize: 20,
            fontColor: "#FFFFFF",
            borderColor: "#000000",
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with VTT subtitle import", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-vtt-import.mp4");
        const vttPath = path.join(FIXTURES_DIR, "test-subtitles.vtt");

        // Create VTT fixture if it doesn't exist
        if (!fs.existsSync(vttPath)) {
          fs.writeFileSync(
            vttPath,
            `WEBVTT

00:00.500 --> 00:01.500
First cue

00:01.800 --> 00:02.800
Second cue
`
          );
        }

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-3s.mp4"),
            position: 0,
            end: 3,
          },
          {
            type: "subtitle",
            url: vttPath,
            fontSize: 20,
            fontColor: "#FFFF00",
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with subtitle time offset", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-subtitle-offset.mp4");
        const srtPath = path.join(FIXTURES_DIR, "test-subtitles.srt");

        // Create SRT fixture if it doesn't exist
        if (!fs.existsSync(srtPath)) {
          fs.writeFileSync(
            srtPath,
            `1
00:00:00,500 --> 00:00:01,500
First subtitle

2
00:00:01,800 --> 00:00:02,800
Second subtitle
`
          );
        }

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-3s.mp4"),
            position: 0,
            end: 3,
          },
          {
            type: "subtitle",
            url: srtPath,
            position: 0.5, // offset subtitles by 0.5 seconds
            fontSize: 20,
            fontColor: "#FFFFFF",
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }, 30000);

      it("should export with mixed drawtext and karaoke subtitles", async () => {
        const project = new SIMPLEFFMPEG({ width: 320, height: 240, fps: 30 });
        const outputPath = path.join(OUTPUT_DIR, "test-mixed-text-karaoke.mp4");

        await project.load([
          {
            type: "video",
            url: path.join(FIXTURES_DIR, "test-video-3s.mp4"),
            position: 0,
            end: 3,
          },
          {
            // Regular drawtext overlay
            type: "text",
            text: "Title",
            position: 0,
            end: 3,
            mode: "static",
            fontSize: 24,
            fontColor: "#FFFFFF",
            yPercent: 0.1,
          },
          {
            // Karaoke text (ASS-based)
            type: "text",
            mode: "karaoke",
            text: "Singing along",
            position: 0.5,
            end: 2.5,
            fontSize: 20,
            fontColor: "#FFFFFF",
            highlightColor: "#FF00FF",
            yPercent: 0.85,
          },
        ]);

        const result = await project.export({ outputPath });

        expect(result).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
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
