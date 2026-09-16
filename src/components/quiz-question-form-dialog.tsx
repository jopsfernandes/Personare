import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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

export interface QuizQuestionFormValue {
  id: string;
  imagePath: string | null;
  options: {
    id: string;
    imagePath: string | null;
    isCorrect: boolean;
    text: string;
  }[];
  text: string;
}

export interface QuizQuestionSubmitOption {
  imagePath: string | null;
  isCorrect: boolean;
  text: string;
}

interface OptionRow {
  imagePath: string | null;
  isCorrect: boolean;
  key: string;
  text: string;
}

const MIN_OPTIONS = 2;

function emptyRows(): OptionRow[] {
  return [
    { imagePath: null, isCorrect: false, key: "new-option-0", text: "" },
    { imagePath: null, isCorrect: false, key: "new-option-1", text: "" },
  ];
}

function rowsFromQuestion(question: QuizQuestionFormValue): OptionRow[] {
  return question.options.map((option) => ({
    imagePath: option.imagePath,
    isCorrect: option.isCorrect,
    key: option.id,
    text: option.text,
  }));
}

interface QuizOptionRowProps {
  disableRemove: boolean;
  onCorrectChange: (key: string) => void;
  onImagePathChange: (key: string, imagePath: string | null) => void;
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
  onImagePathChange,
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
    (value: string) => {
      onTextChange(row.key, value);
    },
    [onTextChange, row.key]
  );

  const handleImagePathChange = useCallback(
    (imagePath: string | null) => {
      onImagePathChange(row.key, imagePath);
    },
    [onImagePathChange, row.key]
  );

  const handleRemoveClick = useCallback(() => {
    onRemove(row.key);
  }, [onRemove, row.key]);

  return (
    <div className="flex items-start gap-2">
      <input
        checked={row.isCorrect}
        className="mt-2"
        name={radioGroupName}
        onChange={handleCorrectChange}
        type="radio"
      />
      <div className="flex flex-1 flex-col gap-2">
        <MarkdownEditor
          id={optionTextId}
          label={optionTextLabel}
          onChange={handleTextChange}
          value={row.text}
        />
        <ImageAttachmentField
          fileName={row.imagePath}
          label={optionTextLabel}
          onChange={handleImagePathChange}
        />
      </div>
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
    imagePath: string | null,
    options: QuizQuestionSubmitOption[]
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
  const [imagePath, setImagePath] = useState(question?.imagePath ?? null);
  const [rows, setRows] = useState<OptionRow[]>(
    question ? rowsFromQuestion(question) : emptyRows()
  );

  useEffect(() => {
    if (open) {
      setText(question?.text ?? "");
      setImagePath(question?.imagePath ?? null);
      setRows(question ? rowsFromQuestion(question) : emptyRows());
      nextNewRowIndex.current = 0;
    }
  }, [open, question]);

  const handleOptionTextChange = useCallback((key: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, text: value } : row))
    );
  }, []);

  const handleOptionImagePathChange = useCallback(
    (key: string, optionImagePath: string | null) => {
      setRows((prev) =>
        prev.map((row) =>
          row.key === key ? { ...row, imagePath: optionImagePath } : row
        )
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
      {
        imagePath: null,
        isCorrect: false,
        key: `added-option-${nextNewRowIndex.current}`,
        text: "",
      },
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
        .map((row) => ({
          imagePath: row.imagePath,
          isCorrect: row.isCorrect,
          text: row.text,
        }));

      if (filledOptions.length < MIN_OPTIONS) {
        return;
      }
      if (filledOptions.filter((option) => option.isCorrect).length !== 1) {
        return;
      }

      onSubmit(text, imagePath, filledOptions);
    },
    [rows, text, imagePath, onSubmit]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={handleSubmit}
        >
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>
              {question
                ? t("editQuizQuestionAction")
                : t("addQuizQuestionAction")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              <MarkdownEditor
                id={questionTextId}
                label={t("quizQuestionTextLabel")}
                onChange={setText}
                required
                value={text}
              />
              <ImageAttachmentField
                fileName={imagePath}
                label={t("quizQuestionTextLabel")}
                onChange={setImagePath}
              />
            </div>
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <QuizOptionRow
                  disableRemove={rows.length <= MIN_OPTIONS}
                  key={row.key}
                  onCorrectChange={handleOptionCorrectChange}
                  onImagePathChange={handleOptionImagePathChange}
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
          <DialogFooter className="px-4 pb-4">
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
