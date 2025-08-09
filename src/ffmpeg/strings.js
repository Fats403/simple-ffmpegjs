function escapeSingleQuotes(text) {
  return String(text).replace(/'/g, "\\'");
}

function escapeDrawtextText(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

function getClipAudioString(clip, inputIndex) {
  const adelay = Math.round(Math.max(0, (clip.position || 0) * 1000));
  const audioConcatInput = `[a${inputIndex}]`;
  const audioStringPart = `[${inputIndex}:a]volume=${clip.volume},atrim=start=${
    clip.cutFrom
  }:end=${
    clip.cutFrom + (clip.end - clip.position)
  },adelay=${adelay}|${adelay},asetpts=PTS-STARTPTS${audioConcatInput};`;
  return { audioStringPart, audioConcatInput };
}

module.exports = { escapeSingleQuotes, escapeDrawtextText, getClipAudioString };
