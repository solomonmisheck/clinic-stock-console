import type { Tokens } from './refreshCoordinator';

/**
 * Tiny pub/sub bridging the framework-agnostic api/auth layer back to React state.
 * The http client and refresh coordinator are plain modules (easy to unit test
 * without React); AuthContext subscribes to these events to keep its state and the
 * proactive refresh timer in sync with token changes that can originate from a
 * reactive 401 retry, not just from calling login()/logout() directly.
 */

type TokensListener = (tokens: Tokens) => void;
type VoidListener = () => void;

const tokensRefreshedListeners = new Set<TokensListener>();
const sessionExpiredListeners = new Set<VoidListener>();

export function onTokensRefreshed(listener: TokensListener): () => void {
  tokensRefreshedListeners.add(listener);
  return () => tokensRefreshedListeners.delete(listener);
}

export function emitTokensRefreshed(tokens: Tokens): void {
  tokensRefreshedListeners.forEach((listener) => listener(tokens));
}

export function onSessionExpired(listener: VoidListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

export function emitSessionExpired(): void {
  sessionExpiredListeners.forEach((listener) => listener());
}
