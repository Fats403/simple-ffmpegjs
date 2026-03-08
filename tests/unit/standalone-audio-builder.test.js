import { describe, it, expect } from "vitest";

const { buildStandaloneAudioMix } = await import(
  "../../src/ffmpeg/standalone_audio_builder.js",
);

// Helper to create a mock project
function mockProject(clips, opts = {}) {
  const indexMap = new Map();
  clips.forEach((clip, i) => indexMap.set(clip, i));
  return {
    videoOrAudioClips: clips,
    _inputIndexMap: indexMap,
    _adjustTimestampForTransitions:
      opts._adjustTimestampForTransitions ||
      function (videoClips, ts) {
        return ts;
      },
  };
}

// Helper to create a mock audio clip
function mockAudioClip(overrides = {}) {
  return {
    type: "audio",
    position: 0,
    end: 5,
    volume: 1,
    cutFrom: 0,
    ...overrides,
  };
}

describe("buildStandaloneAudioMix", () => {
  describe("empty input", () => {
    it("should return unchanged state for empty audio clips array", () => {
      const project = mockProject([]);
      const result = buildStandaloneAudioMix(project, [], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      expect(result.filter).toBe("");
      expect(result.finalAudioLabel).toBeNull();
      expect(result.hasAudio).toBe(false);
    });

    it("should preserve existing audio state when no audio clips", () => {
      const project = mockProject([]);
      const result = buildStandaloneAudioMix(project, [], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: true,
        finalAudioLabel: "[outa]",
      });

      expect(result.filter).toBe("");
      expect(result.finalAudioLabel).toBe("[outa]");
      expect(result.hasAudio).toBe(true);
    });
  });

  describe("single audio clip", () => {
    it("should build filter for a single audio clip without existing audio", () => {
      const audio = mockAudioClip({ position: 0, end: 5, volume: 0.8, cutFrom: 0 });
      const project = mockProject([audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      expect(result.hasAudio).toBe(true);
      expect(result.finalAudioLabel).toBe("[finalaudio]");
      expect(result.filter).toContain("[0:a]");
      expect(result.filter).toContain("volume=0.8");
      expect(result.filter).toContain("atrim=start=0:end=5");
      expect(result.filter).toContain("adelay=0|0");
      expect(result.filter).toContain("asetpts=PTS-STARTPTS");
      expect(result.filter).toContain("amix=inputs=1:duration=longest");
    });

    it("should mix with existing audio when hasAudio is true", () => {
      const audio = mockAudioClip({ position: 0, end: 5, volume: 1, cutFrom: 0 });
      const project = mockProject([audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: true,
        finalAudioLabel: "[outa]",
      });

      expect(result.hasAudio).toBe(true);
      expect(result.finalAudioLabel).toBe("[finalaudio]");
      // Should include existing audio label in amix and count +1
      expect(result.filter).toContain("[outa]amix=inputs=2:duration=longest");
    });

    it("should apply correct adelay for positioned clip", () => {
      const audio = mockAudioClip({ position: 3, end: 8, volume: 1, cutFrom: 0 });
      const project = mockProject([audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      // 3 seconds = 3000ms
      expect(result.filter).toContain("adelay=3000|3000");
    });

    it("should compute correct atrim end from cutFrom and duration", () => {
      const audio = mockAudioClip({ position: 2, end: 7, volume: 1, cutFrom: 10 });
      const project = mockProject([audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      // atrim end = cutFrom + (end - position) = 10 + (7 - 2) = 15
      expect(result.filter).toContain("atrim=start=10:end=15");
    });
  });

  describe("multiple audio clips", () => {
    it("should build filters for multiple audio clips", () => {
      const audio1 = mockAudioClip({ position: 0, end: 3, volume: 1, cutFrom: 0 });
      const audio2 = mockAudioClip({ position: 5, end: 10, volume: 0.5, cutFrom: 2 });
      const project = mockProject([audio1, audio2]);
      const result = buildStandaloneAudioMix(project, [audio1, audio2], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      expect(result.hasAudio).toBe(true);
      expect(result.filter).toContain("[0:a]volume=1");
      expect(result.filter).toContain("[1:a]volume=0.5");
      expect(result.filter).toContain("amix=inputs=2:duration=longest");
    });

    it("should use correct input indices when audio clips are not first in project", () => {
      const video = { type: "video", position: 0, end: 10 };
      const audio = mockAudioClip({ position: 0, end: 5, volume: 1, cutFrom: 0 });
      const project = mockProject([video, audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [video],
        hasAudio: true,
        finalAudioLabel: "[outa]",
      });

      // Audio clip is at index 1 in the project
      expect(result.filter).toContain("[1:a]");
      expect(result.filter).toContain("[a1]");
    });
  });

  describe("transition compensation", () => {
    it("should not compensate when disabled", () => {
      const videoClips = [
        { type: "video", position: 0, end: 5, transition: { type: "fade", duration: 1 } },
        { type: "video", position: 5, end: 10 },
      ];
      const audio = mockAudioClip({ position: 3, end: 8, volume: 1, cutFrom: 0 });
      const project = mockProject([...videoClips, audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips,
        hasAudio: true,
        finalAudioLabel: "[outa]",
      });

      // Should use original position
      expect(result.filter).toContain("adelay=3000|3000");
    });

    it("should not compensate when only one video clip", () => {
      const videoClips = [{ type: "video", position: 0, end: 10 }];
      const audio = mockAudioClip({ position: 3, end: 8, volume: 1, cutFrom: 0 });
      const project = mockProject([...videoClips, audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: true,
        videoClips,
        hasAudio: true,
        finalAudioLabel: "[outa]",
      });

      // Should use original position (only 1 video clip, no compensation)
      expect(result.filter).toContain("adelay=3000|3000");
    });

    it("should compensate timings when enabled with multiple video clips", () => {
      const videoClips = [
        { type: "video", position: 0, end: 5, transition: { type: "fade", duration: 1 } },
        { type: "video", position: 5, end: 10 },
      ];
      const audio = mockAudioClip({ position: 6, end: 9, volume: 1, cutFrom: 0 });

      // Mock _adjustTimestampForTransitions to subtract 1s for anything after 5s
      const project = mockProject([...videoClips, audio], {
        _adjustTimestampForTransitions(clips, ts) {
          return ts > 5 ? ts - 1 : ts;
        },
      });

      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: true,
        videoClips,
        hasAudio: true,
        finalAudioLabel: "[outa]",
      });

      // position: 6 -> 5, end: 9 -> 8
      // adelay = 5 * 1000 = 5000
      expect(result.filter).toContain("adelay=5000|5000");
      // atrim end = cutFrom + (adjustedEnd - adjustedPosition) = 0 + (8 - 5) = 3
      expect(result.filter).toContain("atrim=start=0:end=3");
    });

    it("should use original clip objects for input index lookup after compensation", () => {
      const videoClips = [
        { type: "video", position: 0, end: 5 },
        { type: "video", position: 5, end: 10 },
      ];
      const audio = mockAudioClip({ position: 3, end: 7, volume: 1, cutFrom: 0 });
      const allClips = [...videoClips, audio];
      const project = mockProject(allClips, {
        _adjustTimestampForTransitions(clips, ts) {
          return ts - 0.5;
        },
      });

      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: true,
        videoClips,
        hasAudio: false,
        finalAudioLabel: null,
      });

      // Audio is at index 2 in the project — must use original clip reference
      expect(result.filter).toContain("[2:a]");
    });
  });

  describe("input index fallback", () => {
    it("should fall back to videoOrAudioClips.indexOf when _inputIndexMap is null", () => {
      const audio = mockAudioClip({ position: 0, end: 5, volume: 1, cutFrom: 0 });
      const project = {
        videoOrAudioClips: [{ type: "video" }, audio],
        _inputIndexMap: null,
        _adjustTimestampForTransitions: () => 0,
      };

      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      // Audio is at index 1 via indexOf
      expect(result.filter).toContain("[1:a]");
    });
  });

  describe("edge cases", () => {
    it("should clamp negative position to 0 for adelay", () => {
      const audio = mockAudioClip({ position: -1, end: 5, volume: 1, cutFrom: 0 });
      const project = mockProject([audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      expect(result.filter).toContain("adelay=0|0");
    });

    it("should handle position=0 and end=0 gracefully", () => {
      const audio = mockAudioClip({ position: 0, end: 0, volume: 1, cutFrom: 0 });
      const project = mockProject([audio]);
      const result = buildStandaloneAudioMix(project, [audio], {
        compensateTransitions: false,
        videoClips: [],
        hasAudio: false,
        finalAudioLabel: null,
      });

      // Should still produce a filter (atrim=start=0:end=0)
      expect(result.filter).toContain("atrim=start=0:end=0");
      expect(result.hasAudio).toBe(true);
    });
  });
});
