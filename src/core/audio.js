const fsPromises = require("fs").promises;
const path = require("path");
const { probeMedia } = require("./media_info");
const { SimpleffmpegError, TranscodeError } = require("./errors");
const { runHardened } = require("./run");

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_THREADS = 2;

/**
 * Audio DSP operations — built for the voiceover-editing cases that go wrong
 * when done naively at the composition layer:
 *
 * - Speeding speech up by resampling shifts its pitch. audioTempo() uses
 *   ffmpeg's atempo (a real time-stretch), so pace changes leave pitch alone.
 * - Cutting a waveform mid-phoneme smears consonants and clicks at the joins.
 *   spliceAudio() applies a micro-fade at every cut by default, and the
 *   silence-aware helpers (trimSilence, capSilences) only ever cut inside
 *   detected silence, where there is nothing to smear.
 * - Takes from different sources play at different loudness.
 *   normalizeLoudness() is a two-pass EBU R128 normalize to a LUFS target.
 *
 * Every operation runs under the same hardening wrapper as transcode():
 * no shell, SIGKILL timeout, AbortSignal, partial-output cleanup on failure.
 */

/** Micro-fade applied at splice cuts to prevent clicks (milliseconds). */
const DEFAULT_FADE_MS = 5;

/** silencedetect defaults tuned for speech: −35 dB floor, 300 ms minimum. */
const DEFAULT_NOISE_DB = -35;
const DEFAULT_MIN_SILENCE_SEC = 0.3;

/** Audio encoder per output extension. Extension picks the container too. */
const CODEC_BY_EXT = {
  ".mp3": ["-c:a", "libmp3lame", "-q:a", "2"],
  ".m4a": ["-c:a", "aac", "-b:a", "192k"],
  ".aac": ["-c:a", "aac", "-b:a", "192k"],
  ".wav": ["-c:a", "pcm_s16le"],
  ".flac": ["-c:a", "flac"],
  ".ogg": ["-c:a", "libvorbis", "-q:a", "5"],
  ".opus": ["-c:a", "libopus", "-b:a", "96k"],
};

/**
 * Encoder args for an output path, chosen by extension. Pure.
 * Throws SimpleffmpegError for unsupported extensions.
 */
function audioCodecArgs(outputPath, label) {
  const ext = path.extname(outputPath).toLowerCase();
  const args = CODEC_BY_EXT[ext];
  if (!args) {
    throw new SimpleffmpegError(
      `${label} unsupported output extension "${ext || "none"}" — supported: ${Object.keys(CODEC_BY_EXT).join(", ")}`,
    );
  }
  return [...args];
}

/**
 * Decompose a tempo factor into a chain of atempo filter stages.
 *
 * A single atempo instance accepts [0.5, 2.0]; values outside are reached by
 * chaining (3.2 → 2.0 × 1.6). Overall range is capped at [0.25, 4.0] — two
 * stages — which is far beyond anything speech survives anyway. Pure.
 *
 * @param {number} tempo
 * @returns {string[]} e.g. ["atempo=2", "atempo=1.6"]
 */
function buildAtempoChain(tempo) {
  if (typeof tempo !== "number" || !Number.isFinite(tempo)) {
    throw new SimpleffmpegError("audioTempo() tempo must be a finite number");
  }
  if (tempo < 0.25 || tempo > 4) {
    throw new SimpleffmpegError(
      `audioTempo() tempo must be within [0.25, 4] (got ${tempo})`,
    );
  }
  const stages = [];
  let remaining = tempo;
  while (remaining > 2) {
    stages.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    stages.push(0.5);
    remaining /= 0.5;
  }
  stages.push(+remaining.toFixed(6));
  return stages.map((s) => `atempo=${s}`);
}

/**
 * Parse ffmpeg silencedetect stderr output into intervals. Pure.
 *
 * Lines look like:
 *   [silencedetect @ 0x...] silence_start: 1.234
 *   [silencedetect @ 0x...] silence_end: 2.5 | silence_duration: 1.266
 *
 * A file that ends in silence emits a final silence_start with no matching
 * silence_end; totalDuration (when finite) closes that interval.
 *
 * @param {string} stderr
 * @param {number} [totalDuration]
 * @returns {{start:number,end:number,duration:number}[]}
 */
function parseSilenceDetect(stderr, totalDuration) {
  const intervals = [];
  let openStart = null;
  for (const line of String(stderr).split("\n")) {
    const startMatch = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (startMatch) {
      openStart = Math.max(0, parseFloat(startMatch[1]));
      continue;
    }
    const endMatch = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (endMatch && openStart !== null) {
      const end = parseFloat(endMatch[1]);
      if (Number.isFinite(end) && end > openStart) {
        intervals.push({
          start: openStart,
          end,
          duration: +(end - openStart).toFixed(6),
        });
      }
      openStart = null;
    }
  }
  if (
    openStart !== null &&
    Number.isFinite(totalDuration) &&
    totalDuration > openStart
  ) {
    intervals.push({
      start: openStart,
      end: totalDuration,
      duration: +(totalDuration - openStart).toFixed(6),
    });
  }
  return intervals;
}

/** Channel-count → layout string for filter graphs; >2 downmixes to stereo. */
function layoutForChannels(channels) {
  return channels === 1 ? "mono" : "stereo";
}

/**
 * Build the filter_complex graph for spliceAudio(). Pure.
 *
 * Source segments become atrim branches with a micro-fade on both edges of
 * every cut; silence segments become anullsrc branches. Every branch is
 * forced through aformat so concat never sees mismatched rates or layouts.
 *
 * @returns {{ filter: string, outLabel: string, outputDuration: number }}
 */
function buildSpliceFilter({ segments, sampleRate, channels, fadeMs }) {
  const layout = layoutForChannels(channels);
  const conform = `aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${layout}`;
  const fadeSec = fadeMs / 1000;
  const parts = [];
  const labels = [];
  let outputDuration = 0;

  segments.forEach((seg, i) => {
    const label = `[s${i}]`;
    if (seg.silence != null) {
      parts.push(
        `anullsrc=r=${sampleRate}:cl=${layout},atrim=end=${seg.silence},${conform}${label}`,
      );
      outputDuration += seg.silence;
    } else {
      const dur = seg.end - seg.start;
      // A cut shorter than four fade lengths gets proportionally shorter
      // fades rather than fades that swallow the whole segment.
      const f = Math.min(fadeSec, dur / 4);
      const chain = [
        `[0:a]atrim=start=${seg.start}:end=${seg.end}`,
        "asetpts=PTS-STARTPTS",
      ];
      if (f > 0) {
        chain.push(`afade=t=in:st=0:d=${+f.toFixed(6)}`);
        chain.push(
          `afade=t=out:st=${+(dur - f).toFixed(6)}:d=${+f.toFixed(6)}`,
        );
      }
      chain.push(conform);
      parts.push(`${chain.join(",")}${label}`);
      outputDuration += dur;
    }
    labels.push(label);
  });

  const filter =
    parts.join(";") +
    `;${labels.join("")}concat=n=${segments.length}:v=0:a=1[out]`;
  return { filter, outLabel: "[out]", outputDuration };
}

/** Shared per-operation input validation: paths, probe, audio presence. */
async function prepareAudioOp(inputPath, options, label) {
  if (!inputPath || typeof inputPath !== "string") {
    throw new SimpleffmpegError(`${label} requires inputPath as the first argument`);
  }
  if (!options || typeof options !== "object") {
    throw new SimpleffmpegError(`${label} requires an options object`);
  }

  const resolvedInput = path.resolve(inputPath);
  if (path.basename(resolvedInput).startsWith("-")) {
    throw new TranscodeError(
      `${label} inputPath "${inputPath}" has a basename starting with "-" which is reserved for ffmpeg flags`,
      { code: "INVALID_PATH" },
    );
  }

  try {
    await fsPromises.stat(resolvedInput);
  } catch {
    throw new TranscodeError(
      `${label} input file "${inputPath}" does not exist or is not accessible`,
      { code: "INPUT_MISSING" },
    );
  }

  let info;
  try {
    info = await probeMedia(resolvedInput);
  } catch (err) {
    const msg = err && err.message ? err.message : "";
    if (err?.code === "FFMPEG_NOT_FOUND" || (msg.includes("ENOENT") && /ffprobe|ffmpeg/i.test(msg))) {
      throw new TranscodeError(
        `${label} ffmpeg/ffprobe binary not found in PATH — install ffmpeg (e.g. \`brew install ffmpeg\`)`,
        { code: "FFMPEG_NOT_FOUND" },
      );
    }
    throw new TranscodeError(`${label} could not probe input "${inputPath}": ${msg}`, {
      code: "INPUT_MISSING",
    });
  }

  if (!info.hasAudio) {
    throw new TranscodeError(`${label} input "${inputPath}" has no audio stream`, {
      code: "NO_AUDIO_STREAM",
    });
  }

  return { resolvedInput, info };
}

/** Resolve + validate an output path for a writing operation. */
function prepareOutputPath(options, label) {
  if (!options.outputPath || typeof options.outputPath !== "string") {
    throw new SimpleffmpegError(`${label} requires options.outputPath`);
  }
  const resolved = path.resolve(options.outputPath);
  if (path.basename(resolved).startsWith("-")) {
    throw new TranscodeError(
      `${label} options.outputPath "${options.outputPath}" has a basename starting with "-" which is reserved for ffmpeg flags`,
      { code: "INVALID_PATH" },
    );
  }
  return resolved;
}

/**
 * Change audio speed without changing pitch (ffmpeg atempo time-stretch).
 * See SIMPLEFFMPEG.audioTempo for full option docs.
 */
async function audioTempo(inputPath, options = {}) {
  const label = "audioTempo()";
  const chain = buildAtempoChain(options.tempo);
  const { resolvedInput, info } = await prepareAudioOp(inputPath, options, label);
  const resolvedOutput = prepareOutputPath(options, label);
  const codec = audioCodecArgs(resolvedOutput, label);

  const argv = [
    "-nostdin",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-i",
    resolvedInput,
    "-vn",
    "-af",
    chain.join(","),
    ...codec,
    "-threads",
    String(options.threads ?? DEFAULT_THREADS),
    resolvedOutput,
  ];

  await runHardened({
    argv,
    label,
    outputPath: resolvedOutput,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    onProgress: options.onProgress,
    totalDuration: Number.isFinite(info.duration)
      ? info.duration / options.tempo
      : 0,
  });

  return resolvedOutput;
}

/**
 * Detect silences. Analysis only — writes nothing.
 * See SIMPLEFFMPEG.detectSilence for full option docs.
 */
async function detectSilence(inputPath, options = {}) {
  const label = "detectSilence()";
  const noiseDb = options.noiseDb ?? DEFAULT_NOISE_DB;
  const minDurationSec = options.minDurationSec ?? DEFAULT_MIN_SILENCE_SEC;
  if (typeof noiseDb !== "number" || !Number.isFinite(noiseDb) || noiseDb >= 0) {
    throw new SimpleffmpegError(
      `${label} options.noiseDb must be a negative number of dBFS (e.g. -35)`,
    );
  }
  if (
    typeof minDurationSec !== "number" ||
    !Number.isFinite(minDurationSec) ||
    minDurationSec <= 0
  ) {
    throw new SimpleffmpegError(
      `${label} options.minDurationSec must be a positive number of seconds`,
    );
  }

  const { resolvedInput, info } = await prepareAudioOp(inputPath, options, label);

  // silencedetect reports at loglevel info, so no -loglevel error here; the
  // results themselves arrive on stderr. The raised cap keeps long files
  // from truncating early intervals.
  const argv = [
    "-nostdin",
    "-hide_banner",
    "-i",
    resolvedInput,
    "-vn",
    "-af",
    `silencedetect=n=${noiseDb}dB:d=${minDurationSec}`,
    "-f",
    "null",
    "-",
  ];

  const { stderr } = await runHardened({
    argv,
    label,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    stderrCapBytes: 512 * 1024,
  });

  return parseSilenceDetect(stderr, info.duration ?? undefined);
}

/**
 * Rebuild an audio file from source ranges and inserted silence, with a
 * micro-fade at every cut. See SIMPLEFFMPEG.spliceAudio for full docs.
 */
async function spliceAudio(inputPath, options = {}) {
  const label = "spliceAudio()";
  const { resolvedInput, info } = await prepareAudioOp(inputPath, options, label);
  const resolvedOutput = prepareOutputPath(options, label);
  const codec = audioCodecArgs(resolvedOutput, label);

  const segments = options.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new SimpleffmpegError(
      `${label} requires options.segments — a non-empty array of {start,end} and {silence} entries`,
    );
  }
  const duration = Number.isFinite(info.duration) ? info.duration : Infinity;
  let sourceCount = 0;
  const normalized = segments.map((seg, i) => {
    if (seg == null || typeof seg !== "object") {
      throw new SimpleffmpegError(`${label} segments[${i}] must be an object`);
    }
    if (seg.silence != null) {
      if (
        typeof seg.silence !== "number" ||
        !Number.isFinite(seg.silence) ||
        seg.silence <= 0
      ) {
        throw new SimpleffmpegError(
          `${label} segments[${i}].silence must be a positive number of seconds`,
        );
      }
      return { silence: seg.silence };
    }
    const { start, end } = seg;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start
    ) {
      throw new SimpleffmpegError(
        `${label} segments[${i}] must have numbers 0 <= start < end (got start=${start}, end=${end})`,
      );
    }
    if (start >= duration) {
      throw new SimpleffmpegError(
        `${label} segments[${i}].start (${start}s) is beyond the input duration (${info.duration}s)`,
      );
    }
    sourceCount += 1;
    return { start, end: Math.min(end, duration) };
  });
  if (sourceCount === 0) {
    throw new SimpleffmpegError(
      `${label} requires at least one {start,end} source segment`,
    );
  }
  const fadeMs = options.fadeMs ?? DEFAULT_FADE_MS;
  if (typeof fadeMs !== "number" || !Number.isFinite(fadeMs) || fadeMs < 0) {
    throw new SimpleffmpegError(
      `${label} options.fadeMs must be a non-negative number of milliseconds`,
    );
  }

  const { filter, outLabel, outputDuration } = buildSpliceFilter({
    segments: normalized,
    sampleRate: info.sampleRate ?? 44100,
    channels: info.channels ?? 2,
    fadeMs,
  });

  const argv = [
    "-nostdin",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-i",
    resolvedInput,
    "-filter_complex",
    filter,
    "-map",
    outLabel,
    ...codec,
    "-threads",
    String(options.threads ?? DEFAULT_THREADS),
    resolvedOutput,
  ];

  await runHardened({
    argv,
    label,
    outputPath: resolvedOutput,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    onProgress: options.onProgress,
    totalDuration: outputDuration,
  });

  return resolvedOutput;
}

/**
 * Trim leading/trailing silence, keeping a hair of room tone at each edge.
 * See SIMPLEFFMPEG.trimSilence for full option docs.
 */
async function trimSilence(inputPath, options = {}) {
  const label = "trimSilence()";
  const edges = options.edges ?? "both";
  if (!["both", "start", "end"].includes(edges)) {
    throw new SimpleffmpegError(
      `${label} options.edges must be "both", "start", or "end"`,
    );
  }
  const keepSec = options.keepSec ?? 0.15;
  if (typeof keepSec !== "number" || !Number.isFinite(keepSec) || keepSec < 0) {
    throw new SimpleffmpegError(
      `${label} options.keepSec must be a non-negative number of seconds`,
    );
  }

  const { info } = await prepareAudioOp(inputPath, options, label);
  const duration = info.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new TranscodeError(
      `${label} could not determine the duration of "${inputPath}"`,
      { code: "ANALYSIS_FAILED" },
    );
  }

  const silences = await detectSilence(inputPath, {
    noiseDb: options.noiseDb,
    minDurationSec: options.minDurationSec,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  });

  const EDGE_TOLERANCE = 0.01;
  let from = 0;
  let to = duration;
  if (edges !== "end") {
    const lead = silences.find((s) => s.start <= EDGE_TOLERANCE);
    if (lead) from = Math.max(0, lead.end - keepSec);
  }
  if (edges !== "start") {
    const tail = silences.find((s) => s.end >= duration - EDGE_TOLERANCE);
    if (tail) to = Math.min(duration, tail.start + keepSec);
  }
  if (to <= from) {
    // The whole file is silence; nothing sensible to write.
    throw new TranscodeError(
      `${label} input "${inputPath}" is entirely silence at the current noiseDb threshold`,
      { code: "ANALYSIS_FAILED" },
    );
  }

  return spliceAudio(inputPath, {
    outputPath: options.outputPath,
    segments: [{ start: from, end: to }],
    fadeMs: options.fadeMs,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    onProgress: options.onProgress,
    threads: options.threads,
  });
}

/**
 * Cap interior silences at a maximum length by cutting inside the silence.
 * See SIMPLEFFMPEG.capSilences for full option docs.
 */
async function capSilences(inputPath, options = {}) {
  const label = "capSilences()";
  const maxSilenceSec = options.maxSilenceSec ?? 1.0;
  if (
    typeof maxSilenceSec !== "number" ||
    !Number.isFinite(maxSilenceSec) ||
    maxSilenceSec <= 0
  ) {
    throw new SimpleffmpegError(
      `${label} options.maxSilenceSec must be a positive number of seconds`,
    );
  }

  const { info } = await prepareAudioOp(inputPath, options, label);
  const duration = info.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new TranscodeError(
      `${label} could not determine the duration of "${inputPath}"`,
      { code: "ANALYSIS_FAILED" },
    );
  }

  const silences = await detectSilence(inputPath, {
    noiseDb: options.noiseDb,
    minDurationSec: options.minDurationSec,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  });

  // Interior gaps only — edge silence is trimSilence()'s job. Each long gap
  // keeps its first maxSilenceSec of real recorded quiet (room tone, not
  // synthetic silence) and the cut lands deep inside the gap where the
  // level is minimal.
  const EDGE_TOLERANCE = 0.01;
  const longGaps = silences.filter(
    (s) =>
      s.duration > maxSilenceSec &&
      s.start > EDGE_TOLERANCE &&
      s.end < duration - EDGE_TOLERANCE,
  );

  if (longGaps.length === 0) {
    // Nothing to cap — still write output so callers get a consistent file.
    return spliceAudio(inputPath, {
      outputPath: options.outputPath,
      segments: [{ start: 0, end: duration }],
      fadeMs: options.fadeMs,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      onProgress: options.onProgress,
      threads: options.threads,
    });
  }

  const segments = [];
  let cursor = 0;
  for (const gap of longGaps) {
    segments.push({ start: cursor, end: gap.start + maxSilenceSec });
    cursor = gap.end;
  }
  segments.push({ start: cursor, end: duration });

  return spliceAudio(inputPath, {
    outputPath: options.outputPath,
    segments,
    fadeMs: options.fadeMs,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    onProgress: options.onProgress,
    threads: options.threads,
  });
}

/**
 * Parse the JSON block loudnorm prints on stderr in print_format=json mode.
 * Pure. Returns null when no parsable block is present.
 */
function parseLoudnormJson(stderr) {
  const text = String(stderr);
  // The JSON block is the last {...} group containing "input_i".
  const matches = text.match(/\{[^{}]*\}/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (!matches[i].includes("input_i")) continue;
    try {
      const parsed = JSON.parse(matches[i]);
      const fields = [
        "input_i",
        "input_tp",
        "input_lra",
        "input_thresh",
        "target_offset",
      ];
      const out = {};
      for (const f of fields) {
        const v = parseFloat(parsed[f]);
        if (!Number.isFinite(v)) return null;
        out[f] = v;
      }
      return out;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Two-pass EBU R128 loudness normalization to a LUFS target.
 * See SIMPLEFFMPEG.normalizeLoudness for full option docs.
 */
async function normalizeLoudness(inputPath, options = {}) {
  const label = "normalizeLoudness()";
  const targetLufs = options.targetLufs ?? -16;
  const truePeakDb = options.truePeakDb ?? -1.5;
  const loudnessRange = options.loudnessRange ?? 11;
  if (
    typeof targetLufs !== "number" ||
    !Number.isFinite(targetLufs) ||
    targetLufs < -70 ||
    targetLufs > -5
  ) {
    throw new SimpleffmpegError(
      `${label} options.targetLufs must be within [-70, -5] (got ${targetLufs})`,
    );
  }
  if (
    typeof truePeakDb !== "number" ||
    !Number.isFinite(truePeakDb) ||
    truePeakDb < -9 ||
    truePeakDb > 0
  ) {
    throw new SimpleffmpegError(
      `${label} options.truePeakDb must be within [-9, 0] (got ${truePeakDb})`,
    );
  }
  if (
    typeof loudnessRange !== "number" ||
    !Number.isFinite(loudnessRange) ||
    loudnessRange < 1 ||
    loudnessRange > 50
  ) {
    throw new SimpleffmpegError(
      `${label} options.loudnessRange must be within [1, 50] (got ${loudnessRange})`,
    );
  }

  const { resolvedInput, info } = await prepareAudioOp(inputPath, options, label);
  const resolvedOutput = prepareOutputPath(options, label);
  const codec = audioCodecArgs(resolvedOutput, label);

  const targetSpec = `I=${targetLufs}:TP=${truePeakDb}:LRA=${loudnessRange}`;

  // Pass 1 — measure. loudnorm prints its analysis JSON on stderr.
  const { stderr } = await runHardened({
    argv: [
      "-nostdin",
      "-hide_banner",
      "-i",
      resolvedInput,
      "-vn",
      "-af",
      `loudnorm=${targetSpec}:print_format=json`,
      "-f",
      "null",
      "-",
    ],
    label,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    stderrCapBytes: 64 * 1024,
  });

  const measured = parseLoudnormJson(stderr);
  if (!measured) {
    throw new TranscodeError(
      `${label} could not parse loudnorm measurement for "${inputPath}"`,
      { code: "ANALYSIS_FAILED", stderr: stderr.slice(-2048) },
    );
  }

  // Pass 2 — apply linearly using the measured values. loudnorm resamples
  // internally to 192 kHz, so pin the output back to the source rate.
  const sampleRate = info.sampleRate ?? 44100;
  const argv = [
    "-nostdin",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-i",
    resolvedInput,
    "-vn",
    "-af",
    `loudnorm=${targetSpec}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`,
    "-ar",
    String(sampleRate),
    ...codec,
    "-threads",
    String(options.threads ?? DEFAULT_THREADS),
    resolvedOutput,
  ];

  await runHardened({
    argv,
    label,
    outputPath: resolvedOutput,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
    onProgress: options.onProgress,
    totalDuration: Number.isFinite(info.duration) ? info.duration : 0,
  });

  return resolvedOutput;
}

module.exports = {
  audioTempo,
  detectSilence,
  spliceAudio,
  trimSilence,
  capSilences,
  normalizeLoudness,
  // Exported for unit tests — not part of the public API
  buildAtempoChain,
  parseSilenceDetect,
  buildSpliceFilter,
  parseLoudnormJson,
  audioCodecArgs,
  layoutForChannels,
  DEFAULT_FADE_MS,
  DEFAULT_NOISE_DB,
  DEFAULT_MIN_SILENCE_SEC,
};
