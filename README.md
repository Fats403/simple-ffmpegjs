<p align="center">
  <img src="https://7llpl63xkl8jovgt.public.blob.vercel-storage.com/simple-ffmpeg/zENiV5XBIET_cu11ZpOdE.png" alt="simple-ffmpeg" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/simple-ffmpegjs"><img src="https://img.shields.io/npm/v/simple-ffmpegjs.svg" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js ≥18"></a>
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
- **Static helpers** — `probe()`, `snapshot()`, `extractKeyframes()`
- **TypeScript** — full type definitions included
- **Zero runtime dependencies** — only requires FFmpeg on your system

## Documentation

Full documentation at **[simple-ffmpegjs.com](https://www.simple-ffmpegjs.com)**

## License

MIT
