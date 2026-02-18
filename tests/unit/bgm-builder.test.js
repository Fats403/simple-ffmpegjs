import { describe, it, expect } from "vitest";

const { buildBackgroundMusicMix } = await import(
  "../../src/ffmpeg/bgm_builder.js"
);

// Helper to create a mock project
function mockProject(clips) {
  const indexMap = new Map();
  clips.forEach((clip, i) => indexMap.set(clip, i));
  return { videoOrAudioClips: clips, _inputIndexMap: indexMap };
}

// Helper to create a mock background music clip
function mockBgmClip(overrides = {}) {
  return {
    type: "music",
    position: 0,
    volume: 0.2,
    cutFrom: 0,
    ...overrides,
  };
}

// Helper to create a mock video clip (for projectDuration calculation)
function mockVideoClip(overrides = {}) {
  return {
    type: "video",
    position: 0,
    end: 10,
    hasAudio: true,
    ...overrides,
  };
}

describe("buildBackgroundMusicMix", () => {
  describe("basic behavior", () => {
    it("should return empty result for no background clips", () => {
      const project = mockProject([]);
      const result = buildBackgroundMusicMix(project, [], null, 10);

      expect(result.filter).toBe("");
      expect(result.hasAudio).toBe(false);
    });

    it("should build a filter for a single bgm clip without existing audio", () => {
      const bgm = mockBgmClip({ end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], null, 10);

      expect(result.hasAudio).toBe(true);
      expect(result.finalAudioLabel).toBe("[finalaudio]");
      expect(result.filter).toContain("[1:a]");
      expect(result.filter).toContain("volume=0.2");
      expect(result.filter).toContain("amix=inputs=1:duration=longest");
    });

    it("should use default volume of 0.2", () => {
      const bgm = mockBgmClip({ volume: undefined, end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], null, 10);

      expect(result.filter).toContain("volume=0.2");
    });

    it("should apply custom volume", () => {
      const bgm = mockBgmClip({ volume: 0.5, end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], null, 10);

      expect(result.filter).toContain("volume=0.5");
    });
  });

  describe("filter ordering (asetpts before adelay)", () => {
    it("should place asetpts=PTS-STARTPTS before adelay", () => {
      const bgm = mockBgmClip({ position: 5, end: 15 });
      const video = mockVideoClip({ end: 15 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], null, 15);

      // asetpts must appear before adelay to avoid undoing the delay
      const asetptsIndex = result.filter.indexOf("asetpts=PTS-STARTPTS");
      const adelayIndex = result.filter.indexOf("adelay=");
      expect(asetptsIndex).toBeGreaterThan(-1);
      expect(adelayIndex).toBeGreaterThan(-1);
      expect(asetptsIndex).toBeLessThan(adelayIndex);
    });

    it("should apply correct adelay for positioned bgm", () => {
      const bgm = mockBgmClip({ position: 5, end: 15 });
      const video = mockVideoClip({ end: 15 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], null, 15);

      // 5 seconds = 5000ms
      expect(result.filter).toContain("adelay=5000|5000");
    });
  });

  describe("silence anchor when mixing with existing audio", () => {
    it("should include anullsrc anchor when existingAudioLabel is provided", () => {
      const bgm = mockBgmClip({ end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 10);

      expect(result.filter).toContain("anullsrc=cl=stereo");
      expect(result.filter).toContain("[_bgmpad]");
      expect(result.hasAudio).toBe(true);
      expect(result.finalAudioLabel).toBe("[finalaudio]");
    });

    it("should NOT include anullsrc anchor when no existing audio", () => {
      const bgm = mockBgmClip({ end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], null, 10);

      expect(result.filter).not.toContain("anullsrc");
      expect(result.filter).not.toContain("[_bgmpad]");
    });

    it("should use correct input count (anchor + existing + bgm tracks)", () => {
      const bgm = mockBgmClip({ end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 10);

      // 1 anchor + 1 existing + 1 bgm = 3 inputs
      expect(result.filter).toContain("amix=inputs=3");
    });

    it("should use normalize=0 with explicit weights", () => {
      const bgm = mockBgmClip({ end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 10);

      expect(result.filter).toContain("normalize=0");
      // Anchor weight = 0, existing weight = 0.5, bgm weight = 0.5
      expect(result.filter).toContain("weights='0 0.500000 0.500000'");
    });

    it("should handle multiple bgm tracks with existing audio", () => {
      const bgm1 = mockBgmClip({ end: 10 });
      const bgm2 = mockBgmClip({ position: 2, end: 8, volume: 0.15 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm1, bgm2]);
      const result = buildBackgroundMusicMix(
        project,
        [bgm1, bgm2],
        "[outa]",
        10
      );

      // 1 anchor + 1 existing + 2 bgm = 4 inputs
      expect(result.filter).toContain("amix=inputs=4");
      // 3 real inputs → each gets weight 1/3
      expect(result.filter).toContain(
        "weights='0 0.333333 0.333333 0.333333'"
      );
    });

    it("should include anchor, existing label, and bgm labels in amix input order", () => {
      const bgm = mockBgmClip({ end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 10);

      // The amix input should be: [_bgmpad][outa][bg0]
      expect(result.filter).toContain("[_bgmpad][outa][bg0]amix=inputs=3");
    });

    it("should set anchor duration to max of projectDuration and visualEnd", () => {
      const bgm = mockBgmClip({ end: 10 });
      const video = mockVideoClip({ end: 10 });
      const project = mockProject([video, bgm]);

      // visualEnd (15) > projectDuration (10) → anchor should use 15
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 15);

      expect(result.filter).toContain("atrim=end=15");
    });
  });

  describe("transition-compressed visualEnd", () => {
    it("should use visualEnd instead of clip end values when visualEnd is provided", () => {
      // Simulate transition compression: clips end at 46.5 but actual
      // video duration after xfade is 39.3.
      const video1 = mockVideoClip({ position: 0, end: 10 });
      const video2 = mockVideoClip({ position: 10, end: 20, transition: { type: "fade", duration: 1 } });
      const bgm = mockBgmClip({ volume: 0.18 });
      const project = mockProject([video1, video2, bgm]);

      // visualEnd = 18 (compressed: 10 + 10 - 1 transition - 1 transition = 18)
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 18);

      // BGM effectiveEnd should be 18 (from visualEnd), not 20 (from clip.end)
      expect(result.filter).toContain("atrim=start=0:end=18");
      // Silence anchor should also use 18
      expect(result.filter).toContain("anullsrc=cl=stereo,atrim=end=18");
    });

    it("should fall back to clip end values when visualEnd is 0", () => {
      const video = mockVideoClip({ end: 10 });
      const bgm = mockBgmClip({ volume: 0.2 });
      const project = mockProject([video, bgm]);

      const result = buildBackgroundMusicMix(project, [bgm], null, 0);

      // Should fall back to Math.max(clip.end) = 10
      expect(result.filter).toContain("atrim=start=0:end=10");
    });
  });

  describe("delayed video audio scenario (the main bug)", () => {
    it("should produce correct filter when video starts at 7s and bgm at 0s", () => {
      const video = mockVideoClip({ position: 7, end: 10 });
      const bgm = mockBgmClip({ position: 0, volume: 0.2 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 10);

      // BGM should have adelay=0 (starts at position 0)
      expect(result.filter).toContain("adelay=0|0");

      // Must include silence anchor so amix doesn't block on delayed [outa]
      expect(result.filter).toContain("anullsrc=cl=stereo");
      expect(result.filter).toContain("[_bgmpad]");

      // The anchor ensures amix starts from time 0
      expect(result.hasAudio).toBe(true);
      expect(result.finalAudioLabel).toBe("[finalaudio]");
    });

    it("should produce correct filter when video starts at 26s and bgm at 0s", () => {
      const video = mockVideoClip({ position: 26, end: 30 });
      const bgm = mockBgmClip({ position: 0, volume: 0.2 });
      const project = mockProject([video, bgm]);
      const result = buildBackgroundMusicMix(project, [bgm], "[outa]", 30);

      // BGM should start at 0
      expect(result.filter).toContain("adelay=0|0");

      // Anchor duration should cover the full 30s
      expect(result.filter).toContain("atrim=end=30");

      // Silence anchor present
      expect(result.filter).toContain("anullsrc=cl=stereo");
    });
  });
});
