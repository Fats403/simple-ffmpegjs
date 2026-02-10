import { describe, it, expect } from "vitest";

const { buildEffectFilters } = await import("../../src/ffmpeg/effect_builder.js");

describe("buildEffectFilters", () => {
  it("should return input label unchanged when no effects", () => {
    const result = buildEffectFilters([], "[basev]");
    expect(result.filter).toBe("");
    expect(result.finalVideoLabel).toBe("[basev]");
  });

  it("should build vignette effect with envelope blend", () => {
    const result = buildEffectFilters(
      [
        {
          type: "effect",
          effect: "vignette",
          position: 1,
          end: 5,
          fadeIn: 0.5,
          fadeOut: 0.5,
          easing: "ease-in-out",
          params: { amount: 0.8, angle: 0.6 },
        },
      ],
      "[basev]"
    );

    expect(result.filter).toContain("vignette=angle=0.6:eval=frame");
    expect(result.filter).toContain("overlay=shortest=1:eof_action=pass");
    expect(result.filter).toContain("fade=t=in:st=1:d=0.5:alpha=1");
    expect(result.filter).toContain("fade=t=out:st=4.5:d=0.5:alpha=1");
    expect(result.finalVideoLabel).toBe("[fxout0]");
  });

  it("should build gaussian blur and colorAdjust in timeline order", () => {
    const result = buildEffectFilters(
      [
        {
          type: "effect",
          effect: "colorAdjust",
          position: 4,
          end: 8,
          params: { contrast: 1.2, saturation: 1.1 },
        },
        {
          type: "effect",
          effect: "gaussianBlur",
          position: 0,
          end: 3,
          params: { sigma: 6 },
        },
      ],
      "[basev]"
    );

    const blurIdx = result.filter.indexOf("gblur=sigma=6");
    const colorIdx = result.filter.indexOf(
      "eq=brightness=0:contrast=1.2:saturation=1.1:gamma=1"
    );
    expect(blurIdx).toBeGreaterThan(-1);
    expect(colorIdx).toBeGreaterThan(-1);
    expect(blurIdx).toBeLessThan(colorIdx);
    expect(result.finalVideoLabel).toBe("[fxout1]");
  });
});
