function buildAudioForVideoClips(project, videoClips) {
  let audioFilter = "";
  const labels = [];

  videoClips.forEach((clip) => {
    if (!clip.hasAudio) return;
    const inputIndex = project.videoOrAudioClips.indexOf(clip);
    const requestedDuration = Math.max(
      0,
      (clip.end || 0) - (clip.position || 0)
    );
    const maxAvailable =
      typeof clip.mediaDuration === "number" && typeof clip.cutFrom === "number"
        ? Math.max(0, clip.mediaDuration - clip.cutFrom)
        : requestedDuration;
    const clipDuration = Math.max(0, Math.min(requestedDuration, maxAvailable));

    const adelayMs = Math.round(Math.max(0, clip.position || 0) * 1000);
    const out = `[va${inputIndex}]`;
    audioFilter += `[${inputIndex}:a]atrim=start=${clip.cutFrom}:duration=${clipDuration},asetpts=PTS-STARTPTS,adelay=${adelayMs}|${adelayMs}${out};`;
    labels.push(out);
  });

  if (labels.length === 0) {
    return { filter: "", finalAudioLabel: null, hasAudio: false };
  }

  audioFilter += `${labels.join("")}amix=inputs=${
    labels.length
  }:duration=longest[outa];`;
  return { filter: audioFilter, finalAudioLabel: "[outa]", hasAudio: true };
}

module.exports = { buildAudioForVideoClips };
