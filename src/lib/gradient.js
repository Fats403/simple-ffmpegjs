/**
 * Pure Node.js gradient image generator.
 *
 * Produces PPM (P6) format images — the simplest binary image format.
 * FFmpeg reads PPM natively on all versions, so no external dependencies
 * are needed.
 *
 * Supports:
 *   - Linear gradients (vertical, horizontal, or arbitrary angle)
 *   - Radial gradients (center → edge)
 *   - Multi-color stop support (2+ colors, evenly distributed)
 */

// ── Named color → RGB lookup ────────────────────────────────────────────────
// Subset of X11/CSS colors that FFmpeg accepts. This list mirrors the
// FFMPEG_NAMED_COLORS set in validation.js but maps to RGB values.
const NAMED_COLORS = {
  aliceblue: [240, 248, 255], antiquewhite: [250, 235, 215], aqua: [0, 255, 255],
  aquamarine: [127, 255, 212], azure: [240, 255, 255], beige: [245, 245, 220],
  bisque: [255, 228, 196], black: [0, 0, 0], blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255], blueviolet: [138, 43, 226], brown: [165, 42, 42],
  burlywood: [222, 184, 135], cadetblue: [95, 158, 160], chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30], coral: [255, 127, 80], cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220], crimson: [220, 20, 60], cyan: [0, 255, 255],
  darkblue: [0, 0, 139], darkcyan: [0, 139, 139], darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169], darkgreen: [0, 100, 0], darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107], darkmagenta: [139, 0, 139], darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0], darkorchid: [153, 50, 204], darkred: [139, 0, 0],
  darksalmon: [233, 150, 122], darkseagreen: [143, 188, 143], darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79], darkslategrey: [47, 79, 79], darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211], deeppink: [255, 20, 147], deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105], dimgrey: [105, 105, 105], dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34], floralwhite: [255, 250, 240], forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255], gainsboro: [220, 220, 220], ghostwhite: [248, 248, 255],
  gold: [255, 215, 0], goldenrod: [218, 165, 32], gray: [128, 128, 128],
  green: [0, 128, 0], greenyellow: [173, 255, 47], grey: [128, 128, 128],
  honeydew: [240, 255, 240], hotpink: [255, 105, 180], indianred: [205, 92, 92],
  indigo: [75, 0, 130], ivory: [255, 255, 240], khaki: [240, 230, 140],
  lavender: [230, 230, 250], lavenderblush: [255, 240, 245], lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205], lightblue: [173, 216, 230], lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255], lightgoldenrodyellow: [250, 250, 210],
  lightgray: [211, 211, 211], lightgreen: [144, 238, 144], lightgrey: [211, 211, 211],
  lightpink: [255, 182, 193], lightsalmon: [255, 160, 122], lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250], lightslategray: [119, 136, 153],
  lightslategrey: [119, 136, 153], lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224], lime: [0, 255, 0], limegreen: [50, 205, 50],
  linen: [250, 240, 230], magenta: [255, 0, 255], maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170], mediumblue: [0, 0, 205],
  mediumorchid: [186, 85, 211], mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113], mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154], mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133], midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250], mistyrose: [255, 228, 225], moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173], navy: [0, 0, 128], oldlace: [253, 245, 230],
  olive: [128, 128, 0], olivedrab: [107, 142, 35], orange: [255, 165, 0],
  orangered: [255, 69, 0], orchid: [218, 112, 214], palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152], paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147], papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185], peru: [205, 133, 63], pink: [255, 192, 203],
  plum: [221, 160, 221], powderblue: [176, 224, 230], purple: [128, 0, 128],
  red: [255, 0, 0], rosybrown: [188, 143, 143], royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19], salmon: [250, 128, 114], sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87], seashell: [255, 245, 238], sienna: [160, 82, 45],
  silver: [192, 192, 192], skyblue: [135, 206, 235], slateblue: [106, 90, 205],
  slategray: [112, 128, 144], slategrey: [112, 128, 144], snow: [255, 250, 250],
  springgreen: [0, 255, 127], steelblue: [70, 130, 180], tan: [210, 180, 140],
  teal: [0, 128, 128], thistle: [216, 191, 216], tomato: [255, 99, 71],
  turquoise: [64, 224, 208], violet: [238, 130, 238], wheat: [245, 222, 179],
  white: [255, 255, 255], whitesmoke: [245, 245, 245], yellow: [255, 255, 0],
  yellowgreen: [154, 205, 50],
};

/**
 * Parse a color string to [r, g, b] (0-255 each).
 *
 * Accepted formats:
 *   - Named colors: "black", "navy", "red", …
 *   - Hex: "#RGB", "#RRGGBB"
 *   - 0x hex: "0xRRGGBB"
 *
 * @param {string} str - Color string
 * @returns {number[]} [r, g, b]
 */
function parseColor(str) {
  if (typeof str !== "string" || str.length === 0) {
    return [0, 0, 0]; // fallback to black
  }

  // Strip @alpha suffix if present (e.g. "white@0.5")
  const atIdx = str.indexOf("@");
  const color = atIdx > 0 ? str.slice(0, atIdx) : str;

  // Named color
  const named = NAMED_COLORS[color.toLowerCase()];
  if (named) return [...named];

  // #RGB → #RRGGBB
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = parseInt(color[1] + color[1], 16);
    const g = parseInt(color[2] + color[2], 16);
    const b = parseInt(color[3] + color[3], 16);
    return [r, g, b];
  }

  // #RRGGBB or #RRGGBBAA
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return [r, g, b];
  }

  // 0xRRGGBB or 0xRRGGBBAA
  if (/^0x[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) {
    const r = parseInt(color.slice(2, 4), 16);
    const g = parseInt(color.slice(4, 6), 16);
    const b = parseInt(color.slice(6, 8), 16);
    return [r, g, b];
  }

  return [0, 0, 0]; // fallback
}

/**
 * Interpolate between an array of colors at position t (0–1).
 * Colors are evenly distributed across the 0–1 range.
 *
 * @param {number[][]} colors - Array of [r,g,b] colors
 * @param {number} t - Position in gradient (0 = first color, 1 = last color)
 * @returns {number[]} [r, g, b]
 */
function interpolateColors(colors, t) {
  if (colors.length === 1) return colors[0];

  const clamped = Math.max(0, Math.min(1, t));
  const segments = colors.length - 1;
  const segFloat = clamped * segments;
  const segIdx = Math.min(Math.floor(segFloat), segments - 1);
  const segT = segFloat - segIdx;

  const c0 = colors[segIdx];
  const c1 = colors[segIdx + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * segT),
    Math.round(c0[1] + (c1[1] - c0[1]) * segT),
    Math.round(c0[2] + (c1[2] - c0[2]) * segT),
  ];
}

/**
 * Generate a linear gradient PPM image buffer.
 *
 * @param {number} width
 * @param {number} height
 * @param {number[][]} colors - Parsed [r,g,b] color stops
 * @param {string|number} direction - "vertical", "horizontal", or angle in degrees
 * @returns {Buffer}
 */
function generateLinearGradient(width, height, colors, direction) {
  const pixels = Buffer.alloc(width * height * 3);

  // Compute unit direction vector from direction spec
  let dx = 0;
  let dy = 1; // default: vertical (top to bottom)
  if (direction === "horizontal") {
    dx = 1;
    dy = 0;
  } else if (direction === "vertical") {
    dx = 0;
    dy = 1;
  } else if (typeof direction === "number") {
    const rad = (direction * Math.PI) / 180;
    dx = Math.cos(rad);
    dy = Math.sin(rad);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Project pixel onto gradient axis (normalized 0–1)
      const nx = width > 1 ? x / (width - 1) : 0.5;
      const ny = height > 1 ? y / (height - 1) : 0.5;
      const t = nx * dx + ny * dy;

      const [r, g, b] = interpolateColors(colors, t);
      const idx = (y * width + x) * 3;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }

  return pixels;
}

/**
 * Generate a radial gradient PPM image buffer.
 *
 * @param {number} width
 * @param {number} height
 * @param {number[][]} colors - Parsed [r,g,b] color stops (center → edge)
 * @returns {Buffer}
 */
function generateRadialGradient(width, height, colors) {
  const pixels = Buffer.alloc(width * height * 3);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  // Max distance from center to any corner
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      const t = dist / maxDist;

      const [r, g, b] = interpolateColors(colors, t);
      const idx = (y * width + x) * 3;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }

  return pixels;
}

/**
 * Generate a gradient image as a PPM (P6) buffer.
 *
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} colorSpec - Gradient specification
 * @param {string} colorSpec.type - "linear-gradient" or "radial-gradient"
 * @param {string[]} colorSpec.colors - Array of color strings (2+ colors)
 * @param {string|number} [colorSpec.direction] - For linear: "vertical", "horizontal", or angle in degrees (default: "vertical")
 * @returns {Buffer} PPM image buffer ready to write to disk
 */
function generateGradientPPM(width, height, colorSpec) {
  const parsedColors = colorSpec.colors.map(parseColor);

  let pixels;
  if (colorSpec.type === "radial-gradient") {
    pixels = generateRadialGradient(width, height, parsedColors);
  } else {
    // linear-gradient (default)
    const direction = colorSpec.direction || "vertical";
    pixels = generateLinearGradient(width, height, parsedColors, direction);
  }

  const header = Buffer.from(`P6\n${width} ${height}\n255\n`);
  return Buffer.concat([header, pixels]);
}

module.exports = {
  generateGradientPPM,
  parseColor,
  interpolateColors,
};
