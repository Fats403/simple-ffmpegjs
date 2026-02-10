function formatNumber(value, decimals = 6) {
  return Number(value.toFixed(decimals)).toString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildProcessedEffectFilter(effectClip, inputLabel, outputLabel) {
  const params = effectClip.params || {};
  const amount = clamp(
    typeof params.amount === "number" ? params.amount : 1,
    0,
    1
  );

  if (effectClip.effect === "vignette") {
    const angle =
      typeof params.angle === "number" ? params.angle : Math.PI / 5;
    return {
      filter: `${inputLabel}vignette=angle=${formatNumber(angle)}:eval=frame${outputLabel};`,
      amount,
    };
  }

  if (effectClip.effect === "filmGrain") {
    const grainStrength = clamp(
      (typeof params.amount === "number" ? params.amount : 0.35) * 100,
      0,
      100
    );
    const flags = params.temporal === false ? "u" : "t+u";
    return {
      filter: `${inputLabel}noise=alls=${formatNumber(
        grainStrength,
        3
      )}:allf=${flags}${outputLabel};`,
      amount,
    };
  }

  if (effectClip.effect === "gaussianBlur") {
    const sigma = clamp(
      typeof params.sigma === "number"
        ? params.sigma
        : (typeof params.amount === "number" ? params.amount : 0.5) * 20,
      0,
      100
    );
    return {
      filter: `${inputLabel}gblur=sigma=${formatNumber(sigma, 4)}${outputLabel};`,
      amount,
    };
  }

  // colorAdjust
  const brightness =
    typeof params.brightness === "number" ? params.brightness : 0;
  const contrast = typeof params.contrast === "number" ? params.contrast : 1;
  const saturation =
    typeof params.saturation === "number" ? params.saturation : 1;
  const gamma = typeof params.gamma === "number" ? params.gamma : 1;

  return {
    filter:
      `${inputLabel}eq=` +
      `brightness=${formatNumber(brightness, 4)}:` +
      `contrast=${formatNumber(contrast, 4)}:` +
      `saturation=${formatNumber(saturation, 4)}:` +
      `gamma=${formatNumber(gamma, 4)}` +
      `${outputLabel};`,
    amount,
  };
}

function buildEffectFilters(effectClips, inputLabel) {
  if (!Array.isArray(effectClips) || effectClips.length === 0) {
    return { filter: "", finalVideoLabel: inputLabel };
  }

  const ordered = [...effectClips]
    .filter((c) => typeof c.position === "number" && typeof c.end === "number")
    .sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.end - b.end;
    });

  if (ordered.length === 0) {
    return { filter: "", finalVideoLabel: inputLabel };
  }

  let filter = "";
  let currentLabel = inputLabel;

  ordered.forEach((clip, i) => {
    const baseLabel = `[fxbase${i}]`;
    const procSrcLabel = `[fxsrc${i}]`;
    const fxLabel = `[fxraw${i}]`;
    const fxAlphaLabel = `[fxa${i}]`;
    const outLabel = `[fxout${i}]`;

    // Split current frame stream into base + processed branches so compositing
    // is deterministic and frame-aligned across all effects.
    filter += `${currentLabel}split=2${baseLabel}${procSrcLabel};`;

    const { filter: fxFilter, amount } = buildProcessedEffectFilter(
      clip,
      procSrcLabel,
      fxLabel
    );
    filter += fxFilter;

    const start = formatNumber(clip.position || 0, 4);
    const end = formatNumber(clip.end || 0, 4);
    const fadeIn = Math.max(0, clip.fadeIn || 0);
    const fadeOut = Math.max(0, clip.fadeOut || 0);
    const fadeOutStart = Math.max(clip.position || 0, (clip.end || 0) - fadeOut);

    let alphaChain = `format=rgba,colorchannelmixer=aa=${formatNumber(amount, 4)}`;
    if (fadeIn > 0) {
      alphaChain += `,fade=t=in:st=${start}:d=${formatNumber(fadeIn, 4)}:alpha=1`;
    }
    if (fadeOut > 0) {
      alphaChain += `,fade=t=out:st=${formatNumber(
        fadeOutStart,
        4
      )}:d=${formatNumber(fadeOut, 4)}:alpha=1`;
    }

    filter += `${fxLabel}${alphaChain}${fxAlphaLabel};`;
    filter += `${baseLabel}${fxAlphaLabel}overlay=shortest=1:eof_action=pass:enable='between(t,${start},${end})'${outLabel};`;
    currentLabel = outLabel;
  });

  return { filter, finalVideoLabel: currentLabel };
}

module.exports = { buildEffectFilters };
