import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAttachmentImageDataUrl } from "@/actions/attachments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImageAttachmentViewerProps {
  fileName: string | null;
}

export default function ImageAttachmentViewer({
  fileName,
}: ImageAttachmentViewerProps) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleViewClick = useCallback(() => {
    if (!fileName) {
      return;
    }
    getAttachmentImageDataUrl(fileName).then((url) => {
      setDataUrl(url);
      setOpen(true);
    });
  }, [fileName]);

  if (!fileName) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleViewClick}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("viewImageAction")}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("viewImageAction")}</DialogTitle>
          </DialogHeader>
          {dataUrl ? (
            <img
              alt={fileName}
              className="h-auto max-h-[70vh] w-auto max-w-full"
              height={600}
              src={dataUrl}
              width={800}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
