const fsPromises = require("fs").promises;
const { spawn } = require("child_process");
const { TranscodeError } = require("./errors");

const STDERR_CAP_BYTES = 16 * 1024;

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
 * Spawn ffmpeg with the given argv under the hardening wrapper shared by
 * transcode() and the audio operations: no shell, stdin ignored, SIGKILL
 * timeout, bounded stderr tail, partial output cleanup on failure,
 * AbortSignal support, stdout progress parsing.
 *
 * `label` names the calling operation in error messages ("transcode()",
 * "audioTempo()", ...). `outputPath` is optional — analysis runs that write
 * no file (e.g. silencedetect to -f null) omit it and skip cleanup.
 *
 * Resolves with `{ stderr }` — the bounded stderr tail — because some
 * filters (silencedetect, loudnorm print_format=json) report their results
 * on stderr. `stderrCapBytes` raises the bound for those callers.
 */
function runHardened({
  argv,
  label,
  outputPath = null,
  timeoutMs,
  signal,
  onProgress,
  totalDuration,
  stderrCapBytes = STDERR_CAP_BYTES,
}) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(
        new TranscodeError(`${label} aborted before start`, {
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
      if (outputPath) {
        await fsPromises.unlink(outputPath).catch(() => {});
      }
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
          /* user callback error should not fail the run */
        }
      }
      resolve({ stderr: stderrBuf.slice(-stderrCapBytes) });
    };

    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.length > stderrCapBytes * 2) {
        stderrBuf = stderrBuf.slice(-stderrCapBytes);
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
      const stderrTail = stderrBuf.slice(-stderrCapBytes);
      // Distinguish "ffmpeg binary not on PATH" (ENOENT) from generic spawn
      // failures — surfacing as NONZERO_EXIT for the missing-binary case
      // would mislead the caller into thinking ffmpeg ran and exited.
      if (err && err.code === "ENOENT") {
        fail(
          new TranscodeError(
            `${label} ffmpeg binary not found in PATH — install ffmpeg (e.g. \`brew install ffmpeg\`)`,
            { code: "FFMPEG_NOT_FOUND", stderr: stderrTail },
          ),
        );
        return;
      }
      fail(
        new TranscodeError(`${label} process error: ${err.message}`, {
          code: "NONZERO_EXIT",
          stderr: stderrTail,
        }),
      );
    });

    proc.on("close", (exitCode, sig) => {
      const stderrTail = stderrBuf.slice(-stderrCapBytes);

      if (aborted) {
        fail(
          new TranscodeError(`${label} aborted`, {
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
          new TranscodeError(`${label} timed out after ${timeoutMs}ms`, {
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
            `${label} exited with code ${exitCode}${sig ? ` (signal ${sig})` : ""}`,
            { code, stderr: stderrTail, exitCode, signal: sig },
          ),
        );
        return;
      }

      succeed();
    });
  });
}

module.exports = { runHardened, parseProgressBlock, STDERR_CAP_BYTES };
