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
const { validateConfig, formatValidationResult, ValidationCodes } =
  await import("../../src/core/validation.js");

describe("Validation", () => {
  beforeEach(() => {
    fs.existsSync.mockReturnValue(true);
  });

  describe("ValidationCodes", () => {
    it("should export all error codes", () => {
      expect(ValidationCodes.INVALID_TYPE).toBe("INVALID_TYPE");
      expect(ValidationCodes.MISSING_REQUIRED).toBe("MISSING_REQUIRED");
      expect(ValidationCodes.INVALID_VALUE).toBe("INVALID_VALUE");
      expect(ValidationCodes.INVALID_RANGE).toBe("INVALID_RANGE");
      expect(ValidationCodes.INVALID_TIMELINE).toBe("INVALID_TIMELINE");
      expect(ValidationCodes.TIMELINE_GAP).toBe("TIMELINE_GAP");
      expect(ValidationCodes.FILE_NOT_FOUND).toBe("FILE_NOT_FOUND");
      expect(ValidationCodes.INVALID_FORMAT).toBe("INVALID_FORMAT");
      expect(ValidationCodes.INVALID_WORD_TIMING).toBe("INVALID_WORD_TIMING");
      expect(ValidationCodes.OUTSIDE_BOUNDS).toBe("OUTSIDE_BOUNDS");
    });
  });

  describe("validateConfig (structured result)", () => {
    describe("result structure", () => {
      it("should return valid:true with empty errors for valid config", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
        ];
        const result = validateConfig(clips);

        expect(result).toHaveProperty("valid", true);
        expect(result).toHaveProperty("errors");
        expect(result).toHaveProperty("warnings");
        expect(result.errors).toHaveLength(0);
      });

      it("should return valid:false with errors for invalid config", () => {
        const clips = [
          { type: "invalid", url: "./test.mp4", position: 0, end: 5 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should include structured error with code, path, message", () => {
        const clips = [{ type: "video", position: 0, end: 5 }]; // missing url
        const result = validateConfig(clips);

        expect(result.errors[0]).toHaveProperty("code");
        expect(result.errors[0]).toHaveProperty("path");
        expect(result.errors[0]).toHaveProperty("message");
        expect(result.errors[0].code).toBe(ValidationCodes.MISSING_REQUIRED);
        expect(result.errors[0].path).toBe("clips[0].url");
      });

      it("should include received value in error when available", () => {
        const clips = [
          { type: "invalid", url: "./test.mp4", position: 0, end: 5 },
        ];
        const result = validateConfig(clips);

        expect(result.errors[0]).toHaveProperty("received", "invalid");
      });
    });

    describe("clips array validation", () => {
      it("should reject non-array clips", () => {
        const result = validateConfig("not an array");

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_TYPE);
        expect(result.errors[0].path).toBe("clips");
      });

      it("should reject empty clips array", () => {
        const result = validateConfig([]);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.MISSING_REQUIRED);
        expect(result.errors[0].path).toBe("clips");
      });
    });

    describe("type validation", () => {
      it("should reject missing clip type", () => {
        const clips = [{ url: "./test.mp4", position: 0, end: 5 }];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.MISSING_REQUIRED);
        expect(result.errors[0].path).toBe("clips[0].type");
      });

      it("should reject invalid clip type", () => {
        const clips = [
          { type: "invalid", url: "./test.mp4", position: 0, end: 5 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_TYPE);
        expect(result.errors[0].received).toBe("invalid");
      });

      it("should accept all valid clip types", () => {
        const types = [
          "video",
          "audio",
          "text",
          "music",
          "backgroundAudio",
          "image",
          "subtitle",
        ];

        for (const type of types) {
          let clip;
          if (type === "text") {
            clip = { type, text: "Hello", position: 0, end: 5 };
          } else if (type === "music" || type === "backgroundAudio") {
            clip = { type, url: "./test.mp3" };
          } else if (type === "subtitle") {
            clip = { type, url: "./test.srt" };
          } else {
            clip = { type, url: "./test.mp4", position: 0, end: 5 };
          }

          // Need a visual clip for types that don't fill timeline
          const clips =
            type === "video" || type === "image"
              ? [clip]
              : [{ type: "video", url: "./v.mp4", position: 0, end: 5 }, clip];

          const result = validateConfig(clips);
          expect(result.valid).toBe(true);
        }
      });
    });

    describe("timeline validation", () => {
      it("should reject missing position for timeline clips", () => {
        const clips = [{ type: "video", url: "./test.mp4", end: 5 }];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === "clips[0].position")).toBe(
          true
        );
      });

      it("should reject missing end for timeline clips", () => {
        const clips = [{ type: "video", url: "./test.mp4", position: 0 }];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === "clips[0].end")).toBe(true);
      });

      it("should reject negative position", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: -1, end: 5 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_RANGE);
      });

      it("should reject end <= position", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 5, end: 3 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_TIMELINE);
      });

      it("should allow missing position/end for music clips", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          { type: "music", url: "./bgm.mp3" },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(true);
      });
    });

    describe("media validation", () => {
      it("should reject missing url for media clips", () => {
        const clips = [{ type: "video", position: 0, end: 5 }];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.MISSING_REQUIRED);
        expect(result.errors[0].path).toBe("clips[0].url");
      });

      it("should reject empty url", () => {
        const clips = [{ type: "video", url: "", position: 0, end: 5 }];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.MISSING_REQUIRED);
      });

      it("should reject negative cutFrom", () => {
        const clips = [
          {
            type: "video",
            url: "./test.mp4",
            position: 0,
            end: 5,
            cutFrom: -1,
          },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_RANGE);
        expect(result.errors[0].path).toBe("clips[0].cutFrom");
      });

      it("should reject negative volume", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          {
            type: "audio",
            url: "./test.mp3",
            position: 0,
            end: 5,
            volume: -0.5,
          },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_RANGE);
      });
    });

    describe("file checks", () => {
      it("should add warning when file not found", () => {
        fs.existsSync.mockReturnValue(false);
        const clips = [
          { type: "video", url: "./missing.mp4", position: 0, end: 5 },
        ];
        const result = validateConfig(clips);

        // Still valid (warnings don't block) but there's a gap warning
        expect(
          result.warnings.some((w) => w.code === ValidationCodes.FILE_NOT_FOUND)
        ).toBe(true);
      });

      it("should skip file checks when skipFileChecks is true", () => {
        fs.existsSync.mockReturnValue(false);
        const clips = [
          { type: "video", url: "./missing.mp4", position: 0, end: 5 },
        ];
        const result = validateConfig(clips, { skipFileChecks: true });

        expect(
          result.warnings.some((w) => w.code === ValidationCodes.FILE_NOT_FOUND)
        ).toBe(false);
      });
    });

    describe("timeline gaps", () => {
      it("should detect leading gap", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 2, end: 5 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.code === ValidationCodes.TIMELINE_GAP)
        ).toBe(true);
      });

      it("should detect middle gap", () => {
        const clips = [
          { type: "video", url: "./a.mp4", position: 0, end: 3 },
          { type: "video", url: "./b.mp4", position: 5, end: 8 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.code === ValidationCodes.TIMELINE_GAP)
        ).toBe(true);
      });

      it("should skip gap checking when fillGaps is not none", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 2, end: 5 },
        ];
        const result = validateConfig(clips, { fillGaps: "black" });

        expect(result.valid).toBe(true);
        expect(
          result.errors.some((e) => e.code === ValidationCodes.TIMELINE_GAP)
        ).toBe(false);
      });

      it("should include gap timing in error", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 2, end: 5 },
        ];
        const result = validateConfig(clips);

        const gapError = result.errors.find(
          (e) => e.code === ValidationCodes.TIMELINE_GAP
        );
        expect(gapError.received).toEqual({ start: 0, end: 2 });
      });
    });

    describe("text clip validation", () => {
      it("should validate words array structure", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          {
            type: "text",
            position: 1,
            end: 4,
            words: [{ text: "Hello", start: 2, end: 1 }], // end < start
          },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_WORD_TIMING);
      });

      it("should warn when word is outside clip bounds", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 10 },
          {
            type: "text",
            position: 2,
            end: 4,
            words: [{ text: "Hello", start: 0, end: 1 }], // before clip position
          },
        ];
        const result = validateConfig(clips);

        expect(
          result.warnings.some((w) => w.code === ValidationCodes.OUTSIDE_BOUNDS)
        ).toBe(true);
      });

      it("should reject invalid text mode", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          { type: "text", text: "Hello", position: 1, end: 3, mode: "invalid" },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_VALUE);
        expect(result.errors[0].path).toBe("clips[1].mode");
      });

      it("should reject invalid karaoke highlightStyle", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          {
            type: "text",
            text: "Hello",
            position: 1,
            end: 3,
            mode: "karaoke",
            highlightStyle: "invalid",
          },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_VALUE);
        expect(result.errors[0].path).toBe("clips[1].highlightStyle");
      });

      it("should reject invalid animation type", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          {
            type: "text",
            text: "Hello",
            position: 1,
            end: 3,
            animation: { type: "invalid" },
          },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_VALUE);
        expect(result.errors[0].path).toBe("clips[1].animation.type");
      });
    });

    describe("subtitle clip validation", () => {
      it("should reject missing url", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          { type: "subtitle" },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.MISSING_REQUIRED);
      });

      it("should reject invalid format", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 0, end: 5 },
          { type: "subtitle", url: "./test.txt" },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_FORMAT);
      });

      it("should accept valid subtitle formats", () => {
        const formats = ["srt", "vtt", "ass", "ssa"];
        for (const ext of formats) {
          const clips = [
            { type: "video", url: "./test.mp4", position: 0, end: 5 },
            { type: "subtitle", url: `./test.${ext}` },
          ];
          const result = validateConfig(clips);
          expect(result.valid).toBe(true);
        }
      });
    });

    describe("image clip validation", () => {
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
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_VALUE);
      });

      it("should accept valid kenBurns values", () => {
        const effects = [
          "zoom-in",
          "zoom-out",
          "pan-left",
          "pan-right",
          "pan-up",
          "pan-down",
        ];
        for (const kb of effects) {
          const clips = [
            {
              type: "image",
              url: "./test.png",
              position: 0,
              end: 3,
              kenBurns: kb,
            },
          ];
          const result = validateConfig(clips);
          expect(result.valid).toBe(true);
        }
      });

      it("should warn (not error) when kenBurns image is smaller (auto-upscale)", () => {
        const clips = [
          {
            type: "image",
            url: "./test.png",
            position: 0,
            end: 3,
            kenBurns: "zoom-in",
            width: 800,
            height: 600,
          },
        ];
        const result = validateConfig(clips, {
          width: 1920,
          height: 1080,
          skipFileChecks: true,
        });

        // Should pass but with a warning (image will be upscaled)
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].code).toBe(ValidationCodes.INVALID_VALUE);
        expect(result.warnings[0].message).toContain("upscaled");
      });

      it("should error with strictKenBurns when image is smaller than project", () => {
        const clips = [
          {
            type: "image",
            url: "./test.png",
            position: 0,
            end: 3,
            kenBurns: "zoom-in",
            width: 800,
            height: 600,
          },
        ];
        const result = validateConfig(clips, {
          width: 1920,
          height: 1080,
          strictKenBurns: true,
          skipFileChecks: true,
        });

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_VALUE);
        expect(result.errors[0].message).toContain(
          "smaller than project dimensions"
        );
      });

      it("should pass when kenBurns image dimensions are sufficient", () => {
        const clips = [
          {
            type: "image",
            url: "./test.png",
            position: 0,
            end: 3,
            kenBurns: "zoom-in",
            width: 1920,
            height: 1080,
          },
        ];
        const result = validateConfig(clips, {
          width: 1920,
          height: 1080,
          skipFileChecks: true,
        });

        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBe(0);
      });

      it("should warn when kenBurns used without known image dimensions", () => {
        const clips = [
          {
            type: "image",
            url: "./test.png",
            position: 0,
            end: 3,
            kenBurns: "zoom-in",
            // No width/height provided
          },
        ];
        const result = validateConfig(clips, {
          width: 1920,
          height: 1080,
          skipFileChecks: false,
        });

        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(
          result.warnings.some((w) => w.message.includes("Ken Burns"))
        ).toBe(true);
      });

      it("should warn with upscale message using default project dimensions", () => {
        const clips = [
          {
            type: "image",
            url: "./test.png",
            position: 0,
            end: 3,
            kenBurns: "zoom-in",
            width: 1000, // Smaller than default 1920x1080
            height: 800,
          },
        ];
        const result = validateConfig(clips, { skipFileChecks: true });

        // Default behavior: warn about upscaling
        expect(result.valid).toBe(true);
        expect(result.warnings[0].message).toContain("1920x1080");
        expect(result.warnings[0].message).toContain("upscaled");
      });
    });

    describe("video transition validation", () => {
      it("should reject invalid transition duration", () => {
        const clips = [
          {
            type: "video",
            url: "./test.mp4",
            position: 0,
            end: 5,
            transition: { duration: 0 },
          },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe(ValidationCodes.INVALID_VALUE);
        expect(result.errors[0].path).toBe("clips[0].transition.duration");
      });
    });

    describe("multiple errors", () => {
      it("should collect all errors across clips", () => {
        const clips = [
          { type: "invalid" },
          { type: "video", position: -1, end: 5 },
          { type: "audio", url: "./a.mp3", position: 0, end: 3, volume: -1 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);

        // Should have errors from different clips
        expect(result.errors.some((e) => e.path.includes("clips[0]"))).toBe(
          true
        );
        expect(result.errors.some((e) => e.path.includes("clips[1]"))).toBe(
          true
        );
      });
    });
  });

  describe("duration field validation", () => {
    it("should reject non-number duration", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, duration: "five" },
      ];
      const result = validateConfig(clips);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.path === "clips[0].duration" &&
            e.code === ValidationCodes.INVALID_VALUE
        )
      ).toBe(true);
    });

    it("should reject non-finite duration (Infinity)", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, duration: Infinity },
      ];
      const result = validateConfig(clips);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.path === "clips[0].duration" &&
            e.code === ValidationCodes.INVALID_VALUE
        )
      ).toBe(true);
    });

    it("should reject non-finite duration (NaN)", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, duration: NaN },
      ];
      const result = validateConfig(clips);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.path === "clips[0].duration" &&
            e.code === ValidationCodes.INVALID_VALUE
        )
      ).toBe(true);
    });

    it("should reject zero duration", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, duration: 0 },
      ];
      const result = validateConfig(clips);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.path === "clips[0].duration" &&
            e.code === ValidationCodes.INVALID_RANGE
        )
      ).toBe(true);
    });

    it("should reject negative duration", () => {
      const clips = [
        { type: "video", url: "./test.mp4", position: 0, duration: -3 },
      ];
      const result = validateConfig(clips);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.path === "clips[0].duration" &&
            e.code === ValidationCodes.INVALID_RANGE
        )
      ).toBe(true);
    });

    it("should reject providing both duration and end", () => {
      const clips = [
        {
          type: "video",
          url: "./test.mp4",
          position: 0,
          duration: 5,
          end: 5,
        },
      ];
      const result = validateConfig(clips);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.code === ValidationCodes.INVALID_VALUE &&
            e.message.includes("duration") &&
            e.message.includes("end")
        )
      ).toBe(true);
    });
  });

  describe("formatValidationResult", () => {
    it("should format passed result", () => {
      const result = { valid: true, errors: [], warnings: [] };
      const formatted = formatValidationResult(result);

      expect(formatted).toContain("Validation passed");
    });

    it("should format failed result with errors", () => {
      const result = {
        valid: false,
        errors: [
          {
            code: "INVALID_TYPE",
            path: "clips[0].type",
            message: "Invalid type",
          },
        ],
        warnings: [],
      };
      const formatted = formatValidationResult(result);

      expect(formatted).toContain("Validation failed");
      expect(formatted).toContain("INVALID_TYPE");
      expect(formatted).toContain("clips[0].type");
    });

    it("should include warnings in output", () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [
          {
            code: "FILE_NOT_FOUND",
            path: "clips[0].url",
            message: "File not found",
          },
        ],
      };
      const formatted = formatValidationResult(result);

      expect(formatted).toContain("Warnings");
      expect(formatted).toContain("FILE_NOT_FOUND");
    });
  });
});
