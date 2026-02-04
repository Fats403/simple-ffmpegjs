import { describe, it, expect } from "vitest";

const { detectVisualGaps, hasVisualGaps, getVisualTimelineEnd } = await import(
  "../../src/core/gaps.js"
);

describe("Gap Detection", () => {
  describe("detectVisualGaps", () => {
    it("should return empty array when no clips provided", () => {
      const gaps = detectVisualGaps([]);
      expect(gaps).toEqual([]);
    });

    it("should return empty array when only audio clips provided", () => {
      const clips = [
        { type: "audio", position: 0, end: 5 },
        { type: "music", position: 0, end: 10 },
      ];
      const gaps = detectVisualGaps(clips);
      expect(gaps).toEqual([]);
    });

    it("should detect leading gap", () => {
      const clips = [{ type: "video", position: 2, end: 5 }];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ start: 0, end: 2, duration: 2 });
    });

    it("should detect gap between clips", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "video", position: 5, end: 8 },
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ start: 3, end: 5, duration: 2 });
    });

    it("should detect multiple gaps", () => {
      const clips = [
        { type: "video", position: 1, end: 3 },
        { type: "video", position: 5, end: 7 },
        { type: "video", position: 10, end: 12 },
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toHaveLength(3);
      expect(gaps[0]).toEqual({ start: 0, end: 1, duration: 1 }); // Leading gap
      expect(gaps[1]).toEqual({ start: 3, end: 5, duration: 2 }); // Gap between 1st and 2nd
      expect(gaps[2]).toEqual({ start: 7, end: 10, duration: 3 }); // Gap between 2nd and 3rd
    });

    it("should return empty array for contiguous clips", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "video", position: 3, end: 6 },
        { type: "video", position: 6, end: 9 },
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toEqual([]);
    });

    it("should handle overlapping clips (transitions)", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "video", position: 2.5, end: 5.5 },
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toEqual([]);
    });

    it("should treat images as visual content", () => {
      const clips = [
        { type: "image", position: 0, end: 3 },
        { type: "video", position: 5, end: 8 },
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ start: 3, end: 5, duration: 2 });
    });

    it("should ignore audio and text clips", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "audio", position: 3, end: 5 }, // Should be ignored
        { type: "text", position: 3, end: 5 }, // Should be ignored
        { type: "video", position: 6, end: 9 },
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ start: 3, end: 6, duration: 3 });
    });

    it("should handle clips in unsorted order", () => {
      const clips = [
        { type: "video", position: 5, end: 8 },
        { type: "video", position: 0, end: 3 },
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ start: 3, end: 5, duration: 2 });
    });

    it("should respect epsilon tolerance", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "video", position: 3.0005, end: 6 }, // 0.5ms gap (within default epsilon)
      ];
      const gaps = detectVisualGaps(clips);

      expect(gaps).toEqual([]);
    });

    it("should use custom epsilon", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "video", position: 3.0005, end: 6 },
      ];
      const gaps = detectVisualGaps(clips, { epsilon: 0.0001 });

      expect(gaps).toHaveLength(1);
    });
  });

  describe("hasVisualGaps", () => {
    it("should return false when no gaps", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "video", position: 3, end: 6 },
      ];
      expect(hasVisualGaps(clips)).toBe(false);
    });

    it("should return true when gaps exist", () => {
      const clips = [
        { type: "video", position: 0, end: 3 },
        { type: "video", position: 5, end: 8 },
      ];
      expect(hasVisualGaps(clips)).toBe(true);
    });

    it("should return true for leading gap", () => {
      const clips = [{ type: "video", position: 2, end: 5 }];
      expect(hasVisualGaps(clips)).toBe(true);
    });
  });

  describe("getVisualTimelineEnd", () => {
    it("should return 0 for empty clips", () => {
      expect(getVisualTimelineEnd([])).toBe(0);
    });

    it("should return 0 for non-visual clips only", () => {
      const clips = [
        { type: "audio", position: 0, end: 10 },
        { type: "music", position: 0, end: 20 },
      ];
      expect(getVisualTimelineEnd(clips)).toBe(0);
    });

    it("should return the end of the last visual clip", () => {
      const clips = [
        { type: "video", position: 0, end: 5 },
        { type: "video", position: 5, end: 10 },
        { type: "audio", position: 0, end: 15 }, // Should be ignored
      ];
      expect(getVisualTimelineEnd(clips)).toBe(10);
    });

    it("should handle unsorted clips", () => {
      const clips = [
        { type: "video", position: 5, end: 10 },
        { type: "video", position: 0, end: 5 },
        { type: "image", position: 10, end: 15 },
      ];
      expect(getVisualTimelineEnd(clips)).toBe(15);
    });
  });
});
