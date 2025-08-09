# simple-ffmpeg 🎬

Simple lightweight Node.js helper around FFmpeg for quick video composition, transitions, audio mixing, and animated text overlays.

## 🙌 Credits

Huge shoutout to the original inspiration for this library:

- John Chen (coldshower): https://github.com/coldshower
- ezffmpeg: https://github.com/ezffmpeg/ezffmpeg

This project builds on those ideas and extends them with a few opinionated defaults and features to make common video tasks easier.

## ✨ Why this project

Built for data pipelines: a tiny helper around FFmpeg that makes common edits trivial—clip concatenation with transitions, flexible text overlays, images with Ken Burns effects, and reliable audio mixing—without hiding FFmpeg. It favors safe defaults, scales to long scripts, and stays dependency‑free.

- ✅ Simple API for building FFmpeg filter graphs
- 🎞️ Concatenate clips with optional transitions (xfade)
- 🔊 Mix multiple audio sources and add background music (not affected by transition fades)
- 📝 Text overlays (static, word-by-word, cumulative) with opt-in animations (fade-in, pop, pop-bounce)
- 🧰 Safe defaults + guardrails (basic validation, media bounds clamping)
- 🧱 Scales to long scripts via optional multi-pass text batching
- 🧩 Ships TypeScript definitions without requiring TS
- 🪶 No external libraries (other than FFmpeg), no bundled fonts; extremely lightweight
- 🧑‍💻 Actively maintained; PRs and issues welcome
- 🖼️ Image support with Ken Burns (zoom-in/out, pan-left/right/up/down)

## 📦 Install

```bash
npm install simple-ffmpeg
```

## ⚙️ Requirements

Make sure you have ffmpeg installed on your system:

**Mac**: brew install ffmpeg

**Ubuntu/Debian**: apt-get install ffmpeg

**Windows**: Download from ffmpeg.org

Ensure `ffmpeg` and `ffprobe` are installed and available on your PATH.

For text overlays with `drawtext`, use an FFmpeg build that includes libfreetype and fontconfig. Make sure a system font is present so `font=Sans` resolves, or provide `fontFile`. Minimal containers often lack fonts, so install one explicitly.

### Examples:

Debian/Ubuntu:

```bash
apt-get update && apt-get install -y ffmpeg fontconfig fonts-dejavu-core
```

Alpine:

```bash
apk add --no-cache ffmpeg fontconfig ttf-dejavu
```

## 🚀 Quick start

```js
const SIMPLEFFMPEG = require("simple-ffmpeg");

(async () => {
  const project = new SIMPLEFFMPEG({ width: 1080, height: 1920, fps: 30 });

  await project.load([
    { type: "video", url: "./vids/a.mp4", position: 0, end: 5 },
    {
      type: "video",
      url: "./vids/b.mp4",
      position: 5,
      end: 10,
      transition: { type: "fade-in", duration: 0.5 },
    },
    { type: "music", url: "./audio/bgm.wav", volume: 0.2 },
    {
      type: "text",
      text: "Hello world",
      position: 1,
      end: 3,
      fontColor: "white",
    },
  ]);

  await project.export({ outputPath: "./output.mp4" });
})();
```

## 📚 Examples

- 🎞️ Two clips + fade transition + background music

```js
await project.load([
  { type: "video", url: "./a.mp4", position: 0, end: 5 },
  {
    type: "video",
    url: "./b.mp4",
    position: 5,
    end: 10,
    transition: { type: "fade-in", duration: 0.4 },
  },
  { type: "music", url: "./bgm.wav", volume: 0.18 },
]);
```

- 📝 Static text (centered by default)

```js
await project.load([
  { type: "video", url: "./clip.mp4", position: 0, end: 5 },
  {
    type: "text",
    text: "Static Title",
    position: 0.5,
    end: 2.5,
    fontColor: "white",
  },
]);
```

- 🔤 Word-by-word replacement with fade-in

```js
await project.load([
  {
    type: "text",
    mode: "word-replace",
    position: 2.0,
    end: 4.0,
    fontColor: "#00ffff",
    centerX: 0,
    centerY: -350,
    animation: { type: "fade-in-out", in: 0.4, out: 0.4 },
    words: [
      { text: "One", start: 2.0, end: 2.5 },
      { text: "Two", start: 2.5, end: 3.0 },
      { text: "Three", start: 3.0, end: 3.5 },
      { text: "Four", start: 3.5, end: 4.0 },
    ],
  },
]);
```

- 🔠 Word-by-word (auto) with pop-bounce

```js
await project.load([
  {
    type: "text",
    mode: "word-replace",
    text: "Alpha Beta Gamma Delta",
    position: 4.0,
    end: 6.0,
    fontSize: 64,
    fontColor: "yellow",
    centerX: 0,
    centerY: -100,
    animation: { type: "fade-in-out", in: 0.4, out: 0.4 },
    wordTimestamps: [4.0, 4.5, 5.0, 5.5, 6.0],
  },
]);
```

- 🎧 Standalone audio overlay

```js
await project.load([
  { type: "audio", url: "./vo.mp3", position: 0, end: 10, volume: 1 },
]);
```

- 🖼️ Images with Ken Burns (zoom + pan)

```js
await project.load([
  // Zoom-in image (2s)
  {
    type: "image",
    url: "./img.png",
    position: 10,
    end: 12,
    kenBurns: { type: "zoom-in", strength: 0.12 },
  },
  // Pan-right image (2s)
  {
    type: "image",
    url: "./img.png",
    position: 12,
    end: 14,
    kenBurns: { type: "pan-right", strength: 0.2 },
  },
]);
```

## 🧠 Behavior (in short)

- Timeline uses clip `[position, end)`; transitions are overlaps that reduce total duration by their length
- Background music is mixed after other audio, so transition acrossfades don’t attenuate it
- Clip audio is timeline-aligned (absolute position) and mixed once; avoids early starts and gaps around transitions
- Text animations are opt-in (none by default)
- For big scripts, text rendering can be batched into multiple passes automatically
- Visual gaps are not allowed: if there’s any gap with no video/image between clips (or at the very start), validation throws

## 🔌 API (at a glance)

- `new SIMPLEFFMPEG({ width?, height?, fps?, validationMode? })`
- `await project.load([...clips])` — video/audio/text/music descriptors
- `await project.export({ outputPath?, textMaxNodesPerPass? })`

That’s it—keep it simple. See the examples above for common cases.

## 🔬 API Details

### Constructor

```ts
new SIMPLEFFMPEG(options?: {
  fps?: number;           // default 30
  width?: number;         // default 1920
  height?: number;        // default 1080
  validationMode?: 'warn' | 'strict'; // default 'warn'
});
```

### project.load(clips)

Loads and pre-validates clips. Accepts an array of clip descriptors (video, audio, background music, text). Returns a Promise that resolves when inputs are prepared (e.g., metadata read, rotation handled later at export).

```ts
await project.load(clips: Clip[]);
```

#### Clip union

```ts
type Clip = VideoClip | AudioClip | BackgroundMusicClip | ImageClip | TextClip;
```

#### Video clip

```ts
interface VideoClip {
  type: "video";
  url: string; // input video file path/URL
  position: number; // timeline start (seconds)
  end: number; // timeline end (seconds)
  cutFrom?: number; // source offset (seconds), default 0
  volume?: number; // if the source has audio, default 1
  transition?: {
    // optional transition at the boundary before this clip
    type: string; // e.g., 'fade', 'wipeleft', etc. (xfade transitions)
    duration: number; // in seconds
  };
}
```

Notes:

- All xfade transitions are supported you can see a list of them [here](https://trac.ffmpeg.org/wiki/Xfade)
- Each transition reduces total output duration by its duration (overlap semantics).
- Rotation metadata is handled automatically before export.

#### Audio clip (standalone)

```ts
interface AudioClip {
  type: "audio";
  url: string;
  position: number; // timeline start
  end: number; // timeline end
  cutFrom?: number; // default 0
  volume?: number; // default 1
}
```

#### Background music clip

```ts
interface BackgroundMusicClip {
  type: "music" | "backgroundAudio";
  url: string;
  position?: number; // default 0
  end?: number; // default project duration (video timeline)
  cutFrom?: number; // default 0
  volume?: number; // default 0.2
}
```

Notes:

- Mixed after other audio and after acrossfades, so transition fades do not attenuate the background music.
- If no videos exist, `end` defaults to the max provided among BGM clips.

#### Text clip

```ts
interface TextClip {
  type: "text";
  // Time window
  position: number; // start on timeline
  end: number; // end on timeline

  // Content & modes
  text?: string; // used for 'static' and as source when auto-splitting words
  mode?: "static" | "word-replace" | "word-sequential";

  // Word timing (choose one form)
  words?: Array<{ text: string; start: number; end: number }>; // explicit per-word timing (absolute seconds)
  wordTimestamps?: number[]; // timestamps to split `text` by whitespace; N or N+1 entries

  // Font & styling
  fontFile?: string; // overrides fontFamily
  fontFamily?: string; // default 'Sans' (fontconfig)
  fontSize?: number; // default 48
  fontColor?: string; // default '#FFFFFF'

  // Positioning (center by default)
  centerX?: number; // pixel offset from center (x)
  centerY?: number; // pixel offset from center (y)
  x?: number; // absolute x (left)
  y?: number; // absolute y (top)

  // Animation (opt-in)
  animation?: {
    type: "none" | "fade-in" | "fade-in-out" | "pop" | "pop-bounce"; // default 'none'
    in?: number; // seconds for intro phase (e.g., fade-in duration)
  };
}
```

Notes:

- If both `words` and `wordTimestamps` are provided, `words` takes precedence.
- For `wordTimestamps` with a single array: provide either per-word start times (end inferred by next start), or N+1 edge times; whitespace in `text` defines words.
- Defaults to centered placement if no explicit `x/y` or `centerX/centerY` provided.

#### Image clip

```ts
interface ImageClip {
  type: "image";
  url: string;
  position: number; // timeline start
  end: number; // timeline end
  kenBurns?: {
    type:
      | "zoom-in"
      | "zoom-out"
      | "pan-left"
      | "pan-right"
      | "pan-up"
      | "pan-down";
    strength?: number; // 0..0.5 approx; zoom amount or pan distance
  };
}
```

Notes:

- Images are treated as video streams. Ken Burns uses `zoompan` internally with the correct frame count.
- For pan-only moves, a small base zoom is applied so there’s room to pan across.

### project.export(options)

Builds and runs the FFmpeg command. Returns the final `outputPath`.

```ts
await project.export(options?: {
  outputPath?: string;          // default './output.mp4'
  textMaxNodesPerPass?: number; // default 75 (batch size for multi-pass text)
  intermediateVideoCodec?: string; // default 'libx264' (for text passes)
  intermediateCrf?: number;     // default 18 (for text passes)
  intermediatePreset?: string;  // default 'veryfast' (for text passes)
}): Promise<string>;
```

Behavior:

- If text overlay count exceeds `textMaxNodesPerPass`, text is rendered in multiple passes using temporary files; audio is copied between passes; final output is fast-start.
- Mapping: final video/audio streams are mapped based on what exists; if only audio or only video is present, mapping adapts accordingly.

### Timeline semantics

- Each clip contributes `[position, end)` to the timeline.
- For transitions, the overlap reduces the final output duration by the transition duration.
- Background music defaults to the visual timeline end (max `end` across video/image clips) and is mixed after other audio and acrossfades.

### Animations

- `none` (default): plain text, no animation
- `fade-in`: alpha 0 → 1 over `in` seconds (e.g., 0.25–0.4)
- `fade-in-out`: alpha 0 → 1 over `in` seconds, then 1 → 0 over `out` seconds approaching the end
- `pop`: font size scales from ~70% → 100% over `in` seconds
- `pop-bounce`: scales ~70% → 110% during `in`, then settles to 100%

Tip: small `in` values (0.2–0.4s) feel snappy for word-by-word displays.

## 🤝 Contributing

- PRs and issues welcome
- Actively being worked on; I’ll review new contributions and iterate

## 🗺️ Roadmap

- Visual gap handling (opt-in fillers): optional `fillVisualGaps: 'none' | 'black'` if requested
- Additional text effects (typewriter, word-by-word fade-out variants, outlines/shadows presets)
- Image effects presets (Ken Burns paths presets, ease functions)
- Export options for different containers/codecs (HEVC, VP9/AV1, audio-only)
- Better error reporting with command dump helpers
- CLI wrapper for quick local use
- Performance: smarter batching and parallel intermediate renders

## 📜 License

MIT
