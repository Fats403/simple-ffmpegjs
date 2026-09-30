import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, execSync, spawnSync } from "child_process";
import fs from "fs";
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

const fixture = (name) => path.join(FIXTURES_DIR, name);
// 320x240, 25 fps: red 0-2 s, blue 2-4 s, green 4-6 s, silent stereo audio
const MULTISCENE = fixture("test-video-multiscene-6s.mp4");
// 320x240, 2 s, blue, silent stereo audio
const VIDEO_2S = fixture("test-video-2s.mp4");
// 320x240, 2 s, purple, quiet 440 Hz tone
const TONE_VIDEO = fixture("test-video-tone-2s.mp4");
// 2 s 440 Hz sine
const AUDIO_2S = fixture("test-audio-2s.mp3");
// MP3 whose only video stream is cover art
const COVER_ART = fixture("test-audio-cover-art.mp3");

/** The average RGB colour of the frame at `time`, via a 1x1 downscale. */
function colorAt(file, time) {
  const buf = execFileSync(
    "ffmpeg",
    ["-v", "error", "-ss", String(time), "-i", file, "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  return { r: buf[0], g: buf[1], b: buf[2] };
}

const isRed = (c) => c.r > 150 && c.g < 80 && c.b < 80;
const isBlue = (c) => c.b > 150 && c.r < 80 && c.g < 80;
const isGreen = (c) => c.g > 80 && c.r < 80 && c.b < 80;

/** Mean volume in dB of [start, start+length) of a file's audio. */
function meanVolumeDb(file, start = 0, length) {
  const args = ["-hide_banner", "-ss", String(start), "-i", file];
  if (length != null) args.push("-t", String(length));
  args.push("-vn", "-af", "volumedetect", "-f", "null", "-");
  // volumedetect reports on stderr
  const { stderr } = spawnSync("ffmpeg", args, { encoding: "utf8" });
  const m = String(stderr).match(/mean_volume:\s*(-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : null;
}

async function expectRejection(promise, name, code) {
  let caught;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught, "expected promise to reject").toBeDefined();
  expect(caught.name).toBe(name);
  if (code) expect(caught.code).toBe(code);
  return caught;
}

const ffmpegAvailable = isFFmpegAvailable();

describe.skipIf(!ffmpegAvailable)("media edit operations (integration)", () => {
  const tmpDir = path.join(os.tmpdir(), `simpleffmpeg-edit-test-${process.pid}`);
  const out = (name) => path.join(tmpDir, name);

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("trim", () => {
    it("keeps exactly the middle scene of a video", async () => {
      const result = await SIMPLEFFMPEG.trim(MULTISCENE, {
        outputPath: out("trim-mid.mp4"),
        start: 2,
        end: 4,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.duration).toBeGreaterThan(1.9);
      expect(info.duration).toBeLessThan(2.15);
      expect(info.videoCodec).toBe("h264");
      expect(info.hasAudio).toBe(true);
      expect(isBlue(colorAt(result, 0.2))).toBe(true);
      expect(isBlue(colorAt(result, 1.8))).toBe(true);
    });

    it("trims audio only when the output is an audio file", async () => {
      const result = await SIMPLEFFMPEG.trim(AUDIO_2S, {
        outputPath: out("trim.mp3"),
        start: 0.5,
        end: 1.5,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.hasVideo).toBe(false);
      expect(info.duration).toBeGreaterThan(0.9);
      expect(info.duration).toBeLessThan(1.15);
    });

    it("clamps an end past the input", async () => {
      const result = await SIMPLEFFMPEG.trim(VIDEO_2S, {
        outputPath: out("trim-clamp.mp4"),
        start: 1,
        end: 99,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.duration).toBeLessThan(1.2);
    });

    it("refuses a start past the end", async () => {
      await expectRejection(
        SIMPLEFFMPEG.trim(VIDEO_2S, { outputPath: out("x.mp4"), start: 5, end: 6 }),
        "SimpleffmpegError",
      );
    });
  });

  describe("changeSpeed", () => {
    it("doubles speed: half the length, audio kept", async () => {
      const result = await SIMPLEFFMPEG.changeSpeed(MULTISCENE, {
        outputPath: out("fast.mp4"),
        speed: 2,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.duration).toBeGreaterThan(2.8);
      expect(info.duration).toBeLessThan(3.2);
      expect(info.hasAudio).toBe(true);
      // scenes are now 1 s each
      expect(isRed(colorAt(result, 0.5))).toBe(true);
      expect(isBlue(colorAt(result, 1.5))).toBe(true);
      expect(isGreen(colorAt(result, 2.5))).toBe(true);
    });

    it("halves speed: twice the length", async () => {
      const result = await SIMPLEFFMPEG.changeSpeed(VIDEO_2S, {
        outputPath: out("slow.mp4"),
        speed: 0.5,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.duration).toBeGreaterThan(3.8);
      expect(info.duration).toBeLessThan(4.3);
    });

    it("refuses an audio-only input", async () => {
      await expectRejection(
        SIMPLEFFMPEG.changeSpeed(COVER_ART, { outputPath: out("x.mp4"), speed: 2 }),
        "TranscodeError",
        "NO_VIDEO_STREAM",
      );
    });
  });

  describe("reverse", () => {
    it("plays the scenes backwards", async () => {
      const result = await SIMPLEFFMPEG.reverse(MULTISCENE, {
        outputPath: out("rev.mp4"),
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.duration).toBeGreaterThan(5.8);
      expect(info.duration).toBeLessThan(6.2);
      expect(isGreen(colorAt(result, 0.5))).toBe(true);
      expect(isBlue(colorAt(result, 3))).toBe(true);
      expect(isRed(colorAt(result, 5.5))).toBe(true);
    });

    it("refuses a clip past the memory budget, naming what fits", async () => {
      const err = await expectRejection(
        SIMPLEFFMPEG.reverse(MULTISCENE, {
          outputPath: out("x.mp4"),
          maxMemoryBytes: 1024 * 1024,
        }),
        "TranscodeError",
        "INPUT_TOO_LONG",
      );
      expect(err.message).toMatch(/limit at this size is about \d+s/);
      expect(fs.existsSync(out("x.mp4"))).toBe(false);
    });
  });

  describe("toGif", () => {
    it("writes a looping GIF from a segment", async () => {
      const result = await SIMPLEFFMPEG.toGif(MULTISCENE, {
        outputPath: out("clip.gif"),
        start: 1,
        duration: 2,
        fps: 10,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.videoCodec).toBe("gif");
      // 320 wide input is never upscaled to the 480 default
      expect(info.width).toBe(320);
      expect(info.duration).toBeGreaterThan(1.8);
      expect(info.duration).toBeLessThan(2.3);
    });

    it("refuses a segment past maxDurationSec", async () => {
      await expectRejection(
        SIMPLEFFMPEG.toGif(MULTISCENE, { outputPath: out("x.gif"), maxDurationSec: 3 }),
        "TranscodeError",
        "INPUT_TOO_LONG",
      );
    });
  });

  describe("crop", () => {
    it("crops a centered rectangle", async () => {
      const result = await SIMPLEFFMPEG.crop(VIDEO_2S, {
        outputPath: out("crop.mp4"),
        width: 160,
        height: 120,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.width).toBe(160);
      expect(info.height).toBe(120);
      expect(info.hasAudio).toBe(true);
    });

    it("rounds an odd crop down to even for the encoder", async () => {
      const result = await SIMPLEFFMPEG.crop(VIDEO_2S, {
        outputPath: out("crop-odd.mp4"),
        width: 161,
        height: 121,
        x: 0,
        y: 0,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.width).toBe(160);
      expect(info.height).toBe(120);
    });

    it("refuses a rectangle bigger than the picture", async () => {
      await expectRejection(
        SIMPLEFFMPEG.crop(VIDEO_2S, { outputPath: out("x.mp4"), width: 400, height: 100 }),
        "SimpleffmpegError",
      );
    });

    it("measures a rotated phone video as it is displayed", async () => {
      // Stored 320x240 with a 90° display rotation: shown as 240x320. A
      // 200x300 crop only fits the picture as displayed.
      const rotated = out("phone.mp4");
      try {
        execFileSync(
          "ffmpeg",
          ["-v", "error", "-y", "-display_rotation", "90", "-i", VIDEO_2S, "-c", "copy", rotated],
          { stdio: "pipe" },
        );
      } catch {
        return; // ffmpeg without -display_rotation (before 6.1): nothing to test
      }
      const probe = await SIMPLEFFMPEG.probe(rotated);
      expect(Math.abs(probe.rotation)).toBe(90);

      const result = await SIMPLEFFMPEG.crop(rotated, {
        outputPath: out("phone-crop.mp4"),
        width: 200,
        height: 300,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.width).toBe(200);
      expect(info.height).toBe(300);
      expect(info.rotation).toBe(0);
    });
  });

  describe("rotate", () => {
    it("a quarter turn swaps the sides", async () => {
      const result = await SIMPLEFFMPEG.rotate(VIDEO_2S, {
        outputPath: out("rot90.mp4"),
        degrees: 90,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.width).toBe(240);
      expect(info.height).toBe(320);
    });

    it("a half turn keeps them", async () => {
      const result = await SIMPLEFFMPEG.rotate(VIDEO_2S, {
        outputPath: out("rot180.mp4"),
        degrees: 180,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.width).toBe(320);
      expect(info.height).toBe(240);
    });
  });

  describe("mute", () => {
    it("drops the audio and keeps a web-safe picture as is", async () => {
      const result = await SIMPLEFFMPEG.mute(TONE_VIDEO, { outputPath: out("mute.mp4") });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.hasAudio).toBe(false);
      expect(info.hasVideo).toBe(true);
      expect(info.videoCodec).toBe("h264");
      expect(info.width).toBe(320);
    });
  });

  describe("fadeAudio", () => {
    it("is quieter at the faded edges than in the middle", async () => {
      const result = await SIMPLEFFMPEG.fadeAudio(AUDIO_2S, {
        outputPath: out("fade.mp3"),
        fadeInSec: 0.6,
        fadeOutSec: 0.6,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.duration).toBeGreaterThan(1.9);
      const head = meanVolumeDb(result, 0, 0.15);
      const middle = meanVolumeDb(result, 0.9, 0.2);
      const tail = meanVolumeDb(result, 1.85, 0.15);
      expect(middle - head).toBeGreaterThan(6);
      expect(middle - tail).toBeGreaterThan(6);
    });

    it("refuses fades longer than the file", async () => {
      await expectRejection(
        SIMPLEFFMPEG.fadeAudio(AUDIO_2S, {
          outputPath: out("x.mp3"),
          fadeInSec: 1.5,
          fadeOutSec: 1,
        }),
        "SimpleffmpegError",
      );
    });
  });

  describe("normalizeLoudness keepVideo", () => {
    it("levels the audio and keeps the picture", async () => {
      const before = meanVolumeDb(TONE_VIDEO);
      const result = await SIMPLEFFMPEG.normalizeLoudness(TONE_VIDEO, {
        outputPath: out("level.mp4"),
        keepVideo: true,
      });
      const info = await SIMPLEFFMPEG.probe(result);
      expect(info.hasVideo).toBe(true);
      expect(info.hasAudio).toBe(true);
      expect(info.videoCodec).toBe("h264");
      expect(info.width).toBe(320);
      const after = meanVolumeDb(result);
      expect(after - before).toBeGreaterThan(6);
    });

    it("refuses keepVideo on an audio-only input", async () => {
      await expectRejection(
        SIMPLEFFMPEG.normalizeLoudness(AUDIO_2S, {
          outputPath: out("x.mp4"),
          keepVideo: true,
        }),
        "TranscodeError",
        "NO_VIDEO_STREAM",
      );
    });
  });
});
