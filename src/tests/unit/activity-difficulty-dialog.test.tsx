import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { Activity } from "@/components/activities-data-table";

/**
 * RED phase (Issue #77, Spec Driven TDD): src/components/activity-difficulty-dialog
 * does not exist yet. One review_item per whole Activity means this dialog
 * has no queue and no "reveal answer" step (structurally the closest
 * precedent, review-session-dialog.tsx, has both) -- it is just the four
 * Again/Hard/Good/Easy actions for the given Activity, straight away.
 * Picking one calls markActivityDifficulty(activity.id, rating), then
 * closes (onOpenChange(false)) and tells the caller to refresh (onRated()).
 */

vi.mock("@/actions/review", () => ({
  markActivityDifficulty: vi.fn(),
}));

const { markActivityDifficulty } = await import("@/actions/review");
const { default: ActivityDifficultyDialog } = await import(
  "@/components/activity-difficulty-dialog"
);

const QUIZ_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-02"),
  filePath: null,
  id: "33333333-3333-3333-3333-333333333333",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Quiz de Historia",
  type: "quiz",
  updatedAt: new Date("2026-01-02"),
  url: null,
};

function renderDialog(activity: Activity | null = QUIZ_ACTIVITY) {
  const onOpenChange = vi.fn();
  const onRated = vi.fn();

  render(
    <ActivityDifficultyDialog
      activity={activity}
      onOpenChange={onOpenChange}
      onRated={onRated}
      open={activity !== null}
    />
  );

  return { onOpenChange, onRated };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(markActivityDifficulty).mockResolvedValue({
    id: "r1",
  } as Awaited<ReturnType<typeof markActivityDifficulty>>);
});

describe("ActivityDifficultyDialog (Issue #77)", () => {
  it("shows the Activity's title and the four rating actions right away, no reveal step", () => {
    renderDialog();

    expect(screen.getByText(QUIZ_ACTIVITY.title)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingAgainAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingHardAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingEasyAction") })
    ).toBeInTheDocument();
  });

  it("calls markActivityDifficulty with the activity id and the picked rating", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: i18n.t("ratingHardAction") })
    );

    expect(markActivityDifficulty).toHaveBeenCalledWith(
      QUIZ_ACTIVITY.id,
      "hard"
    );
  });

  it("closes the dialog and notifies the caller to refresh after rating", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onRated } = renderDialog();

    await user.click(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRated).toHaveBeenCalled();
  });
});
