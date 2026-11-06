import { create } from 'zustand';

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  schoolId: string | null;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unread: number;
  status: 'idle' | 'loading' | 'ready';
  lastEvent: AppNotification | null;
  setNotifications: (list: AppNotification[]) => void;
  setUnread: (count: number) => void;
  setStatus: (status: NotificationState['status']) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unread: 0,
  status: 'idle',
  lastEvent: null,
  setNotifications: (notifications) => set({ notifications }),
  setUnread: (unread) => set({ unread }),
  setStatus: (status) => set({ status }),
  markRead: (id) => {
    const target = get().notifications.find((item) => item._id === id);
    if (target && !target.readAt) {
      set({
        notifications: get().notifications.map((item) =>
          item._id === id ? { ...item, readAt: new Date().toISOString() } : item
        ),
        unread: Math.max(0, get().unread - 1),
      });
    }
  },
  markAllRead: () => {
    const now = new Date().toISOString();
    set((state) => ({
      notifications: state.notifications.map((item) => (item.readAt ? item : { ...item, readAt: now })),
      unread: 0,
    }));
  },
  clear: () => set({ notifications: [], unread: 0, status: 'idle', lastEvent: null }),
}));
