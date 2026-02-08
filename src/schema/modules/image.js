module.exports = {
  id: "image",
  name: "Image Clips",
  description:
    "Display still images on the timeline, optionally with Ken Burns (pan/zoom) motion effects.",
  schema: `{
  type: "image";                            // Required: clip type identifier
  url: string;                              // Required: path to image file (jpg, png, etc.)
  position?: number;                        // Start time on timeline (seconds). Omit to auto-sequence after previous video/image clip.
  end?: number;                             // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;                        // Duration in seconds (alternative to end). end = position + duration.
  width?: number;                           // Optional: source image width (skip probe / override)
  height?: number;                          // Optional: source image height (skip probe / override)
  kenBurns?: KenBurnsEffect | KenBurnsSpec; // Optional: apply pan/zoom motion to the image
}`,
  enums: {
    KenBurnsEffect: [
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "pan-up",
      "pan-down",
      "smart",
      "custom",
    ],
    KenBurnsAnchor: ["top", "bottom", "left", "right"],
    KenBurnsEasing: ["linear", "ease-in", "ease-out", "ease-in-out"],
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
    {
      label: "Custom Ken Burns pan with smart anchor",
      code: `{ type: "image", url: "portrait.jpg", duration: 5, kenBurns: { type: "smart", anchor: "bottom", startZoom: 1.05, endZoom: 1.2 } }`,
    },
    {
      label: "Custom Ken Burns with explicit pan endpoints",
      code: `{ type: "image", url: "photo.jpg", duration: 4, kenBurns: { type: "custom", startX: 0.2, startY: 0.8, endX: 0.7, endY: 0.3 } }`,
    },
  ],
  notes: [
    "If position is omitted, the clip is placed immediately after the previous video/image clip (auto-sequencing). The first clip defaults to position 0.",
    "Use duration instead of end to specify how long the image displays: end = position + duration. Cannot use both.",
    "Images are scaled to fill the project canvas. For Ken Burns, use images at least as large as the output resolution for best quality.",
    "If width/height are provided, they override probed dimensions (useful for remote or generated images).",
    "Image clips can be placed on the same timeline as video clips and can use transitions between them.",
    "Advanced Ken Burns accepts custom zoom/pan endpoints via normalized coordinates (0 = left/top, 1 = right/bottom).",
    "smart mode auto-pans along the dominant axis; use anchor to pick a starting edge.",
    "Use easing ('linear', 'ease-in', 'ease-out', 'ease-in-out') to smooth motion (default: ease-in-out).",
  ],
};
