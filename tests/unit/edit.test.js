import { describe, it, expect } from "vitest";

const {
  displayedSize,
  reverseMemoryEstimate,
  buildGifFilter,
  resolveCropRect,
  rotateFilter,
  changeSpeed,
  trim,
  toGif,
  crop,
  reverse,
  DEFAULT_REVERSE_MAX_MEMORY_BYTES,
} = await import("../../src/core/edit.js");
const { buildFadeFilter, buildKeepVideoLoudnessArgs, fadeAudio, normalizeLoudness } =
  await import("../../src/core/audio.js");
const { webVideoChain, buildWebMp4OutputArgs, COLOR_TAG, EVEN_TRUNC } =
  await import("../../src/core/transcode.js");

// See tests/unit/transcode.test.js for why we assert err.name instead of
// importing the error classes (dual ESM/CJS class identities under vitest).
function expectError(fn, name) {
  let caught;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught, "expected function to throw").toBeDefined();
  expect(caught.name).toBe(name);
  return caught;
}

async function expectRejection(promise, name) {
  let caught;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught, "expected promise to reject").toBeDefined();
  expect(caught.name).toBe(name);
  return caught;
}

describe("edit — displayedSize", () => {
  it("returns the stored size for an upright video", () => {
    expect(displayedSize({ width: 1920, height: 1080, rotation: 0 })).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("swaps the sides for quarter turns, either direction", () => {
    for (const rotation of [90, -90, 270, -270]) {
      expect(displayedSize({ width: 1920, height: 1080, rotation })).toEqual({
        width: 1080,
        height: 1920,
      });
    }
    expect(displayedSize({ width: 1920, height: 1080, rotation: 180 })).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("is null when the size is unknown", () => {
    expect(displayedSize({ width: null, height: null })).toBeNull();
    expect(displayedSize(null)).toBeNull();
  });
});

describe("edit — reverseMemoryEstimate", () => {
  it("counts every decoded yuv420p frame", () => {
    // 320x240 × 1.5 bytes × 25 fps × 2 s
    expect(
      reverseMemoryEstimate({ width: 320, height: 240, fps: 25, duration: 2 }),
    ).toBe(320 * 240 * 1.5 * 25 * 2);
  });

  it("assumes 30 fps when the rate is unknown", () => {
    expect(
      reverseMemoryEstimate({ width: 100, height: 100, fps: null, duration: 1 }),
    ).toBe(100 * 100 * 1.5 * 30);
  });

  it("puts the 1 GiB default at about 11 s of 1080p30", () => {
    const perSecond = reverseMemoryEstimate({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 1,
    });
    expect(Math.floor(DEFAULT_REVERSE_MAX_MEMORY_BYTES / perSecond)).toBe(11);
  });

  it("is null without a duration", () => {
    expect(reverseMemoryEstimate({ width: 320, height: 240, fps: 30 })).toBeNull();
  });
});

describe("edit — buildGifFilter", () => {
  it("builds one graph with a palette from the clip, never upscaling", () => {
    const f = buildGifFilter({ fps: 12, width: 480 });
    expect(f).toContain("fps=12");
    expect(f).toContain("scale='min(480,iw)':-1:flags=lanczos");
    expect(f).toContain("palettegen");
    expect(f).toContain("paletteuse");
    expect(f.endsWith("[out]")).toBe(true);
  });
});

describe("edit — resolveCropRect", () => {
  const size = { width: 1920, height: 1080 };

  it("centers by default", () => {
    expect(resolveCropRect({ width: 608, height: 1080 }, size)).toEqual({
      width: 608,
      height: 1080,
      x: 656,
      y: 0,
    });
  });

  it("uses explicit x/y", () => {
    expect(resolveCropRect({ width: 100, height: 50, x: 10, y: 20 }, size)).toEqual({
      width: 100,
      height: 50,
      x: 10,
      y: 20,
    });
  });

  it("refuses rectangles that leave the frame", () => {
    expectError(() => resolveCropRect({ width: 2000, height: 100 }, size), "SimpleffmpegError");
    expectError(
      () => resolveCropRect({ width: 100, height: 100, x: 1900, y: 0 }, size),
      "SimpleffmpegError",
    );
  });

  it("refuses non-integer sizes and negative offsets", () => {
    expectError(() => resolveCropRect({ width: 10.5, height: 10 }, size), "SimpleffmpegError");
    expectError(
      () => resolveCropRect({ width: 10, height: 10, x: -1 }, size),
      "SimpleffmpegError",
    );
  });
});

describe("edit — rotateFilter", () => {
  it("maps quarter and half turns", () => {
    expect(rotateFilter(90)).toBe("transpose=1");
    expect(rotateFilter(270)).toBe("transpose=2");
    expect(rotateFilter(-90)).toBe("transpose=2");
    expect(rotateFilter(180)).toBe("hflip,vflip");
  });

  it("refuses anything else", () => {
    for (const d of [0, 45, 360, "90", undefined]) {
      expectError(() => rotateFilter(d), "SimpleffmpegError");
    }
  });
});

describe("audio — buildFadeFilter", () => {
  it("fades in from 0 and out to the end", () => {
    expect(buildFadeFilter({ fadeInSec: 1, fadeOutSec: 2, duration: 10 })).toBe(
      "afade=t=in:st=0:d=1,afade=t=out:st=8:d=2",
    );
  });

  it("leaves a zero fade out", () => {
    expect(buildFadeFilter({ fadeInSec: 0, fadeOutSec: 1.5, duration: 4 })).toBe(
      "afade=t=out:st=2.5:d=1.5",
    );
  });
});

describe("audio — buildKeepVideoLoudnessArgs", () => {
  const base = {
    inputPath: "/in.mp4",
    outputPath: "/out.mp4",
    audioFilter: "loudnorm=I=-16",
    sampleRate: 48000,
  };

  it("copies a web-safe picture and re-encodes only the audio", () => {
    const argv = buildKeepVideoLoudnessArgs({ ...base, copyVideo: true });
    expect(argv).toContain("copy");
    expect(argv.slice(argv.indexOf("-c:v"), argv.indexOf("-c:v") + 2)).toEqual([
      "-c:v",
      "copy",
    ]);
    expect(argv).not.toContain("-vf");
    expect(argv.at(-1)).toBe("/out.mp4");
    expect(argv).toContain("+faststart");
  });

  it("re-encodes anything else to the web-safe mp4", () => {
    const argv = buildKeepVideoLoudnessArgs({ ...base, copyVideo: false });
    expect(argv).toContain("-vf");
    expect(argv).toContain("libx264");
    expect(argv.at(-1)).toBe("/out.mp4");
  });
});

describe("transcode — shared video helpers", () => {
  it("wraps caller filters in the SDR retag and even truncation", () => {
    expect(webVideoChain()).toBe(`${COLOR_TAG},${EVEN_TRUNC}`);
    expect(webVideoChain("reverse", null)).toBe(`${COLOR_TAG},reverse,${EVEN_TRUNC}`);
  });

  it("drops audio with -an when asked", () => {
    const argv = buildWebMp4OutputArgs({ outputPath: "/o.mp4", withAudio: false });
    expect(argv).toContain("-an");
    expect(argv).not.toContain("aac");
  });
});

describe("edit — argument validation before any ffmpeg run", () => {
  it("changeSpeed refuses speeds outside [0.25, 4]", async () => {
    for (const speed of [0, 0.1, 5, Number.NaN, "2"]) {
      await expectRejection(
        changeSpeed("/nope.mp4", { outputPath: "/o.mp4", speed }),
        "SimpleffmpegError",
      );
    }
  });

  it("trim refuses an end before its start", async () => {
    await expectRejection(
      trim("/nope.mp4", { outputPath: "/o.mp4", start: 5, end: 2 }),
      "SimpleffmpegError",
    );
    await expectRejection(
      trim("/nope.mp4", { outputPath: "/o.mp4", start: -1, end: 2 }),
      "SimpleffmpegError",
    );
  });

  it("video operations refuse a non-mp4 output", async () => {
    await expectRejection(
      crop("/nope.mp4", { outputPath: "/o.mov", width: 10, height: 10 }),
      "SimpleffmpegError",
    );
    await expectRejection(reverse("/nope.mp4", { outputPath: "/o.webm" }), "SimpleffmpegError");
  });

  it("video operations refuse a bad crf before probing", async () => {
    await expectRejection(
      crop("/nope.mp4", { outputPath: "/o.mp4", width: 10, height: 10, crf: 60 }),
      "SimpleffmpegError",
    );
  });

  it("toGif refuses a non-gif output and bad fps", async () => {
    await expectRejection(toGif("/nope.mp4", { outputPath: "/o.mp4" }), "SimpleffmpegError");
    await expectRejection(
      toGif("/nope.mp4", { outputPath: "/o.gif", fps: 0 }),
      "SimpleffmpegError",
    );
  });

  it("fadeAudio needs at least one fade", async () => {
    await expectRejection(fadeAudio("/nope.mp3", { outputPath: "/o.mp3" }), "SimpleffmpegError");
    await expectRejection(
      fadeAudio("/nope.mp3", { outputPath: "/o.mp3", fadeInSec: -1 }),
      "SimpleffmpegError",
    );
  });

  it("normalizeLoudness refuses a non-boolean keepVideo", async () => {
    await expectRejection(
      normalizeLoudness("/nope.mp4", { outputPath: "/o.mp4", keepVideo: "yes" }),
      "SimpleffmpegError",
    );
  });
});
