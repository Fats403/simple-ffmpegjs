import { describe, it, expect } from "vitest";

const {
  buildMainCommand,
  buildThumbnailCommand,
  buildSnapshotCommand,
  escapeMetadata,
  sanitizeFilterComplex,
} = await import("../../src/ffmpeg/command_builder.js");

describe("Command Builder", () => {
  describe("buildMainCommand", () => {
    const baseParams = {
      inputs: '-i "input.mp4"',
      filterComplex: "[0:v]scale=1920:1080[outv]",
      mapVideo: "[outv]",
      mapAudio: "[outa]",
      hasVideo: true,
      hasAudio: true,
      videoCodec: "libx264",
      videoPreset: "medium",
      videoCrf: 23,
      audioCodec: "aac",
      audioBitrate: "192k",
      shortest: true,
      faststart: true,
      outputPath: "./output.mp4",
    };

    it("should build basic command with defaults", () => {
      const cmd = buildMainCommand(baseParams);

      expect(cmd).toContain("ffmpeg -y");
      expect(cmd).toContain('-i "input.mp4"');
      expect(cmd).toContain("-filter_complex");
      expect(cmd).toContain("-c:v libx264");
      expect(cmd).toContain("-preset medium");
      expect(cmd).toContain("-crf 23");
      expect(cmd).toContain("-c:a aac");
      expect(cmd).toContain("-b:a 192k");
      expect(cmd).toContain("-movflags +faststart");
      expect(cmd).toContain('"./output.mp4"');
    });

    it("should use videoBitrate instead of CRF when provided", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        videoBitrate: "5M",
        videoCrf: null,
      });

      expect(cmd).toContain("-b:v 5M");
      expect(cmd).not.toContain("-crf");
    });

    it("should add hardware acceleration flag", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        hwaccel: "auto",
      });

      expect(cmd).toContain("-hwaccel auto");
    });

    it("should handle videotoolbox hwaccel", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        hwaccel: "videotoolbox",
      });

      expect(cmd).toContain("-hwaccel videotoolbox");
    });

    it("should handle nvenc hwaccel", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        hwaccel: "nvenc",
      });

      expect(cmd).toContain("-hwaccel cuda");
    });

    it("should skip video for audio-only export", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        audioOnly: true,
      });

      expect(cmd).not.toContain("-c:v");
      expect(cmd).not.toContain('-map "[outv]"');
      expect(cmd).toContain("-c:a aac");
    });

    it("should add metadata flags", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        metadata: {
          title: "My Video",
          artist: "Test Artist",
          comment: "Test comment",
        },
      });

      expect(cmd).toContain('-metadata title="My Video"');
      expect(cmd).toContain('-metadata artist="Test Artist"');
      expect(cmd).toContain('-metadata comment="Test comment"');
    });

    it("should handle custom metadata", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        metadata: {
          custom: {
            mykey: "myvalue",
          },
        },
      });

      expect(cmd).toContain('-metadata mykey="myvalue"');
    });

    it("should handle two-pass encoding first pass", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        twoPass: true,
        passNumber: 1,
        passLogFile: "/tmp/ffmpeg2pass",
        videoBitrate: "5M",
        videoCrf: null,
      });

      expect(cmd).toContain("-pass 1");
      expect(cmd).toContain('-passlogfile "/tmp/ffmpeg2pass"');
      expect(cmd).toContain("-f null /dev/null");
    });

    it("should handle two-pass encoding second pass", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        twoPass: true,
        passNumber: 2,
        passLogFile: "/tmp/ffmpeg2pass",
        videoBitrate: "5M",
        videoCrf: null,
      });

      expect(cmd).toContain("-pass 2");
      expect(cmd).toContain('-passlogfile "/tmp/ffmpeg2pass"');
      expect(cmd).not.toContain("-f null");
      expect(cmd).toContain('"./output.mp4"');
    });

    it("should add sample rate when provided", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        audioSampleRate: 44100,
      });

      expect(cmd).toContain("-ar 44100");
    });

    it("should not add faststart for non-mp4 files", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        outputPath: "./output.webm",
      });

      expect(cmd).not.toContain("-movflags +faststart");
    });

    it("should not add preset for nvenc codecs", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        videoCodec: "h264_nvenc",
      });

      expect(cmd).toContain("-c:v h264_nvenc");
      expect(cmd).not.toContain("-preset");
    });

    it("should use cq for nvenc instead of crf", () => {
      const cmd = buildMainCommand({
        ...baseParams,
        videoCodec: "h264_nvenc",
        videoCrf: 23,
      });

      expect(cmd).toContain("-cq 23");
      expect(cmd).not.toContain("-crf");
    });
  });

  describe("buildThumbnailCommand", () => {
    it("should build basic thumbnail command", () => {
      const cmd = buildThumbnailCommand({
        inputPath: "./video.mp4",
        outputPath: "./thumb.jpg",
        time: 5,
      });

      expect(cmd).toContain("ffmpeg -y");
      expect(cmd).toContain("-ss 5");
      expect(cmd).toContain('-i "./video.mp4"');
      expect(cmd).toContain("-vframes 1");
      expect(cmd).toContain('"./thumb.jpg"');
    });

    it("should add scale filter when dimensions provided", () => {
      const cmd = buildThumbnailCommand({
        inputPath: "./video.mp4",
        outputPath: "./thumb.jpg",
        time: 2.5,
        width: 640,
        height: 360,
      });

      expect(cmd).toContain('-vf "scale=640:360"');
    });

    it("should handle width only (maintain aspect)", () => {
      const cmd = buildThumbnailCommand({
        inputPath: "./video.mp4",
        outputPath: "./thumb.jpg",
        time: 0,
        width: 320,
      });

      expect(cmd).toContain('-vf "scale=320:-1"');
    });
  });

  describe("buildSnapshotCommand", () => {
    it("should build basic snapshot command", () => {
      const cmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.png",
        time: 5,
      });

      expect(cmd).toContain("ffmpeg -y");
      expect(cmd).toContain("-ss 5");
      expect(cmd).toContain('-i "./video.mp4"');
      expect(cmd).toContain("-vframes 1");
      expect(cmd).toContain('"./frame.png"');
    });

    it("should default time to 0", () => {
      const cmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.jpg",
      });

      expect(cmd).toContain("-ss 0");
    });

    it("should include scale filter when width and height provided", () => {
      const cmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.jpg",
        time: 2,
        width: 640,
        height: 360,
      });

      expect(cmd).toContain('-vf "scale=640:360"');
    });

    it("should handle width only (maintain aspect ratio)", () => {
      const cmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.jpg",
        time: 0,
        width: 320,
      });

      expect(cmd).toContain('-vf "scale=320:-1"');
    });

    it("should handle height only (maintain aspect ratio)", () => {
      const cmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.jpg",
        time: 0,
        height: 240,
      });

      expect(cmd).toContain('-vf "scale=-1:240"');
    });

    it("should include quality flag when provided", () => {
      const cmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.jpg",
        time: 3,
        quality: 4,
      });

      expect(cmd).toContain("-q:v 4");
    });

    it("should not include quality flag when not provided", () => {
      const cmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.png",
        time: 0,
      });

      expect(cmd).not.toContain("-q:v");
    });

    it("should support different output formats via extension", () => {
      const pngCmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.png",
      });
      expect(pngCmd).toContain('"./frame.png"');

      const webpCmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.webp",
      });
      expect(webpCmd).toContain('"./frame.webp"');

      const bmpCmd = buildSnapshotCommand({
        inputPath: "./video.mp4",
        outputPath: "./frame.bmp",
      });
      expect(bmpCmd).toContain('"./frame.bmp"');
    });
  });

  describe("escapeMetadata", () => {
    it("should escape backslashes", () => {
      expect(escapeMetadata("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("should escape double quotes", () => {
      expect(escapeMetadata('say "hello"')).toBe('say \\"hello\\"');
    });

    it("should escape newlines", () => {
      expect(escapeMetadata("line1\nline2")).toBe("line1\\nline2");
    });

    it("should handle mixed escapes", () => {
      expect(escapeMetadata('test\\path\n"quoted"')).toBe(
        'test\\\\path\\n\\"quoted\\"'
      );
    });
  });
});

describe("sanitizeFilterComplex", () => {
  it("strips trailing semicolons", () => {
    expect(sanitizeFilterComplex("[0:v]scale=1920:1080[outv];")).toBe(
      "[0:v]scale=1920:1080[outv]"
    );
  });

  it("strips leading semicolons", () => {
    expect(sanitizeFilterComplex(";[0:v]scale=1920:1080[outv]")).toBe(
      "[0:v]scale=1920:1080[outv]"
    );
  });

  it("collapses double semicolons", () => {
    expect(
      sanitizeFilterComplex(
        "[0:v]scale=1920:1080[outv];;[outv]vignette=angle=0.6283[fxout0]"
      )
    ).toBe(
      "[0:v]scale=1920:1080[outv];[outv]vignette=angle=0.6283[fxout0]"
    );
  });

  it("collapses triple semicolons", () => {
    expect(
      sanitizeFilterComplex("filter1[a];;;filter2[b]")
    ).toBe("filter1[a];filter2[b]");
  });

  it("returns null/empty/undefined unchanged", () => {
    expect(sanitizeFilterComplex("")).toBe("");
    expect(sanitizeFilterComplex(null)).toBe(null);
    expect(sanitizeFilterComplex(undefined)).toBe(undefined);
  });

  it("passes through valid filter complex unchanged", () => {
    const valid =
      "[0:v]scale=1920:1080[scaled0];[scaled0]fps=30[outv];[0:a]volume=1[outa]";
    expect(sanitizeFilterComplex(valid)).toBe(valid);
  });

  it("throws on chain segment with only labels (empty filter name)", () => {
    expect(() =>
      sanitizeFilterComplex("[a][b];[c][d]xfade=transition=dissolve[e]")
    ).toThrow(/Empty filter name/);
  });

  it("does not throw for valid multi-input filter chains", () => {
    // amix/xfade take multiple input labels — this is valid
    const fc =
      "[0:v]scale=1920:1080[v0];[v0][v1]xfade=transition=dissolve:duration=0.5[outv]";
    expect(() => sanitizeFilterComplex(fc)).not.toThrow();
  });
});
