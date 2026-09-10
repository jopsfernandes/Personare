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
