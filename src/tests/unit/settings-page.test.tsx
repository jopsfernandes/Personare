import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (Issue #21, Spec Driven TDD): src/routes/settings.tsx does not
 * yet render a "Backup local" section, nor the export/import dialogs. Every
 * test below is expected to fail until the Developer implements
 * docs/specs/issue-21-backup-local.md AC-6.
 */

vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn(),
  setAutoStart: vi.fn(),
}));

vi.mock("@/actions/dialog", () => ({
  selectBackupExportPath: vi.fn(),
  selectBackupImportFile: vi.fn(),
  selectPdfFile: vi.fn(),
}));

vi.mock("@/actions/backup", () => ({
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
}));

const { getSettings } = await import("@/actions/settings");
const { selectBackupExportPath, selectBackupImportFile } = await import(
  "@/actions/dialog"
);
const { exportBackup, importBackup } = await import("@/actions/backup");
const { SettingsPage } = await import("@/routes/settings");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettings).mockResolvedValue({ autoStartEnabled: false });
});

describe("SettingsPage backup section (Issue #21)", () => {
  it("renders export and import backup actions", async () => {
    render(<SettingsPage />);

    expect(
      await screen.findByRole("button", { name: i18n.t("exportBackupAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("importBackupAction") })
    ).toBeInTheDocument();
  });

  describe("export", () => {
    it("disables the confirm button until both passphrase fields match and are non-empty", async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("exportBackupAction"),
        })
      );
      const confirmButton = screen.getByRole("button", {
        hidden: false,
        name: i18n.t("exportBackupAction"),
      });
      expect(confirmButton).toBeDisabled();

      await user.type(
        screen.getByLabelText(i18n.t("backupPassphraseLabel")),
        "senha-forte"
      );
      expect(confirmButton).toBeDisabled();

      await user.type(
        screen.getByLabelText(i18n.t("backupConfirmPassphraseLabel")),
        "senha-diferente"
      );
      expect(confirmButton).toBeDisabled();

      await user.clear(
        screen.getByLabelText(i18n.t("backupConfirmPassphraseLabel"))
      );
      await user.type(
        screen.getByLabelText(i18n.t("backupConfirmPassphraseLabel")),
        "senha-forte"
      );
      expect(confirmButton).not.toBeDisabled();
    });

    it("picks a save location and exports with the typed passphrase when confirmed", async () => {
      vi.mocked(selectBackupExportPath).mockResolvedValue(
        "C:\\backup.personare-backup"
      );
      vi.mocked(exportBackup).mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("exportBackupAction"),
        })
      );
      await user.type(
        screen.getByLabelText(i18n.t("backupPassphraseLabel")),
        "senha-forte"
      );
      await user.type(
        screen.getByLabelText(i18n.t("backupConfirmPassphraseLabel")),
        "senha-forte"
      );
      await user.click(
        screen.getByRole("button", { name: i18n.t("exportBackupAction") })
      );

      await waitFor(() => {
        expect(exportBackup).toHaveBeenCalledWith(
          "C:\\backup.personare-backup",
          "senha-forte"
        );
      });
    });

    it("does not export when the save dialog is canceled", async () => {
      vi.mocked(selectBackupExportPath).mockResolvedValue(null);
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("exportBackupAction"),
        })
      );
      await user.type(
        screen.getByLabelText(i18n.t("backupPassphraseLabel")),
        "senha-forte"
      );
      await user.type(
        screen.getByLabelText(i18n.t("backupConfirmPassphraseLabel")),
        "senha-forte"
      );
      await user.click(
        screen.getByRole("button", { name: i18n.t("exportBackupAction") })
      );

      await waitFor(() => {
        expect(selectBackupExportPath).toHaveBeenCalled();
      });
      expect(exportBackup).not.toHaveBeenCalled();
    });

    it("shows an error message when exportBackup rejects", async () => {
      vi.mocked(selectBackupExportPath).mockResolvedValue(
        "C:\\backup.personare-backup"
      );
      vi.mocked(exportBackup).mockRejectedValue(new Error("disk full"));
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("exportBackupAction"),
        })
      );
      await user.type(
        screen.getByLabelText(i18n.t("backupPassphraseLabel")),
        "senha-forte"
      );
      await user.type(
        screen.getByLabelText(i18n.t("backupConfirmPassphraseLabel")),
        "senha-forte"
      );
      await user.click(
        screen.getByRole("button", { name: i18n.t("exportBackupAction") })
      );

      expect(
        await screen.findByText(i18n.t("backupExportErrorMessage"))
      ).toBeInTheDocument();
    });
  });

  describe("import", () => {
    it("picks a file first, then opens the destructive-confirmation dialog with a warning", async () => {
      vi.mocked(selectBackupImportFile).mockResolvedValue(
        "C:\\backup.personare-backup"
      );
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("importBackupAction"),
        })
      );

      expect(
        await screen.findByText(i18n.t("backupImportWarningMessage"))
      ).toBeInTheDocument();
    });

    it("does not open the confirmation dialog when the file picker is canceled", async () => {
      vi.mocked(selectBackupImportFile).mockResolvedValue(null);
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("importBackupAction"),
        })
      );

      await waitFor(() => {
        expect(selectBackupImportFile).toHaveBeenCalled();
      });
      expect(
        screen.queryByText(i18n.t("backupImportWarningMessage"))
      ).not.toBeInTheDocument();
    });

    it("disables the destructive confirm button until a passphrase is typed", async () => {
      vi.mocked(selectBackupImportFile).mockResolvedValue(
        "C:\\backup.personare-backup"
      );
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("importBackupAction"),
        })
      );
      await screen.findByText(i18n.t("backupImportWarningMessage"));

      const confirmButton = screen.getByRole("button", {
        name: i18n.t("backupImportConfirmAction"),
      });
      expect(confirmButton).toBeDisabled();

      await user.type(
        screen.getByLabelText(i18n.t("backupPassphraseLabel")),
        "senha-forte"
      );
      expect(confirmButton).not.toBeDisabled();
    });

    it("imports with the selected file path and typed passphrase when confirmed", async () => {
      vi.mocked(selectBackupImportFile).mockResolvedValue(
        "C:\\backup.personare-backup"
      );
      vi.mocked(importBackup).mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("importBackupAction"),
        })
      );
      await screen.findByText(i18n.t("backupImportWarningMessage"));
      await user.type(
        screen.getByLabelText(i18n.t("backupPassphraseLabel")),
        "senha-forte"
      );
      await user.click(
        screen.getByRole("button", {
          name: i18n.t("backupImportConfirmAction"),
        })
      );

      await waitFor(() => {
        expect(importBackup).toHaveBeenCalledWith(
          "C:\\backup.personare-backup",
          "senha-forte"
        );
      });
    });

    it("shows an error message and keeps the dialog open when importBackup rejects", async () => {
      vi.mocked(selectBackupImportFile).mockResolvedValue(
        "C:\\backup.personare-backup"
      );
      vi.mocked(importBackup).mockRejectedValue(new Error("bad passphrase"));
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("importBackupAction"),
        })
      );
      await screen.findByText(i18n.t("backupImportWarningMessage"));
      await user.type(
        screen.getByLabelText(i18n.t("backupPassphraseLabel")),
        "senha-forte"
      );
      await user.click(
        screen.getByRole("button", {
          name: i18n.t("backupImportConfirmAction"),
        })
      );

      expect(
        await screen.findByText(i18n.t("backupImportErrorMessage"))
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18n.t("backupImportWarningMessage"))
      ).toBeInTheDocument();
    });
  });
});
