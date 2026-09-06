import { useTranslation } from "react-i18next";
import type { Activity } from "@/components/activities-data-table";
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

interface DeleteActivityDialogProps {
  activity: Activity | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function DeleteActivityDialog({
  activity,
  onConfirm,
  onOpenChange,
  open,
}: DeleteActivityDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteActivityConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteActivityConfirmDescription", {
              title: activity?.title ?? "",
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
