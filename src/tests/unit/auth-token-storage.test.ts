import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #25, Spec Driven TDD): src/main/auth-token-storage.ts
 * does not exist yet. Every test below is expected to fail until the
 * Developer implements saveToken/loadToken/clearToken per
 * docs/specs/issue-25-oauth-login-electron.md.
 *
 * Mirrors the precedent of tray-icon.test.ts/dialog-ipc.test.ts: electron's
 * safeStorage does not work outside a real Electron process, so it is
 * mocked here -- this module's own responsibility (reading/writing the
 * file, deciding when encryption is unavailable) is what's under test, not
 * safeStorage's actual OS-keychain behavior.
 */

const ENC_PREFIX_PATTERN = /^enc:/;

const isEncryptionAvailableMock = vi.fn();
const encryptStringMock = vi.fn();
const decryptStringMock = vi.fn();

vi.mock("electron", () => ({
  safeStorage: {
    decryptString: (...args: unknown[]) => decryptStringMock(...args),
    encryptString: (...args: unknown[]) => encryptStringMock(...args),
    isEncryptionAvailable: () => isEncryptionAvailableMock(),
  },
}));

const { clearToken, loadToken, saveToken } = await import(
  "@/main/auth-token-storage"
);

describe("auth-token-storage (Issue #25)", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-auth-token-"));
    filePath = path.join(tmpDir, "auth-token.enc");
    isEncryptionAvailableMock.mockReset().mockReturnValue(true);
    encryptStringMock
      .mockReset()
      .mockImplementation((value: string) => Buffer.from(`enc:${value}`));
    decryptStringMock
      .mockReset()
      .mockImplementation((buffer: Buffer) =>
        buffer.toString("utf-8").replace(ENC_PREFIX_PATTERN, "")
      );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  describe("saveToken / loadToken", () => {
    it("round-trips a token through encryption", () => {
      saveToken(filePath, "the-jwt-token");

      expect(loadToken(filePath)).toBe("the-jwt-token");
      expect(encryptStringMock).toHaveBeenCalledWith("the-jwt-token");
    });

    it("returns null when no token has been saved yet", () => {
      expect(loadToken(filePath)).toBeNull();
    });

    it("does not persist anything when encryption is unavailable", () => {
      isEncryptionAvailableMock.mockReturnValue(false);

      saveToken(filePath, "the-jwt-token");

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("returns null instead of throwing when encryption is unavailable at load time", () => {
      isEncryptionAvailableMock.mockReturnValue(false);

      expect(loadToken(filePath)).toBeNull();
    });

    it("returns null instead of throwing when the stored file is corrupted", () => {
      fs.writeFileSync(filePath, "not a valid encrypted blob");
      decryptStringMock.mockImplementation(() => {
        throw new Error("bad data");
      });

      expect(loadToken(filePath)).toBeNull();
    });
  });

  describe("clearToken", () => {
    it("removes a previously saved token file", () => {
      saveToken(filePath, "the-jwt-token");

      clearToken(filePath);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("does not throw when there is no token file to clear", () => {
      expect(() => clearToken(filePath)).not.toThrow();
    });
  });
});
