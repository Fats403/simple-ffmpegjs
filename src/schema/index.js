/**
 * Schema export system for SIMPLEFFMPEG.
 *
 * Provides a modular, prompt-ready description of the clip types accepted by load().
 * Designed for passing to LLMs, documentation generators, or any consumer that needs
 * a structured description of the library's clip format.
 */

const { formatSchema } = require("./formatter");

// Load all module definitions
const videoModule = require("./modules/video");
const audioModule = require("./modules/audio");
const imageModule = require("./modules/image");
const colorModule = require("./modules/color");
const effectModule = require("./modules/effect");
const textModule = require("./modules/text");
const subtitleModule = require("./modules/subtitle");
const musicModule = require("./modules/music");

/**
 * All available schema modules, keyed by ID.
 * Order here determines display order in the output.
 */
const ALL_MODULES = {
  video: videoModule,
  audio: audioModule,
  image: imageModule,
  color: colorModule,
  effect: effectModule,
  text: textModule,
  subtitle: subtitleModule,
  music: musicModule,
};

const ALL_MODULE_IDS = Object.keys(ALL_MODULES);

/**
 * Resolve which modules to include based on include/exclude options.
 * @param {Object} options
 * @param {string[]} options.include - Only include these modules
 * @param {string[]} options.exclude - Exclude these modules
 * @returns {Object[]} Array of module definitions
 */
function resolveModules(options = {}) {
  let ids = [...ALL_MODULE_IDS];

  if (Array.isArray(options.include) && options.include.length > 0) {
    // Validate include IDs
    for (const id of options.include) {
      if (!ALL_MODULES[id]) {
        throw new Error(
          `Unknown schema module "${id}". Available modules: ${ALL_MODULE_IDS.join(
            ", "
          )}`
        );
      }
    }
    // Preserve the order from ALL_MODULE_IDS for consistency
    ids = ALL_MODULE_IDS.filter((id) => options.include.includes(id));
  } else if (Array.isArray(options.exclude) && options.exclude.length > 0) {
    // Validate exclude IDs
    for (const id of options.exclude) {
      if (!ALL_MODULES[id]) {
        throw new Error(
          `Unknown schema module "${id}". Available modules: ${ALL_MODULE_IDS.join(
            ", "
          )}`
        );
      }
    }
    ids = ALL_MODULE_IDS.filter((id) => !options.exclude.includes(id));
  }

  return ids.map((id) => ALL_MODULES[id]);
}

/**
 * Get the clip schema as formatted prompt-ready text.
 *
 * @param {Object} [options] - Schema options
 * @param {string[]} [options.include] - Only include these module IDs
 * @param {string[]} [options.exclude] - Exclude these module IDs
 * @param {string|string[]} [options.instructions] - Custom top-level instructions
 * @param {Object<string, string|string[]>} [options.moduleInstructions] - Per-module instructions
 * @returns {string} Formatted schema text
 *
 * @example
 * // Get full schema
 * const schema = getSchema();
 *
 * @example
 * // Only video and image clips
 * const schema = getSchema({ include: ['video', 'image'] });
 *
 * @example
 * // Everything except text and subtitles, with custom instructions
 * const schema = getSchema({
 *   exclude: ['text', 'subtitle'],
 *   instructions: 'Keep videos under 30 seconds.',
 *   moduleInstructions: {
 *     video: 'Always use fade transitions between clips.'
 *   }
 * });
 */
function getSchema(options = {}) {
  const modules = resolveModules(options);
  return formatSchema(modules, {
    instructions: options.instructions,
    moduleInstructions: options.moduleInstructions,
  });
}

/**
 * Get the list of available schema module IDs.
 * @returns {string[]} Array of module IDs
 */
function getSchemaModules() {
  return [...ALL_MODULE_IDS];
}

module.exports = { getSchema, getSchemaModules };
