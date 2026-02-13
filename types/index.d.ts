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
    /** Structured error details for bug reporting */
    readonly details: {
      stderrTail: string;
      command: string;
      exitCode: number | null;
    };
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
    | "subtitle"
    | "color"
    | "effect";

  interface BaseClip {
    type: ClipType;
    url?: string;
    /** Start time on timeline in seconds. For video/image/audio: omit to auto-sequence after the previous clip. */
    position?: number;
    /** End time on timeline in seconds. Mutually exclusive with duration. */
    end?: number;
    /** Duration in seconds (alternative to end). Computes end = position + duration. Mutually exclusive with end. */
    duration?: number;
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

  type KenBurnsEffect =
    | "zoom-in"
    | "zoom-out"
    | "pan-left"
    | "pan-right"
    | "pan-up"
    | "pan-down"
    | "smart"
    | "custom";

  type KenBurnsAnchor = "top" | "bottom" | "left" | "right";
  type KenBurnsEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

  interface KenBurnsSpec {
    type?: KenBurnsEffect;
    startZoom?: number;
    endZoom?: number;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    anchor?: KenBurnsAnchor;
    easing?: KenBurnsEasing;
  }

  interface ImageClip extends BaseClip {
    type: "image";
    url: string;
    width?: number;
    height?: number;
    kenBurns?: KenBurnsEffect | KenBurnsSpec;
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
    fontFamily?: string; // defaults to 'Sans' via fontconfig
    fontSize?: number; // default 48
    fontColor?: string; // default '#FFFFFF'

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

  /** Gradient specification for color clips */
  interface GradientSpec {
    type: "linear-gradient" | "radial-gradient";
    /** Array of color strings (at least 2). Evenly distributed across the gradient. */
    colors: string[];
    /** For linear gradients: "vertical" (default), "horizontal", or angle in degrees */
    direction?: "vertical" | "horizontal" | number;
  }

  /** Color clip — solid color or gradient for filling gaps, transitions, etc. */
  interface ColorClip {
    type: "color";
    /** Flat color string (e.g. "black", "#FF0000") or gradient specification */
    color: string | GradientSpec;
    /** Start time on timeline in seconds. Omit to auto-sequence after previous visual clip. */
    position?: number;
    /** End time on timeline in seconds. Mutually exclusive with duration. */
    end?: number;
    /** Duration in seconds (alternative to end). end = position + duration. */
    duration?: number;
    /** Transition effect from the previous visual clip */
    transition?: { type: string; duration: number };
  }

  type EffectName =
    | "vignette"
    | "filmGrain"
    | "gaussianBlur"
    | "colorAdjust"
    | "sepia"
    | "blackAndWhite"
    | "sharpen"
    | "chromaticAberration"
    | "letterbox";

  interface EffectParamsBase {
    /** Base blend amount from 0 to 1 (default: 1) */
    amount?: number;
  }

  interface VignetteEffectParams extends EffectParamsBase {
    /** Vignette angle in radians (default: PI/5) */
    angle?: number;
  }

  interface FilmGrainEffectParams extends EffectParamsBase {
    /** Noise intensity 0-1 (default: 0.35). Independent from blend amount. */
    strength?: number;
    /** Temporal grain changes every frame (default: true) */
    temporal?: boolean;
  }

  interface GaussianBlurEffectParams extends EffectParamsBase {
    /** Gaussian blur sigma (default derived from amount) */
    sigma?: number;
  }

  interface ColorAdjustEffectParams extends EffectParamsBase {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    gamma?: number;
  }

  interface SepiaEffectParams extends EffectParamsBase {}

  interface BlackAndWhiteEffectParams extends EffectParamsBase {
    /** Optional contrast boost (default: 1, range 0-3) */
    contrast?: number;
  }

  interface SharpenEffectParams extends EffectParamsBase {
    /** Unsharp amount (default: 1.0, range 0-3) */
    strength?: number;
  }

  interface ChromaticAberrationEffectParams extends EffectParamsBase {
    /** Horizontal pixel offset for R/B channels (default: 4, range 0-20) */
    shift?: number;
  }

  interface LetterboxEffectParams extends EffectParamsBase {
    /** Bar height as fraction of frame height (default: 0.12, range 0-0.5) */
    size?: number;
    /** Bar color (default: "black") */
    color?: string;
  }

  type EffectParams =
    | VignetteEffectParams
    | FilmGrainEffectParams
    | GaussianBlurEffectParams
    | ColorAdjustEffectParams
    | SepiaEffectParams
    | BlackAndWhiteEffectParams
    | SharpenEffectParams
    | ChromaticAberrationEffectParams
    | LetterboxEffectParams;

  /** Effect clip — timed overlay adjustment layer over composed video */
  interface EffectClip {
    type: "effect";
    effect: EffectName;
    /** Start time on timeline in seconds. Required for effect clips. */
    position: number;
    /** End time on timeline in seconds. Mutually exclusive with duration. */
    end?: number;
    /** Duration in seconds (alternative to end). end = position + duration. */
    duration?: number;
    /** Ramp-in duration in seconds */
    fadeIn?: number;
    /** Ramp-out duration in seconds */
    fadeOut?: number;
    /** Effect-specific params */
    params: EffectParams;
  }

  type Clip =
    | VideoClip
    | AudioClip
    | BackgroundMusicClip
    | ImageClip
    | ColorClip
    | EffectClip
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
    /** Default font file path (.ttf, .otf) applied to all text clips. Individual clips can override this with their own fontFile. */
    fontFile?: string;
  }

  /** Log entry passed to onLog callback */
  interface LogEntry {
    level: "stderr" | "stdout";
    message: string;
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
    /** Export phase: "rendering" during main export, "batching" during text overlay passes */
    phase?: "rendering" | "batching";
  }

  /** Metadata to embed in output file */
  interface MetadataOptions {
    title?: string;
    artist?: string;
    album?: string;
    comment?: string;
    date?: string;
    genre?: string;
    /** Custom metadata key-value pairs */
    custom?: Record<string, string>;
  }

  /** Thumbnail generation options */
  interface ThumbnailOptions {
    /** Output path for thumbnail image */
    outputPath: string;
    /** Time in seconds to capture (default: 0) */
    time?: number;
    /** Thumbnail width (maintains aspect if height omitted) */
    width?: number;
    /** Thumbnail height (maintains aspect if width omitted) */
    height?: number;
  }

  /** Options for SIMPLEFFMPEG.snapshot() — capture a single frame from a video */
  interface SnapshotOptions {
    /** Output image path (extension determines format: .jpg, .png, .webp, .bmp, .tiff) */
    outputPath: string;
    /** Time in seconds to capture the frame at (default: 0) */
    time?: number;
    /** Output width in pixels (maintains aspect ratio if height omitted) */
    width?: number;
    /** Output height in pixels (maintains aspect ratio if width omitted) */
    height?: number;
    /** JPEG quality 1-31, lower is better (default: 2, only applies to JPEG output) */
    quality?: number;
  }

  /** Hardware acceleration options */
  type HardwareAcceleration =
    | "auto"
    | "videotoolbox"
    | "nvenc"
    | "vaapi"
    | "qsv"
    | "none";

  /** Video codec options */
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

  /** Audio codec options */
  type AudioCodec =
    | "aac"
    | "libmp3lame"
    | "libopus"
    | "pcm_s16le"
    | "flac"
    | "copy"
    | string;

  /** Encoding preset options */
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

  /** Resolution presets */
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
    /** Horizontal position as percentage (0 = left, 0.5 = center, 1 = right) */
    xPercent: number;
    /** Vertical position as percentage (0 = top, 0.5 = center, 1 = bottom) */
    yPercent: number;
  }

  /** Custom position using pixels */
  interface WatermarkPositionPixel {
    /** X position in pixels from left */
    x: number;
    /** Y position in pixels from top */
    y: number;
  }

  /** Watermark position options */
  type WatermarkPosition =
    | WatermarkPositionPreset
    | WatermarkPositionPercent
    | WatermarkPositionPixel;

  /** Base watermark options shared by image and text watermarks */
  interface BaseWatermarkOptions {
    /** Position preset or custom coordinates (default: 'bottom-right') */
    position?: WatermarkPosition;
    /** Margin from edge in pixels when using preset positions (default: 20) */
    margin?: number;
    /** Opacity from 0 (transparent) to 1 (opaque) (default: 1) */
    opacity?: number;
    /** Start time in seconds (default: 0, start of video) */
    startTime?: number;
    /** End time in seconds (default: end of video) */
    endTime?: number;
  }

  /** Image watermark options */
  interface ImageWatermarkOptions extends BaseWatermarkOptions {
    type: "image";
    /** Path to the watermark image file */
    url: string;
    /** Scale relative to video width, 0-1 (default: 0.15, i.e., 15% of width) */
    scale?: number;
  }

  /** Text watermark options */
  interface TextWatermarkOptions extends BaseWatermarkOptions {
    type: "text";
    /** Text to display as watermark */
    text: string;
    /** Font size in pixels (default: 24) */
    fontSize?: number;
    /** Font color in hex format (default: '#FFFFFF') */
    fontColor?: string;
    /** Font family name (default: 'Sans') */
    fontFamily?: string;
    /** Path to custom font file */
    fontFile?: string;
    /** Border/outline color */
    borderColor?: string;
    /** Border/outline width in pixels */
    borderWidth?: number;
    /** Shadow color */
    shadowColor?: string;
    /** Shadow X offset */
    shadowX?: number;
    /** Shadow Y offset */
    shadowY?: number;
  }

  /** Watermark configuration - either image or text */
  type WatermarkOptions = ImageWatermarkOptions | TextWatermarkOptions;

  interface ExportOptions {
    // ─────────────────────────────────────────────────────────────────────────
    // Output
    // ─────────────────────────────────────────────────────────────────────────

    /** Output file path (default: './output.mp4') */
    outputPath?: string;

    // ─────────────────────────────────────────────────────────────────────────
    // Video Encoding
    // ─────────────────────────────────────────────────────────────────────────

    /** Video codec (default: 'libx264') */
    videoCodec?: VideoCodec;
    /** Quality level 0-51, lower is better (default: 23) */
    crf?: number;
    /** Encoding speed/quality tradeoff (default: 'medium') */
    preset?: EncodingPreset;
    /** Target video bitrate (e.g., '5M', '2500k'). Overrides CRF when set. */
    videoBitrate?: string;

    // ─────────────────────────────────────────────────────────────────────────
    // Audio Encoding
    // ─────────────────────────────────────────────────────────────────────────

    /** Audio codec (default: 'aac') */
    audioCodec?: AudioCodec;
    /** Audio bitrate (default: '192k') */
    audioBitrate?: string;
    /** Audio sample rate in Hz (default: 48000) */
    audioSampleRate?: number;

    // ─────────────────────────────────────────────────────────────────────────
    // Hardware Acceleration
    // ─────────────────────────────────────────────────────────────────────────

    /** Hardware acceleration mode (default: 'none') */
    hwaccel?: HardwareAcceleration;

    // ─────────────────────────────────────────────────────────────────────────
    // Output Resolution
    // ─────────────────────────────────────────────────────────────────────────

    /** Output width in pixels (scales the output) */
    outputWidth?: number;
    /** Output height in pixels (scales the output) */
    outputHeight?: number;
    /** Resolution preset ('720p', '1080p', '4k', etc.) */
    outputResolution?: ResolutionPreset;

    // ─────────────────────────────────────────────────────────────────────────
    // Advanced Options
    // ─────────────────────────────────────────────────────────────────────────

    /** Export audio only (no video) */
    audioOnly?: boolean;
    /** Enable two-pass encoding for better quality at target bitrate */
    twoPass?: boolean;
    /** Metadata to embed in output file */
    metadata?: MetadataOptions;
    /** Generate a thumbnail from the output */
    thumbnail?: ThumbnailOptions;

    // ─────────────────────────────────────────────────────────────────────────
    // Debug & Logging
    // ─────────────────────────────────────────────────────────────────────────

    /** Enable verbose logging */
    verbose?: boolean;
    /** FFmpeg log level (default: 'warning') */
    logLevel?:
      | "quiet"
      | "panic"
      | "fatal"
      | "error"
      | "warning"
      | "info"
      | "verbose"
      | "debug";
    /** Save FFmpeg command to file for debugging */
    saveCommand?: string;

    // ─────────────────────────────────────────────────────────────────────────
    // Callbacks & Control
    // ─────────────────────────────────────────────────────────────────────────

    /** Progress callback for monitoring export progress */
    onProgress?: (progress: ProgressInfo) => void;
    /** FFmpeg log callback for real-time stderr/stdout output */
    onLog?: (entry: LogEntry) => void;
    /** AbortSignal for cancelling the export */
    signal?: AbortSignal;

    // ─────────────────────────────────────────────────────────────────────────
    // Text Batching (Advanced)
    // ─────────────────────────────────────────────────────────────────────────

    /** Maximum text overlay nodes per FFmpeg pass (default: 75) */
    textMaxNodesPerPass?: number;
    /** Video codec for intermediate text passes (default: 'libx264') */
    intermediateVideoCodec?: string;
    /** CRF for intermediate text passes (default: 18) */
    intermediateCrf?: number;
    /** Preset for intermediate text passes (default: 'veryfast') */
    intermediatePreset?: string;

    // ─────────────────────────────────────────────────────────────────────────
    // Watermark
    // ─────────────────────────────────────────────────────────────────────────

    /** Add a watermark overlay (image or text) to the video */
    watermark?: WatermarkOptions;

    // ─────────────────────────────────────────────────────────────────────────
    // Timeline
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Automatically adjust text/subtitle timings to compensate for timeline
     * compression caused by xfade transitions (default: true).
     * When enabled, text positioned at "15s" will appear at the visual 15s mark
     * even if transitions have compressed the actual timeline.
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
    | "color"
    | "effect"
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Media Info (probe)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Result from SIMPLEFFMPEG.probe() — comprehensive media file metadata */
  interface MediaInfo {
    /** Total duration in seconds */
    duration: number | null;
    /** Video width in pixels (null for audio-only files) */
    width: number | null;
    /** Video height in pixels (null for audio-only files) */
    height: number | null;
    /** Whether the file contains a video stream */
    hasVideo: boolean;
    /** Whether the file contains an audio stream */
    hasAudio: boolean;
    /** iPhone/mobile rotation value in degrees (0 if none) */
    rotation: number;
    /** Video codec name, e.g. "h264", "hevc", "vp9" (null if no video) */
    videoCodec: string | null;
    /** Audio codec name, e.g. "aac", "mp3", "pcm_s16le" (null if no audio) */
    audioCodec: string | null;
    /** Container format name, e.g. "mov,mp4,m4a,3gp,3g2,mj2" */
    format: string | null;
    /** Frames per second (null for non-video files) */
    fps: number | null;
    /** File size in bytes */
    size: number | null;
    /** Overall bitrate in bits per second */
    bitrate: number | null;
    /** Audio sample rate in Hz, e.g. 48000, 44100 (null if no audio) */
    sampleRate: number | null;
    /** Number of audio channels (1=mono, 2=stereo) (null if no audio) */
    channels: number | null;
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
   * @returns Map of preset names to their configurations
   */
  static getPresets(): Record<
    SIMPLEFFMPEG.PlatformPreset,
    SIMPLEFFMPEG.PresetConfig
  >;

  /**
   * Get list of available preset names
   * @returns Array of preset names
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
   * Calculate the total duration of a clips configuration.
   * Resolves shorthand (duration, auto-sequencing) before computing.
   * Returns the visual timeline duration: sum of video/image clip durations
   * minus transition overlaps.
   *
   * Pure function — same clips always produce the same result. No file I/O.
   *
   * @param clips - Array of clip objects
   * @returns Total duration in seconds
   *
   * @example
   * const duration = SIMPLEFFMPEG.getDuration([
   *   { type: "video", url: "./a.mp4", duration: 5 },
   *   { type: "video", url: "./b.mp4", duration: 10,
   *     transition: { type: "fade", duration: 0.5 } },
   * ]);
   * // duration === 14.5
   */
  static getDuration(clips: SIMPLEFFMPEG.Clip[]): number;

  /**
   * Probe a media file and return comprehensive metadata.
   *
   * Uses ffprobe to extract duration, dimensions, codecs, format,
   * bitrate, audio details, and rotation info from any media file.
   *
   * @param filePath - Path to the media file
   * @returns Media info object
   * @throws {SIMPLEFFMPEG.MediaNotFoundError} If the file cannot be found or probed
   *
   * @example
   * const info = await SIMPLEFFMPEG.probe("./video.mp4");
   * console.log(info.duration);   // 30.5
   * console.log(info.width);      // 1920
   * console.log(info.height);     // 1080
   * console.log(info.videoCodec); // "h264"
   * console.log(info.hasAudio);   // true
   */
  static probe(filePath: string): Promise<SIMPLEFFMPEG.MediaInfo>;

  /**
   * Capture a single frame from a video file and save it as an image.
   * The output format is determined by the outputPath file extension
   * (.jpg, .png, .webp, .bmp, .tiff).
   *
   * @param filePath - Path to the source video file
   * @param options - Snapshot options
   * @returns The output path
   * @throws {SIMPLEFFMPEG.SimpleffmpegError} If filePath or outputPath is missing
   * @throws {SIMPLEFFMPEG.FFmpegError} If FFmpeg fails to extract the frame
   *
   * @example
   * await SIMPLEFFMPEG.snapshot("./video.mp4", {
   *   outputPath: "./frame.png",
   *   time: 5,
   * });
   */
  static snapshot(
    filePath: string,
    options: SIMPLEFFMPEG.SnapshotOptions
  ): Promise<string>;

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

/**
 * Synthetic default export type for ESM default-import IntelliSense
 */
declare namespace _defaultExportType {
  export { SIMPLEFFMPEG as default };
}

export = SIMPLEFFMPEG;
