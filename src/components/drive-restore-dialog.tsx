import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { restoreFromDrive } from "@/actions/drive-backup";
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

interface DriveRestoreDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function describeRestoreError(error: string, t: (key: string) => string) {
  if (error === "no_backup_found") {
    return t("driveNoBackupFoundMessage");
  }
  if (error === "drive_not_connected") {
    return t("driveNotConnectedMessage");
  }
  return t("driveRestoreErrorMessage");
}

export default function DriveRestoreDialog({
  onOpenChange,
  open,
}: DriveRestoreDialogProps) {
  const { t } = useTranslation();
  const passphraseId = useId();
  const [passphrase, setPassphrase] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPassphrase("");
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

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const canSubmit = passphrase.length > 0 && !isSubmitting;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!canSubmit) {
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      restoreFromDrive(passphrase)
        .then((result) => {
          if (result && "error" in result) {
            setErrorMessage(describeRestoreError(result.error, t));
          }
        })
        .catch(() => {
          setErrorMessage(t("driveRestoreErrorMessage"));
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    },
    [canSubmit, passphrase, t]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("restoreFromDriveAction")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <p className="text-destructive text-sm">
              {t("backupImportWarningMessage")}
            </p>
            <div className="flex flex-col gap-1">
              <Label htmlFor={passphraseId}>{t("backupPassphraseLabel")}</Label>
              <Input
                id={passphraseId}
                onChange={handlePassphraseChange}
                type="password"
                value={passphrase}
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
            <Button disabled={!canSubmit} type="submit" variant="destructive">
              {t("backupImportConfirmAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
