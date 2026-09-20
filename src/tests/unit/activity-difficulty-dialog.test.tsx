import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (Issue #103, Spec Driven TDD): activity-difficulty-dialog still
 * takes a whole `Activity` and does not show Program/Module context or
 * clear a pending rating. Every test below is expected to fail until the
 * Developer updates it, per
 * docs/specs/issue-103-pdf-native-open-difficulty-flow.md AC-4.
 */

vi.mock("@/actions/review", () => ({
  clearPendingActivityRating: vi.fn(),
  markActivityDifficulty: vi.fn(),
}));

const { clearPendingActivityRating, markActivityDifficulty } = await import(
  "@/actions/review"
);
const { default: ActivityDifficultyDialog } = await import(
  "@/components/activity-difficulty-dialog"
);

const ACTIVITY_ID = "33333333-3333-3333-3333-333333333333";

function renderDialog(activityId: string | null = ACTIVITY_ID) {
  const onOpenChange = vi.fn();
  const onRated = vi.fn();

  render(
    <ActivityDifficultyDialog
      activityId={activityId}
      activityTitle="Quiz de Historia"
      moduleName="Historia do Brasil"
      onOpenChange={onOpenChange}
      onRated={onRated}
      open={activityId !== null}
      programName="Bacharelado II"
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

describe("ActivityDifficultyDialog (Issue #103)", () => {
  it("shows the activity title, program name and module name, and the four rating actions right away", () => {
    renderDialog();

    expect(screen.getByText("Quiz de Historia")).toBeInTheDocument();
    expect(
      screen.getByText("Bacharelado II", { exact: false })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Historia do Brasil", { exact: false })
    ).toBeInTheDocument();
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

    expect(markActivityDifficulty).toHaveBeenCalledWith(ACTIVITY_ID, "hard");
  });

  it("clears the pending rating after successfully rating", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    );

    expect(clearPendingActivityRating).toHaveBeenCalledWith(ACTIVITY_ID);
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
