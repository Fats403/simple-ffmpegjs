function buildBackgroundMusicMix(
  project,
  backgroundClips,
  existingAudioLabel,
  visualEnd
) {
  if (backgroundClips.length === 0) {
    return {
      filter: "",
      finalAudioLabel: existingAudioLabel,
      hasAudio: !!existingAudioLabel,
    };
  }

  const projectDuration =
    project.videoOrAudioClips.filter(
      (c) => c.type === "video" || c.type === "image"
    ).length > 0
      ? Math.max(
          ...project.videoOrAudioClips
            .filter((c) => c.type === "video" || c.type === "image")
            .map((c) => c.end)
        )
      : Math.max(
          0,
          ...backgroundClips.map((c) => (typeof c.end === "number" ? c.end : 0))
        );

  let filter = "";
  const bgLabels = [];
  backgroundClips.forEach((clip, i) => {
    const inputIndex = project.videoOrAudioClips.indexOf(clip);
    const effectivePosition =
      typeof clip.position === "number" ? clip.position : 0;
    const effectiveEnd =
      typeof clip.end === "number" ? clip.end : projectDuration;
    const effectiveCutFrom =
      typeof clip.cutFrom === "number" ? clip.cutFrom : 0;
    const effectiveVolume = typeof clip.volume === "number" ? clip.volume : 0.2;

    const adelay = effectivePosition * 1000;
    const trimEnd = effectiveCutFrom + (effectiveEnd - effectivePosition);
    const outLabel = `[bg${i}]`;
    filter += `[${inputIndex}:a]volume=${effectiveVolume},atrim=start=${effectiveCutFrom}:end=${trimEnd},adelay=${adelay}|${adelay},asetpts=PTS-STARTPTS${outLabel};`;
    bgLabels.push(outLabel);
  });

  if (bgLabels.length > 0) {
    if (existingAudioLabel) {
      filter += `${existingAudioLabel}${bgLabels.join("")}amix=inputs=${
        bgLabels.length + 1
      }:duration=longest[finalaudio];`;
      return { filter, finalAudioLabel: "[finalaudio]", hasAudio: true };
    }
    filter += `${bgLabels.join("")}amix=inputs=${
      bgLabels.length
    }:duration=longest[finalaudio];`;
    return { filter, finalAudioLabel: "[finalaudio]", hasAudio: true };
  }
  return {
    filter: "",
    finalAudioLabel: existingAudioLabel,
    hasAudio: !!existingAudioLabel,
  };
}

module.exports = { buildBackgroundMusicMix };
