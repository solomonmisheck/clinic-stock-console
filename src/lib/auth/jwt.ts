/**
 * Minimal JWT payload decoder. We only ever read tokens we were just issued by
 * DummyJSON over HTTPS, so there is no need to verify the signature client-side --
 * we just need the `exp` claim to schedule a silent refresh before it lapses.
 */

interface JwtPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

function base64UrlDecode(segment: string): string {
  const padded = segment
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(segment.length / 4) * 4, '=');
  return atob(padded);
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

/** Milliseconds until the token's `exp` claim, or null if it can't be determined. */
export function msUntilExpiry(token: string, now: number = Date.now()): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000 - now;
}
