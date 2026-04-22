/**
 * Base error class for all simple-ffmpeg errors
 */
class SimpleffmpegError extends Error {
  constructor(message) {
    super(message);
    this.name = "SimpleffmpegError";
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Thrown when clip validation fails
 */
class ValidationError extends SimpleffmpegError {
  constructor(message, { errors = [], warnings = [] } = {}) {
    super(message);
    this.name = "ValidationError";
    this.errors = errors;
    this.warnings = warnings;
  }
}

/**
 * Thrown when FFmpeg command execution fails
 */
class FFmpegError extends SimpleffmpegError {
  constructor(message, { stderr = "", command = "", exitCode = null } = {}) {
    super(message);
    this.name = "FFmpegError";
    this.stderr = stderr;
    this.command = command;
    this.exitCode = exitCode;
  }

  /**
   * Structured error details for easy bug reporting.
   * Contains the last 50 lines of stderr, the command, and exit code.
   */
  get details() {
    const lines = (this.stderr || "").split("\n");
    const tail = lines.slice(-50).join("\n");
    return {
      stderrTail: tail,
      command: this.command,
      exitCode: this.exitCode,
    };
  }
}

/**
 * Thrown when a media file cannot be found or accessed
 */
class MediaNotFoundError extends SimpleffmpegError {
  constructor(message, { path = "" } = {}) {
    super(message);
    this.name = "MediaNotFoundError";
    this.path = path;
  }
}

/**
 * Thrown when export is cancelled via AbortSignal
 */
class ExportCancelledError extends SimpleffmpegError {
  constructor(message = "Export was cancelled") {
    super(message);
    this.name = "ExportCancelledError";
  }
}

/**
 * Thrown when SIMPLEFFMPEG.transcode() fails.
 *
 * The `code` field discriminates the cause so callers can branch
 * (retry on transient, reject on content).
 *
 * @property {"INVALID_PATH"|"INPUT_MISSING"|"FFMPEG_NOT_FOUND"|"TIMEOUT"|"NONZERO_EXIT"|"SIGNAL"|"ABORTED"} code
 * @property {string} stderr - Tail of ffmpeg stderr, capped at 16 KB
 * @property {number|null} exitCode
 * @property {string|null} signal
 */
class TranscodeError extends SimpleffmpegError {
  constructor(
    message,
    { code, stderr = "", exitCode = null, signal = null } = {},
  ) {
    super(message);
    this.name = "TranscodeError";
    this.code = code;
    this.stderr = stderr;
    this.exitCode = exitCode;
    this.signal = signal;
  }

  /**
   * Structured error details for easy bug reporting.
   */
  get details() {
    return {
      code: this.code,
      stderr: this.stderr,
      exitCode: this.exitCode,
      signal: this.signal,
    };
  }
}

module.exports = {
  SimpleffmpegError,
  ValidationError,
  FFmpegError,
  MediaNotFoundError,
  ExportCancelledError,
  TranscodeError,
};
