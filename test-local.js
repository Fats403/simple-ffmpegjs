// test-local.js
const EZFFMPEG = require("./index.js");

async function test() {
  const project = new EZFFMPEG({
    fps: 30,
    width: 1080,
    height: 1920,
  });

  const systemFont = "/System/Library/Fonts/Supplemental/Arial.ttf";

  // Build a lot of windows for batching stress (e.g., 80 words from 6..9.8s)
  const manyWords = Array.from({ length: 80 }, (_, i) => ({
    text: `W${i + 1}`,
    start: 6 + i * 0.0475,
    end: 6 + (i + 1) * 0.0475,
  }));

  await project.load([
    // Video clips (sequential with a transition on the second)
    { type: "video", url: "./test-files/test-video2.mp4", position: 0, end: 5 },
    {
      type: "video",
      url: "./test-files/test-video2.mp4",
      position: 5,
      end: 10,
      transition: { type: "fade", duration: 0.25 },
    },

    // Background music
    { type: "music", url: "./test-files/bgmusic.wav", volume: 0.2 },

    // Text 1: static (no animation) centered
    {
      type: "text",
      text: "Static default centered",
      position: 0.5,
      end: 2.0,
      fontColor: "white",
    },

    // Text 2: word-replace explicit windows, fade-in
    {
      type: "text",
      mode: "word-replace",
      position: 2.0,
      end: 4.0,
      fontColor: "#00ffff",
      centerX: 0,
      centerY: -400,
      animation: { type: "fade-in", in: 0.4 },
      words: [
        { text: "One", start: 2.0, end: 2.5 },
        { text: "Two", start: 2.5, end: 3.0 },
        { text: "Three", start: 3.0, end: 3.5 },
        { text: "Four", start: 3.5, end: 4.0 },
      ],
    },

    // Text 3: word-replace timestamps, pop-bounce
    {
      type: "text",
      mode: "word-replace",
      text: "Alpha Beta Gamma Delta",
      position: 4.0,
      end: 6.0,
      fontFile: systemFont,
      fontSize: 64,
      fontColor: "yellow",
      centerX: 0,
      centerY: -100,
      animation: { type: "pop-bounce", in: 0.3 },
      wordTimestamps: [4.0, 4.5, 5.0, 5.5, 6.0],
    },

    // Text 4: stress many words to force batching, no animation
    {
      type: "text",
      mode: "word-replace",
      position: 6.0,
      end: 9.8,
      fontColor: "#ff66ff",
      centerX: 0,
      centerY: 200,
      animation: { type: "none" },
      words: manyWords,
    },
  ]);

  await project.export({
    outputPath: "./test-output.mp4",
    textMaxNodesPerPass: 40, // force batching for stress test
    intermediateCrf: 20,
  });

  console.log("Test completed!");
}

test().catch(console.error);
