import { describe, it, expect } from "vitest";

const SIMPLEFFMPEG = (await import("../../src/simpleffmpeg.js")).default;

describe("SIMPLEFFMPEG.getDuration", () => {
  it("should return 0 for empty array", () => {
    expect(SIMPLEFFMPEG.getDuration([])).toBe(0);
  });

  it("should return 0 for non-array input", () => {
    expect(SIMPLEFFMPEG.getDuration(null)).toBe(0);
    expect(SIMPLEFFMPEG.getDuration("not an array")).toBe(0);
  });

  it("should return 0 when no visual clips are present", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "music", url: "./bg.mp3" },
      { type: "text", text: "Hello", position: 0, end: 5 },
    ]);
    expect(duration).toBe(0);
  });

  it("should compute duration from a single video clip", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", position: 0, end: 10 },
    ]);
    expect(duration).toBe(10);
  });

  it("should compute duration from sequential video clips", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", position: 0, end: 5 },
      { type: "video", url: "./b.mp4", position: 5, end: 12 },
    ]);
    expect(duration).toBe(12);
  });

  it("should subtract transition overlaps", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", position: 0, end: 5 },
      {
        type: "video",
        url: "./b.mp4",
        position: 5,
        end: 15,
        transition: { type: "fade", duration: 0.5 },
      },
    ]);
    // 5 + 10 - 0.5 = 14.5
    expect(duration).toBe(14.5);
  });

  it("should subtract multiple transition overlaps", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", position: 0, end: 5 },
      {
        type: "video",
        url: "./b.mp4",
        position: 5,
        end: 10,
        transition: { type: "fade", duration: 1 },
      },
      {
        type: "video",
        url: "./c.mp4",
        position: 10,
        end: 15,
        transition: { type: "wipeleft", duration: 1 },
      },
    ]);
    // 5 + 5 + 5 - 1 - 1 = 13
    expect(duration).toBe(13);
  });

  it("should work with duration shorthand", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", duration: 5 },
      { type: "video", url: "./b.mp4", duration: 10 },
    ]);
    expect(duration).toBe(15);
  });

  it("should work with duration shorthand and transitions", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", duration: 5 },
      {
        type: "video",
        url: "./b.mp4",
        duration: 10,
        transition: { type: "fade", duration: 0.5 },
      },
    ]);
    // 5 + 10 - 0.5 = 14.5
    expect(duration).toBe(14.5);
  });

  it("should work with auto-sequenced image clips", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "image", url: "./a.jpg", duration: 3 },
      { type: "image", url: "./b.jpg", duration: 3 },
      { type: "image", url: "./c.jpg", duration: 3 },
    ]);
    expect(duration).toBe(9);
  });

  it("should work with mixed video and image clips", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", duration: 5 },
      { type: "image", url: "./b.jpg", duration: 3 },
    ]);
    expect(duration).toBe(8);
  });

  it("should ignore non-visual clips in duration calculation", () => {
    const duration = SIMPLEFFMPEG.getDuration([
      { type: "video", url: "./a.mp4", duration: 5 },
      { type: "audio", url: "./sfx.mp3", position: 0, duration: 20 },
      { type: "music", url: "./bg.mp3" },
      { type: "text", text: "Title", position: 0, duration: 10 },
      { type: "video", url: "./b.mp4", duration: 5 },
    ]);
    expect(duration).toBe(10);
  });

  it("should match the real estate slideshow example", () => {
    const slideDuration = 4;
    const transitionDuration = 0.5;
    const photos = ["a.jpg", "b.jpg", "c.jpg", "d.jpg"];

    const photoClips = photos.map((photo, i) => ({
      type: "image",
      url: photo,
      duration: slideDuration,
      kenBurns: i % 2 === 0 ? "zoom-in" : "pan-right",
      ...(i > 0 && {
        transition: { type: "fade", duration: transitionDuration },
      }),
    }));

    const duration = SIMPLEFFMPEG.getDuration(photoClips);
    const expected =
      photos.length * slideDuration -
      (photos.length - 1) * transitionDuration;

    expect(duration).toBe(expected); // 16 - 1.5 = 14.5
  });
});
