import { ipc } from "@/ipc/manager";

export function listQuizQuestions(activityId: string) {
  return ipc.client.quiz.listQuestions({ activityId });
}

export function createQuizQuestion(activityId: string, text: string) {
  return ipc.client.quiz.createQuestion({ activityId, text });
}

export function updateQuizQuestion(id: string, text: string) {
  return ipc.client.quiz.updateQuestion({ id, text });
}

export function softDeleteQuizQuestion(id: string) {
  return ipc.client.quiz.softDeleteQuestion({ id });
}

export function listQuizOptions(questionId: string) {
  return ipc.client.quiz.listOptions({ questionId });
}

export function createQuizOption(
  questionId: string,
  text: string,
  isCorrect: boolean
) {
  return ipc.client.quiz.createOption({ isCorrect, questionId, text });
}

export function updateQuizOption(
  id: string,
  text: string,
  isCorrect: boolean
) {
  return ipc.client.quiz.updateOption({ id, isCorrect, text });
}

export function softDeleteQuizOption(id: string) {
  return ipc.client.quiz.softDeleteOption({ id });
}

export async function listQuizQuestionsWithOptions(activityId: string) {
  const questions = await ipc.client.quiz.listQuestions({ activityId });

  return Promise.all(
    questions.map(async (question) => {
      const options = await ipc.client.quiz.listOptions({
        questionId: question.id,
      });

      return {
        id: question.id,
        options: options.map((option) => ({
          id: option.id,
          isCorrect: option.isCorrect,
          text: option.text,
        })),
        text: question.text,
      };
    })
  );
}
