import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import FlashcardFormDialog, {
  type FlashcardFormValue,
} from "@/components/flashcard-form-dialog";
import "@/localization/i18n";

/**
 * RED phase (Issue #15, Spec Driven TDD): src/components/flashcard-form-dialog.tsx
 * does not exist yet. Every test below is expected to fail until the
 * Developer implements the component, per
 * docs/specs/issue-15-flashcard-baralho.md AC-3.
 *
 * Contract exercised here: this dialog manages ONE flashcard (front/back)
 * at a time. Unlike QuizQuestionFormDialog, there is no multi-field
 * invariant to validate client-side (no "exactly one correct option"
 * equivalent) -- the spec is explicit that native HTML `required` on both
 * inputs is sufficient, so this suite asserts the `required` attribute
 * instead of exercising the browser's own constraint-validation submit
 * blocking.
 */

const EXISTING_FLASHCARD: FlashcardFormValue = {
  back: "Capital do Brasil",
  front: "Brasilia",
  id: "11111111-1111-1111-1111-111111111111",
};

function renderDialog(flashcard: FlashcardFormValue | null = null) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <FlashcardFormDialog
      flashcard={flashcard}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={true}
    />
  );

  return { onOpenChange, onSubmit };
}

function clickSave() {
  return userEvent
    .setup()
    .click(screen.getByRole("button", { name: i18n.t("saveAction") }));
}

describe("FlashcardFormDialog (Issue #15)", () => {
  it("renders empty front and back inputs for a new flashcard", () => {
    renderDialog(null);

    expect(screen.getByLabelText(i18n.t("flashcardFrontLabel"))).toHaveValue(
      ""
    );
    expect(screen.getByLabelText(i18n.t("flashcardBackLabel"))).toHaveValue("");
  });

  it("pre-fills front and back when editing an existing flashcard", () => {
    renderDialog(EXISTING_FLASHCARD);

    expect(screen.getByLabelText(i18n.t("flashcardFrontLabel"))).toHaveValue(
      EXISTING_FLASHCARD.front
    );
    expect(screen.getByLabelText(i18n.t("flashcardBackLabel"))).toHaveValue(
      EXISTING_FLASHCARD.back
    );
  });

  it("marks both the front and back inputs as required", () => {
    renderDialog(null);

    expect(screen.getByLabelText(i18n.t("flashcardFrontLabel"))).toBeRequired();
    expect(screen.getByLabelText(i18n.t("flashcardBackLabel"))).toBeRequired();
  });

  it("calls onSubmit with the front and back text once filled in", async () => {
    const { onSubmit } = renderDialog(null);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(i18n.t("flashcardFrontLabel")),
      "Frente nova"
    );
    await user.type(
      screen.getByLabelText(i18n.t("flashcardBackLabel")),
      "Verso novo"
    );
    await clickSave();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Frente nova", "Verso novo");
  });

  it("submits successfully when editing an existing flashcard without changes", async () => {
    const { onSubmit } = renderDialog(EXISTING_FLASHCARD);

    await clickSave();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      EXISTING_FLASHCARD.front,
      EXISTING_FLASHCARD.back
    );
  });
});
