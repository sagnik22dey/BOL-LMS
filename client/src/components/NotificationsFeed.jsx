import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const TYPE_CONFIG = {
  warning: { icon: 'warning', bg: '#fff3e0', color: '#e65100' },
  success: { icon: 'check_circle', bg: '#e6f4ea', color: '#1e7e34' },
  info: { icon: 'info', bg: '#e8f0fe', color: '#1565c0' },
};

const inputClass = "w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all";

const NotificationsFeed = () => {
  const { token, user } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [newNotif, setNewNotif] = useState({ title: '', message: '', type: 'info' });
  const [creating, setCreating] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:8080/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(res.data);
      setError(null);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchNotifications(); }, [token]);

  const handleCreate = async () => {
    try {
      setCreating(true);
      await axios.post('http://localhost:8080/api/admin/manage/notifications', newNotif, { headers: { Authorization: `Bearer ${token}` } });
      setOpen(false);
      setNewNotif({ title: '', message: '', type: 'info' });
      fetchNotifications();
    } catch {
      alert('Failed to create notification');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-sm)] h-full flex flex-col">
        <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b border-[var(--outline)]">
          <div>
            <h3 className="font-bold text-base text-[var(--text-primary)]" style={{ letterSpacing: '-0.3px' }}>Announcements</h3>
            <p className="text-xs text-[var(--text-secondary)]">Latest platform updates</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-dark)] transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto max-h-[420px]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="w-7 h-7 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="m-3 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">
              <span className="material-symbols-outlined text-4xl opacity-20 block mb-2">notifications</span>
              <p className="text-sm">No announcements yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--outline)]">
              {notifications.map((notif) => {
                const conf = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                return (
                  <div key={notif.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--surface)] transition-colors">
                    <div className="p-1.5 rounded-lg flex-shrink-0 mt-0.5" style={{ backgroundColor: conf.bg, color: conf.color }}>
                      <span className="material-symbols-outlined text-base">{conf.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-0.5">
                        <span className="text-sm font-bold text-[var(--text-primary)] truncate">{notif.title}</span>
                        <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{new Date(notif.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Notification Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline)]">
              <h3 className="font-bold text-lg text-[var(--text-primary)] font-headline">New Announcement</h3>
              <button onClick={() => setOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[var(--text-primary)]">Title</label>
                <input required className={inputClass} placeholder="Announcement title" value={newNotif.title} onChange={(e) => setNewNotif({ ...newNotif, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[var(--text-primary)]">Message</label>
                <textarea required rows={3} className={inputClass + ' resize-none'} placeholder="Write your message…" value={newNotif.message} onChange={(e) => setNewNotif({ ...newNotif, message: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[var(--text-primary)]">Type</label>
                <select className={inputClass} value={newNotif.type} onChange={(e) => setNewNotif({ ...newNotif, type: e.target.value })}>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-high)] transition-colors">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!newNotif.title || !newNotif.message || creating}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60"
                >
                  {creating ? 'Broadcasting…' : 'Broadcast'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationsFeed;
