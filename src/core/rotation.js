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
    const args = ["-y", "-i", inputUrl, out];
    let timedOut = false;

    const proc = spawn("ffmpeg", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      // Clean up partial output file on timeout
      try {
        fs.unlinkSync(out);
      } catch (_) {}
    }, timeoutMs);

    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(
        new FFmpegError(`ffmpeg process error: ${error.message}`, {
          stderr,
          command: `ffmpeg ${args.join(" ")}`,
        })
      );
    });

    proc.on("close", (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(
          new FFmpegError(
            `ffmpeg unrotate timed out after ${timeoutMs}ms for "${inputUrl}"`,
            {
              stderr,
              command: `ffmpeg ${args.join(" ")}`,
            }
          )
        );
        return;
      }

      if (code !== 0) {
        // Clean up partial output file on failure
        try {
          fs.unlinkSync(out);
        } catch (_) {}
        reject(
          new FFmpegError(`ffmpeg exited with code ${code}`, {
            stderr,
            command: `ffmpeg ${args.join(" ")}`,
            exitCode: code,
          })
        );
        return;
      }
      resolve(out);
    });
  });
}

module.exports = { unrotateVideo };
