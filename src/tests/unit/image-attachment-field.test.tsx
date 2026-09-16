import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAttachmentImage,
  saveAttachmentImage,
} from "@/actions/attachments";
import { selectImageFile } from "@/actions/dialog";
import ImageAttachmentField from "@/components/image-attachment-field";
import "@/localization/i18n";

vi.mock("@/actions/dialog", () => ({
  selectImageFile: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  saveAttachmentImage: vi.fn(),
}));

/**
 * RED phase (Issue #96, Spec Driven TDD): src/components/image-attachment-field
 * does not exist yet, per docs/specs/issue-96-markdown-latex-imagens.md AC-3.
 * Used inside edit forms (flashcard front/back, quiz question/option): picks
 * an image via the native dialog, copies it into userData/attachments via
 * saveAttachmentImage, and reports the resulting file name back through
 * onChange -- or removes a previously attached one via deleteAttachmentImage.
 */
describe("ImageAttachmentField (Issue #96)", () => {
  beforeEach(() => {
    vi.mocked(selectImageFile).mockReset();
    vi.mocked(saveAttachmentImage).mockReset();
    vi.mocked(deleteAttachmentImage).mockReset();
  });

  it("shows an attach button and no removal control when there is no image yet", () => {
    render(
      <ImageAttachmentField fileName={null} label="Front" onChange={vi.fn()} />
    );

    expect(
      screen.getByRole("button", { name: i18n.t("attachImageAction") })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("removeImageAction") })
    ).not.toBeInTheDocument();
  });

  it("shows the attached indicator and a removal button when there is an image", () => {
    render(
      <ImageAttachmentField
        fileName="abc123.png"
        label="Front"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText(i18n.t("imageAttachedLabel"))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("removeImageAction") })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("attachImageAction") })
    ).not.toBeInTheDocument();
  });

  it("saves the picked file and reports the new file name via onChange", async () => {
    vi.mocked(selectImageFile).mockResolvedValueOnce(
      "C:\\Users\\aluno\\Pictures\\diagrama.png"
    );
    vi.mocked(saveAttachmentImage).mockResolvedValueOnce({
      fileName: "generated123.png",
    });
    const onChange = vi.fn();
    render(
      <ImageAttachmentField fileName={null} label="Front" onChange={onChange} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("attachImageAction") })
    );

    expect(selectImageFile).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(saveAttachmentImage).toHaveBeenCalledWith(
        "C:\\Users\\aluno\\Pictures\\diagrama.png"
      );
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("generated123.png");
    });
  });

  it("does not save or call onChange when the file dialog is canceled", async () => {
    vi.mocked(selectImageFile).mockResolvedValueOnce(null);
    const onChange = vi.fn();
    render(
      <ImageAttachmentField fileName={null} label="Front" onChange={onChange} />
    );

    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("attachImageAction") })
    );

    expect(selectImageFile).toHaveBeenCalledTimes(1);
    expect(saveAttachmentImage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("deletes the attached image and reports null via onChange when removed", async () => {
    vi.mocked(deleteAttachmentImage).mockResolvedValueOnce(undefined);
    const onChange = vi.fn();
    render(
      <ImageAttachmentField
        fileName="abc123.png"
        label="Front"
        onChange={onChange}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("removeImageAction") })
    );

    expect(deleteAttachmentImage).toHaveBeenCalledWith("abc123.png");
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
