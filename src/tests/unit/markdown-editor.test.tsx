import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import MarkdownEditor from "@/components/markdown-editor";
import "@/localization/i18n";

/**
 * RED phase (Issue #96, Spec Driven TDD): src/components/markdown-editor
 * does not exist yet, per docs/specs/issue-96-markdown-latex-imagens.md
 * AC-1. Replaces the single-line <Input> used for flashcard/quiz content
 * with a Write/Preview tab pair: a Textarea for Markdown source, and a
 * live MarkdownContent preview of the same value.
 */
describe("MarkdownEditor (Issue #96)", () => {
  it("shows the current value in the Textarea on the write tab", () => {
    render(
      <MarkdownEditor
        id="front"
        label="Front"
        onChange={vi.fn()}
        value="Hello world"
      />
    );

    expect(screen.getByLabelText("Front")).toHaveValue("Hello world");
  });

  it("calls onChange with the new text as the user types", async () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditor id="front" label="Front" onChange={onChange} value="" />
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Front"), "a");

    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("renders the current value as Markdown/LaTeX on the preview tab", async () => {
    render(
      <MarkdownEditor
        id="front"
        label="Front"
        onChange={vi.fn()}
        value="$E=mc^2$"
      />
    );
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("tab", { name: i18n.t("markdownPreviewTabLabel") })
    );

    expect(document.querySelector(".katex")).not.toBeNull();
  });

  it("marks the input as required when requested", () => {
    render(
      <MarkdownEditor
        id="front"
        label="Front"
        onChange={vi.fn()}
        required
        value=""
      />
    );

    expect(screen.getByLabelText("Front")).toBeRequired();
  });
});
