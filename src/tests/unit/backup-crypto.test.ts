import { describe, expect, it } from "vitest";

/**
 * RED phase (Issue #21, Spec Driven TDD): src/utils/backup-crypto.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements encryptBackup/decryptBackup per
 * docs/specs/issue-21-backup-local.md AC-2.
 */

describe("backup-crypto (Issue #21)", () => {
  it("round-trips plaintext through encryptBackup/decryptBackup with the correct passphrase", async () => {
    const { decryptBackup, encryptBackup } = await import(
      "@/utils/backup-crypto"
    );

    const plaintext = JSON.stringify({ hello: "world" });
    const encrypted = encryptBackup(plaintext, "correct-horse-battery-staple");

    expect(decryptBackup(encrypted, "correct-horse-battery-staple")).toBe(
      plaintext
    );
  });

  it("produces a different ciphertext on every call, even for the same plaintext and passphrase (random salt/iv)", async () => {
    const { encryptBackup } = await import("@/utils/backup-crypto");

    const a = encryptBackup("same plaintext", "same-passphrase");
    const b = encryptBackup("same plaintext", "same-passphrase");

    expect(a.equals(b)).toBe(false);
  });

  it("throws when decrypting with the wrong passphrase", async () => {
    const { decryptBackup, encryptBackup } = await import(
      "@/utils/backup-crypto"
    );

    const encrypted = encryptBackup("secret data", "right-passphrase");

    expect(() => decryptBackup(encrypted, "wrong-passphrase")).toThrow();
  });

  it("throws when decrypting a truncated/corrupted buffer", async () => {
    const { decryptBackup, encryptBackup } = await import(
      "@/utils/backup-crypto"
    );

    const encrypted = encryptBackup("secret data", "a-passphrase");
    const corrupted = encrypted.subarray(0, encrypted.length - 5);

    expect(() => decryptBackup(corrupted, "a-passphrase")).toThrow();
  });

  it("throws when decrypting a buffer that is not a Personare backup (bad magic)", async () => {
    const { decryptBackup } = await import("@/utils/backup-crypto");

    const notABackup = Buffer.from(
      "this is just some random text, not one of our backups"
    );

    expect(() => decryptBackup(notABackup, "any-passphrase")).toThrow();
  });
});
