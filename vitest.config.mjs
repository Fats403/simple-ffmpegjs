import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.js",
    globals: true,
    testTimeout: 30000,
    include: ["tests/**/*.test.js"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      reporter: ["text", "lcov"],
    },
  },
});
