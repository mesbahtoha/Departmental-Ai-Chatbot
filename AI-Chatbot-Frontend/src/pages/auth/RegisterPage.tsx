import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaRobot } from 'react-icons/fa';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';

export function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
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
      const user = await register(name, email, password);
      toast.success(`Welcome, ${user.name}!`);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '70vh', padding: '32px 20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
        <div className="text-center mb-4">
          <div
            className="flex items-center justify-center mx-auto"
            style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-primary)', color: '#fff', fontSize: 26, marginBottom: 14 }}
          >
            <FaRobot />
          </div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Create your account</h1>
          <p className="text-sm text-muted" style={{ margin: '6px 0 0' }}>Start chatting in under a minute</p>
        </div>

        <form onSubmit={(e) => void submit(e)}>
          <Field label="Full name">
            <Input
              required
              minLength={2}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </Field>
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
          <Field label="Password" hint="At least 8 characters">
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
          <Field label="Confirm password">
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <div className="card" style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', marginBottom: 14 }}>
              <span className="text-sm text-danger">{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>

        <p className="text-sm text-center text-muted mt-4" style={{ marginBottom: 0 }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold">Log in</Link>
        </p>
      </div>
    </div>
  );
}
