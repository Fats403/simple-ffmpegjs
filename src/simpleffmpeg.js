const fs = require("fs");
const { exec } = require("child_process");
const TextRenderer = require("./ffmpeg/text_renderer");
const { unrotateVideo } = require("./core/rotation");
const Loaders = require("./loaders");
const { buildVideoFilter } = require("./ffmpeg/video_builder");
const { buildAudioForVideoClips } = require("./ffmpeg/audio_builder");
const { buildBackgroundMusicMix } = require("./ffmpeg/bgm_builder");
const { getClipAudioString } = require("./ffmpeg/strings");
const { validateClips } = require("./core/validation");
const C = require("./core/constants");
const { buildMainCommand } = require("./ffmpeg/command_builder");
const { runTextPasses } = require("./ffmpeg/text_passes");
const { formatBytes } = require("./lib/utils");

class SIMPLEFFMPEG {
  constructor(options) {
    this.options = {
      fps: options.fps || C.DEFAULT_FPS,
      width: options.width || C.DEFAULT_WIDTH,
      height: options.height || C.DEFAULT_HEIGHT,
      validationMode: options.validationMode || C.DEFAULT_VALIDATION_MODE,
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
    validateClips(clipObjs, this.options.validationMode);
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

  export(options) {
    const exportOptions = {
      outputPath: options.outputPath || "./output.mp4",
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

    return new Promise(async (resolve, reject) => {
      const t0 = Date.now();
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
        const trimEnd =
          finalVisualEnd > 0 ? finalVisualEnd : totalVideoDuration;
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
          .filter(
            (w) => typeof w.start === "number" && w.start < projectDuration
          )
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

      // Command
      const ffmpegCmd = buildMainCommand({
        inputs: this._getInputStreams(),
        filterComplex,
        mapVideo: finalVideoLabel,
        mapAudio: finalAudioLabel,
        hasVideo,
        hasAudio,
        videoCodec: C.VIDEO_CODEC,
        videoPreset: C.VIDEO_PRESET,
        videoCrf: C.VIDEO_CRF,
        audioCodec: C.AUDIO_CODEC,
        audioBitrate: C.AUDIO_BITRATE,
        shortest: true,
        faststart: true,
        outputPath: exportOptions.outputPath,
      });

      console.log("simple-ffmpeg: Starting export...");
      exec(ffmpegCmd, async (error, stdout, stderr) => {
        if (error) {
          console.error("FFmpeg stderr:", stderr);
          reject(error);
          this._cleanup();
          return;
        }
        if (!needTextPasses) {
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
            )}s (video:${visualCount}, audio:${audioCount}, music:${musicCount}, textPasses:0)`
          );
          resolve(exportOptions.outputPath);
          this._cleanup();
          return;
        }
        try {
          // Multi-pass text overlay batching via helper
          const { finalPath, tempOutputs, passes } = await runTextPasses({
            baseOutputPath: exportOptions.outputPath,
            textWindows,
            canvasWidth: this.options.width,
            canvasHeight: this.options.height,
            intermediateVideoCodec: exportOptions.intermediateVideoCodec,
            intermediatePreset: exportOptions.intermediatePreset,
            intermediateCrf: exportOptions.intermediateCrf,
            batchSize: exportOptions.textMaxNodesPerPass,
          });
          if (finalPath !== exportOptions.outputPath) {
            fs.renameSync(finalPath, exportOptions.outputPath);
          }
          tempOutputs.slice(0, -1).forEach((f) => {
            try {
              fs.unlinkSync(f);
            } catch (_) {}
          });
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
          resolve(exportOptions.outputPath);
          this._cleanup();
        } catch (batchErr) {
          reject(batchErr);
          this._cleanup();
        }
      });
    });
  }
}

module.exports = SIMPLEFFMPEG;
