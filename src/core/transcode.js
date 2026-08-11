const fsPromises = require("fs").promises;
const path = require("path");
const { probeMedia } = require("./media_info");
const { SimpleffmpegError, TranscodeError } = require("./errors");
const { runHardened, parseProgressBlock } = require("./run");

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MAX_OUTPUT_BYTES = 500 * 1024 * 1024;
const DEFAULT_THREADS = 2;

const SUPPORTED_PRESETS = ["web-mp4", "web-audio"];

/** Options that only make sense for a video preset — rejected under web-audio. */
const VIDEO_ONLY_OPTIONS = ["crf", "videoBitrate", "scale"];

/**
 * Resolve a file path to absolute form and reject anything whose resolved
 * basename starts with "-" (which ffmpeg could misinterpret as a flag even
 * when passed via spawn's argv array).
 */
function validatePath(p, label) {
  if (typeof p !== "string" || p.length === 0) {
    throw new TranscodeError(
      `transcode() ${label} must be a non-empty string`,
      { code: "INVALID_PATH" },
    );
  }
  const resolved = path.resolve(p);
  if (path.basename(resolved).startsWith("-")) {
    throw new TranscodeError(
      `transcode() ${label} "${p}" has a basename starting with "-" which is reserved for ffmpeg flags`,
      { code: "INVALID_PATH" },
    );
  }
  return resolved;
}

/**
 * Validate caller-supplied option values. Rejects nonsense that would either
 * pass through to ffmpeg as NONZERO_EXIT (confusing) or produce surprising
 * wrapper behavior (e.g. negative timeoutMs fires setTimeout immediately).
 * Throws SimpleffmpegError for programmer-error cases — distinct from the
 * TranscodeError codes used for runtime/ffmpeg failures.
 */
function validateOptions(options) {
  const posNumber = (v) =>
    typeof v === "number" && Number.isFinite(v) && v > 0;
  const posInt = (v) => Number.isInteger(v) && v > 0;

  if (options.timeoutMs != null && !posNumber(options.timeoutMs)) {
    throw new SimpleffmpegError(
      "transcode() options.timeoutMs must be a positive finite number",
    );
  }
  if (options.maxOutputBytes != null && !posNumber(options.maxOutputBytes)) {
    throw new SimpleffmpegError(
      "transcode() options.maxOutputBytes must be a positive finite number",
    );
  }
  if (options.threads != null && !posInt(options.threads)) {
    throw new SimpleffmpegError(
      "transcode() options.threads must be a positive integer",
    );
  }
  if (
    options.crf != null &&
    (!Number.isInteger(options.crf) || options.crf < 0 || options.crf > 51)
  ) {
    throw new SimpleffmpegError(
      "transcode() options.crf must be an integer in [0, 51]",
    );
  }
  if (options.scale != null) {
    if (typeof options.scale !== "object" || Array.isArray(options.scale)) {
      throw new SimpleffmpegError(
        "transcode() options.scale must be a { width?, height? } object",
      );
    }
    for (const dim of ["width", "height"]) {
      const v = options.scale[dim];
      if (v != null && !posInt(v)) {
        throw new SimpleffmpegError(
          `transcode() options.scale.${dim} must be a positive integer`,
        );
      }
    }
  }
  if (
    options.audioBitrate != null &&
    (typeof options.audioBitrate !== "string" || options.audioBitrate.length === 0)
  ) {
    throw new SimpleffmpegError(
      "transcode() options.audioBitrate must be a non-empty string (e.g. \"192k\")",
    );
  }
  if (
    options.videoBitrate != null &&
    (typeof options.videoBitrate !== "string" || options.videoBitrate.length === 0)
  ) {
    throw new SimpleffmpegError(
      "transcode() options.videoBitrate must be a non-empty string (e.g. \"2M\")",
    );
  }
}

/**
 * Verify that the last element of customArgs resolves to the same absolute
 * path as options.outputPath. The hardening wrapper unlinks resolvedOutput on
 * failure; if customArgs writes elsewhere the cleanup targets the wrong file.
 * ffmpeg's convention is output-path-last, so this is the common case.
 */
function validateCustomArgsOutput(customArgs, resolvedOutput) {
  if (customArgs.length === 0) {
    throw new SimpleffmpegError(
      "transcode() options.customArgs must not be empty",
    );
  }
  const last = customArgs[customArgs.length - 1];
  if (typeof last !== "string" || path.resolve(last) !== resolvedOutput) {
    throw new SimpleffmpegError(
      "transcode() options.customArgs: the last element must be the output path and resolve to the same absolute path as options.outputPath (so partial-output cleanup targets the right file on failure)",
    );
  }
}

/**
 * Build the scale filter fragment for a user-supplied {width?, height?}.
 * Missing dimension uses -2 so ffmpeg preserves aspect ratio while keeping
 * the computed side even (required by libx264's yuv420p encoder).
 */
function buildScaleFilter(scale) {
  if (!scale) return null;
  const { width, height } = scale;
  if (width && height) return `scale=${width}:${height}`;
  if (width) return `scale=${width}:-2`;
  if (height) return `scale=-2:${height}`;
  return null;
}

/**
 * Build the argv array for the web-mp4 preset. Pure — no side effects.
 * Input and output paths must already be resolved to absolute.
 */
function buildWebMp4Args({
  inputPath,
  outputPath,
  crf,
  videoBitrate,
  audioBitrate,
  scale,
  maxOutputBytes,
  threads,
}) {
  const args = [
    "-nostdin",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "+discardcorrupt",
    "-err_detect",
    "ignore_err",
    "-progress",
    "pipe:1",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    String(crf ?? 23),
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    "-level",
    "4.1",
  ];

  // Compose vf: setparams first so HDR sources (bt2020/HLG/PQ) get retagged
  // as SDR bt709 in the libx264 VUI — output-level -colorspace/-color_primaries
  // flags get overridden by source side-data, but setparams reaches the
  // bitstream. Then user scale (if any), then even-dim trunc last so odd
  // inputs become libx264-safe regardless of what the user requested.
  const colorTag =
    "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709";
  const evenTrunc = "scale='trunc(iw/2)*2':'trunc(ih/2)*2'";
  const userScale = buildScaleFilter(scale);
  const vfChain = userScale
    ? `${colorTag},${userScale},${evenTrunc}`
    : `${colorTag},${evenTrunc}`;
  args.push("-vf", vfChain);

  if (videoBitrate) args.push("-b:v", String(videoBitrate));

  args.push(
    "-c:a",
    "aac",
    "-b:a",
    String(audioBitrate ?? "128k"),
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    "-fs",
    String(maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES),
    "-threads",
    String(threads ?? DEFAULT_THREADS),
    outputPath,
  );

  return args;
}

/**
 * Build the argv array for the web-audio preset: first audio stream only,
 * AAC in an MP4-family container (write to .m4a or .mp4), faststart for
 * progressive playback, source channel count preserved (a mono voiceover
 * stays mono). Pure — no side effects.
 */
function buildWebAudioArgs({
  inputPath,
  outputPath,
  audioBitrate,
  maxOutputBytes,
  threads,
}) {
  return [
    "-nostdin",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "+discardcorrupt",
    "-err_detect",
    "ignore_err",
    "-progress",
    "pipe:1",
    "-i",
    inputPath,
    "-vn",
    "-map",
    "0:a:0",
    "-c:a",
    "aac",
    "-b:a",
    String(audioBitrate ?? "128k"),
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    "-fs",
    String(maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES),
    "-threads",
    String(threads ?? DEFAULT_THREADS),
    outputPath,
  ];
}

/**
 * Predicate — is this MediaInfo already web-safe? Fast heuristic that lets
 * callers skip transcoding when the input is already h264/mp4/yuv420p.
 */
function isWebSafeMp4(info) {
  if (!info || typeof info !== "object") return false;
  if (!info.hasVideo) return false;
  // Embedded cover art probes as a video stream but isn't playable video
  if (info.attachedPic) return false;
  if (info.videoCodec !== "h264") return false;
  if (typeof info.format !== "string") return false;
  if (!info.format.includes("mp4")) return false;
  // pixelFormat check — tolerant if missing (older MediaInfo), strict if present
  if (info.pixelFormat != null && info.pixelFormat !== "yuv420p") return false;
  return true;
}

/**
 * Transcode a media file with hardened defaults. See SIMPLEFFMPEG.transcode
 * for full option docs.
 */
async function transcode(inputPath, options = {}) {
  if (!inputPath || typeof inputPath !== "string") {
    throw new SimpleffmpegError(
      "transcode() requires inputPath as the first argument",
    );
  }
  if (!options || typeof options !== "object") {
    throw new SimpleffmpegError(
      "transcode() requires an options object as the second argument",
    );
  }
  if (!options.outputPath) {
    throw new SimpleffmpegError("transcode() requires options.outputPath");
  }

  const hasPreset = options.preset != null;
  const hasCustomArgs = Array.isArray(options.customArgs);

  if (hasPreset && hasCustomArgs) {
    throw new SimpleffmpegError(
      "transcode() cannot accept both preset and customArgs — pick one",
    );
  }
  if (!hasPreset && !hasCustomArgs) {
    throw new SimpleffmpegError(
      `transcode() requires either preset (e.g. "web-mp4") or customArgs`,
    );
  }
  if (hasPreset && !SUPPORTED_PRESETS.includes(options.preset)) {
    throw new SimpleffmpegError(
      `transcode() unknown preset "${options.preset}" — supported: ${SUPPORTED_PRESETS.map((p) => `"${p}"`).join(", ")}`,
    );
  }
  if (options.preset === "web-audio") {
    for (const key of VIDEO_ONLY_OPTIONS) {
      if (options[key] != null) {
        throw new SimpleffmpegError(
          `transcode() options.${key} does not apply to the "web-audio" preset`,
        );
      }
    }
    const ext = path.extname(options.outputPath).toLowerCase();
    if (ext !== ".m4a" && ext !== ".mp4") {
      throw new SimpleffmpegError(
        `transcode() "web-audio" writes AAC in an MP4 container — options.outputPath must end in .m4a or .mp4 (got "${ext || "no extension"}")`,
      );
    }
  }

  validateOptions(options);

  const resolvedInput = validatePath(inputPath, "inputPath");
  const resolvedOutput = validatePath(options.outputPath, "options.outputPath");

  if (hasCustomArgs) {
    validateCustomArgsOutput(options.customArgs, resolvedOutput);
  }

  try {
    await fsPromises.stat(resolvedInput);
  } catch {
    throw new TranscodeError(
      `transcode() input file "${inputPath}" does not exist or is not accessible`,
      { code: "INPUT_MISSING" },
    );
  }

  let info;
  try {
    info = await probeMedia(resolvedInput);
  } catch (err) {
    // probeMedia wraps ffprobe spawn errors into MediaNotFoundError with the
    // raw "spawn ffprobe ENOENT" string in the message — detect that and
    // surface FFMPEG_NOT_FOUND, since the same install is needed for both.
    const msg = err && err.message ? err.message : "";
    if (err?.code === "FFMPEG_NOT_FOUND" || (msg.includes("ENOENT") && /ffprobe|ffmpeg/i.test(msg))) {
      throw new TranscodeError(
        "transcode() ffmpeg/ffprobe binary not found in PATH — install ffmpeg (e.g. `brew install ffmpeg`)",
        { code: "FFMPEG_NOT_FOUND" },
      );
    }
    throw new TranscodeError(
      `transcode() could not probe input "${inputPath}": ${msg}`,
      { code: "INPUT_MISSING" },
    );
  }

  // Pre-flight stream checks so preset misuse fails with a clear code
  // instead of ffmpeg's cryptic "Stream map '0:v:0' matches no streams".
  if (options.preset === "web-mp4" && (!info.hasVideo || info.attachedPic)) {
    throw new TranscodeError(
      info.hasAudio
        ? `transcode() input "${inputPath}" has no playable video stream${info.attachedPic ? " (its only video stream is embedded cover art)" : ""} — for audio files use preset "web-audio"`
        : `transcode() input "${inputPath}" has no playable video stream`,
      { code: "NO_VIDEO_STREAM" },
    );
  }
  if (options.preset === "web-audio" && !info.hasAudio) {
    throw new TranscodeError(
      `transcode() input "${inputPath}" has no audio stream`,
      { code: "NO_AUDIO_STREAM" },
    );
  }

  const totalDuration = Number.isFinite(info.duration) ? info.duration : 0;

  let ffmpegArgs;
  if (hasCustomArgs) {
    ffmpegArgs = [...options.customArgs];
  } else if (options.preset === "web-audio") {
    ffmpegArgs = buildWebAudioArgs({
      inputPath: resolvedInput,
      outputPath: resolvedOutput,
      audioBitrate: options.audioBitrate,
      maxOutputBytes: options.maxOutputBytes,
      threads: options.threads,
    });
  } else {
    ffmpegArgs = buildWebMp4Args({
      inputPath: resolvedInput,
      outputPath: resolvedOutput,
      crf: options.crf,
      videoBitrate: options.videoBitrate,
      audioBitrate: options.audioBitrate,
      scale: options.scale,
      maxOutputBytes: options.maxOutputBytes,
      threads: options.threads,
    });
  }

  await runHardened({
    argv: ffmpegArgs,
    label: "transcode()",
    outputPath: resolvedOutput,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    onProgress: options.onProgress,
    totalDuration,
  });

  return resolvedOutput;
}

module.exports = {
  transcode,
  isWebSafeMp4,
  // Exported for unit tests — not part of the public API
  buildWebMp4Args,
  buildWebAudioArgs,
  buildScaleFilter,
  validatePath,
  validateOptions,
  validateCustomArgsOutput,
  parseProgressBlock,
  SUPPORTED_PRESETS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_THREADS,
};
