import { describe, it, expect } from "vitest";

// Dynamic import for CommonJS module
const { buildVideoFilter } = await import("../../src/ffmpeg/video_builder.js");

describe("buildVideoFilter", () => {
  const createProject = (options = {}) => ({
    options: {
      fps: options.fps || 30,
      width: options.width || 1920,
      height: options.height || 1080,
      fillGaps: options.fillGaps || "none",
    },
    videoOrAudioClips: [],
  });

  describe("basic video handling", () => {
    it("should return empty result for no video clips", () => {
      const project = createProject();
      const result = buildVideoFilter(project, []);

      expect(result.filter).toBe("");
      expect(result.finalVideoLabel).toBeNull();
      expect(result.hasVideo).toBe(false);
    });

    it("should build filter for single video clip", () => {
      const project = createProject();
      const clip = {
        type: "video",
        url: "./test.mp4",
        position: 0,
        end: 5,
        cutFrom: 0,
        mediaDuration: 10,
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.hasVideo).toBe(true);
      expect(result.finalVideoLabel).toBe("[outv]");
      expect(result.filter).toContain("[0:v]");
      expect(result.filter).toContain("trim=start=0:duration=5");
      expect(result.filter).toContain("fps=30");
      expect(result.filter).toContain("scale=1920:1080");
      expect(result.filter).toContain("concat=n=1:v=1:a=0");
    });

    it("should concatenate multiple video clips without transitions", () => {
      const project = createProject();
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 3,
          cutFrom: 0,
          mediaDuration: 10,
        },
        {
          type: "video",
          url: "./b.mp4",
          position: 3,
          end: 6,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      expect(result.hasVideo).toBe(true);
      expect(result.filter).toContain("concat=n=2:v=1:a=0");
    });
  });

  describe("transitions", () => {
    it("should apply xfade transition between clips", () => {
      const project = createProject();
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 3,
          cutFrom: 0,
          mediaDuration: 10,
        },
        {
          type: "video",
          url: "./b.mp4",
          position: 2.5,
          end: 5.5,
          cutFrom: 0,
          mediaDuration: 10,
          transition: { type: "fade", duration: 0.5 },
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      expect(result.filter).toContain("xfade=transition=fade:duration=0.5");
    });

    it("should handle multiple transitions", () => {
      const project = createProject();
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 3,
          cutFrom: 0,
          mediaDuration: 10,
        },
        {
          type: "video",
          url: "./b.mp4",
          position: 2.5,
          end: 5.5,
          cutFrom: 0,
          mediaDuration: 10,
          transition: { type: "fade", duration: 0.5 },
        },
        {
          type: "video",
          url: "./c.mp4",
          position: 5,
          end: 8,
          cutFrom: 0,
          mediaDuration: 10,
          transition: { type: "wipeleft", duration: 0.5 },
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      expect(result.filter).toContain("xfade=transition=fade");
      expect(result.filter).toContain("xfade=transition=wipeleft");
    });
  });

  describe("image clips with Ken Burns", () => {
    it("should apply zoompan for zoom-in effect", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "zoom-in",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.hasVideo).toBe(true);
      expect(result.filter).toContain("zoompan=");
      expect(result.filter).toContain("zoom+");
    });

    it("should apply zoompan for zoom-out effect", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "zoom-out",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
      expect(result.filter).toContain("zoom-");
    });

    it("should apply zoompan for pan-left effect", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "pan-left",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
    });

    it("should apply zoompan for pan-right effect", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "pan-right",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
    });

    it("should use unescaped commas inside single-quoted zoompan expressions", () => {
      // Commas inside single-quoted zoompan z/x/y values should NOT use \,
      // because FFmpeg's av_get_token does not unescape inside single quotes.
      // \, would produce literal backslash+comma in the expression evaluator.
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "zoom-in",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // The zoompan z expression should have plain commas (not \,) inside quotes
      expect(result.filter).toContain("z='if(eq(on,0),1,zoom+");
      // Should NOT have \\, inside the quoted expression
      expect(result.filter).not.toMatch(/z='[^']*\\\\,[^']*'/);
      expect(result.filter).not.toMatch(/z='[^']*\\,[^']*'/);
    });

    it("should use single-quoted select for image kenBurns", () => {
      // select expression should be quoted to protect commas
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "zoom-out",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // select should use single quotes
      expect(result.filter).toContain("select='eq(n,0)'");
      // Should NOT have the old \, pattern
      expect(result.filter).not.toContain("select=eq(n\\,0)");
    });

    it("should use unescaped commas in zoom-out expression", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "zoom-out",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // zoom-out expression: if(eq(on,0),START,zoom-DEC)
      expect(result.filter).toMatch(/z='if\(eq\(on,0\),[^']+,zoom-[^']+\)'/);
    });

    it("should handle image without Ken Burns", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.hasVideo).toBe(true);
      // Should use trim-based approach without zoompan
      expect(result.filter).toContain("trim=");
    });
  });

  describe("media duration clamping", () => {
    it("should clamp clip duration to available media", () => {
      const project = createProject();
      const clip = {
        type: "video",
        url: "./test.mp4",
        position: 0,
        end: 10, // Requesting 10 seconds
        cutFrom: 8, // Starting at 8 seconds
        mediaDuration: 10, // Only 2 seconds available
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // Should trim to 2 seconds (mediaDuration - cutFrom)
      expect(result.filter).toContain("duration=2");
    });
  });

  describe("custom dimensions and fps", () => {
    it("should use custom dimensions", () => {
      const project = createProject({ width: 1080, height: 1920 });
      const clip = {
        type: "video",
        url: "./test.mp4",
        position: 0,
        end: 5,
        cutFrom: 0,
        mediaDuration: 10,
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("scale=1080:1920");
      expect(result.filter).toContain("pad=1080:1920");
    });

    it("should use custom fps", () => {
      const project = createProject({ fps: 60 });
      const clip = {
        type: "video",
        url: "./test.mp4",
        position: 0,
        end: 5,
        cutFrom: 0,
        mediaDuration: 10,
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("fps=60");
    });
  });

  describe("gap filling with black frames", () => {
    it("should not fill gaps when fillGaps is 'none' (default)", () => {
      const project = createProject({ fillGaps: "none" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 2,
          end: 5,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      // Should only have one scaled stream (no black fill)
      expect(result.filter).not.toContain("color=c=black");
      expect(result.filter).toContain("concat=n=1");
    });

    it("should fill leading gap with black when fillGaps is 'black'", () => {
      const project = createProject({ fillGaps: "black" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 2,
          end: 5,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      // Should have black fill for the leading gap (0-2 seconds)
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2");
      // Should concatenate two streams (black + video)
      expect(result.filter).toContain("concat=n=2");
    });

    it("should fill middle gap with black when fillGaps is 'black'", () => {
      const project = createProject({ fillGaps: "black" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 3,
          cutFrom: 0,
          mediaDuration: 10,
        },
        {
          type: "video",
          url: "./b.mp4",
          position: 5,
          end: 8,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      // Should have black fill for the gap (3-5 seconds)
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2");
      // Should concatenate three streams (video + black + video)
      expect(result.filter).toContain("concat=n=3");
    });

    it("should fill multiple gaps with black frames", () => {
      const project = createProject({ fillGaps: "black" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 1,
          end: 3,
          cutFrom: 0,
          mediaDuration: 10,
        },
        {
          type: "video",
          url: "./b.mp4",
          position: 5,
          end: 7,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      // Should have two black fills: leading gap (0-1) and middle gap (3-5)
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=1"); // 0-1 gap
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2"); // 3-5 gap
      // Should concatenate four streams
      expect(result.filter).toContain("concat=n=4");
    });

    it("should not add black frames when there are no gaps", () => {
      const project = createProject({ fillGaps: "black" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 3,
          cutFrom: 0,
          mediaDuration: 10,
        },
        {
          type: "video",
          url: "./b.mp4",
          position: 3,
          end: 6,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      // Should not have any black fill
      expect(result.filter).not.toContain("color=c=black");
      expect(result.filter).toContain("concat=n=2");
    });

    it("should use correct dimensions for black frames", () => {
      const project = createProject({
        fillGaps: "black",
        width: 1080,
        height: 1920,
      });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 2,
          end: 5,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      expect(result.filter).toContain("color=c=black:s=1080x1920:d=2");
    });

    it("should use correct fps for black frames", () => {
      const project = createProject({ fillGaps: "black", fps: 60 });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 2,
          end: 5,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips);

      expect(result.filter).toContain("color=c=black");
      expect(result.filter).toContain("fps=60");
    });
  });
});
