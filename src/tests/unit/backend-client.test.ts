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

describe("fetchCalendarAuthorizationUrl (Issue #26)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the authorizationUrl when the backend accepts the token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ authorizationUrl: "https://accounts.google.com/x" }),
        { status: 200 }
      )
    );
    const { fetchCalendarAuthorizationUrl } = await import(
      "@/main/backend-client"
    );

    const url = await fetchCalendarAuthorizationUrl(
      "the-jwt-token",
      "personare://calendar-connect-callback"
    );

    expect(url).toBe("https://accounts.google.com/x");
    const [requestUrl, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(requestUrl).toContain("/calendar/connect?redirect_uri=");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer the-jwt-token",
    });
  });

  it("returns null when the backend rejects the request", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
    const { fetchCalendarAuthorizationUrl } = await import(
      "@/main/backend-client"
    );

    await expect(
      fetchCalendarAuthorizationUrl("expired-token", "personare://x")
    ).resolves.toBeNull();
  });

  it("returns null instead of throwing when the backend is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    const { fetchCalendarAuthorizationUrl } = await import(
      "@/main/backend-client"
    );

    await expect(
      fetchCalendarAuthorizationUrl("any-token", "personare://x")
    ).resolves.toBeNull();
  });
});

describe("syncCalendarEvents (Issue #26)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const REVIEW_ITEMS = [
    { dueDate: "2026-03-01T00:00:00.000Z", front: "Brasilia", id: "review-1" },
  ];

  it("returns the reconciliation counts on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ created: 1, deleted: 0, updated: 0 }), {
        status: 200,
      })
    );
    const { syncCalendarEvents } = await import("@/main/backend-client");

    const result = await syncCalendarEvents("the-jwt-token", REVIEW_ITEMS);

    expect(result).toEqual({ created: 1, deleted: 0, updated: 0 });
    const [requestUrl, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(requestUrl).toContain("/calendar/sync");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer the-jwt-token",
    });
  });

  it("returns an error result when the calendar is not connected (409)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "calendar_not_connected" }), {
        status: 409,
      })
    );
    const { syncCalendarEvents } = await import("@/main/backend-client");

    const result = await syncCalendarEvents("the-jwt-token", REVIEW_ITEMS);

    expect(result).toEqual({ error: "calendar_not_connected" });
  });

  it("returns a generic error result instead of throwing when the backend is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    const { syncCalendarEvents } = await import("@/main/backend-client");

    const result = await syncCalendarEvents("the-jwt-token", REVIEW_ITEMS);

    expect(result).toEqual({ error: "unreachable" });
  });
});
