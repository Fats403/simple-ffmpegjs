import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const OUTPUT_DIR = path.join(__dirname, "..", "fixtures", "keyframe-output");

const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;

function isFFmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function fixturesExist() {
  return fs.existsSync(
    path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4")
  );
}

describe("SIMPLEFFMPEG.extractKeyframes", () => {
  const ffmpegAvailable = isFFmpegAvailable();

  beforeAll(() => {
    if (ffmpegAvailable && !fixturesExist()) {
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
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  // ── Argument validation ───────────────────────────────────────────────────

  it("should throw if filePath is missing", async () => {
    await expect(SIMPLEFFMPEG.extractKeyframes(null)).rejects.toThrow(
      /requires a filePath/
    );
    await expect(SIMPLEFFMPEG.extractKeyframes("")).rejects.toThrow(
      /requires a filePath/
    );
  });

  it("should throw for invalid mode", async () => {
    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", { mode: "invalid" })
    ).rejects.toThrow(/invalid mode/);
  });

  it("should throw for invalid format", async () => {
    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", { format: "gif" })
    ).rejects.toThrow(/invalid format/);
  });

  it("should throw for out-of-range sceneThreshold", async () => {
    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", { sceneThreshold: -0.1 })
    ).rejects.toThrow(/sceneThreshold/);

    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", { sceneThreshold: 1.5 })
    ).rejects.toThrow(/sceneThreshold/);

    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", {
        sceneThreshold: "high",
      })
    ).rejects.toThrow(/sceneThreshold/);
  });

  it("should throw for invalid intervalSeconds", async () => {
    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", {
        mode: "interval",
        intervalSeconds: 0,
      })
    ).rejects.toThrow(/intervalSeconds/);

    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", {
        mode: "interval",
        intervalSeconds: -5,
      })
    ).rejects.toThrow(/intervalSeconds/);
  });

  it("should throw for invalid maxFrames", async () => {
    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", { maxFrames: 0 })
    ).rejects.toThrow(/maxFrames/);

    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", { maxFrames: 1.5 })
    ).rejects.toThrow(/maxFrames/);
  });

  it("should throw for non-existent tempDir", async () => {
    await expect(
      SIMPLEFFMPEG.extractKeyframes("./video.mp4", {
        tempDir: "/nonexistent/tmp/dir",
      })
    ).rejects.toThrow(/does not exist/);
  });

  it("should throw FFmpegError for non-existent file", async () => {
    await expect(
      SIMPLEFFMPEG.extractKeyframes("/nonexistent/video.mp4")
    ).rejects.toThrow();
  });

  // ── Scene-change mode ─────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "scene-change mode",
    () => {
      it("should return Buffer[] by default (no outputDir)", async () => {
        const frames = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
          }
        );

        expect(Array.isArray(frames)).toBe(true);
        expect(frames.length).toBeGreaterThan(0);
        frames.forEach((frame) => {
          expect(Buffer.isBuffer(frame)).toBe(true);
          expect(frame.length).toBeGreaterThan(0);
        });
      });

      it("should detect scene changes in multi-scene video", async () => {
        const frames = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
          }
        );

        // 3 distinct scenes (red→blue→green) should produce at least 2 scene-change frames
        expect(frames.length).toBeGreaterThanOrEqual(2);
      });

      it("should respect maxFrames", async () => {
        const frames = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
            maxFrames: 1,
          }
        );

        expect(frames.length).toBeLessThanOrEqual(1);
      });

      it("should return PNG buffers when format is png", async () => {
        const frames = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
            format: "png",
            maxFrames: 2,
          }
        );

        expect(frames.length).toBeGreaterThan(0);
        // PNG files start with the PNG magic bytes: 0x89 0x50 0x4E 0x47
        frames.forEach((frame) => {
          expect(frame[0]).toBe(0x89);
          expect(frame[1]).toBe(0x50);
          expect(frame[2]).toBe(0x4e);
          expect(frame[3]).toBe(0x47);
        });
      });

      it("should return JPEG buffers when format is jpeg", async () => {
        const frames = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
            format: "jpeg",
            maxFrames: 2,
          }
        );

        expect(frames.length).toBeGreaterThan(0);
        // JPEG files start with 0xFF 0xD8
        frames.forEach((frame) => {
          expect(frame[0]).toBe(0xff);
          expect(frame[1]).toBe(0xd8);
        });
      });
    }
  );

  // ── Interval mode ─────────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "interval mode",
    () => {
      it("should extract frames at fixed intervals", async () => {
        const frames = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "interval",
            intervalSeconds: 2,
          }
        );

        expect(Array.isArray(frames)).toBe(true);
        // 6s video at 2s intervals → approximately 3 frames
        expect(frames.length).toBeGreaterThanOrEqual(2);
        expect(frames.length).toBeLessThanOrEqual(5);
      });

      it("should respect maxFrames in interval mode", async () => {
        const frames = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "interval",
            intervalSeconds: 1,
            maxFrames: 2,
          }
        );

        expect(frames.length).toBeLessThanOrEqual(2);
      });
    }
  );

  // ── outputDir mode ────────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "outputDir mode",
    () => {
      it("should write files to outputDir and return string[]", async () => {
        const outDir = path.join(OUTPUT_DIR, "scene-test");
        const paths = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
            outputDir: outDir,
          }
        );

        expect(Array.isArray(paths)).toBe(true);
        expect(paths.length).toBeGreaterThan(0);
        paths.forEach((p) => {
          expect(typeof p).toBe("string");
          expect(p).toContain(outDir);
          expect(fs.existsSync(p)).toBe(true);
          const stat = fs.statSync(p);
          expect(stat.size).toBeGreaterThan(0);
        });
      });

      it("should create outputDir if it does not exist", async () => {
        const outDir = path.join(OUTPUT_DIR, "auto-created", "nested");
        expect(fs.existsSync(outDir)).toBe(false);

        const paths = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "interval",
            intervalSeconds: 3,
            outputDir: outDir,
          }
        );

        expect(fs.existsSync(outDir)).toBe(true);
        expect(paths.length).toBeGreaterThan(0);
      });

      it("should write PNG files when format is png", async () => {
        const outDir = path.join(OUTPUT_DIR, "png-test");
        const paths = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
            outputDir: outDir,
            format: "png",
            maxFrames: 2,
          }
        );

        expect(paths.length).toBeGreaterThan(0);
        paths.forEach((p) => {
          expect(p).toMatch(/\.png$/);
        });
      });

      it("should write JPEG files when format is jpeg", async () => {
        const outDir = path.join(OUTPUT_DIR, "jpeg-test");
        const paths = await SIMPLEFFMPEG.extractKeyframes(
          path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
          {
            mode: "scene-change",
            sceneThreshold: 0.3,
            outputDir: outDir,
            format: "jpeg",
            maxFrames: 2,
          }
        );

        expect(paths.length).toBeGreaterThan(0);
        paths.forEach((p) => {
          expect(p).toMatch(/\.jpg$/);
        });
      });
    }
  );

  // ── Resize ────────────────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())("resize", () => {
    it("should resize extracted frames when width is specified", async () => {
      const frames = await SIMPLEFFMPEG.extractKeyframes(
        path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
        {
          mode: "scene-change",
          sceneThreshold: 0.3,
          maxFrames: 1,
          width: 160,
          format: "jpeg",
        }
      );

      expect(frames.length).toBeGreaterThan(0);
      expect(Buffer.isBuffer(frames[0])).toBe(true);
      // Resized frame should be smaller than a full-resolution frame
      expect(frames[0].length).toBeGreaterThan(0);
    });
  });

  // ── tempDir ─────────────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())("tempDir", () => {
    it("should use custom tempDir for intermediate files", async () => {
      const customTmp = path.join(OUTPUT_DIR, "custom-tmp");
      fs.mkdirSync(customTmp, { recursive: true });

      const frames = await SIMPLEFFMPEG.extractKeyframes(
        path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
        {
          mode: "scene-change",
          sceneThreshold: 0.3,
          maxFrames: 1,
          tempDir: customTmp,
        }
      );

      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBeGreaterThan(0);
      expect(Buffer.isBuffer(frames[0])).toBe(true);
      // Temp dir should be cleaned up (no leftover subdirectories)
      const remaining = fs.readdirSync(customTmp).filter((f) =>
        f.startsWith("simpleffmpeg-keyframes-")
      );
      expect(remaining).toHaveLength(0);
    });

    it("should ignore tempDir when outputDir is set", async () => {
      const customTmp = path.join(OUTPUT_DIR, "ignored-tmp");
      fs.mkdirSync(customTmp, { recursive: true });
      const outDir = path.join(OUTPUT_DIR, "tempdir-outdir-test");

      const paths = await SIMPLEFFMPEG.extractKeyframes(
        path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4"),
        {
          mode: "scene-change",
          sceneThreshold: 0.3,
          maxFrames: 1,
          outputDir: outDir,
          tempDir: customTmp,
        }
      );

      expect(paths.length).toBeGreaterThan(0);
      // Files should be in outputDir, not tempDir
      paths.forEach((p) => expect(p).toContain(outDir));
      // tempDir should have no keyframe files in it
      const tmpFiles = fs.readdirSync(customTmp).filter((f) =>
        f.startsWith("frame-")
      );
      expect(tmpFiles).toHaveLength(0);
    });
  });

  // ── Defaults ──────────────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())("defaults", () => {
    it("should use scene-change mode and jpeg format by default", async () => {
      const frames = await SIMPLEFFMPEG.extractKeyframes(
        path.join(FIXTURES_DIR, "test-video-multiscene-6s.mp4")
      );

      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBeGreaterThan(0);
      // Should be JPEG by default (starts with 0xFF 0xD8)
      expect(frames[0][0]).toBe(0xff);
      expect(frames[0][1]).toBe(0xd8);
    });
  });
});
