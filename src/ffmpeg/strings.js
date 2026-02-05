function escapeSingleQuotes(text) {
  return String(text).replace(/'/g, "\\'");
}

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
  // These characters cannot be reliably escaped in filter_complex parsing
  // when passed through shell double-quoting
  return /[,;{}\[\]"]/.test(text);
}

function escapeDrawtextText(text) {
  if (typeof text !== "string") return "";
  // Escape characters that have special meaning in FFmpeg drawtext filter
  // AND characters that break shell parsing (since filter_complex is double-quoted)
  return text
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/'/g, "\\'") // Escape single quotes (text delimiter)
    .replace(/"/g, '\\"') // Escape double quotes (shell safety)
    .replace(/:/g, "\\:") // Escape colons (option separator)
    .replace(/\n/g, " ") // Replace newlines with space (multiline not supported)
    .replace(/\r/g, ""); // Remove carriage returns
}

/**
 * Escape a file path for use in FFmpeg filters (Windows paths need special handling)
 */
function escapeTextFilePath(filePath) {
  if (typeof filePath !== "string") return "";
  // FFmpeg on Windows needs forward slashes and escaped colons
  return filePath
    .replace(/\\/g, "/") // Convert backslashes to forward slashes
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
  escapeSingleQuotes,
  escapeFilePath,
  escapeDrawtextText,
  getClipAudioString,
  hasProblematicChars,
  escapeTextFilePath,
};
