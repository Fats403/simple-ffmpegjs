const path = require("path");
const { buildFiltersForWindows } = require("./text_renderer");
const { buildTextBatchCommand } = require("./command_builder");
const { runFFmpeg } = require("../lib/utils");

/** Each batch is a full re-encode of the video; give it real headroom. */
const TEXT_PASS_TIMEOUT_MS = 15 * 60 * 1000;

async function runTextPasses({
  baseOutputPath,
  textWindows,
  canvasWidth,
  canvasHeight,
  intermediateVideoCodec,
  intermediatePreset,
  intermediateCrf,
  batchSize = 75,
  onLog,
  tempDir,
  signal,
}) {
  const tempOutputs = [];
  let currentInput = baseOutputPath;
  let passes = 0;
  const intermediateDir = tempDir || path.dirname(baseOutputPath);

  for (let i = 0; i < textWindows.length; i += batchSize) {
    const batch = textWindows.slice(i, i + batchSize);
    const { filterString } = buildFiltersForWindows(
      batch,
      canvasWidth,
      canvasHeight,
      "[invid]",
    );

    const batchOutput = path.join(
      intermediateDir,
      `textpass_${i}_${path.basename(baseOutputPath)}`,
    );
    tempOutputs.push(batchOutput);

    const cmd = buildTextBatchCommand({
      inputPath: currentInput,
      filterString,
      intermediateVideoCodec,
      intermediatePreset,
      intermediateCrf,
      outputPath: batchOutput,
    });
    // The shared hardened runner: SIGTERM→SIGKILL abort escalation, bounded
    // output buffering, ENOENT discrimination, partial-output cleanup.
    await runFFmpeg({
      command: cmd,
      onLog,
      signal,
      timeoutMs: TEXT_PASS_TIMEOUT_MS,
      outputPath: batchOutput,
    });
    currentInput = batchOutput;
    passes += 1;
  }

  if (currentInput !== baseOutputPath) {
    return { finalPath: currentInput, tempOutputs, passes };
  }
  return { finalPath: baseOutputPath, tempOutputs, passes };
}

module.exports = { runTextPasses };
