#!/usr/bin/env node

/**
 * Demo: Effects Pack — Overlay adjustment clips
 *
 * Usage: node examples/demo-effects-pack-1.js
 */

import path from "path";
import { fileURLToPath } from "url";
import SIMPLEFFMPEG from "../index.mjs";
import {
  FIXTURES_DIR,
  log,
  progress,
  getDuration,
  runDemos,
} from "./demo-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "output", "demo-effects-pack-1");

async function demo1_VignetteRamp() {
  log("DEMO 1: Vignette with fade-in/fade-out envelope");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });

  await project.load([
    {
      type: "image",
      url: path.join(FIXTURES_DIR, "test-image.jpg"),
      duration: 4,
      kenBurns: {
        type: "zoom-in",
        startZoom: 1,
        endZoom: 1.08,
        easing: "linear",
      },
    },
    {
      type: "effect",
      effect: "vignette",
      position: 0,
      duration: 4,
      fadeIn: 0.7,
      fadeOut: 0.7,
      easing: "ease-in-out",
      params: { amount: 0.9, angle: 0.7 },
    },
    {
      type: "text",
      text: "Vignette",
      position: 0.6,
      end: 3.2,
      fontSize: 48,
      fontColor: "white",
      yPercent: 0.15,
    },
  ]);

  const out = path.join(OUTPUT_DIR, "01-vignette-ramp.mp4");
  await project.export({
    outputPath: out,
    preset: "ultrafast",
    onProgress: progress,
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo2_ColorShiftWindow() {
  log("DEMO 2: Color shift (grading) in middle window");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });

  await project.load([
    {
      type: "image",
      url: path.join(FIXTURES_DIR, "test-image.jpg"),
      duration: 4,
      kenBurns: {
        type: "pan-right",
        startZoom: 1.06,
        endZoom: 1.06,
        easing: "linear",
      },
    },
    {
      type: "effect",
      effect: "colorAdjust",
      position: 0.8,
      end: 3.2,
      fadeIn: 0.3,
      fadeOut: 0.4,
      params: {
        amount: 0.9,
        contrast: 1.35,
        saturation: 1.9,
        gamma: 1.2,
        brightness: -0.06,
      },
    },
    {
      type: "text",
      text: "Color Shift Window",
      position: 0.3,
      end: 3.5,
      fontSize: 34,
      fontColor: "white",
      yPercent: 0.15,
    },
  ]);

  const out = path.join(OUTPUT_DIR, "02-color-shift-window.mp4");
  await project.export({
    outputPath: out,
    preset: "ultrafast",
    onProgress: progress,
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

async function demo3_BlurThenGrade() {
  log("DEMO 3: Blur then grade (letters/grid visibility test)");
  const project = new SIMPLEFFMPEG({ width: 640, height: 480, fps: 30 });

  await project.load([
    {
      type: "image",
      url: path.join(FIXTURES_DIR, "test-image.jpg"),
      position: 0,
      end: 4,
      kenBurns: {
        type: "zoom-out",
        startZoom: 1.1,
        endZoom: 1.02,
        easing: "linear",
      },
    },
    {
      type: "effect",
      effect: "gaussianBlur",
      position: 0,
      end: 2.2,
      fadeOut: 0.5,
      params: { sigma: 16, amount: 1 },
    },
    {
      type: "effect",
      effect: "colorAdjust",
      position: 1.6,
      end: 4,
      fadeIn: 0.5,
      params: {
        amount: 0.85,
        contrast: 1.25,
        saturation: 1.6,
        gamma: 1.15,
        brightness: -0.15,
      },
    },
    {
      type: "text",
      text: "Blur -> Grade",
      position: 0.3,
      end: 3.7,
      fontSize: 42,
      fontColor: "white",
      borderColor: "black",
      borderWidth: 2,
      yPercent: 0.12,
    },
  ]);

  const out = path.join(OUTPUT_DIR, "03-blur-then-grade.mp4");
  await project.export({
    outputPath: out,
    preset: "ultrafast",
    onProgress: progress,
  });
  console.log(`\n  Output: ${out}  (${getDuration(out)}s)`);
}

const { fail } = await runDemos("Effects Pack — Visual Demo", OUTPUT_DIR, [
  demo1_VignetteRamp,
  demo2_ColorShiftWindow,
  demo3_BlurThenGrade,
]);

console.log(`  WHAT TO CHECK:
  01  Vignette ramps in smoothly on the lettered grid image
  02  Noticeable color/contrast/saturation shift appears in the middle window
  03  Early heavy blur clearly softens letters/grid, then graded look takes over
`);

if (fail > 0) process.exit(1);
