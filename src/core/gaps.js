/**
 * Detect visual gaps in a timeline of video/image clips.
 * Returns an array of gap objects with {start, end, duration} properties.
 *
 * @param {Array<{type: string, position: number, end: number}>} clips - Array of clips
 * @param {Object} options - Options
 * @param {number} options.epsilon - Tolerance for gap detection (default 0.001)
 * @param {number} [options.timelineEnd] - Desired end of the timeline; if set and greater
 *   than the last visual clip's end, a trailing gap is appended.
 * @returns {Array<{start: number, end: number, duration: number}>} Array of gaps
 */
function detectVisualGaps(clips, options = {}) {
  const { epsilon = 1e-3, timelineEnd } = options;

  // Filter to only visual clips (video/image) and sort by position
  const visual = clips
    .filter((c) => c.type === "video" || c.type === "image")
    .map((c) => ({
      position: c.position || 0,
      end: c.end || 0,
    }))
    .sort((a, b) => a.position - b.position);

  const gaps = [];

  if (visual.length === 0) {
    // If no visual clips but a timeline end is specified, the entire range is a gap
    if (
      typeof timelineEnd === "number" &&
      Number.isFinite(timelineEnd) &&
      timelineEnd > epsilon
    ) {
      gaps.push({
        start: 0,
        end: timelineEnd,
        duration: timelineEnd,
      });
    }
    return gaps;
  }

  // Check for leading gap (gap at the start before first clip)
  if (visual[0].position > epsilon) {
    gaps.push({
      start: 0,
      end: visual[0].position,
      duration: visual[0].position,
    });
  }

  // Check for gaps between clips
  for (let i = 1; i < visual.length; i++) {
    const prev = visual[i - 1];
    const cur = visual[i];

    if (cur.position - prev.end > epsilon) {
      gaps.push({
        start: prev.end,
        end: cur.position,
        duration: cur.position - prev.end,
      });
    }
  }

  // Check for trailing gap (gap at the end after last clip)
  if (typeof timelineEnd === "number" && Number.isFinite(timelineEnd)) {
    const lastEnd = visual[visual.length - 1].end;
    if (timelineEnd - lastEnd > epsilon) {
      gaps.push({
        start: lastEnd,
        end: timelineEnd,
        duration: timelineEnd - lastEnd,
      });
    }
  }

  return gaps;
}

/**
 * Check if clips have any visual gaps.
 *
 * @param {Array} clips - Array of clips
 * @param {Object} options - Options for gap detection
 * @returns {boolean} True if there are gaps
 */
function hasVisualGaps(clips, options = {}) {
  return detectVisualGaps(clips, options).length > 0;
}

/**
 * Get the total timeline end (the end of the last visual clip).
 *
 * @param {Array<{type: string, end: number}>} clips - Array of clips
 * @returns {number} The end time of the last visual clip, or 0 if no visual clips
 */
function getVisualTimelineEnd(clips) {
  const visual = clips.filter((c) => c.type === "video" || c.type === "image");
  if (visual.length === 0) return 0;
  return Math.max(...visual.map((c) => c.end || 0));
}

module.exports = {
  detectVisualGaps,
  hasVisualGaps,
  getVisualTimelineEnd,
};
