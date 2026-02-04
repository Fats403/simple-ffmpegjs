module.exports = {
  DEFAULT_FPS: 30,
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  DEFAULT_VALIDATION_MODE: "warn",

  // Text batching
  DEFAULT_TEXT_MAX_NODES_PER_PASS: 75,
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
};
