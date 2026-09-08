import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createQuizOption,
  createQuizQuestion,
  listQuizQuestionsWithOptions,
  softDeleteQuizOption,
  softDeleteQuizQuestion,
  updateQuizQuestion,
} from "@/actions/quiz";
import type { Activity } from "@/components/activities-data-table";
import QuizQuestionFormDialog, {
  type QuizQuestionFormValue,
} from "@/components/quiz-question-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuizQuestionWithOptions {
  id: string;
  options: { id: string; isCorrect: boolean; text: string }[];
  text: string;
}

interface QuizQuestionRowProps {
  deleteLabel: string;
  editLabel: string;
  onDelete: (question: QuizQuestionWithOptions) => void;
  onEdit: (question: QuizQuestionWithOptions) => void;
  question: QuizQuestionWithOptions;
}

function QuizQuestionRow({
  deleteLabel,
  editLabel,
  onDelete,
  onEdit,
  question,
}: QuizQuestionRowProps) {
  const handleEditClick = useCallback(() => {
    onEdit(question);
  }, [onEdit, question]);

  const handleDeleteClick = useCallback(() => {
    onDelete(question);
  }, [onDelete, question]);

  return (
    <li className="flex items-center justify-between gap-2">
      <span>{question.text}</span>
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

interface QuizQuestionManagerDialogProps {
  activity: Activity | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function QuizQuestionManagerDialog({
  activity,
  onOpenChange,
  open,
}: QuizQuestionManagerDialogProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<QuizQuestionWithOptions[]>([]);
  const [formQuestion, setFormQuestion] =
    useState<QuizQuestionFormValue | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const refreshQuestions = useCallback(() => {
    if (!activity) {
      return;
    }

    listQuizQuestionsWithOptions(activity.id).then(setQuestions);
  }, [activity]);

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  const handleAddClick = useCallback(() => {
    setFormQuestion(null);
    setIsFormOpen(true);
  }, []);

  const handleEditClick = useCallback((question: QuizQuestionWithOptions) => {
    setFormQuestion({
      id: question.id,
      options: question.options,
      text: question.text,
    });
    setIsFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    (question: QuizQuestionWithOptions) => {
      Promise.resolve(softDeleteQuizQuestion(question.id)).then(() => {
        refreshQuestions();
      });
    },
    [refreshQuestions]
  );

  const handleFormOpenChange = useCallback((nextOpen: boolean) => {
    setIsFormOpen(nextOpen);
  }, []);

  const handleFormSubmit = useCallback(
    (text: string, options: { isCorrect: boolean; text: string }[]) => {
      if (!activity) {
        return;
      }

      if (formQuestion) {
        const questionId = formQuestion.id;
        const staleOptionIds = formQuestion.options.map((option) => option.id);

        updateQuizQuestion(questionId, text)
          .then(() =>
            Promise.all(staleOptionIds.map((id) => softDeleteQuizOption(id)))
          )
          .then(() =>
            Promise.all(
              options.map((option) =>
                createQuizOption(questionId, option.text, option.isCorrect)
              )
            )
          )
          .then(() => {
            setIsFormOpen(false);
            refreshQuestions();
          });
      } else {
        createQuizQuestion(activity.id, text)
          .then((created) =>
            Promise.all(
              options.map((option) =>
                createQuizOption(created.id, option.text, option.isCorrect)
              )
            )
          )
          .then(() => {
            setIsFormOpen(false);
            refreshQuestions();
          });
      }
    },
    [activity, formQuestion, refreshQuestions]
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
                {t("addQuizQuestionAction")}
              </Button>
            </div>
            {questions.length === 0 ? (
              <p>{t("quizQuestionsEmptyMessage")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {questions.map((question) => (
                  <QuizQuestionRow
                    deleteLabel={t("deleteQuizQuestionAction")}
                    editLabel={t("editQuizQuestionAction")}
                    key={question.id}
                    onDelete={handleDeleteClick}
                    onEdit={handleEditClick}
                    question={question}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <QuizQuestionFormDialog
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
        question={formQuestion}
      />
    </>
  );
}
