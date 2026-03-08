import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const {
  loadText,
  loadEffect,
  loadSubtitle,
  loadColor,
} = await import("../../src/loaders.js");

function mockProject(overrides = {}) {
  return {
    videoOrAudioClips: [],
    textClips: [],
    subtitleClips: [],
    effectClips: [],
    filesToClean: [],
    options: { fontFile: null, tempDir: null, width: 1920, height: 1080 },
    ...overrides,
  };
}

describe("loaders", () => {
  describe("loadText", () => {
    it("should load a text clip with defaults", () => {
      const project = mockProject();
      loadText(project, {
        type: "text",
        text: "Hello",
        position: 0,
        end: 5,
      });

      expect(project.textClips).toHaveLength(1);
      const clip = project.textClips[0];
      expect(clip.fontFamily).toBe("Sans");
      expect(clip.fontSize).toBe(48);
      expect(clip.fontColor).toBe("#FFFFFF");
      expect(clip.xPercent).toBe(0.5);
      expect(clip.yPercent).toBe(0.5);
    });

    it("should use project fontFile when clip doesn't specify one", () => {
      const project = mockProject({
        options: { fontFile: "/fonts/custom.ttf" },
      });
      loadText(project, {
        type: "text",
        text: "Hello",
        position: 0,
        end: 5,
      });

      expect(project.textClips[0].fontFile).toBe("/fonts/custom.ttf");
    });

    it("should use explicit x/y coordinates when provided", () => {
      const project = mockProject();
      loadText(project, {
        type: "text",
        text: "Hello",
        position: 0,
        end: 5,
        x: 100,
        y: 200,
      });

      expect(project.textClips[0].x).toBe(100);
      expect(project.textClips[0].y).toBe(200);
      expect(project.textClips[0].xPercent).toBeUndefined();
      expect(project.textClips[0].yPercent).toBeUndefined();
    });

    it("should prefer xPercent/yPercent over x/y", () => {
      const project = mockProject();
      loadText(project, {
        type: "text",
        text: "Hello",
        position: 0,
        end: 5,
        xPercent: 0.3,
        yPercent: 0.7,
        x: 100,
        y: 200,
      });

      expect(project.textClips[0].xPercent).toBe(0.3);
      expect(project.textClips[0].yPercent).toBe(0.7);
    });

    it("should route karaoke text to subtitleClips", () => {
      const project = mockProject();
      loadText(project, {
        type: "text",
        text: "Sing along",
        position: 0,
        end: 5,
        mode: "karaoke",
        words: [{ text: "Sing", start: 0, end: 1 }],
      });

      expect(project.textClips).toHaveLength(0);
      expect(project.subtitleClips).toHaveLength(1);
      expect(project.subtitleClips[0].highlightColor).toBe("#FFFF00");
    });

    it("should use custom highlightColor for karaoke", () => {
      const project = mockProject();
      loadText(project, {
        type: "text",
        text: "Sing",
        position: 0,
        end: 5,
        mode: "karaoke",
        highlightColor: "#FF0000",
      });

      expect(project.subtitleClips[0].highlightColor).toBe("#FF0000");
    });
  });

  describe("loadEffect", () => {
    it("should load an effect clip with defaults", () => {
      const project = mockProject();
      loadEffect(project, {
        type: "effect",
        effectType: "vignette",
        position: 0,
        end: 5,
      });

      expect(project.effectClips).toHaveLength(1);
      const clip = project.effectClips[0];
      expect(clip.fadeIn).toBe(0);
      expect(clip.fadeOut).toBe(0);
      expect(clip.params).toEqual({});
    });

    it("should preserve custom fadeIn/fadeOut and params", () => {
      const project = mockProject();
      loadEffect(project, {
        type: "effect",
        effectType: "filmGrain",
        position: 0,
        end: 10,
        fadeIn: 0.5,
        fadeOut: 0.5,
        params: { intensity: 0.3 },
      });

      const clip = project.effectClips[0];
      expect(clip.fadeIn).toBe(0.5);
      expect(clip.fadeOut).toBe(0.5);
      expect(clip.params.intensity).toBe(0.3);
    });
  });

  describe("loadSubtitle", () => {
    it("should throw for non-existent subtitle file", () => {
      const project = mockProject();

      expect(() =>
        loadSubtitle(project, {
          type: "subtitle",
          url: "/tmp/nonexistent-12345.srt",
        }),
      ).toThrow("not found");
    });

    it("should throw for unsupported subtitle format", () => {
      const tmpFile = path.join(os.tmpdir(), "test-loader-sub.txt");
      fs.writeFileSync(tmpFile, "test");
      const project = mockProject();

      try {
        expect(() =>
          loadSubtitle(project, {
            type: "subtitle",
            url: tmpFile,
          }),
        ).toThrow("Unsupported subtitle format");
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it("should load a valid .srt subtitle file", () => {
      const tmpFile = path.join(os.tmpdir(), "test-loader-sub.srt");
      fs.writeFileSync(tmpFile, "1\n00:00:00,000 --> 00:00:05,000\nHello\n");
      const project = mockProject();

      try {
        loadSubtitle(project, {
          type: "subtitle",
          url: tmpFile,
          position: 2,
        });

        expect(project.subtitleClips).toHaveLength(1);
        expect(project.subtitleClips[0].fontFamily).toBe("Sans");
        expect(project.subtitleClips[0].position).toBe(2);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it("should accept .ass, .ssa, and .vtt formats", () => {
      const project = mockProject();
      const tmpFiles = [];
      for (const ext of [".ass", ".ssa", ".vtt"]) {
        const tmpFile = path.join(os.tmpdir(), `test-loader-sub${ext}`);
        fs.writeFileSync(tmpFile, "test content");
        tmpFiles.push(tmpFile);
        loadSubtitle(project, { type: "subtitle", url: tmpFile });
      }
      expect(project.subtitleClips).toHaveLength(3);
      tmpFiles.forEach((f) => fs.unlinkSync(f));
    });

    it("should default position to 0 when not provided", () => {
      const tmpFile = path.join(os.tmpdir(), "test-loader-sub-default.srt");
      fs.writeFileSync(tmpFile, "1\n00:00:00,000 --> 00:00:05,000\nHi\n");
      const project = mockProject();

      try {
        loadSubtitle(project, { type: "subtitle", url: tmpFile });
        expect(project.subtitleClips[0].position).toBe(0);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe("loadColor", () => {
    it("should load a flat color clip without file I/O", async () => {
      const project = mockProject();
      await loadColor(project, {
        type: "color",
        color: "#FF0000",
        position: 0,
        end: 5,
      });

      expect(project.videoOrAudioClips).toHaveLength(1);
      expect(project.videoOrAudioClips[0]._isFlatColor).toBe(true);
      expect(project.videoOrAudioClips[0].hasAudio).toBe(false);
    });

    it("should generate gradient PPM for gradient color clips", async () => {
      const project = mockProject();
      await loadColor(project, {
        type: "color",
        color: { type: "linear-gradient", colors: ["#FF0000", "#0000FF"] },
        position: 0,
        end: 5,
      });

      expect(project.videoOrAudioClips).toHaveLength(1);
      expect(project.videoOrAudioClips[0]._isFlatColor).toBeUndefined();
      expect(project.videoOrAudioClips[0].url).toContain("simpleffmpeg-gradient");
      expect(project.filesToClean).toHaveLength(1);

      // Clean up generated file
      try {
        fs.unlinkSync(project.videoOrAudioClips[0].url);
      } catch (_) {}
    });

    it("should use custom tempDir for gradient files", async () => {
      const tempDir = os.tmpdir();
      const project = mockProject({
        options: { tempDir, width: 100, height: 100 },
      });
      await loadColor(project, {
        type: "color",
        color: { type: "linear-gradient", colors: ["#000000", "#FFFFFF"] },
        position: 0,
        end: 2,
      });

      expect(project.videoOrAudioClips[0].url).toContain(tempDir);

      try {
        fs.unlinkSync(project.videoOrAudioClips[0].url);
      } catch (_) {}
    });
  });
});
