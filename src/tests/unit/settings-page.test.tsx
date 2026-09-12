import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (Issue #21, Spec Driven TDD): src/routes/settings.tsx does not
 * yet render a "Backup local" section, nor the export/import dialogs. Every
 * test below is expected to fail until the Developer implements
 * docs/specs/issue-21-backup-local.md AC-6.
 *
 * RED phase (Issue #25, Spec Driven TDD): the "Conta" section (Google
 * login/logout) does not exist yet either -- see
 * docs/specs/issue-25-oauth-login-electron.md.
 */

vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn(),
  setAutoStart: vi.fn(),
}));

vi.mock("@/actions/dialog", () => ({
  selectAccountExportPath: vi.fn(),
  selectBackupExportPath: vi.fn(),
  selectBackupImportFile: vi.fn(),
  selectPdfFile: vi.fn(),
}));

vi.mock("@/actions/backup", () => ({
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({
  deleteAccount: vi.fn(),
  exportAccountData: vi.fn(),
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/actions/calendar-sync", () => ({
  connectCalendar: vi.fn(),
  getCalendarConnectionStatus: vi.fn(),
  syncCalendar: vi.fn(),
}));

const { getSettings } = await import("@/actions/settings");
const {
  selectAccountExportPath,
  selectBackupExportPath,
  selectBackupImportFile,
} = await import("@/actions/dialog");
const { exportBackup, importBackup } = await import("@/actions/backup");
const { deleteAccount, exportAccountData, getSession, login, logout } =
  await import("@/actions/auth");
const { connectCalendar, getCalendarConnectionStatus } = await import(
  "@/actions/calendar-sync"
);
const { SettingsPage } = await import("@/routes/settings");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettings).mockResolvedValue({ autoStartEnabled: false });
  vi.mocked(getCalendarConnectionStatus).mockResolvedValue(false);
  vi.mocked(getSession).mockResolvedValue(null);
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

describe("SettingsPage account section (Issue #25)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a login action when no one is logged in", async () => {
    render(<SettingsPage />);

    expect(
      await screen.findByRole("button", {
        name: i18n.t("loginWithGoogleAction"),
      })
    ).toBeInTheDocument();
  });

  it("shows the logged-in user's profile and a logout action when a session exists", async () => {
    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });

    render(<SettingsPage />);

    expect(await screen.findByText("Aluno")).toBeInTheDocument();
    expect(screen.getByText("aluno@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("logoutAction") })
    ).toBeInTheDocument();
  });

  it("calls login() and then polls getSession() until a session appears", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    vi.mocked(getSession).mockResolvedValueOnce(null);
    vi.mocked(login).mockResolvedValue(undefined);
    render(<SettingsPage />);

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("loginWithGoogleAction"),
      })
    );

    expect(login).toHaveBeenCalledTimes(1);

    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(await screen.findByText("Aluno")).toBeInTheDocument();
  });

  it("calls logout() and returns to the logged-out state", async () => {
    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });
    vi.mocked(logout).mockResolvedValue(undefined);
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    render(<SettingsPage />);
    await screen.findByText("Aluno");

    await user.click(
      screen.getByRole("button", { name: i18n.t("logoutAction") })
    );

    expect(logout).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", {
        name: i18n.t("loginWithGoogleAction"),
      })
    ).toBeInTheDocument();
  });

  it("shows a connect-calendar action when logged in but not connected", async () => {
    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });

    render(<SettingsPage />);

    expect(
      await screen.findByRole("button", {
        name: i18n.t("connectGoogleCalendarAction"),
      })
    ).toBeInTheDocument();
  });

  it("shows the connected label instead of the action once the calendar is connected", async () => {
    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);

    render(<SettingsPage />);

    expect(
      await screen.findByText(i18n.t("calendarConnectedLabel"))
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: i18n.t("connectGoogleCalendarAction"),
      })
    ).not.toBeInTheDocument();
  });

  it("shows an explicit consent dialog before connecting, without calling connectCalendar() yet", async () => {
    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("connectGoogleCalendarAction"),
      })
    );

    expect(
      await screen.findByText(i18n.t("calendarScopeConsentDescription"))
    ).toBeInTheDocument();
    expect(connectCalendar).not.toHaveBeenCalled();
  });

  it("does not call connectCalendar() when the consent dialog is canceled", async () => {
    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("connectGoogleCalendarAction"),
      })
    );
    await screen.findByText(i18n.t("calendarScopeConsentDescription"));

    await user.click(
      screen.getByRole("button", { name: i18n.t("cancelAction") })
    );

    expect(connectCalendar).not.toHaveBeenCalled();
    expect(
      screen.queryByText(i18n.t("calendarScopeConsentDescription"))
    ).not.toBeInTheDocument();
  });

  it("calls connectCalendar() only after confirming the consent dialog, then polls the connection status until connected", async () => {
    vi.mocked(getSession).mockResolvedValue({
      avatarUrl: null,
      email: "aluno@example.com",
      id: "user-1",
      name: "Aluno",
    });
    vi.mocked(connectCalendar).mockResolvedValue(undefined);
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    render(<SettingsPage />);
    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("connectGoogleCalendarAction"),
      })
    );
    await screen.findByText(i18n.t("calendarScopeConsentDescription"));

    await user.click(
      screen.getByRole("button", { name: i18n.t("continueAction") })
    );

    expect(connectCalendar).toHaveBeenCalledTimes(1);

    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(
      await screen.findByText(i18n.t("calendarConnectedLabel"))
    ).toBeInTheDocument();
  });

  describe("account data export (Issue #28)", () => {
    beforeEach(() => {
      vi.mocked(getSession).mockResolvedValue({
        avatarUrl: null,
        email: "aluno@example.com",
        id: "user-1",
        name: "Aluno",
      });
    });

    it("picks a save location and exports when confirmed", async () => {
      vi.mocked(selectAccountExportPath).mockResolvedValue("C:\\account.json");
      vi.mocked(exportAccountData).mockResolvedValue(true);
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("exportAccountDataAction"),
        })
      );

      await waitFor(() => {
        expect(exportAccountData).toHaveBeenCalledWith("C:\\account.json");
      });
      expect(
        await screen.findByText(i18n.t("accountExportSuccessMessage"))
      ).toBeInTheDocument();
    });

    it("does not export when the save dialog is canceled", async () => {
      vi.mocked(selectAccountExportPath).mockResolvedValue(null);
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("exportAccountDataAction"),
        })
      );

      await waitFor(() => {
        expect(selectAccountExportPath).toHaveBeenCalled();
      });
      expect(exportAccountData).not.toHaveBeenCalled();
    });

    it("shows an error message when the export fails", async () => {
      vi.mocked(selectAccountExportPath).mockResolvedValue("C:\\account.json");
      vi.mocked(exportAccountData).mockResolvedValue(false);
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("exportAccountDataAction"),
        })
      );

      expect(
        await screen.findByText(i18n.t("accountExportErrorMessage"))
      ).toBeInTheDocument();
    });
  });

  describe("account deletion (Issue #28)", () => {
    beforeEach(() => {
      vi.mocked(getSession).mockResolvedValue({
        avatarUrl: null,
        email: "aluno@example.com",
        id: "user-1",
        name: "Aluno",
      });
    });

    it("shows a destructive warning before deleting, without calling deleteAccount() yet", async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("deleteAccountAction"),
        })
      );

      expect(
        await screen.findByText(i18n.t("deleteAccountWarningMessage"))
      ).toBeInTheDocument();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("does not call deleteAccount() when canceled", async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("deleteAccountAction"),
        })
      );
      await screen.findByText(i18n.t("deleteAccountWarningMessage"));

      await user.click(
        screen.getByRole("button", { name: i18n.t("cancelAction") })
      );

      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("calls deleteAccount() and returns to the logged-out state on success", async () => {
      vi.mocked(deleteAccount).mockResolvedValue(true);
      const user = userEvent.setup();
      render(<SettingsPage />);
      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("deleteAccountAction"),
        })
      );
      await screen.findByText(i18n.t("deleteAccountWarningMessage"));

      await user.click(
        screen.getByRole("button", {
          name: i18n.t("deleteAccountConfirmAction"),
        })
      );

      expect(deleteAccount).toHaveBeenCalledTimes(1);
      expect(
        await screen.findByRole("button", {
          name: i18n.t("loginWithGoogleAction"),
        })
      ).toBeInTheDocument();
    });

    it("shows an error message and keeps the dialog open when deletion fails", async () => {
      vi.mocked(deleteAccount).mockResolvedValue(false);
      const user = userEvent.setup();
      render(<SettingsPage />);
      await user.click(
        await screen.findByRole("button", {
          name: i18n.t("deleteAccountAction"),
        })
      );
      await screen.findByText(i18n.t("deleteAccountWarningMessage"));

      await user.click(
        screen.getByRole("button", {
          name: i18n.t("deleteAccountConfirmAction"),
        })
      );

      expect(
        await screen.findByText(i18n.t("accountDeletionErrorMessage"))
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18n.t("deleteAccountWarningMessage"))
      ).toBeInTheDocument();
    });
  });
});
