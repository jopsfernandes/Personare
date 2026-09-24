/**
 * Modules kept out of the Vite bundle because they ship a native `.node` binary
 * resolved relative to their own package directory. Being external means nothing
 * bundles them, so the Forge `packageAfterCopy` hook must copy them into the
 * packaged app (see `copy-external-modules.ts`).
 */
export const EXTERNAL_MODULES = ["better-sqlite3"];
