import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createFlashcard,
  listFlashcards,
  softDeleteFlashcard,
  updateFlashcard,
} from "@/actions/flashcards";
import type { Activity } from "@/components/activities-data-table";
import FlashcardFormDialog, {
  type FlashcardFormValue,
} from "@/components/flashcard-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Flashcard {
  back: string;
  front: string;
  id: string;
}

interface FlashcardRowProps {
  deleteLabel: string;
  editLabel: string;
  flashcard: Flashcard;
  onDelete: (flashcard: Flashcard) => void;
  onEdit: (flashcard: Flashcard) => void;
}

function FlashcardRow({
  deleteLabel,
  editLabel,
  flashcard,
  onDelete,
  onEdit,
}: FlashcardRowProps) {
  const handleEditClick = useCallback(() => {
    onEdit(flashcard);
  }, [onEdit, flashcard]);

  const handleDeleteClick = useCallback(() => {
    onDelete(flashcard);
  }, [onDelete, flashcard]);

  return (
    <li className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <span>{flashcard.front}</span>
        <span className="text-muted-foreground">{flashcard.back}</span>
      </div>
      <div className="flex gap-2">
        <Button
          aria-label={editLabel}
          onClick={handleEditClick}
          size="icon"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={deleteLabel}
          onClick={handleDeleteClick}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

interface FlashcardManagerDialogProps {
  activity: Activity | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function FlashcardManagerDialog({
  activity,
  onOpenChange,
  open,
}: FlashcardManagerDialogProps) {
  const { t } = useTranslation();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [formFlashcard, setFormFlashcard] =
    useState<FlashcardFormValue | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const refreshFlashcards = useCallback(() => {
    if (!activity) {
      return;
    }

    listFlashcards(activity.id).then(setFlashcards);
  }, [activity]);

  useEffect(() => {
    refreshFlashcards();
  }, [refreshFlashcards]);

  const handleAddClick = useCallback(() => {
    setFormFlashcard(null);
    setIsFormOpen(true);
  }, []);

  const handleEditClick = useCallback((flashcard: Flashcard) => {
    setFormFlashcard(flashcard);
    setIsFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    (flashcard: Flashcard) => {
      Promise.resolve(softDeleteFlashcard(flashcard.id)).then(() => {
        refreshFlashcards();
      });
    },
    [refreshFlashcards]
  );

  const handleFormOpenChange = useCallback((nextOpen: boolean) => {
    setIsFormOpen(nextOpen);
  }, []);

  const handleFormSubmit = useCallback(
    (front: string, back: string) => {
      if (!activity) {
        return;
      }

      const submit = formFlashcard
        ? updateFlashcard(formFlashcard.id, front, back)
        : createFlashcard(activity.id, front, back);

      submit.then(() => {
        setIsFormOpen(false);
        refreshFlashcards();
      });
    },
    [activity, formFlashcard, refreshFlashcards]
  );

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activity?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex justify-end">
              <Button onClick={handleAddClick}>
                {t("addFlashcardAction")}
              </Button>
            </div>
            {flashcards.length === 0 ? (
              <p>{t("flashcardsEmptyMessage")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {flashcards.map((flashcard) => (
                  <FlashcardRow
                    deleteLabel={t("deleteFlashcardAction")}
                    editLabel={t("editFlashcardAction")}
                    flashcard={flashcard}
                    key={flashcard.id}
                    onDelete={handleDeleteClick}
                    onEdit={handleEditClick}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <FlashcardFormDialog
        flashcard={formFlashcard}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />
    </>
  );
}
