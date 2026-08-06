import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FaRobot } from 'react-icons/fa';
import { MdDarkMode, MdLightMode } from 'react-icons/md';
import { getStoredTheme, toggleTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

export function PublicLayout() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getStoredTheme());

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <header
        className="flex items-center justify-between"
        style={{ padding: '0 28px', height: 64, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
      >
        <Link to="/" className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--color-primary)', fontSize: 24 }}><FaRobot /></span>
          NoticeFlow
        </Link>
        <nav className="flex items-center gap-4">
          <NavLink to="/" className="text-sm text-secondary">Home</NavLink>
          <NavLink to="/login" className="text-sm text-secondary">Login</NavLink>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setTheme(toggleTheme())}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <MdLightMode size={18} /> : <MdDarkMode size={18} />}
          </button>
          {status === 'authenticated' && user ? (
            <Button size="sm" onClick={() => navigate(user.role === 'admin' ? '/admin' : '/chat')}>
              Open app
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate('/register')}>
              Get started
            </Button>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer
        className="text-center text-sm text-muted"
        style={{ padding: '20px 0', borderTop: '1px solid var(--border-color)' }}
      >
        NoticeFlow · AI powered campus notice assistant
      </footer>
    </div>
  );
}
