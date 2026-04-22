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

function fixturesExist() {
  return [
    "test-video-2s.mp4",
    "test-video-odd-dims-1s.mp4",
    "test-video-noaudio-1s.mp4",
    "test-video-busy-5s.mp4",
  ].every((f) => fs.existsSync(path.join(FIXTURES_DIR, f)));
}

describe("SIMPLEFFMPEG.transcode (integration)", () => {
  const ffmpegAvailable = isFFmpegAvailable();
  const tmpDir = path.join(os.tmpdir(), `simpleffmpeg-transcode-test-${process.pid}`);

  beforeAll(() => {
    if (ffmpegAvailable && !fixturesExist()) {
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
    // Best-effort cleanup of any leftover output files in tmpDir
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

  skipIfNoFFmpeg("round-trip: input → web-mp4 output is h264/mp4/yuv420p", async () => {
    const input = path.join(FIXTURES_DIR, "test-video-2s.mp4");
    const output = path.join(tmpDir, "round-trip.mp4");

    const result = await SIMPLEFFMPEG.transcode(input, {
      outputPath: output,
      preset: "web-mp4",
    });

    expect(result).toBe(output);
    expect(fs.existsSync(output)).toBe(true);

    const info = await SIMPLEFFMPEG.probe(output);
    expect(info.videoCodec).toBe("h264");
    expect(info.format).toContain("mp4");
    expect(info.pixelFormat).toBe("yuv420p");
    expect(info.hasVideo).toBe(true);
    expect(info.hasAudio).toBe(true);
    // Duration should roughly match input (2s ± a frame or two)
    expect(info.duration).toBeGreaterThan(1.5);
    expect(info.duration).toBeLessThan(2.5);
  });

  skipIfNoFFmpeg("odd dimensions 1081×721 → output is 1080×720", async () => {
    const input = path.join(FIXTURES_DIR, "test-video-odd-dims-1s.mp4");
    const output = path.join(tmpDir, "odd-dims.mp4");

    await SIMPLEFFMPEG.transcode(input, {
      outputPath: output,
      preset: "web-mp4",
    });

    const info = await SIMPLEFFMPEG.probe(output);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(720);
  });

  skipIfNoFFmpeg("succeeds on input with no audio (optional 0:a:0? map)", async () => {
    const input = path.join(FIXTURES_DIR, "test-video-noaudio-1s.mp4");
    const output = path.join(tmpDir, "noaudio.mp4");

    await SIMPLEFFMPEG.transcode(input, {
      outputPath: output,
      preset: "web-mp4",
    });

    const info = await SIMPLEFFMPEG.probe(output);
    expect(info.videoCodec).toBe("h264");
    expect(info.hasAudio).toBe(false);
  });

  skipIfNoFFmpeg("timeoutMs: rejects with code TIMEOUT and cleans up partial output", async () => {
    // Use the 5s 720p testsrc fixture so re-encoding takes long enough to
    // reliably trip the 50ms timeout (a 320x240 solid-color clip transcodes
    // in well under 50ms and would race with the timer).
    const input = path.join(FIXTURES_DIR, "test-video-busy-5s.mp4");
    const output = path.join(tmpDir, "timeout.mp4");

    const start = Date.now();
    let err;
    try {
      await SIMPLEFFMPEG.transcode(input, {
        outputPath: output,
        preset: "web-mp4",
        timeoutMs: 50,
      });
    } catch (e) {
      err = e;
    }
    const elapsed = Date.now() - start;

    expect(err).toBeDefined();
    expect(err.name).toBe("TranscodeError");
    expect(err.code).toBe("TIMEOUT");
    expect(elapsed).toBeLessThan(5000);
    // Partial output should be cleaned up
    expect(fs.existsSync(output)).toBe(false);
  });

  // NOTE: we deliberately don't integration-test that -fs actually halts a
  // transcode. ffmpeg 7.x enforces -fs only advisorily for MP4 output — it
  // can finish and exit 0 well over the cap. The library passes the flag
  // (verified in unit tests) as a best-effort safety net; the reliable hard
  // cap is timeoutMs. Partial-output cleanup is covered by the timeout test
  // above, which exercises the same failure path.

  skipIfNoFFmpeg("missing input rejects with code INPUT_MISSING (no spawn)", async () => {
    const input = path.join(FIXTURES_DIR, "does-not-exist.mp4");
    const output = path.join(tmpDir, "missing.mp4");

    let err;
    try {
      await SIMPLEFFMPEG.transcode(input, {
        outputPath: output,
        preset: "web-mp4",
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe("TranscodeError");
    expect(err.code).toBe("INPUT_MISSING");
  });

  skipIfNoFFmpeg("path starting with '-' rejects with code INVALID_PATH (no spawn)", async () => {
    const input = path.join(FIXTURES_DIR, "test-video-2s.mp4");
    const output = path.join(tmpDir, "-flag.mp4");

    let err;
    try {
      await SIMPLEFFMPEG.transcode(input, {
        outputPath: output,
        preset: "web-mp4",
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe("TranscodeError");
    expect(err.code).toBe("INVALID_PATH");
  });

  skipIfNoFFmpeg("customArgs path: hardening (timeout) still applies", async () => {
    // Use the bigger fixture so the medium-preset re-encode reliably
    // outlasts the 50ms timeout.
    const input = path.join(FIXTURES_DIR, "test-video-busy-5s.mp4");
    const output = path.join(tmpDir, "custom.mp4");

    let err;
    try {
      await SIMPLEFFMPEG.transcode(input, {
        outputPath: output,
        customArgs: [
          "-nostdin",
          "-y",
          "-i",
          input,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "23",
          output,
        ],
        timeoutMs: 50,
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe("TranscodeError");
    expect(err.code).toBe("TIMEOUT");
    expect(fs.existsSync(output)).toBe(false);
  });

  skipIfNoFFmpeg("onProgress callback fires with monotonically increasing percents ending at 100", async () => {
    const input = path.join(FIXTURES_DIR, "test-video-2s.mp4");
    const output = path.join(tmpDir, "progress.mp4");
    const calls = [];

    await SIMPLEFFMPEG.transcode(input, {
      outputPath: output,
      preset: "web-mp4",
      onProgress: (pct) => calls.push(pct),
    });

    expect(calls.length).toBeGreaterThan(0);
    // Last call should be 100
    expect(calls[calls.length - 1]).toBe(100);
    // All in-progress values should be 0..99
    for (const c of calls.slice(0, -1)) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(99);
    }
    // Monotonically non-decreasing
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThanOrEqual(calls[i - 1]);
    }
  });

  skipIfNoFFmpeg("ffmpeg failure (invalid codec via customArgs) → NONZERO_EXIT with stderr tail and partial cleanup", async () => {
    const input = path.join(FIXTURES_DIR, "test-video-2s.mp4");
    const output = path.join(tmpDir, "nonzero.mp4");

    let err;
    try {
      await SIMPLEFFMPEG.transcode(input, {
        outputPath: output,
        customArgs: [
          "-nostdin",
          "-y",
          "-hide_banner",
          "-i",
          input,
          "-c:v",
          "this_codec_does_not_exist_definitely",
          output,
        ],
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe("TranscodeError");
    expect(err.code).toBe("NONZERO_EXIT");
    // Captured stderr tail — proves the bounded ring buffer received the
    // failure message rather than dropping it
    expect(typeof err.stderr).toBe("string");
    expect(err.stderr.length).toBeGreaterThan(0);
    // Partial output cleaned up regardless of failure cause
    expect(fs.existsSync(output)).toBe(false);
  });

  skipIfNoFFmpeg("missing ffmpeg binary → FFMPEG_NOT_FOUND with actionable message", async () => {
    // Force ENOENT by pointing PATH at a directory that has no ffmpeg/ffprobe.
    // Vitest runs tests within a file sequentially, so mutating process.env
    // for one test is safe as long as we restore in finally.
    const input = path.join(FIXTURES_DIR, "test-video-2s.mp4");
    const output = path.join(tmpDir, "no-ffmpeg.mp4");
    const originalPath = process.env.PATH;
    process.env.PATH = "/nonexistent-path-for-ffmpeg-test";

    let err;
    try {
      await SIMPLEFFMPEG.transcode(input, {
        outputPath: output,
        preset: "web-mp4",
      });
    } catch (e) {
      err = e;
    } finally {
      process.env.PATH = originalPath;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe("TranscodeError");
    expect(err.code).toBe("FFMPEG_NOT_FOUND");
    expect(err.message).toMatch(/install ffmpeg/i);
  });

  skipIfNoFFmpeg("AbortSignal cancels transcode with code ABORTED", async () => {
    // Use bigger fixture so abort reliably races with mid-encode (the
    // small fixture finishes before the AbortController fires).
    const input = path.join(FIXTURES_DIR, "test-video-busy-5s.mp4");
    const output = path.join(tmpDir, "abort.mp4");
    const ac = new AbortController();

    // Abort after 50ms
    setTimeout(() => ac.abort(), 50);

    let err;
    try {
      await SIMPLEFFMPEG.transcode(input, {
        outputPath: output,
        preset: "web-mp4",
        signal: ac.signal,
      });
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe("TranscodeError");
    expect(err.code).toBe("ABORTED");
    expect(fs.existsSync(output)).toBe(false);
  });
});
