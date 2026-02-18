import { describe, it, expect, vi, beforeEach } from "vitest";

const stringsModule = await import("../../src/ffmpeg/strings.js");
const {
  escapeDrawtextText,
  hasProblematicChars,
  hasEmoji,
  stripEmoji,
  parseFontFamily,
  escapeFilePath,
  escapeTextFilePath,
} = stringsModule;

const { parseFFmpegCommand } = await import("../../src/lib/utils.js");

describe("Strings - FFmpeg escaping utilities", () => {
  describe("hasProblematicChars", () => {
    it("should detect comma", () => {
      expect(hasProblematicChars("hello, world")).toBe(true);
    });

    it("should detect semicolon", () => {
      expect(hasProblematicChars("a;b")).toBe(true);
    });

    it("should detect braces and brackets", () => {
      expect(hasProblematicChars("{test}")).toBe(true);
      expect(hasProblematicChars("[test]")).toBe(true);
    });

    it("should detect double quotes", () => {
      expect(hasProblematicChars('say "hi"')).toBe(true);
    });

    it("should detect single quotes (apostrophes)", () => {
      expect(hasProblematicChars("Let's Go!")).toBe(true);
      expect(hasProblematicChars("it's")).toBe(true);
      expect(hasProblematicChars("don't")).toBe(true);
    });

    it("should detect non-ASCII characters", () => {
      expect(hasProblematicChars("café")).toBe(true);
      expect(hasProblematicChars("naïve résumé")).toBe(true);
      expect(hasProblematicChars("Emoji 🎬")).toBe(true);
    });

    it("should return false for safe text", () => {
      expect(hasProblematicChars("Hello World")).toBe(false);
      expect(hasProblematicChars("Simple text 123")).toBe(false);
      expect(hasProblematicChars("No special chars!")).toBe(false);
    });

    it("should return false for non-string input", () => {
      expect(hasProblematicChars(null)).toBe(false);
      expect(hasProblematicChars(undefined)).toBe(false);
      expect(hasProblematicChars(42)).toBe(false);
    });
  });

  describe("hasEmoji", () => {
    it("should detect emoji characters", () => {
      expect(hasEmoji("hello 🐾")).toBe(true);
      expect(hasEmoji("🎬🎥")).toBe(true);
      expect(hasEmoji("text ❤️ more")).toBe(true);
      expect(hasEmoji("small dog, big heart 🐾")).toBe(true);
    });

    it("should detect complex emoji sequences", () => {
      expect(hasEmoji("family 👨‍👩‍👧‍👦 time")).toBe(true);
      expect(hasEmoji("👋🏽 hello")).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(hasEmoji("Hello World")).toBe(false);
      expect(hasEmoji("Simple text 123")).toBe(false);
      expect(hasEmoji("100% done!")).toBe(false);
      expect(hasEmoji("#hashtag")).toBe(false);
    });

    it("should return false for non-emoji unicode", () => {
      expect(hasEmoji("café")).toBe(false);
      expect(hasEmoji("naïve résumé")).toBe(false);
      expect(hasEmoji("日本語")).toBe(false);
    });

    it("should return false for non-string input", () => {
      expect(hasEmoji(null)).toBe(false);
      expect(hasEmoji(undefined)).toBe(false);
      expect(hasEmoji(42)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(hasEmoji("")).toBe(false);
    });
  });

  describe("escapeDrawtextText", () => {
    it("should return empty string for non-string input", () => {
      expect(escapeDrawtextText(null)).toBe("");
      expect(escapeDrawtextText(undefined)).toBe("");
      expect(escapeDrawtextText(42)).toBe("");
    });

    it("should not modify simple text", () => {
      expect(escapeDrawtextText("Hello World")).toBe("Hello World");
    });

    it("should escape backslashes for drawtext level", () => {
      expect(escapeDrawtextText("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should escape colons for drawtext option separator", () => {
      expect(escapeDrawtextText("10:30 AM")).toBe("10\\:30 AM");
    });

    it("should replace newlines with spaces", () => {
      expect(escapeDrawtextText("line1\nline2")).toBe("line1 line2");
      expect(escapeDrawtextText("line1\r\nline2")).toBe("line1 line2");
    });

    it("should escape single quotes to survive two levels of av_get_token", () => {
      // FFmpeg parses filter_complex through TWO levels of av_get_token.
      // The apostrophe must survive both: level 1 (filter graph) and level 2
      // (filter options). The pattern '\\\'' (6 chars: ' \ \ \ ' ') achieves this:
      //   Level 1: end quote, \\ → \, \' → ', re-open quote → produces \'
      //   Level 2: \' → literal '
      const result = escapeDrawtextText("Let's Go!");
      expect(result).toBe("Let'\\\\\\''" + "s Go!");
    });

    it("should handle multiple apostrophes", () => {
      const result = escapeDrawtextText("it's a boy's toy");
      expect(result).toBe("it'\\\\\\''" + "s a boy'\\\\\\''" + "s toy");
    });

    it("should produce valid FFmpeg filter graph text when wrapped in quotes", () => {
      // When the escaped text is placed in text='...', the result should
      // survive FFmpeg's TWO levels of av_get_token parsing.
      //
      // For "Let's Go!":
      //   escaped = Let'\\\''s Go!
      //   wrapped = text='Let'\\\''s Go!'
      //
      // Level 1 (filter graph parser):
      //   'Let'    → "Let"
      //   \\       → "\"   (escaped backslash)
      //   \'       → "'"   (escaped quote)
      //   's Go!'  → "s Go!"
      //   Result:  Let\'s Go!
      //
      // Level 2 (drawtext option parser):
      //   Let      → "Let"
      //   \'       → "'"   (escaped quote)
      //   s Go!    → "s Go!"
      //   Result:  Let's Go!
      const escaped = escapeDrawtextText("Let's Go!");
      const wrapped = `text='${escaped}'`;
      expect(wrapped).toBe("text='Let'\\\\\\''" + "s Go!'");
    });

    it("should handle text with backslash followed by apostrophe", () => {
      // Input: test\'text (backslash then apostrophe)
      // After backslash escape: test\\ + 'text
      // After apostrophe escape: test\\ + '\\\'' + text
      const result = escapeDrawtextText("test\\'text");
      expect(result).toBe("test\\\\" + "'\\\\\\''" + "text");
    });

    it("should handle combined escaping (backslash + colon + apostrophe)", () => {
      const result = escapeDrawtextText("It's 10:30\\PM");
      expect(result).toBe("It'\\\\\\''" + "s 10\\:30\\\\PM");
    });
  });

  describe("stripEmoji", () => {
    it("should remove emoji from text", () => {
      expect(stripEmoji("Hello 🐾 world")).toBe("Hello world");
    });

    it("should remove multiple emoji", () => {
      expect(stripEmoji("🎬 Movie 🍿 night")).toBe("Movie night");
    });

    it("should remove variation selector emoji", () => {
      expect(stripEmoji("Love ❤️ it")).toBe("Love it");
    });

    it("should handle text with only emoji", () => {
      expect(stripEmoji("🐾🎬")).toBe("");
    });

    it("should not modify text without emoji", () => {
      expect(stripEmoji("Hello World")).toBe("Hello World");
      expect(stripEmoji("100% done!")).toBe("100% done!");
    });

    it("should collapse double spaces from removed emoji", () => {
      expect(stripEmoji("A 🐾 B 🎬 C")).toBe("A B C");
    });

    it("should return non-string input unchanged", () => {
      expect(stripEmoji(null)).toBe(null);
      expect(stripEmoji(undefined)).toBe(undefined);
      expect(stripEmoji(42)).toBe(42);
    });

    it("should not strip digits, #, or * (which have Emoji property)", () => {
      expect(stripEmoji("Call #123")).toBe("Call #123");
      expect(stripEmoji("100% * 2")).toBe("100% * 2");
    });

    it("should handle whitespace between emoji (collapses to empty)", () => {
      expect(stripEmoji("🐾 🎬")).toBe("");
      expect(stripEmoji("🐾  🎬")).toBe("");
    });

    it("should handle emoji at text boundaries", () => {
      expect(stripEmoji("🐾hello")).toBe("hello");
      expect(stripEmoji("hello🐾")).toBe("hello");
      expect(stripEmoji("🐾hello🐾")).toBe("hello");
    });

    it("should preserve special characters after emoji removal", () => {
      expect(stripEmoji("Let's 🐾 go!")).toBe("Let's go!");
      expect(stripEmoji("hello, 🐾 world")).toBe("hello, world");
    });

    it("should preserve newlines within text", () => {
      expect(stripEmoji("Line 1 🐾\nLine 2")).toBe("Line 1 \nLine 2");
      expect(stripEmoji("Line 1\n🐾Line 2")).toBe("Line 1\nLine 2");
    });

    it("should handle empty string", () => {
      expect(stripEmoji("")).toBe("");
    });
  });

  describe("parseFontFamily", () => {
    it("should return null for non-existent file", () => {
      expect(parseFontFamily("/tmp/does-not-exist.ttf")).toBe(null);
    });

    it("should return null for non-font file", () => {
      const fs = require("fs");
      const tmpFile = "/tmp/test-not-a-font.txt";
      fs.writeFileSync(tmpFile, "not a font file");
      expect(parseFontFamily(tmpFile)).toBe(null);
      fs.unlinkSync(tmpFile);
    });

    it("should return null for empty file", () => {
      const fs = require("fs");
      const tmpFile = "/tmp/test-empty-font.ttf";
      fs.writeFileSync(tmpFile, "");
      expect(parseFontFamily(tmpFile)).toBe(null);
      fs.unlinkSync(tmpFile);
    });

    it("should parse family name from a real TTF if available", () => {
      const fontPath = "/tmp/emoji-fonts/NotoEmoji-Regular.ttf";
      const fs = require("fs");
      if (fs.existsSync(fontPath)) {
        const family = parseFontFamily(fontPath);
        expect(typeof family).toBe("string");
        expect(family.length).toBeGreaterThan(0);
      }
    });
  });

  describe("escapeDrawtextText round-trip with filter_complex", () => {
    // These tests verify that the escaped text, when placed inside a
    // filter_complex string and parsed by parseFFmpegCommand, produces
    // the correct argument for FFmpeg.

    it("should survive parseFFmpegCommand round-trip for apostrophe text", () => {
      const escaped = escapeDrawtextText("Let's Go!");
      const filterComplex = `drawtext=text='${escaped}':font=Sans:fontsize=48`;
      const cmd = `ffmpeg -filter_complex "${filterComplex}" output.mp4`;
      const args = parseFFmpegCommand(cmd);

      // The filter_complex argument should contain the escaped text intact
      expect(args[2]).toBe(filterComplex);
      expect(args[2]).toContain("text='Let'\\\\\\''" + "s Go!'");
    });

    it("should survive round-trip for text with colons", () => {
      const escaped = escapeDrawtextText("Time: 10:30");
      const filterComplex = `drawtext=text='${escaped}':font=Sans`;
      const cmd = `ffmpeg -filter_complex "${filterComplex}" output.mp4`;
      const args = parseFFmpegCommand(cmd);

      expect(args[2]).toBe(filterComplex);
    });

    it("should survive round-trip for text with backslashes", () => {
      const escaped = escapeDrawtextText("C:\\Users\\test");
      const filterComplex = `drawtext=text='${escaped}':font=Sans`;
      const cmd = `ffmpeg -filter_complex "${filterComplex}" output.mp4`;
      const args = parseFFmpegCommand(cmd);

      expect(args[2]).toBe(filterComplex);
    });

    it("should survive round-trip for complex filter with multiple drawtext and expressions", () => {
      // Simulate the kind of filter_complex that caused the original bug
      const text1 = escapeDrawtextText("Let's Go!");
      const text2 = escapeDrawtextText("Unleash the Chaos!");

      const filterComplex = [
        "[0:v]scale=1920:1080[scaled0]",
        `[scaled0]drawtext=text='${text1}':font=Sans:fontsize=if(lt(t\\,0.5)\\,50+22*sin(PI/2*(t-0)/0.5)\\,72):fontcolor=#FFFFFF:x=960-text_w/2:y=216-text_h/2:enable='between(t,0,2)'[vtext0]`,
        `[vtext0]drawtext=text='${text2}':font=Sans:fontsize=48:fontcolor=#FFFFFF:x=384-text_w/2:y=864-text_h/2:enable='between(t,1,4)'[vtext1]`,
        "[vtext1]null[outVideoAndText]",
      ].join(";");

      const cmd = `ffmpeg -filter_complex "${filterComplex}" -map "[outVideoAndText]" output.mp4`;
      const args = parseFFmpegCommand(cmd);

      // filter_complex should be a single argument
      expect(args[2]).toBe(filterComplex);
      // Subsequent args should be correct
      expect(args[3]).toBe("-map");
      expect(args[4]).toBe("[outVideoAndText]");
    });
  });
});
