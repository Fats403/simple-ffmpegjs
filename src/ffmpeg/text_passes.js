const path = require("path");
const { exec } = require("child_process");
const { buildFiltersForWindows } = require("./text_renderer");
const { buildTextBatchCommand } = require("./command_builder");

function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, so, se) => {
      if (err) {
        console.error("FFmpeg text batch stderr:", se);
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function runTextPasses({
  baseOutputPath,
  textWindows,
  canvasWidth,
  canvasHeight,
  intermediateVideoCodec,
  intermediatePreset,
  intermediateCrf,
  batchSize = 75,
}) {
  const tempOutputs = [];
  let currentInput = baseOutputPath;
  let passes = 0;

  for (let i = 0; i < textWindows.length; i += batchSize) {
    const batch = textWindows.slice(i, i + batchSize);
    const { filterString } = buildFiltersForWindows(
      batch,
      canvasWidth,
      canvasHeight,
      "[invid]"
    );

    const batchOutput = path.join(
      path.dirname(baseOutputPath),
      `textpass_${i}_${path.basename(baseOutputPath)}`
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
    await runCmd(cmd);
    currentInput = batchOutput;
    passes += 1;
  }

  if (currentInput !== baseOutputPath) {
    return { finalPath: currentInput, tempOutputs, passes };
  }
  return { finalPath: baseOutputPath, tempOutputs, passes };
}

module.exports = { runTextPasses };
