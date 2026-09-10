import { z } from "zod";

export const exportBackupInputSchema = z.object({
  filePath: z.string().min(1),
  passphrase: z.string().min(1),
});

export const importBackupInputSchema = z.object({
  filePath: z.string().min(1),
  passphrase: z.string().min(1),
});
