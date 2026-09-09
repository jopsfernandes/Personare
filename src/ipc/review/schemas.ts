import { z } from "zod";

export const ensureReviewItemsInputSchema = z.object({
  activityId: z.string(),
});

export const listDueInputSchema = z.object({
  activityId: z.string(),
});

export const submitRatingInputSchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
  reviewItemId: z.string(),
});
