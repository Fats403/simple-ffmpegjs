const { spawn } = require("child_process");
const { MediaNotFoundError } = require("./errors");

/** Default timeout for ffprobe operations (30 seconds) */
const DEFAULT_FFPROBE_TIMEOUT_MS = 30000;

/**
 * Run ffprobe with spawn() to avoid command injection vulnerabilities.
 * @param {string[]} args - Arguments to pass to ffprobe
 * @param {number} [timeoutMs] - Timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} stdout from ffprobe
 */
function runFFprobe(args, timeoutMs = DEFAULT_FFPROBE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    // SIGKILL and reject immediately: a probe that ignores SIGTERM would
    // otherwise leave the promise pending forever (rejection only happened
    // in the close handler, which never fires for an unkillable process).
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        proc.kill("SIGKILL");
      } catch (_) {}
      reject(new Error(`ffprobe timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-32 * 1024);
    });

    proc.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      const err = new Error(`ffprobe process error: ${error.message}`);
      // Structured discrimination for "not installed" so callers stop
      // string-sniffing the message for "ENOENT".
      if (error && error.code === "ENOENT") err.code = "FFMPEG_NOT_FOUND";
      reject(err);
    });

    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Parse a fraction string like "30000/1001" or "30/1" into a number.
 * Returns null if the input is not a valid fraction.
 * @param {string} fraction
 * @returns {number|null}
 */
function parseFraction(fraction) {
  if (!fraction || typeof fraction !== "string") return null;
  const parts = fraction.split("/");
  if (parts.length !== 2) return null;
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const result = num / den;
  return Number.isFinite(result) ? result : null;
}

/**
 * Probe a media file and return comprehensive metadata.
 *
 * Returns a flat, user-friendly object with duration, dimensions, codecs,
 * format, bitrate, audio details, and rotation info. All fields that are
 * not applicable (e.g. width/height for audio-only files) are set to null.
 *
 * @param {string} filePath - Path to the media file
 * @returns {Promise<{
 *   duration: number|null,
 *   width: number|null,
 *   height: number|null,
 *   hasVideo: boolean,
 *   hasAudio: boolean,
 *   attachedPic: boolean,
 *   rotation: number,
 *   videoCodec: string|null,
 *   audioCodec: string|null,
 *   format: string|null,
 *   fps: number|null,
 *   size: number|null,
 *   bitrate: number|null,
 *   sampleRate: number|null,
 *   channels: number|null,
 *   pixelFormat: string|null,
 *   colorSpace: string|null,
 *   colorTransfer: string|null
 * }>}
 * @throws {MediaNotFoundError} If the file cannot be probed
 */
async function probeMedia(filePath) {
  let stdout;
  try {
    stdout = await runFFprobe([
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      filePath,
    ]);
  } catch (error) {
    const err = new MediaNotFoundError(
      `Failed to probe "${filePath}": ${error.message}`,
      { path: filePath },
    );
    // Preserve the structured "ffprobe not installed" discriminator
    if (error && error.code === "FFMPEG_NOT_FOUND") err.code = error.code;
    throw err;
  }

  let metadata;
  try {
    metadata = JSON.parse(stdout);
  } catch (parseError) {
    throw new MediaNotFoundError(
      `Invalid JSON response from ffprobe for "${filePath}": ${parseError.message}`,
      { path: filePath },
    );
  }

  if (!metadata || !Array.isArray(metadata.streams)) {
    throw new MediaNotFoundError(
      `Invalid metadata structure for "${filePath}": missing or invalid 'streams' array`,
      { path: filePath },
    );
  }

  // Prefer a real video stream over embedded cover art (attached_pic) so an
  // MP3 with album art doesn't report the artwork's codec as its "video".
  const videoStreams = metadata.streams.filter((s) => s.codec_type === "video");
  const videoStream =
    videoStreams.find((s) => s.disposition?.attached_pic !== 1) ??
    videoStreams[0] ??
    null;
  const attachedPic = !!videoStream && videoStream.disposition?.attached_pic === 1;
  const audioStream = metadata.streams.find((s) => s.codec_type === "audio");
  const format = metadata.format || {};

  // ── Duration ────────────────────────────────────────────────────────────
  const formatDuration = format.duration ? parseFloat(format.duration) : null;
  // Fall back through video then audio stream durations — audio-only files
  // in containers that omit format.duration otherwise probe as duration:null.
  const streamDuration = videoStream?.duration
    ? parseFloat(videoStream.duration)
    : null;
  const audioDuration = audioStream?.duration
    ? parseFloat(audioStream.duration)
    : null;
  const duration = Number.isFinite(formatDuration)
    ? formatDuration
    : Number.isFinite(streamDuration)
      ? streamDuration
      : Number.isFinite(audioDuration)
        ? audioDuration
        : null;

  // ── FPS ─────────────────────────────────────────────────────────────────
  // Prefer avg_frame_rate, fall back to r_frame_rate
  const fps =
    parseFraction(videoStream?.avg_frame_rate) ??
    parseFraction(videoStream?.r_frame_rate) ??
    null;

  // ── Rotation ────────────────────────────────────────────────────────────
  const rotation = videoStream?.side_data_list?.[0]?.rotation
    ? videoStream.side_data_list[0].rotation
    : 0;

  // ── Size & bitrate ─────────────────────────────────────────────────────
  const size = format.size ? parseInt(format.size, 10) : null;
  const bitrate = format.bit_rate ? parseInt(format.bit_rate, 10) : null;

  // ── Audio details ──────────────────────────────────────────────────────
  const sampleRate = audioStream?.sample_rate
    ? parseInt(audioStream.sample_rate, 10)
    : null;
  const channels =
    typeof audioStream?.channels === "number" ? audioStream.channels : null;

  return {
    duration,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    hasVideo: !!videoStream,
    hasAudio: !!audioStream,
    attachedPic,
    rotation,
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    format: format.format_name ?? null,
    fps: Number.isFinite(fps) ? Math.round(fps * 100) / 100 : null,
    size: Number.isFinite(size) ? size : null,
    bitrate: Number.isFinite(bitrate) ? bitrate : null,
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : null,
    channels,
    pixelFormat: videoStream?.pix_fmt ?? null,
    colorSpace: videoStream?.color_space ?? null,
    colorTransfer: videoStream?.color_transfer ?? null,
  };
}

module.exports = { probeMedia };
