import { describe, it, expect } from "vitest";

const {
  SimpleffmpegError,
  ValidationError,
  FFmpegError,
  MediaNotFoundError,
  ExportCancelledError,
  TranscodeError,
} = await import("../../src/core/errors.js");

describe("Custom Error Classes", () => {
  describe("SimpleffmpegError", () => {
    it("should be an instance of Error", () => {
      const error = new SimpleffmpegError("test message");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SimpleffmpegError);
    });

    it("should have correct name and message", () => {
      const error = new SimpleffmpegError("test message");
      expect(error.name).toBe("SimpleffmpegError");
      expect(error.message).toBe("test message");
    });
  });

  describe("ValidationError", () => {
    it("should be an instance of SimpleffmpegError", () => {
      const error = new ValidationError("validation failed");
      expect(error).toBeInstanceOf(SimpleffmpegError);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should store errors and warnings arrays", () => {
      const errors = ["error1", "error2"];
      const warnings = ["warning1"];
      const error = new ValidationError("validation failed", {
        errors,
        warnings,
      });

      expect(error.name).toBe("ValidationError");
      expect(error.errors).toEqual(errors);
      expect(error.warnings).toEqual(warnings);
    });

    it("should default to empty arrays", () => {
      const error = new ValidationError("validation failed");
      expect(error.errors).toEqual([]);
      expect(error.warnings).toEqual([]);
    });
  });

  describe("FFmpegError", () => {
    it("should be an instance of SimpleffmpegError", () => {
      const error = new FFmpegError("ffmpeg failed");
      expect(error).toBeInstanceOf(SimpleffmpegError);
      expect(error).toBeInstanceOf(FFmpegError);
    });

    it("should store stderr, command, and exitCode", () => {
      const error = new FFmpegError("ffmpeg failed", {
        stderr: "error output",
        command: "ffmpeg -i input.mp4 output.mp4",
        exitCode: 1,
      });

      expect(error.name).toBe("FFmpegError");
      expect(error.stderr).toBe("error output");
      expect(error.command).toBe("ffmpeg -i input.mp4 output.mp4");
      expect(error.exitCode).toBe(1);
    });

    it("should default to empty values", () => {
      const error = new FFmpegError("ffmpeg failed");
      expect(error.stderr).toBe("");
      expect(error.command).toBe("");
      expect(error.exitCode).toBeNull();
    });

    it("should return structured details via getter", () => {
      const error = new FFmpegError("ffmpeg failed", {
        stderr: "line1\nline2\nline3",
        command: "ffmpeg -i input.mp4 output.mp4",
        exitCode: 1,
      });

      const details = error.details;
      expect(details).toEqual({
        stderrTail: "line1\nline2\nline3",
        command: "ffmpeg -i input.mp4 output.mp4",
        exitCode: 1,
      });
    });

    it("should truncate stderr to last 50 lines in details", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const error = new FFmpegError("ffmpeg failed", {
        stderr: lines.join("\n"),
        command: "ffmpeg -i in.mp4 out.mp4",
        exitCode: 2,
      });

      const details = error.details;
      const tailLines = details.stderrTail.split("\n");
      expect(tailLines.length).toBe(50);
      expect(tailLines[0]).toBe("line 51");
      expect(tailLines[49]).toBe("line 100");
    });

    it("should handle empty stderr in details", () => {
      const error = new FFmpegError("ffmpeg failed");
      const details = error.details;
      expect(details.stderrTail).toBe("");
      expect(details.command).toBe("");
      expect(details.exitCode).toBeNull();
    });
  });

  describe("MediaNotFoundError", () => {
    it("should be an instance of SimpleffmpegError", () => {
      const error = new MediaNotFoundError("file not found");
      expect(error).toBeInstanceOf(SimpleffmpegError);
      expect(error).toBeInstanceOf(MediaNotFoundError);
    });

    it("should store path", () => {
      const error = new MediaNotFoundError("file not found", {
        path: "/path/to/file.mp4",
      });

      expect(error.name).toBe("MediaNotFoundError");
      expect(error.path).toBe("/path/to/file.mp4");
    });
  });

  describe("TranscodeError", () => {
    it("should be an instance of SimpleffmpegError", () => {
      const error = new TranscodeError("transcode failed", { code: "TIMEOUT" });
      expect(error).toBeInstanceOf(SimpleffmpegError);
      expect(error).toBeInstanceOf(TranscodeError);
    });

    it("should store code, stderr, exitCode, and signal", () => {
      const error = new TranscodeError("transcode failed", {
        code: "NONZERO_EXIT",
        stderr: "some ffmpeg error",
        exitCode: 1,
        signal: null,
      });

      expect(error.name).toBe("TranscodeError");
      expect(error.code).toBe("NONZERO_EXIT");
      expect(error.stderr).toBe("some ffmpeg error");
      expect(error.exitCode).toBe(1);
      expect(error.signal).toBeNull();
    });

    it("should default to empty values", () => {
      const error = new TranscodeError("failed", { code: "TIMEOUT" });
      expect(error.stderr).toBe("");
      expect(error.exitCode).toBeNull();
      expect(error.signal).toBeNull();
    });

    it("should return structured details via getter", () => {
      const error = new TranscodeError("killed", {
        code: "TIMEOUT",
        stderr: "partial output",
        exitCode: null,
        signal: "SIGKILL",
      });
      expect(error.details).toEqual({
        code: "TIMEOUT",
        stderr: "partial output",
        exitCode: null,
        signal: "SIGKILL",
      });
    });
  });

  describe("ExportCancelledError", () => {
    it("should be an instance of SimpleffmpegError", () => {
      const error = new ExportCancelledError();
      expect(error).toBeInstanceOf(SimpleffmpegError);
      expect(error).toBeInstanceOf(ExportCancelledError);
    });

    it("should have default message", () => {
      const error = new ExportCancelledError();
      expect(error.name).toBe("ExportCancelledError");
      expect(error.message).toBe("Export was cancelled");
    });

    it("should accept custom message", () => {
      const error = new ExportCancelledError("custom cancel message");
      expect(error.message).toBe("custom cancel message");
    });
  });
});
