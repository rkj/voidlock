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
  },
  esbuild: {
    jsxFactory: "createElement",
    jsxFragment: "Fragment",
    jsxInject: `import { createElement, Fragment } from "@src/renderer/jsx"`,
  },
});
