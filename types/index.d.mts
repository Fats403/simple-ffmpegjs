declare namespace SIMPLEFFMPEG {
  // ─────────────────────────────────────────────────────────────────────────────
  // Error Classes
  // ─────────────────────────────────────────────────────────────────────────────

  /** Base error class for all simple-ffmpeg errors */
  class SimpleffmpegError extends Error {
    name: "SimpleffmpegError";
  }

  /** Thrown when clip validation fails */
  class ValidationError extends SimpleffmpegError {
    name: "ValidationError";
    errors: string[];
    warnings: string[];
  }

  /** Thrown when FFmpeg command execution fails */
  class FFmpegError extends SimpleffmpegError {
    name: "FFmpegError";
    stderr: string;
    command: string;
    exitCode: number | null;
  }

  /** Thrown when a media file cannot be found or accessed */
  class MediaNotFoundError extends SimpleffmpegError {
    name: "MediaNotFoundError";
    path: string;
  }

  /** Thrown when export is cancelled via AbortSignal */
  class ExportCancelledError extends SimpleffmpegError {
    name: "ExportCancelledError";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Clip Types
  // ─────────────────────────────────────────────────────────────────────────────

  type ClipType =
    | "video"
    | "audio"
    | "text"
    | "music"
    | "backgroundAudio"
    | "image";

  interface BaseClip {
    type: ClipType;
    url?: string;
    position: number;
    end: number;
  }

  interface VideoClip extends BaseClip {
    type: "video";
    url: string;
    cutFrom?: number;
    volume?: number;
    transition?: { type: string; duration: number };
  }

  interface AudioClip extends BaseClip {
    type: "audio";
    url: string;
    cutFrom?: number;
    volume?: number;
  }

  interface BackgroundMusicClip extends BaseClip {
    type: "music" | "backgroundAudio";
    url: string;
    cutFrom?: number;
    volume?: number;
  }

  interface ImageClip extends BaseClip {
    type: "image";
    url: string;
    kenBurns?:
      | "zoom-in"
      | "zoom-out"
      | "pan-left"
      | "pan-right"
      | "pan-up"
      | "pan-down";
  }

  type TextMode = "static" | "word-replace" | "word-sequential";
  type TextAnimationType =
    | "none"
    | "fade-in"
    | "fade-in-out"
    | "pop"
    | "pop-bounce";

  interface TextWordWindow {
    text: string;
    start: number;
    end: number;
  }

  interface TextClip {
    type: "text";
    text?: string;
    position: number;
    end: number;
    mode?: TextMode;
    words?: TextWordWindow[];
    wordTimestamps?: number[];

    // Font
    fontFile?: string;
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;

    // Position (xPercent/yPercent are percentages 0-1, x/y are pixels)
    /** Horizontal position as percentage (0 = left, 0.5 = center, 1 = right) */
    xPercent?: number;
    /** Vertical position as percentage (0 = top, 0.5 = center, 1 = bottom) */
    yPercent?: number;
    /** Absolute X position in pixels */
    x?: number;
    /** Absolute Y position in pixels */
    y?: number;

    // Styling
    borderColor?: string;
    borderWidth?: number;
    shadowColor?: string;
    shadowX?: number;
    shadowY?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    padding?: number;

    // Animation
    animation?: {
      type: TextAnimationType;
      in?: number;
      out?: number;
    };
  }

  type Clip =
    | VideoClip
    | AudioClip
    | BackgroundMusicClip
    | ImageClip
    | TextClip;

  // ─────────────────────────────────────────────────────────────────────────────
  // Options
  // ─────────────────────────────────────────────────────────────────────────────

  interface SIMPLEFFMPEGOptions {
    /** Frames per second (default: 30) */
    fps?: number;
    /** Output width in pixels (default: 1920) */
    width?: number;
    /** Output height in pixels (default: 1080) */
    height?: number;
    /** Validation mode: 'warn' logs warnings, 'strict' throws on warnings (default: 'warn') */
    validationMode?: "warn" | "strict";
    /** How to handle visual gaps: 'none' throws error, 'black' fills with black frames (default: 'none') */
    fillGaps?: "none" | "black";
  }

  /** Progress information passed to onProgress callback */
  interface ProgressInfo {
    /** Current frame number being processed */
    frame?: number;
    /** Current processing speed in frames per second */
    fps?: number;
    /** Time processed in seconds */
    timeProcessed?: number;
    /** Progress percentage (0-100) */
    percent?: number;
    /** Processing speed multiplier (e.g., 2.0 = 2x realtime) */
    speed?: number;
    /** Current bitrate in kbits/s */
    bitrate?: number;
    /** Current output size in bytes */
    size?: number;
  }

  /** Metadata to embed in output file */
  interface MetadataOptions {
    title?: string;
    artist?: string;
    album?: string;
    comment?: string;
    date?: string;
    genre?: string;
    custom?: Record<string, string>;
  }

  /** Thumbnail generation options */
  interface ThumbnailOptions {
    outputPath: string;
    time?: number;
    width?: number;
    height?: number;
  }

  type HardwareAcceleration =
    | "auto"
    | "videotoolbox"
    | "nvenc"
    | "vaapi"
    | "qsv"
    | "none";

  type VideoCodec =
    | "libx264"
    | "libx265"
    | "libvpx-vp9"
    | "libaom-av1"
    | "prores_ks"
    | "h264_videotoolbox"
    | "hevc_videotoolbox"
    | "h264_nvenc"
    | "hevc_nvenc"
    | "h264_vaapi"
    | "hevc_vaapi"
    | "h264_qsv"
    | "hevc_qsv"
    | string;

  type AudioCodec =
    | "aac"
    | "libmp3lame"
    | "libopus"
    | "pcm_s16le"
    | "flac"
    | "copy"
    | string;

  type EncodingPreset =
    | "ultrafast"
    | "superfast"
    | "veryfast"
    | "faster"
    | "fast"
    | "medium"
    | "slow"
    | "slower"
    | "veryslow";

  type ResolutionPreset = "480p" | "720p" | "1080p" | "1440p" | "4k";

  interface ExportOptions {
    // Output
    outputPath?: string;

    // Video Encoding
    videoCodec?: VideoCodec;
    crf?: number;
    preset?: EncodingPreset;
    videoBitrate?: string;

    // Audio Encoding
    audioCodec?: AudioCodec;
    audioBitrate?: string;
    audioSampleRate?: number;

    // Hardware Acceleration
    hwaccel?: HardwareAcceleration;

    // Output Resolution
    outputWidth?: number;
    outputHeight?: number;
    outputResolution?: ResolutionPreset;

    // Advanced Options
    audioOnly?: boolean;
    twoPass?: boolean;
    metadata?: MetadataOptions;
    thumbnail?: ThumbnailOptions;

    // Debug & Logging
    verbose?: boolean;
    logLevel?:
      | "quiet"
      | "panic"
      | "fatal"
      | "error"
      | "warning"
      | "info"
      | "verbose"
      | "debug";
    saveCommand?: string;

    // Callbacks & Control
    onProgress?: (progress: ProgressInfo) => void;
    signal?: AbortSignal;

    // Text Batching
    textMaxNodesPerPass?: number;
    intermediateVideoCodec?: string;
    intermediateCrf?: number;
    intermediatePreset?: string;
  }

  /** Result from preview() method */
  interface PreviewResult {
    /** The full FFmpeg command that would be executed */
    command: string;
    /** The filter_complex string */
    filterComplex: string;
    /** Total expected duration in seconds */
    totalDuration: number;
  }
}

declare class SIMPLEFFMPEG {
  constructor(options?: SIMPLEFFMPEG.SIMPLEFFMPEGOptions);

  /**
   * Load clips into the project
   * @param clips Array of clip descriptors (video, audio, text, image, music)
   */
  load(clips: SIMPLEFFMPEG.Clip[]): Promise<void[]>;

  /**
   * Get a preview of the FFmpeg command without executing it (dry-run)
   * @param options Export options
   */
  preview(
    options?: SIMPLEFFMPEG.ExportOptions
  ): Promise<SIMPLEFFMPEG.PreviewResult>;

  /**
   * Export the project to a video file
   * @param options Export options including outputPath, onProgress, and signal
   */
  export(options?: SIMPLEFFMPEG.ExportOptions): Promise<string>;
}

export default SIMPLEFFMPEG;
