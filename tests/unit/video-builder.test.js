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
      expect(result.filter).toContain("z='1+(0.15)*(");
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
      expect(result.filter).toContain("z='1.15+(-0.15)*(");
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

      // The zoompan z expression should not contain escaped commas
      expect(result.filter).toContain("z='1+(0.15)*(");
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

      // zoom-out expression: linear interpolation from 1.15 to 1.0
      expect(result.filter).toMatch(/z='1\.15\+\(-0\.15\)\*\(/);
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

    it("should support custom Ken Burns endpoints", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 4,
        kenBurns: {
          type: "custom",
          startZoom: 1.1,
          endZoom: 1.3,
          startX: 0.2,
          endX: 0.7,
          startY: 0.8,
          endY: 0.3,
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
      expect(result.filter).toContain("z='1.1+(0.2)*((on/119))'");
      expect(result.filter).toContain(
        "x='(iw - iw/zoom)*(0.2+(0.5)*((on/119)))'"
      );
      expect(result.filter).toContain(
        "y='(ih - ih/zoom)*(0.8+(-0.5)*((on/119)))'"
      );
    });

    it("should support smart Ken Burns with anchor", () => {
      const project = createProject({ width: 1080, height: 1920 });
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 4,
        width: 1080,
        height: 1920,
        kenBurns: {
          type: "smart",
          anchor: "top",
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
      expect(result.filter).toContain(
        "y='(ih - ih/zoom)*(0+(1)*((on/119)))'"
      );
    });

    it("should choose pan axis based on source vs output aspect", () => {
      const project = createProject({ width: 1920, height: 1080 });
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 4,
        width: 1080,
        height: 1920,
        kenBurns: {
          type: "smart",
          anchor: "top",
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
      expect(result.filter).toContain(
        "y='(ih - ih/zoom)*(0+(1)*((on/119)))'"
      );
    });

    it("should apply zoompan for pan-up effect", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "pan-up",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
      // pan-up: constant zoom, y goes from 1 to 0
      expect(result.filter).toContain("z='1.12'");
      expect(result.filter).toContain(
        "y='(ih - ih/zoom)*(1+(-1)*("
      );
      // x stays centered at 0.5
      expect(result.filter).toContain("x='(iw - iw/zoom)*(0.5)'");
    });

    it("should apply zoompan for pan-down effect", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "pan-down",
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("zoompan=");
      // pan-down: constant zoom, y goes from 0 to 1
      expect(result.filter).toContain("z='1.12'");
      expect(result.filter).toContain(
        "y='(ih - ih/zoom)*(0+(1)*("
      );
    });

    it("should auto-apply pan zoom when custom positions differ but no zoom set", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 4,
        kenBurns: {
          type: "custom",
          startX: 0.2,
          startY: 0.8,
          endX: 0.8,
          endY: 0.2,
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // Should auto-apply DEFAULT_PAN_ZOOM (1.12) since positions differ but no zoom
      expect(result.filter).toContain("z='1.12'");
      expect(result.filter).toContain(
        "x='(iw - iw/zoom)*(0.2+(0.6)*((on/119)))'"
      );
      expect(result.filter).toContain(
        "y='(ih - ih/zoom)*(0.8+(-0.6)*((on/119)))'"
      );
    });

    it("should NOT auto-apply pan zoom when zoom is explicitly set", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 4,
        kenBurns: {
          type: "custom",
          startZoom: 1.0,
          endZoom: 1.0,
          startX: 0.2,
          endX: 0.8,
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // User explicitly set zoom to 1.0, so it should stay at 1.0
      expect(result.filter).toContain("z='1'");
    });

    it("should use object form of string preset identically", () => {
      const project1 = createProject();
      const clip1 = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: "zoom-in",
      };
      project1.videoOrAudioClips.push(clip1);
      const result1 = buildVideoFilter(project1, [clip1]);

      const project2 = createProject();
      const clip2 = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: { type: "zoom-in" },
      };
      project2.videoOrAudioClips.push(clip2);
      const result2 = buildVideoFilter(project2, [clip2]);

      // Both forms should produce the same zoompan filter
      expect(result1.filter).toEqual(result2.filter);
    });

    it("should allow overriding preset defaults", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: {
          type: "zoom-in",
          startZoom: 1.05,
          endZoom: 1.25,
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // Should use overridden zoom values, not the zoom-in defaults (1.0 → 1.15)
      expect(result.filter).toContain("z='1.05+(0.2)*((on/89))'");
    });

    it("should default to ease-in-out easing when not specified", () => {
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

      // ease-in-out uses cosine: 0.5-0.5*cos(PI*t)
      expect(result.filter).toContain("0.5-0.5*cos(PI*");
    });

    it("should generate ease-in expression (quadratic)", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: { type: "zoom-in", easing: "ease-in" },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // ease-in: t*t
      expect(result.filter).toMatch(/z='1\+\(0\.15\)\*\(\(.*\)\*\(.*\)\)'/);
    });

    it("should generate ease-out expression", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: { type: "zoom-in", easing: "ease-out" },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // ease-out: 1-((1-t)*(1-t))
      expect(result.filter).toContain("1-((1-");
    });

    it("should generate linear expression", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 3,
        kenBurns: { type: "zoom-in", easing: "linear" },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // linear: just (on/N) without any wrapping function
      expect(result.filter).toContain("z='1+(0.15)*((on/89))'");
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

    it("should fill gap with custom color when fillGaps is a color name", () => {
      const project = createProject({ fillGaps: "red" });
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

      expect(result.filter).toContain("color=c=red:s=1920x1080:d=2");
      expect(result.filter).toContain("concat=n=2");
    });

    it("should fill gap with hex color", () => {
      const project = createProject({ fillGaps: "#1a1a2e" });
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

      expect(result.filter).toContain("color=c=#1a1a2e:s=1920x1080:d=2");
      expect(result.filter).toContain("concat=n=2");
    });

    it("should fill trailing gap with black when timelineEnd extends past visual", () => {
      const project = createProject({ fillGaps: "black" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 5,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips, { timelineEnd: 10 });

      // Should have black fill for the trailing gap (5-10 seconds)
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=5");
      // Should concatenate two streams (video + black)
      expect(result.filter).toContain("concat=n=2");
      expect(result.videoDuration).toBe(10);
    });

    it("should fill both leading and trailing gaps with black", () => {
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

      const result = buildVideoFilter(project, clips, { timelineEnd: 8 });

      // Should have black fill for leading gap (0-2) and trailing gap (5-8)
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2"); // 0-2
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=3"); // 5-8
      // Should concatenate three streams (black + video + black)
      expect(result.filter).toContain("concat=n=3");
      expect(result.videoDuration).toBe(8);
    });

    it("should fill middle and trailing gaps together", () => {
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

      const result = buildVideoFilter(project, clips, { timelineEnd: 12 });

      // Middle gap (3-5) + trailing gap (8-12)
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2"); // 3-5
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=4"); // 8-12
      expect(result.filter).toContain("concat=n=4");
      expect(result.videoDuration).toBe(12);
    });

    it("should not fill trailing gap when fillGaps is 'none' even with timelineEnd", () => {
      const project = createProject({ fillGaps: "none" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 5,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips, { timelineEnd: 10 });

      expect(result.filter).not.toContain("color=c=black");
      expect(result.filter).toContain("concat=n=1");
      expect(result.videoDuration).toBe(5);
    });

    it("should not add trailing gap when timelineEnd equals visual end", () => {
      const project = createProject({ fillGaps: "black" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 5,
          cutFrom: 0,
          mediaDuration: 10,
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      const result = buildVideoFilter(project, clips, { timelineEnd: 5 });

      expect(result.filter).not.toContain("color=c=black");
      expect(result.filter).toContain("concat=n=1");
      expect(result.videoDuration).toBe(5);
    });
  });

  describe("videoDuration return value", () => {
    it("should return videoDuration for single clip (no transitions)", () => {
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
      expect(result.videoDuration).toBe(5);
    });

    it("should return videoDuration for concatenated clips", () => {
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
      expect(result.videoDuration).toBe(6);
    });

    it("should return compressed videoDuration with transitions", () => {
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
      // 3 + 3 - 0.5 = 5.5
      expect(result.videoDuration).toBe(5.5);
    });

    it("should return 0 for empty clips", () => {
      const project = createProject();
      const result = buildVideoFilter(project, []);
      expect(result.videoDuration).toBe(0);
    });
  });

  describe("trailing gap with transitions", () => {
    it("should return correct videoDuration with transition + trailing gap", () => {
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
          position: 2.5,
          end: 5.5,
          cutFrom: 0,
          mediaDuration: 10,
          transition: { type: "fade", duration: 0.5 },
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      // timelineEnd = 8 means trailing gap from 5.5 to 8 = 2.5s
      const result = buildVideoFilter(project, clips, { timelineEnd: 8 });

      expect(result.filter).toContain("color=c=black");
      // Video: 3 + 3 - 0.5 (transition) + 2.5 (trailing gap) = 8
      expect(result.videoDuration).toBe(8);
    });

    it("should return correct videoDuration with middle gap + transition + trailing gap", () => {
      const project = createProject({ fillGaps: "black" });
      const clips = [
        {
          type: "video",
          url: "./a.mp4",
          position: 0,
          end: 2,
          cutFrom: 0,
          mediaDuration: 10,
        },
        {
          type: "video",
          url: "./b.mp4",
          position: 4.5,
          end: 7.5,
          cutFrom: 0,
          mediaDuration: 10,
          transition: { type: "fade", duration: 0.5 },
        },
      ];
      clips.forEach((c) => project.videoOrAudioClips.push(c));

      // Middle gap from 2 to 4.5 = 2.5s, trailing gap from 7.5 to 10 = 2.5s
      const result = buildVideoFilter(project, clips, { timelineEnd: 10 });

      // Middle gap 2-4.5 = 2.5s
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2.5");
      // Streams: clip_a(2s) + black_middle(2.5s) concat, then xfade
      // with clip_b(3s) - 0.5s transition, then black_trail(2.5s) concat.
      // Total = 2 + 2.5 + 3 - 0.5(xfade) + 2.5 = 9.5
      // Note: the 0.5s transition compression is handled at the
      // _prepareExport level, which adjusts timelineEnd accordingly.
      expect(result.videoDuration).toBe(9.5);
    });

    it("should return correct videoDuration with leading + trailing gap", () => {
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

      // Leading gap 0-2 = 2s, trailing gap 5-9 = 4s
      const result = buildVideoFilter(project, clips, { timelineEnd: 9 });

      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2"); // leading
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=4"); // trailing
      expect(result.filter).toContain("concat=n=3"); // leading + clip + trailing
      expect(result.videoDuration).toBe(9);
    });
  });
});
