import { describe, it, expect } from "vitest";

const {
  buildAtempoChain,
  parseSilenceDetect,
  buildSpliceFilter,
  parseLoudnormJson,
  audioCodecArgs,
  layoutForChannels,
  DEFAULT_FADE_MS,
} = await import("../../src/core/audio.js");

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
}

describe("audio — buildAtempoChain", () => {
  it("passes a single in-range factor straight through", () => {
    expect(buildAtempoChain(1.1)).toEqual(["atempo=1.1"]);
    expect(buildAtempoChain(0.9)).toEqual(["atempo=0.9"]);
    expect(buildAtempoChain(1)).toEqual(["atempo=1"]);
    expect(buildAtempoChain(2)).toEqual(["atempo=2"]);
    expect(buildAtempoChain(0.5)).toEqual(["atempo=0.5"]);
  });

  it("chains stages for factors beyond a single atempo's [0.5, 2]", () => {
    expect(buildAtempoChain(3.2)).toEqual(["atempo=2", "atempo=1.6"]);
    expect(buildAtempoChain(4)).toEqual(["atempo=2", "atempo=2"]);
    expect(buildAtempoChain(0.3)).toEqual(["atempo=0.5", "atempo=0.6"]);
    expect(buildAtempoChain(0.25)).toEqual(["atempo=0.5", "atempo=0.5"]);
  });

  it("keeps the chained product equal to the requested factor", () => {
    for (const tempo of [0.25, 0.3, 0.7, 1.15, 2.5, 3.7, 4]) {
      const product = buildAtempoChain(tempo)
        .map((s) => parseFloat(s.split("=")[1]))
        .reduce((a, b) => a * b, 1);
      expect(product).toBeCloseTo(tempo, 5);
    }
  });

  it("rejects out-of-range and non-numeric tempos", () => {
    expectError(() => buildAtempoChain(0.2), "SimpleffmpegError");
    expectError(() => buildAtempoChain(4.1), "SimpleffmpegError");
    expectError(() => buildAtempoChain(NaN), "SimpleffmpegError");
    expectError(() => buildAtempoChain("1.5"), "SimpleffmpegError");
    expectError(() => buildAtempoChain(undefined), "SimpleffmpegError");
  });
});

describe("audio — parseSilenceDetect", () => {
  const STDERR = [
    "Input #0, wav, from 'x.wav':",
    "[silencedetect @ 0x600002f0] silence_start: 0.8",
    "[silencedetect @ 0x600002f0] silence_end: 2.3 | silence_duration: 1.5",
    "[silencedetect @ 0x600002f0] silence_start: 3.1",
    "[silencedetect @ 0x600002f0] silence_end: 5.1 | silence_duration: 2",
    "size=N/A time=00:00:05.90 bitrate=N/A speed= 500x",
  ].join("\n");

  it("parses start/end pairs into intervals", () => {
    expect(parseSilenceDetect(STDERR, 5.9)).toEqual([
      { start: 0.8, end: 2.3, duration: 1.5 },
      { start: 3.1, end: 5.1, duration: 2 },
    ]);
  });

  it("closes a trailing open silence at the file duration", () => {
    const stderr =
      "[silencedetect @ 0x1] silence_start: 4.2\nsize=N/A time=...";
    expect(parseSilenceDetect(stderr, 5.9)).toEqual([
      { start: 4.2, end: 5.9, duration: 1.7 },
    ]);
  });

  it("drops a trailing open silence when duration is unknown", () => {
    const stderr = "[silencedetect @ 0x1] silence_start: 4.2\n";
    expect(parseSilenceDetect(stderr, undefined)).toEqual([]);
  });

  it("clamps a slightly negative silence_start to zero", () => {
    const stderr =
      "[silencedetect @ 0x1] silence_start: -0.006\n[silencedetect @ 0x1] silence_end: 1.2 | silence_duration: 1.206\n";
    expect(parseSilenceDetect(stderr, 10)).toEqual([
      { start: 0, end: 1.2, duration: 1.2 },
    ]);
  });

  it("returns an empty array for silence-free output", () => {
    expect(parseSilenceDetect("frame=100 fps=0.0 ...", 10)).toEqual([]);
  });
});

describe("audio — buildSpliceFilter", () => {
  const BASE = { sampleRate: 44100, channels: 1, fadeMs: DEFAULT_FADE_MS };

  it("builds trim → fade → conform branches and a concat join", () => {
    const { filter, outLabel, outputDuration } = buildSpliceFilter({
      ...BASE,
      segments: [{ start: 0, end: 2 }, { silence: 0.7 }, { start: 3, end: 5.9 }],
    });
    expect(outLabel).toBe("[out]");
    expect(outputDuration).toBeCloseTo(5.6, 5);
    expect(filter).toContain("[0:a]atrim=start=0:end=2,asetpts=PTS-STARTPTS");
    expect(filter).toContain("afade=t=in:st=0:d=0.005");
    expect(filter).toContain("afade=t=out:st=1.995:d=0.005");
    expect(filter).toContain("anullsrc=r=44100:cl=mono,atrim=end=0.7");
    expect(filter).toContain("concat=n=3:v=0:a=1[out]");
    // every branch conformed so concat never sees mismatched inputs
    const conforms = filter.match(/aformat=sample_fmts=fltp/g);
    expect(conforms).toHaveLength(3);
  });

  it("shortens fades on segments too short to hold them", () => {
    const { filter } = buildSpliceFilter({
      ...BASE,
      segments: [{ start: 0, end: 0.01 }],
    });
    // 10ms segment: fade caps at dur/4 = 2.5ms, not the default 5ms
    expect(filter).toContain("afade=t=in:st=0:d=0.0025");
  });

  it("omits fades entirely when fadeMs is 0", () => {
    const { filter } = buildSpliceFilter({
      ...BASE,
      fadeMs: 0,
      segments: [{ start: 0, end: 2 }],
    });
    expect(filter).not.toContain("afade");
  });

  it("uses stereo layout for 2 channels and downmixes >2 to stereo", () => {
    expect(layoutForChannels(1)).toBe("mono");
    expect(layoutForChannels(2)).toBe("stereo");
    expect(layoutForChannels(6)).toBe("stereo");
  });
});

describe("audio — parseLoudnormJson", () => {
  const GOOD =
    "Parsed_loudnorm_0 @ 0x600\n{\n\"input_i\" : \"-28.13\",\n\"input_tp\" : \"-9.02\",\n\"input_lra\" : \"4.20\",\n\"input_thresh\" : \"-38.51\",\n\"output_i\" : \"-16.00\",\n\"target_offset\" : \"0.35\"\n}\n";

  it("parses the measurement block", () => {
    expect(parseLoudnormJson(GOOD)).toEqual({
      input_i: -28.13,
      input_tp: -9.02,
      input_lra: 4.2,
      input_thresh: -38.51,
      target_offset: 0.35,
    });
  });

  it("returns null when no block is present", () => {
    expect(parseLoudnormJson("no json here")).toBeNull();
  });

  it("returns null when a required field is missing or non-numeric", () => {
    expect(
      parseLoudnormJson("{\"input_i\": \"-28\", \"input_tp\": \"abc\"}"),
    ).toBeNull();
    expect(parseLoudnormJson("{\"input_i\": \"-28\"}")).toBeNull();
  });
});

describe("audio — audioCodecArgs", () => {
  it("selects encoders by extension", () => {
    expect(audioCodecArgs("/x/out.mp3", "t()")).toEqual([
      "-c:a",
      "libmp3lame",
      "-q:a",
      "2",
    ]);
    expect(audioCodecArgs("/x/out.m4a", "t()")).toEqual([
      "-c:a",
      "aac",
      "-b:a",
      "192k",
    ]);
    expect(audioCodecArgs("/x/OUT.WAV", "t()")).toEqual([
      "-c:a",
      "pcm_s16le",
    ]);
  });

  it("rejects unsupported extensions", () => {
    expectError(() => audioCodecArgs("/x/out.xyz", "t()"), "SimpleffmpegError");
    expectError(() => audioCodecArgs("/x/out", "t()"), "SimpleffmpegError");
  });
});
