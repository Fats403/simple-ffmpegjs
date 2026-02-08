import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

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
    "test-video-2s.mp4",
    "test-video-3s.mp4",
    "test-audio-2s.mp3",
  ];
  return required.every((f) => fs.existsSync(path.join(FIXTURES_DIR, f)));
}

describe("SIMPLEFFMPEG.probe", () => {
  const ffmpegAvailable = isFFmpegAvailable();

  beforeAll(() => {
    // Generate fixtures if they don't exist
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

  // ── Video files ──────────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "video probing",
    () => {
      it("should probe a video file and return all expected fields", async () => {
        const info = await SIMPLEFFMPEG.probe(
          path.join(FIXTURES_DIR, "test-video-2s.mp4"),
        );

        // Essentials
        expect(typeof info.duration).toBe("number");
        expect(info.duration).toBeGreaterThan(0);
        expect(typeof info.width).toBe("number");
        expect(info.width).toBeGreaterThan(0);
        expect(typeof info.height).toBe("number");
        expect(info.height).toBeGreaterThan(0);
        expect(info.hasVideo).toBe(true);
        expect(typeof info.hasAudio).toBe("boolean");
        expect(typeof info.rotation).toBe("number");

        // Codec & format
        expect(typeof info.videoCodec).toBe("string");
        expect(info.videoCodec.length).toBeGreaterThan(0);
        expect(typeof info.format).toBe("string");
        expect(info.format.length).toBeGreaterThan(0);
        expect(typeof info.fps).toBe("number");
        expect(info.fps).toBeGreaterThan(0);

        // File info
        expect(typeof info.size).toBe("number");
        expect(info.size).toBeGreaterThan(0);
        expect(typeof info.bitrate).toBe("number");
        expect(info.bitrate).toBeGreaterThan(0);
      });

      it("should return correct types for all fields", async () => {
        const info = await SIMPLEFFMPEG.probe(
          path.join(FIXTURES_DIR, "test-video-3s.mp4"),
        );

        // Every field should be the expected type
        expect(info).toMatchObject({
          duration: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
          hasVideo: expect.any(Boolean),
          hasAudio: expect.any(Boolean),
          rotation: expect.any(Number),
          videoCodec: expect.any(String),
          format: expect.any(String),
          fps: expect.any(Number),
          size: expect.any(Number),
          bitrate: expect.any(Number),
        });
      });

      it("should return exactly 14 keys in the result", async () => {
        const info = await SIMPLEFFMPEG.probe(
          path.join(FIXTURES_DIR, "test-video-2s.mp4"),
        );
        const keys = Object.keys(info);
        expect(keys).toHaveLength(14);
        expect(keys.sort()).toEqual([
          "audioCodec",
          "bitrate",
          "channels",
          "duration",
          "format",
          "fps",
          "hasAudio",
          "hasVideo",
          "height",
          "rotation",
          "sampleRate",
          "size",
          "videoCodec",
          "width",
        ]);
      });

      it("should return expected values for known fixture", async () => {
        const info = await SIMPLEFFMPEG.probe(
          path.join(FIXTURES_DIR, "test-video-2s.mp4"),
        );

        // Known properties of the 2s blue test video
        expect(info.width).toBe(320);
        expect(info.height).toBe(240);
        expect(info.hasVideo).toBe(true);
        expect(info.hasAudio).toBe(true);
        expect(info.duration).toBeCloseTo(2, 0);
        expect(info.videoCodec).toBe("h264");
        expect(info.rotation).toBe(0);
      });

      it("should probe different video files and return different metadata", async () => {
        const [info1, info2] = await Promise.all([
          SIMPLEFFMPEG.probe(path.join(FIXTURES_DIR, "test-video-2s.mp4")),
          SIMPLEFFMPEG.probe(path.join(FIXTURES_DIR, "test-video-3s.mp4")),
        ]);

        // Both should be valid video files
        expect(info1.hasVideo).toBe(true);
        expect(info2.hasVideo).toBe(true);

        // They should have valid but different durations
        expect(info1.duration).toBeGreaterThan(0);
        expect(info2.duration).toBeGreaterThan(0);
        expect(info1.duration).not.toBeCloseTo(info2.duration, 0);
      });
    },
  );

  // ── Audio files ──────────────────────────────────────────────────────────

  describe.skipIf(!ffmpegAvailable || !fixturesExist())(
    "audio probing",
    () => {
      it("should probe an audio file with null video fields", async () => {
        const info = await SIMPLEFFMPEG.probe(
          path.join(FIXTURES_DIR, "test-audio-2s.mp3"),
        );

        // Audio present, video absent
        expect(info.hasAudio).toBe(true);
        expect(info.hasVideo).toBe(false);
        expect(info.width).toBeNull();
        expect(info.height).toBeNull();
        expect(info.videoCodec).toBeNull();
        expect(info.fps).toBeNull();
        expect(info.rotation).toBe(0);

        // Audio details should be present
        expect(typeof info.duration).toBe("number");
        expect(info.duration).toBeGreaterThan(0);
        expect(typeof info.audioCodec).toBe("string");
        expect(info.audioCodec.length).toBeGreaterThan(0);
        expect(typeof info.sampleRate).toBe("number");
        expect(info.sampleRate).toBeGreaterThan(0);
        expect(typeof info.channels).toBe("number");
        expect(info.channels).toBeGreaterThanOrEqual(1);
      });
    },
  );

  // ── Error handling ─────────────────────────────────────────────────────

  it("should throw MediaNotFoundError for non-existent file", async () => {
    await expect(
      SIMPLEFFMPEG.probe("/nonexistent/file.mp4"),
    ).rejects.toThrow();

    await expect(
      SIMPLEFFMPEG.probe("/nonexistent/file.mp4"),
    ).rejects.toThrow(/Failed to probe/);
  });

  it("should throw MediaNotFoundError which is an instance of the error class", async () => {
    try {
      await SIMPLEFFMPEG.probe("/nonexistent/file.mp4");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SIMPLEFFMPEG.MediaNotFoundError);
    }
  });
});
