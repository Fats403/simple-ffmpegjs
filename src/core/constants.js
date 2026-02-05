module.exports = {
  DEFAULT_FPS: 30,
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  DEFAULT_VALIDATION_MODE: "warn",

  // Text batching
  DEFAULT_TEXT_MAX_NODES_PER_PASS: 75,
  // Max filter_complex length before auto-batching (conservative for Windows compatibility)
  // Linux: ~2MB, macOS: ~1MB, Windows: ~32KB - we use 100KB as safe cross-platform limit
  MAX_FILTER_COMPLEX_LENGTH: 100000,
  INTERMEDIATE_VIDEO_CODEC: "libx264",
  INTERMEDIATE_CRF: 18,
  INTERMEDIATE_PRESET: "veryfast",

  // Video Encoding
  VIDEO_CODEC: "libx264",
  VIDEO_CRF: 23,
  VIDEO_PRESET: "medium",
  VIDEO_BITRATE: null, // null = use CRF mode

  // Audio Encoding
  AUDIO_CODEC: "aac",
  AUDIO_BITRATE: "192k",
  AUDIO_SAMPLE_RATE: 48000,

  // Fonts/Text
  DEFAULT_FONT_FAMILY: "Sans",
  DEFAULT_FONT_SIZE: 48,
  DEFAULT_FONT_COLOR: "#FFFFFF",
  DEFAULT_TEXT_ANIM_IN: 0.25,
  DEFAULT_TEXT_ANIM_OUT: 0.25,
  DEFAULT_TEXT_ANIM_INTENSITY: 0.3,
  DEFAULT_TYPEWRITER_SPEED: 0.05, // seconds per character
  DEFAULT_PULSE_SPEED: 1.0, // cycles per second
  DEFAULT_KARAOKE_HIGHLIGHT: "#FFFF00",
  DEFAULT_KARAOKE_HIGHLIGHT_STYLE: "smooth", // "smooth" (gradual fill) or "instant" // yellow highlight for karaoke

  // Audio
  DEFAULT_BGM_VOLUME: 0.2,

  // Transitions
  DEFAULT_TRANSITION_DURATION: 0.5,

  // Hardware acceleration options
  HWACCEL_OPTIONS: ["auto", "videotoolbox", "nvenc", "vaapi", "qsv", "none"],

  // Supported codecs
  VIDEO_CODECS: [
    "libx264",
    "libx265",
    "libvpx-vp9",
    "libaom-av1",
    "prores_ks",
    "h264_videotoolbox",
    "hevc_videotoolbox",
    "h264_nvenc",
    "hevc_nvenc",
    "h264_vaapi",
    "hevc_vaapi",
    "h264_qsv",
    "hevc_qsv",
  ],
  AUDIO_CODECS: ["aac", "libmp3lame", "libopus", "pcm_s16le", "flac", "copy"],

  // Presets
  VIDEO_PRESETS: [
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
  ],

  // Platform presets (width, height, fps)
  PLATFORM_PRESETS: {
    // Vertical 9:16 (short-form)
    tiktok: { width: 1080, height: 1920, fps: 30 },
    "youtube-short": { width: 1080, height: 1920, fps: 30 },
    "instagram-reel": { width: 1080, height: 1920, fps: 30 },
    "instagram-story": { width: 1080, height: 1920, fps: 30 },
    snapchat: { width: 1080, height: 1920, fps: 30 },

    // Square 1:1
    "instagram-post": { width: 1080, height: 1080, fps: 30 },
    "instagram-square": { width: 1080, height: 1080, fps: 30 },

    // Horizontal 16:9 (standard)
    youtube: { width: 1920, height: 1080, fps: 30 },
    twitter: { width: 1920, height: 1080, fps: 30 },
    facebook: { width: 1920, height: 1080, fps: 30 },
    landscape: { width: 1920, height: 1080, fps: 30 },

    // Other common formats
    "twitter-portrait": { width: 1080, height: 1350, fps: 30 }, // 4:5
    "instagram-portrait": { width: 1080, height: 1350, fps: 30 }, // 4:5
  },
};
