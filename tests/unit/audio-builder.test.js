import { describe, it, expect } from "vitest";

const { buildAudioForVideoClips } = await import(
  "../../src/ffmpeg/audio_builder.js"
);

// Helper to create a mock project with videoOrAudioClips
function mockProject(clips) {
  return { videoOrAudioClips: clips };
}

// Helper to create a mock video clip with audio
function mockClip(overrides = {}) {
  return {
    type: "video",
    hasAudio: true,
    position: 0,
    end: 5,
    cutFrom: 0,
    mediaDuration: 10,
    volume: 1,
    ...overrides,
  };
}

describe("buildAudioForVideoClips", () => {
  describe("basic behavior", () => {
    it("should return empty filter for clips without audio", () => {
      const clip = mockClip({ hasAudio: false });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      expect(result.filter).toBe("");
      expect(result.hasAudio).toBe(false);
      expect(result.finalAudioLabel).toBeNull();
    });

    it("should build audio filter for a single clip", () => {
      const clip = mockClip({ position: 0, end: 5, cutFrom: 0 });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      expect(result.hasAudio).toBe(true);
      expect(result.finalAudioLabel).toBe("[outa]");
      expect(result.filter).toContain("[0:a]");
      expect(result.filter).toContain("atrim=start=0:duration=5");
      expect(result.filter).toContain("adelay=0|0");
      expect(result.filter).toContain("amix=inputs=1");
    });

    it("should position audio with adelay based on clip.position", () => {
      const clip = mockClip({ position: 3, end: 8, cutFrom: 0 });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      // 3 seconds = 3000ms
      expect(result.filter).toContain("adelay=3000|3000");
    });
  });

  describe("volume", () => {
    it("should apply volume=1 by default", () => {
      const clip = mockClip({ volume: undefined });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      expect(result.filter).toContain("volume=1,");
    });

    it("should apply custom volume", () => {
      const clip = mockClip({ volume: 0.5 });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      expect(result.filter).toContain("volume=0.5,");
    });

    it("should apply volume=0 to mute", () => {
      const clip = mockClip({ volume: 0 });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      expect(result.filter).toContain("volume=0,");
    });

    it("should apply amplified volume", () => {
      const clip = mockClip({ volume: 1.5 });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      expect(result.filter).toContain("volume=1.5,");
    });
  });

  describe("transition offset compensation", () => {
    it("should not adjust adelay when no transition offsets provided", () => {
      const clip = mockClip({ position: 5, end: 10 });
      const project = mockProject([clip]);
      const result = buildAudioForVideoClips(project, [clip]);

      expect(result.filter).toContain("adelay=5000|5000");
    });

    it("should not adjust adelay when offset is 0", () => {
      const clip = mockClip({ position: 5, end: 10 });
      const project = mockProject([clip]);
      const offsets = new Map([[clip, 0]]);
      const result = buildAudioForVideoClips(project, [clip], offsets);

      expect(result.filter).toContain("adelay=5000|5000");
    });

    it("should subtract transition offset from adelay", () => {
      const clip = mockClip({ position: 10, end: 15 });
      const project = mockProject([clip]);
      // 2 seconds of cumulative transition overlap
      const offsets = new Map([[clip, 2]]);
      const result = buildAudioForVideoClips(project, [clip], offsets);

      // 10s - 2s = 8s = 8000ms
      expect(result.filter).toContain("adelay=8000|8000");
    });

    it("should handle multiple clips with increasing offsets", () => {
      const clip1 = mockClip({ position: 0, end: 5 });
      const clip2 = mockClip({ position: 5, end: 10 });
      const clip3 = mockClip({ position: 10, end: 15 });
      const clips = [clip1, clip2, clip3];
      const project = mockProject(clips);

      // Simulate 0.5s transitions between each clip
      const offsets = new Map([
        [clip1, 0],
        [clip2, 0.5],
        [clip3, 1.0],
      ]);

      const result = buildAudioForVideoClips(project, clips, offsets);

      // clip1: 0 - 0 = 0ms
      expect(result.filter).toContain("adelay=0|0");
      // clip2: 5000 - 500 = 4500ms
      expect(result.filter).toContain("adelay=4500|4500");
      // clip3: 10000 - 1000 = 9000ms
      expect(result.filter).toContain("adelay=9000|9000");
    });

    it("should clamp adelay to 0 if offset exceeds position", () => {
      const clip = mockClip({ position: 1, end: 6 });
      const project = mockProject([clip]);
      // Offset larger than position (edge case)
      const offsets = new Map([[clip, 5]]);
      const result = buildAudioForVideoClips(project, [clip], offsets);

      expect(result.filter).toContain("adelay=0|0");
    });
  });
});
