import { z } from "zod";

export const saveImageInputSchema = z.object({
  sourcePath: z.string(),
});

export const getImageDataUrlInputSchema = z.object({
  fileName: z.string(),
});

export const deleteImageInputSchema = z.object({
  fileName: z.string(),
});
