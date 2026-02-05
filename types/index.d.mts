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
    | "image"
    | "subtitle";

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
    /** Loop the audio to fill the entire video duration */
    loop?: boolean;
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

  type TextMode = "static" | "word-replace" | "word-sequential" | "karaoke";
  type TextAnimationType =
    | "none"
    | "fade-in"
    | "fade-out"
    | "fade-in-out"
    | "fade"
    | "pop"
    | "pop-bounce"
    | "scale-in"
    | "pulse"
    | "typewriter";

  interface TextWordWindow {
    text: string;
    start: number;
    end: number;
    /** Add line break after this word (for multi-line karaoke) */
    lineBreak?: boolean;
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
    /** Pixel offset added to X position (works with x, xPercent, or center default) */
    xOffset?: number;
    /** Pixel offset added to Y position (works with y, yPercent, or center default) */
    yOffset?: number;

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
      /** Entry animation duration in seconds (default: 0.25) */
      in?: number;
      /** Exit animation duration in seconds (default: same as in) */
      out?: number;
      /** Animation intensity 0-1 for scale-in and pulse (default: 0.3) */
      intensity?: number;
      /** Speed for typewriter (sec/char, default: 0.05) or pulse (cycles/sec, default: 1) */
      speed?: number;
    };

    /** Highlight color for karaoke mode (default: '#FFFF00') */
    highlightColor?: string;

    /** Highlight style for karaoke mode: 'smooth' (gradual fill) or 'instant' (default: 'smooth') */
    highlightStyle?: "smooth" | "instant";
  }

  /** Subtitle clip for importing external subtitle files */
  interface SubtitleClip {
    type: "subtitle";
    /** Path to subtitle file (.srt, .ass, .ssa, .vtt) */
    url: string;
    /** Timeline position offset (default: 0) - adds to all subtitle timestamps */
    position?: number;
    /** Optional end time to cut off subtitles */
    end?: number;

    // Styling (for SRT/VTT import - ASS files use their own styles)
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
  }

  type Clip =
    | VideoClip
    | AudioClip
    | BackgroundMusicClip
    | ImageClip
    | TextClip
    | SubtitleClip;

  // ─────────────────────────────────────────────────────────────────────────────
  // Options
  // ─────────────────────────────────────────────────────────────────────────────

  /** Platform preset names */
  type PlatformPreset =
    | "tiktok"
    | "youtube-short"
    | "instagram-reel"
    | "instagram-story"
    | "snapchat"
    | "instagram-post"
    | "instagram-square"
    | "youtube"
    | "twitter"
    | "facebook"
    | "landscape"
    | "twitter-portrait"
    | "instagram-portrait";

  /** Platform preset configuration */
  interface PresetConfig {
    width: number;
    height: number;
    fps: number;
  }

  /** Validation error/warning codes */
  const ValidationCodes: {
    readonly INVALID_TYPE: "INVALID_TYPE";
    readonly MISSING_REQUIRED: "MISSING_REQUIRED";
    readonly INVALID_VALUE: "INVALID_VALUE";
    readonly INVALID_RANGE: "INVALID_RANGE";
    readonly INVALID_TIMELINE: "INVALID_TIMELINE";
    readonly TIMELINE_GAP: "TIMELINE_GAP";
    readonly FILE_NOT_FOUND: "FILE_NOT_FOUND";
    readonly INVALID_FORMAT: "INVALID_FORMAT";
    readonly INVALID_WORD_TIMING: "INVALID_WORD_TIMING";
    readonly OUTSIDE_BOUNDS: "OUTSIDE_BOUNDS";
  };

  type ValidationCode = (typeof ValidationCodes)[keyof typeof ValidationCodes];

  /** A single validation error or warning */
  interface ValidationIssue {
    /** Error code for programmatic handling */
    code: ValidationCode;
    /** Path to the problematic field (e.g., "clips[0].url") */
    path: string;
    /** Human-readable error message */
    message: string;
    /** The actual value that caused the issue (optional) */
    received?: unknown;
  }

  /** Result from validate() */
  interface ValidationResult {
    /** Whether the configuration is valid (no errors) */
    valid: boolean;
    /** Array of validation errors (issues that will cause failures) */
    errors: ValidationIssue[];
    /** Array of validation warnings (potential issues that won't block) */
    warnings: ValidationIssue[];
  }

  /** Options for validate() */
  interface ValidateOptions {
    /** Skip file existence checks (useful for AI generating configs before files exist) */
    skipFileChecks?: boolean;
    /** Gap handling mode - affects timeline gap validation */
    fillGaps?: "none" | "black";
    /** Project width - used to validate Ken Burns images are large enough */
    width?: number;
    /** Project height - used to validate Ken Burns images are large enough */
    height?: number;
    /** If true, undersized Ken Burns images will error instead of warn (default: false, images are auto-upscaled) */
    strictKenBurns?: boolean;
  }

  interface SIMPLEFFMPEGOptions {
    /** Platform preset (e.g., 'tiktok', 'youtube', 'instagram-reel'). Sets width, height, fps. */
    preset?: PlatformPreset;
    /** Frames per second (default: 30, or from preset) */
    fps?: number;
    /** Output width in pixels (default: 1920, or from preset) */
    width?: number;
    /** Output height in pixels (default: 1080, or from preset) */
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Watermark Types
  // ─────────────────────────────────────────────────────────────────────────────

  /** Preset position for watermarks */
  type WatermarkPositionPreset =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";

  /** Custom position using percentages (0-1) */
  interface WatermarkPositionPercent {
    xPercent: number;
    yPercent: number;
  }

  /** Custom position using pixels */
  interface WatermarkPositionPixel {
    x: number;
    y: number;
  }

  type WatermarkPosition =
    | WatermarkPositionPreset
    | WatermarkPositionPercent
    | WatermarkPositionPixel;

  interface BaseWatermarkOptions {
    position?: WatermarkPosition;
    margin?: number;
    opacity?: number;
    startTime?: number;
    endTime?: number;
  }

  interface ImageWatermarkOptions extends BaseWatermarkOptions {
    type: "image";
    url: string;
    scale?: number;
  }

  interface TextWatermarkOptions extends BaseWatermarkOptions {
    type: "text";
    text: string;
    fontSize?: number;
    fontColor?: string;
    fontFamily?: string;
    fontFile?: string;
    borderColor?: string;
    borderWidth?: number;
    shadowColor?: string;
    shadowX?: number;
    shadowY?: number;
  }

  type WatermarkOptions = ImageWatermarkOptions | TextWatermarkOptions;

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

    // Watermark
    watermark?: WatermarkOptions;

    // Timeline
    /**
     * Automatically adjust text/subtitle timings to compensate for timeline
     * compression caused by xfade transitions (default: true).
     */
    compensateTransitions?: boolean;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Schema Types
  // ─────────────────────────────────────────────────────────────────────────────

  /** Available schema module IDs */
  type SchemaModuleId =
    | "video"
    | "audio"
    | "image"
    | "text"
    | "subtitle"
    | "music";

  /** Options for getSchema() */
  interface SchemaOptions {
    /** Only include these module IDs in the schema output */
    include?: SchemaModuleId[];
    /** Exclude these module IDs from the schema output */
    exclude?: SchemaModuleId[];
    /** Custom top-level instructions to embed at the top of the schema */
    instructions?: string | string[];
    /** Per-module custom instructions, keyed by module ID */
    moduleInstructions?: Partial<Record<SchemaModuleId, string | string[]>>;
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

  /**
   * Get available platform presets
   */
  static getPresets(): Record<
    SIMPLEFFMPEG.PlatformPreset,
    SIMPLEFFMPEG.PresetConfig
  >;

  /**
   * Get list of available preset names
   */
  static getPresetNames(): SIMPLEFFMPEG.PlatformPreset[];

  /**
   * Validate clips configuration without creating a project.
   * Useful for AI feedback loops and pre-validation.
   *
   * @param clips - Array of clip objects to validate
   * @param options - Validation options
   * @returns Validation result with valid flag, errors, and warnings
   *
   * @example
   * const result = SIMPLEFFMPEG.validate(clips, { skipFileChecks: true });
   * if (!result.valid) {
   *   result.errors.forEach(e => console.log(`[${e.code}] ${e.path}: ${e.message}`));
   * }
   */
  static validate(
    clips: SIMPLEFFMPEG.Clip[],
    options?: SIMPLEFFMPEG.ValidateOptions
  ): SIMPLEFFMPEG.ValidationResult;

  /**
   * Format validation result as human-readable string
   */
  static formatValidationResult(result: SIMPLEFFMPEG.ValidationResult): string;

  /**
   * Validation error codes for programmatic handling
   */
  static readonly ValidationCodes: typeof SIMPLEFFMPEG.ValidationCodes;

  /**
   * Base error class for all simple-ffmpeg errors
   */
  static readonly SimpleffmpegError: typeof SIMPLEFFMPEG.SimpleffmpegError;

  /**
   * Thrown when clip validation fails
   */
  static readonly ValidationError: typeof SIMPLEFFMPEG.ValidationError;

  /**
   * Thrown when FFmpeg command execution fails
   */
  static readonly FFmpegError: typeof SIMPLEFFMPEG.FFmpegError;

  /**
   * Thrown when a media file cannot be found or accessed
   */
  static readonly MediaNotFoundError: typeof SIMPLEFFMPEG.MediaNotFoundError;

  /**
   * Thrown when export is cancelled via AbortSignal
   */
  static readonly ExportCancelledError: typeof SIMPLEFFMPEG.ExportCancelledError;

  /**
   * Get the clip schema as formatted prompt-ready text.
   * Returns a structured description of all clip types accepted by load(),
   * optimized for LLM consumption, documentation, or code generation.
   *
   * @param options - Schema options for filtering modules and adding custom instructions
   * @returns Formatted schema text
   *
   * @example
   * // Get full schema (all clip types)
   * const schema = SIMPLEFFMPEG.getSchema();
   *
   * @example
   * // Only video and image clip types
   * const schema = SIMPLEFFMPEG.getSchema({ include: ['video', 'image'] });
   *
   * @example
   * // Everything except text, with custom instructions
   * const schema = SIMPLEFFMPEG.getSchema({
   *   exclude: ['text'],
   *   instructions: 'Keep videos under 30 seconds.',
   *   moduleInstructions: { video: 'Always use fade transitions.' }
   * });
   */
  static getSchema(options?: SIMPLEFFMPEG.SchemaOptions): string;

  /**
   * Get the list of available schema module IDs.
   * Use these IDs with getSchema({ include: [...] }) or getSchema({ exclude: [...] }).
   *
   * @returns Array of module IDs
   */
  static getSchemaModules(): SIMPLEFFMPEG.SchemaModuleId[];
}

export default SIMPLEFFMPEG;
