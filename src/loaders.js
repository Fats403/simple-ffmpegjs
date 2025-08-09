const { getVideoMetadata, getMediaDuration } = require("./core/media_info");
const C = require("./core/constants");

async function loadVideo(project, clipObj) {
  const metadata = await getVideoMetadata(clipObj.url);
  if (typeof clipObj.cutFrom === "number" && metadata.durationSec != null) {
    if (clipObj.cutFrom >= metadata.durationSec) {
      throw new Error(
        `Video clip cutFrom (${clipObj.cutFrom}s) must be < source duration (${metadata.durationSec}s)`
      );
    }
  }
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
  project.videoOrAudioClips.push({
    ...clipObj,
    iphoneRotation: metadata.iphoneRotation,
    hasAudio: metadata.hasAudio,
    mediaDuration: metadata.durationSec,
  });
}

async function loadAudio(project, clipObj) {
  const durationSec = await getMediaDuration(clipObj.url);
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
  project.videoOrAudioClips.push({ ...clipObj, mediaDuration: durationSec });
}

function loadImage(project, clipObj) {
  const clip = { ...clipObj, hasAudio: false, cutFrom: 0 };
  project.videoOrAudioClips.push(clip);
}

async function loadBackgroundAudio(project, clipObj) {
  const durationSec = await getMediaDuration(clipObj.url);
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
  project.videoOrAudioClips.push({ ...clip, mediaDuration: durationSec });
}

function loadText(project, clipObj) {
  const clip = {
    ...clipObj,
    fontFile: clipObj.fontFile || null,
    fontFamily: clipObj.fontFamily || C.DEFAULT_FONT_FAMILY,
    fontSize: clipObj.fontSize || C.DEFAULT_FONT_SIZE,
    fontColor: clipObj.fontColor || C.DEFAULT_FONT_COLOR,
  };
  if (typeof clipObj.centerX === "number") clip.centerX = clipObj.centerX;
  else if (typeof clipObj.x === "number") clip.x = clipObj.x;
  else clip.centerX = 0;
  if (typeof clipObj.centerY === "number") clip.centerY = clipObj.centerY;
  else if (typeof clipObj.y === "number") clip.y = clipObj.y;
  else clip.centerY = 0;
  project.textClips.push(clip);
}

module.exports = {
  loadVideo,
  loadAudio,
  loadImage,
  loadBackgroundAudio,
  loadText,
};
