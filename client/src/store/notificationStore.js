import { create } from 'zustand';
import api from '../api/axios';

const POLL_INTERVAL_MS = 30_000; // 30-second polling for unread count

const useNotificationStore = create((set, get) => ({
  // Per-user event notifications
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  // Popup open state
  popupOpen: false,
  setPopupOpen: (open) => set({ popupOpen: open }),
  togglePopup: () => set((s) => ({ popupOpen: !s.popupOpen })),

  // Fetch all my notifications
  fetchNotifications: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/api/notifications/my');
      const list = Array.isArray(res.data) ? res.data : [];
      const unread = list.filter((n) => !n.is_read).length;
      set({ notifications: list, unreadCount: unread, loading: false });
    } catch {
      set({ error: 'Failed to load notifications', loading: false });
    }
  },

  // Fetch only the unread count (lightweight, used by poller)
  fetchUnreadCount: async () => {
    try {
      const res = await api.get('/api/notifications/unread-count');
      set({ unreadCount: res.data?.unread_count ?? 0 });
    } catch {
      // Silently ignore polling errors
    }
  },

  // Mark a single notification as read
  markRead: async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      set((s) => {
        const notifications = s.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        );
        return {
          notifications,
          unreadCount: Math.max(0, notifications.filter((n) => !n.is_read).length),
        };
      });
    } catch {
      // ignore
    }
  },

  // Mark all as read
  markAllRead: async () => {
    try {
      await api.post('/api/notifications/mark-all-read');
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {
      // ignore
    }
  },

  // Fetch a single notification (for detail page)
  fetchById: async (id) => {
    try {
      const res = await api.get(`/api/notifications/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  // ── Polling ───────────────────────────────────────────────────────────────
  _pollTimer: null,

  startPolling: () => {
    const store = get();
    if (store._pollTimer) return; // already running
    // Initial fetch
    get().fetchUnreadCount();
    const timer = setInterval(() => {
      get().fetchUnreadCount();
    }, POLL_INTERVAL_MS);
    set({ _pollTimer: timer });
  },

  stopPolling: () => {
    const { _pollTimer } = get();
    if (_pollTimer) {
      clearInterval(_pollTimer);
      set({ _pollTimer: null });
    }
  },
}));

export default useNotificationStore;
