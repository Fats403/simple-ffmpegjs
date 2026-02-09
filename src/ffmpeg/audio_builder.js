/**
 * Build audio filter chain for video clips.
 *
 * @param {Object} project - The SIMPLEFFMPEG project instance
 * @param {Array} videoClips - Array of video clip objects
 * @param {Map} [transitionOffsets] - Map of clip -> cumulative transition offset in seconds
 */
function buildAudioForVideoClips(project, videoClips, transitionOffsets) {
  let audioFilter = "";
  const labels = [];

  videoClips.forEach((clip) => {
    if (!clip.hasAudio) return;
    const inputIndex = project._inputIndexMap
      ? project._inputIndexMap.get(clip)
      : project.videoOrAudioClips.indexOf(clip);
    const requestedDuration = Math.max(
      0,
      (clip.end || 0) - (clip.position || 0)
    );
    const maxAvailable =
      typeof clip.mediaDuration === "number" && typeof clip.cutFrom === "number"
        ? Math.max(0, clip.mediaDuration - clip.cutFrom)
        : requestedDuration;
    const clipDuration = Math.max(0, Math.min(requestedDuration, maxAvailable));

    const offset = transitionOffsets ? (transitionOffsets.get(clip) || 0) : 0;
    const adelayMs = Math.round(Math.max(0, (clip.position || 0) - offset) * 1000);
    const vol = clip.volume != null ? clip.volume : 1;
    const out = `[va${inputIndex}]`;
    audioFilter += `[${inputIndex}:a]volume=${vol},atrim=start=${clip.cutFrom}:duration=${clipDuration},asetpts=PTS-STARTPTS,adelay=${adelayMs}|${adelayMs}${out};`;
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
