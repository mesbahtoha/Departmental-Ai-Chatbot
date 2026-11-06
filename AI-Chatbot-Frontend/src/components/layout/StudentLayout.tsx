import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { MdHome, MdMenu, MdClose, MdChat, MdLogout } from 'react-icons/md';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { ThemeLangControls } from '@/components/ui/ThemeLangControls';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';

/** Learner-facing shell for the student portal (quizzes, results, tutor shortcuts). */
export function StudentLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('drawer-open', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex app-height" style={{ overflow: 'hidden' }}>
      <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
        <div
          className="flex items-center justify-between"
          style={{
            height: 52,
            padding: '0 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Open menu">
              <MdMenu size={20} />
            </button>
            <span className="font-semibold" style={{ fontSize: 15 }}>
              Shikhi Bondhu · Class {user?.classLevel ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeLangControls compact />
          </div>
        </div>

        <nav
          className="flex items-center gap-2"
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          <NavLink to="/student" end className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}>
            Home
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}>
            <MdChat size={14} /> AI Tutor
          </NavLink>
        </nav>

        <div className="flex-1 overflow-y-auto admin-content route-fade">
          <Outlet />
        </div>
      </div>

      {open && (
        <>
          <div className="drawer-overlay" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Student menu">
            <div className="drawer-head">
              <span className="font-semibold" style={{ fontSize: 15 }}>Student</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Close menu">
                <MdClose size={20} />
              </button>
            </div>
            <div style={{ padding: 12 }}>
              <NavLink to="/student" end className="flex items-center gap-2 rounded" style={({ isActive }) => ({ padding: '10px 12px', fontSize: 14, color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)' })}>
                <MdHome size={17} /> My learning
              </NavLink>
              <NavLink to="/chat" className="flex items-center gap-2 rounded" style={({ isActive }) => ({ padding: '10px 12px', fontSize: 14, color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)' })}>
                <MdChat size={17} /> AI Tutor
              </NavLink>
            </div>
            <div className="flex items-center gap-2" style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
              <Avatar name={user?.name} size="sm" />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="text-sm font-semibold ellipsis">{user?.name}</div>
                <div className="text-xs text-muted ellipsis">{user?.email}</div>
              </div>
              <ThemeLangControls compact />
              <button className="btn btn-ghost btn-icon" title="Logout" onClick={() => void handleLogout()}>
                <MdLogout size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
