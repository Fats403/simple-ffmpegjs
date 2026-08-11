const { getClipInputIndex } = require("../lib/utils");

/**
 * Build audio filter chain for standalone audio clips (sound effects, voiceovers, etc.).
 *
 * @param {Object} project - The SIMPLEFFMPEG project instance
 * @param {Array} audioClips - Array of standalone audio clip objects
 * @param {Object} options
 * @param {boolean} options.compensateTransitions - Whether to adjust timings for transition overlap
 * @param {Array} options.videoClips - Video clips (needed for transition offset calculation)
 * @param {boolean} options.hasAudio - Whether the project already has an audio stream
 * @param {string} options.finalAudioLabel - Current final audio label (e.g. "[outa]")
 * @returns {{ filter: string, finalAudioLabel: string|null, hasAudio: boolean }}
 */
function buildStandaloneAudioMix(
  project,
  audioClips,
  { compensateTransitions, videoClips, hasAudio, finalAudioLabel },
) {
  if (audioClips.length === 0) {
    return { filter: "", finalAudioLabel, hasAudio };
  }

  // Compensate audio timings for transition overlap if enabled
  let adjustedClips = audioClips;
  if (compensateTransitions && videoClips.length > 1) {
    adjustedClips = audioClips.map((clip) => {
      const adjustedPosition = project._adjustTimestampForTransitions(
        videoClips,
        clip.position || 0,
      );
      const adjustedEnd = project._adjustTimestampForTransitions(
        videoClips,
        clip.end || 0,
      );
      return { ...clip, position: adjustedPosition, end: adjustedEnd };
    });
  }

  let filter = "";
  const labels = [];

  adjustedClips.forEach((clip, idx) => {
    // Use the original clip for input index lookup since
    // _inputIndexMap keys are the original clip objects.
    const originalClip = audioClips[idx];
    const inputIndex = getClipInputIndex(project, originalClip);

    const vol = typeof clip.volume === "number" ? clip.volume : 1;
    const cutFrom = typeof clip.cutFrom === "number" ? clip.cutFrom : 0;
    const position = typeof clip.position === "number" ? clip.position : 0;
    const end = typeof clip.end === "number" ? clip.end : position;
    const adelay = Math.round(Math.max(0, position * 1000));
    const label = `[a${inputIndex}]`;
    filter += `[${inputIndex}:a]volume=${vol},atrim=start=${cutFrom}:end=${
      cutFrom + Math.max(0, end - position)
    },asetpts=PTS-STARTPTS,adelay=${adelay}|${adelay}${label};`;
    labels.push(label);
  });

  if (labels.length === 0) {
    return { filter: "", finalAudioLabel, hasAudio };
  }

  filter += labels.join("");
  if (hasAudio) {
    filter += `${finalAudioLabel}amix=inputs=${
      labels.length + 1
    }:duration=longest[finalaudio];`;
  } else {
    filter += `amix=inputs=${labels.length}:duration=longest[finalaudio];`;
  }

  return { filter, finalAudioLabel: "[finalaudio]", hasAudio: true };
}

module.exports = { buildStandaloneAudioMix };
