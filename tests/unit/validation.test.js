import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";

// Mock fs.existsSync to avoid actual file system checks
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
  existsSync: vi.fn(() => true),
}));

// Dynamic import for CommonJS module
const { validateClips } = await import("../../src/core/validation.js");

describe("validateClips", () => {
  beforeEach(() => {
    fs.existsSync.mockReturnValue(true);
  });

  describe("basic validation", () => {
    it("should accept valid video clips", () => {
      const clips = [{ type: "video", url: "./test.mp4", position: 0, end: 5 }];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should accept valid audio clips", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        { type: "audio", url: "./test.mp3", position: 0, end: 5 },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should accept valid text clips", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        { type: "text", text: "Hello", position: 1, end: 3 },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should accept valid image clips", () => {
      const clips = [{ type: "image", url: "./test.png", position: 0, end: 3 }];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should accept valid background music clips", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        { type: "music", url: "./bgm.mp3" },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should accept backgroundAudio type alias", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        { type: "backgroundAudio", url: "./bgm.mp3" },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });
  });

  describe("type validation", () => {
    it("should reject invalid clip types", () => {
      const clips = [
        { type: "invalid", url: "./test.mp4", position: 0, end: 5 },
      ];
      expect(() => validateClips(clips)).toThrow(/invalid type/);
    });
  });

  describe("timeline validation", () => {
    it("should reject negative position", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: -1, end: 5 },
      ];
      expect(() => validateClips(clips)).toThrow(/position must be >= 0/);
    });

    it("should reject end <= position", () => {
      const clips = [{ type: "video", url: "./test.mp4", position: 5, end: 3 }];
      expect(() => validateClips(clips)).toThrow(/end must be > position/);
    });

    it("should reject missing position for video clips", () => {
      const clips = [{ type: "video", url: "./test.mp4", end: 5 }];
      expect(() => validateClips(clips)).toThrow(
        /'position' and 'end' must be numbers/
      );
    });

    it("should reject missing end for video clips", () => {
      const clips = [{ type: "video", url: "./test.mp4", position: 0 }];
      expect(() => validateClips(clips)).toThrow(
        /'position' and 'end' must be numbers/
      );
    });

    it("should allow missing position/end for background music", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        { type: "music", url: "./bgm.mp3" },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });
  });

  describe("media validation", () => {
    it("should reject missing url for video clips", () => {
      const clips = [{ type: "video", position: 0, end: 5 }];
      expect(() => validateClips(clips)).toThrow(/media 'url' is required/);
    });

    it("should reject empty url for video clips", () => {
      const clips = [{ type: "video", url: "", position: 0, end: 5 }];
      expect(() => validateClips(clips)).toThrow(/media 'url' is required/);
    });

    it("should reject negative cutFrom", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5, cutFrom: -1 },
      ];
      expect(() => validateClips(clips)).toThrow(/cutFrom must be >= 0/);
    });

    it("should reject negative volume for audio", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        { type: "audio", url: "./test.mp3", position: 0, end: 5, volume: -0.5 },
      ];
      expect(() => validateClips(clips)).toThrow(/volume must be >= 0/);
    });
  });

  describe("visual gap validation", () => {
    it("should reject leading visual gap", () => {
      const clips = [{ type: "video", url: "./test.mp4", position: 2, end: 5 }];
      expect(() => validateClips(clips)).toThrow(
        /visual gap.*no video\/image content at start/
      );
    });

    it("should reject middle visual gap", () => {
      const clips = [
        { type: "video", url: "./a.mp4", position: 0, end: 3 },
        { type: "video", url: "./b.mp4", position: 5, end: 8 },
      ];
      expect(() => validateClips(clips)).toThrow(
        /visual gap.*no video\/image content between clips/
      );
    });

    it("should accept contiguous video clips", () => {
      const clips = [
        { type: "video", url: "./a.mp4", position: 0, end: 3 },
        { type: "video", url: "./b.mp4", position: 3, end: 6 },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should accept overlapping video clips (transitions)", () => {
      const clips = [
        { type: "video", url: "./a.mp4", position: 0, end: 3 },
        { type: "video", url: "./b.mp4", position: 2.5, end: 5.5 },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should treat images as visual content for gap detection", () => {
      const clips = [
        { type: "image", url: "./a.png", position: 0, end: 3 },
        { type: "video", url: "./b.mp4", position: 3, end: 6 },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });
  });

  describe("text clip validation", () => {
    it("should accept text clip with words array", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        {
          type: "text",
          position: 1,
          end: 4,
          words: [
            { text: "Hello", start: 1, end: 2 },
            { text: "World", start: 2, end: 3 },
          ],
        },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });

    it("should reject words with end <= start", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        {
          type: "text",
          position: 1,
          end: 4,
          words: [{ text: "Hello", start: 2, end: 1 }],
        },
      ];
      expect(() => validateClips(clips)).toThrow(/end must be > start/);
    });

    it("should accept text clip with wordTimestamps", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, end: 5 },
        {
          type: "text",
          text: "Hello World",
          position: 1,
          end: 4,
          wordTimestamps: [1, 2, 3],
        },
      ];
      expect(() => validateClips(clips)).not.toThrow();
    });
  });

  describe("image clip validation", () => {
    it("should accept valid kenBurns values", () => {
      const kenBurnsOptions = [
        "zoom-in",
        "zoom-out",
        "pan-left",
        "pan-right",
        "pan-up",
        "pan-down",
      ];

      for (const kb of kenBurnsOptions) {
        const clips = [
          {
            type: "image",
            url: "./test.png",
            position: 0,
            end: 3,
            kenBurns: kb,
          },
        ];
        expect(() => validateClips(clips)).not.toThrow();
      }
    });

    it("should reject invalid kenBurns value", () => {
      const clips = [
        {
          type: "image",
          url: "./test.png",
          position: 0,
          end: 3,
          kenBurns: "invalid",
        },
      ];
      expect(() => validateClips(clips)).toThrow(/kenBurns 'invalid' invalid/);
    });
  });
});
