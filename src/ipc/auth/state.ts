import type { BackendUser } from "@/main/backend-client";

let authSession: BackendUser | null = null;
let authTokenFilePath: string | undefined;

export function setAuthSession(session: BackendUser | null) {
  authSession = session;
}

export function getAuthSession() {
  return authSession;
}

export function setAuthTokenFilePath(filePath: string) {
  authTokenFilePath = filePath;
}

export function getAuthTokenFilePath() {
  if (!authTokenFilePath) {
    throw new Error("Auth token file path is not initialized");
  }

  return authTokenFilePath;
}
