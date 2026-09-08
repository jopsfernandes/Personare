import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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

export interface QuizQuestionFormValue {
  id: string;
  options: { id: string; isCorrect: boolean; text: string }[];
  text: string;
}

interface OptionRow {
  isCorrect: boolean;
  key: string;
  text: string;
}

const MIN_OPTIONS = 2;

function emptyRows(): OptionRow[] {
  return [
    { isCorrect: false, key: "new-option-0", text: "" },
    { isCorrect: false, key: "new-option-1", text: "" },
  ];
}

function rowsFromQuestion(question: QuizQuestionFormValue): OptionRow[] {
  return question.options.map((option) => ({
    isCorrect: option.isCorrect,
    key: option.id,
    text: option.text,
  }));
}

interface QuizOptionRowProps {
  disableRemove: boolean;
  onCorrectChange: (key: string) => void;
  onRemove: (key: string) => void;
  onTextChange: (key: string, value: string) => void;
  optionTextId: string;
  optionTextLabel: string;
  radioGroupName: string;
  removeOptionLabel: string;
  row: OptionRow;
}

function QuizOptionRow({
  disableRemove,
  onCorrectChange,
  onRemove,
  onTextChange,
  optionTextId,
  optionTextLabel,
  radioGroupName,
  removeOptionLabel,
  row,
}: QuizOptionRowProps) {
  const handleCorrectChange = useCallback(() => {
    onCorrectChange(row.key);
  }, [onCorrectChange, row.key]);

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onTextChange(row.key, event.target.value);
    },
    [onTextChange, row.key]
  );

  const handleRemoveClick = useCallback(() => {
    onRemove(row.key);
  }, [onRemove, row.key]);

  return (
    <div className="flex items-center gap-2">
      <input
        checked={row.isCorrect}
        name={radioGroupName}
        onChange={handleCorrectChange}
        type="radio"
      />
      <Label className="sr-only" htmlFor={optionTextId}>
        {optionTextLabel}
      </Label>
      <Input id={optionTextId} onChange={handleTextChange} value={row.text} />
      <Button
        aria-label={removeOptionLabel}
        disabled={disableRemove}
        onClick={handleRemoveClick}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Trash2 />
      </Button>
    </div>
  );
}

interface QuizQuestionFormDialogProps {
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    text: string,
    options: { isCorrect: boolean; text: string }[]
  ) => void;
  open: boolean;
  question: QuizQuestionFormValue | null;
}

export default function QuizQuestionFormDialog({
  onOpenChange,
  onSubmit,
  open,
  question,
}: QuizQuestionFormDialogProps) {
  const { t } = useTranslation();
  const questionTextId = useId();
  const radioGroupName = useId();
  const nextNewRowIndex = useRef(0);
  const [text, setText] = useState(question?.text ?? "");
  const [rows, setRows] = useState<OptionRow[]>(
    question ? rowsFromQuestion(question) : emptyRows()
  );

  useEffect(() => {
    if (open) {
      setText(question?.text ?? "");
      setRows(question ? rowsFromQuestion(question) : emptyRows());
      nextNewRowIndex.current = 0;
    }
  }, [open, question]);

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setText(event.target.value);
    },
    []
  );

  const handleOptionTextChange = useCallback(
    (key: string, value: string) => {
      setRows((prev) =>
        prev.map((row) => (row.key === key ? { ...row, text: value } : row))
      );
    },
    []
  );

  const handleOptionCorrectChange = useCallback((key: string) => {
    setRows((prev) =>
      prev.map((row) => ({ ...row, isCorrect: row.key === key }))
    );
  }, []);

  const handleAddOption = useCallback(() => {
    nextNewRowIndex.current += 1;
    setRows((prev) => [
      ...prev,
      { isCorrect: false, key: `added-option-${nextNewRowIndex.current}`, text: "" },
    ]);
  }, []);

  const handleRemoveOption = useCallback((key: string) => {
    setRows((prev) =>
      prev.length <= MIN_OPTIONS ? prev : prev.filter((row) => row.key !== key)
    );
  }, []);

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const filledOptions = rows
        .filter((row) => row.text.trim() !== "")
        .map((row) => ({ isCorrect: row.isCorrect, text: row.text }));

      if (filledOptions.length < MIN_OPTIONS) {
        return;
      }
      if (filledOptions.filter((option) => option.isCorrect).length !== 1) {
        return;
      }

      onSubmit(text, filledOptions);
    },
    [rows, text, onSubmit]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {question ? t("editQuizQuestionAction") : t("addQuizQuestionAction")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor={questionTextId}>{t("quizQuestionTextLabel")}</Label>
              <Input
                id={questionTextId}
                onChange={handleTextChange}
                required
                value={text}
              />
            </div>
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <QuizOptionRow
                  disableRemove={rows.length <= MIN_OPTIONS}
                  key={row.key}
                  onCorrectChange={handleOptionCorrectChange}
                  onRemove={handleRemoveOption}
                  onTextChange={handleOptionTextChange}
                  optionTextId={`${questionTextId}-${row.key}`}
                  optionTextLabel={t("quizOptionTextLabel")}
                  radioGroupName={radioGroupName}
                  removeOptionLabel={t("removeQuizOptionAction")}
                  row={row}
                />
              ))}
              <Button onClick={handleAddOption} type="button" variant="outline">
                {t("addQuizOptionAction")}
              </Button>
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
