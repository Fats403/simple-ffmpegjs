const os = require("os");
const { escapeFilePath } = require("./strings");

/**
 * Get the null device path for the current platform
 * @returns {string} '/dev/null' on Unix, 'NUL' on Windows
 */
function getNullDevice() {
  return os.platform() === "win32" ? "NUL" : "/dev/null";
}

/**
 * Build the main FFmpeg export command
 */
function buildMainCommand({
  inputs,
  filterComplex,
  mapVideo,
  mapAudio,
  hasVideo,
  hasAudio,
  // Video encoding
  videoCodec,
  videoPreset,
  videoCrf,
  videoBitrate,
  // Audio encoding
  audioCodec,
  audioBitrate,
  audioSampleRate,
  // Options
  shortest,
  faststart,
  outputPath,
  // New options
  hwaccel,
  audioOnly,
  metadata,
  twoPass,
  passNumber, // 1 or 2 for two-pass encoding
  passLogFile,
}) {
  let cmd = "ffmpeg -y ";

  // Hardware acceleration (input side)
  if (hwaccel && hwaccel !== "none") {
    if (hwaccel === "auto") {
      cmd += "-hwaccel auto ";
    } else if (hwaccel === "videotoolbox") {
      cmd += "-hwaccel videotoolbox ";
    } else if (hwaccel === "nvenc") {
      cmd += "-hwaccel cuda ";
    } else if (hwaccel === "vaapi") {
      cmd += "-hwaccel vaapi -hwaccel_output_format vaapi ";
    } else if (hwaccel === "qsv") {
      cmd += "-hwaccel qsv ";
    }
  }

  // Inputs
  cmd += `${inputs} `;

  // Filter complex (skip for audio-only with no video filters)
  if (filterComplex && filterComplex.trim()) {
    cmd += `-filter_complex "${filterComplex}" `;
  }

  // Map streams
  if (!audioOnly) {
    if (hasVideo && mapVideo) cmd += `-map "${mapVideo}" `;
  }
  if (hasAudio && mapAudio) cmd += `-map "${mapAudio}" `;

  // Video encoding (skip for audio-only)
  if (hasVideo && !audioOnly) {
    cmd += `-c:v ${videoCodec} `;

    // Preset (for software encoders)
    if (
      videoPreset &&
      !videoCodec.includes("nvenc") &&
      !videoCodec.includes("videotoolbox")
    ) {
      cmd += `-preset ${videoPreset} `;
    }

    // Two-pass encoding
    if (twoPass && passNumber) {
      cmd += `-pass ${passNumber} `;
      if (passLogFile) {
        cmd += `-passlogfile "${escapeFilePath(passLogFile)}" `;
      }
    }

    // Bitrate or CRF
    if (videoBitrate) {
      cmd += `-b:v ${videoBitrate} `;
      if (twoPass && passNumber === 1) {
        // First pass: skip output, just analyze
      }
    } else if (videoCrf !== null && videoCrf !== undefined) {
      // CRF mode (quality-based)
      if (videoCodec.includes("nvenc")) {
        cmd += `-cq ${videoCrf} `;
      } else if (videoCodec.includes("videotoolbox")) {
        cmd += `-q:v ${Math.round(videoCrf * 2)} `; // VT uses different scale
      } else {
        cmd += `-crf ${videoCrf} `;
      }
    }
  }

  // Audio encoding
  if (hasAudio) {
    cmd += `-c:a ${audioCodec} `;
    if (audioCodec !== "copy" && audioCodec !== "pcm_s16le") {
      cmd += `-b:a ${audioBitrate} `;
    }
    if (audioSampleRate && audioCodec !== "copy") {
      cmd += `-ar ${audioSampleRate} `;
    }
  }

  // For two-pass first pass, output to null
  if (twoPass && passNumber === 1) {
    cmd += `-f null ${getNullDevice()}`;
    return cmd;
  }

  // Options
  if (hasVideo && hasAudio && shortest && !audioOnly) {
    cmd += "-shortest ";
  }

  // Faststart for MP4 (streaming-friendly)
  if (faststart && outputPath.endsWith(".mp4")) {
    cmd += "-movflags +faststart ";
  }

  // Metadata
  if (metadata) {
    if (metadata.title)
      cmd += `-metadata title="${escapeMetadata(metadata.title)}" `;
    if (metadata.artist)
      cmd += `-metadata artist="${escapeMetadata(metadata.artist)}" `;
    if (metadata.album)
      cmd += `-metadata album="${escapeMetadata(metadata.album)}" `;
    if (metadata.comment)
      cmd += `-metadata comment="${escapeMetadata(metadata.comment)}" `;
    if (metadata.date)
      cmd += `-metadata date="${escapeMetadata(metadata.date)}" `;
    if (metadata.genre)
      cmd += `-metadata genre="${escapeMetadata(metadata.genre)}" `;
    // Custom metadata
    if (metadata.custom && typeof metadata.custom === "object") {
      for (const [key, value] of Object.entries(metadata.custom)) {
        cmd += `-metadata ${key}="${escapeMetadata(String(value))}" `;
      }
    }
  }

  cmd += `"${escapeFilePath(outputPath)}"`;
  return cmd;
}

/**
 * Build command for text overlay batch passes
 */
function buildTextBatchCommand({
  inputPath,
  filterString,
  intermediateVideoCodec,
  intermediatePreset,
  intermediateCrf,
  outputPath,
}) {
  return `ffmpeg -y -i "${escapeFilePath(inputPath)}" -filter_complex "[0:v]null[invid];${filterString}" -map "[outVideoAndText]" -map 0:a? -c:v ${intermediateVideoCodec} -preset ${intermediatePreset} -crf ${intermediateCrf} -c:a copy -movflags +faststart "${escapeFilePath(outputPath)}"`;
}

/**
 * Build command to generate a thumbnail
 */
function buildThumbnailCommand({ inputPath, outputPath, time, width, height }) {
  let cmd = `ffmpeg -y -ss ${time} -i "${escapeFilePath(inputPath)}" -vframes 1 `;

  if (width || height) {
    const w = width || -1;
    const h = height || -1;
    cmd += `-vf "scale=${w}:${h}" `;
  }

  cmd += `"${escapeFilePath(outputPath)}"`;
  return cmd;
}

/**
 * Escape metadata value for FFmpeg
 */
function escapeMetadata(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

module.exports = {
  buildMainCommand,
  buildTextBatchCommand,
  buildThumbnailCommand,
  escapeMetadata,
};
