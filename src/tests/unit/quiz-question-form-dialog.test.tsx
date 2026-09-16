import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import QuizQuestionFormDialog, {
  type QuizQuestionFormValue,
} from "@/components/quiz-question-form-dialog";
import "@/localization/i18n";

vi.mock("@/actions/dialog", () => ({
  selectImageFile: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  saveAttachmentImage: vi.fn(),
}));

/**
 * RED phase (Issue #14, then extended by Issue #96, Spec Driven TDD).
 * QuizQuestionFormDialog manages ONE question and its alternatives at a
 * time. It must enforce -- in the form itself, before calling onSubmit --
 * at least 2 alternatives with non-empty text and exactly 1 of them marked
 * as correct. Marking "the correct" alternative uses role="radio" controls.
 *
 * Issue #96 (docs/specs/issue-96-markdown-latex-imagens.md AC-5) moves the
 * question text and each option's text from a single-line <Input> to a
 * MarkdownEditor (Markdown + LaTeX), and adds an optional image to the
 * question and to each option via ImageAttachmentField. onSubmit gains a
 * middle `imagePath` argument (the question's own image) between `text` and
 * `options`, and each submitted option now also carries its own
 * `imagePath`.
 */

const EXISTING_QUESTION: QuizQuestionFormValue = {
  id: "11111111-1111-1111-1111-111111111111",
  imagePath: null,
  options: [
    {
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      imagePath: null,
      isCorrect: false,
      text: "Sao Paulo",
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000002",
      imagePath: "capital.png",
      isCorrect: true,
      text: "Brasilia",
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000003",
      imagePath: null,
      isCorrect: false,
      text: "Rio de Janeiro",
    },
  ],
  text: "Qual e a capital do Brasil?",
};

function renderDialog(question: QuizQuestionFormValue | null = null) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <QuizQuestionFormDialog
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={true}
      question={question}
    />
  );

  return { onOpenChange, onSubmit };
}

function optionTextInputs() {
  return screen.getAllByLabelText(i18n.t("quizOptionTextLabel"));
}

function correctOptionRadios() {
  return screen.getAllByRole("radio");
}

function clickSave() {
  return userEvent
    .setup()
    .click(screen.getByRole("button", { name: i18n.t("saveAction") }));
}

describe("QuizQuestionFormDialog (Issue #14)", () => {
  it("renders a question text input", () => {
    renderDialog(null);

    expect(
      screen.getByLabelText(i18n.t("quizQuestionTextLabel"))
    ).toBeInTheDocument();
  });

  it("starts a new question with at least 2 empty option rows", () => {
    renderDialog(null);

    const inputs = optionTextInputs();
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    for (const input of inputs) {
      expect(input).toHaveValue("");
    }
  });

  it("pre-fills the question text and options when editing an existing question", () => {
    renderDialog(EXISTING_QUESTION);

    expect(screen.getByLabelText(i18n.t("quizQuestionTextLabel"))).toHaveValue(
      EXISTING_QUESTION.text
    );

    const inputs = optionTextInputs();
    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual(
      EXISTING_QUESTION.options.map((option) => option.text)
    );
  });

  it("checks the radio of the option that is currently marked as correct", () => {
    renderDialog(EXISTING_QUESTION);

    const radios = correctOptionRadios();
    const checkedIndex = radios.findIndex(
      (radio) => (radio as HTMLInputElement).checked
    );

    expect(checkedIndex).toBe(1);
  });

  it("adds a new empty option row when the add-option action is clicked", async () => {
    const user = userEvent.setup();
    renderDialog(null);
    const initialCount = optionTextInputs().length;

    await user.click(
      screen.getByRole("button", { name: i18n.t("addQuizOptionAction") })
    );

    expect(optionTextInputs().length).toBe(initialCount + 1);
  });

  it("removes an option row when its remove action is clicked, while at least 2 remain", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_QUESTION);
    const initialCount = optionTextInputs().length;

    await user.click(
      screen.getAllByRole("button", {
        name: i18n.t("removeQuizOptionAction"),
      })[0]
    );

    expect(optionTextInputs().length).toBe(initialCount - 1);
  });

  it("does not allow removing an option below the 2-option minimum", () => {
    renderDialog(null);

    const removeButtons = screen.getAllByRole("button", {
      name: i18n.t("removeQuizOptionAction"),
    });

    for (const button of removeButtons) {
      expect(button).toBeDisabled();
    }
  });

  it("selecting a different option as correct unchecks the previously correct one", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_QUESTION);

    const radios = correctOptionRadios();
    await user.click(radios[0]);

    const radiosAfter = correctOptionRadios();
    expect((radiosAfter[0] as HTMLInputElement).checked).toBe(true);
    expect((radiosAfter[1] as HTMLInputElement).checked).toBe(false);
  });

  it("does not call onSubmit when fewer than 2 options have non-empty text", async () => {
    const { onSubmit } = renderDialog(null);
    const user = userEvent.setup();
    const inputs = optionTextInputs();

    await user.type(
      screen.getByLabelText(i18n.t("quizQuestionTextLabel")),
      "Pergunta valida"
    );
    await user.type(inputs[0], "Unica alternativa preenchida");
    await user.click(correctOptionRadios()[0]);
    await clickSave();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not call onSubmit when no option is marked as correct", async () => {
    const { onSubmit } = renderDialog(null);
    const user = userEvent.setup();
    const inputs = optionTextInputs();

    await user.type(
      screen.getByLabelText(i18n.t("quizQuestionTextLabel")),
      "Pergunta valida"
    );
    await user.type(inputs[0], "Primeira alternativa");
    await user.type(inputs[1], "Segunda alternativa");
    await clickSave();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the question text, null image path, and options once valid", async () => {
    const { onSubmit } = renderDialog(null);
    const user = userEvent.setup();
    const inputs = optionTextInputs();

    await user.type(
      screen.getByLabelText(i18n.t("quizQuestionTextLabel")),
      "Pergunta valida"
    );
    await user.type(inputs[0], "Primeira alternativa");
    await user.type(inputs[1], "Segunda alternativa");
    await user.click(correctOptionRadios()[1]);
    await clickSave();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [submittedText, submittedImagePath, submittedOptions] = onSubmit.mock
      .calls[0] as [
      string,
      string | null,
      { text: string; isCorrect: boolean; imagePath: string | null }[],
    ];

    expect(submittedText).toBe("Pergunta valida");
    expect(submittedImagePath).toBeNull();
    expect(submittedOptions).toHaveLength(2);
    expect(submittedOptions.filter((option) => option.isCorrect)).toHaveLength(
      1
    );
    expect(submittedOptions[1].isCorrect).toBe(true);
    expect(submittedOptions.map((option) => option.text)).toEqual([
      "Primeira alternativa",
      "Segunda alternativa",
    ]);
    expect(submittedOptions.map((option) => option.imagePath)).toEqual([
      null,
      null,
    ]);
  });

  it("submits successfully when editing an existing, already-valid question without changes, keeping image paths", async () => {
    const { onSubmit } = renderDialog(EXISTING_QUESTION);

    await clickSave();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, submittedImagePath, submittedOptions] = onSubmit.mock.calls[0] as [
      string,
      string | null,
      { text: string; isCorrect: boolean; imagePath: string | null }[],
    ];
    expect(submittedImagePath).toBe(EXISTING_QUESTION.imagePath);
    expect(submittedOptions.filter((option) => option.isCorrect)).toHaveLength(
      1
    );
    expect(submittedOptions.map((option) => option.imagePath)).toEqual(
      EXISTING_QUESTION.options.map((option) => option.imagePath)
    );
  });

  it("renders an image attachment control for the question and for each option", () => {
    renderDialog(EXISTING_QUESTION);

    // 1 for the question + 3 for the options = 4 total; only the option
    // with imagePath set ("Brasilia") already has one attached.
    expect(
      screen.getAllByRole("button", { name: i18n.t("attachImageAction") })
    ).toHaveLength(3);
    expect(
      screen.getAllByRole("button", { name: i18n.t("removeImageAction") })
    ).toHaveLength(1);
  });
});
