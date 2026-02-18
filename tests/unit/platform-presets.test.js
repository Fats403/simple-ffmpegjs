import { describe, it, expect } from "vitest";
import os from "os";

const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;

describe("Platform Presets", () => {
  describe("constructor with preset", () => {
    it("should apply tiktok preset (1080x1920)", () => {
      const ff = new SIMPLEFFMPEG({ preset: "tiktok" });
      expect(ff.options.width).toBe(1080);
      expect(ff.options.height).toBe(1920);
      expect(ff.options.fps).toBe(30);
      expect(ff.options.preset).toBe("tiktok");
    });

    it("should apply youtube-short preset (1080x1920)", () => {
      const ff = new SIMPLEFFMPEG({ preset: "youtube-short" });
      expect(ff.options.width).toBe(1080);
      expect(ff.options.height).toBe(1920);
      expect(ff.options.fps).toBe(30);
    });

    it("should apply instagram-reel preset (1080x1920)", () => {
      const ff = new SIMPLEFFMPEG({ preset: "instagram-reel" });
      expect(ff.options.width).toBe(1080);
      expect(ff.options.height).toBe(1920);
      expect(ff.options.fps).toBe(30);
    });

    it("should apply instagram-post preset (1080x1080)", () => {
      const ff = new SIMPLEFFMPEG({ preset: "instagram-post" });
      expect(ff.options.width).toBe(1080);
      expect(ff.options.height).toBe(1080);
      expect(ff.options.fps).toBe(30);
    });

    it("should apply youtube preset (1920x1080)", () => {
      const ff = new SIMPLEFFMPEG({ preset: "youtube" });
      expect(ff.options.width).toBe(1920);
      expect(ff.options.height).toBe(1080);
      expect(ff.options.fps).toBe(30);
    });

    it("should apply landscape preset (1920x1080)", () => {
      const ff = new SIMPLEFFMPEG({ preset: "landscape" });
      expect(ff.options.width).toBe(1920);
      expect(ff.options.height).toBe(1080);
      expect(ff.options.fps).toBe(30);
    });

    it("should apply instagram-portrait preset (1080x1350)", () => {
      const ff = new SIMPLEFFMPEG({ preset: "instagram-portrait" });
      expect(ff.options.width).toBe(1080);
      expect(ff.options.height).toBe(1350);
      expect(ff.options.fps).toBe(30);
    });

    it("should allow explicit options to override preset values", () => {
      const ff = new SIMPLEFFMPEG({
        preset: "tiktok",
        width: 720, // Override preset width
        fps: 60, // Override preset fps
      });
      expect(ff.options.width).toBe(720); // Overridden
      expect(ff.options.height).toBe(1920); // From preset
      expect(ff.options.fps).toBe(60); // Overridden
    });

    it("should use defaults when no preset specified", () => {
      const ff = new SIMPLEFFMPEG({});
      expect(ff.options.width).toBe(1920);
      expect(ff.options.height).toBe(1080);
      expect(ff.options.fps).toBe(30);
      expect(ff.options.preset).toBe(null);
    });

    it("should warn but not fail on unknown preset", () => {
      // Should not throw, just use defaults
      const ff = new SIMPLEFFMPEG({ preset: "unknown-platform" });
      expect(ff.options.width).toBe(1920); // Falls back to default
      expect(ff.options.height).toBe(1080); // Falls back to default
    });
  });

  describe("constructor with tempDir", () => {
    it("should accept a valid tempDir", () => {
      const ff = new SIMPLEFFMPEG({ tempDir: os.tmpdir() });
      expect(ff.options.tempDir).toBe(os.tmpdir());
    });

    it("should throw if tempDir does not exist", () => {
      expect(() => new SIMPLEFFMPEG({ tempDir: "/nonexistent/path" })).toThrow(
        /does not exist/
      );
    });

    it("should throw if tempDir is not a string", () => {
      expect(() => new SIMPLEFFMPEG({ tempDir: 123 })).toThrow(
        /must be a string/
      );
    });

    it("should default tempDir to null when not provided", () => {
      const ff = new SIMPLEFFMPEG();
      expect(ff.options.tempDir).toBe(null);
    });
  });

  describe("static methods", () => {
    it("getPresets should return all presets", () => {
      const presets = SIMPLEFFMPEG.getPresets();
      expect(presets).toHaveProperty("tiktok");
      expect(presets).toHaveProperty("youtube");
      expect(presets).toHaveProperty("instagram-post");
      expect(presets.tiktok).toEqual({ width: 1080, height: 1920, fps: 30 });
    });

    it("getPresetNames should return array of preset names", () => {
      const names = SIMPLEFFMPEG.getPresetNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain("tiktok");
      expect(names).toContain("youtube");
      expect(names).toContain("instagram-reel");
      expect(names).toContain("instagram-post");
      expect(names).toContain("youtube-short");
    });

    it("getPresets should return a copy (not the original)", () => {
      const presets1 = SIMPLEFFMPEG.getPresets();
      const presets2 = SIMPLEFFMPEG.getPresets();
      presets1.tiktok.width = 9999;
      expect(presets2.tiktok.width).toBe(1080); // Should not be affected
    });
  });

  describe("all presets have required properties", () => {
    const presets = SIMPLEFFMPEG.getPresets();

    Object.entries(presets).forEach(([name, config]) => {
      it(`preset '${name}' should have width, height, and fps`, () => {
        expect(typeof config.width).toBe("number");
        expect(typeof config.height).toBe("number");
        expect(typeof config.fps).toBe("number");
        expect(config.width).toBeGreaterThan(0);
        expect(config.height).toBeGreaterThan(0);
        expect(config.fps).toBeGreaterThan(0);
      });
    });
  });
});
