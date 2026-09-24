import { access, cp } from "node:fs/promises";
import path from "node:path";
import { EXTERNAL_MODULES } from "./external-modules";

// Never needed at runtime: C/C++ sources (deps, src) and whatever a local
// `node-gyp` build left behind (build). The prebuilt binaries in `prebuilds/` are
// what ships, so the packaged app does not depend on the machine that built it.
const COMPILE_ONLY_DIRECTORIES = new Set(["build", "deps", "src"]);

/**
 * The Forge Vite plugin only packages the `.vite` build output, so modules
 * marked `external` in the Vite config never reach the packaged app. Copy them
 * from the project's `node_modules` into the build's `node_modules`.
 */
export async function copyExternalModules(
  buildPath: string,
  projectRoot: string = process.cwd(),
  modules: string[] = EXTERNAL_MODULES
) {
  await Promise.all(
    modules.map(async (moduleName) => {
      const source = path.join(projectRoot, "node_modules", moduleName);

      try {
        await access(source);
      } catch (error) {
        throw new Error(
          `External module "${moduleName}" not found at ${source}. Run npm ci before packaging.`,
          { cause: error }
        );
      }

      await cp(source, path.join(buildPath, "node_modules", moduleName), {
        filter: (sourcePath) => {
          const [topLevel] = path.relative(source, sourcePath).split(path.sep);
          return !COMPILE_ONLY_DIRECTORIES.has(topLevel);
        },
        recursive: true,
      });
    })
  );
}
