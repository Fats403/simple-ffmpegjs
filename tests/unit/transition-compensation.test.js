import { describe, it, expect, beforeEach } from "vitest";

// Dynamic import for CommonJS module
const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;

describe("Transition Compensation", () => {
  let project;

  beforeEach(() => {
    project = new SIMPLEFFMPEG({ width: 1920, height: 1080 });
  });

  describe("_getTransitionOffsetAt", () => {
    it("should return 0 when no transitions exist", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20 },
      ];
      const offset = project._getTransitionOffsetAt(videoClips, 15);
      expect(offset).toBe(0);
    });

    it("should return 0 for timestamp before first transition", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
      ];
      const offset = project._getTransitionOffsetAt(videoClips, 5);
      expect(offset).toBe(0);
    });

    it("should return transition duration for timestamp after transition", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
      ];
      const offset = project._getTransitionOffsetAt(videoClips, 15);
      expect(offset).toBe(1);
    });

    it("should accumulate multiple transition durations", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
        { position: 20, end: 30, transition: { type: "fade", duration: 0.5 } },
      ];
      const offset = project._getTransitionOffsetAt(videoClips, 25);
      expect(offset).toBe(1.5);
    });

    it("should only count transitions at or before timestamp", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
        { position: 20, end: 30, transition: { type: "fade", duration: 0.5 } },
      ];
      // Timestamp 15 is after first transition but before second
      const offset = project._getTransitionOffsetAt(videoClips, 15);
      expect(offset).toBe(1);
    });

    it("should include transition exactly at timestamp", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
      ];
      // Timestamp exactly at transition point
      const offset = project._getTransitionOffsetAt(videoClips, 10);
      expect(offset).toBe(1);
    });

    it("should handle clips with missing transition duration", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade" } }, // no duration
      ];
      const offset = project._getTransitionOffsetAt(videoClips, 15);
      expect(offset).toBe(0);
    });
  });

  describe("_adjustTimestampForTransitions", () => {
    it("should subtract cumulative transition offset", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
      ];
      const adjusted = project._adjustTimestampForTransitions(videoClips, 15);
      expect(adjusted).toBe(14); // 15 - 1 = 14
    });

    it("should handle multiple transitions", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
        { position: 20, end: 30, transition: { type: "fade", duration: 0.5 } },
        { position: 30, end: 40, transition: { type: "fade", duration: 1 } },
      ];
      // Timestamp 35: after all three transitions (1 + 0.5 + 1 = 2.5)
      const adjusted = project._adjustTimestampForTransitions(videoClips, 35);
      expect(adjusted).toBe(32.5); // 35 - 2.5 = 32.5
    });

    it("should not adjust timestamp before any transition", () => {
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
      ];
      const adjusted = project._adjustTimestampForTransitions(videoClips, 5);
      expect(adjusted).toBe(5);
    });
  });

  describe("compensation scenarios", () => {
    it("should correctly place text at visual 15s when video has 1s transition at 10s", () => {
      // Scenario: User wants text at 15s into the video
      // Video has clip A (0-10s), clip B (10-20s) with 1s transition
      // Due to transition, actual output duration is 19s
      // Text at "15s" should appear at output second 14
      const videoClips = [
        { position: 0, end: 10 },
        { position: 10, end: 20, transition: { type: "fade", duration: 1 } },
      ];

      const userRequestedTime = 15;
      const adjustedTime = project._adjustTimestampForTransitions(
        videoClips,
        userRequestedTime
      );

      expect(adjustedTime).toBe(14);
    });

    it("should handle complex torture test scenario", () => {
      // Simulate multiple rapid clips with transitions
      const videoClips = [
        { position: 0, end: 5 },
        { position: 5, end: 10, transition: { type: "fade", duration: 0.3 } },
        { position: 10, end: 15, transition: { type: "fade", duration: 0.3 } },
        { position: 15, end: 20, transition: { type: "fade", duration: 0.3 } },
        { position: 20, end: 25, transition: { type: "fade", duration: 0.3 } },
      ];

      // Text meant for end of video (position 22)
      // Total transitions: 4 * 0.3 = 1.2s
      const adjustedTime = project._adjustTimestampForTransitions(
        videoClips,
        22
      );
      expect(adjustedTime).toBe(20.8); // 22 - 1.2 = 20.8
    });

    it("should handle no video clips", () => {
      const videoClips = [];
      const adjusted = project._adjustTimestampForTransitions(videoClips, 15);
      expect(adjusted).toBe(15);
    });

    it("should handle single video clip (no transitions possible)", () => {
      const videoClips = [{ position: 0, end: 30 }];
      const adjusted = project._adjustTimestampForTransitions(videoClips, 15);
      expect(adjusted).toBe(15);
    });
  });
});
