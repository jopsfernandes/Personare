import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

vi.mock("@/actions/streak", () => ({
  listActivityCounts: vi.fn(),
}));

const { listActivityCounts } = await import("@/actions/streak");
const { SidebarProvider } = await import("@/components/ui/sidebar");
const { StreakWidget } = await import("@/components/streak-widget");

function renderWidget() {
  return render(
    <SidebarProvider>
      <StreakWidget />
    </SidebarProvider>
  );
}

describe("StreakWidget", () => {
  beforeEach(() => {
    // Only Date is faked -- setInterval/setTimeout stay real so
    // testing-library's own findBy/waitFor polling (which relies on real
    // timers) keeps working without manual vi.advanceTimersByTime calls.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    vi.mocked(listActivityCounts).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the current streak count on the sidebar trigger", async () => {
    vi.mocked(listActivityCounts).mockResolvedValue([
      { count: 1, date: "2026-03-13", programId: "p1" },
      { count: 1, date: "2026-03-14", programId: "p1" },
      { count: 1, date: "2026-03-15", programId: "p2" },
    ]);

    renderWidget();

    expect(
      await screen.findByText(i18n.t("streakDaysLabel", { count: 3 }))
    ).toBeInTheDocument();
  });

  it("shows a 0-day streak when there is no activity yet", async () => {
    vi.mocked(listActivityCounts).mockResolvedValue([]);

    renderWidget();

    expect(
      await screen.findByText(i18n.t("streakDaysLabel", { count: 0 }))
    ).toBeInTheDocument();
  });

  it("opens a popover with today's day-of-month, streak stats and the hint message", async () => {
    const user = userEvent.setup();
    vi.mocked(listActivityCounts).mockResolvedValue([
      { count: 1, date: "2026-03-14", programId: "p1" },
      { count: 1, date: "2026-03-15", programId: "p1" },
    ]);
    renderWidget();
    await screen.findByText(i18n.t("streakDaysLabel", { count: 2 }));

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("streakDaysLabel", { count: 2 }),
      })
    );

    expect(
      screen.getByText(i18n.t("streakDayOfMonthLabel", { day: 15 }))
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t("streakCurrentLabel"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("streakBestLabel"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("streakHintMessage"))).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("streakResetsAtMidnightMessage"))
    ).toBeInTheDocument();
  });

  it("navigates to the next and previous month", async () => {
    const user = userEvent.setup();
    vi.mocked(listActivityCounts).mockResolvedValue([]);
    renderWidget();
    await screen.findByText(i18n.t("streakDaysLabel", { count: 0 }));

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("streakDaysLabel", { count: 0 }),
      })
    );

    expect(screen.getByText("March 2026")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: i18n.t("calendarNextAction") })
    );
    expect(screen.getByText("April 2026")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: i18n.t("calendarPreviousAction") })
    );
    expect(screen.getByText("March 2026")).toBeInTheDocument();
  });
});
