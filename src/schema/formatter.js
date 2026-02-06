/**
 * Formats schema modules into prompt-ready text output.
 *
 * The output is optimized for LLM consumption: TypeScript-style type definitions
 * with inline comments, brief examples, and clear constraint notes.
 */

/**
 * Normalize instructions input to an array of strings.
 * Accepts a string, array of strings, or undefined.
 * @param {string|string[]|undefined} input
 * @returns {string[]}
 */
function normalizeInstructions(input) {
  if (!input) return [];
  if (typeof input === "string") return [input];
  if (Array.isArray(input)) return input.filter((s) => typeof s === "string");
  return [];
}

/**
 * Format a single schema module into a text section.
 * @param {Object} mod - The module definition
 * @param {string[]} extraInstructions - Developer-provided per-module instructions
 * @returns {string}
 */
function formatModule(mod, extraInstructions = []) {
  const lines = [];

  // Section heading
  lines.push(`## ${mod.name}`);
  lines.push("");
  lines.push(mod.description);
  lines.push("");

  // Type definition
  lines.push("### Schema");
  lines.push("");
  lines.push("```");
  lines.push(mod.schema.trim());
  lines.push("```");
  lines.push("");

  // Enum values
  if (mod.enums && Object.keys(mod.enums).length > 0) {
    for (const [name, values] of Object.entries(mod.enums)) {
      if (typeof values === "string") {
        // Inline type definition (e.g. TextWord)
        lines.push(`**${name}:** \`${values}\``);
      } else if (Array.isArray(values)) {
        lines.push(`**${name}:** ${values.map((v) => `\`${v}\``).join(", ")}`);
      }
      lines.push("");
    }
  }

  // Notes + developer instructions (blended together)
  const allNotes = [...(mod.notes || []), ...extraInstructions];
  if (allNotes.length > 0) {
    lines.push("### Notes");
    lines.push("");
    for (const note of allNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  // Examples
  if (mod.examples && mod.examples.length > 0) {
    lines.push("### Examples");
    lines.push("");
    for (const example of mod.examples) {
      lines.push(`**${example.label}:**`);
      lines.push("");
      lines.push("```json");
      lines.push(example.code.trim());
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format the full schema output from an array of modules.
 * @param {Object[]} modules - Array of module definitions to include
 * @param {Object} options - Formatting options
 * @param {string|string[]} options.instructions - Top-level custom instructions
 * @param {Object<string, string|string[]>} options.moduleInstructions - Per-module custom instructions
 * @returns {string}
 */
function formatSchema(modules, options = {}) {
  const lines = [];

  // Header
  lines.push("# SIMPLEFFMPEG — Clip Schema");
  lines.push("");
  lines.push(
    "Compose a video by defining an array of clips passed to `load(clips)`. Each clip has a `type` that determines its role."
  );
  lines.push("");

  // Timeline semantics
  lines.push("### Timeline");
  lines.push("");
  lines.push(
    "- All times are in **seconds**. `position` = when the clip starts, `end` = when it ends."
  );
  lines.push(
    "- **`duration`** can be used instead of `end`: the library computes `end = position + duration`. Cannot use both."
  );
  lines.push(
    "- **Auto-sequencing:** For video, image, and audio clips, `position` can be omitted. The clip will be placed immediately after the previous clip on its track. The first clip defaults to position 0."
  );
  lines.push(
    "- Video/image clips form the visual timeline. Audio, text, and music are layered on top."
  );
  lines.push(
    "- When video clips overlap with a transition, the overlapping time is shared — a 0.5s fade means the total video is 0.5s shorter."
  );
  lines.push(
    "- Text and subtitle positions represent **visual time** (what the viewer sees). Transition compression is handled automatically."
  );
  lines.push("");

  // Top-level custom instructions
  const topInstructions = normalizeInstructions(options.instructions);
  if (topInstructions.length > 0) {
    lines.push("### Instructions");
    lines.push("");
    for (const instruction of topInstructions) {
      lines.push(`- ${instruction}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Clip type summary
  const typeMap = {
    video: '"video"',
    audio: '"audio"',
    image: '"image"',
    text: '"text"',
    subtitle: '"subtitle"',
    music: '"music" or "backgroundAudio"',
  };
  const availableTypes = modules
    .filter((m) => typeMap[m.id])
    .map((m) => `\`${typeMap[m.id]}\` — ${m.name}`);
  if (availableTypes.length > 0) {
    lines.push("### Available Clip Types");
    lines.push("");
    for (const t of availableTypes) {
      lines.push(`- ${t}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Module sections
  const moduleInstructions = options.moduleInstructions || {};
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const extra = normalizeInstructions(moduleInstructions[mod.id]);
    lines.push(formatModule(mod, extra));
    if (i < modules.length - 1) {
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}

module.exports = { formatSchema, formatModule, normalizeInstructions };
