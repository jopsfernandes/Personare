import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyExternalModules } from "../../../scripts/copy-external-modules";
import { EXTERNAL_MODULES } from "../../../scripts/external-modules";

const MISSING_MODULE_ERROR = /missing-mod/;
const WIN32_X64 = { arch: "x64", platform: "win32" } as const;
const LINUX_X64 = { arch: "x64", platform: "linux" } as const;

async function writeFiles(root: string, files: Record<string, string>) {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const filePath = path.join(root, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    })
  );
}

describe("copyExternalModules (Issue #111)", () => {
  let projectRoot: string;
  let buildPath: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(path.join(tmpdir(), "personare-root-"));
    buildPath = await mkdtemp(path.join(tmpdir(), "personare-build-"));
  });

  afterEach(async () => {
    await rm(projectRoot, { force: true, recursive: true });
    await rm(buildPath, { force: true, recursive: true });
  });

  it("lists better-sqlite3 as an external module", () => {
    expect(EXTERNAL_MODULES).toContain("better-sqlite3");
  });

  it("copies package.json, lib and prebuilds into the build's node_modules", async () => {
    await writeFiles(projectRoot, {
      "node_modules/mod-a/lib/index.js": "lib",
      "node_modules/mod-a/package.json": "{}",
      "node_modules/mod-a/prebuilds/win32-x64.node": "binary",
    });

    await copyExternalModules(buildPath, WIN32_X64, projectRoot, ["mod-a"]);

    const copied = await readdir(path.join(buildPath, "node_modules/mod-a"));
    expect(copied.sort()).toEqual(["lib", "package.json", "prebuilds"]);
  });

  it("skips the deps, src and build directories used only to compile or left by a local build", async () => {
    await writeFiles(projectRoot, {
      "node_modules/mod-a/build/Release/mod.node": "local build",
      "node_modules/mod-a/deps/sqlite3.c": "c",
      "node_modules/mod-a/lib/index.js": "lib",
      "node_modules/mod-a/package.json": "{}",
      "node_modules/mod-a/src/binding.cpp": "cpp",
    });

    await copyExternalModules(buildPath, WIN32_X64, projectRoot, ["mod-a"]);

    const copied = await readdir(path.join(buildPath, "node_modules/mod-a"));
    expect(copied).not.toContain("build");
    expect(copied).not.toContain("deps");
    expect(copied).not.toContain("src");
  });

  it("copies every listed module", async () => {
    await writeFiles(projectRoot, {
      "node_modules/mod-a/package.json": "{}",
      "node_modules/mod-b/package.json": "{}",
    });

    await copyExternalModules(buildPath, WIN32_X64, projectRoot, [
      "mod-a",
      "mod-b",
    ]);

    const copied = await readdir(path.join(buildPath, "node_modules"));
    expect(copied.sort()).toEqual(["mod-a", "mod-b"]);
  });

  it("keeps only the prebuild for the target platform and arch", async () => {
    await writeFiles(projectRoot, {
      "node_modules/mod-a/package.json": "{}",
      "node_modules/mod-a/prebuilds/darwin-arm64.node": "binary",
      "node_modules/mod-a/prebuilds/linux-arm64.node": "binary",
      "node_modules/mod-a/prebuilds/linuxmusl-x64.node": "binary",
      "node_modules/mod-a/prebuilds/win32-x64.node": "binary",
    });

    await copyExternalModules(buildPath, WIN32_X64, projectRoot, ["mod-a"]);

    const prebuilds = await readdir(
      path.join(buildPath, "node_modules/mod-a/prebuilds")
    );
    expect(prebuilds).toEqual(["win32-x64.node"]);
  });

  it("keeps the glibc and musl prebuilds of the target arch on Linux", async () => {
    // rpmbuild strips every ELF in the package and aborts on foreign-arch binaries.
    await writeFiles(projectRoot, {
      "node_modules/mod-a/package.json": "{}",
      "node_modules/mod-a/prebuilds/linux-arm64.node": "binary",
      "node_modules/mod-a/prebuilds/linux-x64.node": "binary",
      "node_modules/mod-a/prebuilds/linuxmusl-arm64.node": "binary",
      "node_modules/mod-a/prebuilds/linuxmusl-x64.node": "binary",
      "node_modules/mod-a/prebuilds/win32-x64.node": "binary",
    });

    await copyExternalModules(buildPath, LINUX_X64, projectRoot, ["mod-a"]);

    const prebuilds = await readdir(
      path.join(buildPath, "node_modules/mod-a/prebuilds")
    );
    expect(prebuilds.sort()).toEqual(["linux-x64.node", "linuxmusl-x64.node"]);
  });

  it("fails naming the module when it is not installed", async () => {
    await expect(
      copyExternalModules(buildPath, WIN32_X64, projectRoot, ["missing-mod"])
    ).rejects.toThrow(MISSING_MODULE_ERROR);
  });
});
