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
    "test-speech-gaps.wav",
    "test-speech-padded.wav",
    "test-audio-quiet-2s.wav",
    "test-audio-cover-art.mp3",
    "test-audio-2s.mp3",
  ].every((f) => fs.existsSync(path.join(FIXTURES_DIR, f)));
}

// test-speech-gaps.wav layout: 0.8s tone, 1.5s gap, 0.8s tone, 2.0s gap,
// 0.8s tone → 5.9s total. Gaps at [0.8, 2.3] and [3.1, 5.1].
const GAPS = path.join(FIXTURES_DIR, "test-speech-gaps.wav");
// test-speech-padded.wav layout: 1.2s silence, 1.0s tone, 1.5s silence → 3.7s.
const PADDED = path.join(FIXTURES_DIR, "test-speech-padded.wav");
const QUIET = path.join(FIXTURES_DIR, "test-audio-quiet-2s.wav");
const COVER_ART = path.join(FIXTURES_DIR, "test-audio-cover-art.mp3");
const PLAIN_MP3 = path.join(FIXTURES_DIR, "test-audio-2s.mp3");

describe("audio operations (integration)", () => {
  const ffmpegAvailable = isFFmpegAvailable();
  const tmpDir = path.join(os.tmpdir(), `simpleffmpeg-audio-test-${process.pid}`);

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

  // ── detectSilence ─────────────────────────────────────────────────────────

  skipIfNoFFmpeg("detectSilence finds the two known gaps", async () => {
    const silences = await SIMPLEFFMPEG.detectSilence(GAPS);
    expect(silences).toHaveLength(2);
    expect(silences[0].start).toBeCloseTo(0.8, 1);
    expect(silences[0].end).toBeCloseTo(2.3, 1);
    expect(silences[1].start).toBeCloseTo(3.1, 1);
    expect(silences[1].end).toBeCloseTo(5.1, 1);
  });

  skipIfNoFFmpeg(
    "detectSilence closes a trailing silence at the file end",
    async () => {
      const silences = await SIMPLEFFMPEG.detectSilence(PADDED);
      expect(silences).toHaveLength(2);
      expect(silences[0].start).toBeCloseTo(0, 1);
      expect(silences[0].end).toBeCloseTo(1.2, 1);
      expect(silences[1].start).toBeCloseTo(2.2, 1);
      expect(silences[1].end).toBeCloseTo(3.7, 1);
    },
  );

  skipIfNoFFmpeg(
    "detectSilence respects a minDurationSec above the gap lengths",
    async () => {
      const silences = await SIMPLEFFMPEG.detectSilence(GAPS, {
        minDurationSec: 1.8,
      });
      expect(silences).toHaveLength(1);
      expect(silences[0].start).toBeCloseTo(3.1, 1);
    },
  );

  // ── audioTempo ────────────────────────────────────────────────────────────

  skipIfNoFFmpeg("audioTempo 1.25 shortens duration without artifacts", async () => {
    const out = path.join(tmpDir, "tempo.wav");
    await SIMPLEFFMPEG.audioTempo(GAPS, { outputPath: out, tempo: 1.25 });
    const info = await SIMPLEFFMPEG.probe(out);
    expect(info.duration).toBeCloseTo(5.9 / 1.25, 1);
    expect(info.sampleRate).toBe(44100);
  });

  skipIfNoFFmpeg("audioTempo 0.8 lengthens duration", async () => {
    const out = path.join(tmpDir, "tempo-slow.wav");
    await SIMPLEFFMPEG.audioTempo(GAPS, { outputPath: out, tempo: 0.8 });
    const info = await SIMPLEFFMPEG.probe(out);
    expect(info.duration).toBeCloseTo(5.9 / 0.8, 1);
  });

  skipIfNoFFmpeg("audioTempo rejects an out-of-range tempo upfront", async () => {
    const out = path.join(tmpDir, "tempo-bad.wav");
    await expect(
      SIMPLEFFMPEG.audioTempo(GAPS, { outputPath: out, tempo: 9 }),
    ).rejects.toMatchObject({ name: "SimpleffmpegError" });
  });

  // ── spliceAudio ───────────────────────────────────────────────────────────

  skipIfNoFFmpeg(
    "spliceAudio assembles source ranges and silence to the exact length",
    async () => {
      const out = path.join(tmpDir, "spliced.wav");
      await SIMPLEFFMPEG.spliceAudio(GAPS, {
        outputPath: out,
        segments: [
          { start: 0, end: 0.8 },
          { silence: 0.4 },
          { start: 2.3, end: 3.1 },
        ],
      });
      const info = await SIMPLEFFMPEG.probe(out);
      expect(info.duration).toBeCloseTo(2.0, 1);
    },
  );

  skipIfNoFFmpeg("spliceAudio picks the codec from the extension", async () => {
    const out = path.join(tmpDir, "spliced.mp3");
    await SIMPLEFFMPEG.spliceAudio(GAPS, {
      outputPath: out,
      segments: [{ start: 0, end: 1 }],
    });
    const info = await SIMPLEFFMPEG.probe(out);
    expect(info.audioCodec).toBe("mp3");
  });

  skipIfNoFFmpeg("spliceAudio rejects segments beyond the input", async () => {
    const out = path.join(tmpDir, "bad.wav");
    await expect(
      SIMPLEFFMPEG.spliceAudio(GAPS, {
        outputPath: out,
        segments: [{ start: 10, end: 12 }],
      }),
    ).rejects.toMatchObject({ name: "SimpleffmpegError" });
  });

  // ── trimSilence ───────────────────────────────────────────────────────────

  skipIfNoFFmpeg(
    "trimSilence removes edge silence, keeping keepSec of room tone",
    async () => {
      const out = path.join(tmpDir, "trimmed.wav");
      await SIMPLEFFMPEG.trimSilence(PADDED, { outputPath: out });
      const info = await SIMPLEFFMPEG.probe(out);
      // 1.0s tone + 0.15s kept on each side = ~1.3s
      expect(info.duration).toBeCloseTo(1.3, 1);
    },
  );

  skipIfNoFFmpeg("trimSilence edges:'start' leaves the tail alone", async () => {
    const out = path.join(tmpDir, "trimmed-start.wav");
    await SIMPLEFFMPEG.trimSilence(PADDED, { outputPath: out, edges: "start" });
    const info = await SIMPLEFFMPEG.probe(out);
    // removes ~1.05s of the 1.2s lead, keeps the 1.5s tail
    expect(info.duration).toBeCloseTo(3.7 - 1.05, 1);
  });

  // ── capSilences ───────────────────────────────────────────────────────────

  skipIfNoFFmpeg("capSilences shortens interior gaps to the cap", async () => {
    const out = path.join(tmpDir, "capped.wav");
    await SIMPLEFFMPEG.capSilences(GAPS, {
      outputPath: out,
      maxSilenceSec: 0.5,
    });
    const info = await SIMPLEFFMPEG.probe(out);
    // 5.9 - (1.5-0.5) - (2.0-0.5) = 3.4
    expect(info.duration).toBeCloseTo(3.4, 1);
  });

  skipIfNoFFmpeg(
    "capSilences leaves a file alone when no gap exceeds the cap",
    async () => {
      const out = path.join(tmpDir, "uncapped.wav");
      await SIMPLEFFMPEG.capSilences(GAPS, {
        outputPath: out,
        maxSilenceSec: 3,
      });
      const info = await SIMPLEFFMPEG.probe(out);
      expect(info.duration).toBeCloseTo(5.9, 1);
    },
  );

  // ── normalizeLoudness ─────────────────────────────────────────────────────

  skipIfNoFFmpeg(
    "normalizeLoudness brings a quiet file to the LUFS target",
    async () => {
      const out = path.join(tmpDir, "normalized.wav");
      await SIMPLEFFMPEG.normalizeLoudness(QUIET, {
        outputPath: out,
        targetLufs: -16,
      });
      // Measure the output with a fresh loudnorm analysis pass
      const measured = execSync(
        `ffmpeg -hide_banner -i "${out}" -af loudnorm=I=-16:print_format=json -f null - 2>&1`,
        { encoding: "utf8" },
      );
      const block = measured.match(/\{[^{}]*\}/g)?.pop();
      const inputI = parseFloat(JSON.parse(block).input_i);
      expect(inputI).toBeGreaterThan(-18);
      expect(inputI).toBeLessThan(-14);
      // Sample rate pinned back to the source (loudnorm runs at 192k internally)
      const info = await SIMPLEFFMPEG.probe(out);
      expect(info.sampleRate).toBe(44100);
    },
  );

  // ── transcode audio handling ──────────────────────────────────────────────

  skipIfNoFFmpeg("transcode web-audio ingests an mp3 to AAC/m4a", async () => {
    const out = path.join(tmpDir, "ingested.m4a");
    await SIMPLEFFMPEG.transcode(PLAIN_MP3, {
      outputPath: out,
      preset: "web-audio",
    });
    const info = await SIMPLEFFMPEG.probe(out);
    expect(info.audioCodec).toBe("aac");
    expect(info.format).toContain("mp4");
    expect(info.hasVideo).toBe(false);
    expect(info.duration).toBeCloseTo(2, 0);
  });

  skipIfNoFFmpeg(
    "transcode web-mp4 rejects audio-only input with NO_VIDEO_STREAM",
    async () => {
      const out = path.join(tmpDir, "nope.mp4");
      await expect(
        SIMPLEFFMPEG.transcode(PLAIN_MP3, { outputPath: out, preset: "web-mp4" }),
      ).rejects.toMatchObject({ name: "TranscodeError", code: "NO_VIDEO_STREAM" });
    },
  );

  skipIfNoFFmpeg(
    "transcode web-mp4 rejects cover-art-only video with NO_VIDEO_STREAM",
    async () => {
      const out = path.join(tmpDir, "nope2.mp4");
      await expect(
        SIMPLEFFMPEG.transcode(COVER_ART, { outputPath: out, preset: "web-mp4" }),
      ).rejects.toMatchObject({ name: "TranscodeError", code: "NO_VIDEO_STREAM" });
    },
  );

  skipIfNoFFmpeg(
    "probe reports attachedPic for an mp3 with embedded cover art",
    async () => {
      const info = await SIMPLEFFMPEG.probe(COVER_ART);
      expect(info.hasVideo).toBe(true);
      expect(info.attachedPic).toBe(true);
      expect(SIMPLEFFMPEG.isWebSafeMp4(info)).toBe(false);
    },
  );

  skipIfNoFFmpeg(
    "transcode web-audio rejects video-only options and bad extensions",
    async () => {
      await expect(
        SIMPLEFFMPEG.transcode(PLAIN_MP3, {
          outputPath: path.join(tmpDir, "x.m4a"),
          preset: "web-audio",
          crf: 23,
        }),
      ).rejects.toMatchObject({ name: "SimpleffmpegError" });
      await expect(
        SIMPLEFFMPEG.transcode(PLAIN_MP3, {
          outputPath: path.join(tmpDir, "x.mp3"),
          preset: "web-audio",
        }),
      ).rejects.toMatchObject({ name: "SimpleffmpegError" });
    },
  );
});
