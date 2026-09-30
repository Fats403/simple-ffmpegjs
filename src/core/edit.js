const path = require("path");
const { SimpleffmpegError, TranscodeError } = require("./errors");
const { runHardened } = require("./run");
const {
  ENCODE_INPUT_FLAGS,
  webVideoChain,
  buildWebMp4OutputArgs,
  isWebSafeMp4,
  DEFAULT_MAX_OUTPUT_BYTES,
} = require("./transcode");
const {
  prepareInput,
  prepareOutputPath,
  spliceAudio,
  buildAtempoChain,
  AUDIO_OUTPUT_EXTENSIONS,
} = require("./audio");

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_THREADS = 2;

/**
 * Media edit operations: the everyday changes to a single file (trim,
 * speed, reverse, GIF, crop, rotate, mute) as one call each.
 *
 * Every operation writes a NEW file and leaves the input alone. Video
 * output is always the same web-safe mp4 the web-mp4 preset produces
 * (h264 high/4.1 yuv420p, even dimensions, SDR retag, AAC, +faststart),
 * and every run goes through the hardened runner: no shell, SIGKILL
 * timeout, AbortSignal, output size cap, partial-output cleanup.
 *
 * Rotated phone video is handled by ffmpeg's autorotate before any filter
 * runs, so crop coordinates and rotations are relative to the picture as
 * it is displayed, not as it is stored.
 */

/** Reverse holds every decoded frame in memory; this bounds it by default. */
const DEFAULT_REVERSE_MAX_MEMORY_BYTES = 1024 * 1024 * 1024;

/** GIFs past this length are huge and rarely what anyone wants. */
const DEFAULT_GIF_MAX_DURATION_SEC = 30;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isPosInt = (v) => Number.isInteger(v) && v > 0;
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

/** The picture's size as displayed: 90° and 270° rotations swap the sides. */
function displayedSize(info) {
  const w = info?.width;
  const h = info?.height;
  if (!isPosInt(w) || !isPosInt(h)) return null;
  const quarterTurn = Math.abs(Number(info.rotation) || 0) % 180 === 90;
  return quarterTurn ? { width: h, height: w } : { width: w, height: h };
}

/** The encode options every operation shares, checked before ffmpeg sees them. */
function validateEncodeOptions(options, label) {
  const posNum = (v) => isNum(v) && v > 0;
  if (options.timeoutMs != null && !posNum(options.timeoutMs)) {
    throw new SimpleffmpegError(`${label} options.timeoutMs must be a positive finite number`);
  }
  if (options.maxOutputBytes != null && !posNum(options.maxOutputBytes)) {
    throw new SimpleffmpegError(`${label} options.maxOutputBytes must be a positive finite number`);
  }
  if (options.threads != null && !isPosInt(options.threads)) {
    throw new SimpleffmpegError(`${label} options.threads must be a positive integer`);
  }
  if (
    options.crf != null &&
    (!Number.isInteger(options.crf) || options.crf < 0 || options.crf > 51)
  ) {
    throw new SimpleffmpegError(`${label} options.crf must be an integer in [0, 51]`);
  }
}

/**
 * Input and output checks for an operation that writes an mp4: a real
 * video stream (not an MP3's cover art) and an output ending in .mp4.
 */
async function prepareVideoOp(inputPath, options, label) {
  if (!options || typeof options !== "object") {
    throw new SimpleffmpegError(`${label} requires an options object`);
  }
  validateEncodeOptions(options, label);
  const resolvedOutput = prepareOutputPath(options, label);
  if (path.extname(resolvedOutput).toLowerCase() !== ".mp4") {
    throw new SimpleffmpegError(
      `${label} writes a web-safe mp4 — options.outputPath must end in .mp4`,
    );
  }
  const { resolvedInput, info } = await prepareInput(inputPath, options, label);
  if (!info.hasVideo || info.attachedPic) {
    throw new TranscodeError(
      `${label} input "${inputPath}" has no playable video stream${info.attachedPic ? " (its only video stream is embedded cover art)" : ""}`,
      { code: "NO_VIDEO_STREAM" },
    );
  }
  return { resolvedInput, resolvedOutput, info };
}

function requireDuration(info, inputPath, label) {
  if (!isNum(info.duration) || info.duration <= 0) {
    throw new TranscodeError(
      `${label} could not determine the duration of "${inputPath}"`,
      { code: "ANALYSIS_FAILED" },
    );
  }
  return info.duration;
}

/** Run a re-encode that writes the standard web-safe mp4. */
function runVideoEncode({
  label,
  inputArgs,
  mapAudio,
  videoFilter,
  audioFilter,
  resolvedOutput,
  options,
  totalDuration,
}) {
  const argv = [
    ...ENCODE_INPUT_FLAGS,
    ...inputArgs,
    "-map",
    "0:v:0",
    ...(mapAudio ? ["-map", "0:a:0"] : []),
    "-vf",
    videoFilter,
    ...(mapAudio && audioFilter ? ["-af", audioFilter] : []),
    ...buildWebMp4OutputArgs({
      outputPath: resolvedOutput,
      withAudio: mapAudio,
      crf: options.crf,
      maxOutputBytes: options.maxOutputBytes,
      threads: options.threads,
    }),
  ];
  return runHardened({
    argv,
    label,
    outputPath: resolvedOutput,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    onProgress: options.onProgress,
    totalDuration,
  });
}

/**
 * Keep [start, end] of a file. See SIMPLEFFMPEG.trim for full option docs.
 */
async function trim(inputPath, options = {}) {
  const label = "trim()";
  if (!options || typeof options !== "object") {
    throw new SimpleffmpegError(`${label} requires an options object`);
  }
  const { start, end } = options;
  if (!isNum(start) || start < 0) {
    throw new SimpleffmpegError(
      `${label} options.start must be a non-negative number of seconds`,
    );
  }
  if (!isNum(end) || end <= start) {
    throw new SimpleffmpegError(
      `${label} options.end must be a number of seconds after options.start`,
    );
  }

  // An audio output trims the sound only (from an audio file or a video's
  // soundtrack), with spliceAudio's micro-fades so the cuts never click.
  const outExt = path.extname(String(options.outputPath ?? "")).toLowerCase();
  if (AUDIO_OUTPUT_EXTENSIONS.includes(outExt)) {
    return spliceAudio(inputPath, {
      outputPath: options.outputPath,
      segments: [{ start, end }],
      fadeMs: options.fadeMs,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      onProgress: options.onProgress,
      threads: options.threads,
    });
  }

  const { resolvedInput, resolvedOutput, info } = await prepareVideoOp(
    inputPath,
    options,
    label,
  );
  const duration = requireDuration(info, inputPath, label);
  if (start >= duration) {
    throw new SimpleffmpegError(
      `${label} options.start (${start}s) is beyond the input duration (${duration}s)`,
    );
  }
  const length = Math.min(end, duration) - start;

  // -ss before -i seeks fast, and because the output is re-encoded the cut
  // is still frame-accurate (ffmpeg decodes and discards up to the point).
  await runVideoEncode({
    label,
    inputArgs: ["-ss", String(start), "-i", resolvedInput, "-t", String(length)],
    mapAudio: info.hasAudio,
    videoFilter: webVideoChain(),
    resolvedOutput,
    options,
    totalDuration: length,
  });
  return resolvedOutput;
}

/**
 * Speed a video (and its audio) up or down. Pitch is preserved.
 * See SIMPLEFFMPEG.changeSpeed for full option docs.
 */
async function changeSpeed(inputPath, options = {}) {
  const label = "changeSpeed()";
  const speed = options?.speed;
  if (!isNum(speed) || speed < 0.25 || speed > 4) {
    throw new SimpleffmpegError(
      `${label} options.speed must be a number within [0.25, 4] (got ${speed})`,
    );
  }
  const { resolvedInput, resolvedOutput, info } = await prepareVideoOp(
    inputPath,
    options,
    label,
  );
  const duration = isNum(info.duration) ? info.duration : 0;

  await runVideoEncode({
    label,
    inputArgs: ["-i", resolvedInput],
    mapAudio: info.hasAudio,
    videoFilter: webVideoChain(`setpts=PTS/${speed}`),
    audioFilter: buildAtempoChain(speed).join(","),
    resolvedOutput,
    options,
    totalDuration: duration / speed,
  });
  return resolvedOutput;
}

/**
 * Bytes the reverse filter would hold for a clip: every decoded yuv420p
 * frame (1.5 bytes a pixel). Pure. Null when the size or length is unknown.
 */
function reverseMemoryEstimate(info) {
  const size = displayedSize(info);
  if (!size || !isNum(info.duration) || info.duration <= 0) return null;
  const fps = isNum(info.fps) && info.fps > 0 ? info.fps : 30;
  return Math.ceil(size.width * size.height * 1.5 * fps * info.duration);
}

/**
 * Play a video backwards. See SIMPLEFFMPEG.reverse for full option docs.
 */
async function reverse(inputPath, options = {}) {
  const label = "reverse()";
  const maxMemoryBytes =
    options?.maxMemoryBytes ?? DEFAULT_REVERSE_MAX_MEMORY_BYTES;
  if (!isNum(maxMemoryBytes) || maxMemoryBytes <= 0) {
    throw new SimpleffmpegError(
      `${label} options.maxMemoryBytes must be a positive number`,
    );
  }
  const { resolvedInput, resolvedOutput, info } = await prepareVideoOp(
    inputPath,
    options,
    label,
  );
  const duration = requireDuration(info, inputPath, label);
  const estimate = reverseMemoryEstimate(info);
  if (estimate === null) {
    throw new TranscodeError(
      `${label} could not determine the size of "${inputPath}"`,
      { code: "ANALYSIS_FAILED" },
    );
  }
  if (estimate > maxMemoryBytes) {
    const size = displayedSize(info);
    const maxSec = Math.floor((duration * maxMemoryBytes) / estimate);
    throw new TranscodeError(
      `${label} "${inputPath}" is ${duration}s at ${size.width}x${size.height}. Reversing holds every frame in memory, so the limit at this size is about ${maxSec}s — trim it first, or raise options.maxMemoryBytes`,
      { code: "INPUT_TOO_LONG" },
    );
  }

  await runVideoEncode({
    label,
    inputArgs: ["-i", resolvedInput],
    mapAudio: info.hasAudio,
    videoFilter: webVideoChain("reverse"),
    audioFilter: "areverse",
    resolvedOutput,
    options,
    totalDuration: duration,
  });
  return resolvedOutput;
}

/**
 * The single-graph GIF filter: a palette built from the clip itself, so a
 * GIF keeps its colours instead of the default 256-colour dither. Pure.
 */
function buildGifFilter({ fps, width }) {
  return (
    `[0:v]fps=${fps},scale='min(${width},iw)':-1:flags=lanczos,split[a][b];` +
    `[a]palettegen=stats_mode=diff[p];` +
    `[b][p]paletteuse=dither=bayer:bayer_scale=5[out]`
  );
}

/**
 * Make an animated GIF from a video segment. See SIMPLEFFMPEG.toGif.
 */
async function toGif(inputPath, options = {}) {
  const label = "toGif()";
  if (!options || typeof options !== "object") {
    throw new SimpleffmpegError(`${label} requires an options object`);
  }
  validateEncodeOptions(options, label);
  const resolvedOutput = prepareOutputPath(options, label);
  if (path.extname(resolvedOutput).toLowerCase() !== ".gif") {
    throw new SimpleffmpegError(`${label} options.outputPath must end in .gif`);
  }
  const start = options.start ?? 0;
  const fps = options.fps ?? 12;
  const width = options.width ?? 480;
  const maxDurationSec = options.maxDurationSec ?? DEFAULT_GIF_MAX_DURATION_SEC;
  if (!isNum(start) || start < 0) {
    throw new SimpleffmpegError(
      `${label} options.start must be a non-negative number of seconds`,
    );
  }
  if (!isNum(fps) || fps <= 0 || fps > 50) {
    throw new SimpleffmpegError(`${label} options.fps must be within (0, 50]`);
  }
  if (!isPosInt(width)) {
    throw new SimpleffmpegError(`${label} options.width must be a positive integer`);
  }
  if (!isNum(maxDurationSec) || maxDurationSec <= 0) {
    throw new SimpleffmpegError(
      `${label} options.maxDurationSec must be a positive number of seconds`,
    );
  }
  if (options.duration != null && (!isNum(options.duration) || options.duration <= 0)) {
    throw new SimpleffmpegError(
      `${label} options.duration must be a positive number of seconds`,
    );
  }

  const { resolvedInput, info } = await prepareInput(inputPath, options, label);
  if (!info.hasVideo || info.attachedPic) {
    throw new TranscodeError(`${label} input "${inputPath}" has no playable video stream`, {
      code: "NO_VIDEO_STREAM",
    });
  }
  const total = requireDuration(info, inputPath, label);
  if (start >= total) {
    throw new SimpleffmpegError(
      `${label} options.start (${start}s) is beyond the input duration (${total}s)`,
    );
  }
  const length = Math.min(options.duration ?? total - start, total - start);
  if (length > maxDurationSec) {
    throw new TranscodeError(
      `${label} a ${+length.toFixed(3)}s GIF is past the ${maxDurationSec}s limit — pass a shorter options.duration, or raise options.maxDurationSec`,
      { code: "INPUT_TOO_LONG" },
    );
  }

  const argv = [
    ...ENCODE_INPUT_FLAGS,
    "-ss",
    String(start),
    "-t",
    String(length),
    "-i",
    resolvedInput,
    "-filter_complex",
    buildGifFilter({ fps, width }),
    "-map",
    "[out]",
    "-loop",
    "0",
    "-fs",
    String(options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES),
    "-threads",
    String(options.threads ?? DEFAULT_THREADS),
    resolvedOutput,
  ];
  await runHardened({
    argv,
    label,
    outputPath: resolvedOutput,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    onProgress: options.onProgress,
    totalDuration: length,
  });
  return resolvedOutput;
}

/**
 * Where a crop lands on the displayed picture. Centered unless x/y are
 * given; always inside the frame. Pure. Throws SimpleffmpegError when the
 * rectangle does not fit.
 */
function resolveCropRect({ width, height, x, y }, size, label = "crop()") {
  if (!isPosInt(width) || !isPosInt(height)) {
    throw new SimpleffmpegError(
      `${label} options.width and options.height must be positive integers`,
    );
  }
  if (x != null && !isNonNegInt(x)) {
    throw new SimpleffmpegError(`${label} options.x must be a non-negative integer`);
  }
  if (y != null && !isNonNegInt(y)) {
    throw new SimpleffmpegError(`${label} options.y must be a non-negative integer`);
  }
  const left = x ?? Math.floor((size.width - width) / 2);
  const top = y ?? Math.floor((size.height - height) / 2);
  if (width > size.width || height > size.height || left + width > size.width || top + height > size.height) {
    throw new SimpleffmpegError(
      `${label} a ${width}x${height} crop at (${left}, ${top}) does not fit the ${size.width}x${size.height} picture`,
    );
  }
  return { width, height, x: left, y: top };
}

/**
 * Crop a video to a rectangle. See SIMPLEFFMPEG.crop for full option docs.
 */
async function crop(inputPath, options = {}) {
  const label = "crop()";
  const { resolvedInput, resolvedOutput, info } = await prepareVideoOp(
    inputPath,
    options,
    label,
  );
  const size = displayedSize(info);
  if (!size) {
    throw new TranscodeError(
      `${label} could not determine the size of "${inputPath}"`,
      { code: "ANALYSIS_FAILED" },
    );
  }
  const rect = resolveCropRect(options, size, label);
  await runVideoEncode({
    label,
    inputArgs: ["-i", resolvedInput],
    mapAudio: info.hasAudio,
    videoFilter: webVideoChain(`crop=${rect.width}:${rect.height}:${rect.x}:${rect.y}`),
    resolvedOutput,
    options,
    totalDuration: isNum(info.duration) ? info.duration : 0,
  });
  return resolvedOutput;
}

/** The filter for a clockwise rotation in degrees. Pure. */
function rotateFilter(degrees) {
  const normalized = degrees === -90 ? 270 : degrees;
  switch (normalized) {
    case 90:
      return "transpose=1";
    case 180:
      return "hflip,vflip";
    case 270:
      return "transpose=2";
    default:
      throw new SimpleffmpegError(
        `rotate() options.degrees must be 90, 180, 270 or -90 (got ${degrees})`,
      );
  }
}

/**
 * Rotate a video clockwise. See SIMPLEFFMPEG.rotate for full option docs.
 */
async function rotate(inputPath, options = {}) {
  const label = "rotate()";
  const filter = rotateFilter(options?.degrees);
  const { resolvedInput, resolvedOutput, info } = await prepareVideoOp(
    inputPath,
    options,
    label,
  );
  await runVideoEncode({
    label,
    inputArgs: ["-i", resolvedInput],
    mapAudio: info.hasAudio,
    videoFilter: webVideoChain(filter),
    resolvedOutput,
    options,
    totalDuration: isNum(info.duration) ? info.duration : 0,
  });
  return resolvedOutput;
}

/**
 * Remove a video's sound. See SIMPLEFFMPEG.mute for full option docs.
 */
async function mute(inputPath, options = {}) {
  const label = "mute()";
  const { resolvedInput, resolvedOutput, info } = await prepareVideoOp(
    inputPath,
    options,
    label,
  );
  const totalDuration = isNum(info.duration) ? info.duration : 0;

  // Already web-safe: copy the picture untouched, which is lossless and
  // near-instant. Anything else goes through the standard re-encode.
  if (isWebSafeMp4(info)) {
    await runHardened({
      argv: [
        ...ENCODE_INPUT_FLAGS,
        "-i",
        resolvedInput,
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
        "-an",
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        "-fs",
        String(options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES),
        resolvedOutput,
      ],
      label,
      outputPath: resolvedOutput,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      signal: options.signal,
      onProgress: options.onProgress,
      totalDuration,
    });
    return resolvedOutput;
  }

  await runVideoEncode({
    label,
    inputArgs: ["-i", resolvedInput],
    mapAudio: false,
    videoFilter: webVideoChain(),
    resolvedOutput,
    options,
    totalDuration,
  });
  return resolvedOutput;
}

module.exports = {
  trim,
  changeSpeed,
  reverse,
  toGif,
  crop,
  rotate,
  mute,
  // Exported for unit tests — not part of the public API
  displayedSize,
  reverseMemoryEstimate,
  buildGifFilter,
  resolveCropRect,
  rotateFilter,
  DEFAULT_REVERSE_MAX_MEMORY_BYTES,
  DEFAULT_GIF_MAX_DURATION_SEC,
};
