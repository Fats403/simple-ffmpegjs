module.exports = {
  id: "video",
  name: "Video Clips",
  description:
    "Place video files on the timeline with optional crossfade transitions between them.",
  schema: `{
  type: "video";              // Required: clip type identifier
  url: string;                // Required: path to video file
  position?: number;          // Start time on timeline (seconds). Omit to auto-sequence after previous clip.
  end?: number;               // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;          // Duration in seconds (alternative to end). end = position + duration.
  cutFrom?: number;           // Trim: start playback from this point in the source (default: 0)
  volume?: number;            // Audio volume multiplier (default: 1, 0 = mute, >1 = amplify)
  transition?: {              // Crossfade transition INTO this clip from the previous one
    type: string;             //   Transition type (see below)
    duration: number;         //   Duration in seconds (default: 0.5)
  };
}`,
  enums: {
    "transition.type": [
      "fade",
      "fadeblack",
      "fadewhite",
      "distance",
      "wipeleft",
      "wiperight",
      "wipeup",
      "wipedown",
      "slideleft",
      "slideright",
      "slideup",
      "slidedown",
      "smoothleft",
      "smoothright",
      "smoothup",
      "smoothdown",
      "circlecrop",
      "circleclose",
      "circleopen",
      "horzclose",
      "horzopen",
      "vertclose",
      "vertopen",
      "diagbl",
      "diagbr",
      "diagtl",
      "diagtr",
      "hlslice",
      "hrslice",
      "vuslice",
      "vdslice",
      "dissolve",
      "pixelize",
      "radial",
      "hblur",
      "wipetl",
      "wipetr",
      "wipebl",
      "wipebr",
      "squeezeh",
      "squeezev",
    ],
  },
  examples: [
    {
      label: "Two clips with a crossfade",
      code: `[
  { type: "video", url: "intro.mp4", position: 0, end: 5 },
  { type: "video", url: "main.mp4", position: 4.5, end: 15,
    transition: { type: "fade", duration: 0.5 } }
]`,
    },
    {
      label: "Auto-sequenced clips using duration",
      code: `[
  { type: "video", url: "intro.mp4", duration: 5 },
  { type: "video", url: "main.mp4", duration: 10 }
]`,
    },
    {
      label: "Trim source video (use 10s starting at the 10s mark)",
      code: `{ type: "video", url: "long-clip.mp4", cutFrom: 10, duration: 10 }`,
    },
  ],
  notes: [
    "If position is omitted, the clip is placed immediately after the previous video/image clip (auto-sequencing). The first clip defaults to position 0.",
    "Use duration instead of end to specify how long the clip appears: end = position + duration. Cannot use both.",
    "Transitions overlap clips: a 0.5s fade means clip B's position should start 0.5s before clip A's end.",
    "The first clip in the timeline cannot have a transition (there's nothing to transition from).",
    "The total video duration is shortened by the sum of all transition durations.",
    "Text and subtitle timings are automatically adjusted for transition compression.",
  ],
};
