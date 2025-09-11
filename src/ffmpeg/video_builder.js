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
      const framesMinusOne = Math.max(1, frames - 1);
      const s = `${width}x${height}`;

      // Use overscan pre-scale + center crop, then zoompan with center-based x/y
      const overscanW = Math.max(width * 3, 4000);
      const kb = clip.kenBurns;
      const type = typeof kb === "string" ? kb : kb.type;
      // Simplified fixed-intensity zoom. API no longer exposes strength.
      const zoomAmount = 0.15;

      let zoomExpr = `1`;
      let xExpr = `round(iw/2 - (iw/zoom)/2)`;
      let yExpr = `round(ih/2 - (ih/zoom)/2)`;

      if (type === "zoom-in") {
        const inc = (zoomAmount / framesMinusOne).toFixed(6);
        // Ensure first frame starts exactly at base zoom=1 (on==0)
        zoomExpr = `if(eq(on\\,0)\\,1\\,zoom+${inc})`;
      } else if (type === "zoom-out") {
        const start = (1 + zoomAmount).toFixed(4);
        const dec = (zoomAmount / framesMinusOne).toFixed(6);
        // Start pre-zoomed on first frame to avoid jump
        zoomExpr = `if(eq(on\\,0)\\,${start}\\,zoom-${dec})`;
      } else {
        const panZoom = 1.12;
        zoomExpr = `${panZoom}`;
        const dx = `(iw - iw/${panZoom})`;
        const dy = `(ih - ih/${panZoom})`;
        if (type === "pan-left") {
          xExpr = `${dx} - ${dx}*on/${framesMinusOne}`;
          yExpr = `(ih - ih/zoom)/2`;
        } else if (type === "pan-right") {
          xExpr = `${dx}*on/${framesMinusOne}`;
          yExpr = `(ih - ih/zoom)/2`;
        } else if (type === "pan-up") {
          xExpr = `(iw - iw/zoom)/2`;
          yExpr = `${dy} - ${dy}*on/${framesMinusOne}`;
        } else if (type === "pan-down") {
          xExpr = `(iw - iw/zoom)/2`;
          yExpr = `${dy}*on/${framesMinusOne}`;
        }
      }

      filterComplex += `[${inputIndex}:v]select=eq(n\\,0),setpts=PTS-STARTPTS,scale=${width}:-2,setsar=1:1,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2,scale=${overscanW}:-1,zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${s},fps=${fps},settb=1/${fps}${scaledLabel};`;
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
