module.exports = {
  id: "text",
  name: "Text Overlays",
  description:
    "Render text overlays on the video with multiple display modes, positioning, styling, and animations.",
  schema: `{
  type: "text";                   // Required: clip type identifier
  position: number;               // Required: start time on timeline (seconds)
  end?: number;                   // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;              // Duration in seconds (alternative to end). end = position + duration.

  // Content
  text?: string;                  // Text content (required for "static" mode)
  mode?: TextMode;                // Display mode (default: "static")

  // Word-level timing (for word-replace, word-sequential, karaoke modes)
  words?: TextWord[];             // Explicit word timing windows
  wordTimestamps?: number[];      // Simple array of timestamps — one per space-separated word in text

  // Font
  fontFile?: string;              // Path to a custom font file (.ttf, .otf)
  fontFamily?: string;            // Font family name (default: "Sans")
  fontSize?: number;              // Font size in pixels (default: 48)
  fontColor?: string;             // Font color as hex string (default: "#FFFFFF")

  // Positioning — percentage-based (recommended)
  xPercent?: number;              // Horizontal position 0-1 (0 = left, 0.5 = center, 1 = right)
  yPercent?: number;              // Vertical position 0-1 (0 = top, 0.5 = center, 1 = bottom)

  // Positioning — pixel-based
  x?: number;                     // Absolute X position in pixels
  y?: number;                     // Absolute Y position in pixels

  // Positioning — offsets (added on top of percentage or pixel position)
  xOffset?: number;               // Horizontal pixel offset
  yOffset?: number;               // Vertical pixel offset

  // Styling
  borderColor?: string;           // Text outline/border color (hex)
  borderWidth?: number;           // Outline width in pixels
  shadowColor?: string;           // Drop shadow color (hex)
  shadowX?: number;               // Shadow X offset in pixels
  shadowY?: number;               // Shadow Y offset in pixels
  backgroundColor?: string;       // Background box color (hex)
  backgroundOpacity?: number;     // Background box opacity 0-1
  padding?: number;               // Background box padding in pixels

  // Animation
  animation?: {
    type: TextAnimationType;      //   Animation type
    in?: number;                  //   Entry duration in seconds (default: 0.25)
    out?: number;                 //   Exit duration in seconds (default: same as in)
    intensity?: number;           //   Scale/pulse intensity 0-1 (default: 0.3)
    speed?: number;               //   Typewriter: sec/char (default: 0.05), Pulse: cycles/sec (default: 1)
  };

  // Karaoke-specific
  highlightColor?: string;        // Active word highlight color (default: "#FFFF00")
  highlightStyle?: "smooth" | "instant"; // Highlight transition (default: "smooth")
}`,
  enums: {
    TextMode: [
      "static          — Display the full text for the entire duration",
      "word-replace     — Show one word at a time, replacing the previous word",
      "word-sequential  — Reveal words one at a time, accumulating on screen",
      "karaoke          — Highlight words progressively (requires words array)",
    ],
    TextAnimationType: [
      "none",
      "fade-in",
      "fade-out",
      "fade-in-out",
      "pop",
      "pop-bounce",
      "scale-in",
      "pulse",
      "typewriter",
    ],
    TextWord: `{ text: string; start: number; end: number; lineBreak?: boolean }`,
  },
  examples: [
    {
      label: "Simple centered title",
      code: `{ type: "text", text: "Welcome!", position: 0, end: 3, fontSize: 72,
  xPercent: 0.5, yPercent: 0.5 }`,
    },
    {
      label: "Subtitle-style text at bottom with fade animation",
      code: `{ type: "text", text: "This is a caption", position: 2, end: 6,
  fontSize: 36, xPercent: 0.5, yPercent: 0.85,
  borderColor: "#000000", borderWidth: 2,
  animation: { type: "fade-in-out", in: 0.3, out: 0.3 } }`,
    },
    {
      label: "Word-by-word reveal with timestamps",
      code: `{ type: "text", text: "Hello world this is cool", position: 0, end: 5,
  mode: "word-replace",
  wordTimestamps: [0, 1, 2, 3, 4],
  fontSize: 64, xPercent: 0.5, yPercent: 0.5 }`,
    },
    {
      label: "Karaoke with explicit word timing",
      code: `{ type: "text", position: 0, end: 4, mode: "karaoke",
  words: [
    { text: "Never", start: 0, end: 0.8 },
    { text: "gonna", start: 0.8, end: 1.2 },
    { text: "give", start: 1.2, end: 1.8 },
    { text: "you", start: 1.8, end: 2.2 },
    { text: "up", start: 2.2, end: 3.0 }
  ],
  fontSize: 56, highlightColor: "#FF0000" }`,
    },
  ],
  notes: [
    "Use duration instead of end to specify how long the text appears: end = position + duration. Cannot use both.",
    "If no position is specified (xPercent/yPercent/x/y), text defaults to center of the screen.",
    "For karaoke mode, provide the words array with per-word start/end times.",
    "For word-replace and word-sequential, you can use either words[] or wordTimestamps[] (paired with a space-separated text string).",
    "The lineBreak property in a word object adds a line break after that word (useful for multi-line karaoke).",
    "Colors are hex strings: '#FFFFFF' for white, '#000000' for black, '#FF0000' for red, etc.",
  ],
};
