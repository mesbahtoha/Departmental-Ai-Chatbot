import { useEffect } from 'react';
import { useNotificationStore } from '@/store/notification.store';
import { API_BASE_URL, apiGet, tokenStore } from '@/lib/api';
import type { AppNotification } from '@/store/notification.store';

const RECONNECT_DELAY_MS = 5000;

/**
 * Real-time notification stream (Server-Sent Events) + polling fallback.
 *
 * - Subscribes to `user:<id>` events pushed by the backend notification bus.
 * - Falls back to polling the notifications list + unread count when SSE is
 *   unavailable (serverless proxies, blocked ports, offline mode, ...).
 */
export function useNotifications(userId: string | undefined) {
  const notifications = useNotificationStore((s) => s.notifications);
  const unread = useNotificationStore((s) => s.unread);
  const status = useNotificationStore((s) => s.status);
  const lastEvent = useNotificationStore((s) => s.lastEvent);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const setUnread = useNotificationStore((s) => s.setUnread);
  const setStatus = useNotificationStore((s) => s.setStatus);

  useEffect(() => {
    if (!userId) {
      setStatus('idle');
      return;
    }

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const poll = async () => {
      try {
        const [listPayload, countPayload] = await Promise.all([
          apiGet<{ notifications: AppNotification[]; unread: number }>('/api/v1/notifications?limit=30'),
          apiGet<{ unread: number }>('/api/v1/notifications/unread-count'),
        ]);
        if (disposed) return;
        setNotifications(listPayload.notifications ?? []);
        setUnread(countPayload.unread ?? listPayload.unread ?? 0);
        setStatus('ready');
      } catch {
        // ignore polling errors
      }
    };

    const connect = () => {
      if (disposed) return;
      const token = tokenStore.access;
      const url = `${API_BASE_URL}/api/v1/notifications/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const es = new EventSource(url);
      source = es;

      es.addEventListener('ready', () => {
        if (!disposed) setStatus('ready');
      });

      es.addEventListener('notification', (event: MessageEvent) => {
        if (disposed) return;
        try {
          const payload = JSON.parse(event.data) as AppNotification;
          if (!payload || !payload._id) return;
          const current = useNotificationStore.getState();
          useNotificationStore.setState({
            lastEvent: payload,
            notifications: [
              payload,
              ...current.notifications.filter((item) => item._id !== payload._id),
            ].slice(0, 50),
            unread: payload.readAt ? current.unread : current.unread + 1,
          });
          setStatus('ready');
        } catch {
          // ignore malformed frames
        }
      });

      es.onerror = () => {
        es.close();
        if (source === es) source = null;
        if (disposed) return;
        retryTimer = setTimeout(() => {
          if (!disposed) connect();
        }, RECONNECT_DELAY_MS);
      };
    };

    connect();
    void poll();

    const interval = setInterval(() => {
      if (source) return; // live via SSE; no polling needed while connected
      void poll();
    }, 30000);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(interval);
      source?.close();
    };
  }, [userId, setNotifications, setUnread, setStatus]);

  return { notifications, unread, status, lastEvent, markRead, markAllRead };
}
