import { os } from "@orpc/server";
import { shell } from "electron";
import { z } from "zod";
import { CALENDAR_CONNECT_REDIRECT_URI } from "@/constants";
import { getAuthToken } from "@/ipc/auth/state";
import {
  fetchCalendarAuthorizationUrl,
  syncCalendarEvents,
} from "@/main/backend-client";
import { getCalendarConnected } from "./state";

export const connect = os.handler(async () => {
  const token = getAuthToken();

  if (!token) {
    return;
  }

  const authorizationUrl = await fetchCalendarAuthorizationUrl(
    token,
    CALENDAR_CONNECT_REDIRECT_URI
  );

  if (authorizationUrl) {
    await shell.openExternal(authorizationUrl);
  }
});

export const getConnectionStatus = os.handler(() => getCalendarConnected());

const reviewItemSchema = z.object({
  dueDate: z.string(),
  front: z.string(),
  id: z.string(),
});

export const sync = os
  .input(z.object({ reviewItems: z.array(reviewItemSchema) }))
  .handler(({ input }) => {
    const token = getAuthToken();

    if (!token) {
      return { error: "not_logged_in" };
    }

    return syncCalendarEvents(token, input.reviewItems);
  });
