import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
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

export interface FlashcardFormValue {
  back: string;
  front: string;
  id: string;
}

interface FlashcardFormDialogProps {
  flashcard: FlashcardFormValue | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (front: string, back: string) => void;
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

  useEffect(() => {
    if (open) {
      setFront(flashcard?.front ?? "");
      setBack(flashcard?.back ?? "");
    }
  }, [open, flashcard]);

  const handleFrontChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFront(event.target.value);
    },
    []
  );

  const handleBackChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setBack(event.target.value);
    },
    []
  );

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(front, back);
    },
    [front, back, onSubmit]
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
            <div className="flex flex-col gap-1">
              <Label htmlFor={frontInputId}>{t("flashcardFrontLabel")}</Label>
              <Input
                id={frontInputId}
                onChange={handleFrontChange}
                required
                value={front}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={backInputId}>{t("flashcardBackLabel")}</Label>
              <Input
                id={backInputId}
                onChange={handleBackChange}
                required
                value={back}
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
