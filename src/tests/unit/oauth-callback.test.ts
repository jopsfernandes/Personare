import { describe, expect, it } from "vitest";

/**
 * RED phase (Issue #25, Spec Driven TDD): src/main/oauth-callback.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements findOAuthCallbackUrl/parseOAuthCallback per
 * docs/specs/issue-25-oauth-login-electron.md.
 *
 * These are the two pieces of main.ts's protocol-handling orchestration
 * that ARE pure enough to unit test in isolation (finding/parsing the
 * personare:// URL), unlike the Electron lifecycle wiring itself
 * (single-instance lock, open-url/second-instance events), which -- like
 * Issue #20's close-to-tray handling -- is validated manually instead.
 */

describe("findOAuthCallbackUrl", () => {
  it("finds the personare:// entry among other argv entries", async () => {
    const { findOAuthCallbackUrl } = await import("@/main/oauth-callback");

    const url = findOAuthCallbackUrl([
      "C:\\Program Files\\Personare\\Personare.exe",
      "personare://oauth-callback?token=abc123",
    ]);

    expect(url).toBe("personare://oauth-callback?token=abc123");
  });

  it("returns undefined when no argv entry is a personare:// URL", async () => {
    const { findOAuthCallbackUrl } = await import("@/main/oauth-callback");

    const url = findOAuthCallbackUrl([
      "C:\\Program Files\\Personare\\Personare.exe",
      "--some-flag",
    ]);

    expect(url).toBeUndefined();
  });
});

describe("parseOAuthCallback", () => {
  it("extracts the token from a successful callback URL", async () => {
    const { parseOAuthCallback } = await import("@/main/oauth-callback");

    expect(
      parseOAuthCallback("personare://oauth-callback?token=the-jwt-token")
    ).toEqual({ token: "the-jwt-token" });
  });

  it("extracts the error from a failed callback URL", async () => {
    const { parseOAuthCallback } = await import("@/main/oauth-callback");

    expect(
      parseOAuthCallback("personare://oauth-callback?error=auth_failed")
    ).toEqual({ error: "auth_failed" });
  });

  it("returns null for a URL with neither token nor error", async () => {
    const { parseOAuthCallback } = await import("@/main/oauth-callback");

    expect(parseOAuthCallback("personare://oauth-callback")).toBeNull();
  });

  it("returns null for an unparseable URL instead of throwing", async () => {
    const { parseOAuthCallback } = await import("@/main/oauth-callback");

    expect(parseOAuthCallback("not a url at all")).toBeNull();
  });
});
