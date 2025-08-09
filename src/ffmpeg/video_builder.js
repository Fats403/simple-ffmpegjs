function buildVideoFilter(project, videoClips) {
  let filterComplex = "";
  let videoIndex = 0;
  const fps = project.options.fps;
  const width = project.options.width;
  const height = project.options.height;

  // Build scaled streams
  const scaledStreams = [];
  videoClips.forEach((clip) => {
    const inputIndex = project.videoOrAudioClips.indexOf(clip);
    const scaledLabel = `[scaled${videoIndex}]`;

    const requestedDuration = Math.max(
      0,
      (clip.end || 0) - (clip.position || 0)
    );
    const maxAvailable =
      typeof clip.mediaDuration === "number" && typeof clip.cutFrom === "number"
        ? Math.max(0, clip.mediaDuration - clip.cutFrom)
        : requestedDuration;
    const clipDuration = Math.max(0, Math.min(requestedDuration, maxAvailable));

    if (clip.type === "image" && clip.kenBurns) {
      const frames = Math.max(1, Math.round(clipDuration * fps));
      const s = `${width}x${height}`;
      const strength =
        typeof clip.kenBurns.strength === "number"
          ? clip.kenBurns.strength
          : 0.1;
      const zStep = strength / frames;
      let zoomExpr = `1`;
      let xExpr = `(iw-ow)/2`;
      let yExpr = `(ih-oh)/2`;
      const panBaseZoom = strength && strength > 0 ? strength : 0.1;
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
      filterComplex += `[${inputIndex}:v]select=eq(n\\,0),setpts=PTS-STARTPTS,zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${s},fps=${fps},settb=1/${fps}${scaledLabel};`;
    } else {
      filterComplex += `[${inputIndex}:v]trim=start=${
        clip.cutFrom || 0
      }:duration=${clipDuration},setpts=PTS-STARTPTS,fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,settb=1/${fps}${scaledLabel};`;
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
    return { filter: "", finalVideoLabel: null, hasVideo: false };
  }

  const hasTransitions = scaledStreams.some(
    (s, i) => i > 0 && s.clip.transition
  );

  if (!hasTransitions) {
    const labels = scaledStreams.map((s) => s.label);
    filterComplex += `${labels.join("")}concat=n=${
      labels.length
    }:v=1:a=0,fps=${fps},settb=1/${fps}[outv];`;
    return { filter: filterComplex, finalVideoLabel: "[outv]", hasVideo: true };
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
  };
}

module.exports = { buildVideoFilter };
