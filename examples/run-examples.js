#!/usr/bin/env node

/**
 * simple-ffmpeg — Demo Runner
 *
 * Generates shared fixtures, then runs each demo script in sequence.
 * Each demo outputs to its own subfolder under examples/output/.
 *
 * Usage:
 *   node examples/run-examples.js              # run all demos
 *   node examples/run-examples.js transitions   # run only demo-transitions.js
 *   node examples/run-examples.js torture ken   # run torture test and ken burns
 *
 * Available demo names (partial match):
 *   timeline, transitions, text, ken-burns, audio, watermarks, karaoke, torture
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const DEMOS = [
  { name: "timeline-and-gaps",       file: "demo-timeline-and-gaps.js" },
  { name: "transitions",            file: "demo-transitions.js" },
  { name: "text-and-animations",    file: "demo-text-and-animations.js" },
  { name: "ken-burns",              file: "demo-ken-burns.js" },
  { name: "audio-mixing",           file: "demo-audio-mixing.js" },
  { name: "watermarks",             file: "demo-watermarks.js" },
  { name: "karaoke-and-subtitles",  file: "demo-karaoke-and-subtitles.js" },
  { name: "torture-test",           file: "demo-torture-test.js" },
];

// ============================================================================
// Utilities
// ============================================================================

function checkFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runDemo(demoFile) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, demoFile);
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Demo file not found: ${filePath}`));
      return;
    }

    const child = spawn("node", [filePath], {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${demoFile} exited with code ${code}`));
    });

    child.on("error", (err) => reject(err));
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n  simple-ffmpeg — Demo Runner\n");

  if (!checkFFmpeg()) {
    console.error("FFmpeg not found. Install it first: https://ffmpeg.org/download.html");
    process.exit(1);
  }

  // Filter demos by CLI args (partial match)
  const args = process.argv.slice(2);
  let demosToRun = DEMOS;
  if (args.length > 0) {
    demosToRun = DEMOS.filter((d) =>
      args.some((arg) => d.name.includes(arg.toLowerCase())),
    );
    if (demosToRun.length === 0) {
      console.error(`No demos matched: ${args.join(", ")}`);
      console.error(`Available: ${DEMOS.map((d) => d.name).join(", ")}`);
      process.exit(1);
    }
  }

  console.log(`  Running ${demosToRun.length} demo(s): ${demosToRun.map((d) => d.name).join(", ")}\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const demo of demosToRun) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${demo.file}`);
    console.log("=".repeat(60));

    try {
      await runDemo(demo.file);
      passed++;
    } catch (err) {
      console.error(`\n  FAILED: ${err.message}`);
      failed++;
      failures.push(demo.name);
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("  OVERALL SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Passed: ${passed}/${demosToRun.length}`);
  if (failed > 0) {
    console.log(`  Failed: ${failed} (${failures.join(", ")})`);
  }
  console.log(`\n  Output: ${path.join(__dirname, "output")}`);
  console.log(`  Open:   open "${path.join(__dirname, "output")}"\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
