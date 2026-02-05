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
 * Get video metadata using ffprobe
 * @param {string} url - Path to the video file
 * @returns {Promise<{iphoneRotation: number, hasAudio: boolean, width: number|null, height: number|null, durationSec: number|null}>}
 * @throws {MediaNotFoundError} If the file cannot be probed
 */
function getVideoMetadata(url) {
  return runFFprobe([
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    url,
  ])
    .then((stdout) => {
      let metadata;
      try {
        metadata = JSON.parse(stdout);
      } catch (parseError) {
        throw new Error(
          `Invalid JSON response from ffprobe: ${parseError.message}`
        );
      }

      // Validate metadata structure
      if (!metadata || !Array.isArray(metadata.streams)) {
        throw new Error(
          "Invalid metadata structure: missing or invalid 'streams' array"
        );
      }

      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video"
      );
      const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
      const iphoneRotation = videoStream?.side_data_list?.[0]?.rotation
        ? videoStream.side_data_list[0].rotation
        : 0;
      const formatDuration = metadata.format?.duration
        ? parseFloat(metadata.format.duration)
        : null;
      const streamDuration = videoStream?.duration
        ? parseFloat(videoStream.duration)
        : null;
      const durationSec = Number.isFinite(formatDuration)
        ? formatDuration
        : Number.isFinite(streamDuration)
        ? streamDuration
        : null;
      return {
        iphoneRotation,
        hasAudio,
        width: videoStream?.width,
        height: videoStream?.height,
        durationSec,
      };
    })
    .catch((error) => {
      throw new MediaNotFoundError(
        `Failed to get video metadata for "${url}": ${error.message}`,
        { path: url }
      );
    });
}

/**
 * Get media duration using ffprobe
 * @param {string} url - Path to the media file
 * @returns {Promise<number|null>} Duration in seconds, or null if unavailable
 * @throws {MediaNotFoundError} If the file cannot be probed
 */
function getMediaDuration(url) {
  return runFFprobe(["-v", "error", "-show_format", "-of", "json", url])
    .then((stdout) => {
      let metadata;
      try {
        metadata = JSON.parse(stdout);
      } catch (parseError) {
        throw new Error(
          `Invalid JSON response from ffprobe: ${parseError.message}`
        );
      }

      const formatDuration = metadata?.format?.duration
        ? parseFloat(metadata.format.duration)
        : null;
      return Number.isFinite(formatDuration) ? formatDuration : null;
    })
    .catch((error) => {
      throw new MediaNotFoundError(
        `Failed to get media duration for "${url}": ${error.message}`,
        { path: url }
      );
    });
}

module.exports = { getVideoMetadata, getMediaDuration };
