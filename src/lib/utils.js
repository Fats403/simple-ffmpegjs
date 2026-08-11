const { spawn } = require("child_process");
const fs = require("fs");
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
        Math.round((progress.timeProcessed / totalDuration) * 100),
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

/** Bound on buffered stdout/stderr — onLog still receives every chunk. */
const OUTPUT_CAP_BYTES = 256 * 1024;

/** Grace period between SIGTERM and SIGKILL on cancellation. */
const KILL_ESCALATION_MS = 2000;

/**
 * Run FFmpeg command with spawn, supporting progress callbacks and cancellation.
 *
 * Hardening applied here (shared by export, snapshot, keyframes, thumbnails,
 * and text passes): stdin ignored, SIGTERM→SIGKILL escalation on abort, an
 * optional SIGKILL-backed timeout, bounded output buffering, partial-output
 * cleanup on failure, and ENOENT discrimination so "ffmpeg not installed"
 * doesn't masquerade as an encode failure.
 *
 * @param {Object} options
 * @param {string} options.command - The full FFmpeg command string
 * @param {number} options.totalDuration - Expected output duration in seconds (for progress %)
 * @param {Function} options.onProgress - Progress callback
 * @param {AbortSignal} options.signal - AbortSignal for cancellation
 * @param {Function} options.onLog - Log callback receiving { level: "stderr"|"stdout", message: string }
 * @param {number} [options.timeoutMs] - Hard timeout; SIGKILL on expiry. Omit for no timeout.
 * @param {string} [options.outputPath] - Output file to unlink when the run fails
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runFFmpeg({
  command,
  totalDuration = 0,
  onProgress,
  signal,
  onLog,
  timeoutMs,
  outputPath,
}) {
  return new Promise((resolve, reject) => {
    const args = parseFFmpegCommand(command);
    const ffmpegPath = args.shift(); // Remove 'ffmpeg' from args

    if (signal && signal.aborted) {
      reject(new ExportCancelledError());
      return;
    }

    const proc = spawn(ffmpegPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let cancelled = false;
    let timedOut = false;
    let killTimer = null;
    let timeoutTimer = null;

    const killHard = () => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already dead */
      }
    };

    const killWithEscalation = () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* already dead */
      }
      killTimer = setTimeout(killHard, KILL_ESCALATION_MS);
    };

    if (timeoutMs != null && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        killHard();
      }, timeoutMs);
    }

    const abortHandler = () => {
      cancelled = true;
      killWithEscalation();
    };
    if (signal) signal.addEventListener("abort", abortHandler, { once: true });

    const cleanupHandlers = () => {
      if (killTimer) clearTimeout(killTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (signal) signal.removeEventListener("abort", abortHandler);
    };

    const fail = (err) => {
      cleanupHandlers();
      if (outputPath) {
        fs.unlink(outputPath, () => {});
      }
      reject(err);
    };

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (stdout.length > OUTPUT_CAP_BYTES * 2) {
        stdout = stdout.slice(-OUTPUT_CAP_BYTES);
      }
      if (onLog && typeof onLog === "function") {
        onLog({ level: "stdout", message: chunk });
      }
    });

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (stderr.length > OUTPUT_CAP_BYTES * 2) {
        stderr = stderr.slice(-OUTPUT_CAP_BYTES);
      }

      if (onLog && typeof onLog === "function") {
        onLog({ level: "stderr", message: chunk });
      }

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
      if (error && error.code === "ENOENT") {
        fail(
          new FFmpegError(
            "ffmpeg binary not found in PATH — install ffmpeg (e.g. `brew install ffmpeg`)",
            { stderr, command },
          ),
        );
        return;
      }
      fail(
        new FFmpegError(`FFmpeg process error: ${error.message}`, {
          stderr,
          command,
        }),
      );
    });

    proc.on("close", (code) => {
      if (cancelled) {
        fail(new ExportCancelledError());
        return;
      }

      if (timedOut) {
        fail(
          new FFmpegError(`FFmpeg timed out after ${timeoutMs}ms`, {
            stderr,
            command,
            exitCode: code,
          }),
        );
        return;
      }

      if (code !== 0) {
        fail(
          new FFmpegError(`FFmpeg exited with code ${code}`, {
            stderr,
            command,
            exitCode: code,
          }),
        );
        return;
      }

      cleanupHandlers();
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
    } else if (char === "\"" || char === "'") {
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

/**
 * Resolve a clip's ffmpeg input index. Uses the project-level map built in
 * _prepareExport when available; otherwise builds the same mapping locally
 * for standalone usage (e.g. unit tests). Flat color clips use the color=
 * filter source and produce no file input, so they are skipped — a raw
 * indexOf() here would shift every index after a flat color clip.
 */
function getClipInputIndex(project, clip) {
  if (project._inputIndexMap) {
    return project._inputIndexMap.get(clip);
  }
  let inputIdx = 0;
  for (const c of project.videoOrAudioClips) {
    if (c.type === "color" && c._isFlatColor) {
      continue;
    }
    if (c === clip) return inputIdx;
    inputIdx++;
  }
  return project.videoOrAudioClips.indexOf(clip);
}

/**
 * Map with bounded concurrency. Results keep input order; the first
 * rejection propagates after in-flight items settle. Used to keep load()
 * from spawning one ffprobe (or one full re-encode) per clip all at once.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let firstError = null;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = await fn(items[i], i);
        } catch (err) {
          if (!firstError) firstError = err;
          // Drain remaining items without starting new work
          next = items.length;
        }
      }
    },
  );
  await Promise.all(workers);
  if (firstError) throw firstError;
  return results;
}

module.exports = {
  formatBytes,
  parseFFmpegTime,
  parseFFmpegProgress,
  runFFmpeg,
  parseFFmpegCommand,
  getClipInputIndex,
  mapWithConcurrency,
};
