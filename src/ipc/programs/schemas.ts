import { z } from "zod";

export const createProgramInputSchema = z.object({
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  name: z.string().min(1),
});

export const updateProgramInputSchema = z.object({
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  id: z.string(),
  name: z.string().min(1),
});

export const softDeleteProgramInputSchema = z.object({
  id: z.string(),
});
