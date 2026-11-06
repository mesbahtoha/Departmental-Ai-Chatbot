import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotifications } from 'react-icons/md';
import { useNotificationStore } from '@/store/notification.store';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/auth.store';

/** Bell button + dropdown list; SSE is wired up via useNotifications. */
export function NotificationBell() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const notifications = useNotificationStore((s) => s.notifications);
  const unread = useNotificationStore((s) => s.unread);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // Subscribe to the live stream + list/poll fallback.
  useNotifications(user?.id);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-icon"
        title="Notifications"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
      >
        <MdNotifications size={17} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: 'var(--color-danger)',
              color: '#fff',
              borderRadius: 999,
              fontSize: 10,
              minWidth: 15,
              height: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              fontWeight: 700,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div
            className="card"
            style={{ position: 'absolute', right: 0, top: 44, width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 50, padding: 12 }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span className="font-semibold" style={{ fontSize: 14 }}>Notifications</span>
              <button className="btn btn-ghost btn-sm" onClick={() => void markAllRead()}>
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted" style={{ padding: '12px 0', margin: 0 }}>
                You are all caught up.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  className="w-full text-left"
                  onClick={() => {
                    markRead(n._id);
                    if (n.link) navigate(n.link);
                    setOpen(false);
                  }}
                  style={{
                    display: 'block',
                    padding: '10px',
                    borderRadius: 8,
                    background: n.readAt ? 'transparent' : 'var(--bg-active)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>{n.message}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
