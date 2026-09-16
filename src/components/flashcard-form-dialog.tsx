import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import ImageAttachmentField from "@/components/image-attachment-field";
import MarkdownEditor from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface FlashcardFormValue {
  back: string;
  backImagePath: string | null;
  front: string;
  frontImagePath: string | null;
  id: string;
}

export interface FlashcardFormSubmitValue {
  back: string;
  backImagePath: string | null;
  front: string;
  frontImagePath: string | null;
}

interface FlashcardFormDialogProps {
  flashcard: FlashcardFormValue | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FlashcardFormSubmitValue) => void;
  open: boolean;
}

export default function FlashcardFormDialog({
  flashcard,
  onOpenChange,
  onSubmit,
  open,
}: FlashcardFormDialogProps) {
  const { t } = useTranslation();
  const frontInputId = useId();
  const backInputId = useId();
  const [front, setFront] = useState(flashcard?.front ?? "");
  const [back, setBack] = useState(flashcard?.back ?? "");
  const [frontImagePath, setFrontImagePath] = useState(
    flashcard?.frontImagePath ?? null
  );
  const [backImagePath, setBackImagePath] = useState(
    flashcard?.backImagePath ?? null
  );

  useEffect(() => {
    if (open) {
      setFront(flashcard?.front ?? "");
      setBack(flashcard?.back ?? "");
      setFrontImagePath(flashcard?.frontImagePath ?? null);
      setBackImagePath(flashcard?.backImagePath ?? null);
    }
  }, [open, flashcard]);

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit({ back, backImagePath, front, frontImagePath });
    },
    [front, back, frontImagePath, backImagePath, onSubmit]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {flashcard ? t("editFlashcardAction") : t("addFlashcardAction")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <MarkdownEditor
                id={frontInputId}
                label={t("flashcardFrontLabel")}
                onChange={setFront}
                required
                value={front}
              />
              <ImageAttachmentField
                fileName={frontImagePath}
                label={t("flashcardFrontLabel")}
                onChange={setFrontImagePath}
              />
            </div>
            <div className="flex flex-col gap-2">
              <MarkdownEditor
                id={backInputId}
                label={t("flashcardBackLabel")}
                onChange={setBack}
                required
                value={back}
              />
              <ImageAttachmentField
                fileName={backImagePath}
                label={t("flashcardBackLabel")}
                onChange={setBackImagePath}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCancelClick} type="button" variant="outline">
              {t("cancelAction")}
            </Button>
            <Button type="submit">{t("saveAction")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
