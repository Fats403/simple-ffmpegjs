const fs = require("fs");
const path = require("path");
const TextRenderer = require("./ffmpeg/text_renderer");
const { unrotateVideo } = require("./core/rotation");
const Loaders = require("./loaders");
const { buildVideoFilter } = require("./ffmpeg/video_builder");
const { buildAudioForVideoClips } = require("./ffmpeg/audio_builder");
const { buildBackgroundMusicMix } = require("./ffmpeg/bgm_builder");
const { getClipAudioString } = require("./ffmpeg/strings");
const { validateClips } = require("./core/validation");
const C = require("./core/constants");
const {
  buildMainCommand,
  buildThumbnailCommand,
} = require("./ffmpeg/command_builder");
const { runTextPasses } = require("./ffmpeg/text_passes");
const { formatBytes, runFFmpeg } = require("./lib/utils");

class SIMPLEFFMPEG {
  constructor(options = {}) {
    this.options = {
      fps: options.fps || C.DEFAULT_FPS,
      width: options.width || C.DEFAULT_WIDTH,
      height: options.height || C.DEFAULT_HEIGHT,
      validationMode: options.validationMode || C.DEFAULT_VALIDATION_MODE,
      fillGaps: options.fillGaps || "none", // 'none' | 'black'
    };
    this.videoOrAudioClips = [];
    this.textClips = [];
    this.filesToClean = [];
  }

  _getInputStreams() {
    return this.videoOrAudioClips
      .map((clip) => {
        if (clip.type === "image") {
          const duration = Math.max(0, clip.end - clip.position || 0);
          return `-loop 1 -t ${duration} -i "${clip.url}"`;
        }
        return `-i "${clip.url}"`;
      })
      .join(" ");
  }

  _cleanup() {
    this.filesToClean.forEach((file) => {
      fs.unlink(file, (error) => {
        if (error) {
          console.error("Error cleaning up file:", error);
        } else {
          console.log("File cleaned up:", file);
        }
      });
    });
  }

  load(clipObjs) {
    validateClips(clipObjs, this.options.validationMode, {
      fillGaps: this.options.fillGaps,
    });
    return Promise.all(
      clipObjs.map((clipObj) => {
        if (clipObj.type === "video" || clipObj.type === "audio") {
          clipObj.volume = clipObj.volume || 1;
          clipObj.cutFrom = clipObj.cutFrom || 0;
          if (clipObj.type === "video" && clipObj.transition) {
            clipObj.transition = {
              type: clipObj.transition.type || clipObj.transition,
              duration: clipObj.transition.duration || 0.5,
            };
          }
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
        if (clipObj.type === "image") {
          return Loaders.loadImage(this, clipObj);
        }
        if (clipObj.type === "music" || clipObj.type === "backgroundAudio") {
          return Loaders.loadBackgroundAudio(this, clipObj);
        }
      })
    );
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

    const videoClips = this.videoOrAudioClips.filter(
      (clip) => clip.type === "video" || clip.type === "image"
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

    const totalVideoDuration = (() => {
      if (videoClips.length === 0) return 0;
      const baseSum = videoClips.reduce(
        (acc, c) => acc + Math.max(0, (c.end || 0) - (c.position || 0)),
        0
      );
      const transitionsOverlap = videoClips.reduce((acc, c, idx) => {
        if (idx === 0) return acc;
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
    const finalVisualEnd =
      videoClips.length > 0
        ? Math.max(...videoClips.map((c) => c.end))
        : Math.max(textEnd, bgOrAudioEnd);

    // Build video filter
    if (videoClips.length > 0) {
      const vres = buildVideoFilter(this, videoClips);
      filterComplex += vres.filter;
      finalVideoLabel = vres.finalVideoLabel;
      hasVideo = vres.hasVideo;
    }

    // Audio for video clips (aligned amix)
    if (videoClips.length > 0) {
      const ares = buildAudioForVideoClips(this, videoClips);
      filterComplex += ares.filter;
      finalAudioLabel = ares.finalAudioLabel || finalAudioLabel;
      hasAudio = hasAudio || ares.hasAudio;
    }

    // Standalone audio clips
    if (audioClips.length > 0) {
      let audioString = "";
      let audioConcatInputs = [];
      audioClips.forEach((clip) => {
        const inputIndex = this.videoOrAudioClips.indexOf(clip);
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

    // Text overlays
    let needTextPasses = false;
    let textWindows = [];
    if (this.textClips.length > 0 && hasVideo) {
      textWindows = TextRenderer.expandTextWindows(this.textClips);
      const projectDuration = totalVideoDuration;
      textWindows = textWindows
        .filter((w) => typeof w.start === "number" && w.start < projectDuration)
        .map((w) => ({ ...w, end: Math.min(w.end, projectDuration) }));
      needTextPasses = textWindows.length > exportOptions.textMaxNodesPerPass;
      if (!needTextPasses) {
        const { filterString, finalVideoLabel: outLabel } =
          TextRenderer.buildTextFilters(
            this.textClips,
            this.options.width,
            this.options.height,
            finalVideoLabel
          );
        filterComplex += filterString;
        finalVideoLabel = outLabel;
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
      inputs: this._getInputStreams(),
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
    const t0 = Date.now();
    const { onProgress, signal } = options;

    const prepared = await this._prepareExport(options);
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
      fs.writeFileSync(exportOptions.saveCommand, command, "utf8");
      console.log(
        `simple-ffmpeg: Command saved to ${exportOptions.saveCommand}`
      );
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
        });
      }

      // Handle multi-pass text overlays if needed
      let passes = 0;
      if (needTextPasses) {
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

        await runFFmpeg({ command: thumbCommand });
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

      this._cleanup();
      return exportOptions.outputPath;
    } catch (error) {
      this._cleanup();
      throw error;
    }
  }
}

module.exports = SIMPLEFFMPEG;
