import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchCurrentUser, login as loginRequest } from '../api/auth';
import { refreshCoordinator } from '../api/client';
import type { AuthUser } from '../../types';
import { onSessionExpired, onTokensRefreshed } from './authEvents';
import { msUntilExpiry } from './jwt';
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from './tokenStorage';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Set right after a forced logout so the login screen can explain why. */
  sessionExpiredNotice: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  dismissSessionExpiredNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Refresh a little before the access token actually lapses so an in-flight request
// never races the clock. Comfortable relative to a 60s test lifetime; on a longer
// production lifetime this constant would need to scale with it.
const REFRESH_BUFFER_MS = 8_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  // Computed up front (lazy initializer) rather than set from inside the bootstrap
  // effect below: if there's no token at all we already know the answer, so there's
  // no need for an effect-driven state transition just to say "unauthenticated".
  const [status, setStatus] = useState<AuthStatus>(() =>
    loadTokens() ? 'checking' : 'unauthenticated',
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleProactiveRefresh = useCallback((accessToken: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const remaining = msUntilExpiry(accessToken);
    if (remaining === null) return;
    const delay = Math.max(remaining - REFRESH_BUFFER_MS, 0);
    refreshTimer.current = setTimeout(() => {
      void refreshCoordinator.refresh();
    }, delay);
  }, []);

  const handleForcedLogout = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setUser(null);
    setStatus('unauthenticated');
    setSessionExpiredNotice(true);
  }, []);

  // Bootstrap from whatever is in storage, and subscribe to token/session events that
  // can originate from the reactive 401-retry path in httpClient, not just from calls
  // to login()/logout() below.
  useEffect(() => {
    const tokens = loadTokens();
    if (tokens) {
      scheduleProactiveRefresh(tokens.accessToken);
      fetchCurrentUser()
        .then((currentUser) => {
          setUser(currentUser);
          setStatus('authenticated');
        })
        .catch(() => {
          // refreshCoordinator's onFailure already cleared tokens and will emit
          // sessionExpired if the 401-retry in httpClient couldn't recover; if this
          // was some other transient error, fall back to unauthenticated rather than
          // leaving the app stuck on a "checking" screen forever.
          setStatus((current) => (current === 'checking' ? 'unauthenticated' : current));
        });
    }

    const unsubscribeExpired = onSessionExpired(handleForcedLogout);
    const unsubscribeRefreshed = onTokensRefreshed((tokens) => {
      scheduleProactiveRefresh(tokens.accessToken);
    });

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const stored = loadTokens();
      if (!stored) return;
      const remaining = msUntilExpiry(stored.accessToken);
      // A backgrounded tab can have its timers throttled by the browser; treat
      // becoming visible again as a backstop check rather than trusting the timer
      // fired on schedule.
      if (remaining !== null && remaining < REFRESH_BUFFER_MS) {
        void refreshCoordinator.refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribeExpired();
      unsubscribeRefreshed();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once at bootstrap
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await loginRequest(username, password);
      const tokens: StoredTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };
      saveTokens(tokens);
      setUser({
        id: response.id,
        username: response.username,
        email: response.email,
        firstName: response.firstName,
        lastName: response.lastName,
        image: response.image,
      });
      setSessionExpiredNotice(false);
      setStatus('authenticated');
      scheduleProactiveRefresh(tokens.accessToken);
    },
    [scheduleProactiveRefresh],
  );

  const logout = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    clearTokens();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const dismissSessionExpiredNotice = useCallback(() => setSessionExpiredNotice(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, sessionExpiredNotice, login, logout, dismissSessionExpiredNotice }),
    [status, user, sessionExpiredNotice, login, logout, dismissSessionExpiredNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
