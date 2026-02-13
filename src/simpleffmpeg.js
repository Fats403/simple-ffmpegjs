const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const TextRenderer = require("./ffmpeg/text_renderer");
const { unrotateVideo } = require("./core/rotation");
const Loaders = require("./loaders");
const { buildVideoFilter } = require("./ffmpeg/video_builder");
const { buildAudioForVideoClips } = require("./ffmpeg/audio_builder");
const { buildBackgroundMusicMix } = require("./ffmpeg/bgm_builder");
const { buildEffectFilters } = require("./ffmpeg/effect_builder");
const {
  getClipAudioString,
  hasProblematicChars,
  escapeFilePath,
} = require("./ffmpeg/strings");
const {
  validateConfig,
  formatValidationResult,
  ValidationCodes,
} = require("./core/validation");
const {
  SimpleffmpegError,
  ValidationError,
  FFmpegError,
  MediaNotFoundError,
  ExportCancelledError,
} = require("./core/errors");
const C = require("./core/constants");
const {
  buildMainCommand,
  buildThumbnailCommand,
  buildSnapshotCommand,
} = require("./ffmpeg/command_builder");
const { runTextPasses } = require("./ffmpeg/text_passes");
const { formatBytes, runFFmpeg } = require("./lib/utils");
const {
  buildWatermarkFilter,
  validateWatermarkConfig,
} = require("./ffmpeg/watermark_builder");
const {
  buildKaraokeASS,
  loadSubtitleFile,
  buildASSFilter,
} = require("./ffmpeg/subtitle_builder");
const { getSchema, getSchemaModules } = require("./schema");
const { resolveClips } = require("./core/resolve");
const { probeMedia } = require("./core/media_info");

class SIMPLEFFMPEG {
  /**
   * Create a new SIMPLEFFMPEG project
   *
   * @param {Object} options - Project configuration options
   * @param {number} options.width - Output width in pixels (default: 1920)
   * @param {number} options.height - Output height in pixels (default: 1080)
   * @param {number} options.fps - Frames per second (default: 30)
   * @param {string} options.preset - Platform preset ('tiktok', 'youtube', 'instagram-post', etc.)
   * @param {string} options.validationMode - Validation behavior: 'warn' or 'strict' (default: 'warn')
   * @param {string} options.fontFile - Default font file path (.ttf, .otf) applied to all text clips unless overridden per-clip
   *
   * @example
   * const project = new SIMPLEFFMPEG({ preset: 'tiktok' });
   *
   * @example
   * const project = new SIMPLEFFMPEG({
   *   width: 1920,
   *   height: 1080,
   *   fps: 30
   * });
   */
  constructor(options = {}) {
    // Apply platform preset if specified
    let presetConfig = {};
    if (options.preset && C.PLATFORM_PRESETS[options.preset]) {
      presetConfig = C.PLATFORM_PRESETS[options.preset];
    } else if (options.preset) {
      console.warn(
        `Unknown platform preset '${
          options.preset
        }'. Valid presets: ${Object.keys(C.PLATFORM_PRESETS).join(", ")}`
      );
    }

    // Explicit options override preset values
    this.options = {
      fps: options.fps || presetConfig.fps || C.DEFAULT_FPS,
      width: options.width || presetConfig.width || C.DEFAULT_WIDTH,
      height: options.height || presetConfig.height || C.DEFAULT_HEIGHT,
      validationMode: options.validationMode || C.DEFAULT_VALIDATION_MODE,
      preset: options.preset || null,
      fontFile: options.fontFile || null,
    };
    this.videoOrAudioClips = [];
    this.textClips = [];
    this.subtitleClips = [];
    this.effectClips = [];
    this.filesToClean = [];
    this._isLoading = false; // Guard against concurrent load() calls
    this._isExporting = false; // Guard against concurrent export() calls
  }

  /**
   * Build FFmpeg input stream arguments for all loaded clips
   * @private
   * @returns {string} FFmpeg input arguments string
   */
  _getInputStreams() {
    return this.videoOrAudioClips
      .filter((clip) => {
        // Flat color clips use the color= filter source — no file input needed
        if (clip.type === "color" && clip._isFlatColor) return false;
        return true;
      })
      .map((clip) => {
        const escapedUrl = escapeFilePath(clip.url);
        // Gradient color clips and image clips are looped images
        if (clip.type === "image" || (clip.type === "color" && !clip._isFlatColor)) {
          const duration = Math.max(0, clip.end - clip.position || 0);
          return `-loop 1 -t ${duration} -i "${escapedUrl}"`;
        }
        // Loop background music if specified
        if (
          (clip.type === "music" || clip.type === "backgroundAudio") &&
          clip.loop
        ) {
          return `-stream_loop -1 -i "${escapedUrl}"`;
        }
        return `-i "${escapedUrl}"`;
      })
      .join(" ");
  }

  /**
   * Clean up temporary files created during export (unrotated videos, temp ASS files, etc.)
   * @private
   * @returns {Promise<void>}
   */
  async _cleanup() {
    const files = [...this.filesToClean];
    this.filesToClean = []; // Clear the list to prevent double cleanup

    await Promise.all(
      files.map(async (file) => {
        try {
          await fsPromises.unlink(file);
          console.log("File cleaned up:", file);
        } catch (error) {
          // Ignore ENOENT (file already deleted), log others
          if (error.code !== "ENOENT") {
            console.error("Error cleaning up file:", error);
          }
        }
      })
    );
  }

  /**
   * Calculate cumulative transition offset at a given timestamp.
   * Transitions cause timeline compression - this returns how much time
   * has been "lost" to transitions before the given timestamp.
   * @private
   * @param {Array} videoClips - Array of video clips sorted by position
   * @param {number} timestamp - The original timeline timestamp
   * @returns {number} Cumulative transition duration before this timestamp
   */
  _getTransitionOffsetAt(videoClips, timestamp) {
    let cumulativeOffset = 0;
    for (let i = 1; i < videoClips.length; i++) {
      const clip = videoClips[i];
      const transitionPoint = clip.position || 0;
      // Only count transitions that occur at or before this timestamp
      if (transitionPoint <= timestamp && clip.transition) {
        const duration =
          typeof clip.transition.duration === "number"
            ? clip.transition.duration
            : 0;
        cumulativeOffset += duration;
      }
    }
    return cumulativeOffset;
  }

  /**
   * Adjust a timestamp to account for transition timeline compression.
   * @private
   * @param {Array} videoClips - Array of video clips sorted by position
   * @param {number} timestamp - The original timeline timestamp
   * @returns {number} Adjusted timestamp for the compressed timeline
   */
  _adjustTimestampForTransitions(videoClips, timestamp) {
    return timestamp - this._getTransitionOffsetAt(videoClips, timestamp);
  }

  /**
   * Load clips into the project for processing
   *
   * @param {Array} clipObjs - Array of clip configuration objects
   * @param {string} clipObjs[].type - Clip type: 'video', 'audio', 'image', 'color', 'text', 'effect', 'music', 'backgroundAudio', 'subtitle'
   * @param {string} clipObjs[].url - Media file path (required for video, audio, image, music, subtitle)
   * @param {number} clipObjs[].position - Start time on timeline in seconds
   * @param {number} clipObjs[].end - End time on timeline in seconds
   * @param {number} clipObjs[].cutFrom - Start time within source media (default: 0)
   * @param {number} clipObjs[].volume - Audio volume multiplier (default: 1)
   * @param {Object|string} clipObjs[].transition - Transition effect for video clips
   * @param {string} clipObjs[].text - Text content (for text clips)
   * @param {string} clipObjs[].mode - Text mode: 'static', 'word-replace', 'word-sequential', 'karaoke'
   * @param {string} clipObjs[].kenBurns - Ken Burns effect for images: 'zoom-in', 'zoom-out', 'pan-left', etc.
   * @returns {Promise<void>} Resolves when all clips are loaded
   * @throws {ValidationError} If clip configuration is invalid
   *
   * @example
   * await project.load([
   *   { type: 'video', url: './clip.mp4', position: 0, end: 5 },
   *   { type: 'text', text: 'Hello', position: 1, end: 4, fontSize: 48 }
   * ]);
   */
  async load(clipObjs) {
    // Guard against concurrent load() calls
    if (this._isLoading) {
      throw new SimpleffmpegError(
        "Cannot call load() while another load() is in progress. Await the previous load() call first."
      );
    }

    this._isLoading = true;

    try {
      // Resolve shorthand: duration → end, auto-sequential positioning
      const resolved = resolveClips(clipObjs);

      // Merge resolution errors into validation
      const result = validateConfig(resolved.clips, {
        width: this.options.width,
        height: this.options.height,
      });

      // Prepend resolution errors (e.g. duration+end conflict)
      result.errors.unshift(...resolved.errors);
      result.valid = result.valid && resolved.errors.length === 0;

      if (!result.valid) {
        throw new ValidationError(formatValidationResult(result), {
          errors: result.errors,
          warnings: result.warnings,
        });
      }

      // Log warnings in warn mode
      if (
        this.options.validationMode === "warn" &&
        result.warnings.length > 0
      ) {
        result.warnings.forEach((w) => console.warn(`${w.path}: ${w.message}`));
      }

      // Use resolved clips (with position/end computed) for loading
      const resolvedClips = resolved.clips;

      await Promise.all(
        resolvedClips.map((clipObj) => {
          if (clipObj.type === "video" || clipObj.type === "audio") {
            clipObj.volume = clipObj.volume != null ? clipObj.volume : 1;
            clipObj.cutFrom = clipObj.cutFrom || 0;
          }
          // Normalize transitions for all visual clip types
          if (
            (clipObj.type === "video" || clipObj.type === "image" || clipObj.type === "color") &&
            clipObj.transition
          ) {
            clipObj.transition = {
              type: clipObj.transition.type || clipObj.transition,
              duration: clipObj.transition.duration || 0.5,
            };
          }
          if (clipObj.type === "video") {
            return Loaders.loadVideo(this, clipObj);
          }
          if (clipObj.type === "audio") {
            return Loaders.loadAudio(this, clipObj);
          }
          if (clipObj.type === "text") {
            return Loaders.loadText(this, clipObj);
          }
          if (clipObj.type === "effect") {
            return Loaders.loadEffect(this, clipObj);
          }
          if (clipObj.type === "image") {
            return Loaders.loadImage(this, clipObj);
          }
          if (clipObj.type === "color") {
            return Loaders.loadColor(this, clipObj);
          }
          if (clipObj.type === "music" || clipObj.type === "backgroundAudio") {
            return Loaders.loadBackgroundAudio(this, clipObj);
          }
          if (clipObj.type === "subtitle") {
            return Loaders.loadSubtitle(this, clipObj);
          }
        })
      );
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Build the export command and metadata (internal helper)
   * @private
   */
  async _prepareExport(options = {}) {
    const exportOptions = {
      // Output
      outputPath: options.outputPath || "./output.mp4",

      // Video encoding
      videoCodec: options.videoCodec || C.VIDEO_CODEC,
      videoCrf: typeof options.crf === "number" ? options.crf : C.VIDEO_CRF,
      videoPreset: options.preset || C.VIDEO_PRESET,
      videoBitrate: options.videoBitrate || C.VIDEO_BITRATE,

      // Audio encoding
      audioCodec: options.audioCodec || C.AUDIO_CODEC,
      audioBitrate: options.audioBitrate || C.AUDIO_BITRATE,
      audioSampleRate: options.audioSampleRate || C.AUDIO_SAMPLE_RATE,

      // Features
      hwaccel: options.hwaccel || "none",
      audioOnly: options.audioOnly || false,
      twoPass: options.twoPass || false,
      metadata: options.metadata || null,
      thumbnail: options.thumbnail || null,

      // Verbose/debug
      verbose: options.verbose || false,
      logLevel: options.logLevel || "warning",
      saveCommand: options.saveCommand || null,

      // Output resolution (scale on export)
      outputWidth: options.outputWidth || null,
      outputHeight: options.outputHeight || null,
      outputResolution: options.outputResolution || null, // '720p', '1080p', '4k'

      // Text batching
      textMaxNodesPerPass:
        typeof options.textMaxNodesPerPass === "number"
          ? options.textMaxNodesPerPass
          : C.DEFAULT_TEXT_MAX_NODES_PER_PASS,
      intermediateVideoCodec:
        options.intermediateVideoCodec || C.INTERMEDIATE_VIDEO_CODEC,
      intermediateCrf:
        typeof options.intermediateCrf === "number"
          ? options.intermediateCrf
          : C.INTERMEDIATE_CRF,
      intermediatePreset: options.intermediatePreset || C.INTERMEDIATE_PRESET,

      // Watermark
      watermark: options.watermark || null,

      // Timeline compensation
      compensateTransitions:
        typeof options.compensateTransitions === "boolean"
          ? options.compensateTransitions
          : true, // Default: true
    };

    // Handle resolution presets
    if (exportOptions.outputResolution) {
      const presets = {
        "480p": { width: 854, height: 480 },
        "720p": { width: 1280, height: 720 },
        "1080p": { width: 1920, height: 1080 },
        "1440p": { width: 2560, height: 1440 },
        "4k": { width: 3840, height: 2160 },
      };
      const preset = presets[exportOptions.outputResolution];
      if (preset) {
        exportOptions.outputWidth = preset.width;
        exportOptions.outputHeight = preset.height;
      }
    }

    this.videoOrAudioClips.sort((a, b) => {
      if (!a.position) return -1;
      if (!b.position) return 1;
      if (a.position < b.position) return -1;
      return 1;
    });

    // Handle rotation
    await Promise.all(
      this.videoOrAudioClips.map(async (clip) => {
        if (clip.type === "video" && clip.iphoneRotation !== 0) {
          const unrotatedUrl = await unrotateVideo(clip.url);
          this.filesToClean.push(unrotatedUrl);
          clip.url = unrotatedUrl;
        }
      })
    );

    // Build a mapping from clip to its FFmpeg input stream index.
    // Flat color clips use the color= filter source and do not have file inputs,
    // so they are skipped by _getInputStreams(). All other clips' indices must
    // account for this offset.
    this._inputIndexMap = new Map();
    let _inputIdx = 0;
    for (const clip of this.videoOrAudioClips) {
      if (clip.type === "color" && clip._isFlatColor) {
        continue; // No file input for flat color clips
      }
      this._inputIndexMap.set(clip, _inputIdx);
      _inputIdx++;
    }

    const videoClips = this.videoOrAudioClips.filter(
      (clip) => clip.type === "video" || clip.type === "image" || clip.type === "color"
    );
    const audioClips = this.videoOrAudioClips.filter(
      (clip) => clip.type === "audio"
    );
    const backgroundClips = this.videoOrAudioClips.filter(
      (clip) => clip.type === "music" || clip.type === "backgroundAudio"
    );

    let filterComplex = "";
    let finalVideoLabel = "";
    let finalAudioLabel = "";
    let hasVideo = false;
    let hasAudio = false;

    let totalVideoDuration = (() => {
      if (videoClips.length === 0) return 0;
      const baseSum = videoClips.reduce(
        (acc, c) => acc + Math.max(0, (c.end || 0) - (c.position || 0)),
        0
      );
      const transitionsOverlap = videoClips.reduce((acc, c) => {
        const d =
          c.transition && typeof c.transition.duration === "number"
            ? c.transition.duration
            : 0;
        return acc + d;
      }, 0);
      return Math.max(0, baseSum - transitionsOverlap);
    })();
    const textEnd =
      this.textClips.length > 0
        ? Math.max(...this.textClips.map((c) => c.end || 0))
        : 0;
    const audioEnds = this.videoOrAudioClips
      .filter(
        (c) =>
          c.type === "audio" ||
          c.type === "music" ||
          c.type === "backgroundAudio"
      )
      .map((c) => (typeof c.end === "number" ? c.end : 0));
    const bgOrAudioEnd = audioEnds.length > 0 ? Math.max(...audioEnds) : 0;

    let finalVisualEnd =
      videoClips.length > 0
        ? Math.max(...videoClips.map((c) => c.end))
        : Math.max(textEnd, bgOrAudioEnd);

    // Build video filter
    if (videoClips.length > 0) {
      const vres = buildVideoFilter(this, videoClips);
      filterComplex += vres.filter;
      finalVideoLabel = vres.finalVideoLabel;
      hasVideo = vres.hasVideo;

      // Use the actual video output length for finalVisualEnd so that
      // audio trim and BGM duration match the real video stream length,
      // rather than an original-timeline position that may differ due to
      // transition compression.
      if (typeof vres.videoDuration === "number" && vres.videoDuration > 0) {
        totalVideoDuration = vres.videoDuration;
      }
      if (
        typeof vres.videoDuration === "number" &&
        vres.videoDuration > finalVisualEnd
      ) {
        finalVisualEnd = vres.videoDuration;
      }
    }

    // Overlay effects (adjustment layer clips) on the composed video output.
    if (this.effectClips.length > 0 && hasVideo && finalVideoLabel) {
      const effectRes = buildEffectFilters(this.effectClips, finalVideoLabel);
      filterComplex += effectRes.filter;
      finalVideoLabel = effectRes.finalVideoLabel || finalVideoLabel;
    }

    // Audio for video clips (aligned amix)
    // Compute cumulative transition offsets so audio adelay values
    // match the xfade-compressed video timeline.
    if (videoClips.length > 0) {
      const transitionOffsets = new Map();
      let cumOffset = 0;
      for (let i = 0; i < videoClips.length; i++) {
        if (i > 0 && videoClips[i].transition) {
          cumOffset += videoClips[i].transition.duration || 0;
        }
        transitionOffsets.set(videoClips[i], cumOffset);
      }
      const ares = buildAudioForVideoClips(this, videoClips, transitionOffsets);
      filterComplex += ares.filter;
      finalAudioLabel = ares.finalAudioLabel || finalAudioLabel;
      hasAudio = hasAudio || ares.hasAudio;
    }

    // Standalone audio clips
    if (audioClips.length > 0) {
      let audioString = "";
      let audioConcatInputs = [];
      audioClips.forEach((clip) => {
        const inputIndex = this._inputIndexMap
          ? this._inputIndexMap.get(clip)
          : this.videoOrAudioClips.indexOf(clip);
        const { audioStringPart, audioConcatInput } = getClipAudioString(
          clip,
          inputIndex
        );
        audioString += audioStringPart;
        audioConcatInputs.push(audioConcatInput);
      });
      if (audioConcatInputs.length > 0) {
        filterComplex += audioString;
        filterComplex += audioConcatInputs.join("");
        if (hasAudio) {
          filterComplex += `${finalAudioLabel}amix=inputs=${
            audioConcatInputs.length + 1
          }:duration=longest[finalaudio];`;
          finalAudioLabel = "[finalaudio]";
        } else {
          filterComplex += `amix=inputs=${audioConcatInputs.length}:duration=longest[finalaudio];`;
          finalAudioLabel = "[finalaudio]";
          hasAudio = true;
        }
      }
    }

    // Background music after other audio
    if (backgroundClips.length > 0) {
      const bgres = buildBackgroundMusicMix(
        this,
        backgroundClips,
        hasAudio ? finalAudioLabel : null,
        finalVisualEnd
      );
      filterComplex += bgres.filter;
      finalAudioLabel = bgres.finalAudioLabel || finalAudioLabel;
      hasAudio = hasAudio || bgres.hasAudio;
    }

    if (hasAudio && finalAudioLabel) {
      const trimEnd = finalVisualEnd > 0 ? finalVisualEnd : totalVideoDuration;
      filterComplex += `${finalAudioLabel}apad,atrim=end=${trimEnd}[audfit];`;
      finalAudioLabel = "[audfit]";
    }

    // Text overlays (drawtext-based)
    let needTextPasses = false;
    let textWindows = [];
    if (this.textClips.length > 0 && hasVideo) {
      // Compensate text timings for transition overlap if enabled
      let adjustedTextClips = this.textClips;
      if (exportOptions.compensateTransitions && videoClips.length > 1) {
        adjustedTextClips = this.textClips.map((clip) => {
          const adjustedPosition = this._adjustTimestampForTransitions(
            videoClips,
            clip.position || 0
          );
          const adjustedEnd = this._adjustTimestampForTransitions(
            videoClips,
            clip.end || 0
          );
          // Also adjust word timings if present
          let adjustedWords = clip.words;
          if (Array.isArray(clip.words)) {
            adjustedWords = clip.words.map((word) => ({
              ...word,
              start: this._adjustTimestampForTransitions(
                videoClips,
                word.start || 0
              ),
              end: this._adjustTimestampForTransitions(
                videoClips,
                word.end || 0
              ),
            }));
          }
          // Also adjust wordTimestamps if present
          let adjustedWordTimestamps = clip.wordTimestamps;
          if (Array.isArray(clip.wordTimestamps)) {
            adjustedWordTimestamps = clip.wordTimestamps.map((ts) =>
              this._adjustTimestampForTransitions(videoClips, ts)
            );
          }
          return {
            ...clip,
            position: adjustedPosition,
            end: adjustedEnd,
            words: adjustedWords,
            wordTimestamps: adjustedWordTimestamps,
          };
        });
      }

      // For text with problematic characters, use temp files (textfile approach)
      adjustedTextClips = adjustedTextClips.map((clip, idx) => {
        const textContent = clip.text || "";
        if (hasProblematicChars(textContent)) {
          const tempPath = path.join(
            path.dirname(exportOptions.outputPath),
            `.simpleffmpeg_text_${idx}_${Date.now()}.txt`
          );
          // Replace newlines with space for non-karaoke (consistent with escapeDrawtextText)
          const normalizedText = textContent.replace(/\r?\n/g, " ");
          try {
            fs.writeFileSync(tempPath, normalizedText, "utf-8");
          } catch (writeError) {
            throw new SimpleffmpegError(
              `Failed to write temporary text file "${tempPath}": ${writeError.message}`,
              { cause: writeError }
            );
          }
          this.filesToClean.push(tempPath);
          return { ...clip, _textFilePath: tempPath };
        }
        return clip;
      });

      textWindows = TextRenderer.expandTextWindows(adjustedTextClips);
      const projectDuration = totalVideoDuration;
      textWindows = textWindows
        .filter((w) => typeof w.start === "number" && w.start < projectDuration)
        .map((w) => ({ ...w, end: Math.min(w.end, projectDuration) }));

      // Check if we need batching based on node count
      needTextPasses = textWindows.length > exportOptions.textMaxNodesPerPass;

      if (!needTextPasses) {
        // Build the filter and check if it's too long
        const { filterString, finalVideoLabel: outLabel } =
          TextRenderer.buildTextFilters(
            adjustedTextClips,
            this.options.width,
            this.options.height,
            finalVideoLabel
          );

        // Auto-batch if filter_complex would exceed safe command length limit
        const potentialLength = filterComplex.length + filterString.length;
        if (potentialLength > C.MAX_FILTER_COMPLEX_LENGTH) {
          // Calculate optimal batch size based on filter length
          const avgNodeLength = filterString.length / textWindows.length;
          const safeNodes = Math.floor(
            (C.MAX_FILTER_COMPLEX_LENGTH - filterComplex.length) / avgNodeLength
          );
          exportOptions.textMaxNodesPerPass = Math.max(
            10,
            Math.min(safeNodes, 50)
          );
          needTextPasses = true;

          if (exportOptions.verbose) {
            console.log(
              `simple-ffmpeg: Auto-batching text (filter too long: ${potentialLength} > ${C.MAX_FILTER_COMPLEX_LENGTH}). ` +
                `Using ${exportOptions.textMaxNodesPerPass} nodes per pass.`
            );
          }
        } else {
          filterComplex += filterString;
          finalVideoLabel = outLabel;
        }
      }
    }

    // Subtitle overlays (ASS-based: karaoke mode and imported subtitles)
    let assFilesToClean = [];
    if (this.subtitleClips.length > 0 && hasVideo) {
      for (let i = 0; i < this.subtitleClips.length; i++) {
        let subClip = this.subtitleClips[i];

        // Compensate subtitle timings for transition overlap if enabled
        if (
          exportOptions.compensateTransitions &&
          videoClips.length > 1 &&
          subClip.mode === "karaoke"
        ) {
          const adjustedPosition = this._adjustTimestampForTransitions(
            videoClips,
            subClip.position || 0
          );
          const adjustedEnd = this._adjustTimestampForTransitions(
            videoClips,
            subClip.end || 0
          );
          let adjustedWords = subClip.words;
          if (Array.isArray(subClip.words)) {
            adjustedWords = subClip.words.map((word) => ({
              ...word,
              start: this._adjustTimestampForTransitions(
                videoClips,
                word.start || 0
              ),
              end: this._adjustTimestampForTransitions(
                videoClips,
                word.end || 0
              ),
            }));
          }
          let adjustedWordTimestamps = subClip.wordTimestamps;
          if (Array.isArray(subClip.wordTimestamps)) {
            adjustedWordTimestamps = subClip.wordTimestamps.map((ts) =>
              this._adjustTimestampForTransitions(videoClips, ts)
            );
          }
          subClip = {
            ...subClip,
            position: adjustedPosition,
            end: adjustedEnd,
            words: adjustedWords,
            wordTimestamps: adjustedWordTimestamps,
          };
        }

        let assContent = "";
        let assFilePath = "";

        if (subClip.type === "subtitle") {
          // Imported subtitle file
          const ext = path.extname(subClip.url).toLowerCase();
          if (ext === ".ass" || ext === ".ssa") {
            // Use ASS file directly
            assFilePath = subClip.url;
          } else {
            // Convert SRT/VTT to ASS
            assContent = loadSubtitleFile(
              subClip.url,
              subClip,
              this.options.width,
              this.options.height
            );
          }
        } else if (subClip.mode === "karaoke") {
          // Generate karaoke ASS
          assContent = buildKaraokeASS(
            subClip,
            this.options.width,
            this.options.height
          );
        }

        // Write temp ASS file if we generated content
        if (assContent && !assFilePath) {
          assFilePath = path.join(
            path.dirname(exportOptions.outputPath),
            `.simpleffmpeg_sub_${i}_${Date.now()}.ass`
          );
          try {
            fs.writeFileSync(assFilePath, assContent, "utf-8");
          } catch (writeError) {
            throw new SimpleffmpegError(
              `Failed to write temporary ASS file "${assFilePath}": ${writeError.message}`,
              { cause: writeError }
            );
          }
          assFilesToClean.push(assFilePath);
          this.filesToClean.push(assFilePath);
        }

        // Apply ASS filter
        if (assFilePath) {
          const assResult = buildASSFilter(assFilePath, finalVideoLabel);
          // Need to rename output label to avoid conflicts
          const uniqueLabel = `[outsub${i}]`;
          const filter = assResult.filter.replace(
            assResult.finalLabel,
            uniqueLabel
          );
          filterComplex += filter + ";";
          finalVideoLabel = uniqueLabel;
        }
      }
    }

    // Watermark overlay
    let watermarkInputIndex = null;
    let watermarkInputString = "";
    if (exportOptions.watermark && hasVideo) {
      // Validate watermark config
      const wmValidation = validateWatermarkConfig(exportOptions.watermark);
      if (!wmValidation.valid) {
        throw new Error(
          `Watermark validation failed: ${wmValidation.errors.join(", ")}`
        );
      }

      const wmConfig = exportOptions.watermark;

      // For image watermarks, we need to add an input
      if (wmConfig.type === "image" && wmConfig.url) {
        watermarkInputIndex = this.videoOrAudioClips.length;
        watermarkInputString = ` -i "${escapeFilePath(wmConfig.url)}"`;
      }

      const wmResult = buildWatermarkFilter(
        wmConfig,
        finalVideoLabel,
        watermarkInputIndex,
        this.options.width,
        this.options.height,
        totalVideoDuration
      );

      if (wmResult.filter) {
        filterComplex += wmResult.filter + ";";
        finalVideoLabel = wmResult.finalLabel;
      }
    }

    // Add output scaling filter if needed
    if (exportOptions.outputWidth || exportOptions.outputHeight) {
      const scaleW = exportOptions.outputWidth || -2;
      const scaleH = exportOptions.outputHeight || -2;
      if (hasVideo && finalVideoLabel) {
        filterComplex += `${finalVideoLabel}scale=${scaleW}:${scaleH}:force_original_aspect_ratio=decrease,pad=${scaleW}:${scaleH}:(ow-iw)/2:(oh-ih)/2[outscaled];`;
        finalVideoLabel = "[outscaled]";
      }
    }

    // Build command
    const command = buildMainCommand({
      inputs: this._getInputStreams() + watermarkInputString,
      filterComplex,
      mapVideo: finalVideoLabel,
      mapAudio: finalAudioLabel,
      hasVideo,
      hasAudio,
      // Video encoding
      videoCodec: exportOptions.videoCodec,
      videoPreset: exportOptions.videoPreset,
      videoCrf: exportOptions.videoCrf,
      videoBitrate: exportOptions.videoBitrate,
      // Audio encoding
      audioCodec: exportOptions.audioCodec,
      audioBitrate: exportOptions.audioBitrate,
      audioSampleRate: exportOptions.audioSampleRate,
      // Options
      shortest: true,
      faststart: true,
      outputPath: exportOptions.outputPath,
      // New options
      hwaccel: exportOptions.hwaccel,
      audioOnly: exportOptions.audioOnly,
      metadata: exportOptions.metadata,
      twoPass: exportOptions.twoPass,
    });

    return {
      command,
      filterComplex,
      exportOptions,
      totalDuration: totalVideoDuration || finalVisualEnd,
      needTextPasses,
      textWindows,
      videoClips,
      audioClips,
      backgroundClips,
      hasVideo,
      hasAudio,
      finalVideoLabel,
      finalAudioLabel,
    };
  }

  /**
   * Get a preview of the FFmpeg command without executing it (dry-run)
   * @param {Object} options - Same options as export()
   * @returns {Promise<{command: string, filterComplex: string, totalDuration: number}>}
   */
  async preview(options = {}) {
    const result = await this._prepareExport(options);
    return {
      command: result.command,
      filterComplex: result.filterComplex,
      totalDuration: result.totalDuration,
    };
  }

  /**
   * Export the project to a video file
   * @param {Object} options - Export options
   * @param {string} options.outputPath - Output file path (default: './output.mp4')
   * @param {Function} options.onProgress - Progress callback ({percent, timeProcessed, fps, speed})
   * @param {AbortSignal} options.signal - AbortSignal for cancellation
   * @param {string} options.videoCodec - Video codec (default: 'libx264')
   * @param {number} options.crf - Quality level 0-51 (default: 23)
   * @param {string} options.preset - Encoding preset (default: 'medium')
   * @param {string} options.videoBitrate - Target bitrate (e.g., '5M')
   * @param {string} options.audioCodec - Audio codec (default: 'aac')
   * @param {string} options.audioBitrate - Audio bitrate (default: '192k')
   * @param {number} options.audioSampleRate - Sample rate (default: 48000)
   * @param {string} options.hwaccel - Hardware acceleration ('auto', 'videotoolbox', 'nvenc', 'vaapi', 'qsv', 'none')
   * @param {boolean} options.audioOnly - Export audio only
   * @param {boolean} options.twoPass - Enable two-pass encoding
   * @param {Object} options.metadata - Metadata to embed
   * @param {Object} options.thumbnail - Thumbnail options {outputPath, time, width?, height?}
   * @param {boolean} options.verbose - Enable verbose logging
   * @param {string} options.logLevel - FFmpeg log level
   * @param {string} options.saveCommand - Save FFmpeg command to file
   * @param {number} options.outputWidth - Output width (scales video)
   * @param {number} options.outputHeight - Output height (scales video)
   * @param {string} options.outputResolution - Resolution preset ('720p', '1080p', '4k')
   * @returns {Promise<string>} The output file path
   */
  async export(options = {}) {
    // Guard against concurrent export() calls
    if (this._isExporting) {
      throw new SimpleffmpegError(
        "Cannot call export() while another export() is in progress. Await the previous export() call first."
      );
    }

    this._isExporting = true;
    const t0 = Date.now();
    const { onProgress, signal, onLog } = options;

    let prepared;
    try {
      prepared = await this._prepareExport(options);
    } catch (error) {
      this._isExporting = false;
      throw error;
    }
    const {
      command,
      exportOptions,
      totalDuration,
      needTextPasses,
      textWindows,
      videoClips,
      audioClips,
      backgroundClips,
      hasVideo,
      hasAudio,
      finalVideoLabel,
      finalAudioLabel,
    } = prepared;

    // Verbose logging
    if (exportOptions.verbose) {
      console.log(
        "simple-ffmpeg: Export options:",
        JSON.stringify(exportOptions, null, 2)
      );
    }

    // Save command to file if requested
    if (exportOptions.saveCommand) {
      try {
        fs.writeFileSync(exportOptions.saveCommand, command, "utf8");
        console.log(
          `simple-ffmpeg: Command saved to ${exportOptions.saveCommand}`
        );
      } catch (writeError) {
        throw new SimpleffmpegError(
          `Failed to save command to "${exportOptions.saveCommand}": ${writeError.message}`,
          { cause: writeError }
        );
      }
    }

    console.log("simple-ffmpeg: Starting export...");

    try {
      // Two-pass encoding
      if (exportOptions.twoPass && exportOptions.videoBitrate && hasVideo) {
        const passLogFile = path.join(
          path.dirname(exportOptions.outputPath),
          `ffmpeg2pass-${Date.now()}`
        );

        // First pass
        if (exportOptions.verbose) {
          console.log("simple-ffmpeg: Running first pass...");
        }

        const pass1Command = buildMainCommand({
          inputs: this._getInputStreams(),
          filterComplex: prepared.filterComplex,
          mapVideo: finalVideoLabel,
          mapAudio: finalAudioLabel,
          hasVideo,
          hasAudio: false, // No audio in first pass
          videoCodec: exportOptions.videoCodec,
          videoPreset: exportOptions.videoPreset,
          videoCrf: null,
          videoBitrate: exportOptions.videoBitrate,
          audioCodec: exportOptions.audioCodec,
          audioBitrate: exportOptions.audioBitrate,
          shortest: false,
          faststart: false,
          outputPath: exportOptions.outputPath,
          hwaccel: exportOptions.hwaccel,
          twoPass: true,
          passNumber: 1,
          passLogFile,
        });

        await runFFmpeg({
          command: pass1Command,
          totalDuration,
          signal,
          onLog,
        });

        // Second pass
        if (exportOptions.verbose) {
          console.log("simple-ffmpeg: Running second pass...");
        }

        const pass2Command = buildMainCommand({
          inputs: this._getInputStreams(),
          filterComplex: prepared.filterComplex,
          mapVideo: finalVideoLabel,
          mapAudio: finalAudioLabel,
          hasVideo,
          hasAudio,
          videoCodec: exportOptions.videoCodec,
          videoPreset: exportOptions.videoPreset,
          videoCrf: null,
          videoBitrate: exportOptions.videoBitrate,
          audioCodec: exportOptions.audioCodec,
          audioBitrate: exportOptions.audioBitrate,
          audioSampleRate: exportOptions.audioSampleRate,
          shortest: true,
          faststart: true,
          outputPath: exportOptions.outputPath,
          hwaccel: exportOptions.hwaccel,
          metadata: exportOptions.metadata,
          twoPass: true,
          passNumber: 2,
          passLogFile,
        });

        await runFFmpeg({
          command: pass2Command,
          totalDuration,
          onProgress,
          signal,
          onLog,
        });

        // Clean up pass log files
        try {
          fs.unlinkSync(`${passLogFile}-0.log`);
          fs.unlinkSync(`${passLogFile}-0.log.mbtree`);
        } catch (_) {}
      } else {
        // Single-pass encoding
        await runFFmpeg({
          command,
          totalDuration,
          onProgress,
          signal,
          onLog,
        });
      }

      // Handle multi-pass text overlays if needed
      let passes = 0;
      if (needTextPasses) {
        if (onProgress && typeof onProgress === "function") {
          onProgress({ phase: "batching" });
        }
        const {
          finalPath,
          tempOutputs,
          passes: textPasses,
        } = await runTextPasses({
          baseOutputPath: exportOptions.outputPath,
          textWindows,
          canvasWidth: exportOptions.outputWidth || this.options.width,
          canvasHeight: exportOptions.outputHeight || this.options.height,
          intermediateVideoCodec: exportOptions.intermediateVideoCodec,
          intermediatePreset: exportOptions.intermediatePreset,
          intermediateCrf: exportOptions.intermediateCrf,
          batchSize: exportOptions.textMaxNodesPerPass,
          onLog,
        });
        passes = textPasses;
        if (finalPath !== exportOptions.outputPath) {
          fs.renameSync(finalPath, exportOptions.outputPath);
        }
        tempOutputs.slice(0, -1).forEach((f) => {
          try {
            fs.unlinkSync(f);
          } catch (_) {}
        });
      }

      // Generate thumbnail if requested
      if (exportOptions.thumbnail && exportOptions.thumbnail.outputPath) {
        const thumbOptions = exportOptions.thumbnail;
        const thumbCommand = buildThumbnailCommand({
          inputPath: exportOptions.outputPath,
          outputPath: thumbOptions.outputPath,
          time: thumbOptions.time || 0,
          width: thumbOptions.width,
          height: thumbOptions.height,
        });

        if (exportOptions.verbose) {
          console.log("simple-ffmpeg: Generating thumbnail...");
        }

        await runFFmpeg({ command: thumbCommand, onLog });
        console.log(`simple-ffmpeg: Thumbnail -> ${thumbOptions.outputPath}`);
      }

      // Log completion
      const elapsedMs = Date.now() - t0;
      const visualCount = videoClips.length;
      const audioCount = audioClips.length;
      const musicCount = backgroundClips.length;
      let fileSizeStr = "?";
      try {
        const { size } = fs.statSync(exportOptions.outputPath);
        fileSizeStr = formatBytes(size);
      } catch (_) {}
      console.log(
        `simple-ffmpeg: Output -> ${exportOptions.outputPath} (${fileSizeStr})`
      );
      console.log(
        `simple-ffmpeg: Export finished in ${(elapsedMs / 1000).toFixed(
          2
        )}s (video:${visualCount}, audio:${audioCount}, music:${musicCount}, textPasses:${passes})`
      );

      await this._cleanup();
      this._isExporting = false;
      return exportOptions.outputPath;
    } catch (error) {
      await this._cleanup();
      this._isExporting = false;
      throw error;
    }
  }

  /**
   * Get available platform presets
   * @returns {Object} Map of preset names to their configurations
   */
  static getPresets() {
    // Deep copy to prevent mutation of original
    return JSON.parse(JSON.stringify(C.PLATFORM_PRESETS));
  }

  /**
   * Get list of available preset names
   * @returns {string[]} Array of preset names
   */
  static getPresetNames() {
    return Object.keys(C.PLATFORM_PRESETS);
  }

  /**
   * Validate clips configuration without creating a project
   * Useful for AI feedback loops and pre-validation before processing
   *
   * @param {Array} clips - Array of clip objects to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.skipFileChecks - Skip file existence checks (useful for AI)
   * @returns {Object} Validation result { valid, errors, warnings }
   *
   * @example
   * const result = SIMPLEFFMPEG.validate(clips, { skipFileChecks: true });
   * if (!result.valid) {
   *   console.log('Errors:', result.errors);
   *   // Each error has: { code, path, message, received? }
   * }
   */
  static validate(clips, options = {}) {
    // Resolve shorthand (duration, auto-sequencing) before validation
    const resolved = resolveClips(clips);
    const result = validateConfig(resolved.clips, options);

    // Merge resolution errors
    result.errors.unshift(...resolved.errors);
    result.valid = result.valid && resolved.errors.length === 0;

    return result;
  }

  /**
   * Calculate the total duration of a clips configuration.
   * Resolves shorthand (duration, auto-sequencing) before computing.
   * Returns the visual timeline duration: sum of video/image clip durations
   * minus transition overlaps.
   *
   * This is a pure function — same clips always produce the same result.
   * No file I/O is performed.
   *
   * @param {Array} clips - Array of clip objects
   * @returns {number} Total duration in seconds
   *
   * @example
   * const duration = SIMPLEFFMPEG.getDuration([
   *   { type: "video", url: "./a.mp4", duration: 5 },
   *   { type: "video", url: "./b.mp4", duration: 10, transition: { type: "fade", duration: 0.5 } },
   * ]);
   * // duration === 14.5 (15 - 0.5 transition overlap)
   */
  static getDuration(clips) {
    if (!Array.isArray(clips) || clips.length === 0) return 0;

    // Resolve shorthand (duration → end, auto-sequencing)
    const { clips: resolved } = resolveClips(clips);

    // Filter to visual clips (video + image + color)
    const visual = resolved.filter(
      (c) => c.type === "video" || c.type === "image" || c.type === "color"
    );

    if (visual.length === 0) return 0;

    const baseSum = visual.reduce(
      (acc, c) => acc + Math.max(0, (c.end || 0) - (c.position || 0)),
      0
    );

    const transitionsOverlap = visual.reduce((acc, c) => {
      const d =
        c.transition && typeof c.transition.duration === "number"
          ? c.transition.duration
          : 0;
      return acc + d;
    }, 0);

    return Math.max(0, baseSum - transitionsOverlap);
  }

  /**
   * Probe a media file and return comprehensive metadata.
   *
   * Uses ffprobe to extract duration, dimensions, codecs, format,
   * bitrate, audio details, and rotation info from any media file
   * (video, audio, or image).
   *
   * @param {string} filePath - Path to the media file
   * @returns {Promise<Object>} Media info object with:
   *   - duration (number|null) — total duration in seconds
   *   - width (number|null) — video width in pixels
   *   - height (number|null) — video height in pixels
   *   - hasVideo (boolean) — true if file contains a video stream
   *   - hasAudio (boolean) — true if file contains an audio stream
   *   - rotation (number) — iPhone/mobile rotation value (0 if none)
   *   - videoCodec (string|null) — e.g. "h264", "hevc", "vp9"
   *   - audioCodec (string|null) — e.g. "aac", "mp3"
   *   - format (string|null) — container format, e.g. "mov,mp4,m4a,3gp,3g2,mj2"
   *   - fps (number|null) — frames per second
   *   - size (number|null) — file size in bytes
   *   - bitrate (number|null) — overall bitrate in bits/sec
   *   - sampleRate (number|null) — audio sample rate, e.g. 48000
   *   - channels (number|null) — audio channels (1=mono, 2=stereo)
   * @throws {MediaNotFoundError} If the file cannot be found or probed
   *
   * @example
   * const info = await SIMPLEFFMPEG.probe("./video.mp4");
   * console.log(info.duration);   // 30.5
   * console.log(info.width);      // 1920
   * console.log(info.height);     // 1080
   * console.log(info.videoCodec); // "h264"
   * console.log(info.hasAudio);   // true
   */
  static async probe(filePath) {
    return probeMedia(filePath);
  }

  /**
   * Capture a single frame from a video file and save it as an image.
   *
   * The output format is determined by the `outputPath` file extension.
   * Supported formats include: `.jpg`/`.jpeg`, `.png`, `.webp`, `.bmp`, `.tiff`.
   *
   * @param {string} filePath - Path to the source video file
   * @param {Object} options - Snapshot options
   * @param {string} options.outputPath - Output image path (extension determines format)
   * @param {number} [options.time=0] - Time in seconds to capture the frame at
   * @param {number} [options.width] - Output width in pixels (maintains aspect ratio if height omitted)
   * @param {number} [options.height] - Output height in pixels (maintains aspect ratio if width omitted)
   * @param {number} [options.quality] - JPEG quality 1-31, lower is better (default: 2, only applies to JPEG)
   * @returns {Promise<string>} The resolved output path
   * @throws {SimpleffmpegError} If filePath or outputPath is missing
   * @throws {FFmpegError} If FFmpeg fails to extract the frame
   *
   * @example
   * // Save as PNG
   * await SIMPLEFFMPEG.snapshot("./video.mp4", {
   *   outputPath: "./frame.png",
   *   time: 5,
   * });
   *
   * @example
   * // Save as JPEG with quality and resize
   * await SIMPLEFFMPEG.snapshot("./video.mp4", {
   *   outputPath: "./thumb.jpg",
   *   time: 10,
   *   width: 640,
   *   quality: 4,
   * });
   */
  static async snapshot(filePath, options = {}) {
    if (!filePath) {
      throw new SimpleffmpegError(
        "snapshot() requires a filePath as the first argument"
      );
    }
    if (!options.outputPath) {
      throw new SimpleffmpegError(
        "snapshot() requires options.outputPath to be specified"
      );
    }

    const {
      outputPath,
      time = 0,
      width,
      height,
      quality,
    } = options;

    const command = buildSnapshotCommand({
      inputPath: filePath,
      outputPath,
      time,
      width,
      height,
      quality,
    });

    await runFFmpeg({ command });
    return outputPath;
  }

  /**
   * Format validation result as human-readable string
   * @param {Object} result - Validation result from validate()
   * @returns {string} Formatted validation result
   */
  static formatValidationResult(result) {
    return formatValidationResult(result);
  }

  /**
   * Validation error codes for programmatic handling
   */
  static get ValidationCodes() {
    return ValidationCodes;
  }

  /**
   * Base error class for all simple-ffmpeg errors
   */
  static get SimpleffmpegError() {
    return SimpleffmpegError;
  }

  /**
   * Thrown when clip validation fails
   */
  static get ValidationError() {
    return ValidationError;
  }

  /**
   * Thrown when FFmpeg command execution fails
   */
  static get FFmpegError() {
    return FFmpegError;
  }

  /**
   * Thrown when a media file cannot be found or accessed
   */
  static get MediaNotFoundError() {
    return MediaNotFoundError;
  }

  /**
   * Thrown when export is cancelled via AbortSignal
   */
  static get ExportCancelledError() {
    return ExportCancelledError;
  }

  /**
   * Get the clip schema as formatted prompt-ready text.
   * Returns a structured description of all clip types accepted by load(),
   * optimized for LLM consumption, documentation, or code generation.
   *
   * @param {Object} [options] - Schema options
   * @param {string[]} [options.include] - Only include these module IDs (e.g., ['video', 'image'])
   * @param {string[]} [options.exclude] - Exclude these module IDs (e.g., ['text', 'subtitle'])
   * @param {string|string[]} [options.instructions] - Custom top-level instructions to embed in the schema
   * @param {Object<string, string|string[]>} [options.moduleInstructions] - Per-module custom instructions
   * @returns {string} Formatted schema text
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
  static getSchema(options) {
    return getSchema(options);
  }

  /**
   * Get the list of available schema module IDs.
   * Use these IDs with getSchema({ include: [...] }) or getSchema({ exclude: [...] }).
   *
   * @returns {string[]} Array of module IDs: ['video', 'audio', 'image', 'color', 'effect', 'text', 'subtitle', 'music']
   */
  static getSchemaModules() {
    return getSchemaModules();
  }
}

module.exports = SIMPLEFFMPEG;
