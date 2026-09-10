import fs from "node:fs";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #26, Spec Driven TDD): src/ipc/calendar-sync does not
 * exist yet. Every test below is expected to fail until the Developer
 * implements the "calendarSync" oRPC namespace per
 * docs/specs/issue-26-google-calendar-sync.md AC-6.
 */

const openExternalMock = vi.fn();

vi.mock("electron", () => ({
  shell: {
    openExternal: (...args: unknown[]) => openExternalMock(...args),
  },
}));

vi.mock("@/main/backend-client", () => ({
  fetchCalendarAuthorizationUrl: vi.fn(),
  syncCalendarEvents: vi.fn(),
}));

const { fetchCalendarAuthorizationUrl, syncCalendarEvents } = await import(
  "@/main/backend-client"
);

const CALENDAR_SYNC_ROUTER_REGISTRATION_PATTERN = /\bcalendarSync\b/;

describe("calendarSync IPC namespace (Issue #26)", () => {
  beforeEach(async () => {
    openExternalMock.mockReset().mockResolvedValue(undefined);
    vi.mocked(fetchCalendarAuthorizationUrl).mockReset();
    vi.mocked(syncCalendarEvents).mockReset();

    const { setAuthToken } = await import("@/ipc/auth/state");
    setAuthToken("the-jwt-token");
    const { setCalendarConnected } = await import("@/ipc/calendar-sync/state");
    setCalendarConnected(false);
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(CALENDAR_SYNC_ROUTER_REGISTRATION_PATTERN);
  });

  describe("connect", () => {
    it("opens the backend's authorization URL when logged in", async () => {
      vi.mocked(fetchCalendarAuthorizationUrl).mockResolvedValue(
        "https://accounts.google.com/x"
      );
      const { calendarSync } = await import("@/ipc/calendar-sync");
      const client = createRouterClient(calendarSync);

      await client.connect();

      expect(fetchCalendarAuthorizationUrl).toHaveBeenCalledWith(
        "the-jwt-token",
        "personare://calendar-connect-callback"
      );
      expect(openExternalMock).toHaveBeenCalledWith(
        "https://accounts.google.com/x"
      );
    });

    it("does not open a browser when the backend refuses to return an authorization URL", async () => {
      vi.mocked(fetchCalendarAuthorizationUrl).mockResolvedValue(null);
      const { calendarSync } = await import("@/ipc/calendar-sync");
      const client = createRouterClient(calendarSync);

      await client.connect();

      expect(openExternalMock).not.toHaveBeenCalled();
    });
  });

  describe("getConnectionStatus", () => {
    it("reflects whatever the calendar-connect callback last set", async () => {
      const { setCalendarConnected } = await import(
        "@/ipc/calendar-sync/state"
      );
      const { calendarSync } = await import("@/ipc/calendar-sync");
      const client = createRouterClient(calendarSync);

      await expect(client.getConnectionStatus()).resolves.toBe(false);

      setCalendarConnected(true);

      await expect(client.getConnectionStatus()).resolves.toBe(true);
    });
  });

  describe("sync", () => {
    it("forwards the review items and returns the backend's reconciliation result", async () => {
      vi.mocked(syncCalendarEvents).mockResolvedValue({
        created: 1,
        deleted: 0,
        updated: 2,
      });
      const { calendarSync } = await import("@/ipc/calendar-sync");
      const client = createRouterClient(calendarSync);
      const reviewItems = [
        {
          dueDate: "2026-03-01T00:00:00.000Z",
          front: "Brasilia",
          id: "review-1",
        },
      ];

      await expect(client.sync({ reviewItems })).resolves.toEqual({
        created: 1,
        deleted: 0,
        updated: 2,
      });
      expect(syncCalendarEvents).toHaveBeenCalledWith(
        "the-jwt-token",
        reviewItems
      );
    });
  });
});
