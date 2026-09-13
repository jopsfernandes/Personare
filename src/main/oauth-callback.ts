import { OAUTH_PROTOCOL } from "@/constants";

export function findOAuthCallbackUrl(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${OAUTH_PROTOCOL}://`));
}

export type OAuthCallbackResult = { token: string } | { error: string };

export function parseOAuthCallback(url: string): OAuthCallbackResult | null {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    const error = parsed.searchParams.get("error");

    if (token) {
      return { token };
    }
    if (error) {
      return { error };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Login (oauth-callback) and Calendar authorization
 * (calendar-connect-callback, Issue #26) share the same registered
 * protocol, so main.ts dispatches on this host to keep each flow's
 * handler isolated.
 */
export function getProtocolCallbackHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export type CalendarConnectCallbackResult =
  | { connected: true }
  | { error: string };

export function parseCalendarConnectCallback(
  url: string
): CalendarConnectCallbackResult | null {
  try {
    const parsed = new URL(url);
    const connected = parsed.searchParams.get("calendarConnected");
    const error = parsed.searchParams.get("error");

    if (connected === "true") {
      return { connected: true };
    }
    if (error) {
      return { error };
    }

    return null;
  } catch {
    return null;
  }
}

export type DriveConnectCallbackResult =
  | { connected: true }
  | { error: string };

/**
 * Mirrors parseCalendarConnectCallback (Issue #26) exactly, one host/query
 * param pair over -- Drive backup (Issue #27) is a third, separate
 * authorization flow sharing the same registered protocol.
 */
export function parseDriveConnectCallback(
  url: string
): DriveConnectCallbackResult | null {
  try {
    const parsed = new URL(url);
    const connected = parsed.searchParams.get("driveConnected");
    const error = parsed.searchParams.get("error");

    if (connected === "true") {
      return { connected: true };
    }
    if (error) {
      return { error };
    }

    return null;
  } catch {
    return null;
  }
}
