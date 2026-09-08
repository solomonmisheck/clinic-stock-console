import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth/AuthContext';

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the main landmark on every client-side navigation. Skipped on the
  // very first render so we don't steal focus from wherever the browser/user already
  // put it on initial load.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <p className="app-header__brand">
          <Link to="/stock" style={{ color: 'inherit', textDecoration: 'none' }}>
            Clinic stock console
          </Link>
        </p>
        {user && (
          <div className="app-header__user">
            <span>
              Signed in as {user.firstName} {user.lastName}
            </span>
            <Button variant="secondary" onClick={logout}>
              Sign out
            </Button>
          </div>
        )}
      </header>
      <main id="main-content" className="app-main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
    </div>
  );
}
