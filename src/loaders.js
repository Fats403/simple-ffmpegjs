const fs = require("fs");
const os = require("os");
const path = require("path");
const { probeMedia } = require("./core/media_info");
const { ValidationError, MediaNotFoundError } = require("./core/errors");
const C = require("./core/constants");
const { generateGradientPPM } = require("./lib/gradient");

async function loadVideo(project, clipObj) {
  const metadata = await probeMedia(clipObj.url);
  if (typeof clipObj.cutFrom === "number" && metadata.duration != null) {
    if (clipObj.cutFrom >= metadata.duration) {
      throw new ValidationError(
        `Video clip cutFrom (${clipObj.cutFrom}s) must be < source duration (${metadata.duration}s)`,
        {
          errors: [
            {
              code: "INVALID_RANGE",
              path: "cutFrom",
              message: `cutFrom exceeds source duration`,
            },
          ],
        }
      );
    }
  }
  if (
    typeof clipObj.position === "number" &&
    typeof clipObj.end === "number" &&
    typeof clipObj.cutFrom === "number" &&
    metadata.duration != null
  ) {
    const requestedDuration = Math.max(0, clipObj.end - clipObj.position);
    const maxAvailable = Math.max(0, metadata.duration - clipObj.cutFrom);
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
  project.videoOrAudioClips.push({
    ...clipObj,
    iphoneRotation: metadata.rotation,
    hasAudio: metadata.hasAudio,
    mediaDuration: metadata.duration,
  });
}

async function loadAudio(project, clipObj) {
  const metadata = await probeMedia(clipObj.url);
  const durationSec = metadata.duration;
  if (typeof clipObj.cutFrom === "number" && durationSec != null) {
    if (clipObj.cutFrom >= durationSec) {
      throw new ValidationError(
        `Audio clip cutFrom (${clipObj.cutFrom}s) must be < source duration (${durationSec}s)`,
        {
          errors: [
            {
              code: "INVALID_RANGE",
              path: "cutFrom",
              message: `cutFrom exceeds source duration`,
            },
          ],
        }
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
  project.videoOrAudioClips.push({ ...clipObj, mediaDuration: durationSec });
}

async function loadImage(project, clipObj) {
  const metadata = await probeMedia(clipObj.url);
  const clip = {
    ...clipObj,
    hasAudio: false,
    cutFrom: 0,
    width: clipObj.width ?? metadata.width,
    height: clipObj.height ?? metadata.height,
  };
  project.videoOrAudioClips.push(clip);
}

async function loadBackgroundAudio(project, clipObj) {
  const metadata = await probeMedia(clipObj.url);
  const durationSec = metadata.duration;
  const clip = {
    ...clipObj,
    volume:
      typeof clipObj.volume === "number"
        ? clipObj.volume
        : C.DEFAULT_BGM_VOLUME,
    cutFrom: typeof clipObj.cutFrom === "number" ? clipObj.cutFrom : 0,
    position: typeof clipObj.position === "number" ? clipObj.position : 0,
  };
  if (typeof clip.cutFrom === "number" && durationSec != null) {
    if (clip.cutFrom >= durationSec) {
      throw new ValidationError(
        `Background audio cutFrom (${clip.cutFrom}s) must be < source duration (${durationSec}s)`,
        {
          errors: [
            {
              code: "INVALID_RANGE",
              path: "cutFrom",
              message: `cutFrom exceeds source duration`,
            },
          ],
        }
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
  project.videoOrAudioClips.push({ ...clip, mediaDuration: durationSec });
}

function loadText(project, clipObj) {
  const clip = {
    ...clipObj,
    fontFile: clipObj.fontFile || project.options.fontFile || null,
    fontFamily: clipObj.fontFamily || C.DEFAULT_FONT_FAMILY,
    fontSize: clipObj.fontSize || C.DEFAULT_FONT_SIZE,
    fontColor: clipObj.fontColor || C.DEFAULT_FONT_COLOR,
  };
  if (typeof clipObj.xPercent === "number") clip.xPercent = clipObj.xPercent;
  else if (typeof clipObj.x === "number") clip.x = clipObj.x;
  else clip.xPercent = 0.5; // Default to centered
  if (typeof clipObj.yPercent === "number") clip.yPercent = clipObj.yPercent;
  else if (typeof clipObj.y === "number") clip.y = clipObj.y;
  else clip.yPercent = 0.5; // Default to centered

  // Karaoke mode uses ASS subtitles, so store separately
  if (clip.mode === "karaoke") {
    clip.highlightColor = clip.highlightColor || C.DEFAULT_KARAOKE_HIGHLIGHT;
    project.subtitleClips.push(clip);
  } else {
    project.textClips.push(clip);
  }
}

function loadEffect(project, clipObj) {
  const clip = {
    ...clipObj,
    fadeIn: typeof clipObj.fadeIn === "number" ? clipObj.fadeIn : 0,
    fadeOut: typeof clipObj.fadeOut === "number" ? clipObj.fadeOut : 0,
    params: clipObj.params || {},
  };
  project.effectClips.push(clip);
}

function loadSubtitle(project, clipObj) {
  // Validate file exists
  if (!fs.existsSync(clipObj.url)) {
    throw new MediaNotFoundError(`Subtitle file not found: ${clipObj.url}`, {
      path: clipObj.url,
    });
  }

  // Validate format
  const ext = path.extname(clipObj.url).toLowerCase();
  if (![".srt", ".ass", ".ssa", ".vtt"].includes(ext)) {
    throw new ValidationError(
      `Unsupported subtitle format '${ext}'. Supported: .srt, .ass, .ssa, .vtt`,
      {
        errors: [
          {
            code: "INVALID_FORMAT",
            path: "url",
            message: `Unsupported subtitle format '${ext}'`,
          },
        ],
      }
    );
  }

  const clip = {
    ...clipObj,
    fontFamily: clipObj.fontFamily || C.DEFAULT_FONT_FAMILY,
    fontSize: clipObj.fontSize || C.DEFAULT_FONT_SIZE,
    fontColor: clipObj.fontColor || C.DEFAULT_FONT_COLOR,
    position: clipObj.position || 0,
  };

  project.subtitleClips.push(clip);
}

async function loadColor(project, clipObj) {
  if (typeof clipObj.color === "string") {
    // Flat color — no file needed, uses FFmpeg color= filter source directly
    project.videoOrAudioClips.push({
      ...clipObj,
      hasAudio: false,
      _isFlatColor: true,
    });
  } else {
    // Gradient — generate a temp PPM image and treat as an image clip
    const width = project.options.width || C.DEFAULT_WIDTH;
    const height = project.options.height || C.DEFAULT_HEIGHT;
    const ppmBuffer = generateGradientPPM(width, height, clipObj.color);

    const tempPath = path.join(
      project.options.tempDir || os.tmpdir(),
      `simpleffmpeg-gradient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ppm`
    );
    fs.writeFileSync(tempPath, ppmBuffer);

    // Register for cleanup
    project.filesToClean.push(tempPath);

    project.videoOrAudioClips.push({
      ...clipObj,
      url: tempPath,
      hasAudio: false,
    });
  }
}

module.exports = {
  loadVideo,
  loadAudio,
  loadImage,
  loadBackgroundAudio,
  loadText,
  loadEffect,
  loadSubtitle,
  loadColor,
};
