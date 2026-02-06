module.exports = {
  id: "image",
  name: "Image Clips",
  description:
    "Display still images on the timeline, optionally with Ken Burns (pan/zoom) motion effects.",
  schema: `{
  type: "image";              // Required: clip type identifier
  url: string;                // Required: path to image file (jpg, png, etc.)
  position?: number;          // Start time on timeline (seconds). Omit to auto-sequence after previous video/image clip.
  end?: number;               // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;          // Duration in seconds (alternative to end). end = position + duration.
  kenBurns?: KenBurnsEffect;  // Optional: apply pan/zoom motion to the image
}`,
  enums: {
    KenBurnsEffect: [
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "pan-up",
      "pan-down",
    ],
  },
  examples: [
    {
      label: "Static image for 5 seconds",
      code: `{ type: "image", url: "photo.jpg", duration: 5 }`,
    },
    {
      label: "Image slideshow with Ken Burns effects (auto-sequenced)",
      code: `[
  { type: "image", url: "photo1.jpg", duration: 3, kenBurns: "zoom-in" },
  { type: "image", url: "photo2.jpg", duration: 3, kenBurns: "pan-right" },
  { type: "image", url: "photo3.jpg", duration: 3, kenBurns: "zoom-out" }
]`,
    },
  ],
  notes: [
    "If position is omitted, the clip is placed immediately after the previous video/image clip (auto-sequencing). The first clip defaults to position 0.",
    "Use duration instead of end to specify how long the image displays: end = position + duration. Cannot use both.",
    "Images are scaled to fill the project canvas. For Ken Burns, use images at least as large as the output resolution for best quality.",
    "Image clips can be placed on the same timeline as video clips and can use transitions between them.",
  ],
};
