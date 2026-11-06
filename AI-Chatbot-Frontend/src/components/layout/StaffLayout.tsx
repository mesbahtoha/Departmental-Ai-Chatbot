import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  MdDashboard,
  MdPeople,
  MdListAlt,
  MdChecklist,
  MdMessage,
  MdLogout,
  MdMenu,
  MdClose,
  MdChat,
  MdQuiz,
} from 'react-icons/md';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { ThemeLangControls } from '@/components/ui/ThemeLangControls';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';

interface NavItem {
  to: string;
  label: string;
  icon: typeof MdDashboard;
  end?: boolean;
}

function navFor(role: string | undefined): NavItem[] {
  if (role === 'teacher') {
    return [
      { to: '/teacher', label: 'Dashboard', icon: MdDashboard, end: true },
      { to: '/teacher/questions', label: 'Questions', icon: MdListAlt },
      { to: '/teacher/question-sets', label: 'Question Sets', icon: MdChecklist },
      { to: '/teacher/assessments', label: 'Assessments', icon: MdQuiz },
      { to: '/teacher/submissions', label: 'Submissions', icon: MdMessage },
    ];
  }
  // school_admin
  return [
    { to: '/school', label: 'Dashboard', icon: MdDashboard, end: true },
    { to: '/school/members', label: 'Members', icon: MdPeople },
    { to: '/school/questions', label: 'Questions', icon: MdListAlt },
    { to: '/school/assessments', label: 'Assessments', icon: MdChecklist },
  ];
}

export function StaffLayout() {
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

  const navItems = navFor(user?.role);

  const sidebar = (
    <aside
      style={{
        width: '100%',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div className="flex items-center gap-2" style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <span style={{ color: 'var(--color-primary)', fontSize: 22 }}><MdChat /></span>
        <div>
          <div className="font-bold" style={{ fontSize: 15 }}>NoticeFlow</div>
          <div className="text-xs text-muted">Staff Panel</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin" style={{ padding: '10px 8px', minHeight: 0 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `flex items-center gap-3 rounded ${isActive ? 'font-semibold' : ''}`}
            style={({ isActive }) => ({
              padding: '11px 12px',
              fontSize: 14,
              color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-active)' : 'transparent',
              marginBottom: 2,
            })}
            onClick={() => setOpen(false)}
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2" style={{ padding: 12, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <Avatar name={user?.name} size="sm" />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="text-sm font-semibold ellipsis">{user?.name}</div>
          <div className="text-xs text-muted ellipsis">{user?.email}</div>
          {user?.schoolName && <div className="text-xs text-muted ellipsis">{user.schoolName}</div>}
        </div>
        <ThemeLangControls compact />
        <button className="btn btn-ghost btn-icon" title="Logout" onClick={() => void handleLogout()}>
          <MdLogout size={17} />
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex app-height" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'none', height: '100%', width: 236, flexShrink: 0 }} className="admin-sidebar-desktop">
        {sidebar}
      </div>

      {open && (
        <>
          <div className="drawer-overlay" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Staff menu">
            <div className="drawer-head">
              <span className="font-semibold" style={{ fontSize: 15 }}>Staff</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Close menu">
                <MdClose size={20} />
              </button>
            </div>
            {sidebar}
          </div>
        </>
      )}

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
            <button className="btn btn-ghost btn-icon admin-sidebar-toggle" onClick={() => setOpen(true)} aria-label="Open menu">
              <MdMenu size={20} />
            </button>
            <span className="font-semibold" style={{ fontSize: 15 }}>Shikhi Staff</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeLangControls compact />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto admin-content route-fade">
          <Outlet />
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .admin-sidebar-desktop { display: block !important; }
          .admin-sidebar-toggle { display: none; }
        }
      `}</style>
    </div>
  );
}
