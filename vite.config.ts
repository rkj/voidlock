import { defineConfig } from "vite";
import path from "path";

export default defineConfig(({ command }) => ({
  root: "src",
  base: command === "build" ? "/voidlock/" : "/",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
    },
  },
}));
