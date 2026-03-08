# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
