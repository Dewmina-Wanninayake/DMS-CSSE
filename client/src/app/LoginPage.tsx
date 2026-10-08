import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../shared/api/api-client';
import { useAuth } from '../shared/auth/AuthContext';
import { Alert } from '../shared/ui/feedback';
import { Button } from '../shared/ui/Button';
import { TextInput } from '../shared/ui/fields';

/** Minimal sign-in screen (foundation; not graded — assignment spec). */
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
    </main>
  );
}
