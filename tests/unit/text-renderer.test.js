import { describe, it, expect } from "vitest";

// Dynamic import for CommonJS module
const TextRenderer = await import("../../src/ffmpeg/text_renderer.js");

describe("TextRenderer", () => {
  describe("buildTextFilters", () => {
    const canvasWidth = 1920;
    const canvasHeight = 1080;
    const initialVideoLabel = "[outv]";

    it("should build filter for static text", () => {
      const textClips = [
        {
          type: "text",
          text: "Hello World",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0,
          yPercent: 0,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      expect(result.filterString).toContain("drawtext=");
      expect(result.filterString).toContain("text='Hello World'");
      expect(result.filterString).toContain("font=Sans");
      expect(result.filterString).toContain("fontsize=48");
      expect(result.filterString).toContain("fontcolor=#FFFFFF");
      expect(result.filterString).toContain("enable='between(t,1,3)'");
      expect(result.finalVideoLabel).toBe("[outVideoAndText]");
    });

    it("should build filter for word-replace mode", () => {
      const textClips = [
        {
          type: "text",
          mode: "word-replace",
          position: 1,
          end: 3,
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0,
          yPercent: 0,
          words: [
            { text: "One", start: 1, end: 2 },
            { text: "Two", start: 2, end: 3 },
          ],
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      expect(result.filterString).toContain("text='One'");
      expect(result.filterString).toContain("text='Two'");
      expect(result.filterString).toContain("enable='between(t,1,2)'");
      expect(result.filterString).toContain("enable='between(t,2,3)'");
    });

    it("should build filter for word-sequential mode", () => {
      const textClips = [
        {
          type: "text",
          text: "Hello World",
          mode: "word-sequential",
          position: 1,
          end: 3,
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0,
          yPercent: 0,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // First window shows "Hello", second shows "Hello World"
      expect(result.filterString).toContain("text='Hello'");
      expect(result.filterString).toContain("text='Hello World'");
    });

    it("should handle fade-in animation", () => {
      const textClips = [
        {
          type: "text",
          text: "Fade In",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0,
          yPercent: 0,
          animation: { type: "fade-in", in: 0.5 },
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      expect(result.filterString).toContain(":alpha=");
    });

    it("should handle fade-in-out animation", () => {
      const textClips = [
        {
          type: "text",
          text: "Fade In Out",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0,
          yPercent: 0,
          animation: { type: "fade-in-out", in: 0.3, out: 0.3 },
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      expect(result.filterString).toContain(":alpha=");
    });

    it("should handle pop animation", () => {
      const textClips = [
        {
          type: "text",
          text: "Pop",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0,
          yPercent: 0,
          animation: { type: "pop", in: 0.25 },
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // Pop animation modifies fontsize dynamically
      expect(result.filterString).toContain("fontsize=if(");
    });

    it("should handle custom positioning with x/y", () => {
      const textClips = [
        {
          type: "text",
          text: "Custom Position",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          x: 100,
          y: 200,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      expect(result.filterString).toContain(":x=100");
      expect(result.filterString).toContain(":y=200");
    });

    it("should handle percentage positioning", () => {
      const textClips = [
        {
          type: "text",
          text: "Percent Position",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5, // 50% from left = centered
          yPercent: 0.8, // 80% from top = near bottom
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // xPercent: 0.5 * 1920 = 960
      expect(result.filterString).toContain(":x=960-text_w/2");
      // yPercent: 0.8 * 1080 = 864
      expect(result.filterString).toContain(":y=864-text_h/2");
    });

    it("should handle fontFile parameter", () => {
      const textClips = [
        {
          type: "text",
          text: "Custom Font",
          position: 1,
          end: 3,
          mode: "static",
          fontFile: "/path/to/font.ttf",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5, // centered
          yPercent: 0.5, // centered
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      expect(result.filterString).toContain("fontfile=/path/to/font.ttf");
    });

    it("should handle border and shadow styling", () => {
      const textClips = [
        {
          type: "text",
          text: "Styled",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0,
          yPercent: 0,
          borderColor: "black",
          borderWidth: 2,
          shadowColor: "gray",
          shadowX: 3,
          shadowY: 3,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      expect(result.filterString).toContain(":bordercolor=black");
      expect(result.filterString).toContain(":borderw=2");
      expect(result.filterString).toContain(":shadowcolor=gray");
      expect(result.filterString).toContain(":shadowx=3");
      expect(result.filterString).toContain(":shadowy=3");
    });
  });

  describe("expandTextWindows", () => {
    it("should expand static text to single window", () => {
      const textClips = [
        {
          type: "text",
          text: "Hello",
          position: 1,
          end: 3,
          mode: "static",
        },
      ];

      const windows = TextRenderer.expandTextWindows(textClips);

      expect(windows).toHaveLength(1);
      expect(windows[0].text).toBe("Hello");
      expect(windows[0].start).toBe(1);
      expect(windows[0].end).toBe(3);
    });

    it("should expand word-replace to multiple windows", () => {
      const textClips = [
        {
          type: "text",
          mode: "word-replace",
          position: 1,
          end: 3,
          words: [
            { text: "One", start: 1, end: 2 },
            { text: "Two", start: 2, end: 3 },
          ],
        },
      ];

      const windows = TextRenderer.expandTextWindows(textClips);

      expect(windows).toHaveLength(2);
      expect(windows[0].text).toBe("One");
      expect(windows[1].text).toBe("Two");
    });

    it("should expand word-sequential with cumulative text", () => {
      const textClips = [
        {
          type: "text",
          text: "A B C",
          mode: "word-sequential",
          position: 0,
          end: 3,
        },
      ];

      const windows = TextRenderer.expandTextWindows(textClips);

      expect(windows).toHaveLength(3);
      expect(windows[0].text).toBe("A");
      expect(windows[1].text).toBe("A B");
      expect(windows[2].text).toBe("A B C");
    });

    it("should auto-split text with wordTimestamps", () => {
      const textClips = [
        {
          type: "text",
          text: "Hello World",
          mode: "word-replace",
          position: 0,
          end: 4,
          wordTimestamps: [0, 2, 4],
        },
      ];

      const windows = TextRenderer.expandTextWindows(textClips);

      expect(windows).toHaveLength(2);
      expect(windows[0].text).toBe("Hello");
      expect(windows[0].start).toBe(0);
      expect(windows[0].end).toBe(2);
      expect(windows[1].text).toBe("World");
      expect(windows[1].start).toBe(2);
      expect(windows[1].end).toBe(4);
    });
  });
});
