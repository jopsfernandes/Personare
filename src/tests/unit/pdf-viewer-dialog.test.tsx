import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import type { Activity } from "@/components/activities-data-table";
import PdfViewerDialog from "@/components/pdf-viewer-dialog";
import "@/localization/i18n";

/**
 * RED phase (Issue #13, Spec Driven TDD): src/components/pdf-viewer-dialog
 * does not exist yet. Every test below is expected to fail until
 * Serralheria (Developer) implements it (criterio de aceite 3).
 *
 * Contract exercised here:
 * - when `open` and `activity` are set, an embedded frame (an <embed> or
 *   <iframe>, per the spec note -- queried here only by its accessible
 *   "title" attribute so either implementation choice passes) points at the
 *   activity's local file through a "file://" URL.
 * - the frame's accessible title comes from the "pdfViewerFrameTitle"
 *   i18n key (criterio de aceite 4: no hardcoded UI text).
 * - the dialog is not shown, and no frame is rendered, when there is no
 *   activity to view.
 */

const FILE_URL_SCHEME_PATTERN = /^file:\/\//;

const PDF_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-03"),
  filePath: "/Users/aluno/Documents/apostila.pdf",
  id: "33333333-3333-3333-3333-333333333333",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Apostila em PDF",
  type: "pdf",
  updatedAt: new Date("2026-01-03"),
  url: null,
};

describe("PdfViewerDialog", () => {
  it("renders a frame pointing at the activity's local file through a file:// URL", () => {
    render(
      <PdfViewerDialog activity={PDF_ACTIVITY} onOpenChange={vi.fn()} open />
    );

    const frame = screen.getByTitle(i18n.t("pdfViewerFrameTitle"));

    expect(frame.getAttribute("src")).toMatch(FILE_URL_SCHEME_PATTERN);
    expect(frame.getAttribute("src")).toContain(PDF_ACTIVITY.filePath);
  });

  it("renders the activity's title", () => {
    render(
      <PdfViewerDialog activity={PDF_ACTIVITY} onOpenChange={vi.fn()} open />
    );

    expect(screen.getByText(PDF_ACTIVITY.title)).toBeInTheDocument();
  });

  it("does not render the frame when there is no activity to view", () => {
    render(
      <PdfViewerDialog activity={null} onOpenChange={vi.fn()} open={false} />
    );

    expect(
      screen.queryByTitle(i18n.t("pdfViewerFrameTitle"))
    ).not.toBeInTheDocument();
  });
});
