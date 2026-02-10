import { describe, it, expect } from "vitest";

const { resolveClips } = await import("../../src/core/resolve.js");

describe("resolveClips", () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // duration → end resolution
  // ─────────────────────────────────────────────────────────────────────────────

  describe("duration → end resolution", () => {
    it("should compute end from position + duration for video clips", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", position: 5, duration: 10 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].position).toBe(5);
      expect(clips[0].end).toBe(15);
      // duration is removed after resolution — canonical form is { position, end }
      expect(clips[0].duration).toBeUndefined();
    });

    it("should compute end from position + duration for image clips", () => {
      const { clips, errors } = resolveClips([
        { type: "image", url: "./photo.jpg", position: 0, duration: 3 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].end).toBe(3);
    });

    it("should compute end from position + duration for audio clips", () => {
      const { clips, errors } = resolveClips([
        { type: "audio", url: "./sfx.mp3", position: 2, duration: 1.5 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].end).toBe(3.5);
    });

    it("should compute end from position + duration for text clips", () => {
      const { clips, errors } = resolveClips([
        { type: "text", text: "Hello", position: 1, duration: 3 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].end).toBe(4);
    });

    it("should compute end from position + duration for effect clips", () => {
      const { clips, errors } = resolveClips([
        {
          type: "effect",
          effect: "vignette",
          position: 1,
          duration: 2.5,
          params: { amount: 0.7 },
        },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].end).toBe(3.5);
    });

    it("should compute end from position + duration for music clips", () => {
      const { clips, errors } = resolveClips([
        { type: "music", url: "./bg.mp3", position: 0, duration: 30 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].end).toBe(30);
    });

    it("should not overwrite explicit end", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", position: 0, end: 5 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].end).toBe(5);
      expect(clips[0].duration).toBeUndefined();
    });

    it("should work with cutFrom (cutFrom is orthogonal)", () => {
      const { clips, errors } = resolveClips([
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          duration: 10,
          cutFrom: 30,
        },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].position).toBe(0);
      expect(clips[0].end).toBe(10);
      expect(clips[0].cutFrom).toBe(30);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-sequential positioning
  // ─────────────────────────────────────────────────────────────────────────────

  describe("auto-sequential positioning", () => {
    it("should default first clip to position 0 when omitted", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", duration: 5 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].position).toBe(0);
      expect(clips[0].end).toBe(5);
    });

    it("should auto-sequence video clips on the visual track", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", duration: 5 },
        { type: "video", url: "./b.mp4", duration: 3 },
        { type: "video", url: "./c.mp4", duration: 4 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 5 });
      expect(clips[1]).toMatchObject({ position: 5, end: 8 });
      expect(clips[2]).toMatchObject({ position: 8, end: 12 });
    });

    it("should auto-sequence image clips on the visual track", () => {
      const { clips, errors } = resolveClips([
        { type: "image", url: "./a.jpg", duration: 3 },
        { type: "image", url: "./b.jpg", duration: 3 },
        { type: "image", url: "./c.jpg", duration: 3 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 3 });
      expect(clips[1]).toMatchObject({ position: 3, end: 6 });
      expect(clips[2]).toMatchObject({ position: 6, end: 9 });
    });

    it("should share the visual track between video and image clips", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", duration: 5 },
        { type: "image", url: "./b.jpg", duration: 3 },
        { type: "video", url: "./c.mp4", duration: 4 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 5 });
      expect(clips[1]).toMatchObject({ position: 5, end: 8 });
      expect(clips[2]).toMatchObject({ position: 8, end: 12 });
    });

    it("should NOT auto-sequence effect clips (position required)", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", duration: 5 },
        { type: "effect", effect: "vignette", duration: 2, params: {} },
        { type: "video", url: "./b.mp4", duration: 3 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 5 });
      expect(clips[1].position).toBeUndefined();
      expect(clips[1].end).toBeUndefined();
      expect(clips[2]).toMatchObject({ position: 5, end: 8 });
    });

    it("should auto-sequence audio clips on a separate audio track", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./v.mp4", duration: 10 },
        { type: "audio", url: "./a1.mp3", duration: 3 },
        { type: "audio", url: "./a2.mp3", duration: 3 },
      ]);

      expect(errors).toHaveLength(0);
      // Video on visual track
      expect(clips[0]).toMatchObject({ position: 0, end: 10 });
      // Audio on audio track (independent from visual)
      expect(clips[1]).toMatchObject({ position: 0, end: 3 });
      expect(clips[2]).toMatchObject({ position: 3, end: 6 });
    });

    it("should NOT auto-sequence text clips (position required)", () => {
      const { clips, errors } = resolveClips([
        { type: "text", text: "Hello", duration: 3 },
      ]);

      // Position should remain undefined — validation will catch it
      expect(errors).toHaveLength(0);
      expect(clips[0].position).toBeUndefined();
    });

    it("should NOT auto-sequence music clips", () => {
      const { clips, errors } = resolveClips([
        { type: "music", url: "./bg.mp3" },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].position).toBeUndefined();
    });

    it("should NOT auto-sequence subtitle clips", () => {
      const { clips, errors } = resolveClips([
        { type: "subtitle", url: "./subs.srt" },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].position).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Mixed explicit + implicit positioning
  // ─────────────────────────────────────────────────────────────────────────────

  describe("mixed explicit and implicit positioning", () => {
    it("should respect explicit position and continue auto-sequencing from it", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", duration: 5 },
        { type: "video", url: "./b.mp4", position: 10, end: 15 },
        { type: "video", url: "./c.mp4", duration: 5 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 5 });
      expect(clips[1]).toMatchObject({ position: 10, end: 15 });
      // c follows b (position: 15)
      expect(clips[2]).toMatchObject({ position: 15, end: 20 });
    });

    it("should allow explicit position: 0", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", position: 0, duration: 5 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0].position).toBe(0);
      expect(clips[0].end).toBe(5);
    });

    it("should handle non-visual clips interspersed without affecting visual track", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", duration: 5 },
        { type: "music", url: "./bg.mp3", volume: 0.3 },
        { type: "text", text: "Title", position: 0, duration: 3 },
        { type: "video", url: "./b.mp4", duration: 5 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 5 });
      expect(clips[3]).toMatchObject({ position: 5, end: 10 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Conflict: duration + end
  // ─────────────────────────────────────────────────────────────────────────────

  describe("duration + end conflict", () => {
    it("should return an error when both duration and end are provided", () => {
      const { clips, errors } = resolveClips([
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          duration: 5,
          end: 10,
        },
      ]);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("INVALID_VALUE");
      expect(errors[0].message).toContain("duration");
      expect(errors[0].message).toContain("end");
    });

    it("should not resolve the clip further after a conflict", () => {
      const { clips } = resolveClips([
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          duration: 5,
          end: 10,
        },
      ]);

      // Both remain as-is
      expect(clips[0].duration).toBe(5);
      expect(clips[0].end).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle non-array input gracefully", () => {
      const { clips, errors } = resolveClips("not an array");
      expect(errors).toHaveLength(0);
      expect(clips).toBe("not an array");
    });

    it("should handle empty array", () => {
      const { clips, errors } = resolveClips([]);
      expect(errors).toHaveLength(0);
      expect(clips).toHaveLength(0);
    });

    it("should not mutate original clip objects", () => {
      const original = [
        { type: "video", url: "./a.mp4", duration: 5 },
      ];

      const { clips } = resolveClips(original);

      // Original should be unchanged
      expect(original[0].position).toBeUndefined();
      expect(original[0].end).toBeUndefined();

      // Resolved should have new values
      expect(clips[0].position).toBe(0);
      expect(clips[0].end).toBe(5);
    });

    it("should handle a single auto-sequenced clip", () => {
      const { clips, errors } = resolveClips([
        { type: "image", url: "./photo.jpg", duration: 5 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 5 });
    });

    it("should pass through clips with no shorthand unchanged", () => {
      const { clips, errors } = resolveClips([
        { type: "video", url: "./a.mp4", position: 0, end: 5 },
        { type: "text", text: "Hi", position: 1, end: 3 },
        { type: "music", url: "./bg.mp3" },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 5 });
      expect(clips[1]).toMatchObject({ position: 1, end: 3 });
      expect(clips[2].position).toBeUndefined();
    });

    it("should handle the original slideshow example with duration", () => {
      const { clips, errors } = resolveClips([
        {
          type: "image",
          url: "./photo1.jpg",
          duration: 3,
          kenBurns: "zoom-in",
        },
        {
          type: "image",
          url: "./photo2.jpg",
          duration: 3,
          kenBurns: "pan-right",
        },
        {
          type: "image",
          url: "./photo3.jpg",
          duration: 3,
          kenBurns: "zoom-out",
        },
        { type: "music", url: "./music.mp3", volume: 0.3 },
      ]);

      expect(errors).toHaveLength(0);
      expect(clips[0]).toMatchObject({ position: 0, end: 3 });
      expect(clips[1]).toMatchObject({ position: 3, end: 6 });
      expect(clips[2]).toMatchObject({ position: 6, end: 9 });
      // Music should be unaffected
      expect(clips[3].position).toBeUndefined();
    });
  });
});
