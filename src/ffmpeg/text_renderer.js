const Strings = require("./strings");
const C = require("../core/constants");

function buildXParam(baseClip, canvasWidth) {
  if (typeof baseClip.xPercent === "number") {
    // xPercent is a percentage (0-1) where 0.5 = centered
    // Convert to pixel position: xPercent * canvasWidth - text_w/2
    const xPos = baseClip.xPercent * canvasWidth;
    return `:x=${xPos}-text_w/2`;
  } else if (typeof baseClip.x === "number") {
    return `:x=${baseClip.x}`;
  }
  return `:x=(${canvasWidth} - text_w)/2`;
}

function baseYExpression(baseClip, canvasHeight) {
  if (typeof baseClip.yPercent === "number") {
    // yPercent is a percentage (0-1) where 0.5 = centered
    // Convert to pixel position: yPercent * canvasHeight - text_h/2
    const yPos = baseClip.yPercent * canvasHeight;
    return `${yPos}-text_h/2`;
  } else if (typeof baseClip.y === "number") {
    return `${baseClip.y}`;
  }
  return `(${canvasHeight} - text_h)/2`;
}

function buildYParamAnimated(baseClip, canvasHeight, start, end) {
  const baseY = baseYExpression(baseClip, canvasHeight);
  return `:y=${baseY}`;
}

function buildAlphaParam(baseClip, start, end) {
  const anim = baseClip.animation || {};
  const type = anim.type || "none";
  if (type === "fade-in") {
    const entry =
      typeof anim.in === "number" ? anim.in : C.DEFAULT_TEXT_ANIM_IN;
    return `:alpha=if(lt(t\\,${start})\\,0\\,if(lt(t\\,${
      start + entry
    })\\,(t-${start})/${entry}\\,1))`;
  }
  if (type === "fade-in-out" || type === "fade") {
    const entry =
      typeof anim.in === "number" ? anim.in : C.DEFAULT_TEXT_ANIM_IN;
    const exit = typeof anim.out === "number" ? anim.out : entry;
    const fadeOutStart = Math.max(start, end - exit);
    return `:alpha=if(lt(t\\,${start})\\,0\\,if(lt(t\\,${
      start + entry
    })\\,(t-${start})/${entry}\\,if(lt(t\\,${fadeOutStart})\\,1\\,if(lt(t\\,${end})\\,((${end}-t)/${exit})\\,0))))`;
  }
  return "";
}

function buildFontsizeParam(baseClip, start) {
  const anim = baseClip.animation || {};
  const type = anim.type || "none";
  const baseSize = baseClip.fontSize;
  if (type === "pop") {
    const entry =
      typeof anim.in === "number" ? anim.in : C.DEFAULT_TEXT_ANIM_IN;
    return `:fontsize=if(lt(t\\,${start + entry})\\,${(baseSize * 0.7).toFixed(
      3
    )}+${(baseSize * 0.3).toFixed(
      3
    )}*sin(PI/2*(t-${start})/${entry})\\,${baseSize})`;
  }
  if (type === "pop-bounce") {
    const entry =
      typeof anim.in === "number" ? anim.in : C.DEFAULT_TEXT_ANIM_IN;
    return `:fontsize=if(lt(t\\,${start + entry})\\,${(baseSize * 0.7).toFixed(
      3
    )}+${(baseSize * 0.4).toFixed(
      3
    )}*sin(PI/2*(t-${start})/${entry})\\,${baseSize})`;
  }
  return `:fontsize=${baseSize}`;
}

function buildDrawtextParams(
  baseClip,
  text,
  canvasWidth,
  canvasHeight,
  start,
  end
) {
  const fontSpec = baseClip.fontFile
    ? `fontfile=${baseClip.fontFile}`
    : baseClip.fontFamily
    ? `font=${baseClip.fontFamily}`
    : `font=Sans`;

  const escaped = Strings.escapeDrawtextText(text);
  let params = `drawtext=text='${escaped}':${fontSpec}`;
  params += buildFontsizeParam(baseClip, start);
  params += `:fontcolor=${baseClip.fontColor}`;
  params += buildXParam(baseClip, canvasWidth);
  params += buildYParamAnimated(baseClip, canvasHeight, start, end);
  params += buildAlphaParam(baseClip, start, end);

  if (baseClip.borderColor) params += `:bordercolor=${baseClip.borderColor}`;
  if (baseClip.borderWidth) params += `:borderw=${baseClip.borderWidth}`;
  if (baseClip.shadowColor) params += `:shadowcolor=${baseClip.shadowColor}`;
  if (baseClip.shadowX) params += `:shadowx=${baseClip.shadowX}`;
  if (baseClip.shadowY) params += `:shadowy=${baseClip.shadowY}`;
  if (baseClip.backgroundColor) {
    params += `:box=1:boxcolor=${baseClip.backgroundColor}`;
    if (baseClip.backgroundOpacity) params += `@${baseClip.backgroundOpacity}`;
  }
  if (baseClip.padding) params += `:boxborderw=${baseClip.padding}`;

  return params;
}

function computeWordWindows(clip, words) {
  const windows = [];
  const startBase = clip.position;
  const endBase = clip.end;

  if (Array.isArray(clip.words) && clip.words.length > 0) {
    clip.words.forEach((w) => {
      if (
        typeof w.start === "number" &&
        typeof w.end === "number" &&
        typeof w.text === "string"
      ) {
        const start = Math.max(startBase, w.start);
        const end = Math.min(endBase, w.end);
        if (end > start) windows.push({ start, end, text: w.text });
      }
    });
    return windows;
  }

  const timestamps = Array.isArray(clip.wordTimestamps)
    ? clip.wordTimestamps.slice()
    : [];
  if (timestamps.length > 0) {
    const ts = timestamps
      .map((t) => Math.min(endBase, Math.max(startBase, t)))
      .filter((t) => typeof t === "number")
      .sort((a, b) => a - b);

    if (ts.length === words.length + 1) {
      for (let i = 0; i < words.length; i++) {
        const start = ts[i];
        const end = ts[i + 1];
        if (end > start) windows.push({ start, end, text: words[i] });
      }
      return windows;
    }

    if (ts.length === words.length) {
      for (let i = 0; i < words.length; i++) {
        const start = ts[i];
        const end = i + 1 < ts.length ? ts[i + 1] : endBase;
        if (end > start) windows.push({ start, end, text: words[i] });
      }
      return windows;
    }
  }

  const total = Math.max(0, endBase - startBase);
  if (words.length === 0 || total <= 0) return windows;
  if (words.length === 1) {
    windows.push({ start: startBase, end: endBase, text: words[0] });
    return windows;
  }

  const step = total / words.length;
  for (let i = 0; i < words.length; i++) {
    const start = startBase + i * step;
    const end = i === words.length - 1 ? endBase : startBase + (i + 1) * step;
    windows.push({ start, end, text: words[i] });
  }
  return windows;
}

function buildTextFilters(
  textClips,
  canvasWidth,
  canvasHeight,
  initialVideoLabel
) {
  let filterString = "";
  let currentLabel = initialVideoLabel;
  let labelIndex = 0;
  const nextLabel = () => {
    const label = `[vtext${labelIndex}]`;
    labelIndex += 1;
    return label;
  };

  for (const clip of textClips) {
    const mode = clip.mode || "static";
    if (mode === "static") {
      const params = buildDrawtextParams(
        clip,
        clip.text,
        canvasWidth,
        canvasHeight,
        clip.position,
        clip.end
      );
      const enable = `:enable='between(t,${clip.position},${clip.end})'`;
      const outLabel = nextLabel();
      filterString += `${currentLabel}${params}${enable}${outLabel};`;
      currentLabel = outLabel;
      continue;
    }
    const splitWords = (clip.text || "").split(/\s+/).filter(Boolean);
    const sourceWords =
      Array.isArray(clip.words) && clip.words.length > 0
        ? clip.words.map((w) => w.text)
        : splitWords;
    const windows = computeWordWindows(clip, sourceWords);

    if (mode === "word-replace") {
      for (const w of windows) {
        const params = buildDrawtextParams(
          clip,
          w.text,
          canvasWidth,
          canvasHeight,
          w.start,
          w.end
        );
        const enable = `:enable='between(t,${w.start},${w.end})'`;
        const outLabel = nextLabel();
        filterString += `${currentLabel}${params}${enable}${outLabel};`;
        currentLabel = outLabel;
      }
      continue;
    }

    if (mode === "word-sequential") {
      for (let i = 0; i < windows.length; i++) {
        const visible = sourceWords.slice(0, i + 1).join(" ");
        const w = windows[i];
        const params = buildDrawtextParams(
          clip,
          visible,
          canvasWidth,
          canvasHeight,
          w.start,
          w.end
        );
        const enable = `:enable='between(t,${w.start},${w.end})'`;
        const outLabel = nextLabel();
        filterString += `${currentLabel}${params}${enable}${outLabel};`;
        currentLabel = outLabel;
      }
      continue;
    }

    // Unknown mode -> static fallback
    const params = buildDrawtextParams(
      clip,
      clip.text,
      canvasWidth,
      canvasHeight,
      clip.position,
      clip.end
    );
    const enable = `:enable='between(t,${clip.position},${clip.end})'`;
    const outLabel = nextLabel();
    filterString += `${currentLabel}${params}${enable}${outLabel};`;
    currentLabel = outLabel;
  }

  if (currentLabel !== initialVideoLabel) {
    filterString += `${currentLabel}null[outVideoAndText];`;
    currentLabel = "[outVideoAndText]";
  }
  return { filterString, finalVideoLabel: currentLabel };
}

function expandTextWindows(textClips) {
  const ops = [];
  for (const clip of textClips) {
    const effectiveClip = { ...clip };
    const mode = effectiveClip.mode || "static";
    if (mode === "static") {
      ops.push({
        text: effectiveClip.text || "",
        start: effectiveClip.position,
        end: effectiveClip.end,
        clip: effectiveClip,
      });
      continue;
    }
    const splitWords = (effectiveClip.text || "").split(/\s+/).filter(Boolean);
    const sourceWords =
      Array.isArray(effectiveClip.words) && effectiveClip.words.length > 0
        ? effectiveClip.words.map((w) => w.text)
        : splitWords;
    const windows = computeWordWindows(effectiveClip, sourceWords);

    if (mode === "word-replace") {
      for (const w of windows)
        ops.push({
          text: w.text,
          start: w.start,
          end: w.end,
          clip: effectiveClip,
        });
      continue;
    }
    if (mode === "word-sequential") {
      for (let i = 0; i < windows.length; i++) {
        const visible = sourceWords.slice(0, i + 1).join(" ");
        const w = windows[i];
        ops.push({
          text: visible,
          start: w.start,
          end: w.end,
          clip: effectiveClip,
        });
      }
      continue;
    }
  }
  return ops;
}

function buildFiltersForWindows(
  windows,
  canvasWidth,
  canvasHeight,
  initialVideoLabel
) {
  let filterString = "";
  let currentLabel = initialVideoLabel;
  let labelIndex = 0;
  const nextLabel = () => {
    const label = `[vtextb${labelIndex}]`;
    labelIndex += 1;
    return label;
  };

  for (const win of windows) {
    const params = buildDrawtextParams(
      win.clip,
      win.text,
      canvasWidth,
      canvasHeight,
      win.start,
      win.end
    );
    const enable = `:enable='between(t,${win.start},${win.end})'`;
    const outLabel = nextLabel();
    filterString += `${currentLabel}${params}${enable}${outLabel};`;
    currentLabel = outLabel;
  }

  if (currentLabel !== initialVideoLabel) {
    filterString += `${currentLabel}null[outVideoAndText];`;
    currentLabel = "[outVideoAndText]";
  }

  return { filterString, finalVideoLabel: currentLabel };
}

module.exports = {
  buildTextFilters,
  expandTextWindows,
  buildFiltersForWindows,
};
