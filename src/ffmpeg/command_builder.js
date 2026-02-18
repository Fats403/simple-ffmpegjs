const os = require("os");
const { escapeFilePath } = require("./strings");
const { SimpleffmpegError } = require("../core/errors");

/**
 * Get the null device path for the current platform
 * @returns {string} '/dev/null' on Unix, 'NUL' on Windows
 */
function getNullDevice() {
  return os.platform() === "win32" ? "NUL" : "/dev/null";
}

/**
 * Build the main FFmpeg export command
 */
function buildMainCommand({
  inputs,
  filterComplex,
  mapVideo,
  mapAudio,
  hasVideo,
  hasAudio,
  // Video encoding
  videoCodec,
  videoPreset,
  videoCrf,
  videoBitrate,
  // Audio encoding
  audioCodec,
  audioBitrate,
  audioSampleRate,
  // Options
  shortest,
  faststart,
  outputPath,
  // New options
  hwaccel,
  audioOnly,
  metadata,
  twoPass,
  passNumber, // 1 or 2 for two-pass encoding
  passLogFile,
}) {
  let cmd = "ffmpeg -y ";

  // Hardware acceleration (input side)
  if (hwaccel && hwaccel !== "none") {
    if (hwaccel === "auto") {
      cmd += "-hwaccel auto ";
    } else if (hwaccel === "videotoolbox") {
      cmd += "-hwaccel videotoolbox ";
    } else if (hwaccel === "nvenc") {
      cmd += "-hwaccel cuda ";
    } else if (hwaccel === "vaapi") {
      cmd += "-hwaccel vaapi -hwaccel_output_format vaapi ";
    } else if (hwaccel === "qsv") {
      cmd += "-hwaccel qsv ";
    }
  }

  // Inputs
  cmd += `${inputs} `;

  // Filter complex (skip for audio-only with no video filters)
  if (filterComplex && filterComplex.trim()) {
    cmd += `-filter_complex "${filterComplex}" `;
  }

  // Map streams
  if (!audioOnly) {
    if (hasVideo && mapVideo) cmd += `-map "${mapVideo}" `;
  }
  if (hasAudio && mapAudio) cmd += `-map "${mapAudio}" `;

  // Video encoding (skip for audio-only)
  if (hasVideo && !audioOnly) {
    cmd += `-c:v ${videoCodec} `;

    // Cross-browser compatibility flags for libx264 (Firefox, Safari, older devices)
    if (videoCodec === "libx264") {
      cmd += `-profile:v main -pix_fmt yuv420p `;
    }

    // Preset (for software encoders)
    if (
      videoPreset &&
      !videoCodec.includes("nvenc") &&
      !videoCodec.includes("videotoolbox")
    ) {
      cmd += `-preset ${videoPreset} `;
    }

    // Two-pass encoding
    if (twoPass && passNumber) {
      cmd += `-pass ${passNumber} `;
      if (passLogFile) {
        cmd += `-passlogfile "${escapeFilePath(passLogFile)}" `;
      }
    }

    // Bitrate or CRF
    if (videoBitrate) {
      cmd += `-b:v ${videoBitrate} `;
      if (twoPass && passNumber === 1) {
        // First pass: skip output, just analyze
      }
    } else if (videoCrf !== null && videoCrf !== undefined) {
      // CRF mode (quality-based)
      if (videoCodec.includes("nvenc")) {
        cmd += `-cq ${videoCrf} `;
      } else if (videoCodec.includes("videotoolbox")) {
        cmd += `-q:v ${Math.round(videoCrf * 2)} `; // VT uses different scale
      } else {
        cmd += `-crf ${videoCrf} `;
      }
    }
  }

  // Audio encoding
  if (hasAudio) {
    cmd += `-c:a ${audioCodec} `;
    if (audioCodec !== "copy" && audioCodec !== "pcm_s16le") {
      cmd += `-b:a ${audioBitrate} `;
    }
    if (audioSampleRate && audioCodec !== "copy") {
      cmd += `-ar ${audioSampleRate} `;
    }
  }

  // For two-pass first pass, output to null
  if (twoPass && passNumber === 1) {
    cmd += `-f null ${getNullDevice()}`;
    return cmd;
  }

  // Options
  if (hasVideo && hasAudio && shortest && !audioOnly) {
    cmd += "-shortest ";
  }

  // Faststart for MP4 (streaming-friendly)
  if (faststart && outputPath.endsWith(".mp4")) {
    cmd += "-movflags +faststart ";
  }

  // Metadata
  if (metadata) {
    if (metadata.title)
      cmd += `-metadata title="${escapeMetadata(metadata.title)}" `;
    if (metadata.artist)
      cmd += `-metadata artist="${escapeMetadata(metadata.artist)}" `;
    if (metadata.album)
      cmd += `-metadata album="${escapeMetadata(metadata.album)}" `;
    if (metadata.comment)
      cmd += `-metadata comment="${escapeMetadata(metadata.comment)}" `;
    if (metadata.date)
      cmd += `-metadata date="${escapeMetadata(metadata.date)}" `;
    if (metadata.genre)
      cmd += `-metadata genre="${escapeMetadata(metadata.genre)}" `;
    // Custom metadata
    if (metadata.custom && typeof metadata.custom === "object") {
      for (const [key, value] of Object.entries(metadata.custom)) {
        cmd += `-metadata ${key}="${escapeMetadata(String(value))}" `;
      }
    }
  }

  cmd += `"${escapeFilePath(outputPath)}"`;
  return cmd;
}

/**
 * Build command for text overlay batch passes
 */
function buildTextBatchCommand({
  inputPath,
  filterString,
  intermediateVideoCodec,
  intermediatePreset,
  intermediateCrf,
  outputPath,
}) {
  // Add compatibility flags for libx264
  const compatFlags =
    intermediateVideoCodec === "libx264"
      ? "-profile:v main -pix_fmt yuv420p "
      : "";
  return `ffmpeg -y -i "${escapeFilePath(
    inputPath
  )}" -filter_complex "[0:v]null[invid];${filterString}" -map "[outVideoAndText]" -map 0:a? -c:v ${intermediateVideoCodec} ${compatFlags}-preset ${intermediatePreset} -crf ${intermediateCrf} -c:a copy -movflags +faststart "${escapeFilePath(
    outputPath
  )}"`;
}

/**
 * Build command to generate a thumbnail
 */
function buildThumbnailCommand({ inputPath, outputPath, time, width, height }) {
  let cmd = `ffmpeg -y -ss ${time} -i "${escapeFilePath(
    inputPath
  )}" -vframes 1 `;

  if (width || height) {
    const w = width || -1;
    const h = height || -1;
    cmd += `-vf "scale=${w}:${h}" `;
  }

  cmd += `"${escapeFilePath(outputPath)}"`;
  return cmd;
}

/**
 * Build command to capture a single frame from a video file.
 * Output format is determined by the outputPath extension (jpg, png, webp, etc.).
 *
 * @param {Object} options
 * @param {string} options.inputPath - Path to source video
 * @param {string} options.outputPath - Output image path (extension determines format)
 * @param {number} [options.time=0] - Time in seconds to capture
 * @param {number} [options.width] - Output width (maintains aspect if height omitted)
 * @param {number} [options.height] - Output height (maintains aspect if width omitted)
 * @param {number} [options.quality] - JPEG quality 1-31, lower is better (only applies to JPEG)
 * @returns {string} FFmpeg command string
 */
function buildSnapshotCommand({
  inputPath,
  outputPath,
  time = 0,
  width,
  height,
  quality,
}) {
  let cmd = `ffmpeg -y -ss ${time} -i "${escapeFilePath(
    inputPath
  )}" -vframes 1 `;

  if (width || height) {
    const w = width || -1;
    const h = height || -1;
    cmd += `-vf "scale=${w}:${h}" `;
  }

  if (quality != null) {
    cmd += `-q:v ${quality} `;
  }

  cmd += `"${escapeFilePath(outputPath)}"`;
  return cmd;
}

/**
 * Escape metadata value for FFmpeg
 */
function escapeMetadata(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

/**
 * Sanitize a filter_complex string before passing it to FFmpeg.
 *
 * Guards against:
 *  - Trailing semicolons that create empty filter chains (some FFmpeg builds
 *    reject these with "No such filter: ''").
 *  - Double (or more) semicolons that produce empty chains between real ones.
 *  - Completely empty filter names between pad labels, e.g. "[a][b]" with no
 *    filter name — detected and surfaced as a descriptive error.
 */
function sanitizeFilterComplex(fc) {
  if (!fc || typeof fc !== "string") return fc;

  // Collapse runs of semicolons (;;; → ;) that would produce empty chains
  let sanitized = fc.replace(/;{2,}/g, ";");

  // Strip leading/trailing semicolons
  sanitized = sanitized.replace(/^;+/, "").replace(/;+$/, "");

  // Detect empty filter names: a closing ']' immediately followed by an
  // opening '[' with no filter name in between (at a chain boundary).
  // Valid patterns like "[a][b]xfade=..." have a filter name after the
  // second label. An empty name looks like "[a][b];" or "[a][b]," or
  // "[a];[b]" at the very start of a chain.
  //
  // We check for the pattern: ';' followed by optional whitespace then '['
  // where the preceding chain segment has no filter name.
  // Also check for label sequences with no filter: "][" not followed by an
  // alphanumeric filter name within the same chain segment.
  const chains = sanitized.split(";");
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i].trim();
    if (!chain) continue;

    // Remove all pad labels to see if there's an actual filter name left
    const withoutLabels = chain.replace(/\[[^\]]*\]/g, "").trim();
    // After removing labels, what's left should start with a filter name
    // (alphabetic). If it's empty or starts with ',' or '=' that means
    // a filter name is missing.
    if (withoutLabels.length === 0) {
      throw new SimpleffmpegError(
        `Empty filter name detected in filter_complex chain segment ${i}: "${chain}". ` +
        `This usually means an effect or transition is not producing a valid FFmpeg filter. ` +
        `Full filter_complex (truncated): "${sanitized.slice(0, 500)}..."`
      );
    }
  }

  return sanitized;
}

/**
 * Build FFmpeg command to extract keyframes from a video.
 *
 * Supports two modes:
 * - "scene-change": uses select='gt(scene,N)' to detect visual transitions
 * - "interval": uses fps=1/N to sample at fixed time intervals
 */
function buildKeyframeCommand({
  inputPath,
  outputPattern,
  mode,
  sceneThreshold,
  intervalSeconds,
  maxFrames,
  width,
  height,
  quality,
}) {
  let cmd = `ffmpeg -y -i "${escapeFilePath(inputPath)}"`;

  const filters = [];

  if (mode === "scene-change") {
    filters.push(`select='gt(scene,${sceneThreshold})'`);
  } else {
    filters.push(`fps=1/${intervalSeconds}`);
  }

  if (width || height) {
    const w = width || -1;
    const h = height || -1;
    filters.push(`scale=${w}:${h}`);
  }

  cmd += ` -vf "${filters.join(",")}"`;
  cmd += ` -vsync vfr`;

  if (maxFrames != null) {
    cmd += ` -frames:v ${maxFrames}`;
  }

  if (quality != null) {
    cmd += ` -q:v ${quality}`;
  }

  cmd += ` "${escapeFilePath(outputPattern)}"`;
  return cmd;
}

module.exports = {
  buildMainCommand,
  buildTextBatchCommand,
  buildThumbnailCommand,
  buildSnapshotCommand,
  buildKeyframeCommand,
  escapeMetadata,
  sanitizeFilterComplex,
};
