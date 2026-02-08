const fs = require("fs");

/**
 * Error/warning codes for programmatic handling
 */
const ValidationCodes = {
  // Type errors
  INVALID_TYPE: "INVALID_TYPE",
  MISSING_REQUIRED: "MISSING_REQUIRED",
  INVALID_VALUE: "INVALID_VALUE",

  // Timeline errors
  INVALID_RANGE: "INVALID_RANGE",
  INVALID_TIMELINE: "INVALID_TIMELINE",
  TIMELINE_GAP: "TIMELINE_GAP",

  // File errors
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Word timing errors
  INVALID_WORD_TIMING: "INVALID_WORD_TIMING",
  OUTSIDE_BOUNDS: "OUTSIDE_BOUNDS",
};

/**
 * Create a structured validation issue
 */
function createIssue(code, path, message, received = undefined) {
  const issue = { code, path, message };
  if (received !== undefined) {
    issue.received = received;
  }
  return issue;
}

/**
 * Validate a single clip and return issues
 */
function validateClip(clip, index, options = {}) {
  const { skipFileChecks = false } = options;
  const errors = [];
  const warnings = [];
  const path = `clips[${index}]`;

  // Valid clip types
  const validTypes = [
    "video",
    "audio",
    "text",
    "music",
    "backgroundAudio",
    "image",
    "subtitle",
  ];

  // Check type
  if (!clip.type) {
    errors.push(
      createIssue(
        ValidationCodes.MISSING_REQUIRED,
        `${path}.type`,
        "Clip type is required",
        undefined
      )
    );
    return { errors, warnings }; // Can't validate further without type
  }

  if (!validTypes.includes(clip.type)) {
    errors.push(
      createIssue(
        ValidationCodes.INVALID_TYPE,
        `${path}.type`,
        `Invalid clip type '${clip.type}'. Expected: ${validTypes.join(", ")}`,
        clip.type
      )
    );
    return { errors, warnings }; // Can't validate further with invalid type
  }

  // Validate duration field if present (applies to all clip types)
  if (clip.duration != null) {
    if (typeof clip.duration !== "number") {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.duration`,
          "Duration must be a number",
          clip.duration
        )
      );
    } else if (!Number.isFinite(clip.duration)) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.duration`,
          "Duration must be a finite number (not NaN or Infinity)",
          clip.duration
        )
      );
    } else if (clip.duration <= 0) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_RANGE,
          `${path}.duration`,
          "Duration must be greater than 0",
          clip.duration
        )
      );
    }
    // Conflict check: duration + end both set
    if (clip.end != null) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}`,
          "Cannot specify both 'duration' and 'end'. Use one or the other.",
          { duration: clip.duration, end: clip.end }
        )
      );
    }
  }

  // Types that require position/end on timeline
  const requiresTimeline = ["video", "audio", "text", "image"].includes(
    clip.type
  );

  if (requiresTimeline) {
    if (typeof clip.position !== "number") {
      errors.push(
        createIssue(
          ValidationCodes.MISSING_REQUIRED,
          `${path}.position`,
          "Position is required for this clip type",
          clip.position
        )
      );
    } else if (!Number.isFinite(clip.position)) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.position`,
          "Position must be a finite number (not NaN or Infinity)",
          clip.position
        )
      );
    } else if (clip.position < 0) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_RANGE,
          `${path}.position`,
          "Position must be >= 0",
          clip.position
        )
      );
    }

    if (typeof clip.end !== "number") {
      errors.push(
        createIssue(
          ValidationCodes.MISSING_REQUIRED,
          `${path}.end`,
          "End time is required for this clip type",
          clip.end
        )
      );
    } else if (!Number.isFinite(clip.end)) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.end`,
          "End time must be a finite number (not NaN or Infinity)",
          clip.end
        )
      );
    } else if (Number.isFinite(clip.position) && clip.end <= clip.position) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_TIMELINE,
          `${path}.end`,
          `End time (${clip.end}) must be greater than position (${clip.position})`,
          clip.end
        )
      );
    }
  } else {
    // music/backgroundAudio/subtitle: position/end are optional
    if (typeof clip.position === "number") {
      if (!Number.isFinite(clip.position)) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}.position`,
            "Position must be a finite number (not NaN or Infinity)",
            clip.position
          )
        );
      } else if (clip.position < 0) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_RANGE,
            `${path}.position`,
            "Position must be >= 0",
            clip.position
          )
        );
      }
    }
    if (typeof clip.end === "number") {
      if (!Number.isFinite(clip.end)) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}.end`,
            "End time must be a finite number (not NaN or Infinity)",
            clip.end
          )
        );
      } else if (
        typeof clip.position === "number" &&
        Number.isFinite(clip.position) &&
        clip.end <= clip.position
      ) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_TIMELINE,
            `${path}.end`,
            `End time (${clip.end}) must be greater than position (${clip.position})`,
            clip.end
          )
        );
      }
    }
  }

  // Media clips require URL
  const mediaTypes = ["video", "audio", "music", "backgroundAudio", "image"];
  if (mediaTypes.includes(clip.type)) {
    if (typeof clip.url !== "string" || clip.url.length === 0) {
      errors.push(
        createIssue(
          ValidationCodes.MISSING_REQUIRED,
          `${path}.url`,
          "URL is required for media clips",
          clip.url
        )
      );
    } else if (!skipFileChecks) {
      try {
        if (!fs.existsSync(clip.url)) {
          warnings.push(
            createIssue(
              ValidationCodes.FILE_NOT_FOUND,
              `${path}.url`,
              `File not found: '${clip.url}'`,
              clip.url
            )
          );
        }
      } catch (_) {}
    }

    if (typeof clip.cutFrom === "number") {
      if (!Number.isFinite(clip.cutFrom)) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}.cutFrom`,
            "cutFrom must be a finite number (not NaN or Infinity)",
            clip.cutFrom
          )
        );
      } else if (clip.cutFrom < 0) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_RANGE,
            `${path}.cutFrom`,
            "cutFrom must be >= 0",
            clip.cutFrom
          )
        );
      }
    }

    // Audio volume validation
    const audioTypes = ["audio", "music", "backgroundAudio"];
    if (audioTypes.includes(clip.type)) {
      if (typeof clip.volume === "number") {
        if (!Number.isFinite(clip.volume)) {
          errors.push(
            createIssue(
              ValidationCodes.INVALID_VALUE,
              `${path}.volume`,
              "Volume must be a finite number (not NaN or Infinity)",
              clip.volume
            )
          );
        } else if (clip.volume < 0) {
          errors.push(
            createIssue(
              ValidationCodes.INVALID_RANGE,
              `${path}.volume`,
              "Volume must be >= 0",
              clip.volume
            )
          );
        }
      }
    }
  }

  // Text clip validation
  if (clip.type === "text") {
    // Validate words array
    if (Array.isArray(clip.words)) {
      clip.words.forEach((w, wi) => {
        const wordPath = `${path}.words[${wi}]`;

        if (typeof w.text !== "string") {
          errors.push(
            createIssue(
              ValidationCodes.MISSING_REQUIRED,
              `${wordPath}.text`,
              "Word text is required",
              w.text
            )
          );
        }

        if (typeof w.start !== "number") {
          errors.push(
            createIssue(
              ValidationCodes.MISSING_REQUIRED,
              `${wordPath}.start`,
              "Word start time is required",
              w.start
            )
          );
        } else if (!Number.isFinite(w.start)) {
          errors.push(
            createIssue(
              ValidationCodes.INVALID_VALUE,
              `${wordPath}.start`,
              "Word start time must be a finite number (not NaN or Infinity)",
              w.start
            )
          );
        }

        if (typeof w.end !== "number") {
          errors.push(
            createIssue(
              ValidationCodes.MISSING_REQUIRED,
              `${wordPath}.end`,
              "Word end time is required",
              w.end
            )
          );
        } else if (!Number.isFinite(w.end)) {
          errors.push(
            createIssue(
              ValidationCodes.INVALID_VALUE,
              `${wordPath}.end`,
              "Word end time must be a finite number (not NaN or Infinity)",
              w.end
            )
          );
        }

        if (
          Number.isFinite(w.start) &&
          Number.isFinite(w.end) &&
          w.end <= w.start
        ) {
          errors.push(
            createIssue(
              ValidationCodes.INVALID_WORD_TIMING,
              `${wordPath}.end`,
              `Word end (${w.end}) must be greater than start (${w.start})`,
              w.end
            )
          );
        }

        // Check if word is within clip bounds
        if (
          typeof w.start === "number" &&
          typeof w.end === "number" &&
          typeof clip.position === "number" &&
          typeof clip.end === "number"
        ) {
          if (w.start < clip.position || w.end > clip.end) {
            warnings.push(
              createIssue(
                ValidationCodes.OUTSIDE_BOUNDS,
                wordPath,
                `Word timing [${w.start}, ${w.end}] outside clip bounds [${clip.position}, ${clip.end}]`,
                { start: w.start, end: w.end }
              )
            );
          }
        }
      });
    }

    // Validate wordTimestamps
    if (Array.isArray(clip.wordTimestamps)) {
      const ts = clip.wordTimestamps;
      for (let i = 1; i < ts.length; i++) {
        if (typeof ts[i] !== "number" || typeof ts[i - 1] !== "number") {
          warnings.push(
            createIssue(
              ValidationCodes.INVALID_VALUE,
              `${path}.wordTimestamps[${i}]`,
              "Word timestamps must be numbers",
              ts[i]
            )
          );
          break;
        }
        if (ts[i] < ts[i - 1]) {
          warnings.push(
            createIssue(
              ValidationCodes.INVALID_WORD_TIMING,
              `${path}.wordTimestamps[${i}]`,
              `Timestamps must be non-decreasing (${ts[i - 1]} -> ${ts[i]})`,
              ts[i]
            )
          );
          break;
        }
      }
    }

    // Validate fontFile
    if (clip.fontFile && !skipFileChecks) {
      try {
        if (!fs.existsSync(clip.fontFile)) {
          warnings.push(
            createIssue(
              ValidationCodes.FILE_NOT_FOUND,
              `${path}.fontFile`,
              `Font file not found: '${clip.fontFile}'. Will fall back to fontFamily.`,
              clip.fontFile
            )
          );
        }
      } catch (_) {}
    }

    // Warn about multiline text in non-karaoke modes (will be flattened to single line)
    if (
      clip.text &&
      clip.mode !== "karaoke" &&
      (clip.text.includes("\n") || clip.text.includes("\r"))
    ) {
      warnings.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.text`,
          "Multiline text is only supported in karaoke mode. Newlines will be replaced with spaces.",
          clip.text
        )
      );
    }

    // Validate text mode
    const validModes = ["static", "word-replace", "word-sequential", "karaoke"];
    if (clip.mode && !validModes.includes(clip.mode)) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.mode`,
          `Invalid mode '${clip.mode}'. Expected: ${validModes.join(", ")}`,
          clip.mode
        )
      );
    }

    // Validate karaoke-specific options
    if (clip.mode === "karaoke") {
      const validStyles = ["smooth", "instant"];
      if (clip.highlightStyle && !validStyles.includes(clip.highlightStyle)) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}.highlightStyle`,
            `Invalid highlightStyle '${
              clip.highlightStyle
            }'. Expected: ${validStyles.join(", ")}`,
            clip.highlightStyle
          )
        );
      }
    }

    // Validate animation
    if (clip.animation) {
      const validAnimations = [
        "none",
        "fade-in",
        "fade-out",
        "fade-in-out",
        "pop",
        "pop-bounce",
        "typewriter",
        "scale-in",
        "pulse",
      ];
      if (
        clip.animation.type &&
        !validAnimations.includes(clip.animation.type)
      ) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}.animation.type`,
            `Invalid animation type '${
              clip.animation.type
            }'. Expected: ${validAnimations.join(", ")}`,
            clip.animation.type
          )
        );
      }
    }
  }

  // Subtitle clip validation
  if (clip.type === "subtitle") {
    if (typeof clip.url !== "string" || clip.url.length === 0) {
      errors.push(
        createIssue(
          ValidationCodes.MISSING_REQUIRED,
          `${path}.url`,
          "URL is required for subtitle clips",
          clip.url
        )
      );
    } else {
      // Check file extension
      const ext = clip.url.split(".").pop().toLowerCase();
      const validExts = ["srt", "vtt", "ass", "ssa"];
      if (!validExts.includes(ext)) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_FORMAT,
            `${path}.url`,
            `Unsupported subtitle format '.${ext}'. Expected: ${validExts
              .map((e) => "." + e)
              .join(", ")}`,
            clip.url
          )
        );
      }

      // File existence check
      if (!skipFileChecks) {
        try {
          if (!fs.existsSync(clip.url)) {
            warnings.push(
              createIssue(
                ValidationCodes.FILE_NOT_FOUND,
                `${path}.url`,
                `Subtitle file not found: '${clip.url}'`,
                clip.url
              )
            );
          }
        } catch (_) {}
      }
    }

    // Position offset validation
    if (typeof clip.position === "number" && clip.position < 0) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_RANGE,
          `${path}.position`,
          "Subtitle position offset must be >= 0",
          clip.position
        )
      );
    }
  }

  // Image clip validation
  if (clip.type === "image") {
    if (clip.kenBurns) {
      const validKenBurns = [
        "zoom-in",
        "zoom-out",
        "pan-left",
        "pan-right",
        "pan-up",
        "pan-down",
        "smart",
        "custom",
      ];
      const kbType =
        typeof clip.kenBurns === "string" ? clip.kenBurns : clip.kenBurns.type;
      if (kbType && !validKenBurns.includes(kbType)) {
        errors.push(
          createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}.kenBurns`,
            `Invalid kenBurns effect '${kbType}'. Expected: ${validKenBurns.join(
              ", "
            )}`,
            kbType
          )
        );
      }

      if (typeof clip.kenBurns === "object") {
        const {
          anchor,
          easing,
          startZoom,
          endZoom,
          startX,
          startY,
          endX,
          endY,
        } =
          clip.kenBurns;
        if (anchor !== undefined) {
          const validAnchors = ["top", "bottom", "left", "right"];
          if (!validAnchors.includes(anchor)) {
            errors.push(
              createIssue(
                ValidationCodes.INVALID_VALUE,
                `${path}.kenBurns.anchor`,
                `Invalid kenBurns anchor '${anchor}'. Expected: ${validAnchors.join(
                  ", "
                )}`,
                anchor
              )
            );
          }
        }

        if (easing !== undefined) {
          const validEasing = ["linear", "ease-in", "ease-out", "ease-in-out"];
          if (!validEasing.includes(easing)) {
            errors.push(
              createIssue(
                ValidationCodes.INVALID_VALUE,
                `${path}.kenBurns.easing`,
                `Invalid kenBurns easing '${easing}'. Expected: ${validEasing.join(
                  ", "
                )}`,
                easing
              )
            );
          }
        }

        const numericFields = [
          ["startZoom", startZoom],
          ["endZoom", endZoom],
          ["startX", startX],
          ["startY", startY],
          ["endX", endX],
          ["endY", endY],
        ];

        numericFields.forEach(([field, value]) => {
          if (value === undefined) {
            return;
          }
          if (typeof value !== "number" || !Number.isFinite(value)) {
            errors.push(
              createIssue(
                ValidationCodes.INVALID_TYPE,
                `${path}.kenBurns.${field}`,
                `kenBurns.${field} must be a finite number`,
                value
              )
            );
            return;
          }

          if ((field === "startZoom" || field === "endZoom") && value <= 0) {
            errors.push(
              createIssue(
                ValidationCodes.INVALID_RANGE,
                `${path}.kenBurns.${field}`,
                `kenBurns.${field} must be > 0`,
                value
              )
            );
          }

          if (
            (field === "startX" ||
              field === "startY" ||
              field === "endX" ||
              field === "endY") &&
            (value < 0 || value > 1)
          ) {
            errors.push(
              createIssue(
                ValidationCodes.INVALID_RANGE,
                `${path}.kenBurns.${field}`,
                `kenBurns.${field} must be between 0 and 1`,
                value
              )
            );
          }
        });
      }

      // Check if image dimensions are provided and sufficient for project dimensions
      // By default, undersized images are upscaled automatically (with a warning)
      // Set strictKenBurns: true to make this an error instead
      const projectWidth = options.width || 1920;
      const projectHeight = options.height || 1080;
      const strictKenBurns = options.strictKenBurns === true;

      if (clip.width && clip.height) {
        // If we know the image dimensions, check if they're large enough
        if (clip.width < projectWidth || clip.height < projectHeight) {
          const issue = createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}`,
            strictKenBurns
              ? `Image dimensions (${clip.width}x${clip.height}) are smaller than project dimensions (${projectWidth}x${projectHeight}). Ken Burns effects require images at least as large as the output.`
              : `Image (${clip.width}x${clip.height}) will be upscaled to ${projectWidth}x${projectHeight} for Ken Burns effect. Quality may be reduced.`,
            { width: clip.width, height: clip.height }
          );

          if (strictKenBurns) {
            errors.push(issue);
          } else {
            warnings.push(issue);
          }
        }
      } else if (!skipFileChecks && clip.url) {
        // We could check file dimensions here, but that's expensive
        // Instead, add a warning that dimensions should be verified
        warnings.push(
          createIssue(
            ValidationCodes.INVALID_VALUE,
            `${path}`,
            `Ken Burns effect on image - ensure source image is at least ${projectWidth}x${projectHeight}px for best quality (smaller images will be upscaled).`,
            clip.url
          )
        );
      }
    }
  }

  // Video transition validation
  if (clip.type === "video" && clip.transition) {
    if (typeof clip.transition.duration !== "number") {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.transition.duration`,
          "Transition duration must be a number",
          clip.transition.duration
        )
      );
    } else if (!Number.isFinite(clip.transition.duration)) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.transition.duration`,
          "Transition duration must be a finite number (not NaN or Infinity)",
          clip.transition.duration
        )
      );
    } else if (clip.transition.duration <= 0) {
      errors.push(
        createIssue(
          ValidationCodes.INVALID_VALUE,
          `${path}.transition.duration`,
          "Transition duration must be a positive number",
          clip.transition.duration
        )
      );
    }
  }

  return { errors, warnings };
}

/**
 * Validate timeline gaps (visual continuity)
 */
function validateTimelineGaps(clips, options = {}) {
  const { fillGaps = "none" } = options;
  const errors = [];

  // Skip gap checking if fillGaps is enabled
  if (fillGaps !== "none") {
    return { errors, warnings: [] };
  }

  // Get visual clips (video and image)
  const visual = clips
    .map((c, i) => ({ clip: c, index: i }))
    .filter(({ clip }) => clip.type === "video" || clip.type === "image")
    .filter(
      ({ clip }) =>
        typeof clip.position === "number" && typeof clip.end === "number"
    )
    .sort((a, b) => a.clip.position - b.clip.position);

  if (visual.length === 0) {
    return { errors, warnings: [] };
  }

  const eps = 1e-3;

  // Check for leading gap
  if (visual[0].clip.position > eps) {
    errors.push(
      createIssue(
        ValidationCodes.TIMELINE_GAP,
        "timeline",
        `Gap at start of timeline [0, ${visual[0].clip.position.toFixed(
          3
        )}s] - no video/image content. Use fillGaps: 'black' to auto-fill.`,
        { start: 0, end: visual[0].clip.position }
      )
    );
  }

  // Check for gaps between clips
  for (let i = 1; i < visual.length; i++) {
    const prev = visual[i - 1].clip;
    const curr = visual[i].clip;
    const gapStart = prev.end;
    const gapEnd = curr.position;

    if (gapEnd - gapStart > eps) {
      errors.push(
        createIssue(
          ValidationCodes.TIMELINE_GAP,
          "timeline",
          `Gap in timeline [${gapStart.toFixed(3)}s, ${gapEnd.toFixed(
            3
          )}s] between clips[${visual[i - 1].index}] and clips[${
            visual[i].index
          }]. Use fillGaps: 'black' to auto-fill.`,
          { start: gapStart, end: gapEnd }
        )
      );
    }
  }

  return { errors, warnings: [] };
}

/**
 * Main validation function - validates clips and returns structured result
 *
 * @param {Array} clips - Array of clip objects to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.skipFileChecks - Skip file existence checks (useful for AI validation)
 * @param {string} options.fillGaps - Gap handling mode ('none' | 'black')
 * @returns {Object} Validation result { valid, errors, warnings }
 */
function validateConfig(clips, options = {}) {
  const allErrors = [];
  const allWarnings = [];

  // Check that clips is an array
  if (!Array.isArray(clips)) {
    allErrors.push(
      createIssue(
        ValidationCodes.INVALID_TYPE,
        "clips",
        "Clips must be an array",
        typeof clips
      )
    );
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }

  // Check that clips is not empty
  if (clips.length === 0) {
    allErrors.push(
      createIssue(
        ValidationCodes.MISSING_REQUIRED,
        "clips",
        "At least one clip is required",
        []
      )
    );
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }

  // Validate each clip
  for (let i = 0; i < clips.length; i++) {
    const { errors, warnings } = validateClip(clips[i], i, options);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  // Validate timeline gaps
  const gapResult = validateTimelineGaps(clips, options);
  allErrors.push(...gapResult.errors);
  allWarnings.push(...gapResult.warnings);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Format validation result as human-readable string (for logging/display)
 */
function formatValidationResult(result) {
  const lines = [];

  if (result.valid) {
    lines.push("✓ Validation passed");
  } else {
    lines.push("✗ Validation failed");
  }

  if (result.errors.length > 0) {
    lines.push(`\nErrors (${result.errors.length}):`);
    result.errors.forEach((e) => {
      lines.push(`  [${e.code}] ${e.path}: ${e.message}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push(`\nWarnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => {
      lines.push(`  [${w.code}] ${w.path}: ${w.message}`);
    });
  }

  return lines.join("\n");
}

module.exports = {
  validateConfig,
  formatValidationResult,
  ValidationCodes,
};
