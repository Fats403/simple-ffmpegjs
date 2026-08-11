# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.7.0] - 2026-08-10

### Added

- **Audio operations** — six new statics for the voiceover/narration edits that go wrong when done naively at the composition layer:
  - `SIMPLEFFMPEG.audioTempo(inputPath, { outputPath, tempo })` — speed change via ffmpeg's `atempo` time-stretch, so pitch is preserved (unlike resampling-based speedups such as a player's `playbackRate`). Range `[0.25, 4]`, chained internally past a single stage's `[0.5, 2]`.
  - `SIMPLEFFMPEG.detectSilence(inputPath, options?)` — silence intervals via `silencedetect` (`noiseDb` default −35 dBFS, `minDurationSec` default 0.3 s). Analysis only; a trailing open silence is closed at the file duration.
  - `SIMPLEFFMPEG.spliceAudio(inputPath, { outputPath, segments })` — rebuild a file from `{start,end}` source ranges and `{silence}` insertions. Every cut gets a micro-fade (default 5 ms, `fadeMs` to tune) on both sides so joins never click; cutting a waveform mid-phoneme without one audibly smears consonants.
  - `SIMPLEFFMPEG.trimSilence(inputPath, { outputPath, edges?, keepSec? })` — trim leading/trailing silence, keeping a hair of room tone (default 0.15 s) at each edge.
  - `SIMPLEFFMPEG.capSilences(inputPath, { outputPath, maxSilenceSec? })` — shorten interior gaps to a cap. Long gaps keep their first `maxSilenceSec` of real recorded quiet (room tone, not synthetic silence) and each cut lands deep inside the gap where the level is minimal.
  - `SIMPLEFFMPEG.normalizeLoudness(inputPath, { outputPath, targetLufs? })` — two-pass EBU R128 `loudnorm` (measure, then apply linearly) to a LUFS target; defaults (−16 LUFS, −1.5 dBTP) suit voice for the web. Output is pinned back to the source sample rate.
  - All six run under the same hardening wrapper as `transcode()` (no shell, SIGKILL timeout, `AbortSignal`, partial-output cleanup) and throw `TranscodeError` with the same `code` discriminators. Output codec is chosen by the `outputPath` extension (`.mp3`/`.m4a`/`.aac`/`.wav`/`.flac`/`.ogg`/`.opus`).
- `transcode()` **`web-audio` preset** — AAC in an MP4-family container (write to `.m4a` or `.mp4`), `+faststart`, first audio stream only, source channel count preserved (a mono voiceover stays mono). Video-only options (`crf`, `videoBitrate`, `scale`) are rejected under this preset.
- `probe()` now surfaces **`attachedPic`** — `true` when the file's only video stream is embedded cover art (`attached_pic` disposition, e.g. an MP3 with album art). Stream selection now prefers a real video stream over cover art when both exist.
- New `TranscodeError` codes: `NO_VIDEO_STREAM`, `NO_AUDIO_STREAM`, `ANALYSIS_FAILED`.

- `export()` accepts **`timeoutMs`** (SIGKILL-backed, per ffmpeg run); `snapshot()` and `extractKeyframes()` accept **`signal`** and **`timeoutMs`** (default 5 min) — previously neither could be cancelled or timed out at all.
- `export()` **encoding options are validated up front** against the supported codec/preset/hwaccel/logLevel lists, so a typo'd `videoCodec` fails with a clear message instead of deep in ffmpeg stderr.
- **`logLevel` is now actually emitted** (`-loglevel <level> -stats`; the `-stats` keeps `onProgress` working at quiet levels). It was accepted, typed, and documented for years without ever reaching ffmpeg.
- **`transition: "fade"` string shorthand and duration-less `{ type }`** now work as documented (normalized to the 0.5 s default before validation), and **`transition.type` is validated** against the 41 supported xfade names.
- **`validationMode: "strict"` now does what the docs say**: warnings are promoted to errors. Historically it only *silenced* them — quieter than the default, the opposite of strict.

### Fixed

- **`preview()` or a completed `export()` no longer breaks the next export.** Prepare-time state (unrotated-video temp files, `clip.url` rewrites) is restored after every run, and gradient PPMs now live for the lifetime of the `load()` instead of being deleted by the first export's cleanup. Previously `preview()` → `export()`, or `export()` twice, failed on any project using gradient color clips or rotated iPhone video.
- **Background music no longer attenuates the whole program.** The BGM mix's silence anchor used `amix` weights of `1/n`, dropping the mix ~3 dB while sources overlap and up to ~9 dB where one source plays alone (measured). Real inputs now sum at weight 1 — clip `volume` values behave like faders and pass through unscaled.
- **`twoPass` + image watermark exports work.** Both pass commands omitted the watermark's `-i` input while reusing a filter graph that referenced it, and pass 1 dropped the audio mapping while the shared graph still produced an audio output — both made ffmpeg reject the graph.
- **Multi-line SRT/VTT subtitles render real line breaks** instead of a literal `\N` (cue lines were joined with `\N` and then backslash-escaped). VTT short-timestamp cues are now escaped like every other cue.
- **ASS colors are correct for every color the validator accepts.** `hexToASSColor("navy")` previously produced garbage bytes (`&H00VYNA`) for anything outside a 12-name internal list; it now resolves all 147 named colors, `#RGB`/`#RRGGBB`/`#RRGGBBAA`, `0x` forms, and `@alpha` suffixes, falling back to black instead of emitting garbage.
- **ASS timestamps carry the centisecond rollover** — `1.999s` is `0:00:02.00`, not the invalid `0:00:01.100`.
- **Gradient angles other than 0/90 render correctly.** The projection is now normalized to the canvas, so 45° no longer saturates early and 180°/270° no longer collapse to a flat fill. An explicit `direction: 0` (horizontal) is no longer swallowed by the vertical default.
- **Text with unescapable characters can no longer corrupt the filter graph.** Watermark text and word/typewriter text windows now route through the same temp-textfile fallback as static text clips (they previously bypassed it and rendered inline); custom metadata keys are validated as identifiers; metadata values and file paths containing a double quote — which the internal command parser cannot represent and previously split into extra ffmpeg argv entries — are sanitized (values) or rejected with a clear error (paths). Windows-style backslash paths now pass through unmangled.
- **The text-batch filter graph is sanitized** like the main graph (its unconditional trailing `;` produced an empty filter chain that some ffmpeg builds reject).
- **`audioOnly` exports pick the audio codec from the output extension** when none is given — `.wav`/`.mp3` no longer get AAC in the wrong container. `+faststart` detection is case-insensitive (`.MP4`).
- `probe()` falls back to the audio stream's duration for audio-only files in containers that omit `format.duration`; two clips at `position: 0` no longer hit a falsy check that made the input-order comparator inconsistent; watermark validation throws `ValidationError` (not a bare `Error`); `SimpleffmpegError` forwards `cause`; the noisy unconditional Ken Burns dimension warning is gone; `duration` on a clip that can't auto-sequence is reported by name instead of being silently discarded.
- `transcode()` with `web-mp4` no longer fails with ffmpeg's cryptic `Stream map '0:v:0' matches no streams` on audio-only input — it now rejects up front with `code: "NO_VIDEO_STREAM"` and a message pointing at `web-audio`. An MP3 whose only "video" is embedded cover art is treated as audio-only rather than being encoded into a static-image video.
- `isWebSafeMp4()` returns `false` for files whose video stream is embedded cover art.

### Changed

- **The composition pipeline (`export`, `preview`, `snapshot`, `extractKeyframes`, thumbnails, text passes) now runs under the same hardening as `transcode()`**: stdin ignored, SIGTERM→SIGKILL escalation on abort, bounded output buffering (previously unbounded on long renders), partial-output cleanup on failure, and "ffmpeg not installed" reported as such instead of a generic process error. `ffprobe` timeouts now SIGKILL and reject immediately (a probe that ignored SIGTERM previously left the promise pending forever).
- The rotation intermediate (iPhone videos) is encoded with explicit visually-lossless settings (`libx264 -preset veryfast -crf 18`, audio copied, metadata mapped) instead of ffmpeg build defaults.
- `load()` probes and rotation re-encodes run with bounded concurrency (8 probes / 2 re-encodes) instead of one process per clip simultaneously.
- Types: `TextClip`/`SubtitleClip` now declare `duration`, `ImageClip` declares `transition` (all long accepted at runtime); `MediaInfo.attachedPic`; new option fields above.
- Packaging/infra: `"type": "commonjs"` (silences Node's module-type warning; configs renamed to `.mjs`), `CHANGELOG.md` ships in the npm tarball, `prepublishOnly` runs lint + the full suite, and test fixtures are generated in a vitest `globalSetup` so integration suites genuinely run on fresh checkouts and CI (they previously skipped silently when fixtures were absent at collection time).

## [0.6.1] - 2026-05-04

### Fixed

- `SIMPLEFFMPEG.extractKeyframes()` with `format: "jpeg"` (the default) no longer fails on inputs with limited-range YUV. The MJPEG encoder requires full-range YUV (`yuvj420p`) and refused to open on common phone/HEVC sources tagged `yuv420p(tv, ...)` (Snapchat exports, etc.), exiting with code 234 and `Error while opening encoder — maybe incorrect parameters such as bit_rate, rate, width or height`. The bug surfaced specifically in scene-change mode when the threshold produced zero matching frames — ffmpeg then initialized the MJPEG encoder from the raw input format with no auto-inserted scaler. The filter chain now appends `format=yuvj420p` for jpeg output so limited-range inputs are normalized before the encoder sees them. PNG output is unaffected (uses an RGB encoder).

## [0.6.0] - 2026-04-21

### Added

- `SIMPLEFFMPEG.transcode(filePath, options)` — new static helper for hardened one-shot transcoding, targeting ingestion pipelines that today shell out to ffmpeg directly and reimplement the same spawn hardening. Ships the `web-mp4` preset (H.264 + AAC in MP4, yuv420p, faststart, even dimensions via the trunc-scale filter, `profile high` / `level 4.1`, broadly-playable on iOS Safari / smart TVs), plus a `customArgs` escape hatch that still applies the hardening wrapper. Every transcode runs under `spawn` with no shell, stdin ignored, a SIGKILL-backed timeout, 16 KB stderr tail, `-fs` output cap, path validation (rejects basenames starting with `-`), partial-output cleanup on any failure path, and `AbortSignal` support.
- `SIMPLEFFMPEG.isWebSafeMp4(mediaInfo)` — predicate pairing with `probe()` so callers can skip transcoding when the input is already h264/mp4/yuv420p.
- `SIMPLEFFMPEG.TranscodeError` — exposed via static getter. Carries `code` (`INVALID_PATH` | `INPUT_MISSING` | `FFMPEG_NOT_FOUND` | `TIMEOUT` | `NONZERO_EXIT` | `SIGNAL` | `ABORTED`), `stderr` (tail, ≤16 KB), `exitCode`, and `signal` so callers can branch on cause. The `FFMPEG_NOT_FOUND` code is surfaced when either `ffmpeg` or `ffprobe` is missing from `PATH`, with an actionable install message — separate from `NONZERO_EXIT` so callers don't mistake a missing binary for an ffmpeg failure.
- `probe()` now surfaces `pixelFormat`, `colorSpace`, and `colorTransfer`. Lets callers detect HDR sources (`colorTransfer === "smpte2084"` for HDR10 PQ, `"arib-std-b67"` for HLG, or `pixelFormat === "yuv420p10le"` for 10-bit) and route them through `customArgs` with a tone-map chain — see the [Static Helpers docs](https://www.simple-ffmpegjs.com/api/static-helpers#known-limitations) for the warning and the example zscale+tonemap argv.

## [0.5.6] - 2026-04-11

### Fixed

- `SIMPLEFFMPEG.extractKeyframes()` with `outputDir` no longer returns stale frames from previous calls. Previously, the method wrote `frame-NNNN.{jpg,png}` directly into `outputDir` and then globbed the directory to build its return value, so repeat or concurrent calls against the same `outputDir` would silently include files left behind by earlier calls — producing cross-contaminated frame sets with no error. Each call now writes into a unique `simpleffmpeg-keyframes-XXXXXX` subdirectory inside `outputDir`, matching the isolation the Buffer path already had. On ffmpeg failure the subdirectory is cleaned up in both the disk and Buffer paths.

### Changed

- **Potentially breaking:** when `outputDir` is set, `extractKeyframes()` now writes frames into a `simpleffmpeg-keyframes-XXXXXX` subdirectory of `outputDir` rather than directly into it. Callers that consume the returned `string[]` are unaffected. Callers that hardcoded paths like `${outputDir}/frame-0001.jpg` will need to use the returned paths instead.

## [0.5.5] - 2026-03-27

### Added

- `skipExtensionsCheck` option for constructor, `load()`, and `validate()` — skips media URL extension/type validation, useful for S3 or CDN URLs without file extensions. (PR #1 by @mat250)

## [0.5.4] - 2026-03-09

### Added

- `fullDuration` property for effect and text clips — when set to `true`, the clip automatically spans the entire visual timeline (position 0 to end of last video/image/color clip). Removes the need to manually specify `position`, `end`, or `duration`.

### Fixed

- Missing `getTransitionOverlap` static method in ESM type definitions (`index.d.mts`), causing broken IntelliSense for ESM consumers.
- TypeScript declaration errors in both `.d.ts` and `.d.mts`: base error class `name` literal narrowing prevented subclass type narrowing; redundant `static readonly` re-exports caused modifier conflict diagnostics.

## [0.5.3] - 2026-03-08

### Added

- `SIMPLEFFMPEG.getTransitionOverlap(clips)` — static method returning total seconds consumed by xfade transition overlaps. Pure math, no I/O.
- Validation warning (`OUTSIDE_BOUNDS`) when non-visual clips (text, audio, subtitle, music) are positioned at or beyond the end of the visual timeline.
- Docs site search via Pagefind (`postbuild` script).

### Fixed

- `compensateTransitions` now adjusts standalone audio clip timings for transition overlap, matching the existing behavior for text and subtitle clips.
- Word timing validation no longer emits false `OUTSIDE_BOUNDS` warnings for relative timings. Words within `[0, clipDuration]` are now recognized as valid relative-to-clip-start timings.

### Changed

- Minimum Node.js version bumped from 18 to 20 (Node 18 reached EOL April 2025).
- Standalone audio clip logic extracted from the main entry point into `src/ffmpeg/standalone_audio_builder.js`, matching the builder pattern used by other pipeline stages.
- Duplicated transition compensation logic for text and subtitle clips consolidated into a shared `_compensateClipTimings` helper.
- `getClipAudioString` removed from `src/ffmpeg/strings.js` (inlined into the new standalone audio builder).

## [0.5.0] - 2026-02-16

### Added

- `imageFit` property for image clips: `"blur-fill"` (default for static), `"cover"` (default for Ken Burns), `"contain"` (pad with black bars).
- `blurIntensity` property for image clips — controls Gaussian sigma for blur-fill mode (default: 40, range: 10–80).
- `SIMPLEFFMPEG.extractKeyframes(filePath, options)` — scene-change detection and interval-based frame extraction. Returns `Buffer[]` or writes to disk.
- `emojiFont` constructor option — path to an emoji font for opt-in emoji rendering in text overlays.
- `tempDir` constructor option — route all temporary files to a custom directory.
- Ken Burns effects now respect `imageFit` — motion applies only to image content while the background stays static.

### Fixed

- Ken Burns panning now enforces a minimum zoom level so motion is always visible.
- Audio/video duration mismatch when transitions compress the timeline.
- Watermark input index offset when flat color clips are present.

## [0.4.0] - 2026-02-09

### Added

- First-class effect clips for timed visual adjustments: `vignette`, `filmGrain`, `gaussianBlur`, `colorAdjust`.

### Changed

- Visual timeline gaps now always fail validation. Implicit gap filling is no longer allowed — use explicit `type: "color"` clips instead.

### Deprecated

- `fillGaps` option — use explicit timeline color clips instead.

### Migration

If you previously relied on `fillGaps` or implicit visual gap behavior, replace gaps with explicit clips:

```js
{ type: "color", color: "black", position: 12, end: 14 }
```
