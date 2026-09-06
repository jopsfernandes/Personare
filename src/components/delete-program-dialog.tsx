import { useTranslation } from "react-i18next";
import type { Program } from "@/components/programs-data-table";
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

interface DeleteProgramDialogProps {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  program: Program | null;
}

export default function DeleteProgramDialog({
  onConfirm,
  onOpenChange,
  open,
  program,
}: DeleteProgramDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteProgramConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteProgramConfirmDescription", {
              name: program?.name ?? "",
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
