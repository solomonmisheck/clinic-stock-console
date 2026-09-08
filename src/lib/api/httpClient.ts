import type { RefreshCoordinator } from '../auth/refreshCoordinator';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface HttpClientDeps {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken: () => string | null;
  refreshCoordinator: RefreshCoordinator;
}

export interface RequestOptions extends RequestInit {
  /** Attach the bearer token. Defaults to true. */
  auth?: boolean;
  /** Internal: set to false on the retry-after-refresh attempt to cap it at one retry. */
  _isRetry?: boolean;
}

/**
 * Thin fetch wrapper. Every authenticated request that comes back 401 triggers a
 * single coordinated refresh (see refreshCoordinator.ts) and is retried exactly once;
 * if the refresh itself fails, the caller gets an ApiError(401) so the UI can send the
 * user back to sign-in without ever rendering a blank screen from an uncaught rejection.
 */
export function createHttpClient(deps: HttpClientDeps) {
  const doFetch = deps.fetchImpl ?? fetch;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true, _isRetry = false, headers, ...init } = options;
    const finalHeaders = new Headers(headers);
    if (init.body && !finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    if (auth) {
      const token = deps.getAccessToken();
      if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
    }

    const response = await doFetch(`${deps.baseUrl}${path}`, { ...init, headers: finalHeaders });

    if (response.status === 401 && auth && !_isRetry) {
      const refreshed = await deps.refreshCoordinator.refresh();
      if (refreshed) {
        return request<T>(path, { ...options, _isRetry: true });
      }
      throw new ApiError(401, 'Session expired');
    }

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return { request };
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // response wasn't JSON (e.g. /http/500 returns an empty or plain body) -- fall through
  }
  return `Request failed with status ${response.status}`;
}
