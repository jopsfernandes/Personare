import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectBackupImportFile } from "@/actions/dialog";
import { getDriveConnectionStatus } from "@/actions/drive-backup";
import { getSettings, setAutoStart } from "@/actions/settings";
import AccountSection from "@/components/account-section";
import BackupExportDialog from "@/components/backup-export-dialog";
import BackupImportDialog from "@/components/backup-import-dialog";
import DriveBackupDialog from "@/components/drive-backup-dialog";
import DriveRestoreDialog from "@/components/drive-restore-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsPage() {
  const { t } = useTranslation();
  const autoStartId = useId();
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFilePath, setImportFilePath] = useState<string | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isDriveBackupDialogOpen, setIsDriveBackupDialogOpen] = useState(false);
  const [isDriveRestoreDialogOpen, setIsDriveRestoreDialogOpen] =
    useState(false);

  useEffect(() => {
    getSettings().then((settings) => {
      setAutoStartEnabled(settings.autoStartEnabled);
    });
    getDriveConnectionStatus().then(setIsDriveConnected);
  }, []);

  const handleAutoStartChange = useCallback((checked: boolean) => {
    setAutoStartEnabled(checked);
    setAutoStart(checked);
  }, []);

  const handleExportClick = useCallback(() => {
    setIsExportDialogOpen(true);
  }, []);

  const handleImportClick = useCallback(() => {
    selectBackupImportFile().then((filePath) => {
      if (!filePath) {
        return;
      }

      setImportFilePath(filePath);
      setIsImportDialogOpen(true);
    });
  }, []);

  const handleDriveBackupClick = useCallback(() => {
    setIsDriveBackupDialogOpen(true);
  }, []);

  const handleDriveRestoreClick = useCallback(() => {
    setIsDriveRestoreDialogOpen(true);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <h1 className="font-bold text-2xl">{t("settingsPageTitle")}</h1>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={autoStartEnabled}
            id={autoStartId}
            onCheckedChange={handleAutoStartChange}
          />
          <Label htmlFor={autoStartId}>{t("autoStartToggleLabel")}</Label>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("autoStartDescription")}
        </p>
      </div>
      <AccountSection />
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">{t("backupSectionTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("backupSectionDescription")}
        </p>
        <div className="flex gap-2">
          <Button onClick={handleExportClick} variant="outline">
            {t("exportBackupAction")}
          </Button>
          <Button onClick={handleImportClick} variant="outline">
            {t("importBackupAction")}
          </Button>
        </div>
      </div>
      {isDriveConnected ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">
            {t("driveBackupSectionTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("driveBackupSectionDescription")}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleDriveBackupClick} variant="outline">
              {t("backupToDriveAction")}
            </Button>
            <Button onClick={handleDriveRestoreClick} variant="outline">
              {t("restoreFromDriveAction")}
            </Button>
          </div>
        </div>
      ) : null}
      <BackupExportDialog
        onOpenChange={setIsExportDialogOpen}
        open={isExportDialogOpen}
      />
      <BackupImportDialog
        filePath={importFilePath}
        onOpenChange={setIsImportDialogOpen}
        open={isImportDialogOpen}
      />
      <DriveBackupDialog
        onOpenChange={setIsDriveBackupDialogOpen}
        open={isDriveBackupDialogOpen}
      />
      <DriveRestoreDialog
        onOpenChange={setIsDriveRestoreDialogOpen}
        open={isDriveRestoreDialogOpen}
      />
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
