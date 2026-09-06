import { z } from "zod";

export const createProgramInputSchema = z.object({
  name: z.string().min(1),
});

export const updateProgramInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export const softDeleteProgramInputSchema = z.object({
  id: z.string(),
});
