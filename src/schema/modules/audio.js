module.exports = {
  id: "audio",
  name: "Audio Clips",
  description:
    "Place standalone audio files on the timeline. These are mixed into the final output alongside any video audio.",
  schema: `{
  type: "audio";              // Required: clip type identifier
  url: string;                // Required: path to audio file
  position?: number;          // Start time on timeline (seconds). Omit to auto-sequence after previous audio clip.
  end?: number;               // End time on timeline (seconds). Use end OR duration, not both.
  duration?: number;          // Duration in seconds (alternative to end). end = position + duration.
  cutFrom?: number;           // Start playback from this point in the source (default: 0)
  volume?: number;            // Volume multiplier (default: 1, 0 = mute, >1 = amplify)
}`,
  examples: [
    {
      label: "Sound effect at 3 seconds",
      code: `{ type: "audio", url: "whoosh.mp3", position: 3, end: 4.5 }`,
    },
    {
      label: "Voiceover with boosted volume",
      code: `{ type: "audio", url: "voiceover.wav", position: 0, end: 30, volume: 1.5 }`,
    },
  ],
  notes: [
    "If position is omitted, the clip is placed immediately after the previous audio clip (auto-sequencing). The first clip defaults to position 0.",
    "Use duration instead of end to specify how long the clip plays: end = position + duration. Cannot use both.",
    "Audio clips are mixed (layered) with video audio and background music — they don't replace other audio.",
    "Use cutFrom to start playback partway through the source file.",
  ],
};
