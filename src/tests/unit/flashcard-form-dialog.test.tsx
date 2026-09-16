import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import FlashcardFormDialog, {
  type FlashcardFormValue,
} from "@/components/flashcard-form-dialog";
import "@/localization/i18n";

vi.mock("@/actions/dialog", () => ({
  selectImageFile: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  saveAttachmentImage: vi.fn(),
}));

/**
 * RED phase (Issue #15, then extended by Issue #96, Spec Driven TDD).
 * FlashcardFormDialog's front/back fields moved from single-line <Input> to
 * MarkdownEditor (Markdown + LaTeX), each paired with an ImageAttachmentField
 * (docs/specs/issue-96-markdown-latex-imagens.md AC-4). onSubmit's signature
 * changed from positional (front, back) to a single values object carrying
 * the image paths too, since a 4-argument positional call would be
 * unreadable at call sites.
 */

const EXISTING_FLASHCARD: FlashcardFormValue = {
  back: "Capital do Brasil",
  backImagePath: "back123.png",
  front: "Brasilia",
  frontImagePath: null,
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

  it("calls onSubmit with the front/back text and null image paths for a new flashcard", async () => {
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
    expect(onSubmit).toHaveBeenCalledWith({
      back: "Verso novo",
      backImagePath: null,
      front: "Frente nova",
      frontImagePath: null,
    });
  });

  it("submits successfully when editing an existing flashcard without changes, keeping its image paths", async () => {
    const { onSubmit } = renderDialog(EXISTING_FLASHCARD);

    await clickSave();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      back: EXISTING_FLASHCARD.back,
      backImagePath: EXISTING_FLASHCARD.backImagePath,
      front: EXISTING_FLASHCARD.front,
      frontImagePath: EXISTING_FLASHCARD.frontImagePath,
    });
  });

  it("renders an image attachment control for both the front and the back", () => {
    renderDialog(EXISTING_FLASHCARD);

    expect(
      screen.getAllByRole("button", { name: i18n.t("attachImageAction") })
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: i18n.t("removeImageAction") })
    ).toHaveLength(1);
  });
});
