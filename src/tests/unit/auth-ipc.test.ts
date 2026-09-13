import fs from "node:fs";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/main/backend-client", () => ({
  deleteAccount: vi.fn(),
  fetchAccountExport: vi.fn(),
}));

const { deleteAccount: deleteAccountMock, fetchAccountExport } = await import(
  "@/main/backend-client"
);

const AUTH_ROUTER_REGISTRATION_PATTERN = /\bauth\b/;

describe("auth IPC namespace (Issue #25)", () => {
  beforeEach(async () => {
    openExternalMock.mockReset().mockResolvedValue(undefined);
    vi.mocked(deleteAccountMock).mockReset();
    vi.mocked(fetchAccountExport).mockReset();
    const { setAuthSession, setAuthToken, setAuthTokenFilePath } = await import(
      "@/ipc/auth/state"
    );
    setAuthSession(null);
    setAuthToken("the-jwt-token");
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

    it("resets the Drive connection flag, so a different account doesn't inherit it (Issue #27)", async () => {
      const { setDriveConnected, getDriveConnected } = await import(
        "@/ipc/drive-backup/state"
      );
      setDriveConnected(true);
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await client.logout();

      expect(getDriveConnected()).toBe(false);
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

  describe("exportAccountData (Issue #28)", () => {
    let tmpDir: string;
    let filePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(
        path.join(process.env.TEMP ?? "/tmp", "personare-account-export-")
      );
      filePath = path.join(tmpDir, "account.json");
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    it("writes the backend's export payload to filePath using the current session token", async () => {
      vi.mocked(fetchAccountExport).mockResolvedValue({
        googleCalendarConnected: false,
        googleDriveConnected: false,
        profile: {
          avatarUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          email: "aluno@example.com",
          id: "user-1",
          name: "Aluno",
        },
      });
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await expect(client.exportAccountData({ filePath })).resolves.toBe(true);

      expect(fetchAccountExport).toHaveBeenCalledWith("the-jwt-token");
      expect(JSON.parse(fs.readFileSync(filePath, "utf-8"))).toEqual({
        googleCalendarConnected: false,
        googleDriveConnected: false,
        profile: {
          avatarUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          email: "aluno@example.com",
          id: "user-1",
          name: "Aluno",
        },
      });
    });

    it("returns false and writes nothing when not logged in", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken(null);
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await expect(client.exportAccountData({ filePath })).resolves.toBe(false);

      expect(fetchAccountExport).not.toHaveBeenCalled();
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("returns false when the backend export fails", async () => {
      vi.mocked(fetchAccountExport).mockResolvedValue(null);
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await expect(client.exportAccountData({ filePath })).resolves.toBe(false);

      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe("deleteAccount (Issue #28)", () => {
    it("clears the local session and persisted token on success", async () => {
      vi.mocked(deleteAccountMock).mockResolvedValue(true);
      const { setAuthSession } = await import("@/ipc/auth/state");
      setAuthSession({
        avatarUrl: null,
        email: "aluno@example.com",
        id: "user-1",
        name: "Aluno",
      });
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await expect(client.deleteAccount()).resolves.toBe(true);

      expect(clearTokenMock).toHaveBeenCalled();
      await expect(client.getSession()).resolves.toBeNull();
    });

    it("resets the Drive connection flag on success (Issue #27)", async () => {
      vi.mocked(deleteAccountMock).mockResolvedValue(true);
      const { setDriveConnected, getDriveConnected } = await import(
        "@/ipc/drive-backup/state"
      );
      setDriveConnected(true);
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await client.deleteAccount();

      expect(getDriveConnected()).toBe(false);
    });

    it("does not clear the local session when the backend refuses the deletion", async () => {
      vi.mocked(deleteAccountMock).mockResolvedValue(false);
      const { setAuthSession } = await import("@/ipc/auth/state");
      setAuthSession({
        avatarUrl: null,
        email: "aluno@example.com",
        id: "user-1",
        name: "Aluno",
      });
      const { auth } = await import("@/ipc/auth");
      const client = createRouterClient(auth);

      await expect(client.deleteAccount()).resolves.toBe(false);

      await expect(client.getSession()).resolves.not.toBeNull();
    });
  });
});
