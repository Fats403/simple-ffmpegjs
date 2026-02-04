# simple-ffmpeg

[![npm version](https://img.shields.io/npm/v/simple-ffmpegjs.svg)](https://www.npmjs.com/package/simple-ffmpegjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org)

A lightweight Node.js library for programmatic video composition using FFmpeg. Designed for data pipelines and automation workflows that need reliable video assembly without the complexity of a full editing suite.

## Example Output

<p align="center">
  <a href="https://7llpl63xkl8jovgt.public.blob.vercel-storage.com/wonders-of-the-world.mp4">
    <img src="assets/example-thumbnail.jpg" alt="Example video - click to watch" width="640">
  </a>
</p>

_Click to watch a "Wonders of the World" video created with simple-ffmpeg — combining multiple video clips with crossfade transitions, animated text overlays, and background music._

## Features

- **Video Concatenation** — Join multiple clips with optional xfade transitions
- **Audio Mixing** — Layer audio tracks, voiceovers, and background music
- **Text Overlays** — Static, word-by-word, and cumulative text with animations
- **Image Support** — Ken Burns effects (zoom, pan) for static images
- **Progress Tracking** — Real-time export progress callbacks
- **Cancellation** — AbortController support for stopping exports
- **Gap Handling** — Optional black frame fill for timeline gaps
- **TypeScript Ready** — Full type definitions included
- **Zero Dependencies** — Only requires FFmpeg on your system

## Installation

```bash
npm install simple-ffmpegjs
```

### Prerequisites

FFmpeg must be installed and available in your PATH:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

For text overlays, ensure your FFmpeg build includes `libfreetype` and `fontconfig`. On minimal systems (Docker, Alpine), install a font package:

```bash
# Alpine
apk add --no-cache ffmpeg fontconfig ttf-dejavu

# Debian/Ubuntu
apt-get install -y ffmpeg fontconfig fonts-dejavu-core
```

## Quick Start

```js
import SIMPLEFFMPEG from "simple-ffmpegjs";

const project = new SIMPLEFFMPEG({
  width: 1920,
  height: 1080,
  fps: 30,
});

await project.load([
  { type: "video", url: "./intro.mp4", position: 0, end: 5 },
  {
    type: "video",
    url: "./main.mp4",
    position: 5,
    end: 15,
    transition: { type: "fade", duration: 0.5 },
  },
  { type: "music", url: "./bgm.mp3", volume: 0.2 },
  {
    type: "text",
    text: "Hello World",
    position: 1,
    end: 4,
    fontColor: "white",
    fontSize: 64,
  },
]);

await project.export({
  outputPath: "./output.mp4",
  onProgress: ({ percent }) => console.log(`${percent}% complete`),
});
```

## API Reference

### Constructor

```ts
new SIMPLEFFMPEG(options?: {
  width?: number;           // Output width (default: 1920)
  height?: number;          // Output height (default: 1080)
  fps?: number;             // Frame rate (default: 30)
  validationMode?: 'warn' | 'strict';  // Validation behavior (default: 'warn')
  fillGaps?: 'none' | 'black';         // Gap handling (default: 'none')
})
```

### Methods

#### `project.load(clips)`

Load clip descriptors into the project. Validates the timeline and reads media metadata.

```ts
await project.load(clips: Clip[]): Promise<void[]>
```

#### `project.export(options)`

Build and execute the FFmpeg command to render the final video.

```ts
await project.export(options?: ExportOptions): Promise<string>
```

**Export Options:**

| Option             | Type          | Default          | Description                                                                      |
| ------------------ | ------------- | ---------------- | -------------------------------------------------------------------------------- |
| `outputPath`       | `string`      | `'./output.mp4'` | Output file path                                                                 |
| `videoCodec`       | `string`      | `'libx264'`      | Video codec (`libx264`, `libx265`, `libvpx-vp9`, `prores_ks`, hardware encoders) |
| `crf`              | `number`      | `23`             | Quality level (0-51, lower = better)                                             |
| `preset`           | `string`      | `'medium'`       | Encoding preset (`ultrafast` to `veryslow`)                                      |
| `videoBitrate`     | `string`      | -                | Target bitrate (e.g., `'5M'`). Overrides CRF.                                    |
| `audioCodec`       | `string`      | `'aac'`          | Audio codec (`aac`, `libmp3lame`, `libopus`, `flac`, `copy`)                     |
| `audioBitrate`     | `string`      | `'192k'`         | Audio bitrate                                                                    |
| `audioSampleRate`  | `number`      | `48000`          | Audio sample rate in Hz                                                          |
| `hwaccel`          | `string`      | `'none'`         | Hardware acceleration (`auto`, `videotoolbox`, `nvenc`, `vaapi`, `qsv`)          |
| `outputWidth`      | `number`      | -                | Scale output width                                                               |
| `outputHeight`     | `number`      | -                | Scale output height                                                              |
| `outputResolution` | `string`      | -                | Resolution preset (`'720p'`, `'1080p'`, `'4k'`)                                  |
| `audioOnly`        | `boolean`     | `false`          | Export audio only (no video)                                                     |
| `twoPass`          | `boolean`     | `false`          | Two-pass encoding for better quality                                             |
| `metadata`         | `object`      | -                | Embed metadata (title, artist, etc.)                                             |
| `thumbnail`        | `object`      | -                | Generate thumbnail image                                                         |
| `verbose`          | `boolean`     | `false`          | Enable verbose logging                                                           |
| `saveCommand`      | `string`      | -                | Save FFmpeg command to file                                                      |
| `onProgress`       | `function`    | -                | Progress callback                                                                |
| `signal`           | `AbortSignal` | -                | Cancellation signal                                                              |

#### `project.preview(options)`

Get the FFmpeg command without executing it. Useful for debugging or dry runs.

```ts
await project.preview(options?: ExportOptions): Promise<{
  command: string;        // Full FFmpeg command
  filterComplex: string;  // Filter graph
  totalDuration: number;  // Expected output duration
}>
```

### Clip Types

#### Video Clip

```ts
{
  type: "video";
  url: string;              // File path
  position: number;         // Timeline start (seconds)
  end: number;              // Timeline end (seconds)
  cutFrom?: number;         // Source offset (default: 0)
  volume?: number;          // Audio volume (default: 1)
  transition?: {
    type: string;           // Any xfade transition (e.g., 'fade', 'wipeleft', 'dissolve')
    duration: number;       // Transition duration in seconds
  };
}
```

All [xfade transitions](https://trac.ffmpeg.org/wiki/Xfade) are supported.

#### Audio Clip

```ts
{
  type: "audio";
  url: string;
  position: number;
  end: number;
  cutFrom?: number;
  volume?: number;
}
```

#### Background Music

```ts
{
  type: "music";            // or "backgroundAudio"
  url: string;
  position?: number;        // default: 0
  end?: number;             // default: project duration
  cutFrom?: number;
  volume?: number;          // default: 0.2
}
```

Background music is mixed after transitions, so video crossfades won't affect its volume.

#### Image Clip

```ts
{
  type: "image";
  url: string;
  position: number;
  end: number;
  kenBurns?: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down";
}
```

#### Text Clip

```ts
{
  type: "text";
  position: number;
  end: number;

  // Content
  text?: string;
  mode?: "static" | "word-replace" | "word-sequential";
  words?: Array<{ text: string; start: number; end: number }>;
  wordTimestamps?: number[];

  // Styling
  fontFile?: string;        // Custom font file path
  fontFamily?: string;      // System font (default: 'Sans')
  fontSize?: number;        // default: 48
  fontColor?: string;       // default: '#FFFFFF'
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;

  // Positioning
  xPercent?: number;        // Horizontal position as % (0 = left, 0.5 = center, 1 = right)
  yPercent?: number;        // Vertical position as % (0 = top, 0.5 = center, 1 = bottom)
  x?: number;               // Absolute X position in pixels
  y?: number;               // Absolute Y position in pixels

  // Animation
  animation?: {
    type: "none" | "fade-in" | "fade-in-out" | "pop" | "pop-bounce";
    in?: number;            // Intro duration (seconds)
    out?: number;           // Outro duration (seconds)
  };
}
```

### Progress Information

The `onProgress` callback receives:

```ts
{
  percent?: number;         // 0-100
  timeProcessed?: number;   // Seconds processed
  frame?: number;           // Current frame
  fps?: number;             // Processing speed
  speed?: number;           // Multiplier (e.g., 2.0 = 2x realtime)
}
```

### Error Handling

The library exports custom error classes for better error handling:

```ts
import SIMPLEFFMPEG from "simple-ffmpegjs";

try {
  await project.export({ outputPath: "./out.mp4" });
} catch (error) {
  if (error.name === "ValidationError") {
    console.error("Invalid clips:", error.errors);
  } else if (error.name === "FFmpegError") {
    console.error("FFmpeg failed:", error.stderr);
  } else if (error.name === "ExportCancelledError") {
    console.log("Export was cancelled");
  }
}
```

### Cancellation

Use an `AbortController` to cancel an export in progress:

```ts
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  await project.export({
    outputPath: "./out.mp4",
    signal: controller.signal,
  });
} catch (error) {
  if (error.name === "ExportCancelledError") {
    console.log("Cancelled");
  }
}
```

### Gap Handling

By default, timeline gaps (periods with no video/image content) throw a validation error. Enable automatic black frame fill:

```ts
const project = new SIMPLEFFMPEG({
  fillGaps: "black", // Fill gaps with black frames
});

await project.load([
  { type: "video", url: "./clip.mp4", position: 2, end: 5 }, // Gap from 0-2s filled with black
]);
```

## Examples

### Two Clips with Transition

```ts
await project.load([
  { type: "video", url: "./a.mp4", position: 0, end: 5 },
  {
    type: "video",
    url: "./b.mp4",
    position: 5,
    end: 10,
    transition: { type: "fade", duration: 0.5 },
  },
]);
```

### Word-by-Word Text Animation

```ts
await project.load([
  { type: "video", url: "./bg.mp4", position: 0, end: 10 },
  {
    type: "text",
    mode: "word-replace",
    text: "One Two Three Four",
    position: 2,
    end: 6,
    wordTimestamps: [2, 3, 4, 5, 6],
    animation: { type: "fade-in", in: 0.2 },
    fontSize: 72,
    fontColor: "white",
  },
]);
```

### Image Slideshow with Ken Burns

```ts
await project.load([
  {
    type: "image",
    url: "./photo1.jpg",
    position: 0,
    end: 3,
    kenBurns: "zoom-in",
  },
  {
    type: "image",
    url: "./photo2.jpg",
    position: 3,
    end: 6,
    kenBurns: "pan-right",
  },
  {
    type: "image",
    url: "./photo3.jpg",
    position: 6,
    end: 9,
    kenBurns: "zoom-out",
  },
  { type: "music", url: "./music.mp3", volume: 0.3 },
]);
```

### Export with Progress Tracking

```ts
await project.export({
  outputPath: "./output.mp4",
  onProgress: ({ percent, fps, speed }) => {
    process.stdout.write(`\rRendering: ${percent}% (${fps} fps, ${speed}x)`);
  },
});
```

### High-Quality Export with Custom Settings

```ts
await project.export({
  outputPath: "./output.mp4",
  videoCodec: "libx265",
  crf: 18, // Higher quality
  preset: "slow", // Better compression
  audioCodec: "libopus",
  audioBitrate: "256k",
  metadata: {
    title: "My Video",
    artist: "My Name",
    date: "2024",
  },
});
```

### Hardware-Accelerated Export (macOS)

```ts
await project.export({
  outputPath: "./output.mp4",
  hwaccel: "videotoolbox",
  videoCodec: "h264_videotoolbox",
  crf: 23,
});
```

### Two-Pass Encoding for Target File Size

```ts
await project.export({
  outputPath: "./output.mp4",
  twoPass: true,
  videoBitrate: "5M", // Target bitrate
  preset: "slow",
});
```

### Scale Output Resolution

```ts
// Use resolution preset
await project.export({
  outputPath: "./output-720p.mp4",
  outputResolution: "720p",
});

// Or specify exact dimensions
await project.export({
  outputPath: "./output-custom.mp4",
  outputWidth: 1280,
  outputHeight: 720,
});
```

### Audio-Only Export

```ts
await project.export({
  outputPath: "./audio.mp3",
  audioOnly: true,
  audioCodec: "libmp3lame",
  audioBitrate: "320k",
});
```

### Generate Thumbnail

```ts
await project.export({
  outputPath: "./output.mp4",
  thumbnail: {
    outputPath: "./thumbnail.jpg",
    time: 5, // Capture at 5 seconds
    width: 640,
  },
});
```

### Debug Export Command

```ts
await project.export({
  outputPath: "./output.mp4",
  verbose: true, // Log export options
  saveCommand: "./ffmpeg-command.txt", // Save command to file
});
```

## Timeline Behavior

- Clip timing uses `[position, end)` intervals in seconds
- Transitions create overlaps that reduce total duration
- Background music is mixed after video transitions (unaffected by crossfades)
- Text with many nodes is automatically batched across multiple FFmpeg passes

## Testing

### Automated Tests

The library includes comprehensive unit and integration tests using Vitest:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with watch mode
npm run test:watch
```

### Manual Verification

For visual verification of output quality, run the examples script which generates test media and demonstrates all major features:

```bash
node examples/run-examples.js
```

This creates 12 example videos in `examples/output/` covering:

- Basic video concatenation
- Crossfade transitions
- Text overlays with animations
- Background music mixing
- Ken Burns effects on images
- Gap filling with black frames
- Quality settings (CRF, preset)
- Resolution scaling
- Metadata embedding
- Thumbnail generation
- Complex multi-track compositions

View the outputs to confirm everything renders correctly:

```bash
open examples/output/   # macOS
xdg-open examples/output/   # Linux
```

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## Credits

Inspired by [ezffmpeg](https://github.com/ezffmpeg/ezffmpeg) by John Chen.

## License

MIT
