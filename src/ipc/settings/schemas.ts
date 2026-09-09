import { z } from "zod";

export const setAutoStartInputSchema = z.object({
  enabled: z.boolean(),
});
