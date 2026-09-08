/**
 * Token persistence.
 *
 * Decision (see README decision log): tokens live in localStorage, not just in memory.
 * A pure in-memory store would fail the "reload puts the user back where they were"
 * requirement by forcing a fresh login on every refresh. sessionStorage would survive
 * a reload but not a link opened on a colleague's tablet in a *different* tab of the
 * same session restore, which is close enough to how ward staff actually work that we
 * ruled it out too. localStorage is the pragmatic choice for a token issued by a
 * third-party demo API with no backend of our own to front it with an httpOnly cookie;
 * the trade-off (XSS-readable tokens) is real and is called out explicitly rather than
 * ignored.
 */

const ACCESS_TOKEN_KEY = 'clinic-stock.accessToken';
const REFRESH_TOKEN_KEY = 'clinic-stock.refreshToken';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function loadTokens(): StoredTokens | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
