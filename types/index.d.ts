export type ClipType =
  | "video"
  | "audio"
  | "text"
  | "music"
  | "backgroundAudio"
  | "image";

export interface BaseClip {
  type: ClipType;
  url?: string;
  position: number;
  end: number;
}

export interface VideoClip extends BaseClip {
  type: "video";
  url: string;
  cutFrom?: number;
  transition?: { type: string; duration: number };
}

export interface AudioClip extends BaseClip {
  type: "audio";
  url: string;
  cutFrom?: number;
  volume?: number;
}

export interface BackgroundMusicClip extends BaseClip {
  type: "music" | "backgroundAudio";
  url: string;
  cutFrom?: number;
  volume?: number;
}

export interface ImageClip extends BaseClip {
  type: "image";
  url: string;
  kenBurns?: {
    type:
      | "zoom-in"
      | "zoom-out"
      | "pan-left"
      | "pan-right"
      | "pan-up"
      | "pan-down";
    strength?: number; // 0..0.5 (approx), controls zoom amount or pan distance
  };
}

export type TextMode = "static" | "word-replace" | "word-sequential";
export type TextAnimationType = "none" | "fade-in" | "pop" | "pop-bounce";

export interface TextWordWindow {
  text: string;
  start: number;
  end: number;
}

export interface TextClip {
  type: "text";
  text?: string;
  position: number;
  end: number;
  mode?: TextMode;
  words?: TextWordWindow[];
  wordTimestamps?: number[];

  // Font
  fontFile?: string;
  fontFamily?: string; // defaults to 'Sans' via fontconfig
  fontSize?: number; // default 48
  fontColor?: string; // default '#FFFFFF'

  // Position
  centerX?: number;
  centerY?: number;
  x?: number;
  y?: number;

  // Styling
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  padding?: number;

  // Animation
  animation?: {
    type: TextAnimationType;
    in?: number; // seconds
  };
}

export type Clip =
  | VideoClip
  | AudioClip
  | BackgroundMusicClip
  | ImageClip
  | TextClip;

export interface SIMPLEFFMPEGOptions {
  fps?: number;
  width?: number;
  height?: number;
  validationMode?: "warn" | "strict";
}

export interface ExportOptions {
  outputPath?: string;
  textMaxNodesPerPass?: number;
  intermediateVideoCodec?: string;
  intermediateCrf?: number;
  intermediatePreset?: string;
}

export default class SIMPLEFFMPEG {
  constructor(options: SIMPLEFFMPEGOptions);
  load(clips: Clip[]): Promise<void[]>;
  export(options: ExportOptions): Promise<string>;
}
