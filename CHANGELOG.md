# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
