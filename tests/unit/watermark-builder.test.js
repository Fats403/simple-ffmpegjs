import { describe, it, expect } from "vitest";

const {
  buildWatermarkFilter,
  buildImageWatermark,
  buildTextWatermark,
  validateWatermarkConfig,
  calculatePosition,
} = await import("../../src/ffmpeg/watermark_builder.js");

describe("watermark_builder", () => {
  const canvasWidth = 1920;
  const canvasHeight = 1080;
  const totalDuration = 30;

  describe("calculatePosition", () => {
    it("should calculate top-left position for overlay", () => {
      const pos = calculatePosition(
        { position: "top-left", margin: 20 },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("20");
      expect(pos.y).toBe("20");
    });

    it("should calculate top-right position for overlay", () => {
      const pos = calculatePosition(
        { position: "top-right", margin: 20 },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("W-w-20");
      expect(pos.y).toBe("20");
    });

    it("should calculate bottom-left position for overlay", () => {
      const pos = calculatePosition(
        { position: "bottom-left", margin: 20 },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("20");
      expect(pos.y).toBe("H-h-20");
    });

    it("should calculate bottom-right position for overlay", () => {
      const pos = calculatePosition(
        { position: "bottom-right", margin: 20 },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("W-w-20");
      expect(pos.y).toBe("H-h-20");
    });

    it("should calculate center position for overlay", () => {
      const pos = calculatePosition(
        { position: "center" },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("(W-w)/2");
      expect(pos.y).toBe("(H-h)/2");
    });

    it("should calculate text position with tw/th variables", () => {
      const pos = calculatePosition(
        { position: "bottom-right", margin: 10 },
        canvasWidth,
        canvasHeight,
        true
      );
      expect(pos.x).toBe(`${canvasWidth}-tw-10`);
      expect(pos.y).toBe(`${canvasHeight}-th-10`);
    });

    it("should handle percentage-based positioning", () => {
      const pos = calculatePosition(
        { position: { xPercent: 0.5, yPercent: 0.5 } },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe(`${0.5 * canvasWidth}-w/2`);
      expect(pos.y).toBe(`${0.5 * canvasHeight}-h/2`);
    });

    it("should handle pixel-based positioning", () => {
      const pos = calculatePosition(
        { position: { x: 100, y: 200 } },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("100");
      expect(pos.y).toBe("200");
    });

    it("should use default margin of 20", () => {
      const pos = calculatePosition(
        { position: "top-left" },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("20");
      expect(pos.y).toBe("20");
    });

    it("should default to bottom-right for unknown preset", () => {
      const pos = calculatePosition(
        { position: "unknown", margin: 15 },
        canvasWidth,
        canvasHeight,
        false
      );
      expect(pos.x).toBe("W-w-15");
      expect(pos.y).toBe("H-h-15");
    });
  });

  describe("buildImageWatermark", () => {
    it("should build a basic image watermark filter", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "bottom-right",
        scale: 0.1,
        opacity: 1,
      };
      const result = buildImageWatermark(
        config,
        "[invid]",
        2,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.finalLabel).toBe("[outwm]");
      expect(result.filter).toContain("[2:v]");
      expect(result.filter).toContain("scale=192:-1"); // 1920 * 0.1 = 192
      expect(result.filter).toContain("[wm_scaled]");
      expect(result.filter).toContain("overlay=W-w-20:H-h-20");
      expect(result.filter).toContain("[outwm]");
    });

    it("should apply opacity to image watermark", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "bottom-right",
        scale: 0.15,
        opacity: 0.5,
      };
      const result = buildImageWatermark(
        config,
        "[invid]",
        2,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("colorchannelmixer=aa=0.5");
    });

    it("should add enable expression for timed watermark", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "center",
        startTime: 5,
        endTime: 20,
      };
      const result = buildImageWatermark(
        config,
        "[invid]",
        2,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("enable='between(t,5,20)'");
    });

    it("should not add enable expression when spanning full duration", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "center",
        startTime: 0,
        endTime: 30,
      };
      const result = buildImageWatermark(
        config,
        "[invid]",
        2,
        canvasWidth,
        canvasHeight,
        30
      );

      expect(result.filter).not.toContain("enable=");
    });

    it("should use custom margin", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "bottom-right",
        margin: 50,
      };
      const result = buildImageWatermark(
        config,
        "[invid]",
        2,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("overlay=W-w-50:H-h-50");
    });
  });

  describe("buildTextWatermark", () => {
    it("should build a basic text watermark filter", () => {
      const config = {
        type: "text",
        text: "@mychannel",
        position: "bottom-right",
        fontSize: 24,
        fontColor: "#FFFFFF",
      };
      const result = buildTextWatermark(
        config,
        "[invid]",
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.finalLabel).toBe("[outwm]");
      expect(result.filter).toContain("[invid]");
      expect(result.filter).toContain("drawtext=text='@mychannel'");
      expect(result.filter).toContain("fontsize=24");
      expect(result.filter).toContain("fontcolor=#FFFFFF");
      expect(result.filter).toContain("[outwm]");
    });

    it("should apply opacity to text watermark", () => {
      const config = {
        type: "text",
        text: "Test",
        position: "center",
        fontColor: "#FF0000",
        opacity: 0.5,
      };
      const result = buildTextWatermark(
        config,
        "[invid]",
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      // Opacity 0.5 = 128 in hex = 80 (Math.round(0.5 * 255) = 128)
      expect(result.filter).toContain("fontcolor=#FF000080");
    });

    it("should include border settings", () => {
      const config = {
        type: "text",
        text: "Test",
        position: "center",
        borderColor: "#000000",
        borderWidth: 2,
      };
      const result = buildTextWatermark(
        config,
        "[invid]",
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("bordercolor=#000000");
      expect(result.filter).toContain("borderw=2");
    });

    it("should include shadow settings", () => {
      const config = {
        type: "text",
        text: "Test",
        position: "center",
        shadowColor: "#000000",
        shadowX: 2,
        shadowY: 2,
      };
      const result = buildTextWatermark(
        config,
        "[invid]",
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("shadowcolor=#000000");
      expect(result.filter).toContain("shadowx=2");
      expect(result.filter).toContain("shadowy=2");
    });

    it("should add enable expression for timed watermark", () => {
      const config = {
        type: "text",
        text: "Limited time",
        position: "center",
        startTime: 10,
        endTime: 25,
      };
      const result = buildTextWatermark(
        config,
        "[invid]",
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("enable='between(t,10,25)'");
    });

    it("should use fontFile when specified", () => {
      const config = {
        type: "text",
        text: "Test",
        position: "center",
        fontFile: "/path/to/font.ttf",
      };
      const result = buildTextWatermark(
        config,
        "[invid]",
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("fontfile='/path/to/font.ttf'");
    });

    it("should escape special characters in text", () => {
      const config = {
        type: "text",
        text: "Hello: World's Test",
        position: "center",
      };
      const result = buildTextWatermark(
        config,
        "[invid]",
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      // Text should be escaped for drawtext
      expect(result.filter).toContain("drawtext=text=");
      expect(result.filter).not.toContain("Hello: World's Test"); // Should be escaped
    });
  });

  describe("buildWatermarkFilter", () => {
    it("should return unchanged label when no config provided", () => {
      const result = buildWatermarkFilter(
        null,
        "[invid]",
        null,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toBe("");
      expect(result.finalLabel).toBe("[invid]");
      expect(result.needsInput).toBe(false);
    });

    it("should build image watermark when type is image", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "bottom-right",
      };
      const result = buildWatermarkFilter(
        config,
        "[invid]",
        2,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("overlay");
      expect(result.finalLabel).toBe("[outwm]");
      expect(result.needsInput).toBe(true);
    });

    it("should build text watermark when type is text", () => {
      const config = {
        type: "text",
        text: "@test",
        position: "bottom-right",
      };
      const result = buildWatermarkFilter(
        config,
        "[invid]",
        null,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("drawtext");
      expect(result.finalLabel).toBe("[outwm]");
      expect(result.needsInput).toBe(false);
    });

    it("should default to image type", () => {
      const config = {
        url: "./logo.png",
        position: "center",
      };
      const result = buildWatermarkFilter(
        config,
        "[invid]",
        2,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toContain("overlay");
      expect(result.needsInput).toBe(true);
    });

    it("should return unchanged label for unknown type", () => {
      const config = {
        type: "unknown",
      };
      const result = buildWatermarkFilter(
        config,
        "[invid]",
        null,
        canvasWidth,
        canvasHeight,
        totalDuration
      );

      expect(result.filter).toBe("");
      expect(result.finalLabel).toBe("[invid]");
    });
  });

  describe("validateWatermarkConfig", () => {
    it("should return valid for null/undefined config", () => {
      expect(validateWatermarkConfig(null).valid).toBe(true);
      expect(validateWatermarkConfig(undefined).valid).toBe(true);
    });

    it("should return valid for correct image watermark", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "bottom-right",
        scale: 0.1,
        opacity: 0.8,
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return valid for correct text watermark", () => {
      const config = {
        type: "text",
        text: "@mychannel",
        position: "bottom-right",
        fontSize: 24,
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid type", () => {
      const config = { type: "invalid" };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("type"))).toBe(true);
    });

    it("should reject image watermark without url", () => {
      const config = { type: "image" };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("url"))).toBe(true);
    });

    it("should reject text watermark without text", () => {
      const config = { type: "text" };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("text"))).toBe(true);
    });

    it("should reject scale outside 0-1 range", () => {
      const config = { type: "image", url: "./logo.png", scale: 1.5 };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("scale"))).toBe(true);
    });

    it("should reject opacity outside 0-1 range", () => {
      const config = { type: "image", url: "./logo.png", opacity: -0.5 };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("opacity"))).toBe(true);
    });

    it("should reject negative margin", () => {
      const config = { type: "image", url: "./logo.png", margin: -10 };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("margin"))).toBe(true);
    });

    it("should reject negative startTime", () => {
      const config = { type: "image", url: "./logo.png", startTime: -5 };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("startTime"))).toBe(true);
    });

    it("should reject endTime <= startTime", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        startTime: 10,
        endTime: 5,
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("endTime"))).toBe(true);
    });

    it("should reject invalid position preset", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: "invalid-position",
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("position"))).toBe(true);
    });

    it("should reject mixed percentage and pixel positioning", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: { xPercent: 0.5, y: 100 },
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
    });

    it("should reject incomplete percentage positioning", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: { xPercent: 0.5 },
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.includes("xPercent") || e.includes("yPercent")
        )
      ).toBe(true);
    });

    it("should reject incomplete pixel positioning", () => {
      const config = { type: "image", url: "./logo.png", position: { x: 100 } };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
    });

    it("should accept valid percentage positioning", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: { xPercent: 0.5, yPercent: 0.5 },
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should accept valid pixel positioning", () => {
      const config = {
        type: "image",
        url: "./logo.png",
        position: { x: 100, y: 200 },
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should accept valid watermark colors", () => {
      const config = {
        type: "text",
        text: "@channel",
        fontColor: "#FFFFFF",
        borderColor: "black",
        shadowColor: "navy@0.5",
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid watermark fontColor", () => {
      const config = {
        type: "text",
        text: "@channel",
        fontColor: "notacolor",
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("fontColor"))).toBe(true);
    });

    it("should reject invalid watermark borderColor", () => {
      const config = {
        type: "text",
        text: "@channel",
        borderColor: "bblue",
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("borderColor"))).toBe(true);
    });

    it("should reject invalid watermark shadowColor", () => {
      const config = {
        type: "text",
        text: "@channel",
        shadowColor: "#GGGGGG",
      };
      const result = validateWatermarkConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("shadowColor"))).toBe(true);
    });
  });
});
