import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteAttachmentImage,
  saveAttachmentImage,
} from "@/actions/attachments";
import { selectImageFile } from "@/actions/dialog";
import { Button } from "@/components/ui/button";

interface ImageAttachmentFieldProps {
  fileName: string | null;
  label: string;
  onChange: (fileName: string | null) => void;
}

export default function ImageAttachmentField({
  fileName,
  label,
  onChange,
}: ImageAttachmentFieldProps) {
  const { t } = useTranslation();

  const handleAttachClick = useCallback(() => {
    selectImageFile()
      .then((sourcePath) =>
        sourcePath ? saveAttachmentImage(sourcePath) : null
      )
      .then((saved) => {
        if (saved) {
          onChange(saved.fileName);
        }
      });
  }, [onChange]);

  const handleRemoveClick = useCallback(() => {
    if (!fileName) {
      return;
    }
    deleteAttachmentImage(fileName).then(() => {
      onChange(null);
    });
  }, [fileName, onChange]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {fileName ? (
        <>
          <span>{t("imageAttachedLabel")}</span>
          <Button
            onClick={handleRemoveClick}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("removeImageAction")}
          </Button>
        </>
      ) : (
        <Button
          onClick={handleAttachClick}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("attachImageAction")}
        </Button>
      )}
    </div>
  );
}
