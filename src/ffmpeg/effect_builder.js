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
    // `strength` controls noise intensity (0-1, default 0.35).
    // `amount` is used purely for overlay blend alpha.
    const strength = clamp(
      typeof params.strength === "number" ? params.strength : 0.35,
      0,
      1
    );
    const grainStrength = strength * 100;
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

  if (effectClip.effect === "colorAdjust") {
    const brightness =
      typeof params.brightness === "number" ? params.brightness : 0;
    const contrast =
      typeof params.contrast === "number" ? params.contrast : 1;
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

  if (effectClip.effect === "sepia") {
    // Classic sepia tone via color channel mixer matrix
    return {
      filter:
        `${inputLabel}colorchannelmixer=` +
        `.393:.769:.189:0:` +
        `.349:.686:.168:0:` +
        `.272:.534:.131:0` +
        `${outputLabel};`,
      amount,
    };
  }

  if (effectClip.effect === "blackAndWhite") {
    const contrast =
      typeof params.contrast === "number" ? params.contrast : 1;
    let chain = `${inputLabel}hue=s=0`;
    if (contrast !== 1) {
      chain += `,eq=contrast=${formatNumber(contrast, 4)}`;
    }
    return {
      filter: `${chain}${outputLabel};`,
      amount,
    };
  }

  if (effectClip.effect === "sharpen") {
    // strength controls the unsharp amount (0-3, default 1.0), 5x5 luma matrix
    const strength = clamp(
      typeof params.strength === "number" ? params.strength : 1.0,
      0,
      3
    );
    return {
      filter: `${inputLabel}unsharp=5:5:${formatNumber(strength, 4)}${outputLabel};`,
      amount,
    };
  }

  if (effectClip.effect === "chromaticAberration") {
    // shift is horizontal pixel offset for red/blue channels (default 4, range 0-20)
    const shift = clamp(
      typeof params.shift === "number" ? params.shift : 4,
      0,
      20
    );
    const shiftInt = Math.round(shift);
    return {
      filter: `${inputLabel}rgbashift=rh=${shiftInt}:bh=${-shiftInt}${outputLabel};`,
      amount,
    };
  }

  if (effectClip.effect === "letterbox") {
    // size is bar height as fraction of frame height (default 0.12, range 0-0.5)
    const size = clamp(
      typeof params.size === "number" ? params.size : 0.12,
      0,
      0.5
    );
    const color = typeof params.color === "string" ? params.color : "black";
    const barExpr = `round(ih*${formatNumber(size, 4)})`;
    return {
      filter:
        `${inputLabel}` +
        `drawbox=y=0:w=iw:h='${barExpr}':color=${color}:t=fill,` +
        `drawbox=y='ih-${barExpr}':w=iw:h='${barExpr}':color=${color}:t=fill` +
        `${outputLabel};`,
      amount,
    };
  }

  // Unknown effect — guard against silent fallthrough
  throw new Error(
    `Unknown effect type '${effectClip.effect}' in buildProcessedEffectFilter`
  );
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
