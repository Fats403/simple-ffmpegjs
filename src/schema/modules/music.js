module.exports = {
  id: "music",
  name: "Background Music",
  description:
    "Add background music or ambient audio that plays underneath the main video/audio content.",
  schema: `{
  type: "music";              // Required: clip type ("music" or "backgroundAudio")
  url: string;                // Required: path to audio file
  position?: number;          // Start time on timeline (default: 0)
  end?: number;               // End time on timeline (default: end of video)
  cutFrom?: number;           // Start playback from this point in the source (default: 0)
  volume?: number;            // Volume multiplier (default: 0.2 — quieter than main audio)
  loop?: boolean;             // Loop the track to fill the entire video duration (default: false)
}`,
  examples: [
    {
      label: "Background music for the entire video",
      code: `{ type: "music", url: "bg-track.mp3", loop: true, volume: 0.15 }`,
    },
    {
      label: "Music for a specific section",
      code: `{ type: "music", url: "intro-music.mp3", position: 0, end: 10, volume: 0.25 }`,
    },
  ],
  notes: [
    'The type can be either "music" or "backgroundAudio" — both work identically.',
    "Default volume is 0.2 (20%), so background music doesn't overpower speech or main audio.",
    "When loop is true, the track repeats seamlessly to fill the video duration. position/end are not required with loop.",
  ],
};
