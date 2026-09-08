import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/ui/AsyncState';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Gate at the route level, not the API level -- DummyJSON's /products endpoints don't
 * actually require a token (verified while designing this; only /auth/me does), so
 * "sign in before you can see stock" is a product decision we enforce ourselves, not
 * something the mock backend does for us. See README "mock API limitations".
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return <LoadingState label="Checking your session…" />;
  }

  if (status === 'unauthenticated') {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
  }

  return <>{children}</>;
}
