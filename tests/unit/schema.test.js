import { describe, it, expect } from "vitest";

const { formatSchema, formatModule, normalizeInstructions } =
  await import("../../src/schema/formatter.js");

const { getSchema, getSchemaModules } =
  await import("../../src/schema/index.js");

describe("schema/formatter", () => {
  describe("normalizeInstructions", () => {
    it("should return empty array for undefined", () => {
      expect(normalizeInstructions(undefined)).toEqual([]);
    });

    it("should return empty array for null", () => {
      expect(normalizeInstructions(null)).toEqual([]);
    });

    it("should wrap a string in an array", () => {
      expect(normalizeInstructions("hello")).toEqual(["hello"]);
    });

    it("should filter non-strings from an array", () => {
      expect(normalizeInstructions(["a", 42, "b", null])).toEqual(["a", "b"]);
    });

    it("should return empty array for non-string, non-array input", () => {
      expect(normalizeInstructions(42)).toEqual([]);
    });
  });

  describe("formatModule", () => {
    const minimalModule = {
      name: "Test Clip",
      description: "A test clip type.",
      schema: `{ type: "test"; }`,
    };

    it("should include name, description, and schema", () => {
      const output = formatModule(minimalModule);
      expect(output).toContain("## Test Clip");
      expect(output).toContain("A test clip type.");
      expect(output).toContain("{ type: \"test\"; }");
      expect(output).toContain("### Schema");
    });

    it("should render array enum values", () => {
      const mod = {
        ...minimalModule,
        enums: { "transition.type": ["fade", "wipe", "slide"] },
      };
      const output = formatModule(mod);
      expect(output).toContain("**transition.type:**");
      expect(output).toContain("`fade`");
      expect(output).toContain("`wipe`");
      expect(output).toContain("`slide`");
    });

    it("should render inline type enum values", () => {
      const mod = {
        ...minimalModule,
        enums: { TextWord: "{ text: string; start: number; end: number }" },
      };
      const output = formatModule(mod);
      expect(output).toContain(
        "**TextWord:** `{ text: string; start: number; end: number }`",
      );
    });

    it("should render notes", () => {
      const mod = {
        ...minimalModule,
        notes: ["Note one", "Note two"],
      };
      const output = formatModule(mod);
      expect(output).toContain("### Notes");
      expect(output).toContain("- Note one");
      expect(output).toContain("- Note two");
    });

    it("should blend extra instructions into notes", () => {
      const mod = {
        ...minimalModule,
        notes: ["Built-in note"],
      };
      const output = formatModule(mod, ["Custom instruction"]);
      expect(output).toContain("- Built-in note");
      expect(output).toContain("- Custom instruction");
    });

    it("should render examples", () => {
      const mod = {
        ...minimalModule,
        examples: [{ label: "Basic", code: "{ type: \"test\" }" }],
      };
      const output = formatModule(mod);
      expect(output).toContain("### Examples");
      expect(output).toContain("**Basic:**");
      expect(output).toContain("{ type: \"test\" }");
      expect(output).toContain("```json");
    });

    it("should omit notes section when no notes or instructions", () => {
      const output = formatModule(minimalModule);
      expect(output).not.toContain("### Notes");
    });

    it("should omit examples section when no examples", () => {
      const output = formatModule(minimalModule);
      expect(output).not.toContain("### Examples");
    });
  });

  describe("formatSchema", () => {
    const mod1 = {
      id: "video",
      name: "Video Clips",
      description: "Video clip description.",
      schema: "{ type: \"video\"; }",
    };
    const mod2 = {
      id: "audio",
      name: "Audio Clips",
      description: "Audio clip description.",
      schema: "{ type: \"audio\"; }",
    };

    it("should produce a header and timeline section", () => {
      const output = formatSchema([mod1]);
      expect(output).toContain("# SIMPLEFFMPEG — Clip Schema");
      expect(output).toContain("### Timeline");
      expect(output).toContain("seconds");
    });

    it("should list available clip types", () => {
      const output = formatSchema([mod1, mod2]);
      expect(output).toContain("### Available Clip Types");
      expect(output).toContain("\"video\"");
      expect(output).toContain("\"audio\"");
    });

    it("should include module sections with separators", () => {
      const output = formatSchema([mod1, mod2]);
      expect(output).toContain("## Video Clips");
      expect(output).toContain("## Audio Clips");
      expect(output).toContain("---");
    });

    it("should include top-level instructions when provided", () => {
      const output = formatSchema([mod1], {
        instructions: "Keep it short.",
      });
      expect(output).toContain("### Instructions");
      expect(output).toContain("- Keep it short.");
    });

    it("should include multiple top-level instructions", () => {
      const output = formatSchema([mod1], {
        instructions: ["Rule 1", "Rule 2"],
      });
      expect(output).toContain("- Rule 1");
      expect(output).toContain("- Rule 2");
    });

    it("should pass module instructions to individual modules", () => {
      const output = formatSchema([mod1], {
        moduleInstructions: { video: "Always use transitions." },
      });
      expect(output).toContain("- Always use transitions.");
    });

    it("should end with a newline", () => {
      const output = formatSchema([mod1]);
      expect(output.endsWith("\n")).toBe(true);
    });
  });
});

describe("schema/index", () => {
  describe("getSchemaModules", () => {
    it("should return all module IDs", () => {
      const ids = getSchemaModules();
      expect(ids).toContain("video");
      expect(ids).toContain("audio");
      expect(ids).toContain("image");
      expect(ids).toContain("color");
      expect(ids).toContain("effect");
      expect(ids).toContain("text");
      expect(ids).toContain("subtitle");
      expect(ids).toContain("music");
      expect(ids).toHaveLength(8);
    });

    it("should return a copy (not the internal array)", () => {
      const ids1 = getSchemaModules();
      const ids2 = getSchemaModules();
      expect(ids1).not.toBe(ids2);
      expect(ids1).toEqual(ids2);
    });
  });

  describe("getSchema", () => {
    it("should return full schema with all modules by default", () => {
      const schema = getSchema();
      expect(schema).toContain("Video Clips");
      expect(schema).toContain("Audio Clips");
      expect(schema).toContain("Text");
      expect(schema).toContain("Music");
    });

    it("should filter with include option", () => {
      const schema = getSchema({ include: ["video", "audio"] });
      expect(schema).toContain("Video Clips");
      expect(schema).toContain("Audio Clips");
      expect(schema).not.toContain("Image Clips");
      expect(schema).not.toContain("Effect Clips");
    });

    it("should filter with exclude option", () => {
      const schema = getSchema({ exclude: ["text", "subtitle"] });
      expect(schema).toContain("Video Clips");
      expect(schema).not.toContain("Text Overlays");
    });

    it("should throw for unknown include module", () => {
      expect(() => getSchema({ include: ["unknown"] })).toThrow(
        "Unknown schema module",
      );
    });

    it("should throw for unknown exclude module", () => {
      expect(() => getSchema({ exclude: ["unknown"] })).toThrow(
        "Unknown schema module",
      );
    });

    it("should pass instructions through", () => {
      const schema = getSchema({
        include: ["video"],
        instructions: "Custom rule",
      });
      expect(schema).toContain("Custom rule");
    });
  });
});
