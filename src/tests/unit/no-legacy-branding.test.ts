import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

/*
 * Criterio de aceite 1 (Issue #1 - Rebranding):
 * Nenhuma ocorrencia de 'electron-shadcn' ou 'LuanRoger' (case-insensitive)
 * deve permanecer em arquivos de codigo/config do repo.
 *
 * Documentos historicos/plano (Plan.md, CHANGELOG.md) sao excluidos de proposito:
 * eles descrevem a origem do boilerplate e podem citar o nome antigo como contexto.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SELF_PATH = path.resolve(import.meta.dirname, "no-legacy-branding.test.ts");

const FORBIDDEN_TERMS = ["electron-shadcn", "luanroger"];

const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".vite",
  ".tanstack",
  ".maestri",
  "dist",
  "out",
  "coverage",
  "images",
  ".vscode",
  ".zed",
]);

const IGNORED_FILES = new Set(
  [
    "Plan.md",
    "CHANGELOG.md",
    "package-lock.json",
    // These test files legitimately reference the forbidden terms as
    // literal strings/regexes to assert their absence elsewhere.
    path.join("src", "tests", "unit", "branding-config.test.ts"),
    path.join("src", "tests", "unit", "branding-i18n.test.ts"),
  ].map((name) => path.join(ROOT, name))
);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".json",
  ".md",
  ".html",
  ".yml",
  ".yaml",
]);

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIR_NAMES.has(entry)) {
      continue;
    }

    const fullPath = path.join(dir, entry);
    const entryStat = statSync(fullPath);

    if (entryStat.isDirectory()) {
      collectFiles(fullPath, acc);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry))) {
      acc.push(fullPath);
    }
  }

  return acc;
}

test("no source/config file references legacy electron-shadcn/LuanRoger branding", () => {
  const files = collectFiles(ROOT).filter(
    (file) => file !== SELF_PATH && !IGNORED_FILES.has(file)
  );

  const offenders: string[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8").toLowerCase();
    const hasForbiddenTerm = FORBIDDEN_TERMS.some((term) =>
      content.includes(term)
    );

    if (hasForbiddenTerm) {
      offenders.push(path.relative(ROOT, file));
    }
  }

  expect(offenders).toEqual([]);
});
