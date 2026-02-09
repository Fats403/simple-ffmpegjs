/**
 * Clip resolution — transforms shorthand clip properties into canonical form.
 *
 * This runs BEFORE validation, so the rest of the pipeline always sees
 * standard { position, end } clips. Two features are handled here:
 *
 * 1. **duration → end**: If a clip has `duration` instead of `end`,
 *    compute `end = position + duration`.
 *
 * 2. **Auto-sequential positioning**: If a video/image/audio clip omits
 *    `position`, it is placed immediately after the previous clip on the
 *    same track (visual or audio). The first clip defaults to position 0.
 *
 * Clips are shallow-cloned — the caller's original objects are not mutated.
 */

/**
 * Types that auto-sequence on the visual track (video + image share a timeline).
 */
const VISUAL_TYPES = ["video", "image", "color"];

/**
 * Types that auto-sequence on the audio track.
 */
const AUDIO_TYPES = ["audio"];

/**
 * All types eligible for auto-sequencing (position can be omitted).
 */
const AUTO_SEQUENCE_TYPES = [...VISUAL_TYPES, ...AUDIO_TYPES];

/**
 * Resolve shorthand clip properties into canonical { position, end } form.
 *
 * @param {Array} clips - Array of clip objects (not mutated)
 * @returns {{ clips: Array, errors: Array }} Resolved clips and any resolution errors
 */
function resolveClips(clips) {
  if (!Array.isArray(clips)) {
    return { clips, errors: [] };
  }

  const errors = [];
  let lastVisualEnd = 0;
  let lastAudioEnd = 0;

  const resolved = clips.map((clip, index) => {
    const c = { ...clip };
    const path = `clips[${index}]`;

    // ── Conflict check: duration + end ──────────────────────────────────
    if (c.duration != null && c.end != null) {
      errors.push({
        code: "INVALID_VALUE",
        path: `${path}`,
        message:
          "Cannot specify both 'duration' and 'end'. Use one or the other.",
        received: { duration: c.duration, end: c.end },
      });
      // Don't resolve further — let validation report the canonical errors
      return c;
    }

    // ── Auto-sequential positioning ─────────────────────────────────────
    const isVisual = VISUAL_TYPES.includes(c.type);
    const isAudio = AUDIO_TYPES.includes(c.type);
    const canAutoSequence = AUTO_SEQUENCE_TYPES.includes(c.type);

    if (canAutoSequence && c.position == null) {
      c.position = isVisual ? lastVisualEnd : lastAudioEnd;
    }

    // ── Duration → end ──────────────────────────────────────────────────
    if (c.duration != null && c.end == null) {
      if (typeof c.position === "number" && typeof c.duration === "number") {
        c.end = c.position + c.duration;
      }
      // Remove duration so the rest of the pipeline sees canonical { position, end }
      delete c.duration;
    }

    // ── Track the end of the last clip on each track ────────────────────
    if (isVisual && typeof c.end === "number") {
      lastVisualEnd = c.end;
    }
    if (isAudio && typeof c.end === "number") {
      lastAudioEnd = c.end;
    }

    return c;
  });

  return { clips: resolved, errors };
}

module.exports = { resolveClips };
