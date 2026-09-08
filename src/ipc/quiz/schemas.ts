import { z } from "zod";

export const listQuestionsInputSchema = z.object({
  activityId: z.string(),
});

export const createQuestionInputSchema = z.object({
  activityId: z.string(),
  text: z.string().min(1),
});

export const updateQuestionInputSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

export const softDeleteQuestionInputSchema = z.object({
  id: z.string(),
});

export const listOptionsInputSchema = z.object({
  questionId: z.string(),
});

export const createOptionInputSchema = z.object({
  isCorrect: z.boolean().default(false),
  questionId: z.string(),
  text: z.string().min(1),
});

export const updateOptionInputSchema = z.object({
  id: z.string(),
  isCorrect: z.boolean(),
  text: z.string().min(1),
});

export const softDeleteOptionInputSchema = z.object({
  id: z.string(),
});
