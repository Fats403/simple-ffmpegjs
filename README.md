<p align="center">
  <img src="https://7llpl63xkl8jovgt.public.blob.vercel-storage.com/simple-ffmpeg/zENiV5XBIET_cu11ZpOdE.png" alt="simple-ffmpeg" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/simple-ffmpegjs"><img src="https://img.shields.io/npm/v/simple-ffmpegjs.svg" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js"></a>
</p>

<p align="center">
  A lightweight Node.js library for programmatic video composition using FFmpeg.<br>
  Define your timeline as a simple array of clips, and the library handles the rest.
</p>

## Table of Contents

- [Why simple-ffmpeg?](#why-simple-ffmpeg)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Pre-Validation](#pre-validation)
- [Schema Export](#schema-export)
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
  - [Clips & Transitions](#clips--transitions)
  - [Text & Animations](#text--animations)
  - [Karaoke](#karaoke)
  - [Subtitles](#subtitles)
  - [Export Settings](#export-settings)
- [Real-World Usage Patterns](#real-world-usage-patterns)
  - [Data Pipeline](#data-pipeline-example)
  - [AI Video Pipeline](#ai-video-generation-pipeline-example)
- [Advanced](#advanced)
  - [Timeline Behavior](#timeline-behavior)
  - [Auto-Batching](#auto-batching)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Why simple-ffmpeg?

FFmpeg is incredibly powerful, but its command-line interface is notoriously difficult to work with programmatically. Composing even a simple two-clip video with a crossfade requires navigating complex filter graphs, input mapping, and stream labeling. simple-ffmpeg abstracts all of that behind a declarative, config-driven API. You describe _what_ your video should look like, and the library figures out _how_ to build the FFmpeg command.

The entire timeline is expressed as a plain array of clip objects, making it straightforward to generate configurations from any data source: databases, APIs, templates, or AI models. Structured validation with machine-readable error codes means you can catch problems early and handle them programmatically, whether that's logging a warning, retrying with corrected input, or surfacing feedback to an end user.

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
- **Schema Export** — Generate a structured description of the clip format for documentation, code generation, or AI context
- **Pre-Validation** — Validate clip configurations before processing with structured, machine-readable error codes
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

// Use a platform preset — or set width/height/fps manually
const project = new SIMPLEFFMPEG({ preset: "youtube" });

await project.load([
  // Two video clips with a crossfade transition between them
  { type: "video", url: "./opening-shot.mp4", position: 0, end: 6 },
  {
    type: "video",
    url: "./highlights.mp4",
    position: 5.5,
    end: 18,
    cutFrom: 3, // start 3s into the source file
    transition: { type: "fade", duration: 0.5 },
  },

  // Title card with a pop animation
  {
    type: "text",
    text: "Summer Highlights 2025",
    position: 0.5,
    end: 4,
    fontFile: "./fonts/Montserrat-Bold.ttf",
    fontSize: 72,
    fontColor: "#FFFFFF",
    borderColor: "#000000",
    borderWidth: 2,
    xPercent: 0.5,
    yPercent: 0.4,
    animation: { type: "pop", in: 0.3 },
  },

  // Background music — loops to fill the whole video
  { type: "music", url: "./chill-beat.mp3", volume: 0.2, loop: true },
]);

await project.export({
  outputPath: "./summer-highlights.mp4",
  onProgress: ({ percent }) => console.log(`${percent}% complete`),
});
```

## Pre-Validation

Validate clip configurations before creating a project. Useful for catching errors early in data pipelines, form-based editors, or any workflow where configurations are generated dynamically:

```js
import SIMPLEFFMPEG from "simple-ffmpegjs";

const clips = [
  { type: "video", url: "./intro.mp4", position: 0, end: 5 },
  { type: "text", text: "Hello", position: 1, end: 4 },
];

// Validate without creating a project
const result = SIMPLEFFMPEG.validate(clips, {
  skipFileChecks: true, // Skip file existence checks (useful when files aren't on disk yet)
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

## Schema Export

Export a structured, human-readable description of all clip types accepted by `load()`. The output is designed to serve as context for LLMs, documentation generators, code generation tools, or anything that needs to understand the library's clip format.

### Basic Usage

```js
// Get the full schema (all clip types)
const schema = SIMPLEFFMPEG.getSchema();
console.log(schema);
```

The output is a formatted text document with type definitions, allowed values, usage notes, and examples for each clip type.

### Filtering Modules

The schema is broken into modules — one per clip type. You can include or exclude modules to control exactly what appears in the output:

```js
// Only include video and image clip types
const schema = SIMPLEFFMPEG.getSchema({ include: ["video", "image"] });

// Include everything except text and subtitle
const schema = SIMPLEFFMPEG.getSchema({ exclude: ["text", "subtitle"] });

// See all available module IDs
SIMPLEFFMPEG.getSchemaModules();
// ['video', 'audio', 'image', 'text', 'subtitle', 'music']
```

Available modules:

| Module     | Covers                                                      |
| ---------- | ----------------------------------------------------------- |
| `video`    | Video clips, transitions, volume, trimming                  |
| `audio`    | Standalone audio clips                                      |
| `image`    | Image clips, Ken Burns effects                              |
| `text`     | Text overlays — all modes, animations, positioning, styling |
| `subtitle` | Subtitle file import (SRT, VTT, ASS, SSA)                   |
| `music`    | Background music / background audio, looping                |

### Custom Instructions

Embed your own instructions directly into the schema output. Top-level instructions appear at the beginning, and per-module instructions are placed inside the relevant section — formatted identically to the built-in notes:

```js
const schema = SIMPLEFFMPEG.getSchema({
  include: ["video", "image", "music"],
  instructions: [
    "You are creating short cooking tutorials for TikTok.",
    "Keep all videos under 30 seconds.",
  ],
  moduleInstructions: {
    video: [
      "Always use fade transitions at 0.5s.",
      "Limit to 5 clips maximum.",
    ],
    music: "Always include background music at volume 0.15.",
  },
});
```

Both `instructions` and `moduleInstructions` values accept a `string` or `string[]`. Per-module instructions for excluded modules are silently ignored.

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

### Clips & Transitions

```ts
// Two clips with a crossfade
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

**Image slideshow with Ken Burns effects:**

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

> **Note:** Ken Burns effects work best with images at least as large as your output resolution. Smaller images are automatically upscaled (with a validation warning). Use `strictKenBurns: true` in validation options to enforce size requirements instead.

### Text & Animations

Text is centered by default. Use `xPercent`/`yPercent` for percentage positioning, `x`/`y` for pixels, or `xOffset`/`yOffset` to nudge from any base:

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

**Word-by-word replacement:**

```ts
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
}
```

**Typewriter, pulse, and other animations:**

```ts
// Typewriter — letters appear one at a time
{ type: "text", text: "Appearing letter by letter...", position: 1, end: 4,
  animation: { type: "typewriter", speed: 15 } }

// Pulse — rhythmic scaling
{ type: "text", text: "Pulsing...", position: 0.5, end: 4.5,
  animation: { type: "pulse", speed: 2, intensity: 0.2 } }

// Also available: fade-in, fade-out, fade-in-out, pop, pop-bounce, scale-in
```

### Karaoke

Word-by-word highlighting with customizable colors. Use `highlightStyle: "instant"` for immediate color changes instead of the default smooth fill:

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
    yPercent: 0.85,
  },
]);
```

For simple usage without explicit word timings, just provide `text` and `wordTimestamps` — the library will split on spaces. Multi-line karaoke is supported with `\n` in the text string or `lineBreak: true` in the words array.

### Subtitles

Import external subtitle files (SRT, VTT, ASS/SSA):

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

Use `position` to offset all subtitle timestamps forward (e.g., `position: 2.5` delays everything by 2.5s). ASS/SSA files use their own embedded styles — font options are for SRT/VTT imports.

### Export Settings

```ts
// High-quality H.265 with metadata
await project.export({
  outputPath: "./output.mp4",
  videoCodec: "libx265",
  crf: 18,
  preset: "slow",
  audioCodec: "libopus",
  audioBitrate: "256k",
  metadata: { title: "My Video", artist: "My Name", date: "2025" },
});

// Hardware-accelerated (macOS)
await project.export({
  outputPath: "./output.mp4",
  hwaccel: "videotoolbox",
  videoCodec: "h264_videotoolbox",
});

// Two-pass encoding for target file size
await project.export({
  outputPath: "./output.mp4",
  twoPass: true,
  videoBitrate: "5M",
  preset: "slow",
});

// Scale output resolution
await project.export({ outputPath: "./720p.mp4", outputResolution: "720p" });

// Audio-only export
await project.export({
  outputPath: "./audio.mp3",
  audioOnly: true,
  audioCodec: "libmp3lame",
  audioBitrate: "320k",
});

// Generate thumbnail
await project.export({
  outputPath: "./output.mp4",
  thumbnail: { outputPath: "./thumb.jpg", time: 5, width: 640 },
});

// Debug — save the FFmpeg command to a file
await project.export({
  outputPath: "./output.mp4",
  verbose: true,
  saveCommand: "./ffmpeg-command.txt",
});
```

## Advanced

### Timeline Behavior

- Clip timing uses `[position, end)` intervals in seconds
- Transitions create overlaps that reduce total duration
- Background music is mixed after video transitions (unaffected by crossfades)

**Transition Compensation:**

FFmpeg's `xfade` transitions **overlap** clips, compressing the timeline. A 1s fade between two 10s clips produces 19s of output, not 20s. With multiple transitions this compounds.

By default, simple-ffmpeg automatically adjusts text and subtitle timings to compensate. When you position text at "15s", it appears at the visual 15s mark regardless of how many transitions preceded it:

```ts
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

Disable with `compensateTransitions: false` in export options if you've pre-calculated offsets yourself.

### Auto-Batching

FFmpeg's `filter_complex` has platform-specific length limits (Windows ~32KB, macOS ~1MB, Linux ~2MB). When text animations create many filter nodes, the command can exceed these limits.

simple-ffmpeg handles this automatically — detecting oversized filter graphs and splitting text overlays into multiple rendering passes with intermediate files. No configuration needed.

For very complex projects, you can tune it:

```js
await project.export({
  textMaxNodesPerPass: 30, // default: 75
  intermediateVideoCodec: "libx264", // default
  intermediateCrf: 18, // default (high quality)
  intermediatePreset: "veryfast", // default (fast encoding)
});
```

Batching activates for typewriter animations with long text, many simultaneous text overlays, or complex animation combinations. With `verbose: true`, you'll see when it kicks in.

## Real-World Usage Patterns

### Data Pipeline Example

Generate videos programmatically from structured data — database records, API responses, CMS content, etc. This example creates property tour videos from real estate listings:

```js
import SIMPLEFFMPEG from "simple-ffmpegjs";

const listings = await db.getActiveListings(); // your data source

async function generateListingVideo(listing, outputPath) {
  const photos = listing.photos; // ['kitchen.jpg', 'living-room.jpg', ...]
  const slideDuration = 4;

  // Build an image slideshow from listing photos
  const photoClips = photos.map((photo, i) => ({
    type: "image",
    url: photo,
    position: i * slideDuration,
    end: (i + 1) * slideDuration,
    kenBurns: i % 2 === 0 ? "zoom-in" : "pan-right",
  }));

  const totalDuration = photos.length * slideDuration;

  const clips = [
    ...photoClips,
    // Price banner
    {
      type: "text",
      text: listing.price,
      position: 0.5,
      end: totalDuration - 0.5,
      fontSize: 36,
      fontColor: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 0.6,
      padding: 12,
      xPercent: 0.5,
      yPercent: 0.1,
    },
    // Address at the bottom
    {
      type: "text",
      text: listing.address,
      position: 0.5,
      end: totalDuration - 0.5,
      fontSize: 28,
      fontColor: "#FFFFFF",
      borderColor: "#000000",
      borderWidth: 2,
      xPercent: 0.5,
      yPercent: 0.9,
    },
    { type: "music", url: "./assets/ambient.mp3", volume: 0.15, loop: true },
  ];

  const project = new SIMPLEFFMPEG({ preset: "instagram-reel" });
  await project.load(clips);
  return project.export({ outputPath });
}

// Batch generate videos for all listings
for (const listing of listings) {
  await generateListingVideo(listing, `./output/${listing.id}.mp4`);
}
```

### AI Video Generation Pipeline Example

Combine schema export, validation, and structured error codes to build a complete AI-driven video generation pipeline. The schema gives the model the exact specification it needs, and the validation loop lets it self-correct until the output is valid.

```js
import SIMPLEFFMPEG from "simple-ffmpegjs";

// 1. Build the schema context for the AI
// Only expose the clip types you want the AI to work with.
// Developer-level config (codecs, resolution, etc.) stays out of the schema.

const schema = SIMPLEFFMPEG.getSchema({
  include: ["video", "image", "text", "music"],
  instructions: [
    "You are composing a short-form video for TikTok.",
    "Keep total duration under 30 seconds.",
    "Return ONLY valid JSON — an array of clip objects.",
  ],
  moduleInstructions: {
    video: "Use fade transitions between clips. Keep each clip 3-6 seconds.",
    text: [
      "Add a title in the first 2 seconds with fontSize 72.",
      "Use white text with a black border for readability.",
    ],
    music: "Always include looping background music at volume 0.15.",
  },
});

// 2. Send the schema + prompt to your LLM

async function askAI(systemPrompt, userPrompt) {
  // Replace with your LLM provider (OpenAI, Anthropic, etc.)
  const response = await llm.chat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return JSON.parse(response.content);
}

// 3. Generate → Validate → Retry loop

async function generateVideo(userPrompt, media) {
  // Build the system prompt with schema + available media and their details.
  // Descriptions and durations help the AI make good creative decisions —
  // ordering clips logically, setting accurate position/end times, etc.
  const mediaList = media
    .map((m) => `  - ${m.file} (${m.duration}s) — ${m.description}`)
    .join("\n");

  const systemPrompt = [
    "You are a video editor. Given the user's request and the available media,",
    "produce a clips array that follows this schema:\n",
    schema,
    "\nAvailable media (use these exact file paths):",
    mediaList,
  ].join("\n");

  const knownPaths = media.map((m) => m.file);

  // First attempt
  let clips = await askAI(systemPrompt, userPrompt);
  let result = SIMPLEFFMPEG.validate(clips, { skipFileChecks: true });
  let attempts = 1;

  // Self-correction loop: feed structured errors back to the AI
  while (!result.valid && attempts < 3) {
    const errorFeedback = result.errors
      .map((e) => `[${e.code}] ${e.path}: ${e.message}`)
      .join("\n");

    clips = await askAI(
      systemPrompt,
      [
        `Your previous output had validation errors:\n${errorFeedback}`,
        `\nOriginal request: ${userPrompt}`,
        "\nPlease fix the errors and return the corrected clips array.",
      ].join("\n")
    );

    result = SIMPLEFFMPEG.validate(clips, { skipFileChecks: true });
    attempts++;
  }

  if (!result.valid) {
    throw new Error(
      `Failed to generate valid config after ${attempts} attempts:\n` +
        SIMPLEFFMPEG.formatValidationResult(result)
    );
  }

  // 4. Verify the AI only used known media paths
  // The structural loop (skipFileChecks: true) can't catch hallucinated paths.
  // You could also put this inside the retry loop to let the AI self-correct
  // bad paths — just append the unknown paths to the error feedback string.

  const usedPaths = clips.filter((c) => c.url).map((c) => c.url);
  const unknownPaths = usedPaths.filter((p) => !knownPaths.includes(p));
  if (unknownPaths.length > 0) {
    throw new Error(`AI used unknown media paths: ${unknownPaths.join(", ")}`);
  }

  // 5. Build and export
  // load() will also throw MediaNotFoundError if any file is missing on disk.

  const project = new SIMPLEFFMPEG({ preset: "tiktok" });
  await project.load(clips);

  return project.export({
    outputPath: "./output.mp4",
    onProgress: ({ percent }) => console.log(`Rendering: ${percent}%`),
  });
}

// Usage

await generateVideo("Make a hype travel montage with upbeat text overlays", [
  {
    file: "clips/beach-drone.mp4",
    duration: 4,
    description:
      "Aerial drone shot of a tropical beach with people playing volleyball",
  },
  {
    file: "clips/city-timelapse.mp4",
    duration: 8,
    description: "Timelapse of a city skyline transitioning from day to night",
  },
  {
    file: "clips/sunset.mp4",
    duration: 6,
    description: "Golden hour sunset over the ocean with gentle waves",
  },
  {
    file: "music/upbeat-track.mp3",
    duration: 120,
    description:
      "Upbeat electronic track with a strong beat, good for montages",
  },
]);
```

The key parts of this pattern:

1. **`getSchema()`** gives the AI a precise specification of what it can produce, with only the clip types you've chosen to expose.
2. **`instructions` / `moduleInstructions`** embed your creative constraints directly into the spec — the AI treats them the same as built-in rules.
3. **Media descriptions** with durations and content details give the AI enough context to make good creative decisions — ordering clips logically, setting accurate timings, and choosing the right media for each part of the video.
4. **`validate()`** with `skipFileChecks: true` checks structural correctness in the retry loop — types, timelines, required fields — without touching the filesystem.
5. **The retry loop** lets the AI self-correct. Most validation failures resolve in one retry.
6. **The path guard** catches hallucinated file paths before `load()` hits the filesystem. You can optionally move this check inside the retry loop to let the AI self-correct bad paths. `load()` itself will also throw `MediaNotFoundError` if a file is missing on disk.

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
