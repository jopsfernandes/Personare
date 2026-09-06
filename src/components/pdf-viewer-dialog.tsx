import { useTranslation } from "react-i18next";
import type { Activity } from "@/components/activities-data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PdfViewerDialogProps {
  activity: Activity | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function PdfViewerDialog({
  activity,
  onOpenChange,
  open,
}: PdfViewerDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
        </DialogHeader>
        {activity ? (
          <iframe
            className="h-[70vh] w-full"
            src={`file://${activity.filePath}`}
            title={t("pdfViewerFrameTitle")}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
