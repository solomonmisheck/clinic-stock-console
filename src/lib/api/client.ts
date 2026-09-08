import { createRefreshCoordinator, type Tokens } from '../auth/refreshCoordinator';
import { clearTokens, loadTokens, saveTokens } from '../auth/tokenStorage';
import { emitSessionExpired, emitTokensRefreshed } from '../auth/authEvents';
import { createHttpClient } from './httpClient';
import { ACCESS_TOKEN_LIFETIME_MINS } from '../auth/config';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://dummyjson.com';

async function performRefresh(refreshToken: string): Promise<Tokens> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, expiresInMins: ACCESS_TOKEN_LIFETIME_MINS }),
  });
  if (!response.ok) {
    throw new Error(`Refresh failed with status ${response.status}`);
  }
  return (await response.json()) as Tokens;
}

const refreshCoordinator = createRefreshCoordinator({
  refreshRequest: performRefresh,
  getRefreshToken: () => loadTokens()?.refreshToken ?? null,
  onSuccess: (tokens) => {
    saveTokens(tokens);
    emitTokensRefreshed(tokens);
  },
  onFailure: () => {
    clearTokens();
    emitSessionExpired();
  },
});

export const httpClient = createHttpClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => loadTokens()?.accessToken ?? null,
  refreshCoordinator,
});

/** Exposed so the proactive refresh timer in AuthContext shares the same mutex. */
export { refreshCoordinator };
export { ApiError } from './httpClient';
