import { z } from "zod";

export const listFlashcardsInputSchema = z.object({
  activityId: z.string(),
});

export const createFlashcardInputSchema = z.object({
  activityId: z.string(),
  back: z.string().min(1),
  front: z.string().min(1),
});

export const updateFlashcardInputSchema = z.object({
  back: z.string().min(1),
  front: z.string().min(1),
  id: z.string(),
});

export const softDeleteFlashcardInputSchema = z.object({
  id: z.string(),
});
