import { z } from "zod";

export const listModulesInputSchema = z.object({
  programId: z.string(),
});

export const createModuleInputSchema = z.object({
  name: z.string().min(1),
  programId: z.string(),
});

export const updateModuleInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export const softDeleteModuleInputSchema = z.object({
  id: z.string(),
});
