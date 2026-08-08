import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FaRobot } from 'react-icons/fa';
import { MdDarkMode, MdLightMode, MdMenu, MdClose } from 'react-icons/md';
import { getStoredTheme, toggleTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { useEffect, useState } from 'react';

export function PublicLayout() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getStoredTheme());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const close = () => setMenuOpen(false);

  const go = (path: string) => {
    close();
    navigate(path);
  };

  const primaryAction =
    status === 'authenticated' && user ? (
      <Button size="sm" onClick={() => go(user.role === 'admin' ? '/admin' : '/chat')}>
        Open app
      </Button>
    ) : (
      <Button size="sm" onClick={() => go('/register')}>
        Get started
      </Button>
    );

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <header
        className="public-header flex items-center justify-between"
        style={{ height: 64, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
      >
        <Link to="/" className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }} onClick={close}>
          <span style={{ color: 'var(--color-primary)', fontSize: 24 }}><FaRobot /></span>
          NoticeFlow
        </Link>

        <nav className="public-nav-desktop">
          <NavLink to="/" className="nav-link text-sm text-secondary" style={{ padding: '8px 12px', borderRadius: 8 }}>
            Home
          </NavLink>
          <NavLink to="/login" className="nav-link text-sm text-secondary" style={{ padding: '8px 12px', borderRadius: 8 }}>
            Login
          </NavLink>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setTheme(toggleTheme())}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <MdLightMode size={18} /> : <MdDarkMode size={18} />}
          </button>
          {primaryAction}
        </nav>

        <button
          className="btn btn-ghost btn-icon public-nav-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <MdClose size={20} /> : <MdMenu size={22} />}
        </button>

        <div className={`public-mobile-menu${menuOpen ? ' open' : ''}`}>
          <Link to="/" className="nav-link" onClick={close}>Home</Link>
          <Link to="/login" className="nav-link" onClick={close}>Login</Link>
          <button
            className="nav-link"
            onClick={() => setTheme(toggleTheme())}
          >
            {theme === 'dark' ? <MdLightMode size={18} /> : <MdDarkMode size={18} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <div className="mobile-menu-divider" />
          {primaryAction}
        </div>
      </header>
      <main className="flex-1 route-fade">
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
