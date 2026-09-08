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
