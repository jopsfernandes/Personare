import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (Issue #18, Spec Driven TDD): src/routes/calendar.tsx is still
 * the Issue #17 placeholder (`<h1>{t("navCalendar")}</h1>`) -- it does not
 * yet export a `CalendarPage` named export, call
 * ensureReviewItems/listSchedule, or render `<EventCalendar>`. Every test
 * below is expected to fail until the Developer implements
 * docs/specs/issue-18-calendario.md AC-4.
 *
 * This suite intentionally does NOT install or exercise the real
 * `@reui/event-calendar` component -- installing it is AC-1, explicitly the
 * Developer's job, not the Testador's. `@/components/reui/event-calendar`
 * (the barrel the spec's own composition example imports EventCalendar/
 * EventCalendarNav/EventCalendarContent from) is mocked here so these tests
 * only assert the OBSERVABLE wiring: ensureReviewItems then listSchedule
 * are called on mount, the rows are passed through toCalendarEvents, and
 * the mapped events end up in EventCalendar's `events` prop.
 * Rendering the real month/agenda grid is the ReUI library's own
 * responsibility, not re-tested here.
 *
 * CalendarPage must become a named export (in addition to the existing
 * default `Route` export) for it to be renderable in isolation -- the same
 * reasoning that already motivates every other *-dialog.tsx default export
 * in this codebase, just applied to a route component instead. It is
 * rendered inside a minimal TanStack Router harness (mirroring
 * src/tests/unit/app-sidebar.test.tsx) rather than standalone, since the
 * spec's renderEvent click handler needs a real `useNavigate()` context.
 */

vi.mock("@/actions/calendar", () => ({
  ensureReviewItems: vi.fn(),
  listSchedule: vi.fn(),
  toCalendarEvents: vi.fn(),
}));

vi.mock("@/components/reui/event-calendar", () => ({
  EventCalendar: vi.fn(({ children }: { children?: ReactNode }) => (
    <div data-testid="event-calendar">{children}</div>
  )),
  EventCalendarContent: () => <div data-testid="event-calendar-content" />,
  EventCalendarNav: () => <div data-testid="event-calendar-nav" />,
}));

vi.mock("@/actions/calendar-sync", () => ({
  getCalendarConnectionStatus: vi.fn(),
  syncCalendar: vi.fn(),
}));

const { ensureReviewItems, listSchedule, toCalendarEvents } = await import(
  "@/actions/calendar"
);
const { EventCalendar } = await import("@/components/reui/event-calendar");
const { getCalendarConnectionStatus, syncCalendar } = await import(
  "@/actions/calendar-sync"
);
const { CalendarPage } = await import("@/routes/calendar");

const SCHEDULE_ROWS = [
  {
    activityId: "a1",
    activityTitle: "Baralho de fixacao",
    dueDate: new Date("2026-02-01T00:00:00Z"),
    front: "Brasilia",
    id: "r1",
    moduleId: "m1",
    programId: "p1",
  },
];

const MAPPED_EVENTS = [
  {
    allDay: true,
    data: { moduleId: "m1", programId: "p1" },
    end: new Date("2026-02-02T00:00:00Z"),
    id: "r1",
    readOnly: true,
    start: new Date("2026-02-01T00:00:00Z"),
    title: "Brasilia",
  },
];

function renderCalendarPage() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const calendarRoute = createRoute({
    component: CalendarPage,
    getParentRoute: () => rootRoute,
    path: "/calendar",
  });
  const routeTree = rootRoute.addChildren([calendarRoute]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/calendar"] }),
    routeTree,
  });

  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureReviewItems).mockResolvedValue(undefined);
  vi.mocked(listSchedule).mockResolvedValue(SCHEDULE_ROWS);
  vi.mocked(toCalendarEvents).mockReturnValue(MAPPED_EVENTS);
  vi.mocked(getCalendarConnectionStatus).mockResolvedValue(false);
});

describe("CalendarPage (Issue #18)", () => {
  it("calls ensureReviewItems and then listSchedule on mount", async () => {
    renderCalendarPage();

    await waitFor(() => {
      expect(listSchedule).toHaveBeenCalled();
    });
    expect(ensureReviewItems).toHaveBeenCalled();
    expect(
      vi.mocked(ensureReviewItems).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(listSchedule).mock.invocationCallOrder[0]);
  });

  it("maps the rows returned by listSchedule through toCalendarEvents", async () => {
    renderCalendarPage();

    await waitFor(() => {
      expect(toCalendarEvents).toHaveBeenCalledWith(SCHEDULE_ROWS);
    });
  });

  it("passes the events from toCalendarEvents to EventCalendar's events prop", async () => {
    renderCalendarPage();

    await waitFor(() => {
      const lastCall = vi.mocked(EventCalendar).mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(
        expect.objectContaining({ events: MAPPED_EVENTS })
      );
    });
  });

  it("renders EventCalendarNav and EventCalendarContent inside EventCalendar", async () => {
    renderCalendarPage();

    expect(await screen.findByTestId("event-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("event-calendar-nav")).toBeInTheDocument();
    expect(screen.getByTestId("event-calendar-content")).toBeInTheDocument();
  });
});

describe("CalendarPage Google Calendar sync (Issue #26)", () => {
  it("disables the sync action until the calendar is connected", async () => {
    renderCalendarPage();

    expect(
      await screen.findByRole("button", { name: i18n.t("syncCalendarAction") })
    ).toBeDisabled();
  });

  it("enables the sync action once the calendar is connected", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    renderCalendarPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: i18n.t("syncCalendarAction") })
      ).not.toBeDisabled();
    });
  });

  it("syncs the currently loaded schedule rows and shows the reconciliation counts", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    vi.mocked(syncCalendar).mockResolvedValue({
      created: 1,
      deleted: 0,
      updated: 2,
    });
    const user = userEvent.setup();
    renderCalendarPage();
    const button = await screen.findByRole("button", {
      name: i18n.t("syncCalendarAction"),
    });
    await waitFor(() => expect(button).not.toBeDisabled());

    await user.click(button);

    await waitFor(() => {
      expect(syncCalendar).toHaveBeenCalledWith([
        {
          dueDate: "2026-02-01T00:00:00.000Z",
          front: "Brasilia",
          id: "r1",
        },
      ]);
    });
    expect(
      await screen.findByText(
        i18n.t("calendarSyncResultMessage", {
          created: 1,
          deleted: 0,
          updated: 2,
        })
      )
    ).toBeInTheDocument();
  });

  it("shows a not-connected message when the backend reports calendar_not_connected", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    vi.mocked(syncCalendar).mockResolvedValue({
      error: "calendar_not_connected",
    });
    const user = userEvent.setup();
    renderCalendarPage();
    const button = await screen.findByRole("button", {
      name: i18n.t("syncCalendarAction"),
    });
    await waitFor(() => expect(button).not.toBeDisabled());

    await user.click(button);

    expect(
      await screen.findByText(i18n.t("calendarNotConnectedErrorMessage"))
    ).toBeInTheDocument();
  });

  it("shows a generic error message when syncCalendar rejects", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    vi.mocked(syncCalendar).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderCalendarPage();
    const button = await screen.findByRole("button", {
      name: i18n.t("syncCalendarAction"),
    });
    await waitFor(() => expect(button).not.toBeDisabled());

    await user.click(button);

    expect(
      await screen.findByText(i18n.t("calendarSyncErrorMessage"))
    ).toBeInTheDocument();
  });
});
