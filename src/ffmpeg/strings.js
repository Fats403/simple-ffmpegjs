/**
 * Escape a file path for use in FFmpeg command line arguments.
 * Prevents command injection by escaping quotes and backslashes.
 * @param {string} filePath - The file path to escape
 * @returns {string} Escaped file path safe for use in double-quoted command strings
 */
function escapeFilePath(filePath) {
  if (typeof filePath !== "string") return "";
  // Escape backslashes first, then double quotes
  // This makes the path safe for use inside double-quoted shell strings
  return filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Check if text contains characters that are problematic for FFmpeg's
 * drawtext filter and should use the textfile approach instead.
 */
function hasProblematicChars(text) {
  if (typeof text !== "string") return false;
  // These characters cannot be reliably escaped in filter_complex parsing.
  // Single quotes (') are included because FFmpeg's av_get_token does NOT
  // support \' inside single-quoted strings — ' always ends the quoted value.
  // Non-ASCII characters are also routed to textfile to avoid parser issues
  // with UTF-8 inside filter_complex.
  return /[,;{}\[\]"']/.test(text) || /[^\x20-\x7E]/.test(text);
}

function escapeDrawtextText(text) {
  if (typeof text !== "string") return "";
  // Escape characters that have special meaning in FFmpeg drawtext filter.
  //
  // FFmpeg parses the filter_complex value through TWO levels of av_get_token:
  //   Level 1 — filter-graph parser (terminators: [ , ; \n)
  //   Level 2 — filter option parser (terminators: : = )
  // Both levels handle '...' quoting and \x escaping identically.
  //
  // To embed a literal single quote that survives both levels:
  //   1. End the current level-1 quoted segment:      '
  //   2. \\  — level 1 escape → produces \  in output
  //   3. \'  — level 1 escape → produces '  in output
  //      So level 2 sees \' → escaped quote → literal '
  //   4. Re-open a new level-1 quoted segment:        '
  // The 6-char replacement per apostrophe is:  '\\\''
  //
  // Backslash (\\) and colon (\:) escaping inside the quoted segments is
  // passed through literally by level 1 (no escape processing inside '...'),
  // then processed by level 2 as escape sequences: \\ → \ and \: → :
  return text
    .replace(/\\/g, "\\\\") // Escape backslashes (level 2 decodes \\ → \)
    .replace(/'/g, "'\\\\\\''" ) // End quote, \\' (two-level escape), re-open quote
    .replace(/:/g, "\\:") // Escape colons (level 2 decodes \: → :)
    .replace(/\n/g, " ") // Replace newlines with space (multiline not supported)
    .replace(/\r/g, ""); // Remove carriage returns
}

/**
 * Escape a file path for use inside single-quoted FFmpeg filter parameters
 * (e.g., textfile='...', ass='...').
 *
 * These paths are parsed through two levels of av_get_token, so single
 * quotes need the same '\\\'' two-level escape as drawtext text values.
 */
function escapeTextFilePath(filePath) {
  if (typeof filePath !== "string") return "";
  return filePath
    .replace(/\\/g, "/") // Convert backslashes to forward slashes
    .replace(/'/g, "'\\\\\\''" ) // Two-level apostrophe escape (same as escapeDrawtextText)
    .replace(/:/g, "\\:"); // Escape colons (for Windows drive letters)
}

/**
 * Check if text contains emoji characters that require ASS-based rendering
 * for proper font fallback (drawtext uses a single font with no fallback).
 * Matches two classes:
 *   1. \p{Emoji_Presentation} — inherently visual emoji (e.g. 🐾, 🎬)
 *   2. \p{Emoji}\uFE0F — text-default emoji made visual by variation selector (e.g. ❤️)
 * Does NOT match bare digits, #, * etc. which have \p{Emoji} but lack the selector.
 */
function hasEmoji(text) {
  if (typeof text !== "string") return false;
  return /\p{Emoji_Presentation}/u.test(text) || /\p{Emoji}\uFE0F/u.test(text);
}

const fs = require("fs");
const path = require("path");

const VISUAL_EMOJI_RE = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

/**
 * Remove visual emoji characters from text.
 * Collapses any resulting double-spaces but preserves leading/trailing whitespace.
 * @param {string} text
 * @returns {string}
 */
function stripEmoji(text) {
  if (typeof text !== "string") return text;
  return text.replace(VISUAL_EMOJI_RE, "").replace(/ {2,}/g, " ").trim();
}

/**
 * Parse the font family name from a TrueType/OpenType font file.
 * Reads the 'name' table (nameID 1) directly — no dependencies needed.
 * Returns the family name string or null if parsing fails.
 * @param {string} fontPath - Absolute or relative path to a .ttf/.otf file
 * @returns {string|null}
 */
function parseFontFamily(fontPath) {
  try {
    const buf = fs.readFileSync(fontPath);
    if (buf.length < 12) return null;
    const numTables = buf.readUInt16BE(4);
    for (let i = 0; i < numTables; i++) {
      const off = 12 + i * 16;
      if (off + 16 > buf.length) return null;
      const tag = buf.toString("ascii", off, off + 4);
      if (tag !== "name") continue;
      const tableOffset = buf.readUInt32BE(off + 8);
      if (tableOffset + 6 > buf.length) return null;
      const count = buf.readUInt16BE(tableOffset + 2);
      const stringStorageOffset = tableOffset + buf.readUInt16BE(tableOffset + 4);
      for (let j = 0; j < count; j++) {
        const recOff = tableOffset + 6 + j * 12;
        if (recOff + 12 > buf.length) return null;
        const platformID = buf.readUInt16BE(recOff);
        const nameID = buf.readUInt16BE(recOff + 6);
        const length = buf.readUInt16BE(recOff + 8);
        const strOff = buf.readUInt16BE(recOff + 10);
        if (nameID !== 1) continue;
        const start = stringStorageOffset + strOff;
        if (start + length > buf.length) continue;
        if (platformID === 1) {
          return buf.toString("utf8", start, start + length);
        }
        if (platformID === 3) {
          let name = "";
          for (let k = 0; k < length; k += 2) {
            name += String.fromCharCode(buf.readUInt16BE(start + k));
          }
          return name;
        }
      }
      break;
    }
  } catch {
    return null;
  }
  return null;
}

function getClipAudioString(clip, inputIndex) {
  const adelay = Math.round(Math.max(0, (clip.position || 0) * 1000));
  const audioConcatInput = `[a${inputIndex}]`;
  const audioStringPart = `[${inputIndex}:a]volume=${clip.volume},atrim=start=${
    clip.cutFrom
  }:end=${
    clip.cutFrom + (clip.end - clip.position)
  },adelay=${adelay}|${adelay},asetpts=PTS-STARTPTS${audioConcatInput};`;
  return { audioStringPart, audioConcatInput };
}

module.exports = {
  escapeFilePath,
  escapeDrawtextText,
  getClipAudioString,
  hasProblematicChars,
  hasEmoji,
  stripEmoji,
  parseFontFamily,
  escapeTextFilePath,
};
