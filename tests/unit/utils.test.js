import { describe, it, expect } from "vitest";

const {
  formatBytes,
  parseFFmpegTime,
  parseFFmpegProgress,
  parseFFmpegCommand,
} = await import("../../src/lib/utils.js");

describe("Utils", () => {
  describe("formatBytes", () => {
    it("should format bytes correctly", () => {
      expect(formatBytes(0)).toMatch(/^0\.0 B$/);
      expect(formatBytes(500)).toMatch(/^500\.0 B$/);
      expect(formatBytes(1024)).toMatch(/^1\.\d+ KB$/);
      expect(formatBytes(1536)).toMatch(/^1\.5\d* KB$/);
      expect(formatBytes(1048576)).toMatch(/^1\.\d+ MB$/);
      expect(formatBytes(1073741824)).toMatch(/^1\.\d+ GB$/);
    });

    it("should handle non-finite numbers", () => {
      expect(formatBytes(Infinity)).toBe("Infinity");
      expect(formatBytes(NaN)).toBe("NaN");
    });
  });

  describe("parseFFmpegTime", () => {
    it("should parse HH:MM:SS.ms format", () => {
      expect(parseFFmpegTime("00:00:05.00")).toBe(5);
      expect(parseFFmpegTime("00:01:30.50")).toBeCloseTo(90.5, 1);
      expect(parseFFmpegTime("01:30:00.00")).toBe(5400);
      expect(parseFFmpegTime("00:00:00.25")).toBeCloseTo(0.25, 2);
    });

    it("should return 0 for invalid input", () => {
      expect(parseFFmpegTime("")).toBe(0);
      expect(parseFFmpegTime(null)).toBe(0);
      expect(parseFFmpegTime(undefined)).toBe(0);
    });

    it("should parse simple seconds", () => {
      expect(parseFFmpegTime("5.5")).toBe(5.5);
    });
  });

  describe("parseFFmpegProgress", () => {
    it("should parse frame count", () => {
      const progress = parseFFmpegProgress("frame=  120 fps=30", 10);
      expect(progress.frame).toBe(120);
    });

    it("should parse fps", () => {
      const progress = parseFFmpegProgress(
        "frame=120 fps=45.2 time=00:00:04.00",
        10
      );
      expect(progress.fps).toBeCloseTo(45.2, 1);
    });

    it("should parse time and calculate percent", () => {
      const progress = parseFFmpegProgress("time=00:00:05.00", 10);
      expect(progress.timeProcessed).toBe(5);
      expect(progress.percent).toBe(50);
    });

    it("should parse speed", () => {
      const progress = parseFFmpegProgress("speed=1.5x", 10);
      expect(progress.speed).toBeCloseTo(1.5, 1);
    });

    it("should parse bitrate", () => {
      const progress = parseFFmpegProgress("bitrate=1234.5kbits/s", 10);
      expect(progress.bitrate).toBeCloseTo(1234.5, 1);
    });

    it("should parse size", () => {
      const progress = parseFFmpegProgress("size=  1024kB", 10);
      expect(progress.size).toBe(1024 * 1024);
    });

    it("should parse complete progress line", () => {
      const line =
        "frame=  300 fps=60.5 size=  2048kB time=00:00:10.00 bitrate=1678.2kbits/s speed=2.0x";
      const progress = parseFFmpegProgress(line, 20);

      expect(progress.frame).toBe(300);
      expect(progress.fps).toBeCloseTo(60.5, 1);
      expect(progress.size).toBe(2048 * 1024);
      expect(progress.timeProcessed).toBe(10);
      expect(progress.percent).toBe(50);
      expect(progress.bitrate).toBeCloseTo(1678.2, 1);
      expect(progress.speed).toBeCloseTo(2.0, 1);
    });

    it("should cap percent at 100", () => {
      const progress = parseFFmpegProgress("time=00:00:15.00", 10);
      expect(progress.percent).toBe(100);
    });

    it("should handle zero total duration", () => {
      const progress = parseFFmpegProgress("time=00:00:05.00", 0);
      expect(progress.timeProcessed).toBe(5);
      expect(progress.percent).toBeUndefined();
    });
  });

  describe("parseFFmpegCommand", () => {
    it("should parse simple command", () => {
      const args = parseFFmpegCommand("ffmpeg -i input.mp4 output.mp4");
      expect(args).toEqual(["ffmpeg", "-i", "input.mp4", "output.mp4"]);
    });

    it("should handle double-quoted paths", () => {
      const args = parseFFmpegCommand(
        'ffmpeg -i "path with spaces/input.mp4" output.mp4'
      );
      expect(args).toEqual([
        "ffmpeg",
        "-i",
        "path with spaces/input.mp4",
        "output.mp4",
      ]);
    });

    it("should handle single-quoted paths", () => {
      const args = parseFFmpegCommand(
        "ffmpeg -i 'path with spaces/input.mp4' output.mp4"
      );
      expect(args).toEqual([
        "ffmpeg",
        "-i",
        "path with spaces/input.mp4",
        "output.mp4",
      ]);
    });

    it("should handle multiple spaces between args", () => {
      const args = parseFFmpegCommand("ffmpeg   -i   input.mp4   output.mp4");
      expect(args).toEqual(["ffmpeg", "-i", "input.mp4", "output.mp4"]);
    });

    it("should handle complex filter_complex", () => {
      const cmd =
        'ffmpeg -i input.mp4 -filter_complex "[0:v]scale=1920:1080[outv]" -map "[outv]" output.mp4';
      const args = parseFFmpegCommand(cmd);
      expect(args).toContain("[0:v]scale=1920:1080[outv]");
      expect(args).toContain("[outv]");
    });

    it("should handle empty string", () => {
      const args = parseFFmpegCommand("");
      expect(args).toEqual([]);
    });
  });
});
