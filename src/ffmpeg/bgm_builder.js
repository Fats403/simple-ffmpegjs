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

  // Prefer the caller-supplied visualEnd which accounts for transition
  // compression, falling back to clip end values for audio-only projects.
  const projectDuration =
    typeof visualEnd === "number" && visualEnd > 0
      ? visualEnd
      : project.videoOrAudioClips.filter(
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
    const inputIndex = project._inputIndexMap
      ? project._inputIndexMap.get(clip)
      : project.videoOrAudioClips.indexOf(clip);
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
    filter += `[${inputIndex}:a]volume=${effectiveVolume},atrim=start=${effectiveCutFrom}:end=${trimEnd},asetpts=PTS-STARTPTS,adelay=${adelay}|${adelay}${outLabel};`;
    bgLabels.push(outLabel);
  });

  if (bgLabels.length > 0) {
    if (existingAudioLabel) {
      // Generate a silence anchor from time 0 so that amix starts producing
      // output immediately. Without this, amix waits for ALL inputs to have
      // frames before outputting — if the existing audio (e.g. delayed video
      // audio) starts later on the timeline, background music is silenced
      // until that point.
      const anchorDur = Math.max(projectDuration, visualEnd || 0, 0.1);
      const padLabel = "[_bgmpad]";
      filter += `anullsrc=cl=stereo,atrim=end=${anchorDur}${padLabel};`;

      // Use normalize=0 with explicit weights so the silence anchor
      // contributes no audio energy while preserving the same volume
      // balance as a direct amix of the real inputs.
      const realCount = bgLabels.length + 1; // bgm tracks + existing audio
      const w = (1 / realCount).toFixed(6);
      const weights = ["0", ...Array(realCount).fill(w)].join(" ");

      filter += `${padLabel}${existingAudioLabel}${bgLabels.join("")}amix=inputs=${
        bgLabels.length + 2
      }:duration=longest:weights='${weights}':normalize=0[finalaudio];`;
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
