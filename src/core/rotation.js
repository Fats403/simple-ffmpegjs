const path = require("path");
const os = require("os");
const fs = require("fs");
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");
const { FFmpegError } = require("./errors");

/** Default timeout for unrotate operations (5 minutes) */
const DEFAULT_UNROTATE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Unrotate a video (remove iPhone rotation metadata) using ffmpeg.
 * Uses spawn() with argument array to avoid command injection.
 * @param {string} inputUrl - Path to the input video file
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs] - Timeout in milliseconds (default: 5 minutes)
 * @param {string} [options.tempDir] - Custom temp directory (default: os.tmpdir())
 * @returns {Promise<string>} Path to the unrotated temporary video file
 * @throws {FFmpegError} If ffmpeg fails or times out
 */
function unrotateVideo(inputUrl, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_UNROTATE_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const out = path.join(options.tempDir || os.tmpdir(), `unrotated-${randomUUID()}.mp4`);
    // Explicit encoder settings so the intermediate is visually lossless and
    // predictable regardless of ffmpeg build defaults; audio and metadata
    // pass through untouched. The bare default (no -crf/-preset) re-encoded
    // at whatever the build chose.
    const args = [
      "-nostdin",
      "-y",
      "-i",
      inputUrl,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-c:a",
      "copy",
      "-map_metadata",
      "0",
      out,
    ];
    let timedOut = false;

    const proc = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    // SIGKILL, not SIGTERM: a wedged ffmpeg that ignores SIGTERM would leave
    // this promise pending forever. Partial output is removed in the close
    // handler, after the process has actually died.
    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGKILL");
      } catch (_) {}
    }, timeoutMs);

    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-32 * 1024);
    });

    proc.on("error", (error) => {
      clearTimeout(timeoutId);
      if (error && error.code === "ENOENT") {
        reject(
          new FFmpegError(
            "ffmpeg binary not found in PATH — install ffmpeg (e.g. `brew install ffmpeg`)",
            { stderr, command: `ffmpeg ${args.join(" ")}` },
          ),
        );
        return;
      }
      reject(
        new FFmpegError(`ffmpeg process error: ${error.message}`, {
          stderr,
          command: `ffmpeg ${args.join(" ")}`,
        }),
      );
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);

      if (timedOut || code !== 0) {
        // Clean up partial output file now that the process is dead
        try {
          fs.unlinkSync(out);
        } catch (_) {}
      }

      if (timedOut) {
        reject(
          new FFmpegError(
            `ffmpeg unrotate timed out after ${timeoutMs}ms for "${inputUrl}"`,
            {
              stderr,
              command: `ffmpeg ${args.join(" ")}`,
            },
          ),
        );
        return;
      }

      if (code !== 0) {
        reject(
          new FFmpegError(`ffmpeg exited with code ${code}`, {
            stderr,
            command: `ffmpeg ${args.join(" ")}`,
            exitCode: code,
          }),
        );
        return;
      }
      resolve(out);
    });
  });
}

module.exports = { unrotateVideo };
