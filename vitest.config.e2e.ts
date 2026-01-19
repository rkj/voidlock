import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    globals: true,
    globalSetup: "./tests/e2e/setup.ts",
    testTimeout: 60000,
  },
});
