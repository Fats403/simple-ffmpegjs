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

    it("should escape apostrophes in text using end-quote-escape-reopen pattern", () => {
      const textClips = [
        {
          type: "text",
          text: "Let's Go!",
          position: 0,
          end: 2,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5,
          yPercent: 0.5,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // The apostrophe must survive two levels of av_get_token parsing.
      // Escaped as '\\\'' (end quote, \\, \', re-open quote)
      // so the full text parameter is: text='Let'\\\''s Go!'
      expect(result.filterString).toContain("text='Let'\\\\\\''" + "s Go!'");
      // The enable expression should NOT be consumed by the text value
      expect(result.filterString).toContain("enable='between(t,0,2)'");
    });

    it("should handle text with colons", () => {
      const textClips = [
        {
          type: "text",
          text: "Time: 10:30",
          position: 0,
          end: 2,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5,
          yPercent: 0.5,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // Colons should be escaped with \: for the drawtext filter
      expect(result.filterString).toContain("text='Time\\: 10\\:30'");
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

      expect(result.filterString).toContain("fontfile='/path/to/font.ttf'");
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

    it("should expand typewriter to character windows", () => {
      const textClips = [
        {
          type: "text",
          text: "Hi",
          mode: "static",
          position: 0,
          end: 2,
          animation: { type: "typewriter", speed: 0.5 },
        },
      ];

      const windows = TextRenderer.expandTextWindows(textClips);

      expect(windows).toHaveLength(2);
      expect(windows[0].text).toBe("H");
      expect(windows[1].text).toBe("Hi");
    });
  });

  describe("new animations", () => {
    const canvasWidth = 1920;
    const canvasHeight = 1080;
    const initialVideoLabel = "[outv]";

    it("should handle fade-out animation", () => {
      const textClips = [
        {
          type: "text",
          text: "Fade Out",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5,
          yPercent: 0.5,
          animation: { type: "fade-out", out: 0.5 },
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // fade-out should have alpha expression that fades at the end
      expect(result.filterString).toContain(":alpha=");
      expect(result.filterString).toContain("2.5"); // fadeOutStart = 3 - 0.5 = 2.5
    });

    it("should handle scale-in animation", () => {
      const textClips = [
        {
          type: "text",
          text: "Scale In",
          position: 1,
          end: 3,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5,
          yPercent: 0.5,
          animation: { type: "scale-in", in: 0.3, intensity: 0.5 },
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // scale-in should have fontsize expression and alpha fade
      expect(result.filterString).toContain("fontsize=if(");
      expect(result.filterString).toContain(":alpha=");
    });

    it("should handle pulse animation", () => {
      const textClips = [
        {
          type: "text",
          text: "Pulse",
          position: 1,
          end: 5,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5,
          yPercent: 0.5,
          animation: { type: "pulse", speed: 2, intensity: 0.2 },
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // pulse should have oscillating fontsize
      expect(result.filterString).toContain("fontsize=48+");
      expect(result.filterString).toContain("sin(");
    });

    it("should handle typewriter animation", () => {
      const textClips = [
        {
          type: "text",
          text: "Hello",
          position: 0,
          end: 2,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          xPercent: 0.5,
          yPercent: 0.5,
          animation: { type: "typewriter", speed: 0.1 },
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // typewriter should generate multiple drawtext calls for progressive reveal
      expect(result.filterString).toContain("text='H'");
      expect(result.filterString).toContain("text='He'");
      expect(result.filterString).toContain("text='Hel'");
      expect(result.filterString).toContain("text='Hell'");
      expect(result.filterString).toContain("text='Hello'");
    });

    it("should apply yOffset to center-positioned text", () => {
      const textClips = [
        {
          type: "text",
          text: "Offset Test",
          position: 0,
          end: 2,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          // Default center + 100px offset
          yOffset: 100,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // Should have center calculation + offset
      expect(result.filterString).toContain(
        `y=(${canvasHeight} - text_h)/2+100`
      );
    });

    it("should apply xOffset to center-positioned text", () => {
      const textClips = [
        {
          type: "text",
          text: "Offset Test",
          position: 0,
          end: 2,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          // Default center - 50px offset
          xOffset: -50,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // Should have center calculation + negative offset
      expect(result.filterString).toContain(
        `x=(${canvasWidth} - text_w)/2+-50`
      );
    });

    it("should apply offset to pixel-positioned text", () => {
      const textClips = [
        {
          type: "text",
          text: "Pixel Offset",
          position: 0,
          end: 2,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          y: 200,
          yOffset: 50,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // Should have pixel position + offset
      expect(result.filterString).toContain("y=200+50");
    });

    it("should apply offset to percent-positioned text", () => {
      const textClips = [
        {
          type: "text",
          text: "Percent Offset",
          position: 0,
          end: 2,
          mode: "static",
          fontFamily: "Sans",
          fontSize: 48,
          fontColor: "#FFFFFF",
          yPercent: 0.25,
          yOffset: -30,
        },
      ];

      const result = TextRenderer.buildTextFilters(
        textClips,
        canvasWidth,
        canvasHeight,
        initialVideoLabel
      );

      // yPercent 0.25 on 1080 height = 270, minus text_h/2, plus offset
      expect(result.filterString).toContain("y=270-text_h/2+-30");
    });
  });
});
