module.exports = {
  id: "color",
  name: "Color Clips",
  description:
    "Solid color or gradient clips for filling gaps, creating transitions to/from black, or adding visual backgrounds to the timeline.",
  schema: `{
  type: "color";                            // Required: clip type identifier
  color: string | GradientSpec;             // Required: flat color string or gradient specification
  position?: number;                        // Start time on timeline (seconds). Omit to auto-sequence after previous visual clip.
  end?: number;                             // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;                        // Duration in seconds (alternative to end). end = position + duration.
  transition?: TransitionConfig;            // Optional: transition effect from the previous visual clip
}`,
  enums: {
    GradientType: ["linear-gradient", "radial-gradient"],
    GradientDirection: ["vertical", "horizontal"],
  },
  examples: [
    {
      label: "Black gap between clips",
      code: `{ type: "color", color: "black", position: 5, end: 7 }`,
    },
    {
      label: "Fade to black between videos",
      code: `[
  { type: "video", url: "intro.mp4", position: 0, end: 5 },
  { type: "color", color: "black", position: 5, end: 7, transition: { type: "fade", duration: 0.5 } },
  { type: "video", url: "main.mp4", position: 7, end: 15, transition: { type: "fade", duration: 0.5 } }
]`,
    },
    {
      label: "Linear gradient clip",
      code: `{ type: "color", color: { type: "linear-gradient", colors: ["#000000", "#0a0a2e"], direction: "vertical" }, duration: 3 }`,
    },
    {
      label: "Radial gradient clip",
      code: `{ type: "color", color: { type: "radial-gradient", colors: ["white", "navy"] }, duration: 2 }`,
    },
    {
      label: "Multi-stop gradient",
      code: `{ type: "color", color: { type: "linear-gradient", colors: ["#ff0000", "#00ff00", "#0000ff"], direction: "horizontal" }, duration: 4 }`,
    },
  ],
  notes: [
    "Flat color accepts any valid FFmpeg color: named colors (\"black\", \"navy\", \"red\"), hex (#RGB, #RRGGBB), or \"random\".",
    "Gradient clips generate a temporary image internally and flow through the image pipeline — no external dependencies required.",
    "Linear gradients support direction as \"vertical\" (default), \"horizontal\", or a number (angle in degrees).",
    "Radial gradients interpolate from the center outward.",
    "Gradient colors array must have at least 2 colors; multiple stops are evenly distributed.",
    "Color clips support transitions just like video and image clips (e.g. fade, wipe, dissolve).",
    "If position is omitted, the clip is placed immediately after the previous visual clip (auto-sequencing).",
    "Use duration instead of end to specify length: end = position + duration. Cannot use both.",
  ],
};
