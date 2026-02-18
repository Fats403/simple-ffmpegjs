const path = require("path");
const { spawn } = require("child_process");
const { buildFiltersForWindows } = require("./text_renderer");
const { buildTextBatchCommand } = require("./command_builder");
const { FFmpegError } = require("../core/errors");
const { parseFFmpegCommand } = require("../lib/utils");

/**
 * Run an FFmpeg command using spawn() to avoid command injection.
 * @param {string} cmd - The full FFmpeg command string
 * @param {Function} [onLog] - Optional log callback receiving { level, message }
 * @returns {Promise<void>}
 * @throws {FFmpegError} If ffmpeg fails
 */
function runCmd(cmd, onLog) {
  return new Promise((resolve, reject) => {
    const args = parseFFmpegCommand(cmd);
    const ffmpegPath = args.shift(); // Remove 'ffmpeg' from args

    const proc = spawn(ffmpegPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      if (onLog && typeof onLog === "function") {
        onLog({ level: "stdout", message: chunk });
      }
    });

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (onLog && typeof onLog === "function") {
        onLog({ level: "stderr", message: chunk });
      }
    });

    proc.on("error", (error) => {
      reject(
        new FFmpegError(`FFmpeg text batch process error: ${error.message}`, {
          stderr,
          command: cmd,
        })
      );
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("FFmpeg text batch stderr:", stderr);
        reject(
          new FFmpegError(`FFmpeg text batch exited with code ${code}`, {
            stderr,
            command: cmd,
            exitCode: code,
          })
        );
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
  onLog,
  tempDir,
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
      "[invid]"
    );

    const batchOutput = path.join(
      intermediateDir,
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
    await runCmd(cmd, onLog);
    currentInput = batchOutput;
    passes += 1;
  }

  if (currentInput !== baseOutputPath) {
    return { finalPath: currentInput, tempOutputs, passes };
  }
  return { finalPath: baseOutputPath, tempOutputs, passes };
}

module.exports = { runTextPasses };
