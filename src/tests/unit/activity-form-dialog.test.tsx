import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import type { Activity } from "@/components/activities-data-table";
import ActivityFormDialog from "@/components/activity-form-dialog";
import "@/localization/i18n";

/**
 * RED phase (Issue #12, Spec Driven TDD): ActivityFormDialog does not yet
 * render a URL field, nor pass a "url" value to onSubmit. Every test below
 * is expected to fail until Bancada (Developer) extends the component.
 *
 * Contract exercised here:
 * - criterio de aceite 2: a URL field (labeled via the "activityUrlLabel"
 *   i18n key) is rendered ONLY when the selected/current type is "link".
 * - criterio de aceite 3: creating/editing a Link activity submits the
 *   typed url alongside title and type; non-Link activities submit a null
 *   url regardless of what the field would otherwise contain, since the
 *   field isn't rendered for them.
 * - criterio de aceite 5: no hardcoded UI text -- the label is read
 *   through i18n.t, only the key name is asserted.
 *
 * ActivityFormDialog defaults a brand-new activity's type to the first
 * MVP_ACTIVITY_TYPES entry, which is "link" -- so creating (activity=null)
 * exercises the "type is link" branch by default, and editing an existing
 * non-link activity exercises the "type is not link" branch without any
 * Select interaction (Radix Select pointer-capture APIs are unreliable
 * under jsdom, so type-switching is driven through the `activity` prop
 * instead of simulating a Select interaction).
 */

const LINK_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-01"),
  id: "11111111-1111-1111-1111-111111111111",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Aula introdutoria",
  type: "link",
  updatedAt: new Date("2026-01-01"),
  url: "https://example.com/aula-introdutoria",
};

const QUIZ_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-02"),
  id: "22222222-2222-2222-2222-222222222222",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Quiz de fixacao",
  type: "quiz",
  updatedAt: new Date("2026-01-02"),
  url: null,
};

function renderDialog(activity: Activity | null = null) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <ActivityFormDialog
      activity={activity}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={true}
    />
  );

  return { onOpenChange, onSubmit };
}

describe("ActivityFormDialog", () => {
  it("renders a URL field when creating a new activity, which defaults to type link", () => {
    renderDialog(null);

    expect(
      screen.getByLabelText(i18n.t("activityUrlLabel"))
    ).toBeInTheDocument();
  });

  it("renders a URL field, pre-filled with the current value, when editing a Link activity", () => {
    renderDialog(LINK_ACTIVITY);

    expect(screen.getByLabelText(i18n.t("activityUrlLabel"))).toHaveValue(
      LINK_ACTIVITY.url
    );
  });

  it("does not render a URL field when editing an activity whose type is not link", () => {
    renderDialog(QUIZ_ACTIVITY);

    expect(
      screen.queryByLabelText(i18n.t("activityUrlLabel"))
    ).not.toBeInTheDocument();
  });

  it("renders the URL field as an input of type url, for basic format validation", () => {
    renderDialog(LINK_ACTIVITY);

    expect(screen.getByLabelText(i18n.t("activityUrlLabel"))).toHaveAttribute(
      "type",
      "url"
    );
  });

  it("submits the typed url when creating a Link activity", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(null);

    await user.type(
      screen.getByLabelText(i18n.t("activityTitleLabel")),
      "Aula 1"
    );
    await user.type(
      screen.getByLabelText(i18n.t("activityUrlLabel")),
      "https://example.com/aula-1"
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSubmit).toHaveBeenCalledWith(
      "Aula 1",
      "link",
      "https://example.com/aula-1"
    );
  });

  it("submits a null url when submitting an activity whose type is not link", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(QUIZ_ACTIVITY);

    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSubmit).toHaveBeenCalledWith(QUIZ_ACTIVITY.title, "quiz", null);
  });
});
