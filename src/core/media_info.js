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
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`ffprobe process error: ${error.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(new Error(`ffprobe timed out after ${timeoutMs}ms`));
        return;
      }

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
 *   rotation: number,
 *   videoCodec: string|null,
 *   audioCodec: string|null,
 *   format: string|null,
 *   fps: number|null,
 *   size: number|null,
 *   bitrate: number|null,
 *   sampleRate: number|null,
 *   channels: number|null
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
    throw new MediaNotFoundError(
      `Failed to probe "${filePath}": ${error.message}`,
      { path: filePath }
    );
  }

  let metadata;
  try {
    metadata = JSON.parse(stdout);
  } catch (parseError) {
    throw new MediaNotFoundError(
      `Invalid JSON response from ffprobe for "${filePath}": ${parseError.message}`,
      { path: filePath }
    );
  }

  if (!metadata || !Array.isArray(metadata.streams)) {
    throw new MediaNotFoundError(
      `Invalid metadata structure for "${filePath}": missing or invalid 'streams' array`,
      { path: filePath }
    );
  }

  const videoStream = metadata.streams.find((s) => s.codec_type === "video");
  const audioStream = metadata.streams.find((s) => s.codec_type === "audio");
  const format = metadata.format || {};

  // ── Duration ────────────────────────────────────────────────────────────
  const formatDuration = format.duration ? parseFloat(format.duration) : null;
  const streamDuration = videoStream?.duration
    ? parseFloat(videoStream.duration)
    : null;
  const duration = Number.isFinite(formatDuration)
    ? formatDuration
    : Number.isFinite(streamDuration)
    ? streamDuration
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
    rotation,
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    format: format.format_name ?? null,
    fps: Number.isFinite(fps) ? Math.round(fps * 100) / 100 : null,
    size: Number.isFinite(size) ? size : null,
    bitrate: Number.isFinite(bitrate) ? bitrate : null,
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : null,
    channels,
  };
}

module.exports = { probeMedia };
