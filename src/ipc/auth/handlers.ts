import { os } from "@orpc/server";
import { shell } from "electron";
import { BACKEND_BASE_URL, OAUTH_REDIRECT_URI } from "@/constants";
import { setCalendarConnected } from "@/ipc/calendar-sync/state";
import { clearToken } from "@/main/auth-token-storage";
import {
  getAuthSession,
  getAuthTokenFilePath,
  setAuthSession,
  setAuthToken,
} from "./state";

export const login = os.handler(async () => {
  const url = `${BACKEND_BASE_URL}/auth/google?redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}`;

  await shell.openExternal(url);
});

export const getSession = os.handler(() => getAuthSession());

export const logout = os.handler(() => {
  setAuthSession(null);
  setAuthToken(null);
  setCalendarConnected(false);
  clearToken(getAuthTokenFilePath());
});
