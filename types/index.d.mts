declare namespace SIMPLEFFMPEG {
  type ClipType =
    | "video"
    | "audio"
    | "text"
    | "music"
    | "backgroundAudio"
    | "image";

  interface BaseClip {
    type: ClipType;
    url?: string;
    position: number;
    end: number;
  }

  interface VideoClip extends BaseClip {
    type: "video";
    url: string;
    cutFrom?: number;
    transition?: { type: string; duration: number };
  }

  interface AudioClip extends BaseClip {
    type: "audio";
    url: string;
    cutFrom?: number;
    volume?: number;
  }

  interface BackgroundMusicClip extends BaseClip {
    type: "music" | "backgroundAudio";
    url: string;
    cutFrom?: number;
    volume?: number;
  }

  interface ImageClip extends BaseClip {
    type: "image";
    url: string;
    kenBurns?:
      | "zoom-in"
      | "zoom-out"
      | "pan-left"
      | "pan-right"
      | "pan-up"
      | "pan-down";
  }

  type TextMode = "static" | "word-replace" | "word-sequential";
  type TextAnimationType =
    | "none"
    | "fade-in"
    | "fade-in-out"
    | "pop"
    | "pop-bounce";

  interface TextWordWindow {
    text: string;
    start: number;
    end: number;
  }

  interface TextClip {
    type: "text";
    text?: string;
    position: number;
    end: number;
    mode?: TextMode;
    words?: TextWordWindow[];
    wordTimestamps?: number[];

    // Font
    fontFile?: string;
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;

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
      in?: number;
      out?: number;
    };
  }

  type Clip =
    | VideoClip
    | AudioClip
    | BackgroundMusicClip
    | ImageClip
    | TextClip;

  interface SIMPLEFFMPEGOptions {
    fps?: number;
    width?: number;
    height?: number;
    validationMode?: "warn" | "strict";
  }

  interface ExportOptions {
    outputPath?: string;
    textMaxNodesPerPass?: number;
    intermediateVideoCodec?: string;
    intermediateCrf?: number;
    intermediatePreset?: string;
  }
}

declare class SIMPLEFFMPEG {
  constructor(options: SIMPLEFFMPEG.SIMPLEFFMPEGOptions);
  load(clips: SIMPLEFFMPEG.Clip[]): Promise<void[]>;
  export(options: SIMPLEFFMPEG.ExportOptions): Promise<string>;
}

export default SIMPLEFFMPEG;
