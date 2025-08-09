function buildMainCommand({
  inputs,
  filterComplex,
  mapVideo,
  mapAudio,
  hasVideo,
  hasAudio,
  videoCodec,
  videoPreset,
  videoCrf,
  audioCodec,
  audioBitrate,
  shortest,
  faststart,
  outputPath,
}) {
  let cmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" `;
  if (hasVideo && mapVideo) cmd += `-map "${mapVideo}" `;
  if (hasAudio && mapAudio) cmd += `-map "${mapAudio}" `;
  if (hasVideo)
    cmd += `-c:v ${videoCodec} -preset ${videoPreset} -crf ${videoCrf} `;
  if (hasAudio) cmd += `-c:a ${audioCodec} -b:a ${audioBitrate} `;
  if (hasVideo && hasAudio && shortest) cmd += `-shortest `;
  if (faststart) cmd += `-movflags +faststart `;
  cmd += `"${outputPath}"`;
  return cmd;
}

function buildTextBatchCommand({
  inputPath,
  filterString,
  intermediateVideoCodec,
  intermediatePreset,
  intermediateCrf,
  outputPath,
}) {
  return `ffmpeg -y -i "${inputPath}" -filter_complex "[0:v]null[invid];${filterString}" -map "[outVideoAndText]" -map 0:a? -c:v ${intermediateVideoCodec} -preset ${intermediatePreset} -crf ${intermediateCrf} -c:a copy -movflags +faststart "${outputPath}"`;
}

module.exports = { buildMainCommand, buildTextBatchCommand };
