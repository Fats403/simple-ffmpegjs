/**
 * Subtitle builder for ASS-based text rendering
 * Supports karaoke mode and subtitle file imports (SRT, ASS, VTT)
 */

const fs = require("fs");
const path = require("path");

/**
 * Convert hex color (#RRGGBB or #RRGGBBAA) to ASS color format (&HAABBGGRR)
 * ASS uses BGR order with alpha, not RGB
 */
function hexToASSColor(hex, opacity = 1) {
  // Remove # if present
  let color = hex.startsWith("#") ? hex.slice(1) : hex;

  // Handle named colors
  const namedColors = {
    white: "FFFFFF",
    black: "000000",
    red: "FF0000",
    green: "00FF00",
    blue: "0000FF",
    yellow: "FFFF00",
    cyan: "00FFFF",
    magenta: "FF00FF",
    orange: "FFA500",
    pink: "FFC0CB",
    purple: "800080",
    gold: "FFD700",
  };

  if (namedColors[color.toLowerCase()]) {
    color = namedColors[color.toLowerCase()];
  }

  // Ensure 6 characters (RGB)
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }

  // Extract RGB
  const r = color.slice(0, 2);
  const g = color.slice(2, 4);
  const b = color.slice(4, 6);

  // Calculate alpha (00 = fully opaque in ASS, FF = fully transparent)
  const alpha = Math.round((1 - opacity) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

  // ASS format: &HAABBGGRR (alpha, blue, green, red)
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

/**
 * Convert seconds to ASS timestamp format (H:MM:SS.cc)
 * ASS uses centiseconds (1/100th of a second)
 */
function secondsToASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);

  return `${h}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/**
 * Escape text for ASS format
 */
function escapeASSText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}

/**
 * Generate ASS header/script info section
 */
function generateASSHeader(width, height, title = "simple-ffmpeg subtitles") {
  return `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${width}
PlayResY: ${height}

`;
}

/**
 * Generate ASS style definition
 */
function generateASSStyle(options = {}) {
  const {
    name = "Default",
    fontFamily = "Arial",
    fontSize = 48,
    primaryColor = "#FFFFFF",
    secondaryColor = "#FFFF00", // Used for karaoke highlight
    outlineColor = "#000000",
    backColor = "#000000",
    bold = false,
    italic = false,
    underline = false,
    strikeOut = false,
    scaleX = 100,
    scaleY = 100,
    spacing = 0,
    angle = 0,
    borderStyle = 1, // 1 = outline + shadow, 3 = opaque box
    outline = 2,
    shadow = 1,
    alignment = 5, // 1-9 numpad style, 5 = center
    marginL = 20,
    marginR = 20,
    marginV = 20,
    encoding = 1,
    opacity = 1,
    outlineOpacity = 1,
  } = options;

  const primary = hexToASSColor(primaryColor, opacity);
  const secondary = hexToASSColor(secondaryColor, opacity);
  const outlineCol = hexToASSColor(outlineColor, outlineOpacity);
  const back = hexToASSColor(backColor, 0.5);

  return `Style: ${name},${fontFamily},${fontSize},${primary},${secondary},${outlineCol},${back},${
    bold ? -1 : 0
  },${italic ? -1 : 0},${underline ? -1 : 0},${
    strikeOut ? -1 : 0
  },${scaleX},${scaleY},${spacing},${angle},${borderStyle},${outline},${shadow},${alignment},${marginL},${marginR},${marginV},${encoding}`;
}

/**
 * Generate ASS styles section
 */
function generateASSStyles(styles = []) {
  let section = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

  if (styles.length === 0) {
    // Default style
    section += generateASSStyle() + "\n";
  } else {
    for (const style of styles) {
      section += generateASSStyle(style) + "\n";
    }
  }

  return section + "\n";
}

/**
 * Generate a single ASS dialogue line
 */
function generateASSDialogue(options) {
  const {
    layer = 0,
    start,
    end,
    style = "Default",
    name = "",
    marginL = 0,
    marginR = 0,
    marginV = 0,
    effect = "",
    text,
  } = options;

  const startTime = secondsToASSTime(start);
  const endTime = secondsToASSTime(end);

  return `Dialogue: ${layer},${startTime},${endTime},${style},${name},${marginL},${marginR},${marginV},${effect},${text}`;
}

/**
 * Generate ASS events section
 */
function generateASSEvents(dialogues = []) {
  let section = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const dialogue of dialogues) {
    section += generateASSDialogue(dialogue) + "\n";
  }

  return section;
}

/**
 * Build karaoke ASS content for a text clip
 * @param {Object} clip - Text clip with karaoke settings
 * @param {number} canvasWidth - Video width
 * @param {number} canvasHeight - Video height
 * @returns {string} Complete ASS file content
 */
function buildKaraokeASS(clip, canvasWidth, canvasHeight) {
  const {
    text = "",
    position: clipStart,
    end: clipEnd,
    words,
    wordTimestamps,
    fontFamily = "Arial",
    fontSize = 48,
    fontColor = "#FFFFFF",
    highlightColor = "#FFFF00",
    highlightStyle = "smooth", // "smooth" (gradual fill) or "instant"
    borderColor = "#000000",
    borderWidth = 2,
    shadowColor,
    shadowX = 0,
    shadowY = 0,
    xPercent,
    yPercent,
    x,
    y,
    opacity = 1,
  } = clip;

  // Parse words and their timings, preserving line breaks
  // Split by lines first, then by spaces within each line
  const lines = text.split(/\n/);
  const splitWords = [];
  const lineBreakAfter = new Set(); // Track which word indices have line breaks after them

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineWords = lines[lineIdx].split(/\s+/).filter(Boolean);
    for (const word of lineWords) {
      splitWords.push(word);
    }
    // Mark line break after the last word of this line (except for the last line)
    if (lineIdx < lines.length - 1 && splitWords.length > 0) {
      lineBreakAfter.add(splitWords.length - 1);
    }
  }

  let wordList = [];

  if (Array.isArray(words) && words.length > 0) {
    // User provided explicit word timings - check if they include lineBreak property
    wordList = words.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      lineBreak: w.lineBreak || false,
    }));
  } else if (Array.isArray(wordTimestamps) && wordTimestamps.length > 0) {
    const ts = wordTimestamps;
    for (let i = 0; i < splitWords.length; i++) {
      const start = ts[i] !== undefined ? ts[i] : clipStart;
      const end = ts[i + 1] !== undefined ? ts[i + 1] : clipEnd;
      wordList.push({
        text: splitWords[i],
        start,
        end,
        lineBreak: lineBreakAfter.has(i),
      });
    }
  } else {
    // Distribute evenly
    const duration = clipEnd - clipStart;
    const wordDuration = duration / splitWords.length;
    for (let i = 0; i < splitWords.length; i++) {
      wordList.push({
        text: splitWords[i],
        start: clipStart + i * wordDuration,
        end: clipStart + (i + 1) * wordDuration,
        lineBreak: lineBreakAfter.has(i),
      });
    }
  }

  // Calculate alignment based on position
  // ASS alignment: 1=bottom-left, 2=bottom-center, 3=bottom-right
  //                4=mid-left, 5=mid-center, 6=mid-right
  //                7=top-left, 8=top-center, 9=top-right
  let alignment = 5; // default center
  if (typeof yPercent === "number") {
    if (yPercent < 0.33) alignment = 8; // top
    else if (yPercent > 0.66) alignment = 2; // bottom
    else alignment = 5; // middle
  }

  // Calculate margins for positioning
  let marginV = 20;
  if (typeof yPercent === "number") {
    // Convert percentage to margin from edge
    if (yPercent < 0.5) {
      marginV = Math.round(yPercent * canvasHeight);
    } else {
      marginV = Math.round((1 - yPercent) * canvasHeight);
    }
  } else if (typeof y === "number") {
    marginV = y;
  }

  // Generate header
  let ass = generateASSHeader(canvasWidth, canvasHeight, "Karaoke");

  // Generate style
  ass += generateASSStyles([
    {
      name: "Karaoke",
      fontFamily,
      fontSize,
      primaryColor: fontColor,
      secondaryColor: highlightColor,
      outlineColor: borderColor || "#000000",
      outline: borderWidth,
      shadow: shadowColor ? 1 : 0,
      alignment,
      marginV,
      opacity,
    },
  ]);

  // Build karaoke text with \k tags
  // \k = instant color change, \kf = smooth fill (gradual highlight)
  // Duration is in centiseconds
  const karaokeTag = highlightStyle === "instant" ? "\\k" : "\\kf";
  let karaokeText = "";
  for (let i = 0; i < wordList.length; i++) {
    const word = wordList[i];
    const duration = Math.round((word.end - word.start) * 100); // centiseconds
    karaokeText += `{${karaokeTag}${duration}}${escapeASSText(word.text)}`;
    if (i < wordList.length - 1) {
      // Add line break or space after word
      karaokeText += word.lineBreak ? "\\N" : " ";
    }
  }

  // Generate dialogue
  ass += generateASSEvents([
    {
      start: clipStart,
      end: clipEnd,
      style: "Karaoke",
      text: karaokeText,
    },
  ]);

  return ass;
}

/**
 * Build ASS content for a regular subtitle clip (imported or defined)
 * @param {Object} clip - Subtitle clip
 * @param {number} canvasWidth - Video width
 * @param {number} canvasHeight - Video height
 * @returns {string} Complete ASS file content
 */
function buildSubtitleASS(clip, canvasWidth, canvasHeight) {
  const {
    text = "",
    position: clipStart,
    end: clipEnd,
    fontFamily = "Arial",
    fontSize = 48,
    fontColor = "#FFFFFF",
    borderColor = "#000000",
    borderWidth = 2,
    yPercent,
    opacity = 1,
  } = clip;

  let alignment = 2; // bottom center default for subtitles
  let marginV = 20;

  if (typeof yPercent === "number") {
    if (yPercent < 0.33) {
      alignment = 8;
      marginV = Math.round(yPercent * canvasHeight);
    } else if (yPercent > 0.66) {
      alignment = 2;
      marginV = Math.round((1 - yPercent) * canvasHeight);
    } else {
      alignment = 5;
      marginV = 20;
    }
  }

  let ass = generateASSHeader(canvasWidth, canvasHeight, "Subtitles");

  ass += generateASSStyles([
    {
      name: "Default",
      fontFamily,
      fontSize,
      primaryColor: fontColor,
      outlineColor: borderColor,
      outline: borderWidth,
      alignment,
      marginV,
      opacity,
    },
  ]);

  ass += generateASSEvents([
    {
      start: clipStart,
      end: clipEnd,
      style: "Default",
      text: escapeASSText(text),
    },
  ]);

  return ass;
}

/**
 * Parse SRT content and convert to ASS dialogue events
 * @param {string} srtContent - Raw SRT file content
 * @returns {Array} Array of dialogue objects
 */
function parseSRT(srtContent) {
  const dialogues = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    // Find the timestamp line (format: 00:00:00,000 --> 00:00:00,000)
    let timestampLine = null;
    let textStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timestampLine = lines[i];
        textStartIndex = i + 1;
        break;
      }
    }

    if (!timestampLine) continue;

    const match = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (!match) continue;

    const start =
      parseInt(match[1]) * 3600 +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 1000;

    const end =
      parseInt(match[5]) * 3600 +
      parseInt(match[6]) * 60 +
      parseInt(match[7]) +
      parseInt(match[8]) / 1000;

    const text = lines
      .slice(textStartIndex)
      .join("\\N")
      .replace(/<[^>]+>/g, ""); // Strip HTML tags

    if (text.trim()) {
      dialogues.push({
        start,
        end,
        style: "Default",
        text: escapeASSText(text),
      });
    }
  }

  return dialogues;
}

/**
 * Parse VTT content and convert to ASS dialogue events
 * @param {string} vttContent - Raw VTT file content
 * @returns {Array} Array of dialogue objects
 */
function parseVTT(vttContent) {
  const dialogues = [];
  // Remove WEBVTT header and split into cues
  const content = vttContent.replace(/^WEBVTT.*?\n\n/s, "");
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    // Find timestamp line
    let timestampLine = null;
    let textStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timestampLine = lines[i];
        textStartIndex = i + 1;
        break;
      }
    }

    if (!timestampLine) continue;

    // VTT format: 00:00:00.000 --> 00:00:00.000
    const match = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );

    if (!match) {
      // Try shorter format: 00:00.000
      const shortMatch = timestampLine.match(
        /(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})/
      );
      if (shortMatch) {
        const start =
          parseInt(shortMatch[1]) * 60 +
          parseInt(shortMatch[2]) +
          parseInt(shortMatch[3]) / 1000;
        const end =
          parseInt(shortMatch[4]) * 60 +
          parseInt(shortMatch[5]) +
          parseInt(shortMatch[6]) / 1000;
        const text = lines
          .slice(textStartIndex)
          .join("\\N")
          .replace(/<[^>]+>/g, "");
        if (text.trim()) {
          dialogues.push({ start, end, style: "Default", text });
        }
      }
      continue;
    }

    const start =
      parseInt(match[1]) * 3600 +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 1000;

    const end =
      parseInt(match[5]) * 3600 +
      parseInt(match[6]) * 60 +
      parseInt(match[7]) +
      parseInt(match[8]) / 1000;

    const text = lines
      .slice(textStartIndex)
      .join("\\N")
      .replace(/<[^>]+>/g, "");

    if (text.trim()) {
      dialogues.push({
        start,
        end,
        style: "Default",
        text: escapeASSText(text),
      });
    }
  }

  return dialogues;
}

/**
 * Load and convert a subtitle file to ASS format
 * @param {string} filePath - Path to subtitle file
 * @param {Object} options - Styling options
 * @param {number} canvasWidth - Video width
 * @param {number} canvasHeight - Video height
 * @returns {string} ASS content
 */
function loadSubtitleFile(filePath, options, canvasWidth, canvasHeight) {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, "utf-8");

  // If already ASS, return as-is (or could parse and restyle)
  if (ext === ".ass" || ext === ".ssa") {
    return content;
  }

  let dialogues = [];

  if (ext === ".srt") {
    dialogues = parseSRT(content);
  } else if (ext === ".vtt") {
    dialogues = parseVTT(content);
  } else {
    throw new Error(`Unsupported subtitle format: ${ext}`);
  }

  // Apply time offset if specified
  if (typeof options.position === "number" && options.position !== 0) {
    const offset = options.position;
    dialogues = dialogues.map((d) => ({
      ...d,
      start: d.start + offset,
      end: d.end + offset,
    }));
  }

  // Generate ASS with styling
  let ass = generateASSHeader(canvasWidth, canvasHeight, "Imported Subtitles");

  ass += generateASSStyles([
    {
      name: "Default",
      fontFamily: options.fontFamily || "Arial",
      fontSize: options.fontSize || 48,
      primaryColor: options.fontColor || "#FFFFFF",
      outlineColor: options.borderColor || "#000000",
      outline: options.borderWidth || 2,
      alignment: 2, // bottom center
      marginV: 30,
      opacity: options.opacity || 1,
    },
  ]);

  ass += generateASSEvents(dialogues);

  return ass;
}

/**
 * Build the FFmpeg filter string for ASS subtitles
 * @param {string} assFilePath - Path to the ASS file
 * @param {string} inputLabel - Current video stream label
 * @returns {{ filter: string, finalLabel: string }}
 */
function buildASSFilter(assFilePath, inputLabel) {
  // Escape path for FFmpeg filter
  const escapedPath = assFilePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "'\\''");

  const outputLabel = "[outass]";
  const filter = `${inputLabel}ass='${escapedPath}'${outputLabel}`;

  return {
    filter,
    finalLabel: outputLabel,
  };
}

/**
 * Validate subtitle clip configuration
 * @param {Object} clip - Subtitle clip
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSubtitleClip(clip) {
  const errors = [];

  if (clip.type === "subtitle") {
    if (!clip.url || typeof clip.url !== "string") {
      errors.push("subtitle clip requires a 'url' path to the subtitle file");
    } else {
      const ext = path.extname(clip.url).toLowerCase();
      if (![".srt", ".ass", ".ssa", ".vtt"].includes(ext)) {
        errors.push(
          `Unsupported subtitle format '${ext}'. Supported: .srt, .ass, .ssa, .vtt`
        );
      }
    }
  }

  if (clip.type === "text" && clip.mode === "karaoke") {
    if (!clip.text || typeof clip.text !== "string" || !clip.text.trim()) {
      errors.push("karaoke mode requires 'text' to be specified");
    }
    if (typeof clip.position !== "number") {
      errors.push("karaoke mode requires 'position' (start time)");
    }
    if (typeof clip.end !== "number") {
      errors.push("karaoke mode requires 'end' time");
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  buildKaraokeASS,
  buildSubtitleASS,
  buildASSFilter,
  loadSubtitleFile,
  parseSRT,
  parseVTT,
  validateSubtitleClip,
  hexToASSColor,
  secondsToASSTime,
  escapeASSText,
  generateASSHeader,
  generateASSStyle,
  generateASSStyles,
  generateASSDialogue,
  generateASSEvents,
};
