const { spawn } = require("child_process");
const { FFmpegError, ExportCancelledError } = require("../core/errors");

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return `${bytes}`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
};

/**
 * Parse FFmpeg time string (HH:MM:SS.ms) to seconds
 */
function parseFFmpegTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (
      parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds)
    );
  }
  return parseFloat(timeStr) || 0;
}

/**
 * Parse FFmpeg progress line and extract metrics
 */
function parseFFmpegProgress(line, totalDuration) {
  const progress = {};

  // Parse frame=  120
  const frameMatch = line.match(/frame=\s*(\d+)/);
  if (frameMatch) progress.frame = parseInt(frameMatch[1], 10);

  // Parse fps=45.2
  const fpsMatch = line.match(/fps=\s*([\d.]+)/);
  if (fpsMatch) progress.fps = parseFloat(fpsMatch[1]);

  // Parse time=00:00:04.00
  const timeMatch = line.match(/time=\s*([\d:.]+)/);
  if (timeMatch) {
    progress.timeProcessed = parseFFmpegTime(timeMatch[1]);
    if (totalDuration > 0) {
      progress.percent = Math.min(
        100,
        Math.round((progress.timeProcessed / totalDuration) * 100)
      );
    }
  }

  // Parse speed=1.5x
  const speedMatch = line.match(/speed=\s*([\d.]+)x/);
  if (speedMatch) progress.speed = parseFloat(speedMatch[1]);

  // Parse bitrate=1234kbits/s
  const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/);
  if (bitrateMatch) progress.bitrate = parseFloat(bitrateMatch[1]);

  // Parse size=  1234kB
  const sizeMatch = line.match(/size=\s*(\d+)kB/);
  if (sizeMatch) progress.size = parseInt(sizeMatch[1], 10) * 1024;

  return progress;
}

/**
 * Run FFmpeg command with spawn, supporting progress callbacks and cancellation
 * @param {Object} options
 * @param {string} options.command - The full FFmpeg command string
 * @param {number} options.totalDuration - Expected output duration in seconds (for progress %)
 * @param {Function} options.onProgress - Progress callback
 * @param {AbortSignal} options.signal - AbortSignal for cancellation
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runFFmpeg({ command, totalDuration = 0, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    // Parse command into args (simple split, assumes no quoted args with spaces in values)
    // FFmpeg commands from this library don't have spaces in quoted paths handled this way
    // We need to handle the command string properly
    const args = parseFFmpegCommand(command);
    const ffmpegPath = args.shift(); // Remove 'ffmpeg' from args

    const proc = spawn(ffmpegPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let cancelled = false;

    // Handle cancellation
    if (signal) {
      const abortHandler = () => {
        cancelled = true;
        proc.kill("SIGTERM");
      };

      if (signal.aborted) {
        proc.kill("SIGTERM");
        reject(new ExportCancelledError());
        return;
      }

      signal.addEventListener("abort", abortHandler, { once: true });

      proc.on("close", () => {
        signal.removeEventListener("abort", abortHandler);
      });
    }

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;

      // Parse progress from stderr (FFmpeg outputs progress to stderr)
      if (onProgress && typeof onProgress === "function") {
        const progress = parseFFmpegProgress(chunk, totalDuration);
        if (Object.keys(progress).length > 0) {
          progress.phase = "rendering";
          onProgress(progress);
        }
      }
    });

    proc.on("error", (error) => {
      reject(
        new FFmpegError(`FFmpeg process error: ${error.message}`, {
          stderr,
          command,
        })
      );
    });

    proc.on("close", (code) => {
      if (cancelled) {
        reject(new ExportCancelledError());
        return;
      }

      if (code !== 0) {
        reject(
          new FFmpegError(`FFmpeg exited with code ${code}`, {
            stderr,
            command,
            exitCode: code,
          })
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

/**
 * Parse a command string into an array of arguments.
 *
 * Inside quoted strings (single or double):
 *   - All characters are literal (no escape processing).
 *   - The matching closing quote ends the argument segment.
 *
 * This deliberately avoids backslash-escape handling because the
 * filter_complex value relies on \\, \, and \: being passed through
 * verbatim to FFmpeg.  For example drawtext's fontsize expressions
 * use \\, (which drawtext decodes as \, → escaped comma) and text
 * values use \\\\ (which drawtext decodes as \\ → literal backslash).
 * Any unescaping here would corrupt those sequences.
 *
 * Outside quotes:
 *   - Whitespace separates arguments.
 *   - All other characters (including backslash) are literal.
 */
function parseFFmpegCommand(command) {
  const args = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === " " || char === "\t") {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

module.exports = {
  formatBytes,
  parseFFmpegTime,
  parseFFmpegProgress,
  runFFmpeg,
  parseFFmpegCommand,
};
