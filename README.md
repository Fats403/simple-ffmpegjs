# simple-ffmpeg

[![npm version](https://img.shields.io/npm/v/simple-ffmpegjs.svg)](https://www.npmjs.com/package/simple-ffmpegjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

A lightweight Node.js library for programmatic video composition using FFmpeg. Designed for data pipelines and automation workflows that need reliable video assembly without the complexity of a full editing suite.

## Table of Contents

- [Why simple-ffmpeg?](#why-simple-ffmpeg)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Pre-Validation (for AI Pipelines)](#pre-validation-for-ai-pipelines)
- [API Reference](#api-reference)
  - [Constructor](#constructor)
  - [Methods](#methods)
  - [Clip Types](#clip-types)
  - [Platform Presets](#platform-presets)
  - [Watermarks](#watermarks)
  - [Progress Information](#progress-information)
  - [Error Handling](#error-handling)
  - [Cancellation](#cancellation)
  - [Gap Handling](#gap-handling)
- [Examples](#examples)
  - [Transitions](#two-clips-with-transition)
  - [Text Positioning](#text-positioning-with-offsets)
  - [Word-by-Word Animation](#word-by-word-text-animation)
  - [Ken Burns Slideshow](#image-slideshow-with-ken-burns)
  - [Export Options](#high-quality-export-with-custom-settings)
  - [Text Animations](#typewriter-text-effect)
  - [Karaoke](#karaoke-text-effect)
  - [Subtitles](#import-srtvtt-subtitles)
- [Timeline Behavior](#timeline-behavior)
  - [Transition Compensation](#transition-compensation)
- [Auto-Batching](#auto-batching-for-complex-filter-graphs)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Why simple-ffmpeg?

With `fluent-ffmpeg` no longer actively maintained, there's a need for a modern, well-supported alternative. simple-ffmpeg fills this gap with a declarative, config-driven API that's particularly well-suited for structured validation with error codes that makes it easy to build feedback loops where AI can generate configs, validate them, and iterate until successful

The library handles FFmpeg's complexity internally while exposing a clean interface that both humans and AI can work with effectively.

## Example Output

<p align="center">
  <a href="https://7llpl63xkl8jovgt.public.blob.vercel-storage.com/wonders-showcase-1.mp4">
    <img src="https://7llpl63xkl8jovgt.public.blob.vercel-storage.com/simple-ffmpeg/wonders-thumbnail-1.jpg" alt="Example video - click to watch" width="640">
  </a>
</p>

_Click to watch a "Wonders of the World" video created with simple-ffmpeg — combining multiple video clips with crossfade transitions, animated text overlays, and background music._

## Features

- **Video Concatenation** — Join multiple clips with optional xfade transitions
- **Audio Mixing** — Layer audio tracks, voiceovers, and background music
- **Text Overlays** — Static, word-by-word, and cumulative text with animations
- **Text Animations** — Typewriter, scale-in, pulse, fade effects
- **Karaoke Mode** — Word-by-word highlighting with customizable colors
- **Subtitle Import** — Load SRT, VTT, ASS/SSA subtitle files
- **Watermarks** — Text or image overlays with positioning and timing control
- **Platform Presets** — Quick configuration for TikTok, YouTube, Instagram, etc.
- **Image Support** — Ken Burns effects (zoom, pan) for static images
- **Progress Tracking** — Real-time export progress callbacks
- **Cancellation** — AbortController support for stopping exports
- **Gap Handling** — Optional black frame fill for timeline gaps
- **Auto-Batching** — Automatically splits complex filter graphs to avoid OS command limits
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

## Pre-Validation (for AI Pipelines)

Validate configurations before creating a project—ideal for AI feedback loops where you want to catch errors early and provide structured feedback:

```js
import SIMPLEFFMPEG from "simple-ffmpegjs";

const clips = [
  { type: "video", url: "./intro.mp4", position: 0, end: 5 },
  { type: "text", text: "Hello", position: 1, end: 4 },
];

// Validate without creating a project
const result = SIMPLEFFMPEG.validate(clips, {
  skipFileChecks: true, // Skip file existence checks (useful when files don't exist yet)
  width: 1920, // Project dimensions (for Ken Burns size validation)
  height: 1080,
  strictKenBurns: false, // If true, undersized Ken Burns images error instead of warn (default: false)
});

if (!result.valid) {
  // Structured errors for programmatic handling
  result.errors.forEach((err) => {
    console.log(`[${err.code}] ${err.path}: ${err.message}`);
    // e.g. [MISSING_REQUIRED] clips[0].url: URL is required for media clips
  });
}

// Or get human-readable output
console.log(SIMPLEFFMPEG.formatValidationResult(result));
```

### Validation Codes

Access error codes programmatically for custom handling:

```js
const { ValidationCodes } = SIMPLEFFMPEG;

// Available codes:
// INVALID_TYPE, MISSING_REQUIRED, INVALID_VALUE, INVALID_RANGE,
// INVALID_TIMELINE, TIMELINE_GAP, FILE_NOT_FOUND, INVALID_FORMAT,
// INVALID_WORD_TIMING, OUTSIDE_BOUNDS

if (result.errors.some((e) => e.code === ValidationCodes.TIMELINE_GAP)) {
  // Handle gap-specific logic
}
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
  preset?: string;          // Platform preset (e.g., 'tiktok', 'youtube', 'instagram-post')
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

| Option                  | Type          | Default          | Description                                                                      |
| ----------------------- | ------------- | ---------------- | -------------------------------------------------------------------------------- |
| `outputPath`            | `string`      | `'./output.mp4'` | Output file path                                                                 |
| `videoCodec`            | `string`      | `'libx264'`      | Video codec (`libx264`, `libx265`, `libvpx-vp9`, `prores_ks`, hardware encoders) |
| `crf`                   | `number`      | `23`             | Quality level (0-51, lower = better)                                             |
| `preset`                | `string`      | `'medium'`       | Encoding preset (`ultrafast` to `veryslow`)                                      |
| `videoBitrate`          | `string`      | -                | Target bitrate (e.g., `'5M'`). Overrides CRF.                                    |
| `audioCodec`            | `string`      | `'aac'`          | Audio codec (`aac`, `libmp3lame`, `libopus`, `flac`, `copy`)                     |
| `audioBitrate`          | `string`      | `'192k'`         | Audio bitrate                                                                    |
| `audioSampleRate`       | `number`      | `48000`          | Audio sample rate in Hz                                                          |
| `hwaccel`               | `string`      | `'none'`         | Hardware acceleration (`auto`, `videotoolbox`, `nvenc`, `vaapi`, `qsv`)          |
| `outputWidth`           | `number`      | -                | Scale output width                                                               |
| `outputHeight`          | `number`      | -                | Scale output height                                                              |
| `outputResolution`      | `string`      | -                | Resolution preset (`'720p'`, `'1080p'`, `'4k'`)                                  |
| `audioOnly`             | `boolean`     | `false`          | Export audio only (no video)                                                     |
| `twoPass`               | `boolean`     | `false`          | Two-pass encoding for better quality                                             |
| `metadata`              | `object`      | -                | Embed metadata (title, artist, etc.)                                             |
| `thumbnail`             | `object`      | -                | Generate thumbnail image                                                         |
| `verbose`               | `boolean`     | `false`          | Enable verbose logging                                                           |
| `saveCommand`           | `string`      | -                | Save FFmpeg command to file                                                      |
| `onProgress`            | `function`    | -                | Progress callback                                                                |
| `signal`                | `AbortSignal` | -                | Cancellation signal                                                              |
| `watermark`             | `object`      | -                | Add watermark overlay (see Watermarks section)                                   |
| `compensateTransitions` | `boolean`     | `true`           | Auto-adjust text timings for transition overlap (see below)                      |

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
  loop?: boolean;           // Loop audio to fill video duration
}
```

Background music is mixed after transitions, so video crossfades won't affect its volume.

**Looping Music:**

If your music track is shorter than your video, enable looping:

```ts
await project.load([
  { type: "video", url: "./video.mp4", position: 0, end: 120 },
  { type: "music", url: "./30s-track.mp3", volume: 0.3, loop: true },
]);
```

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
  mode?: "static" | "word-replace" | "word-sequential" | "karaoke";
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

  // Positioning (omit x/y to center)
  xPercent?: number;        // Horizontal position as % (0 = left, 0.5 = center, 1 = right)
  yPercent?: number;        // Vertical position as % (0 = top, 0.5 = center, 1 = bottom)
  x?: number;               // Absolute X position in pixels
  y?: number;               // Absolute Y position in pixels
  xOffset?: number;         // Pixel offset added to X (works with any positioning method)
  yOffset?: number;         // Pixel offset added to Y (e.g., center + 50px below)

  // Animation
  animation?: {
    type: "none" | "fade-in" | "fade-in-out" | "fade-out" | "pop" | "pop-bounce"
        | "typewriter" | "scale-in" | "pulse";
    in?: number;            // Intro duration (seconds)
    out?: number;           // Outro duration (seconds)
    speed?: number;         // For typewriter (chars/sec) or pulse (pulses/sec)
    intensity?: number;     // For scale-in or pulse (size variation 0-1)
  };

  highlightColor?: string;  // For karaoke mode (default: '#FFFF00')
  highlightStyle?: "smooth" | "instant";  // 'smooth' = gradual fill, 'instant' = immediate change (default: 'smooth')
}
```

#### Subtitle Clip

Import external subtitle files (SRT, VTT, ASS/SSA):

```ts
{
  type: "subtitle";
  url: string;              // Path to subtitle file
  position?: number;        // Time offset in seconds (default: 0)

  // Styling (for SRT/VTT - ASS files use their own styles)
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}
```

### Platform Presets

Use platform presets to quickly configure optimal dimensions for social media:

```ts
const project = new SIMPLEFFMPEG({ preset: "tiktok" });
```

Available presets:

| Preset               | Resolution  | Aspect Ratio | Use Case                |
| -------------------- | ----------- | ------------ | ----------------------- |
| `tiktok`             | 1080 × 1920 | 9:16         | TikTok, vertical videos |
| `youtube-short`      | 1080 × 1920 | 9:16         | YouTube Shorts          |
| `instagram-reel`     | 1080 × 1920 | 9:16         | Instagram Reels         |
| `instagram-story`    | 1080 × 1920 | 9:16         | Instagram Stories       |
| `snapchat`           | 1080 × 1920 | 9:16         | Snapchat                |
| `instagram-post`     | 1080 × 1080 | 1:1          | Instagram feed posts    |
| `instagram-square`   | 1080 × 1080 | 1:1          | Square format           |
| `youtube`            | 1920 × 1080 | 16:9         | YouTube standard        |
| `twitter`            | 1920 × 1080 | 16:9         | Twitter/X horizontal    |
| `facebook`           | 1920 × 1080 | 16:9         | Facebook horizontal     |
| `landscape`          | 1920 × 1080 | 16:9         | General landscape       |
| `twitter-portrait`   | 1080 × 1350 | 4:5          | Twitter portrait        |
| `instagram-portrait` | 1080 × 1350 | 4:5          | Instagram portrait      |

Override preset values with explicit options:

```ts
const project = new SIMPLEFFMPEG({
  preset: "tiktok",
  fps: 60, // Override default 30fps
});
```

Query available presets programmatically:

```ts
SIMPLEFFMPEG.getPresetNames(); // ['tiktok', 'youtube-short', ...]
SIMPLEFFMPEG.getPresets(); // { tiktok: { width: 1080, height: 1920, fps: 30 }, ... }
```

### Watermarks

Add text or image watermarks to your videos:

**Text Watermark:**

```ts
await project.export({
  outputPath: "./output.mp4",
  watermark: {
    type: "text",
    text: "@myhandle",
    position: "bottom-right", // 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
    fontSize: 24,
    fontColor: "#FFFFFF",
    opacity: 0.7,
    margin: 20,
  },
});
```

**Image Watermark:**

```ts
await project.export({
  outputPath: "./output.mp4",
  watermark: {
    type: "image",
    url: "./logo.png",
    position: "top-right",
    opacity: 0.8,
    scale: 0.5, // Scale to 50% of original size
    margin: 15,
  },
});
```

**Timed Watermark:**

```ts
await project.export({
  outputPath: "./output.mp4",
  watermark: {
    type: "text",
    text: "Limited Time!",
    position: "top-left",
    startTime: 5, // Appear at 5 seconds
    endTime: 15, // Disappear at 15 seconds
  },
});
```

**Custom Position:**

```ts
await project.export({
  outputPath: "./output.mp4",
  watermark: {
    type: "text",
    text: "Custom",
    x: 100, // Exact X position in pixels
    y: 50, // Exact Y position in pixels
  },
});
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

The library provides custom error classes for structured error handling:

| Error Class            | When Thrown                | Properties                                                                  |
| ---------------------- | -------------------------- | --------------------------------------------------------------------------- |
| `ValidationError`      | Invalid clip configuration | `errors[]`, `warnings[]` (structured issues with `code`, `path`, `message`) |
| `FFmpegError`          | FFmpeg command fails       | `stderr`, `command`, `exitCode`                                             |
| `MediaNotFoundError`   | File not found             | `path`                                                                      |
| `ExportCancelledError` | Export aborted             | -                                                                           |

```ts
try {
  await project.export({ outputPath: "./out.mp4" });
} catch (error) {
  if (error.name === "ValidationError") {
    // Structured validation errors
    error.errors.forEach((e) =>
      console.error(`[${e.code}] ${e.path}: ${e.message}`)
    );
    error.warnings.forEach((w) =>
      console.warn(`[${w.code}] ${w.path}: ${w.message}`)
    );
  } else if (error.name === "FFmpegError") {
    console.error("FFmpeg failed:", error.stderr);
    console.error("Command was:", error.command);
  } else if (error.name === "MediaNotFoundError") {
    console.error("File not found:", error.path);
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

### Text Positioning with Offsets

Text is centered by default. Use `xOffset` and `yOffset` to adjust position relative to any base:

```ts
await project.load([
  { type: "video", url: "./bg.mp4", position: 0, end: 10 },
  // Title: centered, 100px above center
  {
    type: "text",
    text: "Main Title",
    position: 0,
    end: 5,
    fontSize: 72,
    yOffset: -100,
  },
  // Subtitle: centered, 50px below center
  {
    type: "text",
    text: "Subtitle here",
    position: 0.5,
    end: 5,
    fontSize: 36,
    yOffset: 50,
  },
]);
```

Offsets work with all positioning methods (`x`/`y` pixels, `xPercent`/`yPercent`, or default center).

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

> **Note:** Ken Burns effects work best with images at least as large as your output resolution. Smaller images are automatically upscaled (with a validation warning about potential quality loss). Use `strictKenBurns: true` in validation options to enforce size requirements instead.

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

### Typewriter Text Effect

```ts
await project.load([
  { type: "video", url: "./bg.mp4", position: 0, end: 5 },
  {
    type: "text",
    text: "Appearing letter by letter...",
    position: 1,
    end: 4,
    fontSize: 48,
    fontColor: "white",
    animation: {
      type: "typewriter",
      speed: 15, // 15 characters per second
    },
  },
]);
```

### Pulsing Text Effect

```ts
await project.load([
  { type: "video", url: "./bg.mp4", position: 0, end: 5 },
  {
    type: "text",
    text: "Pulsing...",
    position: 0.5,
    end: 4.5,
    fontSize: 52,
    fontColor: "cyan",
    animation: {
      type: "pulse",
      speed: 2, // 2 pulses per second
      intensity: 0.2, // 20% size variation
    },
  },
]);
```

### Karaoke Text Effect

Create word-by-word highlighting like karaoke subtitles:

```ts
await project.load([
  { type: "video", url: "./music-video.mp4", position: 0, end: 10 },
  {
    type: "text",
    mode: "karaoke",
    text: "Never gonna give you up",
    position: 2,
    end: 6,
    fontColor: "#FFFFFF",
    highlightColor: "#FFFF00", // Words highlight to yellow
    fontSize: 48,
    yPercent: 0.85, // Position near bottom
  },
]);
```

With precise word timings:

```ts
await project.load([
  { type: "video", url: "./music-video.mp4", position: 0, end: 10 },
  {
    type: "text",
    mode: "karaoke",
    text: "Never gonna give you up",
    position: 0,
    end: 5,
    words: [
      { text: "Never", start: 0, end: 0.8 },
      { text: "gonna", start: 0.8, end: 1.4 },
      { text: "give", start: 1.4, end: 2.0 },
      { text: "you", start: 2.0, end: 2.5 },
      { text: "up", start: 2.5, end: 3.5 },
    ],
    fontColor: "#FFFFFF",
    highlightColor: "#00FF00",
    fontSize: 52,
  },
]);
```

With instant highlight (words change color immediately instead of gradual fill):

```ts
await project.load([
  { type: "video", url: "./music-video.mp4", position: 0, end: 10 },
  {
    type: "text",
    mode: "karaoke",
    text: "Each word pops instantly",
    position: 1,
    end: 5,
    fontColor: "#FFFFFF",
    highlightColor: "#FF00FF",
    highlightStyle: "instant", // Words change color immediately
    fontSize: 48,
  },
]);
```

Multi-line karaoke (use `\n` for line breaks):

```ts
await project.load([
  { type: "video", url: "./music-video.mp4", position: 0, end: 10 },
  {
    type: "text",
    mode: "karaoke",
    text: "First line of lyrics\nSecond line continues",
    position: 0,
    end: 6,
    fontColor: "#FFFFFF",
    highlightColor: "#FFFF00",
    fontSize: 36,
    yPercent: 0.8,
  },
]);
```

Or with explicit line breaks in the words array:

```ts
await project.load([
  { type: "video", url: "./music-video.mp4", position: 0, end: 10 },
  {
    type: "text",
    mode: "karaoke",
    text: "Hello World Goodbye World",
    position: 0,
    end: 4,
    words: [
      { text: "Hello", start: 0, end: 1 },
      { text: "World", start: 1, end: 2, lineBreak: true }, // Line break after this word
      { text: "Goodbye", start: 2, end: 3 },
      { text: "World", start: 3, end: 4 },
    ],
    fontColor: "#FFFFFF",
    highlightColor: "#00FF00",
  },
]);
```

### Import SRT/VTT Subtitles

Add existing subtitle files to your video:

```ts
await project.load([
  { type: "video", url: "./video.mp4", position: 0, end: 60 },
  {
    type: "subtitle",
    url: "./subtitles.srt", // or .vtt, .ass, .ssa
    fontSize: 24,
    fontColor: "#FFFFFF",
    borderColor: "#000000",
  },
]);
```

With time offset (shift subtitles forward):

```ts
await project.load([
  { type: "video", url: "./video.mp4", position: 0, end: 60 },
  {
    type: "subtitle",
    url: "./subtitles.srt",
    position: 2.5, // Delay subtitles by 2.5 seconds
  },
]);
```

### Using Platform Presets

```ts
// Create a TikTok-optimized video
const tiktok = new SIMPLEFFMPEG({ preset: "tiktok" });

await tiktok.load([
  { type: "video", url: "./vertical.mp4", position: 0, end: 15 },
  {
    type: "text",
    text: "Follow for more!",
    position: 12,
    end: 15,
    fontSize: 48,
    fontColor: "white",
    yPercent: 0.8,
    animation: { type: "pop-bounce", in: 0.3 },
  },
]);

await tiktok.export({
  outputPath: "./tiktok-video.mp4",
  watermark: {
    type: "text",
    text: "@myhandle",
    position: "bottom-right",
    opacity: 0.7,
  },
});
```

## Timeline Behavior

- Clip timing uses `[position, end)` intervals in seconds
- Transitions create overlaps that reduce total duration
- Background music is mixed after video transitions (unaffected by crossfades)

### Transition Compensation

FFmpeg's `xfade` transitions work by **overlapping** clips, which compresses the timeline. For example:

- Clip A: 0-10s
- Clip B: 10-20s with 1s fade transition
- **Actual output duration: 19s** (not 20s)

With multiple transitions, this compounds—10 clips with 0.5s transitions each would be ~4.5 seconds shorter than the sum of clip durations.

**Automatic Compensation (default):**

By default, simple-ffmpeg automatically adjusts text and subtitle timings to compensate for this compression. When you position text at "15s", it appears at the visual 15s mark in the output video, regardless of how many transitions have occurred.

```ts
// Text will appear at the correct visual position even with transitions
await project.load([
  { type: "video", url: "./a.mp4", position: 0, end: 10 },
  {
    type: "video",
    url: "./b.mp4",
    position: 10,
    end: 20,
    transition: { type: "fade", duration: 1 },
  },
  { type: "text", text: "Appears at 15s visual", position: 15, end: 18 },
]);
```

**Disabling Compensation:**

If you need raw timeline positioning (e.g., you've pre-calculated offsets yourself):

```ts
await project.export({
  outputPath: "./output.mp4",
  compensateTransitions: false, // Use raw timestamps
});
```

## Auto-Batching for Complex Filter Graphs

FFmpeg's `filter_complex` has platform-specific length limits (Windows ~32KB, macOS ~1MB, Linux ~2MB). When text animations like typewriter create many filter nodes, the command can exceed these limits.

**simple-ffmpeg automatically handles this:**

1. **Auto-detection**: Before running FFmpeg, the library checks if the filter graph exceeds a safe 100KB limit
2. **Smart batching**: If too long, text overlays are rendered in multiple passes with intermediate files
3. **Optimal batch sizing**: Calculates the ideal number of nodes per pass based on actual filter complexity

This happens transparently—you don't need to configure anything. For very complex projects, you can tune it manually:

```js
await project.export({
  outputPath: "./output.mp4",
  // Lower this if you have many complex text animations
  textMaxNodesPerPass: 30, // default: 75
  // Intermediate encoding settings (used between passes)
  intermediateVideoCodec: "libx264", // default
  intermediateCrf: 18, // default (high quality)
  intermediatePreset: "veryfast", // default (fast encoding)
});
```

**When batching activates:**

- Typewriter animations with long text (creates one filter node per character)
- Many simultaneous text overlays
- Complex animation combinations

With `verbose: true`, you'll see when auto-batching kicks in:

```
simple-ffmpeg: Auto-batching text (filter too long: 150000 > 100000). Using 35 nodes per pass.
```

## Real-World Usage Patterns

### Data Pipeline Example

Generate videos programmatically from structured data (JSON, database, API, CMS):

```js
const SIMPLEFFMPEG = require("simple-ffmpegjs");

// Your data source - could be database records, API response, etc.
const quotes = [
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  { text: "Move fast and break things.", author: "Mark Zuckerberg" },
];

async function generateQuoteVideo(quote, outputPath) {
  const clips = [
    { type: "video", url: "./backgrounds/default.mp4", position: 0, end: 5 },
    {
      type: "text",
      text: `"${quote.text}"`,
      position: 0.5,
      end: 4,
      fontSize: 42,
      fontColor: "#FFFFFF",
      yPercent: 0.4,
      animation: { type: "fade-in", in: 0.3 },
    },
    {
      type: "text",
      text: `— ${quote.author}`,
      position: 1.5,
      end: 4.5,
      fontSize: 28,
      fontColor: "#CCCCCC",
      yPercent: 0.6,
      animation: { type: "fade-in", in: 0.3 },
    },
  ];

  const project = new SIMPLEFFMPEG({ preset: "tiktok" });
  await project.load(clips);
  return project.export({ outputPath });
}

// Batch process all quotes
for (const [i, quote] of quotes.entries()) {
  await generateQuoteVideo(quote, `./output/quote-${i + 1}.mp4`);
}
```

### AI Generation with Validation Loop

The structured validation with error codes makes it easy to build AI feedback loops:

```js
const SIMPLEFFMPEG = require("simple-ffmpegjs");

async function generateVideoWithAI(prompt) {
  let config = await ai.generateVideoConfig(prompt);
  let result = SIMPLEFFMPEG.validate(config, { skipFileChecks: true });
  let retries = 0;

  // Let AI fix its own mistakes
  while (!result.valid && retries < 3) {
    // Feed structured errors back to AI for correction
    config = await ai.fixConfig(config, result.errors);
    result = SIMPLEFFMPEG.validate(config, { skipFileChecks: true });
    retries++;
  }

  if (!result.valid) {
    throw new Error("AI failed to generate valid config");
  }

  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920 });
  await project.load(config);
  return project.export({ outputPath: "./output.mp4" });
}
```

Each validation error includes a `code` (e.g., `INVALID_TIMELINE`, `MISSING_REQUIRED`) and `path` (e.g., `clips[2].position`) for precise AI feedback.

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

This creates example videos in `examples/output/` covering:

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
- Word-by-word text
- Platform presets (TikTok, YouTube, etc.)
- Typewriter text animation
- Scale-in text animation
- Pulse text animation
- Fade-out text animation
- Text watermarks
- Image watermarks
- Timed watermarks
- Karaoke text (word-by-word highlighting)
- SRT/VTT subtitle import

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
