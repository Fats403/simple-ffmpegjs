const { exec } = require("child_process");

function getVideoMetadata(url) {
  return new Promise((resolve) => {
    const cmd = `ffprobe -v error -show_streams -show_format -of json "${url}"`;
    exec(cmd, (error, stdout) => {
      if (error) {
        console.error("Error getting video metadata:", error);
        resolve({
          iphoneRotation: 0,
          hasAudio: false,
          width: null,
          height: null,
          durationSec: null,
        });
        return;
      }
      try {
        const metadata = JSON.parse(stdout);
        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video"
        );
        const hasAudio = metadata.streams.some((s) => s.codec_type === "audio");
        const iphoneRotation = videoStream?.side_data_list?.[0]?.rotation
          ? videoStream.side_data_list[0].rotation
          : 0;
        const formatDuration = metadata.format?.duration
          ? parseFloat(metadata.format.duration)
          : null;
        const streamDuration = videoStream?.duration
          ? parseFloat(videoStream.duration)
          : null;
        const durationSec = Number.isFinite(formatDuration)
          ? formatDuration
          : Number.isFinite(streamDuration)
          ? streamDuration
          : null;
        resolve({
          iphoneRotation,
          hasAudio,
          width: videoStream?.width,
          height: videoStream?.height,
          durationSec,
        });
      } catch (e) {
        console.error("Error parsing metadata:", e);
        resolve({
          iphoneRotation: 0,
          hasAudio: false,
          width: null,
          height: null,
          durationSec: null,
        });
      }
    });
  });
}

function getMediaDuration(url) {
  return new Promise((resolve) => {
    const cmd = `ffprobe -v error -show_format -of json "${url}"`;
    exec(cmd, (error, stdout) => {
      if (error) {
        console.error("Error getting media duration:", error);
        resolve(null);
        return;
      }
      try {
        const metadata = JSON.parse(stdout);
        const formatDuration = metadata.format?.duration
          ? parseFloat(metadata.format.duration)
          : null;
        resolve(Number.isFinite(formatDuration) ? formatDuration : null);
      } catch (e) {
        console.error("Error parsing media duration:", e);
        resolve(null);
      }
    });
  });
}

module.exports = { getVideoMetadata, getMediaDuration };
