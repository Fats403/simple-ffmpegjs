import { describe, it, expect } from "vitest";

const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;
const { loadText } = await import("../../src/loaders.js");

describe("Global fontFile option", () => {
  describe("constructor", () => {
    it("should store fontFile in options when provided", () => {
      const project = new SIMPLEFFMPEG({ fontFile: "/fonts/MyFont.ttf" });
      expect(project.options.fontFile).toBe("/fonts/MyFont.ttf");
    });

    it("should default fontFile to null when not provided", () => {
      const project = new SIMPLEFFMPEG({});
      expect(project.options.fontFile).toBeNull();
    });

    it("should default fontFile to null when constructor has no options", () => {
      const project = new SIMPLEFFMPEG();
      expect(project.options.fontFile).toBeNull();
    });

    it("should coexist with other constructor options", () => {
      const project = new SIMPLEFFMPEG({
        width: 1080,
        height: 1920,
        fps: 60,
        preset: "tiktok",
        fontFile: "/fonts/Custom.otf",
      });
      expect(project.options.fontFile).toBe("/fonts/Custom.otf");
      expect(project.options.fps).toBe(60);
      expect(project.options.preset).toBe("tiktok");
    });
  });

  describe("loadText propagation", () => {
    it("should apply global fontFile to text clips that don't specify one", () => {
      const project = new SIMPLEFFMPEG({ fontFile: "/fonts/Global.ttf" });
      loadText(project, {
        type: "text",
        text: "Hello",
        position: 0,
        end: 3,
      });

      expect(project.textClips).toHaveLength(1);
      expect(project.textClips[0].fontFile).toBe("/fonts/Global.ttf");
    });

    it("should allow per-clip fontFile to override global fontFile", () => {
      const project = new SIMPLEFFMPEG({ fontFile: "/fonts/Global.ttf" });
      loadText(project, {
        type: "text",
        text: "Hello",
        position: 0,
        end: 3,
        fontFile: "/fonts/Special.otf",
      });

      expect(project.textClips).toHaveLength(1);
      expect(project.textClips[0].fontFile).toBe("/fonts/Special.otf");
    });

    it("should leave fontFile null when neither global nor per-clip is set", () => {
      const project = new SIMPLEFFMPEG({});
      loadText(project, {
        type: "text",
        text: "Hello",
        position: 0,
        end: 3,
      });

      expect(project.textClips).toHaveLength(1);
      expect(project.textClips[0].fontFile).toBeNull();
    });

    it("should apply global fontFile to multiple text clips", () => {
      const project = new SIMPLEFFMPEG({ fontFile: "/fonts/Global.ttf" });

      loadText(project, { type: "text", text: "First", position: 0, end: 2 });
      loadText(project, { type: "text", text: "Second", position: 2, end: 4 });
      loadText(project, { type: "text", text: "Third", position: 4, end: 6 });

      expect(project.textClips).toHaveLength(3);
      project.textClips.forEach((clip) => {
        expect(clip.fontFile).toBe("/fonts/Global.ttf");
      });
    });

    it("should allow mixed: some clips use global, some override", () => {
      const project = new SIMPLEFFMPEG({ fontFile: "/fonts/Global.ttf" });

      loadText(project, { type: "text", text: "Uses global", position: 0, end: 2 });
      loadText(project, {
        type: "text",
        text: "Uses override",
        position: 2,
        end: 4,
        fontFile: "/fonts/Override.otf",
      });
      loadText(project, { type: "text", text: "Uses global", position: 4, end: 6 });

      expect(project.textClips[0].fontFile).toBe("/fonts/Global.ttf");
      expect(project.textClips[1].fontFile).toBe("/fonts/Override.otf");
      expect(project.textClips[2].fontFile).toBe("/fonts/Global.ttf");
    });

    it("should apply global fontFile to karaoke text clips too", () => {
      const project = new SIMPLEFFMPEG({ fontFile: "/fonts/Global.ttf" });
      loadText(project, {
        type: "text",
        text: "Karaoke lyrics",
        position: 0,
        end: 5,
        mode: "karaoke",
      });

      expect(project.subtitleClips).toHaveLength(1);
      expect(project.subtitleClips[0].fontFile).toBe("/fonts/Global.ttf");
    });
  });
});
