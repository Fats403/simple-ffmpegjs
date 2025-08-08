const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID } = require("crypto");
const { exec } = require("child_process");
const Helpers = require("./_helpers");
const TextRenderer = require("./text_renderer");
const { validateClips } = require("./validation");
const tempDir = os.tmpdir();

class SIMPLEFFMPEG {
  constructor(options) {
    this.options = {
      fps: options.fps || 30,
      width: options.width || 1920,
      height: options.height || 1080,
      validationMode: options.validationMode || "warn", // 'warn' | 'strict'
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

  _getTranspose(rotation) {
    if (rotation === 90) {
      return "1";
    }
    if (rotation === -90) {
      return "2";
    }
    if (rotation === 180) {
      return "3";
    }
    return "0";
  }

  _getVideoMetadata(url) {
    return new Promise((resolve, reject) => {
      // Get all stream info in one command
      const cmd = `ffprobe -v error -show_streams -show_format -of json "${url}"`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error("Error getting video metadata:", error);
          resolve({
            rotation: 0,
            hasAudio: false,
            width: null,
            height: null,
            durationSec: null,
          });
          return;
        }

        try {
          const metadata = JSON.parse(stdout);

          const videoStream = metadata.streams.find(
            (stream) => stream.codec_type === "video"
          );
          const hasAudio = metadata.streams.some(
            (stream) => stream.codec_type === "audio"
          );
          // Extract rotation value if it exists
          const iphoneRotation = videoStream?.side_data_list?.[0]?.rotation
            ? videoStream.side_data_list[0].rotation
            : 0;
          // Duration from format (most reliable)
          const formatDuration = metadata.format?.duration
            ? parseFloat(metadata.format.duration)
            : null;
          const streamDuration = videoStream?.duration
            ? parseFloat(videoStream.duration)
            : null;
          const durationSec = Number.isFinite(formatDuration)
            ? formatDuration
            : Number.isFinite(streamDuration)
            ? streamDuration
            : null;

          resolve({
            iphoneRotation,
            hasAudio,
            width: videoStream?.width,
            height: videoStream?.height,
            durationSec,
          });
        } catch (parseError) {
          console.error("Error parsing metadata:", parseError);
          resolve({
            iphoneRotation: 0,
            hasAudio: false,
            width: null,
            height: null,
            durationSec: null,
          });
        }
      });
    });
  }

  _unrotateVideo(clipObj) {
    return new Promise((resolve, reject) => {
      const unrotatedUrl = path.join(tempDir, `unrotated-${randomUUID()}.mp4`);

      let ffmpegCommand = `ffmpeg -y -i "${clipObj.url}" "${unrotatedUrl}"`;

      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          console.error("Error unrotating video:", error);
          reject(error);
        }
        resolve(unrotatedUrl);
      });
    });
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

  async _loadVideo(clipObj) {
    const metadata = await this._getVideoMetadata(clipObj.url);

    // Validate cutFrom vs duration
    if (typeof clipObj.cutFrom === "number" && metadata.durationSec != null) {
      if (clipObj.cutFrom >= metadata.durationSec) {
        throw new Error(
          `Video clip cutFrom (${clipObj.cutFrom}s) must be < source duration (${metadata.durationSec}s)`
        );
      }
    }

    // Clamp requested duration if it overruns source
    if (
      typeof clipObj.position === "number" &&
      typeof clipObj.end === "number" &&
      typeof clipObj.cutFrom === "number" &&
      metadata.durationSec != null
    ) {
      const requestedDuration = Math.max(0, clipObj.end - clipObj.position);
      const maxAvailable = Math.max(0, metadata.durationSec - clipObj.cutFrom);
      if (requestedDuration > maxAvailable) {
        const clampedEnd = clipObj.position + maxAvailable;
        console.warn(
          `Video clip overruns source by ${(
            requestedDuration - maxAvailable
          ).toFixed(3)}s. Clamping end from ${clipObj.end}s to ${clampedEnd}s.`
        );
        clipObj.end = clampedEnd;
      }
    }

    this.videoOrAudioClips.push({
      ...clipObj,
      iphoneRotation: metadata.iphoneRotation,
      hasAudio: metadata.hasAudio,
      mediaDuration: metadata.durationSec,
    });
  }

  async _loadAudio(clipObj) {
    const durationSec = await this._getMediaDuration(clipObj.url);

    if (typeof clipObj.cutFrom === "number" && durationSec != null) {
      if (clipObj.cutFrom >= durationSec) {
        throw new Error(
          `Audio clip cutFrom (${clipObj.cutFrom}s) must be < source duration (${durationSec}s)`
        );
      }
    }

    if (
      typeof clipObj.position === "number" &&
      typeof clipObj.end === "number" &&
      typeof clipObj.cutFrom === "number" &&
      durationSec != null
    ) {
      const requestedDuration = Math.max(0, clipObj.end - clipObj.position);
      const maxAvailable = Math.max(0, durationSec - clipObj.cutFrom);
      if (requestedDuration > maxAvailable) {
        const clampedEnd = clipObj.position + maxAvailable;
        console.warn(
          `Audio clip overruns source by ${(
            requestedDuration - maxAvailable
          ).toFixed(3)}s. Clamping end from ${clipObj.end}s to ${clampedEnd}s.`
        );
        clipObj.end = clampedEnd;
      }
    }

    this.videoOrAudioClips.push({ ...clipObj, mediaDuration: durationSec });
  }

  _loadText(clipObj) {
    const clip = {
      ...clipObj,
      fontFile: clipObj.fontFile || null,
      fontFamily: clipObj.fontFamily || "Sans",
      fontSize: clipObj.fontSize || 48,
      fontColor: clipObj.fontColor || "#FFFFFF",
    };

    if (typeof clipObj.centerX === "number") {
      clip.centerX = clipObj.centerX;
    } else if (typeof clipObj.x === "number") {
      clip.x = clipObj.x;
    } else {
      clip.centerX = 0;
    }

    if (typeof clipObj.centerY === "number") {
      clip.centerY = clipObj.centerY;
    } else if (typeof clipObj.y === "number") {
      clip.y = clipObj.y;
    } else {
      clip.centerY = 0;
    }

    this.textClips.push(clip);
  }

  _loadImage(clipObj) {
    // Images treated as video streams with no audio
    const clip = {
      ...clipObj,
      hasAudio: false,
      cutFrom: 0,
    };
    this.videoOrAudioClips.push(clip);
  }

  // Loader for background music clips
  async _loadBackgroundAudio(clipObj) {
    const durationSec = await this._getMediaDuration(clipObj.url);
    const clip = {
      ...clipObj,
      // Safe defaults for background music
      volume: typeof clipObj.volume === "number" ? clipObj.volume : 0.2,
      cutFrom: typeof clipObj.cutFrom === "number" ? clipObj.cutFrom : 0,
      position: typeof clipObj.position === "number" ? clipObj.position : 0,
    };

    if (typeof clip.cutFrom === "number" && durationSec != null) {
      if (clip.cutFrom >= durationSec) {
        throw new Error(
          `Background audio cutFrom (${clip.cutFrom}s) must be < source duration (${durationSec}s)`
        );
      }
    }

    if (
      typeof clip.position === "number" &&
      typeof clip.end === "number" &&
      typeof clip.cutFrom === "number" &&
      durationSec != null
    ) {
      const requestedDuration = Math.max(0, clip.end - clip.position);
      const maxAvailable = Math.max(0, durationSec - clip.cutFrom);
      if (requestedDuration > maxAvailable) {
        const clampedEnd = clip.position + maxAvailable;
        console.warn(
          `Background audio overruns source by ${(
            requestedDuration - maxAvailable
          ).toFixed(3)}s. Clamping end from ${clip.end}s to ${clampedEnd}s.`
        );
        clip.end = clampedEnd;
      }
    }

    // Keep inputs consolidated so indices are consistent across the graph
    this.videoOrAudioClips.push({ ...clip, mediaDuration: durationSec });
  }

  // Lightweight media duration fetcher for non-video clips
  _getMediaDuration(url) {
    return new Promise((resolve) => {
      const cmd = `ffprobe -v error -show_format -of json "${url}"`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error("Error getting media duration:", error);
          resolve(null);
          return;
        }
        try {
          const metadata = JSON.parse(stdout);
          const formatDuration = metadata.format?.duration
            ? parseFloat(metadata.format.duration)
            : null;
          resolve(Number.isFinite(formatDuration) ? formatDuration : null);
        } catch (e) {
          console.error("Error parsing media duration:", e);
          resolve(null);
        }
      });
    });
  }

  load(clipObjs) {
    // Pre-validate clips (basic checks)
    validateClips(clipObjs, this.options.validationMode);

    return Promise.all(
      clipObjs.map((clipObj) => {
        if (clipObj.type === "video" || clipObj.type === "audio") {
          clipObj.volume = clipObj.volume || 1;
          clipObj.cutFrom = clipObj.cutFrom || 0;
          // Add transition support for video clips
          if (clipObj.type === "video" && clipObj.transition) {
            clipObj.transition = {
              type: clipObj.transition.type || clipObj.transition,
              duration: clipObj.transition.duration || 0.5,
            };
          }
        }

        if (clipObj.type === "video") {
          return this._loadVideo(clipObj);
        }
        if (clipObj.type === "audio") {
          return this._loadAudio(clipObj);
        }
        if (clipObj.type === "text") {
          return this._loadText(clipObj);
        }
        if (clipObj.type === "image") {
          return this._loadImage(clipObj);
        }
        // Background music support (aliases: music, backgroundAudio)
        if (clipObj.type === "music" || clipObj.type === "backgroundAudio") {
          return this._loadBackgroundAudio(clipObj);
        }
      })
    );
  }

  _buildTransitionFilters(videoClips) {
    let filterComplex = "";
    let audioString = "";
    let videoIndex = 0;

    // First pass: create scaled video streams with fps filter
    const scaledStreams = [];
    videoClips.forEach((clip, index) => {
      const inputIndex = this.videoOrAudioClips.indexOf(clip);
      const scaledLabel = `[scaled${videoIndex}]`;

      // Add fps filter to ensure constant frame rate and fix the duration calculation
      const requestedDuration = clip.end - clip.position;
      const maxAvailable =
        typeof clip.mediaDuration === "number" &&
        typeof clip.cutFrom === "number"
          ? Math.max(0, clip.mediaDuration - clip.cutFrom)
          : requestedDuration;
      const clipDuration = Math.max(
        0,
        Math.min(requestedDuration, maxAvailable)
      );
      if (clip.type === "image" && clip.kenBurns) {
        const frames = Math.max(1, Math.round(clipDuration * this.options.fps));
        const s = `${this.options.width}x${this.options.height}`;
        const strength =
          typeof clip.kenBurns.strength === "number"
            ? clip.kenBurns.strength
            : 0.1;
        // targetZoom = 1 + strength
        const zStep = strength / frames;
        let zoomExpr = `1`;
        let xExpr = `(iw-ow)/2`;
        let yExpr = `(ih-oh)/2`;
        const panBaseZoom = strength && strength > 0 ? strength : 0.1; // ensure crop area exists for pans
        switch (clip.kenBurns.type) {
          case "zoom-in":
            zoomExpr = `1+${zStep}*on`;
            break;
          case "zoom-out":
            zoomExpr = `1+${strength} - ${zStep}*on`;
            break;
          case "pan-left":
            zoomExpr = `1+${panBaseZoom}`;
            xExpr = `(iw-ow) - (iw-ow)*on/${frames}`;
            break;
          case "pan-right":
            zoomExpr = `1+${panBaseZoom}`;
            xExpr = `(iw-ow)*on/${frames}`;
            break;
          case "pan-up":
            zoomExpr = `1+${panBaseZoom}`;
            yExpr = `(ih-oh) - (ih-oh)*on/${frames}`;
            break;
          case "pan-down":
            zoomExpr = `1+${panBaseZoom}`;
            yExpr = `(ih-oh)*on/${frames}`;
            break;
        }
        // Feed a single input frame to zoompan so d=frames yields the correct total duration
        filterComplex += `[${inputIndex}:v]select=eq(n\\,0),setpts=PTS-STARTPTS,zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${s},fps=${this.options.fps}${scaledLabel};`;
      } else {
        filterComplex += `[${inputIndex}:v]trim=start=${
          clip.cutFrom || 0
        }:duration=${clipDuration},setpts=PTS-STARTPTS,fps=${
          this.options.fps
        },scale=${this.options.width}:${
          this.options.height
        }:force_original_aspect_ratio=decrease,pad=${this.options.width}:${
          this.options.height
        }:(ow-iw)/2:(oh-ih)/2${scaledLabel};`;
      }

      scaledStreams.push({
        label: scaledLabel,
        clip: clip,
        index: videoIndex,
        duration: clipDuration,
      });
      videoIndex++;
    });

    // Check if we have transitions to apply
    const hasTransitions = scaledStreams.some(
      (stream, index) => index > 0 && stream.clip.transition
    );

    if (!hasTransitions) {
      // No transitions - use simple concatenation for video
      const videoLabels = scaledStreams.map((s) => s.label);
      filterComplex +=
        videoLabels.join("") + `concat=n=${videoLabels.length}:v=1:a=0[outv];`;

      // Handle audio: align by absolute timeline using adelay, then amix
      let audioLabels = [];
      const overlapBefore = new Array(scaledStreams.length).fill(0);
      scaledStreams.forEach((stream, i) => {
        if (stream.clip.hasAudio) {
          const inputIndex = this.videoOrAudioClips.indexOf(stream.clip);
          const clipDuration = stream.duration;
          const adelayMs = Math.round(
            Math.max(0, stream.clip.position || 0) * 1000
          );
          audioString += `[${inputIndex}:a]atrim=start=${stream.clip.cutFrom}:duration=${clipDuration},asetpts=PTS-STARTPTS,adelay=${adelayMs}|${adelayMs}[a${stream.index}];`;
          audioLabels.push(`[a${stream.index}]`);
        }
      });

      if (audioLabels.length > 0) {
        audioString +=
          audioLabels.join("") +
          `amix=inputs=${audioLabels.length}:duration=longest[outa];`;
      }

      return {
        filterComplex: filterComplex + audioString,
        finalVideoLabel: "[outv]",
        finalAudioLabel: audioLabels.length > 0 ? "[outa]" : null,
        hasVideo: true,
        hasAudio: audioLabels.length > 0,
      };
    }

    // Apply transitions for video; build audio as delayed amix to align timeline
    let currentVideo = scaledStreams[0].label;

    // Prepare audio segments aligned by absolute position; then amix
    const alignedAudioLabels = [];
    // Compute cumulative overlap before each clip based on transitions attached to current clips
    const overlapBefore = new Array(scaledStreams.length).fill(0);
    let cumOverlap = 0;
    for (let i = 0; i < scaledStreams.length; i++) {
      overlapBefore[i] = cumOverlap;
      if (i + 1 < scaledStreams.length) {
        const nextTrans = scaledStreams[i + 1].clip.transition;
        if (nextTrans && typeof nextTrans.duration === "number") {
          cumOverlap += nextTrans.duration;
        }
      }
    }
    scaledStreams.forEach((stream, i) => {
      if (stream.clip.hasAudio) {
        const inputIndex = this.videoOrAudioClips.indexOf(stream.clip);
        const clipDuration = stream.duration;
        const adelayMs = Math.round(
          Math.max(0, stream.clip.position || 0) * 1000
        );
        audioString += `[${inputIndex}:a]atrim=start=${stream.clip.cutFrom}:duration=${clipDuration},asetpts=PTS-STARTPTS,adelay=${adelayMs}|${adelayMs}[aa${stream.index}];`;
        alignedAudioLabels.push(`[aa${stream.index}]`);
      }
    });

    for (let i = 1; i < scaledStreams.length; i++) {
      const currentClip = scaledStreams[i].clip;
      const nextVideoLabel = scaledStreams[i].label;

      const transitionedVideoLabel = `[vtrans${i}]`;
      const transitionedAudioLabel = `[atrans${i}]`;

      if (currentClip.transition) {
        const transitionType = currentClip.transition.type;
        const duration = currentClip.transition.duration;

        // For xfade, offset is relative to the duration of the first input
        const prevDuration = scaledStreams[i - 1].duration;
        const offset = prevDuration - duration;

        // Video transition
        filterComplex += `${currentVideo}${nextVideoLabel}xfade=transition=${transitionType}:duration=${duration}:offset=${offset}${transitionedVideoLabel};`;

        // Audio transition (handled by absolute-time amix instead)
        if (currentClip.hasAudio) {
          const inputIndex = this.videoOrAudioClips.indexOf(currentClip);
          const clipDuration = scaledStreams[i].duration;
          audioString += `[${inputIndex}:a]atrim=start=${currentClip.cutFrom}:duration=${clipDuration},asetpts=PTS-STARTPTS[a${i}];`;

          if (currentAudio) {
            audioString += `${currentAudio}[a${i}]acrossfade=d=${duration}${transitionedAudioLabel};`;
            currentAudio = transitionedAudioLabel;
          } else {
            currentAudio = `[a${i}]`;
          }
        }

        currentVideo = transitionedVideoLabel;
      } else {
        // No transition at this boundary: concatenate video
        const concatenatedVideoLabel = `[vcat${i}]`;
        filterComplex += `${currentVideo}${nextVideoLabel}concat=n=2:v=1:a=0${concatenatedVideoLabel};`;
        currentVideo = concatenatedVideoLabel;
        // Audio handled via aligned amix
      }
    }

    if (alignedAudioLabels.length > 0) {
      audioString +=
        alignedAudioLabels.join("") +
        `amix=inputs=${alignedAudioLabels.length}:duration=longest[outa];`;
    }

    return {
      filterComplex: filterComplex + audioString,
      finalVideoLabel: currentVideo,
      finalAudioLabel: alignedAudioLabels.length > 0 ? "[outa]" : null,
      hasVideo: true,
      hasAudio: alignedAudioLabels.length > 0,
    };
  }

  export(options) {
    const exportOptions = {
      outputPath: options.outputPath || "./output.mp4",
      textMaxNodesPerPass:
        typeof options.textMaxNodesPerPass === "number"
          ? options.textMaxNodesPerPass
          : 75,
      intermediateVideoCodec: options.intermediateVideoCodec || "libx264",
      intermediateCrf:
        typeof options.intermediateCrf === "number"
          ? options.intermediateCrf
          : 18,
      intermediatePreset: options.intermediatePreset || "veryfast",
    };

    return new Promise(async (resolve, reject) => {
      // Sort by position
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
            const unrotatedUrl = await this._unrotateVideo(clip);
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

      // Compute total video timeline duration (sum of durations minus transition overlaps)
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
      const finalVisualEnd =
        videoClips.length > 0 ? Math.max(...videoClips.map((c) => c.end)) : 0;

      // Handle video clips with transitions
      if (videoClips.length > 0) {
        const result = this._buildTransitionFilters(videoClips);
        filterComplex += result.filterComplex;
        finalVideoLabel = result.finalVideoLabel;
        finalAudioLabel = result.finalAudioLabel;
        hasVideo = result.hasVideo;
        hasAudio = result.hasAudio;
      }

      // Handle standalone audio clips
      if (audioClips.length > 0) {
        let audioString = "";
        let audioConcatInputs = [];

        audioClips.forEach((clip, index) => {
          const inputIndex = this.videoOrAudioClips.indexOf(clip);
          const { audioStringPart, audioConcatInput } =
            Helpers.getClipAudioString(clip, inputIndex);
          audioString += audioStringPart;
          audioConcatInputs.push(audioConcatInput);
        });

        if (audioConcatInputs.length > 0) {
          filterComplex += audioString;
          filterComplex += audioConcatInputs.join("");

          if (hasAudio) {
            // Mix with existing audio
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

      // Handle background music clips (mix AFTER other audio so fades don't affect BGM)
      if (backgroundClips.length > 0) {
        // Prefer full visual timeline end (max end across video/image clips)
        const projectDuration =
          videoClips.length > 0
            ? Math.max(...videoClips.map((c) => c.end))
            : Math.max(
                0,
                ...backgroundClips.map((c) =>
                  typeof c.end === "number" ? c.end : 0
                )
              );

        let bgString = "";
        const bgLabels = [];

        backgroundClips.forEach((clip, i) => {
          const inputIndex = this.videoOrAudioClips.indexOf(clip);
          const effectivePosition =
            typeof clip.position === "number" ? clip.position : 0;
          const effectiveEnd =
            typeof clip.end === "number" ? clip.end : projectDuration;
          const effectiveCutFrom =
            typeof clip.cutFrom === "number" ? clip.cutFrom : 0;
          const effectiveVolume =
            typeof clip.volume === "number" ? clip.volume : 0.2;

          const adelay = effectivePosition * 1000;
          const trimEnd = effectiveCutFrom + (effectiveEnd - effectivePosition);
          const outLabel = `[bg${i}]`;

          bgString += `[${inputIndex}:a]volume=${effectiveVolume},atrim=start=${effectiveCutFrom}:end=${trimEnd},adelay=${adelay}|${adelay},asetpts=PTS-STARTPTS${outLabel};`;
          bgLabels.push(outLabel);
        });

        if (bgLabels.length > 0) {
          filterComplex += bgString;
          if (hasAudio) {
            // Mix background with whatever audio we already have
            filterComplex += `${finalAudioLabel}${bgLabels.join(
              ""
            )}amix=inputs=${bgLabels.length + 1}:duration=longest[finalaudio];`;
            finalAudioLabel = "[finalaudio]";
          } else {
            filterComplex += `${bgLabels.join("")}amix=inputs=${
              bgLabels.length
            }:duration=longest[finalaudio];`;
            finalAudioLabel = "[finalaudio]";
            hasAudio = true;
          }
        }
      }

      // Pad final audio to prevent early cutoff; container will align to video length
      if (hasAudio && finalAudioLabel) {
        const trimEnd =
          finalVisualEnd > 0 ? finalVisualEnd : totalVideoDuration;
        filterComplex += `${finalAudioLabel}apad,atrim=end=${trimEnd}[audfit];`;
        finalAudioLabel = "[audfit]";
      }

      // Handle text overlays
      let needTextPasses = false;
      let textWindows = [];
      if (this.textClips.length > 0 && hasVideo) {
        // Expand to windows for possible batching
        textWindows = TextRenderer.expandTextWindows(this.textClips);
        // Clamp windows to project duration to avoid out-of-range filters
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

      // Build the complete command
      let ffmpegCmd = `ffmpeg -y ${this._getInputStreams()} -filter_complex "${filterComplex}" `;

      // Add mapping based on what streams we have
      if (hasVideo) {
        ffmpegCmd += `-map "${finalVideoLabel}" `;
      }

      if (hasAudio) {
        ffmpegCmd += `-map "${finalAudioLabel}" `;
      }

      // Add encoding settings
      if (hasVideo) {
        ffmpegCmd += `-c:v libx264 -preset medium -crf 23 `;
      }

      if (hasAudio) {
        ffmpegCmd += `-c:a aac -b:a 192k `;
      }
      if (hasVideo && hasAudio) {
        ffmpegCmd += `-shortest `;
      }

      ffmpegCmd += `-movflags +faststart "${exportOptions.outputPath}"`;

      console.log("simple-ffmpeg: Export started");

      // Execute ffmpeg
      exec(ffmpegCmd, async (error, stdout, stderr) => {
        if (error) {
          console.error("FFmpeg stderr:", stderr);
          reject(error);
          this._cleanup();
          return;
        }
        // If no text or text within threshold, we are done
        if (!needTextPasses) {
          resolve(exportOptions.outputPath);
          console.log("simple-ffmpeg: Export finished");
          this._cleanup();
          return;
        }

        // Multi-pass text overlay batching
        try {
          const tempOutputs = [];
          let currentInput = exportOptions.outputPath;

          for (
            let i = 0;
            i < textWindows.length;
            i += exportOptions.textMaxNodesPerPass
          ) {
            const batch = textWindows.slice(
              i,
              i + exportOptions.textMaxNodesPerPass
            );
            const { filterString } = TextRenderer.buildFiltersForWindows(
              batch,
              this.options.width,
              this.options.height,
              "[invid]"
            );

            // Build per-pass command
            const batchOutput = path.join(
              path.dirname(exportOptions.outputPath),
              `textpass_${i}_${path.basename(exportOptions.outputPath)}`
            );
            tempOutputs.push(batchOutput);

            // Map input video to label [invid] using null
            const batchCmd = `ffmpeg -y -i "${currentInput}" -filter_complex "[0:v]null[invid];${filterString}" -map "[outVideoAndText]" -map 0:a? -c:v ${exportOptions.intermediateVideoCodec} -preset ${exportOptions.intermediatePreset} -crf ${exportOptions.intermediateCrf} -c:a copy -movflags +faststart "${batchOutput}"`;

            await new Promise((res, rej) => {
              exec(batchCmd, (err, so, se) => {
                if (err) {
                  console.error("FFmpeg text batch stderr:", se);
                  rej(err);
                  return;
                }
                res(null);
              });
            });

            currentInput = batchOutput;
          }

          // Rename last temp to final output
          if (currentInput !== exportOptions.outputPath) {
            fs.renameSync(currentInput, exportOptions.outputPath);
          }

          // Cleanup temp outputs (other than the last one which we moved)
          tempOutputs.slice(0, -1).forEach((f) => {
            try {
              fs.unlinkSync(f);
            } catch (_) {}
          });

          resolve(exportOptions.outputPath);
          console.log(
            "simple-ffmpeg: Export finished (text in multiple passes)"
          );
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
