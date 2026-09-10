import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportBackup } from "@/actions/backup";
import { selectBackupExportPath } from "@/actions/dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BackupExportDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function BackupExportDialog({
  onOpenChange,
  open,
}: BackupExportDialogProps) {
  const { t } = useTranslation();
  const passphraseId = useId();
  const confirmPassphraseId = useId();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPassphrase("");
      setConfirmPassphrase("");
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handlePassphraseChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPassphrase(event.target.value);
    },
    []
  );

  const handleConfirmPassphraseChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmPassphrase(event.target.value);
    },
    []
  );

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const canSubmit =
    passphrase.length > 0 && passphrase === confirmPassphrase && !isSubmitting;

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!canSubmit) {
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const filePath = await selectBackupExportPath();

        if (!filePath) {
          return;
        }

        await exportBackup(filePath, passphrase);
        onOpenChange(false);
      } catch {
        setErrorMessage(t("backupExportErrorMessage"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [canSubmit, passphrase, onOpenChange, t]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("exportBackupAction")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor={passphraseId}>{t("backupPassphraseLabel")}</Label>
              <Input
                id={passphraseId}
                onChange={handlePassphraseChange}
                type="password"
                value={passphrase}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={confirmPassphraseId}>
                {t("backupConfirmPassphraseLabel")}
              </Label>
              <Input
                id={confirmPassphraseId}
                onChange={handleConfirmPassphraseChange}
                type="password"
                value={confirmPassphrase}
              />
            </div>
            {errorMessage ? (
              <p className="text-destructive text-sm">{errorMessage}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={handleCancelClick} type="button" variant="outline">
              {t("cancelAction")}
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {t("exportBackupAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
