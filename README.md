# simple-ffmpeg (SIMPLEFFMPEG)

A small Node.js helper around ffmpeg to make simple video compositions easy:

- Concatenate video clips with optional transitions (xfade)
- Combine clip audio and standalone audio
- Add background music that isn’t affected by transition audio fades
- Render text overlays (static, word-by-word replacement, cumulative), with opt-in animations: fade-in, pop, pop-bounce

This library builds a single ffmpeg command using a filter graph under the hood and executes it for you.

## Requirements

- ffmpeg and ffprobe on PATH
- For text rendering via `drawtext`:
  - ffmpeg built with libfreetype + fontconfig
  - A system font installed so `font=Sans` resolves, or provide `fontFile`
  - Minimal containers (e.g., Alpine) usually need fonts installed:
    - Debian/Ubuntu: `apt-get update && apt-get install -y fontconfig fonts-dejavu-core`
    - Alpine: `apk add --no-cache fontconfig ttf-dejavu`

## Install

```bash
npm install simple-ffmpeg
```

## Quick start

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
      transition: { type: "fade", duration: 0.5 },
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

## API

### Constructor

```js
new SIMPLEFFMPEG({
  fps?: number = 30,
  width?: number = 1920,
  height?: number = 1080,
  validationMode?: 'warn' | 'strict' = 'warn',
});
```

### project.load(clips: Clip[])

Loads and validates media/text clips. Returns a Promise that resolves when everything is ready.

### project.export({ outputPath?: string, ... })

Builds the ffmpeg filter graph and writes the output file. Returns a Promise with the `outputPath`.

## Clips

All clips have a `type` field.

### Video clip

```ts
{
  type: 'video',
  url: string,
  position: number,     // timeline start (seconds)
  end: number,          // timeline end (seconds)
  cutFrom?: number,     // source offset (seconds); default 0
  transition?: { type: string, duration: number },
}
```

### Audio clip (standalone)

```ts
{
  type: 'audio',
  url: string,
  position: number,
  end: number,
  cutFrom?: number,
  volume?: number,      // default 1
}
```

### Background music clip

```ts
{
  type: 'music' | 'backgroundAudio',
  url: string,
  position?: number,    // default 0
  end?: number,         // defaults to project duration (video timeline)
  cutFrom?: number,     // default 0
  volume?: number,      // default 0.2
}
```

### Text clip

```ts
{
  type: 'text',
  text?: string,              // used for static and for auto-split modes
  position: number,
  end: number,

  // Modes
  mode?: 'static' | 'word-replace' | 'word-sequential',

  // Per-word explicit timing (either use words[] OR wordTimestamps[])
  words?: Array<{ text: string, start: number, end: number }>,
  wordTimestamps?: number[],   // N or N+1 entries; split on whitespace in `text`

  // Font
  fontFile?: string;           // overrides fontFamily
  fontFamily?: string;         // default 'Sans' (fontconfig)
  fontSize?: number;           // default 48
  fontColor?: string;          // default '#FFFFFF'

  // Position
  centerX?: number; centerY?: number; // centered defaults
  x?: number; y?: number;

  // Styling
  borderColor?: string; borderWidth?: number;
  shadowColor?: string; shadowX?: number; shadowY?: number;
  backgroundColor?: string; backgroundOpacity?: number; padding?: number;

  // Animation (opt-in)
  animation?: { type: 'none' | 'fade-in' | 'pop' | 'pop-bounce'; in?: number };
}
```

## Timeline semantics

- Video timeline is defined by each clip’s `[position, end)`.
- Transitions use overlap (xfade): each transition reduces the total output duration by its duration.
- Background music is mixed after transition audio; its level is not affected by acrossfades.

## Safeguards (validation)

- Basic pre-validation on `load`:
  - type must be one of: video, audio, text, music, backgroundAudio
  - position ≥ 0; end > position
  - media clips require `url`
  - cutFrom ≥ 0
  - volume ≥ 0 for audio/music
  - text: validate `words[]` and `wordTimestamps[]` shapes
  - fontFile existence warning (falls back to `fontFamily`)
- Media duration checks (via ffprobe) on load:
  - `0 ≤ cutFrom < duration` (strict)
  - requested segment `end - position` is clamped to `duration - cutFrom` (warns)
- Export-time:
  - text windows are clamped to the project duration
  - optional batching of text overlays to avoid massive filter graphs; audio is copied during passes

`validationMode: 'warn' | 'strict'`

- warn (default): logs warnings, throws on hard errors
- strict: same errors; treat additional questionable conditions as errors (future use)

## Animations

- fade-in: alpha 0 → 1 over `in` seconds (default ~0.25)
- pop: font size 70% → 100% over `in` seconds
- pop-bounce: font size 70% → 110% during `in`, then settles to 100%

## Examples

```js
await project.load([
  { type: "video", url: "./a.mp4", position: 0, end: 5 },
  {
    type: "video",
    url: "./b.mp4",
    position: 5,
    end: 10,
    transition: { type: "fade", duration: 0.5 },
  },
  { type: "music", url: "./bgm.wav", volume: 0.2 },
  {
    type: "text",
    text: "Hello world",
    position: 1,
    end: 3,
    fontColor: "white",
    animation: { type: "fade-in", in: 0.4 },
  },
]);
```

## Gotchas

- Fonts in containers: install fonts or provide `fontFile` if `font=Sans` cannot be resolved
- Very long scripts produce many filters: batching is automatic; consider subtitles/ASS in a future release
- Keep transition durations ≤ adjacent clip durations

## License

MIT
