const DEFAULT_KEN_BURNS_ZOOM = 0.15;
const DEFAULT_PAN_ZOOM = 1.12;
const MIN_PAN_ZOOM = 1.04;

function clamp01(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, value));
}

function formatNumber(value, decimals) {
  return Number(value.toFixed(decimals)).toString();
}

function buildEasingExpr(framesMinusOne, easing) {
  const t = `(on/${framesMinusOne})`;
  if (easing === "ease-in") {
    return `(${t})*(${t})`;
  }
  if (easing === "ease-out") {
    return `1-((1-${t})*(1-${t}))`;
  }
  if (easing === "ease-in-out") {
    return `0.5-0.5*cos(PI*${t})`;
  }
  return t;
}

function buildInterpolatedExpr(start, end, framesMinusOne, easing, decimals) {
  const delta = end - start;
  const startStr = formatNumber(start, decimals);
  if (framesMinusOne <= 1 || Math.abs(delta) < 1e-8) {
    return startStr;
  }
  const deltaStr = formatNumber(delta, decimals);
  const ease = buildEasingExpr(framesMinusOne, easing);
  return `${startStr}+(${deltaStr})*(${ease})`;
}

function buildZoomExpr(startZoom, endZoom, framesMinusOne, easing) {
  return buildInterpolatedExpr(startZoom, endZoom, framesMinusOne, easing, 4);
}

function buildPositionExpr(start, end, framesMinusOne, easing) {
  return buildInterpolatedExpr(start, end, framesMinusOne, easing, 4);
}

function resolveKenBurnsOptions(kenBurns, width, height, sourceWidth, sourceHeight) {
  const kb = typeof kenBurns === "object" && kenBurns ? kenBurns : {};
  const type = typeof kenBurns === "string" ? kenBurns : kb.type || "custom";
  const easing = kb.easing || "ease-in-out";

  let startZoom = 1;
  let endZoom = 1;
  let startX = 0.5;
  let startY = 0.5;
  let endX = 0.5;
  let endY = 0.5;

  if (type === "zoom-in") {
    startZoom = 1;
    endZoom = 1 + DEFAULT_KEN_BURNS_ZOOM;
  } else if (type === "zoom-out") {
    startZoom = 1 + DEFAULT_KEN_BURNS_ZOOM;
    endZoom = 1;
  } else if (type === "pan-left") {
    startZoom = DEFAULT_PAN_ZOOM;
    endZoom = DEFAULT_PAN_ZOOM;
    startX = 1;
    endX = 0;
  } else if (type === "pan-right") {
    startZoom = DEFAULT_PAN_ZOOM;
    endZoom = DEFAULT_PAN_ZOOM;
    startX = 0;
    endX = 1;
  } else if (type === "pan-up") {
    startZoom = DEFAULT_PAN_ZOOM;
    endZoom = DEFAULT_PAN_ZOOM;
    startY = 1;
    endY = 0;
  } else if (type === "pan-down") {
    startZoom = DEFAULT_PAN_ZOOM;
    endZoom = DEFAULT_PAN_ZOOM;
    startY = 0;
    endY = 1;
  } else if (type === "smart") {
    const anchor = kb.anchor;
    startZoom = DEFAULT_PAN_ZOOM;
    endZoom = DEFAULT_PAN_ZOOM;

    let panAxis = "horizontal";
    const hasSourceDims =
      typeof sourceWidth === "number" &&
      typeof sourceHeight === "number" &&
      sourceWidth > 0 &&
      sourceHeight > 0;

    if (hasSourceDims) {
      const outputAspect = width / height;
      const sourceAspect = sourceWidth / sourceHeight;
      if (Math.abs(sourceAspect - outputAspect) > 0.001) {
        panAxis = sourceAspect < outputAspect ? "vertical" : "horizontal";
      } else {
        panAxis = height > width ? "vertical" : "horizontal";
      }
    } else {
      panAxis = height > width ? "vertical" : "horizontal";
    }

    if (panAxis === "vertical") {
      if (anchor === "top") {
        startY = 0;
        endY = 1;
      } else {
        startY = 1;
        endY = 0;
      }
    } else {
      if (anchor === "left") {
        startX = 0;
        endX = 1;
      } else {
        startX = 1;
        endX = 0;
      }
    }
  }

  if (typeof kb.startZoom === "number" && Number.isFinite(kb.startZoom)) {
    startZoom = kb.startZoom;
  }
  if (typeof kb.endZoom === "number" && Number.isFinite(kb.endZoom)) {
    endZoom = kb.endZoom;
  }

  const customStartX = clamp01(kb.startX);
  const customEndX = clamp01(kb.endX);
  const customStartY = clamp01(kb.startY);
  const customEndY = clamp01(kb.endY);

  if (typeof customStartX === "number") {
    startX = customStartX;
  }
  if (typeof customEndX === "number") {
    endX = customEndX;
  }
  if (typeof customStartY === "number") {
    startY = customStartY;
  }
  if (typeof customEndY === "number") {
    endY = customEndY;
  }

  // At zoom=1.0 the zoompan visible window equals the full image, so
  // (iw - iw/zoom) = 0 and position values are multiplied by zero — making
  // any pan completely invisible.  Ensure both zoom endpoints are high enough
  // for the pan to have a visible range.
  // When zoom wasn't explicitly provided, use the full default pan zoom.
  // When it was explicit but below the minimum, nudge it up just enough to
  // make the pan work without dramatically altering the requested zoom.
  const hasPan = startX !== endX || startY !== endY;
  if (hasPan) {
    const zoomWasExplicit =
      typeof kb.startZoom === "number" || typeof kb.endZoom === "number";
    const minZoom = zoomWasExplicit ? MIN_PAN_ZOOM : DEFAULT_PAN_ZOOM;
    if (startZoom < minZoom) startZoom = minZoom;
    if (endZoom < minZoom) endZoom = minZoom;
  }

  return { startZoom, endZoom, startX, startY, endX, endY, easing };
}

function computeOverscanWidth(width, startZoom, endZoom) {
  const maxZoom = Math.max(1, startZoom, endZoom);
  // Generous pre-scale ensures zoompan has enough pixel resolution for smooth
  // sub-pixel motion.  The integer x/y crop offsets in zoompan need a large
  // canvas so that small position changes don't appear as visible stepping.
  // 3x output width (floor 4000px) provides ~5-6 pixels of displacement per
  // frame for typical pan speeds, which is imperceptible on screen.
  let overscan = Math.max(width * 3, 4000, Math.round(width * maxZoom * 2));
  if (overscan % 2 !== 0) {
    overscan += 1;
  }
  return overscan;
}

function computeContainedSize(srcW, srcH, outW, outH) {
  const srcAspect = srcW / srcH;
  const outAspect = outW / outH;
  let cw, ch;
  if (srcAspect > outAspect) {
    cw = outW;
    ch = Math.round(outW / srcAspect);
  } else {
    ch = outH;
    cw = Math.round(outH * srcAspect);
  }
  if (cw % 2 !== 0) cw += 1;
  if (ch % 2 !== 0) ch += 1;
  return { cw, ch };
}

function resolveImageFit(clip) {
  if (clip.imageFit) return clip.imageFit;
  return clip.kenBurns ? "cover" : "blur-fill";
}

function buildVideoFilter(project, videoClips) {
  let filterComplex = "";
  let videoIndex = 0;
  const fps = project.options.fps;
  const width = project.options.width;
  const height = project.options.height;

  // Use the project-level input index map (built in _prepareExport) when available,
  // otherwise build a local one for standalone usage (e.g. unit tests).
  let inputIndexMap = project._inputIndexMap;
  if (!inputIndexMap) {
    inputIndexMap = new Map();
    let inputIdx = 0;
    for (const clip of project.videoOrAudioClips) {
      if (clip.type === "color" && clip._isFlatColor) {
        continue;
      }
      inputIndexMap.set(clip, inputIdx);
      inputIdx++;
    }
  }

  // Build scaled streams
  const scaledStreams = [];
  videoClips.forEach((clip) => {
    const scaledLabel = `[scaled${videoIndex}]`;

    const requestedDuration = Math.max(
      0,
      (clip.end || 0) - (clip.position || 0),
    );

    // Handle flat color clips — generate using color= filter source
    if (clip.type === "color" && clip._isFlatColor) {
      const colorValue = clip.color;
      filterComplex += `color=c=${colorValue}:s=${width}x${height}:d=${requestedDuration},fps=${fps},settb=1/${fps}${scaledLabel};`;
      scaledStreams.push({
        label: scaledLabel,
        clip,
        index: videoIndex,
        duration: requestedDuration,
      });
      videoIndex++;
      return;
    }

    const inputIndex = inputIndexMap.get(clip);
    const maxAvailable =
      typeof clip.mediaDuration === "number" && typeof clip.cutFrom === "number"
        ? Math.max(0, clip.mediaDuration - clip.cutFrom)
        : requestedDuration;
    const clipDuration = Math.max(0, Math.min(requestedDuration, maxAvailable));

    if (clip.type === "image" && clip.kenBurns) {
      const frames = Math.max(1, Math.round(clipDuration * fps));
      const framesMinusOne = Math.max(1, frames - 1);

      const { startZoom, endZoom, startX, startY, endX, endY, easing } =
        resolveKenBurnsOptions(
          clip.kenBurns,
          width,
          height,
          clip.width,
          clip.height
        );
      const zoomExpr = buildZoomExpr(startZoom, endZoom, framesMinusOne, easing);
      const xPosExpr = buildPositionExpr(startX, endX, framesMinusOne, easing);
      const yPosExpr = buildPositionExpr(startY, endY, framesMinusOne, easing);
      const xExpr = `(iw - iw/zoom)*(${xPosExpr})`;
      const yExpr = `(ih - ih/zoom)*(${yPosExpr})`;

      let kbFit = resolveImageFit(clip);
      const hasSrcDims = typeof clip.width === "number" && typeof clip.height === "number"
        && clip.width > 0 && clip.height > 0;
      if ((kbFit === "blur-fill" || kbFit === "contain") && !hasSrcDims) {
        kbFit = "cover";
      }

      if (kbFit === "blur-fill") {
        const { cw, ch } = computeContainedSize(clip.width, clip.height, width, height);
        const sigma = typeof clip.blurIntensity === "number" && Number.isFinite(clip.blurIntensity) && clip.blurIntensity > 0
          ? clip.blurIntensity : 40;
        const overscanCW = computeOverscanWidth(cw, startZoom, endZoom);
        const cs = `${cw}x${ch}`;
        const kbbgLabel = `[kbbg${videoIndex}]`;
        const kbfgLabel = `[kbfg${videoIndex}]`;
        const kbbgrLabel = `[kbbgr${videoIndex}]`;
        const kbfgrLabel = `[kbfgr${videoIndex}]`;
        filterComplex += `[${inputIndex}:v]select='eq(n,0)',setpts=PTS-STARTPTS,split${kbbgLabel}${kbfgLabel};`;
        filterComplex += `${kbbgLabel}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2,gblur=sigma=${sigma},loop=${frames - 1}:1:0,setpts=N/${fps}/TB,fps=${fps},settb=1/${fps}${kbbgrLabel};`;
        filterComplex += `${kbfgLabel}scale=${cw}:${ch}:force_original_aspect_ratio=increase,setsar=1:1,crop=${cw}:${ch}:(iw-${cw})/2:(ih-${ch})/2,scale=${overscanCW}:-1,zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${cs}:fps=${fps},setsar=1:1,settb=1/${fps}${kbfgrLabel};`;
        filterComplex += `${kbbgrLabel}${kbfgrLabel}overlay=(W-w)/2:(H-h)/2,setsar=1:1,settb=1/${fps}${scaledLabel};`;
      } else if (kbFit === "contain") {
        const { cw, ch } = computeContainedSize(clip.width, clip.height, width, height);
        const overscanCW = computeOverscanWidth(cw, startZoom, endZoom);
        const cs = `${cw}x${ch}`;
        filterComplex += `[${inputIndex}:v]select='eq(n,0)',setpts=PTS-STARTPTS,scale=${cw}:${ch}:force_original_aspect_ratio=increase,setsar=1:1,crop=${cw}:${ch}:(iw-${cw})/2:(ih-${ch})/2,scale=${overscanCW}:-1,zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${cs}:fps=${fps},setsar=1:1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,settb=1/${fps}${scaledLabel};`;
      } else {
        const s = `${width}x${height}`;
        const overscanW = computeOverscanWidth(width, startZoom, endZoom);
        filterComplex += `[${inputIndex}:v]select='eq(n,0)',setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,setsar=1:1,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2,scale=${overscanW}:-1,zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${s}:fps=${fps},setsar=1:1,settb=1/${fps}${scaledLabel};`;
      }
    } else {
      const fit = clip.type === "image" ? resolveImageFit(clip) : null;
      const trimPrefix = `[${inputIndex}:v]trim=start=${clip.cutFrom || 0}:duration=${clipDuration},setpts=PTS-STARTPTS,fps=${fps}`;

      if (fit === "blur-fill") {
        const sigma = typeof clip.blurIntensity === "number" && Number.isFinite(clip.blurIntensity) && clip.blurIntensity > 0
          ? clip.blurIntensity : 40;
        const bgLabel = `[bg${videoIndex}]`;
        const fgLabel = `[fg${videoIndex}]`;
        const bgrLabel = `[bgr${videoIndex}]`;
        const fgrLabel = `[fgr${videoIndex}]`;
        filterComplex += `${trimPrefix},split${bgLabel}${fgLabel};`;
        filterComplex += `${bgLabel}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2,gblur=sigma=${sigma}${bgrLabel};`;
        filterComplex += `${fgLabel}scale=${width}:${height}:force_original_aspect_ratio=decrease${fgrLabel};`;
        filterComplex += `${bgrLabel}${fgrLabel}overlay=(W-w)/2:(H-h)/2,setsar=1:1,settb=1/${fps}${scaledLabel};`;
      } else if (fit === "cover") {
        filterComplex += `${trimPrefix},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2,setsar=1:1,settb=1/${fps}${scaledLabel};`;
      } else {
        filterComplex += `${trimPrefix},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1:1,settb=1/${fps}${scaledLabel};`;
      }
    }

    scaledStreams.push({
      label: scaledLabel,
      clip,
      index: videoIndex,
      duration: clipDuration,
    });
    videoIndex++;
  });

  if (scaledStreams.length === 0) {
    return { filter: "", finalVideoLabel: null, hasVideo: false, videoDuration: 0 };
  }

  const hasTransitions = scaledStreams.some(
    (s, i) => i > 0 && s.clip.transition,
  );

  if (!hasTransitions) {
    const labels = scaledStreams.map((s) => s.label);
    const videoDuration = scaledStreams.reduce((sum, s) => sum + s.duration, 0);
    filterComplex += `${labels.join("")}concat=n=${
      labels.length
    }:v=1:a=0,fps=${fps},settb=1/${fps}[outv];`;
    return { filter: filterComplex, finalVideoLabel: "[outv]", hasVideo: true, videoDuration };
  }

  let currentVideo = scaledStreams[0].label;
  let currentVideoDuration = scaledStreams[0].duration;
  for (let i = 1; i < scaledStreams.length; i++) {
    const nextVideoLabel = scaledStreams[i].label;
    const transClip = scaledStreams[i].clip;
    const transitionedVideoLabel = `[vtrans${i}]`;
    if (transClip.transition) {
      const type = transClip.transition.type;
      const duration = transClip.transition.duration;
      const offset = Math.max(0, currentVideoDuration - duration);
      filterComplex += `${currentVideo}${nextVideoLabel}xfade=transition=${type}:duration=${duration}:offset=${offset},fps=${fps},settb=1/${fps}${transitionedVideoLabel};`;
      currentVideoDuration =
        currentVideoDuration + scaledStreams[i].duration - duration;
      currentVideo = transitionedVideoLabel;
    } else {
      const concatenatedVideoLabel = `[vcat${i}]`;
      filterComplex += `${currentVideo}${nextVideoLabel}concat=n=2:v=1:a=0,fps=${fps},settb=1/${fps}${concatenatedVideoLabel};`;
      currentVideo = concatenatedVideoLabel;
      currentVideoDuration = currentVideoDuration + scaledStreams[i].duration;
    }
  }

  return {
    filter: filterComplex,
    finalVideoLabel: currentVideo,
    hasVideo: true,
    videoDuration: currentVideoDuration,
  };
}

module.exports = { buildVideoFilter };
