import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { listQuizQuestionsWithOptions } from "@/actions/quiz";
import type { Activity } from "@/components/activities-data-table";
import { RadialChartText } from "@/components/radial-chart-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  calculateQuizScore,
  formatQuizDuration,
  type QuizScore,
} from "@/utils/quiz-scoring";

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

interface QuizRunnerQuestionStepProps {
  groupName: string;
  onAnswerChange: (questionId: string, optionId: string) => void;
  question: QuizRunnerQuestion;
  selectedOptionId: string | undefined;
}

function QuizRunnerQuestionStep({
  groupName,
  onAnswerChange,
  question,
  selectedOptionId,
}: QuizRunnerQuestionStepProps) {
  const handleValueChange = useCallback(
    (optionId: string) => {
      onAnswerChange(question.id, optionId);
    },
    [onAnswerChange, question.id]
  );

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="font-medium">{question.text}</legend>
      <RadioGroup
        onValueChange={handleValueChange}
        value={selectedOptionId ?? ""}
      >
        {question.options.map((option) => {
          const optionInputId = `${groupName}-${option.id}`;

          return (
            <div className="flex items-center gap-2" key={option.id}>
              <RadioGroupItem id={optionInputId} value={option.id} />
              <Label htmlFor={optionInputId}>{option.text}</Label>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

interface QuizRunnerResultProps {
  averageTimeMs: number;
  result: QuizScore;
  totalTimeMs: number;
}

function QuizRunnerResult({
  averageTimeMs,
  result,
  totalTimeMs,
}: QuizRunnerResultProps) {
  const { t } = useTranslation();
  const percent =
    result.total === 0
      ? 0
      : Math.round((result.correct / result.total) * 100);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <RadialChartText
        centerLabel={`${percent}%`}
        centerSublabel={t("quizResultMessage", {
          correct: result.correct,
          total: result.total,
        })}
        value={percent}
      />
      <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
        <p>
          {t("quizTotalTimeLabel", {
            duration: formatQuizDuration(totalTimeMs),
          })}
        </p>
        <p>
          {t("quizAverageTimeLabel", {
            duration: formatQuizDuration(averageTimeMs),
          })}
        </p>
      </div>
    </div>
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<QuizScore | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setCurrentIndex(0);
      setResult(null);
      setStartedAt(Date.now());
      setFinishedAt(null);
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

  const isLastQuestion =
    questions.length > 0 && currentIndex >= questions.length - 1;

  const handleAdvanceClick = useCallback(() => {
    if (isLastQuestion) {
      setResult(calculateQuizScore(questions, answers));
      setFinishedAt(Date.now());
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  }, [answers, isLastQuestion, questions]);

  const currentQuestion = questions[currentIndex] ?? null;
  const totalTimeMs =
    startedAt !== null && finishedAt !== null ? finishedAt - startedAt : 0;
  const averageTimeMs =
    questions.length > 0 ? totalTimeMs / questions.length : 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
        </DialogHeader>
        {result ? (
          <QuizRunnerResult
            averageTimeMs={averageTimeMs}
            result={result}
            totalTimeMs={totalTimeMs}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Progress
                value={
                  questions.length > 0
                    ? ((currentIndex + 1) / questions.length) * 100
                    : 0
                }
              />
              <p className="text-muted-foreground text-sm">
                {t("quizQuestionProgressLabel", {
                  current: currentIndex + 1,
                  total: questions.length,
                })}
              </p>
            </div>
            {currentQuestion ? (
              <div className="flex flex-col gap-4 py-4">
                <QuizRunnerQuestionStep
                  groupName={`${groupNamePrefix}-${currentQuestion.id}`}
                  onAnswerChange={handleAnswerChange}
                  question={currentQuestion}
                  selectedOptionId={answers[currentQuestion.id]}
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={handleAdvanceClick}>
                {isLastQuestion
                  ? t("finishQuizAction")
                  : t("nextQuestionAction")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
