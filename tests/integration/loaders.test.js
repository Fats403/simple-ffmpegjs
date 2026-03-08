import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

const {
  loadVideo,
  loadAudio,
  loadImage,
  loadBackgroundAudio,
} = await import("../../src/loaders.js");

function isFFmpegAvailable() {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function fixturesExist() {
  return ["test-video-2s.mp4", "test-audio-2s.mp3", "test-image.png"].every(
    (f) => fs.existsSync(path.join(FIXTURES_DIR, f)),
  );
}

function mockProject() {
  return {
    videoOrAudioClips: [],
    textClips: [],
    subtitleClips: [],
    effectClips: [],
    filesToClean: [],
    options: {},
  };
}

describe("loaders (integration)", () => {
  const ffmpegAvailable = isFFmpegAvailable();
  const hasFixtures = fixturesExist();
  const canRun = ffmpegAvailable && hasFixtures;

  beforeAll(() => {
    if (!ffmpegAvailable) {
      console.warn("FFmpeg not available — skipping loader integration tests");
    }
    if (!hasFixtures) {
      console.warn("Fixtures not generated — skipping loader integration tests");
    }
  });

  describe("loadVideo", () => {
    it.skipIf(!canRun)("should load a video clip with probed metadata", async () => {
      const project = mockProject();
      await loadVideo(project, {
        type: "video",
        url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
        position: 0,
        end: 2,
        cutFrom: 0,
      });

      expect(project.videoOrAudioClips).toHaveLength(1);
      const clip = project.videoOrAudioClips[0];
      expect(clip.hasAudio).toBe(true);
      expect(clip.mediaDuration).toBeGreaterThan(1.5);
      expect(typeof clip.iphoneRotation).toBe("number");
    });

    it.skipIf(!canRun)("should throw when cutFrom exceeds source duration", async () => {
      const project = mockProject();
      await expect(
        loadVideo(project, {
          type: "video",
          url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
          cutFrom: 100,
        }),
      ).rejects.toThrow("cutFrom");
    });

    it.skipIf(!canRun)("should clamp end when requested duration exceeds source", async () => {
      const project = mockProject();
      await loadVideo(project, {
        type: "video",
        url: path.join(FIXTURES_DIR, "test-video-2s.mp4"),
        position: 0,
        end: 100,
        cutFrom: 0,
      });

      // End should be clamped to source duration
      expect(project.videoOrAudioClips[0].end).toBeLessThan(100);
    });
  });

  describe("loadAudio", () => {
    it.skipIf(!canRun)("should load an audio clip with probed metadata", async () => {
      const project = mockProject();
      await loadAudio(project, {
        type: "audio",
        url: path.join(FIXTURES_DIR, "test-audio-2s.mp3"),
        position: 0,
        end: 2,
        cutFrom: 0,
        volume: 0.8,
      });

      expect(project.videoOrAudioClips).toHaveLength(1);
      expect(project.videoOrAudioClips[0].mediaDuration).toBeGreaterThan(1.5);
    });

    it.skipIf(!canRun)("should throw when cutFrom exceeds source duration", async () => {
      const project = mockProject();
      await expect(
        loadAudio(project, {
          type: "audio",
          url: path.join(FIXTURES_DIR, "test-audio-2s.mp3"),
          cutFrom: 100,
        }),
      ).rejects.toThrow("cutFrom");
    });

    it.skipIf(!canRun)("should clamp end when audio overruns source", async () => {
      const project = mockProject();
      await loadAudio(project, {
        type: "audio",
        url: path.join(FIXTURES_DIR, "test-audio-2s.mp3"),
        position: 0,
        end: 100,
        cutFrom: 0,
      });

      expect(project.videoOrAudioClips[0].end).toBeLessThan(100);
    });
  });

  describe("loadImage", () => {
    it.skipIf(!canRun)("should load an image clip with probed dimensions", async () => {
      const project = mockProject();
      await loadImage(project, {
        type: "image",
        url: path.join(FIXTURES_DIR, "test-image.png"),
        position: 0,
        end: 3,
      });

      expect(project.videoOrAudioClips).toHaveLength(1);
      const clip = project.videoOrAudioClips[0];
      expect(clip.hasAudio).toBe(false);
      expect(clip.cutFrom).toBe(0);
      expect(clip.width).toBeGreaterThan(0);
      expect(clip.height).toBeGreaterThan(0);
    });

    it.skipIf(!canRun)("should use explicit dimensions over probed values", async () => {
      const project = mockProject();
      await loadImage(project, {
        type: "image",
        url: path.join(FIXTURES_DIR, "test-image.png"),
        position: 0,
        end: 3,
        width: 640,
        height: 480,
      });

      expect(project.videoOrAudioClips[0].width).toBe(640);
      expect(project.videoOrAudioClips[0].height).toBe(480);
    });
  });

  describe("loadBackgroundAudio", () => {
    it.skipIf(!canRun)("should load background audio with defaults", async () => {
      const project = mockProject();
      await loadBackgroundAudio(project, {
        type: "music",
        url: path.join(FIXTURES_DIR, "test-audio-2s.mp3"),
      });

      const clip = project.videoOrAudioClips[0];
      expect(clip.volume).toBe(0.2);
      expect(clip.cutFrom).toBe(0);
      expect(clip.position).toBe(0);
      expect(clip.mediaDuration).toBeGreaterThan(1.5);
    });

    it.skipIf(!canRun)("should throw when cutFrom exceeds source duration", async () => {
      const project = mockProject();
      await expect(
        loadBackgroundAudio(project, {
          type: "music",
          url: path.join(FIXTURES_DIR, "test-audio-2s.mp3"),
          cutFrom: 100,
        }),
      ).rejects.toThrow("cutFrom");
    });

    it.skipIf(!canRun)("should preserve custom volume and cutFrom", async () => {
      const project = mockProject();
      await loadBackgroundAudio(project, {
        type: "music",
        url: path.join(FIXTURES_DIR, "test-audio-2s.mp3"),
        volume: 0.5,
        cutFrom: 0.5,
        position: 1,
      });

      const clip = project.videoOrAudioClips[0];
      expect(clip.volume).toBe(0.5);
      expect(clip.cutFrom).toBe(0.5);
      expect(clip.position).toBe(1);
    });
  });
});
