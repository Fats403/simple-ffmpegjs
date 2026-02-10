module.exports = {
  id: "effect",
  name: "Effect Clips",
  description:
    "Overlay adjustment clips that apply timed visual effects to the composed video (they do not create visual content by themselves).",
  schema: `{
  type: "effect";                           // Required: clip type identifier
  effect: "vignette" | "filmGrain" | "gaussianBlur" | "colorAdjust"; // Required: effect kind
  position: number;                         // Required: start time on timeline (seconds)
  end?: number;                             // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;                        // Duration in seconds (alternative to end). end = position + duration.
  fadeIn?: number;                          // Optional: seconds to ramp in from 0 to full intensity
  fadeOut?: number;                         // Optional: seconds to ramp out from full intensity to 0
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out"; // Optional envelope easing (default: "linear")
  params: EffectParams;                     // Required: effect-specific parameters
}`,
  enums: {
    EffectType: ["vignette", "filmGrain", "gaussianBlur", "colorAdjust"],
    EffectEasing: ["linear", "ease-in", "ease-out", "ease-in-out"],
    VignetteParams: `{ amount?: number; angle?: number; }`,
    FilmGrainParams: `{ amount?: number; temporal?: boolean; }`,
    GaussianBlurParams: `{ amount?: number; sigma?: number; }`,
    ColorAdjustParams:
      `{ amount?: number; brightness?: number; contrast?: number; saturation?: number; gamma?: number; }`,
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
      label: "Film grain only during the middle section",
      code: `{
  type: "effect",
  effect: "filmGrain",
  position: 3,
  end: 8,
  fadeIn: 0.4,
  fadeOut: 0.6,
  easing: "ease-in-out",
  params: { amount: 0.45, temporal: true }
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
  ],
  notes: [
    "Effect clips are adjustment layers: they modify underlying video during their active window.",
    "Effects do not satisfy visual timeline continuity checks and do not fill gaps.",
    "Use duration instead of end to specify length: end = position + duration. Cannot use both.",
    "position is required for effect clips (no auto-sequencing).",
    "fadeIn/fadeOut are optional envelope controls that avoid abrupt on/off changes.",
    "params.amount is a normalized blend amount from 0 to 1 (default: 1).",
  ],
};
