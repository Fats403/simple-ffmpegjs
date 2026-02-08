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
  escapeTextFilePath,
};
