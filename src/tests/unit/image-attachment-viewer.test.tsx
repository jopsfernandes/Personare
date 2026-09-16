import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAttachmentImageDataUrl } from "@/actions/attachments";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import "@/localization/i18n";

vi.mock("@/actions/attachments", () => ({
  getAttachmentImageDataUrl: vi.fn(),
}));

/**
 * RED phase (Issue #96, Spec Driven TDD): src/components/image-attachment-viewer
 * does not exist yet, per docs/specs/issue-96-markdown-latex-imagens.md AC-3.
 * Used everywhere content is displayed read-only (flashcard/quiz manager
 * lists, quiz runner, review session): renders nothing when there is no
 * attached image, otherwise a "view image" button that lazily fetches the
 * data URL and opens it in a dialog -- the image is never shown inline, so
 * it can never break the surrounding layout.
 */
describe("ImageAttachmentViewer (Issue #96)", () => {
  beforeEach(() => {
    vi.mocked(getAttachmentImageDataUrl).mockReset();
  });

  it("renders nothing when there is no attached image", () => {
    const { container } = render(<ImageAttachmentViewer fileName={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a view-image button when there is an attached image", () => {
    render(<ImageAttachmentViewer fileName="abc123.png" />);

    expect(
      screen.getByRole("button", { name: i18n.t("viewImageAction") })
    ).toBeInTheDocument();
  });

  it("does not fetch the image data until the button is clicked", () => {
    render(<ImageAttachmentViewer fileName="abc123.png" />);

    expect(getAttachmentImageDataUrl).not.toHaveBeenCalled();
  });

  it("fetches and displays the image inside a dialog when clicked", async () => {
    vi.mocked(getAttachmentImageDataUrl).mockResolvedValueOnce(
      "data:image/png;base64,AAAA"
    );
    render(<ImageAttachmentViewer fileName="abc123.png" />);

    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("viewImageAction") })
    );

    expect(getAttachmentImageDataUrl).toHaveBeenCalledWith("abc123.png");
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,AAAA"
    );
  });
});
