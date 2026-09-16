export interface QuizScoringOption {
  id: string;
  isCorrect: boolean;
}

export interface QuizScoringQuestion {
  id: string;
  options: QuizScoringOption[];
}

export type QuizAnswers = Record<string, string>;

export interface QuizScore {
  correct: number;
  total: number;
}

export function formatQuizDuration(milliseconds: number): string {
  const totalSeconds = Math.round(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function calculateQuizScore(
  questions: QuizScoringQuestion[],
  answers: QuizAnswers
): QuizScore {
  const correct = questions.reduce((count, question) => {
    const selectedOptionId = answers[question.id];
    const selectedOption = question.options.find(
      (option) => option.id === selectedOptionId
    );

    return selectedOption?.isCorrect ? count + 1 : count;
  }, 0);

  return { correct, total: questions.length };
}
