import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["node_modules", "dist", "tests/e2e"],
    // The suite is currently unstable at higher parallelism on this machine:
    // workers can hit `[vitest-worker]: Timeout calling "onTaskUpdate"`.
    maxWorkers: 2,
  },
  esbuild: {
    jsxFactory: "createElement",
    jsxFragment: "Fragment",
    jsxInject: `import { createElement, Fragment } from "@src/renderer/jsx"`,
  },
});
