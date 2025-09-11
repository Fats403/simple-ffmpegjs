const fs = require("fs");

function validateClips(clips, validationMode = "warn") {
  const allowedTypes = new Set([
    "video",
    "audio",
    "text",
    "music",
    "backgroundAudio",
    "image",
  ]);
  const errors = [];
  const warnings = [];

  clips.forEach((clip, idx) => {
    if (!allowedTypes.has(clip.type)) {
      errors.push(`clip[${idx}]: invalid type '${clip.type}'`);
      return;
    }

    const requiresTimeline =
      clip.type === "video" ||
      clip.type === "audio" ||
      clip.type === "text" ||
      clip.type === "image";
    if (requiresTimeline) {
      if (typeof clip.position !== "number" || typeof clip.end !== "number") {
        errors.push(`clip[${idx}]: 'position' and 'end' must be numbers`);
      } else {
        if (clip.position < 0)
          errors.push(`clip[${idx}]: position must be >= 0`);
        if (clip.end <= clip.position)
          errors.push(`clip[${idx}]: end must be > position`);
      }
    } else {
      // music/backgroundAudio: allow missing position/end (defaults later)
      if (typeof clip.position === "number" && clip.position < 0) {
        errors.push(`clip[${idx}]: position must be >= 0`);
      }
      if (
        typeof clip.end === "number" &&
        typeof clip.position === "number" &&
        clip.end <= clip.position
      ) {
        errors.push(`clip[${idx}]: end must be > position`);
      }
    }

    // Media clips
    if (
      clip.type === "video" ||
      clip.type === "audio" ||
      clip.type === "music" ||
      clip.type === "backgroundAudio" ||
      clip.type === "image"
    ) {
      if (typeof clip.url !== "string" || clip.url.length === 0) {
        errors.push(`clip[${idx}]: media 'url' is required`);
      } else {
        try {
          if (!fs.existsSync(clip.url)) {
            warnings.push(`clip[${idx}]: file not found at '${clip.url}'`);
          }
        } catch (_) {}
      }
      if (typeof clip.cutFrom === "number" && clip.cutFrom < 0) {
        errors.push(`clip[${idx}]: cutFrom must be >= 0`);
      }
      if (
        (clip.type === "audio" ||
          clip.type === "music" ||
          clip.type === "backgroundAudio") &&
        typeof clip.volume === "number" &&
        clip.volume < 0
      ) {
        errors.push(`clip[${idx}]: volume must be >= 0`);
      }
    }

    if (clip.type === "text") {
      // words windows
      if (Array.isArray(clip.words)) {
        clip.words.forEach((w, wi) => {
          if (
            typeof w.start !== "number" ||
            typeof w.end !== "number" ||
            typeof w.text !== "string"
          ) {
            errors.push(`clip[${idx}].words[${wi}]: invalid {text,start,end}`);
            return;
          }
          if (w.end <= w.start) {
            errors.push(`clip[${idx}].words[${wi}]: end must be > start`);
          }
          if (
            typeof clip.position === "number" &&
            typeof clip.end === "number"
          ) {
            if (w.start < clip.position || w.end > clip.end) {
              warnings.push(
                `clip[${idx}].words[${wi}]: window outside [position,end]`
              );
            }
          }
        });
      }
      if (Array.isArray(clip.wordTimestamps)) {
        const ts = clip.wordTimestamps;
        for (let i = 1; i < ts.length; i++) {
          if (
            !(
              typeof ts[i] === "number" &&
              typeof ts[i - 1] === "number" &&
              ts[i] >= ts[i - 1]
            )
          ) {
            warnings.push(
              `clip[${idx}].wordTimestamps: not non-decreasing at index ${i}`
            );
            break;
          }
        }
      }
      if (clip.fontFile && !fs.existsSync(clip.fontFile)) {
        warnings.push(
          `clip[${idx}]: fontFile '${clip.fontFile}' not found; falling back to fontFamily`
        );
      }
    }

    if (clip.type === "image" && clip.kenBurns) {
      const kb = clip.kenBurns;
      const allowedKB = new Set([
        "zoom-in",
        "zoom-out",
        "pan-left",
        "pan-right",
        "pan-up",
        "pan-down",
      ]);
      const type = typeof kb === "string" ? kb : kb.type;
      if (!allowedKB.has(type))
        errors.push(`clip[${idx}]: kenBurns '${type}' invalid`);
    }
  });

  // Visual timeline gap checks (video/image)
  const visual = clips
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.type === "video" || c.type === "image")
    .sort((a, b) => (a.c.position || 0) - (b.c.position || 0));

  if (visual.length > 0) {
    const eps = 1e-3;
    // Leading gap
    if ((visual[0].c.position || 0) > eps) {
      const start = 0;
      const end = visual[0].c.position;
      const msg = `visual gap [${start.toFixed(3)}, ${end.toFixed(
        3
      )}) — no video/image content at start`;
      errors.push(msg);
    }
    // Middle gaps
    for (let i = 1; i < visual.length; i++) {
      const prev = visual[i - 1].c;
      const cur = visual[i].c;
      if ((cur.position || 0) - (prev.end || 0) > eps) {
        const start = prev.end || 0;
        const end = cur.position || 0;
        const msg = `visual gap [${start.toFixed(3)}, ${end.toFixed(
          3
        )}) — no video/image content between clips`;
        errors.push(msg);
      }
    }
  }

  if (errors.length > 0) {
    const msg = `Validation failed:\n - ` + errors.join(`\n - `);
    throw new Error(msg);
  }
  if (validationMode === "warn" && warnings.length > 0) {
    warnings.forEach((w) => console.warn(w));
  }
}

module.exports = { validateClips };
