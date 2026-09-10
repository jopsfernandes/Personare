import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteAccount } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteAccountDialogProps {
  onDeleted: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function DeleteAccountDialog({
  onDeleted,
  onOpenChange,
  open,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirmClick = useCallback(() => {
    setIsSubmitting(true);
    setErrorMessage(null);

    deleteAccount()
      .then((deleted) => {
        if (deleted) {
          onDeleted();
        } else {
          setErrorMessage(t("accountDeletionErrorMessage"));
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [onDeleted, t]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteAccountAction")}</DialogTitle>
        </DialogHeader>
        <p className="text-destructive text-sm">
          {t("deleteAccountWarningMessage")}
        </p>
        {errorMessage ? (
          <p className="text-destructive text-sm">{errorMessage}</p>
        ) : null}
        <DialogFooter>
          <Button onClick={handleCancelClick} type="button" variant="outline">
            {t("cancelAction")}
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={handleConfirmClick}
            type="button"
            variant="destructive"
          >
            {t("deleteAccountConfirmAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
