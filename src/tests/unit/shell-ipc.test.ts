import fs from "node:fs";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #103, Spec Driven TDD): src/ipc/shell does not expose an
 * `openPath` procedure yet. Every test below is expected to fail until the
 * Developer implements it, per
 * docs/specs/issue-103-pdf-native-open-difficulty-flow.md AC-2.
 *
 * shell.openPath() only exists in Electron's main process -- exercised here
 * through `createRouterClient`, with Electron's "shell" module mocked, same
 * pattern as src/ipc/dialog's own tests.
 */

const openExternalMock = vi.fn();
const openPathMock = vi.fn();

vi.mock("electron", () => ({
  shell: {
    openExternal: (...args: unknown[]) => openExternalMock(...args),
    openPath: (...args: unknown[]) => openPathMock(...args),
  },
}));

const SHELL_ROUTER_REGISTRATION_PATTERN = /\bshell\b/;

describe("shell IPC namespace (Issue #103)", () => {
  beforeEach(() => {
    openExternalMock.mockReset();
    openPathMock.mockReset();
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(SHELL_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes openExternalLink and openPath procedures", async () => {
    const { shell } = await import("@/ipc/shell");

    expect(shell.openExternalLink).toBeDefined();
    expect(shell.openPath).toBeDefined();
  });

  describe("openPath", () => {
    it("opens the given path with the OS default handler and returns a null errorMessage on success", async () => {
      openPathMock.mockResolvedValue("");
      const { shell } = await import("@/ipc/shell");
      const client = createRouterClient(shell);

      const result = await client.openPath({
        path: "C:\\Users\\aluno\\Documents\\apostila.pdf",
      });

      expect(openPathMock).toHaveBeenCalledWith(
        "C:\\Users\\aluno\\Documents\\apostila.pdf"
      );
      expect(result).toEqual({ errorMessage: null });
    });

    it("returns the errorMessage from shell.openPath when it fails", async () => {
      openPathMock.mockResolvedValue("File not found");
      const { shell } = await import("@/ipc/shell");
      const client = createRouterClient(shell);

      const result = await client.openPath({ path: "C:\\missing.pdf" });

      expect(result).toEqual({ errorMessage: "File not found" });
    });
  });
});
