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
const {
  validateConfig,
  formatValidationResult,
  ValidationCodes,
  isValidFFmpegColor,
} = await import("../../src/core/validation.js");

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
          "color",
        ];

        for (const type of types) {
          let clip;
          if (type === "text") {
            clip = { type, text: "Hello", position: 0, end: 5 };
          } else if (type === "music" || type === "backgroundAudio") {
            clip = { type, url: "./test.mp3" };
          } else if (type === "subtitle") {
            clip = { type, url: "./test.srt" };
          } else if (type === "color") {
            clip = { type, color: "black", position: 0, end: 5 };
          } else {
            clip = { type, url: "./test.mp4", position: 0, end: 5 };
          }

          // Need a visual clip for types that don't fill timeline
          const clips =
            type === "video" || type === "image" || type === "color"
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

      it("should always error on gaps (no fillGaps skip)", () => {
        const clips = [
          { type: "video", url: "./test.mp4", position: 2, end: 5 },
        ];
        const result = validateConfig(clips);

        expect(result.valid).toBe(false);
        const gapError = result.errors.find(
          (e) => e.code === ValidationCodes.TIMELINE_GAP
        );
        expect(gapError.message).toContain('{ type: "color" }');
      });

      it("should not report gap where a color clip fills it", () => {
        const clips = [
          { type: "color", color: "black", position: 0, end: 2 },
          { type: "video", url: "./test.mp4", position: 2, end: 5 },
        ];
        const result = validateConfig(clips);

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

  describe("isValidFFmpegColor", () => {
    it("should accept standard named colors", () => {
      expect(isValidFFmpegColor("black")).toBe(true);
      expect(isValidFFmpegColor("red")).toBe(true);
      expect(isValidFFmpegColor("white")).toBe(true);
      expect(isValidFFmpegColor("navy")).toBe(true);
      expect(isValidFFmpegColor("cornflowerblue")).toBe(true);
      expect(isValidFFmpegColor("darkslategray")).toBe(true);
    });

    it("should accept named colors case-insensitively", () => {
      expect(isValidFFmpegColor("Black")).toBe(true);
      expect(isValidFFmpegColor("RED")).toBe(true);
      expect(isValidFFmpegColor("DarkSlateGray")).toBe(true);
      expect(isValidFFmpegColor("CORNFLOWERBLUE")).toBe(true);
    });

    it("should accept hex colors with # prefix", () => {
      expect(isValidFFmpegColor("#000")).toBe(true);
      expect(isValidFFmpegColor("#fff")).toBe(true);
      expect(isValidFFmpegColor("#FF0000")).toBe(true);
      expect(isValidFFmpegColor("#1a1a2e")).toBe(true);
      expect(isValidFFmpegColor("#FF000080")).toBe(true); // with alpha
    });

    it("should accept hex colors with 0x prefix", () => {
      expect(isValidFFmpegColor("0xFF0000")).toBe(true);
      expect(isValidFFmpegColor("0x1a1a2e")).toBe(true);
      expect(isValidFFmpegColor("0xFF000080")).toBe(true); // with alpha
    });

    it("should accept 'random'", () => {
      expect(isValidFFmpegColor("random")).toBe(true);
    });

    it("should reject invalid values", () => {
      expect(isValidFFmpegColor("")).toBe(false);
      expect(isValidFFmpegColor("notacolor")).toBe(false);
      expect(isValidFFmpegColor("123")).toBe(false);
      expect(isValidFFmpegColor("#GG0000")).toBe(false);
      expect(isValidFFmpegColor("#12345")).toBe(false); // 5 hex chars invalid
      expect(isValidFFmpegColor("0x12345")).toBe(false); // 5 hex chars invalid
    });

    it("should reject non-string values", () => {
      expect(isValidFFmpegColor(null)).toBe(false);
      expect(isValidFFmpegColor(undefined)).toBe(false);
      expect(isValidFFmpegColor(123)).toBe(false);
      expect(isValidFFmpegColor({})).toBe(false);
      expect(isValidFFmpegColor(true)).toBe(false);
    });

    it("should accept colors with @alpha suffix", () => {
      expect(isValidFFmpegColor("white@0.5")).toBe(true);
      expect(isValidFFmpegColor("black@0")).toBe(true);
      expect(isValidFFmpegColor("red@1")).toBe(true);
      expect(isValidFFmpegColor("#FF0000@0.8")).toBe(true);
      expect(isValidFFmpegColor("0xFF0000@0.3")).toBe(true);
    });

    it("should reject colors with invalid @alpha suffix", () => {
      expect(isValidFFmpegColor("white@1.5")).toBe(false); // > 1
      expect(isValidFFmpegColor("white@-0.1")).toBe(false); // < 0
      expect(isValidFFmpegColor("white@abc")).toBe(false); // not a number
      expect(isValidFFmpegColor("notacolor@0.5")).toBe(false); // invalid color
      expect(isValidFFmpegColor("@0.5")).toBe(false); // no color part
    });
  });

  describe("color clip validation", () => {
    it("should accept valid flat color string", () => {
      const clips = [
        { type: "color", color: "black", position: 0, end: 5 },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(true);
    });

    it("should accept valid hex color", () => {
      const clips = [
        { type: "color", color: "#1a1a2e", position: 0, end: 5 },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid flat color string", () => {
      const clips = [
        { type: "color", color: "notacolor", position: 0, end: 5 },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationCodes.INVALID_VALUE);
      expect(result.errors[0].path).toBe("clips[0].color");
    });

    it("should reject missing color property", () => {
      const clips = [
        { type: "color", position: 0, end: 5 },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ValidationCodes.MISSING_REQUIRED);
      expect(result.errors[0].path).toBe("clips[0].color");
    });

    it("should accept valid linear gradient", () => {
      const clips = [
        {
          type: "color",
          color: { type: "linear-gradient", colors: ["#000", "#fff"], direction: "vertical" },
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(true);
    });

    it("should accept valid radial gradient", () => {
      const clips = [
        {
          type: "color",
          color: { type: "radial-gradient", colors: ["white", "navy"] },
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(true);
    });

    it("should reject gradient with invalid type", () => {
      const clips = [
        {
          type: "color",
          color: { type: "conic-gradient", colors: ["#000", "#fff"] },
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe("clips[0].color.type");
    });

    it("should reject gradient with fewer than 2 colors", () => {
      const clips = [
        {
          type: "color",
          color: { type: "linear-gradient", colors: ["#000"] },
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe("clips[0].color.colors");
    });

    it("should reject gradient with invalid color in array", () => {
      const clips = [
        {
          type: "color",
          color: { type: "linear-gradient", colors: ["#000", "notacolor"] },
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe("clips[0].color.colors[1]");
    });

    it("should reject gradient with invalid direction", () => {
      const clips = [
        {
          type: "color",
          color: { type: "linear-gradient", colors: ["#000", "#fff"], direction: "diagonal" },
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe("clips[0].color.direction");
    });

    it("should accept gradient direction as number (angle)", () => {
      const clips = [
        {
          type: "color",
          color: { type: "linear-gradient", colors: ["#000", "#fff"], direction: 45 },
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(true);
    });

    it("should require position/end for color clips", () => {
      const clips = [
        { type: "color", color: "black" },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "clips[0].position")).toBe(true);
      expect(result.errors.some((e) => e.path === "clips[0].end")).toBe(true);
    });

    it("should validate transitions on color clips", () => {
      const clips = [
        {
          type: "color",
          color: "black",
          position: 0,
          end: 5,
          transition: { duration: 0 },
        },
      ];
      const result = validateConfig(clips);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe("clips[0].transition.duration");
    });
  });

  describe("clip color property validation", () => {
    it("should accept valid text clip colors without warnings", () => {
      const clips = [
        {
          type: "text",
          text: "Hello",
          position: 0,
          end: 5,
          fontColor: "#FFFFFF",
          borderColor: "black",
          shadowColor: "navy",
          backgroundColor: "red@0.5",
          highlightColor: "#FFFF00",
        },
      ];
      const result = validateConfig(clips);

      expect(result.valid).toBe(true);
      const colorWarnings = result.warnings.filter((w) =>
        w.message.includes("Invalid color")
      );
      expect(colorWarnings).toHaveLength(0);
    });

    it("should warn on invalid text clip fontColor", () => {
      const clips = [
        {
          type: "text",
          text: "Hello",
          position: 0,
          end: 5,
          fontColor: "notacolor",
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.path.includes("fontColor")
      );
      expect(colorWarnings).toHaveLength(1);
      expect(colorWarnings[0].message).toContain("Invalid color");
    });

    it("should warn on invalid text clip borderColor", () => {
      const clips = [
        {
          type: "text",
          text: "Hello",
          position: 0,
          end: 5,
          borderColor: "bblue",
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.path.includes("borderColor")
      );
      expect(colorWarnings).toHaveLength(1);
    });

    it("should warn on invalid text clip backgroundColor", () => {
      const clips = [
        {
          type: "text",
          text: "Hello",
          position: 0,
          end: 5,
          backgroundColor: "#GGGGGG",
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.path.includes("backgroundColor")
      );
      expect(colorWarnings).toHaveLength(1);
    });

    it("should warn on multiple invalid text colors at once", () => {
      const clips = [
        {
          type: "text",
          text: "Hello",
          position: 0,
          end: 5,
          fontColor: "badcolor1",
          borderColor: "badcolor2",
          shadowColor: "badcolor3",
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.message.includes("Invalid color")
      );
      expect(colorWarnings).toHaveLength(3);
    });

    it("should not warn when color properties are not set", () => {
      const clips = [
        {
          type: "text",
          text: "Hello",
          position: 0,
          end: 5,
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.message.includes("Invalid color")
      );
      expect(colorWarnings).toHaveLength(0);
    });

    it("should accept valid subtitle clip colors without warnings", () => {
      const clips = [
        {
          type: "subtitle",
          url: "./test.srt",
          fontColor: "#FFFFFF",
          borderColor: "black",
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.message.includes("Invalid color")
      );
      expect(colorWarnings).toHaveLength(0);
    });

    it("should warn on invalid subtitle clip fontColor", () => {
      const clips = [
        {
          type: "subtitle",
          url: "./test.srt",
          fontColor: "notacolor",
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.path.includes("fontColor")
      );
      expect(colorWarnings).toHaveLength(1);
      expect(colorWarnings[0].message).toContain("Invalid color");
    });

    it("should warn on invalid subtitle clip borderColor", () => {
      const clips = [
        {
          type: "subtitle",
          url: "./test.srt",
          borderColor: "invalidhex#123",
        },
      ];
      const result = validateConfig(clips);

      const colorWarnings = result.warnings.filter((w) =>
        w.path.includes("borderColor")
      );
      expect(colorWarnings).toHaveLength(1);
    });
  });
});
