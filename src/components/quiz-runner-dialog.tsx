import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { listQuizQuestionsWithOptions } from "@/actions/quiz";
import type { Activity } from "@/components/activities-data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateQuizScore, type QuizScore } from "@/utils/quiz-scoring";

interface QuizRunnerQuestion {
  id: string;
  options: { id: string; isCorrect: boolean; text: string }[];
  text: string;
}

interface QuizRunnerDialogProps {
  activity: Activity | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface QuizRunnerOptionProps {
  groupName: string;
  onSelect: (questionId: string, optionId: string) => void;
  option: { id: string; text: string };
  questionId: string;
  selected: boolean;
}

function QuizRunnerOption({
  groupName,
  onSelect,
  option,
  questionId,
  selected,
}: QuizRunnerOptionProps) {
  const handleChange = useCallback(() => {
    onSelect(questionId, option.id);
  }, [onSelect, questionId, option.id]);

  return (
    <label className="flex items-center gap-2">
      <input
        checked={selected}
        name={groupName}
        onChange={handleChange}
        type="radio"
      />
      {option.text}
    </label>
  );
}

function QuizRunnerQuestionFieldset({
  groupName,
  onAnswerChange,
  question,
  selectedOptionId,
}: {
  groupName: string;
  onAnswerChange: (questionId: string, optionId: string) => void;
  question: QuizRunnerQuestion;
  selectedOptionId: string | undefined;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend>{question.text}</legend>
      {question.options.map((option) => (
        <QuizRunnerOption
          groupName={groupName}
          key={option.id}
          onSelect={onAnswerChange}
          option={option}
          questionId={question.id}
          selected={selectedOptionId === option.id}
        />
      ))}
    </fieldset>
  );
}

export default function QuizRunnerDialog({
  activity,
  onOpenChange,
  open,
}: QuizRunnerDialogProps) {
  const { t } = useTranslation();
  const groupNamePrefix = useId();
  const [questions, setQuestions] = useState<QuizRunnerQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizScore | null>(null);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (activity) {
      listQuizQuestionsWithOptions(activity.id).then(setQuestions);
    }
  }, [activity]);

  const handleAnswerChange = useCallback(
    (questionId: string, optionId: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    },
    []
  );

  const handleFinishClick = useCallback(() => {
    setResult(calculateQuizScore(questions, answers));
  }, [questions, answers]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
        </DialogHeader>
        {result ? (
          <p>
            {t("quizResultMessage", {
              correct: result.correct,
              total: result.total,
            })}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-4 py-4">
              {questions.map((question) => (
                <QuizRunnerQuestionFieldset
                  groupName={`${groupNamePrefix}-${question.id}`}
                  key={question.id}
                  onAnswerChange={handleAnswerChange}
                  question={question}
                  selectedOptionId={answers[question.id]}
                />
              ))}
            </div>
            <DialogFooter>
              <Button onClick={handleFinishClick}>
                {t("finishQuizAction")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
