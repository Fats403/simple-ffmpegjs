module.exports = {
  id: "image",
  name: "Image Clips",
  description:
    "Display still images on the timeline, optionally with Ken Burns (pan/zoom) motion effects.",
  schema: `{
  type: "image";              // Required: clip type identifier
  url: string;                // Required: path to image file (jpg, png, etc.)
  position: number;           // Required: start time on timeline (seconds)
  end: number;                // Required: end time on timeline (seconds)
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
      code: `{ type: "image", url: "photo.jpg", position: 0, end: 5 }`,
    },
    {
      label: "Image with slow zoom-in effect",
      code: `{ type: "image", url: "landscape.png", position: 5, end: 12, kenBurns: "zoom-in" }`,
    },
  ],
  notes: [
    "Images are scaled to fill the project canvas. For Ken Burns, use images at least as large as the output resolution for best quality.",
    "Image clips can be placed on the same timeline as video clips and can use transitions between them.",
  ],
};
