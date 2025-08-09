const path = require("path");
const os = require("os");
const { randomUUID } = require("crypto");
const { exec } = require("child_process");

const tempDir = os.tmpdir();

function unrotateVideo(inputUrl) {
  return new Promise((resolve, reject) => {
    const out = path.join(tempDir, `unrotated-${randomUUID()}.mp4`);
    const cmd = `ffmpeg -y -i "${inputUrl}" "${out}"`;
    exec(cmd, (error) => {
      if (error) {
        console.error("Error unrotating video:", error);
        reject(error);
        return;
      }
      resolve(out);
    });
  });
}

module.exports = { unrotateVideo };
