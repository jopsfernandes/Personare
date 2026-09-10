import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #25, Spec Driven TDD): src/main/backend-client.ts does
 * not exist yet. Every test below is expected to fail until the Developer
 * implements fetchCurrentUser per
 * docs/specs/issue-25-oauth-login-electron.md.
 */

describe("fetchCurrentUser (Issue #25)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the user profile when the backend accepts the token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          avatarUrl: "https://example.com/a.png",
          email: "aluno@example.com",
          id: "user-1",
          name: "Aluno",
        }),
        { status: 200 }
      )
    );
    const { fetchCurrentUser } = await import("@/main/backend-client");

    const user = await fetchCurrentUser("the-jwt-token");

    expect(user).toEqual({
      avatarUrl: "https://example.com/a.png",
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/me"), {
      headers: { Authorization: "Bearer the-jwt-token" },
    });
  });

  it("returns null when the backend rejects the token (401)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
    const { fetchCurrentUser } = await import("@/main/backend-client");

    await expect(fetchCurrentUser("expired-token")).resolves.toBeNull();
  });

  it("returns null instead of throwing when the backend is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    const { fetchCurrentUser } = await import("@/main/backend-client");

    await expect(fetchCurrentUser("any-token")).resolves.toBeNull();
  });
});
