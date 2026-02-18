import { describe, it, expect } from "vitest";

// Dynamic import for CommonJS module
const { buildVideoFilter } = await import("../../src/ffmpeg/video_builder.js");

describe("buildVideoFilter", () => {
  const createProject = (options = {}) => ({
    options: {
      fps: options.fps || 30,
      width: options.width || 1920,
      height: options.height || 1080,
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

    it("should enforce minimum pan zoom when explicit zoom is too low for visible pan", () => {
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

      // Zoom=1.0 makes pans invisible ((iw - iw/zoom) = 0), so both
      // endpoints are bumped to MIN_PAN_ZOOM (1.04)
      expect(result.filter).toContain("z='1.04'");
    });

    it("should bump only the low endpoint when smart KB has explicit startZoom=1", () => {
      const project = createProject({ width: 1080, height: 1920 });
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 5,
        kenBurns: {
          type: "smart",
          anchor: "bottom",
          startZoom: 1,
          endZoom: 1.15,
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // startZoom=1 is below MIN_PAN_ZOOM, so it's bumped to 1.04
      // endZoom=1.15 is already above, so it stays
      expect(result.filter).toContain("z='1.04+(0.11)*((on/149))'");
      // No source dimensions → portrait output defaults to vertical pan
      // anchor=bottom → startY=1, endY=0 (pan bottom-to-top)
      expect(result.filter).toContain("y='(ih - ih/zoom)*(1+(-1)*((on/149)))'");
    });

    it("should not adjust zoom when explicit values are already above minimum", () => {
      const project = createProject();
      const clip = {
        type: "image",
        url: "./test.png",
        position: 0,
        end: 4,
        kenBurns: {
          type: "custom",
          startZoom: 1.1,
          endZoom: 1.2,
          startX: 0.2,
          endX: 0.8,
          easing: "linear",
        },
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      // Both zoom values are above MIN_PAN_ZOOM, so no adjustment
      expect(result.filter).toContain("z='1.1+(0.1)*((on/119))'");
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

  describe("color clips", () => {
    it("should generate color= filter source for flat color clip", () => {
      const project = createProject();
      const clip = {
        type: "color",
        color: "black",
        position: 0,
        end: 3,
        _isFlatColor: true,
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.hasVideo).toBe(true);
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=3");
      expect(result.filter).toContain("fps=30");
      expect(result.videoDuration).toBe(3);
    });

    it("should use correct dimensions and fps for flat color clip", () => {
      const project = createProject({ width: 1080, height: 1920, fps: 60 });
      const clip = {
        type: "color",
        color: "navy",
        position: 0,
        end: 2,
        _isFlatColor: true,
      };
      project.videoOrAudioClips.push(clip);

      const result = buildVideoFilter(project, [clip]);

      expect(result.filter).toContain("color=c=navy:s=1080x1920:d=2");
      expect(result.filter).toContain("fps=60");
    });

    it("should handle color clip with transition (xfade)", () => {
      const project = createProject();
      const videoClip = {
        type: "video",
        url: "./a.mp4",
        position: 0,
        end: 3,
        cutFrom: 0,
        mediaDuration: 10,
      };
      const colorClip = {
        type: "color",
        color: "black",
        position: 2.5,
        end: 5.5,
        _isFlatColor: true,
        transition: { type: "fade", duration: 0.5 },
      };
      project.videoOrAudioClips.push(videoClip);
      project.videoOrAudioClips.push(colorClip);

      const result = buildVideoFilter(project, [videoClip, colorClip]);

      expect(result.filter).toContain("color=c=black:s=1920x1080:d=3");
      expect(result.filter).toContain("xfade=transition=fade:duration=0.5");
    });

    it("should handle multiple color clips in timeline", () => {
      const project = createProject();
      const c1 = { type: "color", color: "black", position: 0, end: 2, _isFlatColor: true };
      const c2 = { type: "color", color: "navy", position: 2, end: 4, _isFlatColor: true };
      project.videoOrAudioClips.push(c1);
      project.videoOrAudioClips.push(c2);

      const result = buildVideoFilter(project, [c1, c2]);

      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2");
      expect(result.filter).toContain("color=c=navy:s=1920x1080:d=2");
      expect(result.filter).toContain("concat=n=2:v=1:a=0");
      expect(result.videoDuration).toBe(4);
    });

    it("should handle gradient color clip as image (input index based)", () => {
      const project = createProject();
      // Gradient color clips have a url (temp PPM) and no _isFlatColor flag
      const gradientClip = {
        type: "color",
        color: { type: "linear-gradient", colors: ["#000", "#fff"] },
        url: "/tmp/gradient.ppm",
        position: 0,
        end: 3,
        hasAudio: false,
      };
      project.videoOrAudioClips.push(gradientClip);

      const result = buildVideoFilter(project, [gradientClip]);

      expect(result.hasVideo).toBe(true);
      // Should go through the image/video trim+scale path
      expect(result.filter).toContain("[0:v]");
      expect(result.filter).toContain("trim=start=0:duration=3");
    });

    it("should compute correct input index when flat color clips are mixed with file clips", () => {
      const project = createProject();
      const colorClip = { type: "color", color: "black", position: 0, end: 2, _isFlatColor: true };
      const videoClip = {
        type: "video",
        url: "./a.mp4",
        position: 2,
        end: 5,
        cutFrom: 0,
        mediaDuration: 10,
      };
      project.videoOrAudioClips.push(colorClip);
      project.videoOrAudioClips.push(videoClip);

      const result = buildVideoFilter(project, [colorClip, videoClip]);

      // Flat color has no input, so video clip should be [0:v] (not [1:v])
      expect(result.filter).toContain("color=c=black:s=1920x1080:d=2");
      expect(result.filter).toContain("[0:v]");
      expect(result.filter).toContain("trim=start=0:duration=3");
    });
  });

  // Legacy gap fill tests removed — fillGaps is no longer a feature.
  // Color clips are the explicit replacement.

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
});
