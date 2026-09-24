import path from "node:path";
import { defineConfig } from "vite";
import { EXTERNAL_MODULES } from "./scripts/external-modules";

export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 ships a native .node binary (via prebuilds/<platform>.node,
      // resolved at require-time relative to its own package directory). Bundling
      // it would break that resolution -- keep it external so Node's normal
      // require() loads it straight from node_modules instead. Forge only
      // packages the .vite output, so forge.config.ts copies these modules in.
      external: EXTERNAL_MODULES,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
