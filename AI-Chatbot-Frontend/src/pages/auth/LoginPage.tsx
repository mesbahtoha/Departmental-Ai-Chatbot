import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaRobot } from 'react-icons/fa';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const loginAdmin = useAuthStore((s) => s.loginAdmin);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: string } | null)?.from;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = adminMode ? await loginAdmin(email, password) : await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(from ?? (adminMode ? '/admin' : '/chat'), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '70vh', padding: '32px 20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
        <div className="text-center mb-4">
          <div
            className="flex items-center justify-center mx-auto"
            style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-primary)', color: '#fff', fontSize: 26, marginBottom: 14 }}
          >
            <FaRobot />
          </div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Welcome back</h1>
          <p className="text-sm text-muted" style={{ margin: '6px 0 0' }}>Log in to continue chatting</p>
        </div>

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
          <Field label="Password">
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={adminMode}
                onChange={(e) => setAdminMode(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Sign in as administrator
            </label>
            <Link to="/forgot-password" className="text-sm">Forgot password?</Link>
          </div>

          {error && (
            <div className="card" style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', marginBottom: 14 }}>
              <span className="text-sm text-danger">{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Log in
          </Button>
        </form>

        <p className="text-sm text-center text-muted mt-4" style={{ marginBottom: 0 }}>
          No account?{' '}
          <Link to="/register" className="font-semibold">Create one</Link>
        </p>
      </div>
    </div>
  );
}
