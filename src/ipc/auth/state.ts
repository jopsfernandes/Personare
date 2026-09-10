import type { BackendUser } from "@/main/backend-client";

let authSession: BackendUser | null = null;
let authToken: string | null = null;
let authTokenFilePath: string | undefined;

export function setAuthSession(session: BackendUser | null) {
  authSession = session;
}

export function getAuthSession() {
  return authSession;
}

/**
 * The raw JWT, kept in memory only (never written back to disk here --
 * that's auth-token-storage.ts's job) so other IPC namespaces (e.g.
 * calendar-sync) can attach it as a Bearer token without re-reading the
 * safeStorage-encrypted file on every call.
 */
export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
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
