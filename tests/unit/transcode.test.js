import { describe, it, expect } from "vitest";
import path from "path";

const {
  buildWebMp4Args,
  buildScaleFilter,
  validatePath,
  validateOptions,
  validateCustomArgsOutput,
  parseProgressBlock,
  isWebSafeMp4,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_THREADS,
} = await import("../../src/core/transcode.js");

// NOTE: We do not import TranscodeError and use `.toThrow(TranscodeError)`
// because vitest may load errors.js via both ESM import and internal require,
// producing two class identities. Check err.name / err.code instead.
function expectTranscodeError(fn, code) {
  let caught;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught, "expected function to throw").toBeDefined();
  expect(caught.name).toBe("TranscodeError");
  if (code) expect(caught.code).toBe(code);
}

describe("transcode — buildWebMp4Args", () => {
  const IN = "/abs/in.mov";
  const OUT = "/abs/out.mp4";

  it("emits the expected flag order and defaults", () => {
    const args = buildWebMp4Args({ inputPath: IN, outputPath: OUT });

    // Spot-check full ordering by joining — easier to read than indexed asserts
    const joined = args.join(" ");
    expect(joined).toBe(
      [
        "-nostdin -y -hide_banner -loglevel error",
        "-fflags +discardcorrupt -err_detect ignore_err",
        "-progress pipe:1",
        `-i ${IN}`,
        "-map 0:v:0 -map 0:a:0?",
        "-c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p",
        "-profile:v high -level 4.1",
        "-vf scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
        "-c:a aac -b:a 128k -ac 2",
        "-movflags +faststart -f mp4",
        `-fs ${DEFAULT_MAX_OUTPUT_BYTES}`,
        `-threads ${DEFAULT_THREADS}`,
        OUT,
      ].join(" "),
    );
  });

  it("honors crf override", () => {
    const args = buildWebMp4Args({ inputPath: IN, outputPath: OUT, crf: 20 });
    const i = args.indexOf("-crf");
    expect(args[i + 1]).toBe("20");
  });

  it("honors audioBitrate override", () => {
    const args = buildWebMp4Args({
      inputPath: IN,
      outputPath: OUT,
      audioBitrate: "192k",
    });
    const i = args.indexOf("-b:a");
    expect(args[i + 1]).toBe("192k");
  });

  it("honors threads override", () => {
    const args = buildWebMp4Args({
      inputPath: IN,
      outputPath: OUT,
      threads: 4,
    });
    const i = args.indexOf("-threads");
    expect(args[i + 1]).toBe("4");
  });

  it("honors maxOutputBytes override", () => {
    const args = buildWebMp4Args({
      inputPath: IN,
      outputPath: OUT,
      maxOutputBytes: 1024,
    });
    const i = args.indexOf("-fs");
    expect(args[i + 1]).toBe("1024");
  });

  it("adds -b:v when videoBitrate provided", () => {
    const args = buildWebMp4Args({
      inputPath: IN,
      outputPath: OUT,
      videoBitrate: "2M",
    });
    const i = args.indexOf("-b:v");
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe("2M");
  });

  it("omits -b:v when videoBitrate absent", () => {
    const args = buildWebMp4Args({ inputPath: IN, outputPath: OUT });
    expect(args.indexOf("-b:v")).toBe(-1);
  });

  it("composes user scale before even-dim trunc", () => {
    const args = buildWebMp4Args({
      inputPath: IN,
      outputPath: OUT,
      scale: { width: 1280 },
    });
    const i = args.indexOf("-vf");
    expect(args[i + 1]).toBe(
      "scale=1280:-2,scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
    );
  });

  it("uses only even-dim trunc when no scale provided", () => {
    const args = buildWebMp4Args({ inputPath: IN, outputPath: OUT });
    const i = args.indexOf("-vf");
    expect(args[i + 1]).toBe("scale='trunc(iw/2)*2':'trunc(ih/2)*2'");
  });
});

describe("transcode — buildScaleFilter", () => {
  it("returns null for undefined", () => {
    expect(buildScaleFilter(undefined)).toBeNull();
  });

  it("returns scale=W:H when both provided", () => {
    expect(buildScaleFilter({ width: 1280, height: 720 })).toBe(
      "scale=1280:720",
    );
  });

  it("uses -2 for missing height (preserves aspect, keeps even)", () => {
    expect(buildScaleFilter({ width: 1280 })).toBe("scale=1280:-2");
  });

  it("uses -2 for missing width (preserves aspect, keeps even)", () => {
    expect(buildScaleFilter({ height: 720 })).toBe("scale=-2:720");
  });

  it("returns null for empty object", () => {
    expect(buildScaleFilter({})).toBeNull();
  });
});

describe("transcode — validatePath", () => {
  it("resolves a relative path to absolute", () => {
    const result = validatePath("./file.mp4", "inputPath");
    expect(path.isAbsolute(result)).toBe(true);
    expect(result.endsWith("file.mp4")).toBe(true);
  });

  it("accepts an absolute path", () => {
    const result = validatePath("/tmp/file.mp4", "inputPath");
    expect(result).toBe("/tmp/file.mp4");
  });

  it("rejects a path whose basename starts with '-'", () => {
    expectTranscodeError(() => validatePath("-flag.mp4", "inputPath"), "INVALID_PATH");
  });

  it("rejects a resolved path whose basename starts with '-'", () => {
    expectTranscodeError(
      () => validatePath("./-flag.mp4", "outputPath"),
      "INVALID_PATH",
    );
  });

  it("rejects an empty string", () => {
    expectTranscodeError(() => validatePath("", "inputPath"), "INVALID_PATH");
  });

  it("rejects non-string input", () => {
    expectTranscodeError(() => validatePath(null, "inputPath"), "INVALID_PATH");
    expectTranscodeError(() => validatePath(42, "inputPath"), "INVALID_PATH");
  });
});

describe("transcode — parseProgressBlock", () => {
  it("returns percent from out_time_us relative to duration", () => {
    const block = [
      "frame=100",
      "fps=30.0",
      "out_time_us=5000000",
      "progress=continue",
      "",
    ].join("\n");
    // 5s out of 10s total = 50%
    expect(parseProgressBlock(block, 10)).toBe(50);
  });

  it("caps at 99 to leave room for the 100 call on success", () => {
    const block = "out_time_us=10000000\nprogress=end\n";
    // 10s out of 10s = 100%, but we cap at 99
    expect(parseProgressBlock(block, 10)).toBe(99);
  });

  it("returns null when out_time_us is missing", () => {
    expect(parseProgressBlock("progress=continue\n", 10)).toBeNull();
  });

  it("returns null when duration is unknown", () => {
    expect(parseProgressBlock("out_time_us=1000000\n", 0)).toBeNull();
    expect(parseProgressBlock("out_time_us=1000000\n", NaN)).toBeNull();
  });

  it("returns 0 early in the transcode", () => {
    expect(parseProgressBlock("out_time_us=100000\n", 60)).toBe(0);
  });
});

describe("transcode — validateOptions", () => {
  function expectSimpleffmpegError(fn, fragment) {
    let caught;
    try {
      fn();
    } catch (err) {
      caught = err;
    }
    expect(caught, "expected function to throw").toBeDefined();
    expect(caught.name).toBe("SimpleffmpegError");
    if (fragment) expect(caught.message).toContain(fragment);
  }

  it("accepts an empty options object (all fields optional)", () => {
    expect(() => validateOptions({})).not.toThrow();
  });

  it("accepts sensible values across every field", () => {
    expect(() =>
      validateOptions({
        timeoutMs: 60000,
        maxOutputBytes: 1024 * 1024,
        threads: 4,
        crf: 20,
        scale: { width: 1280, height: 720 },
        audioBitrate: "192k",
        videoBitrate: "2M",
      }),
    ).not.toThrow();
  });

  it("rejects non-positive timeoutMs (would fire setTimeout immediately)", () => {
    expectSimpleffmpegError(() => validateOptions({ timeoutMs: 0 }), "timeoutMs");
    expectSimpleffmpegError(() => validateOptions({ timeoutMs: -100 }), "timeoutMs");
    expectSimpleffmpegError(() => validateOptions({ timeoutMs: NaN }), "timeoutMs");
    expectSimpleffmpegError(() => validateOptions({ timeoutMs: "60" }), "timeoutMs");
  });

  it("rejects non-positive maxOutputBytes", () => {
    expectSimpleffmpegError(() => validateOptions({ maxOutputBytes: 0 }), "maxOutputBytes");
    expectSimpleffmpegError(() => validateOptions({ maxOutputBytes: -1 }), "maxOutputBytes");
  });

  it("rejects non-positive-integer threads", () => {
    expectSimpleffmpegError(() => validateOptions({ threads: 0 }), "threads");
    expectSimpleffmpegError(() => validateOptions({ threads: 2.5 }), "threads");
    expectSimpleffmpegError(() => validateOptions({ threads: -1 }), "threads");
  });

  it("rejects crf outside [0, 51] or non-integer", () => {
    expectSimpleffmpegError(() => validateOptions({ crf: -1 }), "crf");
    expectSimpleffmpegError(() => validateOptions({ crf: 52 }), "crf");
    expectSimpleffmpegError(() => validateOptions({ crf: 23.5 }), "crf");
  });

  it("accepts crf at the boundaries", () => {
    expect(() => validateOptions({ crf: 0 })).not.toThrow();
    expect(() => validateOptions({ crf: 51 })).not.toThrow();
  });

  it("rejects non-object or array scale", () => {
    expectSimpleffmpegError(() => validateOptions({ scale: "1280x720" }), "scale");
    expectSimpleffmpegError(() => validateOptions({ scale: [1280, 720] }), "scale");
  });

  it("rejects non-positive-integer scale dimensions", () => {
    expectSimpleffmpegError(() => validateOptions({ scale: { width: 0 } }), "width");
    expectSimpleffmpegError(() => validateOptions({ scale: { height: -1 } }), "height");
    expectSimpleffmpegError(() => validateOptions({ scale: { width: 1280.5 } }), "width");
  });

  it("accepts a partial scale (one dim only)", () => {
    expect(() => validateOptions({ scale: { width: 1280 } })).not.toThrow();
    expect(() => validateOptions({ scale: { height: 720 } })).not.toThrow();
    expect(() => validateOptions({ scale: {} })).not.toThrow();
  });

  it("rejects non-string or empty bitrate strings", () => {
    expectSimpleffmpegError(() => validateOptions({ audioBitrate: "" }), "audioBitrate");
    expectSimpleffmpegError(() => validateOptions({ audioBitrate: 128 }), "audioBitrate");
    expectSimpleffmpegError(() => validateOptions({ videoBitrate: "" }), "videoBitrate");
    expectSimpleffmpegError(() => validateOptions({ videoBitrate: 2_000_000 }), "videoBitrate");
  });
});

describe("transcode — validateCustomArgsOutput", () => {
  function expectSimpleffmpegError(fn, fragment) {
    let caught;
    try {
      fn();
    } catch (err) {
      caught = err;
    }
    expect(caught, "expected function to throw").toBeDefined();
    expect(caught.name).toBe("SimpleffmpegError");
    if (fragment) expect(caught.message).toContain(fragment);
  }

  it("accepts when last arg matches the resolved output exactly", () => {
    expect(() =>
      validateCustomArgsOutput(["-i", "/a/in.mp4", "/a/out.mp4"], "/a/out.mp4"),
    ).not.toThrow();
  });

  it("accepts a relative last arg that resolves to the same absolute path", () => {
    const abs = path.resolve("./out.mp4");
    expect(() =>
      validateCustomArgsOutput(["-i", "/a/in.mp4", "./out.mp4"], abs),
    ).not.toThrow();
  });

  it("rejects when last arg resolves to a different path", () => {
    expectSimpleffmpegError(
      () => validateCustomArgsOutput(["-i", "/a/in.mp4", "/a/other.mp4"], "/a/out.mp4"),
      "last element",
    );
  });

  it("rejects an empty argv", () => {
    expectSimpleffmpegError(() => validateCustomArgsOutput([], "/a/out.mp4"), "must not be empty");
  });

  it("rejects when last arg is a non-string (e.g. accidental number)", () => {
    expectSimpleffmpegError(
      () => validateCustomArgsOutput(["-i", "/a/in.mp4", 42], "/a/out.mp4"),
      "last element",
    );
  });
});

describe("transcode — isWebSafeMp4", () => {
  const base = {
    hasVideo: true,
    hasAudio: true,
    videoCodec: "h264",
    format: "mov,mp4,m4a,3gp,3g2,mj2",
    pixelFormat: "yuv420p",
  };

  it("returns true for the canonical h264/mp4/yuv420p case", () => {
    expect(isWebSafeMp4(base)).toBe(true);
  });

  it("returns false for webm container", () => {
    expect(isWebSafeMp4({ ...base, format: "matroska,webm" })).toBe(false);
  });

  it("returns false for non-h264 codec", () => {
    expect(isWebSafeMp4({ ...base, videoCodec: "hevc" })).toBe(false);
    expect(isWebSafeMp4({ ...base, videoCodec: "vp9" })).toBe(false);
  });

  it("returns false for 10-bit yuv420p10le (HDR source)", () => {
    expect(isWebSafeMp4({ ...base, pixelFormat: "yuv420p10le" })).toBe(false);
  });

  it("returns false when hasVideo is false (audio-only)", () => {
    expect(isWebSafeMp4({ ...base, hasVideo: false })).toBe(false);
  });

  it("returns false for null/undefined input", () => {
    expect(isWebSafeMp4(null)).toBe(false);
    expect(isWebSafeMp4(undefined)).toBe(false);
  });

  it("is tolerant when pixelFormat is missing (legacy MediaInfo)", () => {
    const withoutPixFmt = { ...base };
    delete withoutPixFmt.pixelFormat;
    expect(isWebSafeMp4(withoutPixFmt)).toBe(true);
  });
});
