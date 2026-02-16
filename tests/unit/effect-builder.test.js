import { describe, it, expect } from "vitest";

const { buildEffectFilters, extractFilterName } = await import(
  "../../src/ffmpeg/effect_builder.js"
);

// ---------------------------------------------------------------------------
// Helper to create a minimal effect clip
// ---------------------------------------------------------------------------
function fx(effect, position, end, params = {}, opts = {}) {
  return {
    type: "effect",
    effect,
    position,
    end,
    fadeIn: opts.fadeIn || 0,
    fadeOut: opts.fadeOut || 0,
    params,
  };
}

// ===========================================================================
// buildEffectFilters — outer orchestrator
// ===========================================================================
describe("buildEffectFilters", () => {
  it("returns input label unchanged when no effects", () => {
    const result = buildEffectFilters([], "[basev]");
    expect(result.filter).toBe("");
    expect(result.finalVideoLabel).toBe("[basev]");
  });

  it("returns input label unchanged for null/undefined input", () => {
    expect(buildEffectFilters(null, "[v]").filter).toBe("");
    expect(buildEffectFilters(undefined, "[v]").filter).toBe("");
  });

  it("skips clips missing position or end", () => {
    const result = buildEffectFilters(
      [{ type: "effect", effect: "vignette", params: {} }],
      "[basev]"
    );
    expect(result.filter).toBe("");
    expect(result.finalVideoLabel).toBe("[basev]");
  });

  it("orders effects by position, then end", () => {
    const result = buildEffectFilters(
      [
        fx("colorAdjust", 4, 8, { contrast: 1.2 }),
        fx("gaussianBlur", 0, 3, { sigma: 6 }),
      ],
      "[basev]"
    );

    const blurIdx = result.filter.indexOf("gblur=sigma=6");
    const colorIdx = result.filter.indexOf("eq=brightness");
    expect(blurIdx).toBeGreaterThan(-1);
    expect(colorIdx).toBeGreaterThan(-1);
    expect(blurIdx).toBeLessThan(colorIdx);
    expect(result.finalVideoLabel).toBe("[fxout1]");
  });

  it("chains multiple effects through split/overlay pipeline", () => {
    const result = buildEffectFilters(
      [fx("vignette", 0, 5), fx("sepia", 0, 5)],
      "[basev]"
    );
    // First effect reads from [basev], outputs [fxout0]
    expect(result.filter).toContain("[basev]split=2[fxbase0][fxsrc0]");
    // Second effect reads from [fxout0], outputs [fxout1]
    expect(result.filter).toContain("[fxout0]split=2[fxbase1][fxsrc1]");
    expect(result.finalVideoLabel).toBe("[fxout1]");
  });
});

// ===========================================================================
// Fade envelopes
// ===========================================================================
describe("fade envelopes", () => {
  it("applies fadeIn on the alpha channel", () => {
    const result = buildEffectFilters(
      [fx("vignette", 1, 5, { amount: 0.8 }, { fadeIn: 0.5 })],
      "[v]"
    );
    expect(result.filter).toContain("fade=t=in:st=1:d=0.5:alpha=1");
  });

  it("applies fadeOut on the alpha channel", () => {
    const result = buildEffectFilters(
      [fx("vignette", 1, 5, { amount: 0.8 }, { fadeOut: 0.5 })],
      "[v]"
    );
    expect(result.filter).toContain("fade=t=out:st=4.5:d=0.5:alpha=1");
  });

  it("applies both fadeIn and fadeOut", () => {
    const result = buildEffectFilters(
      [fx("sepia", 0, 10, {}, { fadeIn: 1, fadeOut: 2 })],
      "[v]"
    );
    expect(result.filter).toContain("fade=t=in:st=0:d=1:alpha=1");
    expect(result.filter).toContain("fade=t=out:st=8:d=2:alpha=1");
  });

  it("omits fade filters when fadeIn and fadeOut are 0", () => {
    const result = buildEffectFilters([fx("sepia", 0, 5)], "[v]");
    expect(result.filter).not.toContain("fade=t=in");
    expect(result.filter).not.toContain("fade=t=out");
  });
});

// ===========================================================================
// amount (blend alpha)
// ===========================================================================
describe("amount / blend alpha", () => {
  it("defaults amount to 1 when not specified", () => {
    const result = buildEffectFilters([fx("sepia", 0, 5)], "[v]");
    expect(result.filter).toContain("colorchannelmixer=aa=1");
  });

  it("uses specified amount for blend alpha", () => {
    const result = buildEffectFilters(
      [fx("sepia", 0, 5, { amount: 0.6 })],
      "[v]"
    );
    expect(result.filter).toContain("colorchannelmixer=aa=0.6");
  });

  it("clamps amount to 0-1 range", () => {
    const over = buildEffectFilters(
      [fx("sepia", 0, 5, { amount: 1.5 })],
      "[v]"
    );
    expect(over.filter).toContain("colorchannelmixer=aa=1");

    const under = buildEffectFilters(
      [fx("sepia", 0, 5, { amount: -0.5 })],
      "[v]"
    );
    expect(under.filter).toContain("colorchannelmixer=aa=0");
  });
});

// ===========================================================================
// Per-effect filter generation
// ===========================================================================
describe("vignette effect", () => {
  it("generates vignette filter with default angle", () => {
    const result = buildEffectFilters([fx("vignette", 0, 5)], "[v]");
    expect(result.filter).toContain("vignette=angle=");
    expect(result.filter).toContain(":eval=frame");
  });

  it("uses custom angle", () => {
    const result = buildEffectFilters(
      [fx("vignette", 0, 5, { angle: 1.2 })],
      "[v]"
    );
    expect(result.filter).toContain("vignette=angle=1.2:eval=frame");
  });
});

describe("filmGrain effect", () => {
  it("generates noise filter with default strength", () => {
    const result = buildEffectFilters([fx("filmGrain", 0, 5)], "[v]");
    // default strength is 0.35 => 35
    expect(result.filter).toContain("noise=alls=35");
    expect(result.filter).toContain("allf=t+u");
  });

  it("uses custom strength independent of amount", () => {
    const result = buildEffectFilters(
      [fx("filmGrain", 0, 5, { amount: 0.5, strength: 0.8 })],
      "[v]"
    );
    // strength 0.8 => 80
    expect(result.filter).toContain("noise=alls=80");
    // amount 0.5 goes to blend alpha, not noise
    expect(result.filter).toContain("colorchannelmixer=aa=0.5");
  });

  it("respects temporal=false", () => {
    const result = buildEffectFilters(
      [fx("filmGrain", 0, 5, { temporal: false })],
      "[v]"
    );
    expect(result.filter).toContain("allf=u");
    expect(result.filter).not.toContain("allf=t+u");
  });
});

describe("gaussianBlur effect", () => {
  it("generates gblur with custom sigma", () => {
    const result = buildEffectFilters(
      [fx("gaussianBlur", 0, 5, { sigma: 12 })],
      "[v]"
    );
    expect(result.filter).toContain("gblur=sigma=12");
  });

  it("derives sigma from amount when sigma not set", () => {
    const result = buildEffectFilters(
      [fx("gaussianBlur", 0, 5, { amount: 0.5 })],
      "[v]"
    );
    // 0.5 * 20 = 10
    expect(result.filter).toContain("gblur=sigma=10");
  });

  it("uses default sigma when neither sigma nor amount set", () => {
    const result = buildEffectFilters(
      [fx("gaussianBlur", 0, 5, {})],
      "[v]"
    );
    // default amount=0.5 * 20 = 10
    expect(result.filter).toContain("gblur=sigma=10");
  });
});

describe("colorAdjust effect", () => {
  it("generates eq filter with defaults", () => {
    const result = buildEffectFilters([fx("colorAdjust", 0, 5)], "[v]");
    expect(result.filter).toContain("eq=brightness=0:contrast=1:saturation=1:gamma=1");
  });

  it("uses custom params", () => {
    const result = buildEffectFilters(
      [
        fx("colorAdjust", 0, 5, {
          brightness: -0.1,
          contrast: 1.5,
          saturation: 0.8,
          gamma: 1.2,
        }),
      ],
      "[v]"
    );
    expect(result.filter).toContain("brightness=-0.1");
    expect(result.filter).toContain("contrast=1.5");
    expect(result.filter).toContain("saturation=0.8");
    expect(result.filter).toContain("gamma=1.2");
  });
});

describe("sepia effect", () => {
  it("generates colorchannelmixer with sepia matrix", () => {
    const result = buildEffectFilters([fx("sepia", 0, 5)], "[v]");
    expect(result.filter).toContain("colorchannelmixer=");
    expect(result.filter).toContain(".393:.769:.189:0:");
    expect(result.filter).toContain(".349:.686:.168:0:");
    expect(result.filter).toContain(".272:.534:.131:0");
  });

  it("respects amount for blend alpha", () => {
    const result = buildEffectFilters(
      [fx("sepia", 0, 5, { amount: 0.4 })],
      "[v]"
    );
    expect(result.filter).toContain("colorchannelmixer=aa=0.4");
  });
});

describe("blackAndWhite effect", () => {
  it("generates hue=s=0 filter", () => {
    const result = buildEffectFilters([fx("blackAndWhite", 0, 5)], "[v]");
    expect(result.filter).toContain("hue=s=0");
  });

  it("does not add eq=contrast when contrast is default (1)", () => {
    const result = buildEffectFilters([fx("blackAndWhite", 0, 5)], "[v]");
    expect(result.filter).not.toContain("eq=contrast");
  });

  it("chains eq=contrast when contrast is specified", () => {
    const result = buildEffectFilters(
      [fx("blackAndWhite", 0, 5, { contrast: 1.3 })],
      "[v]"
    );
    expect(result.filter).toContain("hue=s=0,eq=contrast=1.3");
  });
});

describe("sharpen effect", () => {
  it("generates unsharp filter with default strength", () => {
    const result = buildEffectFilters([fx("sharpen", 0, 5)], "[v]");
    expect(result.filter).toContain("unsharp=5:5:1");
  });

  it("uses custom strength", () => {
    const result = buildEffectFilters(
      [fx("sharpen", 0, 5, { strength: 2.5 })],
      "[v]"
    );
    expect(result.filter).toContain("unsharp=5:5:2.5");
  });
});

describe("chromaticAberration effect", () => {
  it("generates rgbashift filter with default shift", () => {
    const result = buildEffectFilters(
      [fx("chromaticAberration", 0, 5)],
      "[v]"
    );
    expect(result.filter).toContain("rgbashift=rh=4:bh=-4");
  });

  it("uses custom shift", () => {
    const result = buildEffectFilters(
      [fx("chromaticAberration", 0, 5, { shift: 10 })],
      "[v]"
    );
    expect(result.filter).toContain("rgbashift=rh=10:bh=-10");
  });

  it("rounds fractional shift to integer", () => {
    const result = buildEffectFilters(
      [fx("chromaticAberration", 0, 5, { shift: 3.7 })],
      "[v]"
    );
    expect(result.filter).toContain("rgbashift=rh=4:bh=-4");
  });
});

describe("letterbox effect", () => {
  it("generates drawbox filters with default size", () => {
    const result = buildEffectFilters([fx("letterbox", 0, 5)], "[v]");
    expect(result.filter).toContain("drawbox=y=0:w=iw:h='round(ih*0.12)'");
    expect(result.filter).toContain(
      "drawbox=y='ih-round(ih*0.12)':w=iw:h='round(ih*0.12)'"
    );
    expect(result.filter).toContain("color=black");
  });

  it("uses custom size", () => {
    const result = buildEffectFilters(
      [fx("letterbox", 0, 5, { size: 0.2 })],
      "[v]"
    );
    expect(result.filter).toContain("round(ih*0.2)");
  });

  it("uses custom color", () => {
    const result = buildEffectFilters(
      [fx("letterbox", 0, 5, { color: "white" })],
      "[v]"
    );
    expect(result.filter).toContain("color=white");
  });
});

// ===========================================================================
// Unknown effect guard
// ===========================================================================
describe("unknown effect guard", () => {
  it("throws for unrecognized effect names", () => {
    expect(() =>
      buildEffectFilters([fx("doesNotExist", 0, 5)], "[v]")
    ).toThrow("Unknown effect type 'doesNotExist'");
  });
});

// ===========================================================================
// Empty filter name safeguard
// ===========================================================================
describe("empty filter name safeguard", () => {
  it("every known effect produces a non-empty filter name", () => {
    const effects = [
      { name: "vignette", params: {} },
      { name: "filmGrain", params: {} },
      { name: "gaussianBlur", params: { sigma: 5 } },
      { name: "colorAdjust", params: {} },
      { name: "sepia", params: {} },
      { name: "blackAndWhite", params: {} },
      { name: "sharpen", params: {} },
      { name: "chromaticAberration", params: {} },
      { name: "letterbox", params: {} },
    ];

    for (const { name, params } of effects) {
      const result = buildEffectFilters([fx(name, 0, 5, params)], "[v]");
      // Filter must contain the effect's filter chain — no empty filter names
      expect(result.filter.length).toBeGreaterThan(0);
      // The filter string should not contain ";;" (empty chain)
      expect(result.filter).not.toContain(";;");
    }
  });

  it("chromaticAberration with fractional shift (production case) produces valid filter", () => {
    // This mirrors the production clip that triggered the bug:
    // { shift: 0.6, amount: 0.18 } with short duration and fades
    const result = buildEffectFilters(
      [
        fx(
          "chromaticAberration",
          18.35,
          18.9,
          { amount: 0.18, shift: 0.6 },
          { fadeIn: 0.05, fadeOut: 0.2 }
        ),
      ],
      "[vtrans8]"
    );
    // shift 0.6 rounds to 1
    expect(result.filter).toContain("rgbashift=rh=1:bh=-1");
    expect(result.filter).not.toContain(";;");
    expect(result.finalVideoLabel).toBe("[fxout0]");
  });

  it("chromaticAberration with shift=0 still produces valid filter", () => {
    const result = buildEffectFilters(
      [fx("chromaticAberration", 0, 5, { shift: 0 })],
      "[v]"
    );
    expect(result.filter).toContain("rgbashift=rh=0:bh=0");
  });
});

// ===========================================================================
// extractFilterName
// ===========================================================================
describe("extractFilterName", () => {
  it("extracts filter name from standard filter segment", () => {
    expect(extractFilterName("[fxsrc0]rgbashift=rh=4:bh=-4[fxraw0];")).toBe(
      "rgbashift"
    );
  });

  it("extracts filter name from chained filters", () => {
    expect(
      extractFilterName("[fxsrc0]hue=s=0,eq=contrast=1.3[fxraw0];")
    ).toBe("hue");
  });

  it("extracts filter name from drawbox (letterbox)", () => {
    expect(
      extractFilterName(
        "[fxsrc0]drawbox=y=0:w=iw:h='round(ih*0.12)':color=black:t=fill[fxraw0];"
      )
    ).toBe("drawbox");
  });

  it("returns empty string for empty input", () => {
    expect(extractFilterName("")).toBe("");
  });

  it("returns empty string for labels-only input (no filter name)", () => {
    expect(extractFilterName("[a][b];")).toBe("");
  });

  it("extracts filter name without labels", () => {
    expect(extractFilterName("vignette=angle=0.6283:eval=frame")).toBe(
      "vignette"
    );
  });
});
