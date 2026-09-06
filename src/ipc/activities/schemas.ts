import { z } from "zod";

export const listActivitiesInputSchema = z.object({
  moduleId: z.string(),
});

export const createActivityInputSchema = z.object({
  filePath: z.string().nullish(),
  moduleId: z.string(),
  title: z.string().min(1),
  type: z.string().min(1),
  url: z.string().nullish(),
});

export const updateActivityInputSchema = z.object({
  filePath: z.string().nullish(),
  id: z.string(),
  title: z.string().min(1),
  type: z.string().min(1),
  url: z.string().nullish(),
});

export const softDeleteActivityInputSchema = z.object({
  id: z.string(),
});
