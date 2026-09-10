import fs from "node:fs";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #25, Spec Driven TDD): src/ipc/auth does not exist yet.
 * Every test below is expected to fail until the Developer implements the
 * "auth" oRPC namespace per docs/specs/issue-25-oauth-login-electron.md.
 *
 * shell.openExternal only does something real inside Electron's main
 * process -- mirroring dialog-ipc.test.ts/settings-ipc.test.ts, electron's
 * `shell` is mocked here. auth-token-storage's actual encryption (via
 * safeStorage) is already covered by auth-token-storage.test.ts -- here we
 * only need to confirm logout() delegates to clearToken, so that module is
 * mocked wholesale rather than re-mocking electron's safeStorage too.
 */

const openExternalMock = vi.fn();
const clearTokenMock = vi.fn();

vi.mock("electron", () => ({
  shell: {
    openExternal: (...args: unknown[]) => openExternalMock(...args),
  },
}));

vi.mock("@/main/auth-token-storage", () => ({
  clearToken: (...args: unknown[]) => clearTokenMock(...args),
  loadToken: vi.fn(),
  saveToken: vi.fn(),
}));

const AUTH_ROUTER_REGISTRATION_PATTERN = /\bauth\b/;

describe("auth IPC namespace (Issue #25)", () => {
  beforeEach(async () => {
    openExternalMock.mockReset().mockResolvedValue(undefined);
    const { setAuthSession, setAuthTokenFilePath } = await import(
      "@/ipc/auth/state"
    );
    setAuthSession(null);
    setAuthTokenFilePath(
      path.join(process.env.TEMP ?? "/tmp", "personare-auth-ipc-test.enc")
    );
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(AUTH_ROUTER_REGISTRATION_PATTERN);
  });

  describe("login", () => {
    it("opens the backend's Google login URL with the personare:// redirect_uri", async () => {
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await client.login();

      expect(openExternalMock).toHaveBeenCalledTimes(1);
      const [url] = openExternalMock.mock.calls[0] as [string];
      expect(url).toContain("/auth/google?");
      expect(url).toContain(
        `redirect_uri=${encodeURIComponent("personare://oauth-callback")}`
      );
    });
  });

  describe("getSession", () => {
    it("returns null when no one is logged in", async () => {
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await expect(client.getSession()).resolves.toBeNull();
    });

    it("returns the current session once one is set", async () => {
      const { auth } = await import("@/ipc/auth");
      const { setAuthSession } = await import("@/ipc/auth/state");
      setAuthSession({
        avatarUrl: null,
        email: "aluno@example.com",
        id: "user-1",
        name: "Aluno",
      });
      const client = createRouterClient(auth);

      await expect(client.getSession()).resolves.toEqual({
        avatarUrl: null,
        email: "aluno@example.com",
        id: "user-1",
        name: "Aluno",
      });
    });
  });

  describe("logout", () => {
    it("clears the in-memory session", async () => {
      const { auth } = await import("@/ipc/auth");
      const { setAuthSession } = await import("@/ipc/auth/state");
      setAuthSession({
        avatarUrl: null,
        email: "aluno@example.com",
        id: "user-1",
        name: "Aluno",
      });
      const client = createRouterClient(auth);

      await client.logout();

      await expect(client.getSession()).resolves.toBeNull();
    });

    it("deletes the persisted token file, if any", async () => {
      const { setAuthTokenFilePath } = await import("@/ipc/auth/state");
      const { saveToken } = await import("@/main/auth-token-storage");
      const tmpFile = path.join(
        process.env.TEMP ?? "/tmp",
        `personare-auth-ipc-test-${Date.now()}.enc`
      );
      setAuthTokenFilePath(tmpFile);
      vi.doMock("electron", () => ({
        safeStorage: {
          decryptString: (buffer: Buffer) => buffer.toString("utf-8"),
          encryptString: (value: string) => Buffer.from(value),
          isEncryptionAvailable: () => true,
        },
        shell: { openExternal: openExternalMock },
      }));
      saveToken(tmpFile, "a-token");
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await client.logout();

      expect(fs.existsSync(tmpFile)).toBe(false);
    });
  });
});
