import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  MdChat,
  MdDashboard,
  MdDarkMode,
  MdLightMode,
  MdLogout,
  MdMessage,
  MdPeople,
  MdSettings,
  MdStickyNote2,
  MdToken,
  MdAnalytics,
  MdListAlt,
  MdMemory,
  MdMenu,
  MdClose,
} from 'react-icons/md';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { getStoredTheme, toggleTheme } from '@/lib/theme';
import { Avatar } from '@/components/ui/Avatar';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: MdDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: MdPeople },
  { to: '/admin/notices', label: 'Notices', icon: MdStickyNote2 },
  { to: '/admin/chats', label: 'Chat History', icon: MdMessage },
  { to: '/admin/analytics', label: 'Analytics', icon: MdAnalytics },
  { to: '/admin/tokens', label: 'Token Usage', icon: MdToken },
  { to: '/admin/settings', label: 'Settings', icon: MdSettings },
  { to: '/admin/prompt-templates', label: 'Prompt Templates', icon: MdListAlt },
  { to: '/admin/logs', label: 'System Logs', icon: MdMemory },
  { to: '/admin/system', label: 'System Info', icon: MdMemory },
];

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(getStoredTheme());

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebar = (
    <aside
      style={{
        width: 236,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-2" style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--color-primary)', fontSize: 22 }}><MdChat /></span>
        <div>
          <div className="font-bold" style={{ fontSize: 15 }}>NoticeFlow</div>
          <div className="text-xs text-muted">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto" style={{ padding: '10px 8px' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded ${isActive ? 'font-semibold' : ''}`
            }
            style={({ isActive }) => ({
              padding: '9px 12px',
              fontSize: 14,
              color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-active)' : 'transparent',
              marginBottom: 2,
            })}
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
        <NavLink
          to="/chat"
          className="flex items-center gap-2"
          style={{ padding: '8px 10px', fontSize: 13.5, color: 'var(--text-secondary)', borderRadius: 8 }}
        >
          <MdChat size={16} /> Back to chat app
        </NavLink>
      </div>

      <div className="flex items-center gap-2" style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
        <Avatar name={user?.name} size="sm" />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="text-sm font-semibold ellipsis">{user?.name}</div>
          <div className="text-xs text-muted ellipsis">{user?.email}</div>
        </div>
        <button className="btn btn-ghost btn-icon" title="Toggle theme" onClick={() => setTheme(toggleTheme())}>
          {theme === 'dark' ? <MdLightMode size={17} /> : <MdDarkMode size={17} />}
        </button>
        <button className="btn btn-ghost btn-icon" title="Logout" onClick={() => void handleLogout()}>
          <MdLogout size={17} />
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex app-height" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'none', height: '100%' }} className="admin-sidebar-desktop">
        {sidebar}
      </div>

      {open && (
        <div className="modal-overlay" style={{ zIndex: 900 }} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ height: '100%' }}>
            <div className="flex justify-end" style={{ padding: 8 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)}>
                <MdClose size={18} />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
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
            <button className="btn btn-ghost btn-icon admin-sidebar-toggle" onClick={() => setOpen(true)}>
              <MdMenu size={20} />
            </button>
            <span className="font-semibold" style={{ fontSize: 15 }}>Admin</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-body)', padding: 24 }}>
          <Outlet />
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .admin-sidebar-desktop { display: block !important; }
          .admin-sidebar-toggle { display: none; }
        }
      `}</style>
    </div>
  );
}
