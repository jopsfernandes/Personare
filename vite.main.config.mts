import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 ships a native .node binary (via prebuilds/<platform>.node,
      // resolved at require-time relative to its own package directory). Bundling
      // it would break that resolution -- keep it external so Node's normal
      // require() loads it straight from node_modules instead.
      external: ["better-sqlite3"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
