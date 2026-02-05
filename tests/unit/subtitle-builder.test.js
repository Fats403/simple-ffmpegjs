import { describe, it, expect } from "vitest";

// Dynamic import for CommonJS module
const SubtitleBuilder = await import("../../src/ffmpeg/subtitle_builder.js");
const {
  hexToASSColor,
  secondsToASSTime,
  escapeASSText,
  generateASSHeader,
  generateASSStyle,
  generateASSStyles,
  generateASSDialogue,
  generateASSEvents,
  buildKaraokeASS,
  buildSubtitleASS,
  parseSRT,
  parseVTT,
  buildASSFilter,
  validateSubtitleClip,
} = SubtitleBuilder;

describe("Subtitle Builder", () => {
  describe("hexToASSColor", () => {
    it("should convert white hex to ASS format", () => {
      const result = hexToASSColor("#FFFFFF");
      expect(result).toBe("&H00FFFFFF");
    });

    it("should convert red hex to ASS BGR format", () => {
      const result = hexToASSColor("#FF0000");
      // ASS uses BGR, so red (FF0000) becomes 0000FF
      expect(result).toBe("&H000000FF");
    });

    it("should convert with opacity", () => {
      const result = hexToASSColor("#FFFFFF", 0.5);
      // 0.5 opacity = 0.5 transparency = 128 = 0x80
      expect(result).toBe("&H80FFFFFF");
    });

    it("should convert fully transparent", () => {
      const result = hexToASSColor("#FFFFFF", 0);
      expect(result).toBe("&HFFFFFFFF");
    });

    it("should handle named colors", () => {
      const result = hexToASSColor("yellow");
      expect(result).toBe("&H0000FFFF");
    });

    it("should handle short hex format", () => {
      const result = hexToASSColor("#F00");
      expect(result).toBe("&H000000FF");
    });

    it("should handle hex without hash", () => {
      const result = hexToASSColor("00FF00");
      expect(result).toBe("&H0000FF00");
    });
  });

  describe("secondsToASSTime", () => {
    it("should convert 0 seconds", () => {
      expect(secondsToASSTime(0)).toBe("0:00:00.00");
    });

    it("should convert seconds only", () => {
      expect(secondsToASSTime(5.5)).toBe("0:00:05.50");
    });

    it("should convert minutes and seconds", () => {
      expect(secondsToASSTime(65.25)).toBe("0:01:05.25");
    });

    it("should convert hours, minutes, seconds", () => {
      expect(secondsToASSTime(3661.99)).toBe("1:01:01.99");
    });

    it("should round centiseconds correctly", () => {
      // 1.567 => cs = round(0.567 * 100) = round(56.7) = 57
      expect(secondsToASSTime(1.567)).toBe("0:00:01.57");
    });
  });

  describe("escapeASSText", () => {
    it("should escape backslashes", () => {
      expect(escapeASSText("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should escape curly braces", () => {
      expect(escapeASSText("{tag}")).toBe("\\{tag\\}");
    });

    it("should convert newlines", () => {
      expect(escapeASSText("line1\nline2")).toBe("line1\\Nline2");
    });

    it("should handle mixed escapes", () => {
      expect(escapeASSText("a\\b{c}d\ne")).toBe("a\\\\b\\{c\\}d\\Ne");
    });
  });

  describe("generateASSHeader", () => {
    it("should generate valid header", () => {
      const header = generateASSHeader(1920, 1080, "Test");
      expect(header).toContain("[Script Info]");
      expect(header).toContain("Title: Test");
      expect(header).toContain("PlayResX: 1920");
      expect(header).toContain("PlayResY: 1080");
    });

    it("should use default title", () => {
      const header = generateASSHeader(1280, 720);
      expect(header).toContain("Title: simple-ffmpeg subtitles");
    });
  });

  describe("generateASSStyle", () => {
    it("should generate default style", () => {
      const style = generateASSStyle();
      expect(style).toContain("Style: Default");
      expect(style).toContain("Arial");
      expect(style).toContain("48"); // default font size
    });

    it("should apply custom options", () => {
      const style = generateASSStyle({
        name: "Custom",
        fontFamily: "Helvetica",
        fontSize: 36,
        primaryColor: "#FF0000",
        bold: true,
      });
      expect(style).toContain("Style: Custom");
      expect(style).toContain("Helvetica");
      expect(style).toContain(",36,");
      expect(style).toContain(",-1,"); // bold = -1
    });
  });

  describe("generateASSStyles", () => {
    it("should generate default style section when no styles provided", () => {
      const section = generateASSStyles([]);
      expect(section).toContain("[V4+ Styles]");
      expect(section).toContain("Style: Default");
    });

    it("should generate multiple styles", () => {
      const section = generateASSStyles([
        { name: "Style1" },
        { name: "Style2" },
      ]);
      expect(section).toContain("Style: Style1");
      expect(section).toContain("Style: Style2");
    });
  });

  describe("generateASSDialogue", () => {
    it("should generate dialogue line", () => {
      const dialogue = generateASSDialogue({
        start: 1.5,
        end: 5.0,
        text: "Hello world",
      });
      expect(dialogue).toContain("Dialogue: 0");
      expect(dialogue).toContain("0:00:01.50");
      expect(dialogue).toContain("0:00:05.00");
      expect(dialogue).toContain("Hello world");
    });

    it("should use custom style", () => {
      const dialogue = generateASSDialogue({
        start: 0,
        end: 1,
        style: "Karaoke",
        text: "Test",
      });
      expect(dialogue).toContain(",Karaoke,");
    });

    it("should support layer", () => {
      const dialogue = generateASSDialogue({
        layer: 2,
        start: 0,
        end: 1,
        text: "Test",
      });
      expect(dialogue).toContain("Dialogue: 2");
    });
  });

  describe("generateASSEvents", () => {
    it("should generate events section", () => {
      const events = generateASSEvents([
        { start: 0, end: 1, text: "First" },
        { start: 1, end: 2, text: "Second" },
      ]);
      expect(events).toContain("[Events]");
      expect(events).toContain("First");
      expect(events).toContain("Second");
    });
  });

  describe("buildKaraokeASS", () => {
    it("should generate karaoke ASS with word timestamps", () => {
      const clip = {
        text: "Hello world test",
        position: 0,
        end: 3,
        words: [
          { text: "Hello", start: 0, end: 1 },
          { text: "world", start: 1, end: 2 },
          { text: "test", start: 2, end: 3 },
        ],
        fontFamily: "Arial",
        fontSize: 48,
        fontColor: "#FFFFFF",
        highlightColor: "#FFFF00",
      };

      const ass = buildKaraokeASS(clip, 1920, 1080);

      expect(ass).toContain("[Script Info]");
      expect(ass).toContain("[V4+ Styles]");
      expect(ass).toContain("Style: Karaoke");
      expect(ass).toContain("[Events]");
      // Check for karaoke tags (\kf = smooth fill)
      expect(ass).toContain("{\\kf100}Hello");
      expect(ass).toContain("{\\kf100}world");
      expect(ass).toContain("{\\kf100}test");
    });

    it("should distribute words evenly when no timestamps provided", () => {
      const clip = {
        text: "One Two",
        position: 0,
        end: 2,
        fontColor: "#FFFFFF",
        highlightColor: "#00FF00",
      };

      const ass = buildKaraokeASS(clip, 1280, 720);

      expect(ass).toContain("{\\kf100}One");
      expect(ass).toContain("{\\kf100}Two");
    });

    it("should use wordTimestamps array", () => {
      const clip = {
        text: "A B C",
        position: 0,
        end: 3,
        wordTimestamps: [0, 1, 2],
        fontColor: "#FFFFFF",
        highlightColor: "#FFFF00",
      };

      const ass = buildKaraokeASS(clip, 1920, 1080);

      expect(ass).toContain("{\\kf100}A");
      expect(ass).toContain("{\\kf100}B");
      expect(ass).toContain("{\\kf100}C");
    });

    it("should use instant highlight style when specified", () => {
      const clip = {
        text: "One Two",
        position: 0,
        end: 2,
        highlightStyle: "instant",
        fontColor: "#FFFFFF",
        highlightColor: "#00FF00",
      };

      const ass = buildKaraokeASS(clip, 1280, 720);

      // Check for \k tags (instant) instead of \kf (smooth)
      expect(ass).toContain("{\\k100}One");
      expect(ass).toContain("{\\k100}Two");
      expect(ass).not.toContain("\\kf");
    });

    it("should default to smooth highlight style", () => {
      const clip = {
        text: "Test Word",
        position: 0,
        end: 2,
        fontColor: "#FFFFFF",
      };

      const ass = buildKaraokeASS(clip, 1280, 720);

      // Should use \kf (smooth fill) by default
      expect(ass).toContain("\\kf");
      expect(ass).not.toMatch(/\{\\k\d+\}/); // No instant \k tags
    });

    it("should handle multi-line text with line breaks", () => {
      const clip = {
        text: "Line one\nLine two",
        position: 0,
        end: 4,
        fontColor: "#FFFFFF",
        highlightColor: "#FFFF00",
      };

      const ass = buildKaraokeASS(clip, 1920, 1080);

      // Should contain \N for line break between "one" and "Line"
      expect(ass).toContain("\\N");
      // Words should still have karaoke tags
      expect(ass).toContain("{\\kf100}Line");
      expect(ass).toContain("{\\kf100}one");
      expect(ass).toContain("{\\kf100}two");
    });

    it("should support lineBreak property in words array", () => {
      const clip = {
        text: "First Second Third Fourth",
        position: 0,
        end: 4,
        words: [
          { text: "First", start: 0, end: 1, lineBreak: false },
          { text: "Second", start: 1, end: 2, lineBreak: true }, // Line break after this word
          { text: "Third", start: 2, end: 3, lineBreak: false },
          { text: "Fourth", start: 3, end: 4, lineBreak: false },
        ],
        fontColor: "#FFFFFF",
      };

      const ass = buildKaraokeASS(clip, 1920, 1080);

      // Should have line break after "Second"
      expect(ass).toMatch(/Second.*\\N.*Third/);
    });

    it("should set correct alignment based on yPercent", () => {
      const topClip = {
        text: "Top",
        position: 0,
        end: 1,
        yPercent: 0.1,
        fontColor: "#FFFFFF",
      };
      const bottomClip = {
        text: "Bottom",
        position: 0,
        end: 1,
        yPercent: 0.9,
        fontColor: "#FFFFFF",
      };

      const topASS = buildKaraokeASS(topClip, 1920, 1080);
      const bottomASS = buildKaraokeASS(bottomClip, 1920, 1080);

      // Top alignment = 8, bottom alignment = 2
      expect(topASS).toMatch(/,8,\d+,\d+,\d+,/); // alignment 8
      expect(bottomASS).toMatch(/,2,\d+,\d+,\d+,/); // alignment 2
    });
  });

  describe("buildSubtitleASS", () => {
    it("should generate subtitle ASS", () => {
      const clip = {
        text: "This is a subtitle",
        position: 1.5,
        end: 4.5,
        fontFamily: "Helvetica",
        fontSize: 36,
        fontColor: "#FFFFFF",
        borderColor: "#000000",
      };

      const ass = buildSubtitleASS(clip, 1920, 1080);

      expect(ass).toContain("[Script Info]");
      expect(ass).toContain("Helvetica");
      expect(ass).toContain(",36,");
      expect(ass).toContain("This is a subtitle");
    });
  });

  describe("parseSRT", () => {
    it("should parse basic SRT content", () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
First subtitle

2
00:00:05,500 --> 00:00:08,250
Second subtitle`;

      const dialogues = parseSRT(srt);

      expect(dialogues).toHaveLength(2);
      expect(dialogues[0].start).toBe(1);
      expect(dialogues[0].end).toBe(4);
      expect(dialogues[0].text).toContain("First subtitle");
      expect(dialogues[1].start).toBe(5.5);
      expect(dialogues[1].end).toBeCloseTo(8.25);
    });

    it("should handle multi-line subtitles", () => {
      const srt = `1
00:00:00,000 --> 00:00:02,000
Line one
Line two`;

      const dialogues = parseSRT(srt);

      expect(dialogues).toHaveLength(1);
      expect(dialogues[0].text).toContain("\\N");
    });

    it("should strip HTML tags", () => {
      const srt = `1
00:00:00,000 --> 00:00:01,000
<i>Italic</i> and <b>bold</b>`;

      const dialogues = parseSRT(srt);

      expect(dialogues[0].text).toBe("Italic and bold");
    });

    it("should handle period separator for milliseconds", () => {
      const srt = `1
00:00:01.500 --> 00:00:02.750
Test`;

      const dialogues = parseSRT(srt);

      expect(dialogues[0].start).toBe(1.5);
      expect(dialogues[0].end).toBeCloseTo(2.75);
    });
  });

  describe("parseVTT", () => {
    it("should parse basic VTT content", () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
First cue

00:00:05.500 --> 00:00:08.250
Second cue`;

      const dialogues = parseVTT(vtt);

      expect(dialogues).toHaveLength(2);
      expect(dialogues[0].start).toBe(1);
      expect(dialogues[0].end).toBe(4);
    });

    it("should handle short timestamp format", () => {
      const vtt = `WEBVTT

00:01.000 --> 00:05.500
Short format`;

      const dialogues = parseVTT(vtt);

      expect(dialogues).toHaveLength(1);
      expect(dialogues[0].start).toBe(1);
      expect(dialogues[0].end).toBe(5.5);
    });

    it("should strip VTT formatting tags", () => {
      const vtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
<c.yellow>Colored</c> text`;

      const dialogues = parseVTT(vtt);

      expect(dialogues[0].text).toBe("Colored text");
    });
  });

  describe("buildASSFilter", () => {
    it("should build ass filter string", () => {
      const result = buildASSFilter("/path/to/file.ass", "[invideo]");

      expect(result.filter).toContain("ass=");
      expect(result.filter).toContain("/path/to/file.ass");
      expect(result.filter).toContain("[invideo]");
      expect(result.finalLabel).toBe("[outass]");
    });

    it("should escape colons in path", () => {
      const result = buildASSFilter("C:/path/to/file.ass", "[in]");

      expect(result.filter).toContain("C\\:/path/to/file.ass");
    });

    it("should escape backslashes and colons", () => {
      const result = buildASSFilter("C:\\path\\to\\file.ass", "[in]");

      // Backslashes converted to forward slashes, then colons escaped
      expect(result.filter).toContain("C\\:/path/to/file.ass");
    });
  });

  describe("validateSubtitleClip", () => {
    describe("subtitle type", () => {
      it("should pass for valid subtitle clip", () => {
        const result = validateSubtitleClip({
          type: "subtitle",
          url: "/path/to/file.srt",
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should fail for missing url", () => {
        const result = validateSubtitleClip({
          type: "subtitle",
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("requires a 'url'");
      });

      it("should fail for unsupported format", () => {
        const result = validateSubtitleClip({
          type: "subtitle",
          url: "/path/to/file.txt",
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("Unsupported subtitle format");
      });

      it("should accept .ass files", () => {
        const result = validateSubtitleClip({
          type: "subtitle",
          url: "/path/to/file.ass",
        });
        expect(result.valid).toBe(true);
      });

      it("should accept .ssa files", () => {
        const result = validateSubtitleClip({
          type: "subtitle",
          url: "/path/to/file.ssa",
        });
        expect(result.valid).toBe(true);
      });

      it("should accept .vtt files", () => {
        const result = validateSubtitleClip({
          type: "subtitle",
          url: "/path/to/file.vtt",
        });
        expect(result.valid).toBe(true);
      });
    });

    describe("karaoke mode", () => {
      it("should pass for valid karaoke clip", () => {
        const result = validateSubtitleClip({
          type: "text",
          mode: "karaoke",
          text: "Hello world",
          position: 0,
          end: 5,
        });
        expect(result.valid).toBe(true);
      });

      it("should fail for missing text", () => {
        const result = validateSubtitleClip({
          type: "text",
          mode: "karaoke",
          position: 0,
          end: 5,
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("requires 'text'");
      });

      it("should fail for missing position", () => {
        const result = validateSubtitleClip({
          type: "text",
          mode: "karaoke",
          text: "Test",
          end: 5,
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("requires 'position'");
      });

      it("should fail for missing end", () => {
        const result = validateSubtitleClip({
          type: "text",
          mode: "karaoke",
          text: "Test",
          position: 0,
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("requires 'end'");
      });
    });
  });
});
