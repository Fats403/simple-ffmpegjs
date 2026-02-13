module.exports = {
  id: "effect",
  name: "Effect Clips",
  description:
    "Overlay adjustment clips that apply timed visual effects to the composed video (they do not create visual content by themselves).",
  schema: `{
  type: "effect";                           // Required: clip type identifier
  effect: "vignette" | "filmGrain" | "gaussianBlur" | "colorAdjust"
        | "sepia" | "blackAndWhite" | "sharpen" | "chromaticAberration"
        | "letterbox";                      // Required: effect kind
  position: number;                         // Required: start time on timeline (seconds)
  end?: number;                             // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;                        // Duration in seconds (alternative to end). end = position + duration.
  fadeIn?: number;                          // Optional: seconds to ramp in from 0 to full intensity
  fadeOut?: number;                         // Optional: seconds to ramp out from full intensity to 0
  params: EffectParams;                     // Required: effect-specific parameters
}`,
  enums: {
    EffectType: [
      "vignette",
      "filmGrain",
      "gaussianBlur",
      "colorAdjust",
      "sepia",
      "blackAndWhite",
      "sharpen",
      "chromaticAberration",
      "letterbox",
    ],
    VignetteParams: `{ amount?: number; angle?: number; }`,
    FilmGrainParams: `{ amount?: number; strength?: number; temporal?: boolean; }`,
    GaussianBlurParams: `{ amount?: number; sigma?: number; }`,
    ColorAdjustParams:
      `{ amount?: number; brightness?: number; contrast?: number; saturation?: number; gamma?: number; }`,
    SepiaParams: `{ amount?: number; }`,
    BlackAndWhiteParams: `{ amount?: number; contrast?: number; }`,
    SharpenParams: `{ amount?: number; strength?: number; }`,
    ChromaticAberrationParams: `{ amount?: number; shift?: number; }`,
    LetterboxParams: `{ amount?: number; size?: number; color?: string; }`,
  },
  examples: [
    {
      label: "Vignette that ramps in (duration shorthand)",
      code: `{
  type: "effect",
  effect: "vignette",
  position: 0,
  duration: 4,
  fadeIn: 1,
  params: { amount: 0.8 }
}`,
    },
    {
      label: "Film grain with independent strength and blend",
      code: `{
  type: "effect",
  effect: "filmGrain",
  position: 3,
  end: 8,
  fadeIn: 0.4,
  fadeOut: 0.6,
  params: { amount: 0.8, strength: 0.35, temporal: true }
}`,
    },
    {
      label: "Color adjustment look with smooth exit",
      code: `{
  type: "effect",
  effect: "colorAdjust",
  position: 0,
  end: 10,
  fadeOut: 1,
  params: {
    amount: 0.7,
    contrast: 1.12,
    saturation: 1.18,
    gamma: 1.04,
    brightness: -0.02
  }
}`,
    },
    {
      label: "Warm sepia tone",
      code: `{
  type: "effect",
  effect: "sepia",
  position: 0,
  duration: 5,
  fadeIn: 0.5,
  params: { amount: 0.85 }
}`,
    },
    {
      label: "Black and white with contrast boost",
      code: `{
  type: "effect",
  effect: "blackAndWhite",
  position: 2,
  end: 6,
  params: { amount: 1, contrast: 1.3 }
}`,
    },
    {
      label: "Cinematic letterbox bars",
      code: `{
  type: "effect",
  effect: "letterbox",
  position: 0,
  duration: 8,
  fadeIn: 0.8,
  params: { size: 0.12 }
}`,
    },
  ],
  notes: [
    "Effect clips are adjustment layers: they modify underlying video during their active window.",
    "Effects do not satisfy visual timeline continuity checks and do not fill gaps.",
    "Use duration instead of end to specify length: end = position + duration. Cannot use both.",
    "position is required for effect clips (no auto-sequencing).",
    "fadeIn/fadeOut are optional linear envelope controls that avoid abrupt on/off changes.",
    "params.amount is a normalized blend amount from 0 to 1 (default: 1).",
    "filmGrain: use params.strength (0-1) for noise intensity, params.amount for blend alpha.",
  ],
};
