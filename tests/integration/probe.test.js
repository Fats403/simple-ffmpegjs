import { describe, it, expect } from "vitest";
import path from "path";

const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;

const TEST_DIR = path.join(import.meta.dirname, "../../test-files");

describe("SIMPLEFFMPEG.probe", () => {
  // ── Video files ──────────────────────────────────────────────────────────

  it("should probe a video file and return all expected fields", async () => {
    const info = await SIMPLEFFMPEG.probe(
      path.join(TEST_DIR, "machu-picchu.mp4")
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
      path.join(TEST_DIR, "colosseum.mp4")
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
      path.join(TEST_DIR, "machu-picchu.mp4")
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

  // ── Audio files ──────────────────────────────────────────────────────────

  it("should probe an audio file with null video fields", async () => {
    const info = await SIMPLEFFMPEG.probe(
      path.join(TEST_DIR, "test-music.wav")
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

  // ── Error handling ─────────────────────────────────────────────────────

  it("should throw MediaNotFoundError for non-existent file", async () => {
    await expect(
      SIMPLEFFMPEG.probe("/nonexistent/file.mp4")
    ).rejects.toThrow();

    await expect(
      SIMPLEFFMPEG.probe("/nonexistent/file.mp4")
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

  // ── Multiple files ─────────────────────────────────────────────────────

  it("should probe different video files and return different metadata", async () => {
    const [info1, info2] = await Promise.all([
      SIMPLEFFMPEG.probe(path.join(TEST_DIR, "machu-picchu.mp4")),
      SIMPLEFFMPEG.probe(path.join(TEST_DIR, "great-wall.mp4")),
    ]);

    // Both should be valid video files
    expect(info1.hasVideo).toBe(true);
    expect(info2.hasVideo).toBe(true);

    // They should have valid durations (may or may not differ)
    expect(info1.duration).toBeGreaterThan(0);
    expect(info2.duration).toBeGreaterThan(0);
  });
});
