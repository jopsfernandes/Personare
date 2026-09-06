import { useTranslation } from "react-i18next";
import type { Module } from "@/components/modules-data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteModuleDialogProps {
  module: Module | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function DeleteModuleDialog({
  module,
  onConfirm,
  onOpenChange,
  open,
}: DeleteModuleDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteModuleConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteModuleConfirmDescription", {
              name: module?.name ?? "",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancelAction")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("confirmDeleteAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
