import { os } from "@orpc/server";
import { shell } from "electron";
import { openExternalLinkInputSchema, openPathInputSchema } from "./schemas";

export const openExternalLink = os
  .input(openExternalLinkInputSchema)
  .handler(({ input }) => {
    const { url } = input;
    shell.openExternal(url);
  });

/**
 * Opens a local file with the OS's default handler (e.g. the user's PDF
 * reader) instead of rendering it inside the app -- see
 * docs/specs/issue-103-pdf-native-open-difficulty-flow.md for why the old
 * in-app iframe viewer never worked. shell.openPath resolves to an error
 * message (not a rejection) when it fails, e.g. the file was moved/deleted.
 */
export const openPath = os
  .input(openPathInputSchema)
  .handler(async ({ input }) => {
    const errorMessage = await shell.openPath(input.path);
    return { errorMessage: errorMessage || null };
  });
