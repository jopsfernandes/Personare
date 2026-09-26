import { access, cp } from "node:fs/promises";
import path from "node:path";
import { EXTERNAL_MODULES } from "./external-modules";

// Never needed at runtime: C/C++ sources (deps, src) and whatever a local
// `node-gyp` build left behind (build). The prebuilt binaries in `prebuilds/` are
// what ships, so the packaged app does not depend on the machine that built it.
const COMPILE_ONLY_DIRECTORIES = new Set(["build", "deps", "src"]);

interface PackageTarget {
  arch: string;
  platform: string;
}

// Mirrors how better-sqlite3 picks `prebuilds/<target>.node` at runtime. Binaries
// for other targets are dead weight, and rpmbuild aborts trying to strip them.
function targetPrebuilds({ arch, platform }: PackageTarget) {
  const names = [`${platform}-${arch}.node`];
  if (platform === "linux") {
    names.push(`linuxmusl-${arch}.node`);
  }
  return new Set(names);
}

/**
 * The Forge Vite plugin only packages the `.vite` build output, so modules
 * marked `external` in the Vite config never reach the packaged app. Copy them
 * from the project's `node_modules` into the build's `node_modules`.
 */
export async function copyExternalModules(
  buildPath: string,
  target: PackageTarget,
  projectRoot: string = process.cwd(),
  modules: string[] = EXTERNAL_MODULES
) {
  const keptPrebuilds = targetPrebuilds(target);

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
          const [topLevel, file] = path
            .relative(source, sourcePath)
            .split(path.sep);
          if (topLevel === "prebuilds" && file) {
            return keptPrebuilds.has(file);
          }
          return !COMPILE_ONLY_DIRECTORIES.has(topLevel);
        },
        recursive: true,
      });
    })
  );
}
