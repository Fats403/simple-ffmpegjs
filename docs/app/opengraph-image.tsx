import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "simple-ffmpeg — Programmatic video composition for Node.js";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background:
          "linear-gradient(135deg, #0a0a0f 0%, #111827 60%, #0f1f0f 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#22c55e",
            width: "12px",
            height: "48px",
            borderRadius: "4px",
          }}
        />
        <div
          style={{
            color: "#ffffff",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-2px",
            lineHeight: 1,
          }}
        >
          simple-ffmpegjs
        </div>
      </div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 28,
          textAlign: "center",
          maxWidth: "800px",
          lineHeight: 1.4,
        }}
      >
        Programmatic video composition for Node.js
      </div>
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "48px",
        }}
      >
        <div
          style={{
            background: "#1e2a1e",
            border: "1px solid #22c55e",
            color: "#22c55e",
            fontSize: 20,
            padding: "12px 28px",
            borderRadius: "8px",
            fontFamily: "monospace",
            letterSpacing: "0.5px",
          }}
        >
          npm install simple-ffmpegjs
        </div>
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#94a3b8",
            fontSize: 20,
            padding: "12px 28px",
            borderRadius: "8px",
          }}
        >
          Node.js {">="} 18
        </div>
      </div>
    </div>,
    { ...size },
  );
}
