import { BACKEND_BASE_URL } from "@/constants";

export interface BackendUser {
  avatarUrl: string | null;
  email: string;
  id: string;
  name: string;
}

export async function fetchCurrentUser(
  token: string
): Promise<BackendUser | null> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BackendUser;
  } catch {
    return null;
  }
}

export async function fetchCalendarAuthorizationUrl(
  token: string,
  redirectUri: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${BACKEND_BASE_URL}/calendar/connect?redirect_uri=${encodeURIComponent(redirectUri)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { authorizationUrl: string };
    return body.authorizationUrl;
  } catch {
    return null;
  }
}

export interface CalendarSyncReviewItem {
  dueDate: string;
  front: string;
  id: string;
}

export type CalendarSyncResult =
  | { created: number; deleted: number; updated: number }
  | { error: string };

export async function syncCalendarEvents(
  token: string,
  reviewItems: CalendarSyncReviewItem[]
): Promise<CalendarSyncResult> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/calendar/sync`, {
      body: JSON.stringify({ reviewItems }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = await response.json();

    return body as CalendarSyncResult;
  } catch {
    return { error: "unreachable" };
  }
}

export interface AccountExport {
  googleCalendarConnected: boolean;
  profile: {
    avatarUrl: string | null;
    createdAt: string;
    email: string;
    id: string;
    name: string;
  };
}

export async function fetchAccountExport(
  token: string
): Promise<AccountExport | null> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AccountExport;
  } catch {
    return null;
  }
}

export async function deleteAccount(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      method: "DELETE",
    });

    return response.ok;
  } catch {
    return false;
  }
}
