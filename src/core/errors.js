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

module.exports = {
  SimpleffmpegError,
  ValidationError,
  FFmpegError,
  MediaNotFoundError,
  ExportCancelledError,
};
