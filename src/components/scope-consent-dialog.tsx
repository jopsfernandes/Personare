import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScopeConsentDialogProps {
  descriptionKey: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  titleKey: string;
}

/**
 * Google's own consent screen (Issue #24) is outside our control and not in
 * the app's own language -- LGPD requires the controller (Personare) to
 * explain, in its own words, what a requested scope is for, with an
 * explicit confirm action, before redirecting. Generic on purpose: the
 * Calendar connect flow (Issue #26) is the first user, Drive backup
 * (Issue #27) reuses it with a different descriptionKey once it exists.
 */
export default function ScopeConsentDialog({
  descriptionKey,
  onCancel,
  onConfirm,
  open,
  titleKey,
}: ScopeConsentDialogProps) {
  const { t } = useTranslation();

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{t(descriptionKey)}</p>
        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            {t("cancelAction")}
          </Button>
          <Button onClick={onConfirm} type="button">
            {t("continueAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
