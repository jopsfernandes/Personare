import { useCallback, useEffect, useId, useState } from "react";
import { selectBackupImportFile } from "@/actions/dialog";
import { getSettings, setAutoStart } from "@/actions/settings";

export function useSettingsState() {
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

  return {
    autoStartEnabled,
    autoStartId,
    handleAutoStartChange,
    handleDriveBackupClick,
    handleDriveRestoreClick,
    handleExportClick,
    handleImportClick,
    importFilePath,
    isDriveBackupDialogOpen,
    isDriveConnected,
    isDriveRestoreDialogOpen,
    isExportDialogOpen,
    isImportDialogOpen,
    setIsDriveBackupDialogOpen,
    setIsDriveConnected,
    setIsDriveRestoreDialogOpen,
    setIsExportDialogOpen,
    setIsImportDialogOpen,
  };
}
