import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

/*
 * Criterio de aceite 2 (Issue #1 - Rebranding):
 * package.json (author) e forge.config.ts (publisher) devem refletir a
 * identidade Personare (repositorio jopsfernandes/Personare), sem
 * referencias a ROG/LuanRoger.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");

test("package.json author reflects Personare identity, not LuanRoger", () => {
  const pkg = JSON.parse(
    readFileSync(path.join(ROOT, "package.json"), "utf-8")
  );

  expect(typeof pkg.author).toBe("string");
  expect(pkg.author.toLowerCase()).not.toContain("luanroger");
  expect(pkg.author.toLowerCase()).toContain("personare");
});

test("forge.config.ts publisher points to the Personare GitHub repository", () => {
  const forgeConfigSource = readFileSync(
    path.join(ROOT, "forge.config.ts"),
    "utf-8"
  );

  expect(forgeConfigSource).not.toMatch(/electron-shadcn/i);
  expect(forgeConfigSource).not.toMatch(/LuanRoger/i);
  expect(forgeConfigSource).toMatch(/owner:\s*["']jopsfernandes["']/);
  expect(forgeConfigSource).toMatch(/name:\s*["']Personare["']/);
});

test("src/main.ts auto-updater points to the Personare GitHub repository", () => {
  const mainSource = readFileSync(
    path.join(ROOT, "src", "main.ts"),
    "utf-8"
  );

  expect(mainSource).not.toMatch(/electron-shadcn/i);
  expect(mainSource).not.toMatch(/LuanRoger/i);
  expect(mainSource).toMatch(/repo:\s*["']jopsfernandes\/Personare["']/);
});
