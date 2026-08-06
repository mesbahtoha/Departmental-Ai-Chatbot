import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiPost, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost('/api/v1/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh', padding: 24 }}>
        <div className="card text-center" style={{ maxWidth: 440, padding: 36 }}>
          <div style={{ fontSize: 42 }}>📬</div>
          <h2 style={{ fontSize: 20 }}>Check your inbox</h2>
          <p className="text-sm text-muted">
            If an account exists for <strong>{email}</strong>, a password reset link has been sent.
            The link is valid for 1 hour.
          </p>
          <Link to="/login" className="btn btn-primary mt-3" style={{ display: 'inline-flex' }}>
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh', padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 32 }}>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Reset your password</h1>
        <p className="text-sm text-muted" style={{ marginTop: 0 }}>
          Enter your account email and we'll send you a reset link.
        </p>
        <form onSubmit={(e) => void submit(e)}>
          <Field label="Email">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </form>
        <p className="text-sm text-center mt-4">
          <Link to="/login">← Back to login</Link>
        </p>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiPost('/api/v1/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh', padding: 24 }}>
        <div className="card text-center" style={{ maxWidth: 420, padding: 32 }}>
          <h2 style={{ fontSize: 20 }}>Invalid reset link</h2>
          <p className="text-sm text-muted">This link is missing the reset token.</p>
          <Link to="/forgot-password" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh', padding: 24 }}>
        <div className="card text-center" style={{ maxWidth: 420, padding: 32 }}>
          <div style={{ fontSize: 42 }}>✅</div>
          <h2 style={{ fontSize: 20 }}>Password updated</h2>
          <p className="text-sm text-muted">You can now log in with your new password.</p>
          <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh', padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 32 }}>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Set a new password</h1>
        <form onSubmit={(e) => void submit(e)}>
          <Field label="New password" hint="At least 8 characters">
            <Input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Reset password
          </Button>
        </form>
      </div>
    </div>
  );
}
