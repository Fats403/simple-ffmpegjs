import { describe, it, expect } from "vitest";

const { generateGradientPPM, parseColor } = await import(
  "../../src/lib/gradient.js",
);

/** Read the red channel of pixel (x, y) from a 5x5 P6 PPM buffer. */
function pixelReader(ppm) {
  const headerEnd = ppm.indexOf("255\n") + 4;
  return (x, y) => ppm[headerEnd + (y * 5 + x) * 3];
}

function corners(direction) {
  const ppm = generateGradientPPM(5, 5, {
    type: "linear",
    colors: ["black", "white"],
    direction,
  });
  const px = pixelReader(ppm);
  return { TL: px(0, 0), TR: px(4, 0), BL: px(0, 4), BR: px(4, 4), C: px(2, 2) };
}

describe("gradient — linear direction handling", () => {
  it("angle 90 runs top to bottom", () => {
    expect(corners(90)).toEqual({ TL: 0, TR: 0, BL: 255, BR: 255, C: 128 });
  });

  it("angle 180 runs right to left instead of collapsing flat", () => {
    const c = corners(180);
    expect(c.TL).toBe(255);
    expect(c.TR).toBe(0);
    expect(c.BL).toBe(255);
    expect(c.BR).toBe(0);
  });

  it("angle 270 runs bottom to top instead of collapsing flat", () => {
    const c = corners(270);
    expect(c.TL).toBe(255);
    expect(c.BL).toBe(0);
  });

  it("angle 45 reaches the midpoint at the center, not saturated", () => {
    const c = corners(45);
    expect(c.TL).toBe(0);
    expect(c.BR).toBe(255);
    expect(c.C).toBeGreaterThan(100);
    expect(c.C).toBeLessThan(156);
  });

  it("an explicit 0 angle is horizontal, not swallowed by the vertical default", () => {
    const c = corners(0);
    expect(c.TL).toBe(0);
    expect(c.TR).toBe(255);
  });

  it("string directions keep their meaning", () => {
    expect(corners("vertical").BL).toBe(255);
    expect(corners("horizontal").TR).toBe(255);
  });
});

describe("gradient — parseColor", () => {
  it("resolves named colors, hex, and 0x forms", () => {
    expect(parseColor("navy")).toEqual([0, 0, 128]);
    expect(parseColor("#FF0000")).toEqual([255, 0, 0]);
    expect(parseColor("0x00FF00")).toEqual([0, 255, 0]);
    expect(parseColor("white@0.5")).toEqual([255, 255, 255]);
  });

  it("falls back to black for garbage", () => {
    expect(parseColor("notacolor")).toEqual([0, 0, 0]);
  });
});
