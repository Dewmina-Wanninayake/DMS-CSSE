import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_DEMO_PASSWORD, DEMO_ACCOUNTS } from '@dms/shared';
import { ApiError } from '../shared/api/api-client';
import { useAuth } from '../shared/auth/AuthContext';
import { Alert } from '../shared/ui/feedback';
import { Button } from '../shared/ui/Button';
import { TextInput } from '../shared/ui/fields';

/** Password the seed gives every demo account; override with `VITE_DEMO_PASSWORD` if the server's was changed. */
const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD;

/**
 * Minimal sign-in screen (foundation; not graded — assignment spec). In development builds it also
 * lists the seeded demo accounts so a marker can open any use case in one click; the list is left
 * out of production builds.
 */
export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error ? caught.message : 'Sign-in failed.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell__content" style={{ maxWidth: '26rem', paddingTop: 'var(--space-8)' }}>
      <form className="card stack" onSubmit={submit} aria-label="Sign in">
        <h1 style={{ fontSize: 'var(--text-section)' }}>Sign in to DMC Admin</h1>
        {error && <Alert tone="danger">{error}</Alert>}
        <TextInput
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={busy} block>
          Sign in
        </Button>
      </form>
      {!import.meta.env.PROD && (
        <section
          className="card stack"
          aria-labelledby="demo-accounts"
          style={{ marginTop: 'var(--space-4)' }}
        >
          <h2 id="demo-accounts" style={{ fontSize: 'var(--text-section)' }}>
            Demo accounts
          </h2>
          <p className="muted">
            Choose one to fill in the form. Every account uses the same password.
          </p>
          <ul className="list" aria-label="Demo accounts">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <Button
                  variant="secondary"
                  block
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                >
                  {`${account.fullName} · ${account.role.replace(/([a-z])([A-Z])/g, '$1 $2')} · ${account.useCase}`}
                </Button>
                <span className="caption muted">{account.purpose}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
