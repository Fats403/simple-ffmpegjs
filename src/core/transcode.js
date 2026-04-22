const fsPromises = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");
const { probeMedia } = require("./media_info");
const { SimpleffmpegError, TranscodeError } = require("./errors");

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MAX_OUTPUT_BYTES = 500 * 1024 * 1024;
const DEFAULT_THREADS = 2;
const STDERR_CAP_BYTES = 16 * 1024;

const SUPPORTED_PRESETS = ["web-mp4"];

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

  // Compose vf: user scale (if any), then even-dim trunc last so odd inputs
  // become libx264-safe regardless of what the user requested.
  const evenTrunc = "scale='trunc(iw/2)*2':'trunc(ih/2)*2'";
  const userScale = buildScaleFilter(scale);
  args.push("-vf", userScale ? `${userScale},${evenTrunc}` : evenTrunc);

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
 * Parse a single -progress pipe:1 block and return the percent [0..99].
 * ffmpeg emits one block per ~500ms ending with progress=continue or
 * progress=end. Returns null if the block lacks out_time_us or duration
 * is unknown.
 */
function parseProgressBlock(block, totalDuration) {
  const match = block.match(/out_time_us=(\d+)/);
  if (!match) return null;
  const us = parseInt(match[1], 10);
  if (!Number.isFinite(us) || us < 0) return null;
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return null;
  const seconds = us / 1_000_000;
  const pct = Math.floor((seconds / totalDuration) * 100);
  return Math.max(0, Math.min(99, pct));
}

/**
 * Predicate — is this MediaInfo already web-safe? Fast heuristic that lets
 * callers skip transcoding when the input is already h264/mp4/yuv420p.
 */
function isWebSafeMp4(info) {
  if (!info || typeof info !== "object") return false;
  if (!info.hasVideo) return false;
  if (info.videoCodec !== "h264") return false;
  if (typeof info.format !== "string") return false;
  if (!info.format.includes("mp4")) return false;
  // pixelFormat check — tolerant if missing (older MediaInfo), strict if present
  if (info.pixelFormat != null && info.pixelFormat !== "yuv420p") return false;
  return true;
}

/**
 * Spawn ffmpeg with the given argv and enforce the hardening wrapper:
 * no shell, stdin ignored, SIGKILL timeout, bounded stderr tail, partial
 * output cleanup on failure, AbortSignal support, stdout progress parsing.
 */
function runHardened({
  argv,
  outputPath,
  timeoutMs,
  signal,
  onProgress,
  totalDuration,
}) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(
        new TranscodeError("transcode() aborted before start", {
          code: "ABORTED",
        }),
      );
      return;
    }

    let settled = false;
    let stderrBuf = "";
    let stdoutBuf = "";
    let timedOut = false;
    let aborted = false;

    const proc = spawn("ffmpeg", argv, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already dead */
      }
    }, timeoutMs);

    const abortHandler = () => {
      aborted = true;
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already dead */
      }
    };
    if (signal) signal.addEventListener("abort", abortHandler, { once: true });

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortHandler);
    };

    const fail = async (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      await fsPromises.unlink(outputPath).catch(() => {});
      reject(err);
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (onProgress) {
        try {
          onProgress(100);
        } catch {
          /* user callback error should not fail the transcode */
        }
      }
      resolve();
    };

    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.length > STDERR_CAP_BYTES * 2) {
        stderrBuf = stderrBuf.slice(-STDERR_CAP_BYTES);
      }
    });

    proc.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      // Blocks are separated by "progress=continue\n" or "progress=end\n".
      // Parse complete blocks only; partial trailing text stays buffered.
      while (true) {
        const idx = stdoutBuf.indexOf("progress=");
        if (idx === -1) break;
        const lineEnd = stdoutBuf.indexOf("\n", idx);
        if (lineEnd === -1) break;
        const block = stdoutBuf.slice(0, lineEnd + 1);
        stdoutBuf = stdoutBuf.slice(lineEnd + 1);
        if (onProgress) {
          const pct = parseProgressBlock(block, totalDuration);
          if (pct !== null) {
            try {
              onProgress(pct);
            } catch {
              /* swallow */
            }
          }
        }
      }
    });

    proc.on("error", (err) => {
      const stderrTail = stderrBuf.slice(-STDERR_CAP_BYTES);
      // Distinguish "ffmpeg binary not on PATH" (ENOENT) from generic spawn
      // failures — surfacing as NONZERO_EXIT for the missing-binary case
      // would mislead the caller into thinking ffmpeg ran and exited.
      if (err && err.code === "ENOENT") {
        fail(
          new TranscodeError(
            "transcode() ffmpeg binary not found in PATH — install ffmpeg (e.g. `brew install ffmpeg`)",
            { code: "FFMPEG_NOT_FOUND", stderr: stderrTail },
          ),
        );
        return;
      }
      fail(
        new TranscodeError(`transcode() process error: ${err.message}`, {
          code: "NONZERO_EXIT",
          stderr: stderrTail,
        }),
      );
    });

    proc.on("close", (exitCode, sig) => {
      const stderrTail = stderrBuf.slice(-STDERR_CAP_BYTES);

      if (aborted) {
        fail(
          new TranscodeError("transcode() aborted", {
            code: "ABORTED",
            stderr: stderrTail,
            exitCode,
            signal: sig,
          }),
        );
        return;
      }

      if (timedOut) {
        fail(
          new TranscodeError(`transcode() timed out after ${timeoutMs}ms`, {
            code: "TIMEOUT",
            stderr: stderrTail,
            exitCode,
            signal: sig,
          }),
        );
        return;
      }

      if (exitCode !== 0) {
        const code = exitCode === null && sig ? "SIGNAL" : "NONZERO_EXIT";
        fail(
          new TranscodeError(
            `transcode() exited with code ${exitCode}${sig ? ` (signal ${sig})` : ""}`,
            { code, stderr: stderrTail, exitCode, signal: sig },
          ),
        );
        return;
      }

      succeed();
    });
  });
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

  const resolvedInput = validatePath(inputPath, "inputPath");
  const resolvedOutput = validatePath(options.outputPath, "options.outputPath");

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
    if (msg.includes("ENOENT") && /ffprobe|ffmpeg/i.test(msg)) {
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

  const totalDuration = Number.isFinite(info.duration) ? info.duration : 0;

  let ffmpegArgs;
  if (hasCustomArgs) {
    ffmpegArgs = [...options.customArgs];
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
  buildScaleFilter,
  validatePath,
  parseProgressBlock,
  SUPPORTED_PRESETS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_THREADS,
};
