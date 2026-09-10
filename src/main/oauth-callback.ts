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
