const Strings = require("./strings");
const { isValidFFmpegColor } = require("../core/validation");

/**
 * Calculate position expressions for overlay/drawtext
 * @param {Object} config - Watermark config with position, margin
 * @param {number} canvasWidth - Video width
 * @param {number} canvasHeight - Video height
 * @param {boolean} isText - Whether this is for drawtext (uses different variables)
 * @returns {{ x: string, y: string }}
 */
function calculatePosition(config, canvasWidth, canvasHeight, isText = false) {
  const margin = typeof config.margin === "number" ? config.margin : 20;

  // Text uses 'tw'/'th' for text width/height, overlay uses 'w'/'h'
  const wVar = isText ? "tw" : "w";
  const hVar = isText ? "th" : "h";
  const W = isText ? canvasWidth : "W";
  const H = isText ? canvasHeight : "H";

  // Preset positions
  if (typeof config.position === "string") {
    const preset = config.position;
    if (preset === "top-left") {
      return { x: `${margin}`, y: `${margin}` };
    }
    if (preset === "top-right") {
      return { x: `${W}-${wVar}-${margin}`, y: `${margin}` };
    }
    if (preset === "bottom-left") {
      return { x: `${margin}`, y: `${H}-${hVar}-${margin}` };
    }
    if (preset === "bottom-right") {
      return { x: `${W}-${wVar}-${margin}`, y: `${H}-${hVar}-${margin}` };
    }
    if (preset === "center") {
      return { x: `(${W}-${wVar})/2`, y: `(${H}-${hVar})/2` };
    }
    // Default to bottom-right if unknown preset
    return { x: `${W}-${wVar}-${margin}`, y: `${H}-${hVar}-${margin}` };
  }

  // Custom positioning object
  if (typeof config.position === "object" && config.position !== null) {
    const pos = config.position;

    // Percentage-based positioning
    if (typeof pos.xPercent === "number" && typeof pos.yPercent === "number") {
      const xPos = pos.xPercent * canvasWidth;
      const yPos = pos.yPercent * canvasHeight;
      // Center the watermark on the position point
      return {
        x: `${xPos}-${wVar}/2`,
        y: `${yPos}-${hVar}/2`,
      };
    }

    // Pixel-based positioning
    if (typeof pos.x === "number" && typeof pos.y === "number") {
      return { x: `${pos.x}`, y: `${pos.y}` };
    }
  }

  // Default to bottom-right
  return { x: `${W}-${wVar}-${margin}`, y: `${H}-${hVar}-${margin}` };
}

/**
 * Build filter for image watermark
 * @param {Object} config - Watermark configuration
 * @param {string} videoLabel - Current video stream label (e.g., "[outVideoAndText]")
 * @param {number} watermarkInputIndex - FFmpeg input index for watermark image
 * @param {number} canvasWidth - Video width
 * @param {number} canvasHeight - Video height
 * @param {number} totalDuration - Total video duration for enable expression
 * @returns {{ filter: string, finalLabel: string }}
 */
function buildImageWatermark(
  config,
  videoLabel,
  watermarkInputIndex,
  canvasWidth,
  canvasHeight,
  totalDuration,
) {
  const scale = typeof config.scale === "number" ? config.scale : 0.15;
  const opacity = typeof config.opacity === "number" ? config.opacity : 1;
  const startTime = typeof config.startTime === "number" ? config.startTime : 0;
  const endTime =
    typeof config.endTime === "number" ? config.endTime : totalDuration;

  // Calculate scaled width based on percentage of video width
  const scaledWidth = Math.round(canvasWidth * scale);

  // Build scale and opacity filter for watermark input
  let wmFilter = `[${watermarkInputIndex}:v]`;
  wmFilter += `scale=${scaledWidth}:-1`; // Scale to width, maintain aspect ratio

  // Apply opacity if not fully opaque
  if (opacity < 1) {
    wmFilter += `,format=rgba,colorchannelmixer=aa=${opacity}`;
  }

  wmFilter += `[wm_scaled];`;

  // Calculate position
  const pos = calculatePosition(config, canvasWidth, canvasHeight, false);

  // Build overlay filter
  const enableExpr =
    startTime === 0 && endTime >= totalDuration
      ? "" // Always enabled
      : `:enable='between(t,${startTime},${endTime})'`;

  const overlayFilter = `${videoLabel}[wm_scaled]overlay=${pos.x}:${pos.y}${enableExpr}[outwm]`;

  return {
    filter: wmFilter + overlayFilter,
    finalLabel: "[outwm]",
  };
}

/**
 * Build filter for text watermark
 * @param {Object} config - Watermark configuration
 * @param {string} videoLabel - Current video stream label
 * @param {number} canvasWidth - Video width
 * @param {number} canvasHeight - Video height
 * @param {number} totalDuration - Total video duration for enable expression
 * @returns {{ filter: string, finalLabel: string }}
 */
function buildTextWatermark(
  config,
  videoLabel,
  canvasWidth,
  canvasHeight,
  totalDuration,
) {
  const text = config.text || "";
  const fontSize = typeof config.fontSize === "number" ? config.fontSize : 24;
  const fontColor = config.fontColor || "#FFFFFF";
  const fontFamily = config.fontFamily || "Sans";
  const opacity = typeof config.opacity === "number" ? config.opacity : 1;
  const startTime = typeof config.startTime === "number" ? config.startTime : 0;
  const endTime =
    typeof config.endTime === "number" ? config.endTime : totalDuration;

  // Escape text for drawtext
  const escapedText = Strings.escapeDrawtextText(text);

  const fontSpec = config.fontFile
    ? `fontfile='${Strings.escapeTextFilePath(config.fontFile)}'`
    : `font=${fontFamily}`;

  // Calculate position (for text)
  const pos = calculatePosition(config, canvasWidth, canvasHeight, true);

  // Build drawtext filter
  let params = `drawtext=text='${escapedText}':${fontSpec}`;
  params += `:fontsize=${fontSize}`;

  // Apply opacity to font color if needed
  if (opacity < 1) {
    // Check if color is hex format (#RGB, #RRGGBB, or 0xRRGGBB)
    const isHexColor = fontColor.startsWith("#") || fontColor.startsWith("0x");
    if (isHexColor) {
      // Convert opacity to hex alpha (0-255)
      const alphaHex = Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0");
      // Append alpha to hex color
      params += `:fontcolor=${fontColor}${alphaHex}`;
    } else {
      // Named color - use FFmpeg's @opacity syntax
      params += `:fontcolor=${fontColor}@${opacity}`;
    }
  } else {
    params += `:fontcolor=${fontColor}`;
  }

  params += `:x=${pos.x}:y=${pos.y}`;

  // Border/outline
  if (config.borderColor) {
    const borderColor = config.borderColor;
    // Apply same opacity to border if needed
    if (opacity < 1) {
      const isHexColor =
        borderColor.startsWith("#") || borderColor.startsWith("0x");
      if (isHexColor) {
        const alphaHex = Math.round(opacity * 255)
          .toString(16)
          .padStart(2, "0");
        params += `:bordercolor=${borderColor}${alphaHex}`;
      } else {
        // Named color - use FFmpeg's @opacity syntax
        params += `:bordercolor=${borderColor}@${opacity}`;
      }
    } else {
      params += `:bordercolor=${borderColor}`;
    }
  }
  if (typeof config.borderWidth === "number") {
    params += `:borderw=${config.borderWidth}`;
  }

  // Shadow
  if (config.shadowColor) {
    params += `:shadowcolor=${config.shadowColor}`;
    if (typeof config.shadowX === "number")
      params += `:shadowx=${config.shadowX}`;
    if (typeof config.shadowY === "number")
      params += `:shadowy=${config.shadowY}`;
  }

  // Enable expression for timing
  if (startTime !== 0 || endTime < totalDuration) {
    params += `:enable='between(t,${startTime},${endTime})'`;
  }

  // Remove the leading label bracket if present for proper filter syntax
  const inputLabel = videoLabel.startsWith("[")
    ? videoLabel
    : `[${videoLabel}]`;
  const filter = `${inputLabel}${params}[outwm]`;

  return {
    filter: filter,
    finalLabel: "[outwm]",
  };
}

/**
 * Build watermark filter based on config type
 * @param {Object} config - Watermark configuration
 * @param {string} videoLabel - Current video stream label
 * @param {number|null} watermarkInputIndex - FFmpeg input index for image watermark (null for text)
 * @param {number} canvasWidth - Video width
 * @param {number} canvasHeight - Video height
 * @param {number} totalDuration - Total video duration
 * @returns {{ filter: string, finalLabel: string, needsInput: boolean }}
 */
function buildWatermarkFilter(
  config,
  videoLabel,
  watermarkInputIndex,
  canvasWidth,
  canvasHeight,
  totalDuration,
) {
  if (!config || typeof config !== "object") {
    return { filter: "", finalLabel: videoLabel, needsInput: false };
  }

  const type = config.type || "image";

  if (type === "text") {
    const result = buildTextWatermark(
      config,
      videoLabel,
      canvasWidth,
      canvasHeight,
      totalDuration,
    );
    return { ...result, needsInput: false };
  }

  // Default to image watermark
  if (type === "image") {
    if (typeof watermarkInputIndex !== "number") {
      // No input index provided, can't build image watermark
      return { filter: "", finalLabel: videoLabel, needsInput: true };
    }
    const result = buildImageWatermark(
      config,
      videoLabel,
      watermarkInputIndex,
      canvasWidth,
      canvasHeight,
      totalDuration,
    );
    return { ...result, needsInput: true };
  }

  // Unknown type, return unchanged
  return { filter: "", finalLabel: videoLabel, needsInput: false };
}

/**
 * Validate watermark configuration
 * @param {Object} config - Watermark configuration
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateWatermarkConfig(config) {
  const errors = [];

  if (!config || typeof config !== "object") {
    return { valid: true, errors: [] }; // No watermark is valid
  }

  const type = config.type || "image";

  if (type !== "image" && type !== "text") {
    errors.push(`watermark.type must be 'image' or 'text', got '${type}'`);
  }

  if (type === "image") {
    if (typeof config.url !== "string" || config.url.length === 0) {
      errors.push("watermark.url is required for image watermarks");
    }
    if (
      typeof config.scale === "number" &&
      (config.scale <= 0 || config.scale > 1)
    ) {
      errors.push("watermark.scale must be between 0 and 1");
    }
  }

  if (type === "text") {
    if (typeof config.text !== "string" || config.text.length === 0) {
      errors.push("watermark.text is required for text watermarks");
    }
  }

  // Validate color properties
  const colorProps = ["fontColor", "borderColor", "shadowColor"];
  for (const prop of colorProps) {
    if (config[prop] != null && typeof config[prop] === "string") {
      if (!isValidFFmpegColor(config[prop])) {
        errors.push(
          `watermark.${prop} "${config[prop]}" is not a valid FFmpeg color. Use a named color (e.g. "white", "red"), hex (#RRGGBB), or color@alpha (e.g. "black@0.5").`
        );
      }
    }
  }

  // Common validations
  if (
    typeof config.opacity === "number" &&
    (config.opacity < 0 || config.opacity > 1)
  ) {
    errors.push("watermark.opacity must be between 0 and 1");
  }

  if (typeof config.margin === "number" && config.margin < 0) {
    errors.push("watermark.margin must be >= 0");
  }

  if (typeof config.startTime === "number" && config.startTime < 0) {
    errors.push("watermark.startTime must be >= 0");
  }

  if (
    typeof config.startTime === "number" &&
    typeof config.endTime === "number" &&
    config.endTime <= config.startTime
  ) {
    errors.push("watermark.endTime must be > startTime");
  }

  // Position validation
  if (typeof config.position === "string") {
    const validPositions = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "center",
    ];
    if (!validPositions.includes(config.position)) {
      errors.push(
        `watermark.position must be one of: ${validPositions.join(
          ", ",
        )}; got '${config.position}'`,
      );
    }
  } else if (typeof config.position === "object" && config.position !== null) {
    const pos = config.position;
    const hasPercent =
      typeof pos.xPercent === "number" || typeof pos.yPercent === "number";
    const hasPixel = typeof pos.x === "number" || typeof pos.y === "number";

    if (hasPercent && hasPixel) {
      errors.push("watermark.position cannot mix percentage and pixel values");
    }

    if (hasPercent) {
      if (
        typeof pos.xPercent !== "number" ||
        typeof pos.yPercent !== "number"
      ) {
        errors.push("watermark.position requires both xPercent and yPercent");
      }
    }

    if (hasPixel) {
      if (typeof pos.x !== "number" || typeof pos.y !== "number") {
        errors.push("watermark.position requires both x and y");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  buildWatermarkFilter,
  buildImageWatermark,
  buildTextWatermark,
  validateWatermarkConfig,
  calculatePosition,
};
