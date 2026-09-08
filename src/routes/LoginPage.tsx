import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useAuth } from '../lib/auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './LoginPage.css';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { status, login, sessionExpiredNotice, dismissSessionExpiredNotice } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [username, setUsername] = useState('emilys');
  const [password, setPassword] = useState('emilyspass');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === 'authenticated') {
    const from = searchParams.get('from') ?? '/stock';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      const from = searchParams.get('from') ?? '/stock';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Clinic stock console</h1>
        <p className="login-card__subtitle">Sign in to view and correct stock.</p>

        {sessionExpiredNotice && (
          <p className="login-card__notice" role="status">
            Your session expired. Sign in again to pick up where you left off.
            <Button variant="ghost" onClick={dismissSessionExpiredNotice} style={{ marginLeft: 8 }}>
              Dismiss
            </Button>
          </p>
        )}

        {error && (
          <p className="login-card__error" role="alert">
            {error}
          </p>
        )}

        <form className="stack" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <p className="login-card__hint">
          Demo credentials from DummyJSON are pre-filled (<code>emilys</code> /{' '}
          <code>emilyspass</code>). Any user from dummyjson.com/users works.
        </p>
      </div>
    </main>
  );
}
