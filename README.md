

<p align="center">
  <img src="https://7llpl63xkl8jovgt.public.blob.vercel-storage.com/simple-ffmpeg/zENiV5XBIET_cu11ZpOdE.png" alt="simple-ffmpeg" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/simple-ffmpegjs"><img src="https://img.shields.io/npm/v/simple-ffmpegjs.svg" alt="npm version"></a>
  <a href="https://github.com/Fats403/simple-ffmpegjs/actions/workflows/ci.yml"><img src="https://github.com/Fats403/simple-ffmpegjs/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node.js ≥20"></a>
  <a href="https://codecov.io/gh/Fats403/simple-ffmpegjs"><img src="https://codecov.io/gh/Fats403/simple-ffmpegjs/branch/main/graph/badge.svg" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen.svg" alt="Zero Dependencies">
</p>

<p align="center">
  A lightweight Node.js library for programmatic video composition using FFmpeg.<br>
  Define your timeline as a plain array of clips and the library builds the filter graph for you.
</p>

---

## Install

```bash
npm install simple-ffmpegjs
```

FFmpeg must be installed and available in your `PATH`.

## Quick example

```js
import SIMPLEFFMPEG from "simple-ffmpegjs";

const project = new SIMPLEFFMPEG({ preset: "youtube" });

await project.load([
  { type: "video", url: "./intro.mp4", duration: 5 },
  {
    type: "video",
    url: "./clip2.mp4",
    duration: 6,
    transition: { type: "fade", duration: 0.5 },
  },
  {
    type: "text",
    text: "Summer Highlights",
    position: 0.5,
    end: 4,
    fontSize: 64,
    fontColor: "#FFFFFF",
    animation: { type: "pop", in: 0.3 },
  },
  { type: "music", url: "./music.mp3", volume: 0.2, loop: true },
]);

await project.export({ outputPath: "./output.mp4" });
```

## One-liners

The static helpers work without a project instance. Everything runs through a hardened spawn wrapper: no shell, kill-safe timeouts, `AbortSignal` support, and partial-output cleanup on failure.

```js
// Ingest any upload to browser-safe H.264/MP4 (or AAC/M4A for audio files)
await SIMPLEFFMPEG.transcode("./upload.mov", { outputPath: "./safe.mp4", preset: "web-mp4" });
await SIMPLEFFMPEG.transcode("./podcast.mp3", { outputPath: "./safe.m4a", preset: "web-audio" });

// Skip the transcode when the file is already web-safe
const info = await SIMPLEFFMPEG.probe("./upload.mp4");
if (!SIMPLEFFMPEG.isWebSafeMp4(info)) { /* transcode it */ }

// Grab a frame, or the most representative frames
await SIMPLEFFMPEG.snapshot("./video.mp4", { outputPath: "./frame.jpg", time: 5 });
const frames = await SIMPLEFFMPEG.extractKeyframes("./video.mp4", { maxFrames: 8 });
```

Clean up a narration take in four calls, each one safe by construction: tempo changes keep pitch, cuts land inside silence with micro-fades, loudness is a proper two-pass R128 normalize.

```js
await SIMPLEFFMPEG.audioTempo("./take.mp3", { outputPath: "./t1.wav", tempo: 1.05 });
await SIMPLEFFMPEG.capSilences("./t1.wav", { outputPath: "./t2.wav", maxSilenceSec: 1.2 });
await SIMPLEFFMPEG.trimSilence("./t2.wav", { outputPath: "./t3.wav" });
await SIMPLEFFMPEG.normalizeLoudness("./t3.wav", { outputPath: "./final.mp3", targetLufs: -16 });
```

## Shortcuts worth knowing

```js
// Auto-sequencing: omit position and clips chain themselves; duration replaces end
await project.load([
  { type: "video", url: "./a.mp4", duration: 5 },
  { type: "video", url: "./b.mp4", duration: 5, transition: "fade" }, // string shorthand, 0.5s
  { type: "image", url: "./c.jpg", duration: 4, kenBurns: "zoom-in" },
]);

// A color card is a first-class clip; gradients too
await project.load([
  { type: "color", color: { type: "linear-gradient", colors: ["navy", "black"], direction: 45 }, duration: 3 },
  { type: "text", text: "Chapter One", position: 0.5, end: 2.5, fontSize: 72 },
]);

// Karaoke captions from word timestamps (e.g. from a transcription API)
await project.load([
  { type: "video", url: "./talk.mp4", duration: 30 },
  { type: "text", mode: "karaoke", words: wordTimings, position: 0, end: 30 },
]);

// Watch progress, allow cancellation
const controller = new AbortController();
await project.export({
  outputPath: "./out.mp4",
  signal: controller.signal,
  onProgress: ({ percent }) => console.log(`${percent}%`),
});
```

## Features

- **Declarative timeline** — `video`, `image`, `color`, `effect`, `text`, `subtitle`, `audio`, `music` clip types
- **Transitions** — all FFmpeg xfade transitions with automatic compensation for timeline compression
- **Ken Burns effects** — zoom, pan, smart, and custom with full easing control
- **Image fitting** — `blur-fill`, `cover`, and `contain` modes for aspect ratio mismatches
- **Text overlays** — static, word-by-word, karaoke, and cumulative modes with animations
- **Effect clips** — vignette, film grain, blur, color grading, sepia, B&W, sharpen, chromatic aberration, letterbox
- **Audio mixing** — multiple sources, background music, looping, independent volume control
- **Platform presets** — TikTok, YouTube, Instagram, and more
- **Pre-validation** — structured error codes before rendering; integrates cleanly into data pipelines and AI workflows
- **Schema export** — machine-readable clip specification for docs, code generation, and LLM context
- **Static helpers** — `probe()`, `snapshot()`, `extractKeyframes()`, `transcode()` (hardened one-shot ingestion — H.264/MP4 or AAC/M4A in one line)
- **Audio tools** — `audioTempo()` (speed change that keeps pitch), `detectSilence()`, `spliceAudio()` (click-free cuts with micro-fades), `trimSilence()`, `capSilences()`, `normalizeLoudness()` (two-pass EBU R128)
- **TypeScript** — full type definitions included
- **Zero runtime dependencies** — only requires FFmpeg on your system

## Documentation

Full documentation at **[simple-ffmpegjs.com](https://www.simple-ffmpegjs.com)**

## License

MIT
