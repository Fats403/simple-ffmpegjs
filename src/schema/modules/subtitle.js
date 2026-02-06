module.exports = {
  id: "subtitle",
  name: "Subtitle Clips",
  description:
    "Import external subtitle files (.srt, .vtt, .ass, .ssa) and render them onto the video.",
  schema: `{
  type: "subtitle";           // Required: clip type identifier
  url: string;                // Required: path to subtitle file (.srt, .vtt, .ass, .ssa)
  position?: number;          // Timeline offset — shifts all subtitle timestamps forward (default: 0)
  end?: number;               // Optional end time to cut off subtitles. Use end OR duration, not both.
  duration?: number;          // Duration in seconds (alternative to end). end = position + duration.

  // Styling (applies to SRT/VTT imports — ASS/SSA files use their own embedded styles)
  fontFamily?: string;        // Font family (default: "Sans")
  fontSize?: number;          // Font size in pixels (default: 48)
  fontColor?: string;         // Font color as hex (default: "#FFFFFF")
  borderColor?: string;       // Outline color (hex)
  borderWidth?: number;       // Outline width in pixels
  opacity?: number;           // Text opacity 0-1
}`,
  examples: [
    {
      label: "Import an SRT file",
      code: `{ type: "subtitle", url: "captions.srt" }`,
    },
    {
      label: "Import subtitles with a time offset and custom styling",
      code: `{ type: "subtitle", url: "subs.vtt", position: 5,
  fontSize: 36, fontColor: "#FFFF00", borderColor: "#000000", borderWidth: 2 }`,
    },
  ],
  notes: [
    "Supported formats: .srt, .vtt, .ass, .ssa",
    "ASS/SSA files use their own embedded styles — the fontFamily/fontSize/fontColor options are ignored for those formats.",
    "The position field offsets all subtitle timestamps forward on the timeline (e.g. position: 5 makes a subtitle at 0:01 appear at 0:06).",
  ],
};
