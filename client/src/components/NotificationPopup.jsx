import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../store/notificationStore';

const TYPE_ICON = {
  success: { icon: 'check_circle', color: 'text-green-600', bg: 'bg-green-50' },
  warning: { icon: 'warning', color: 'text-orange-500', bg: 'bg-orange-50' },
  info:    { icon: 'info',    color: 'text-blue-600',  bg: 'bg-blue-50'   },
};

const CATEGORY_LABEL = {
  course_assignment: 'Course',
  purchase:         'Purchase',
  general:          'General',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const NotificationPopup = ({ onClose }) => {
  const navigate = useNavigate();
  const popupRef = useRef(null);
  const {
    notifications,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    unreadCount,
  } = useNotificationStore();

  // Fetch fresh list each time popup opens
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      await markRead(notif.id);
    }
    onClose();
    navigate(`/dashboard/notifications/${notif.id}`);
  };

  const handleMarkRead = async (e, notif) => {
    e.stopPropagation();
    await markRead(notif.id);
  };

  return (
    <div
      ref={popupRef}
      className="absolute top-12 right-0 z-[200] w-[360px] max-w-[95vw] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-[fadeInDown_0.15s_ease-out]"
      style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.18)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">notifications</span>
          <span className="font-bold text-sm text-gray-900 font-headline">Notifications</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] font-bold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="material-symbols-outlined text-gray-400 hover:text-gray-600 text-lg p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            close
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto max-h-[380px]">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">notifications_off</span>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((notif) => {
              const tConf = TYPE_ICON[notif.type] || TYPE_ICON.info;
              const isUnread = !notif.is_read;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group
                    ${isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-gray-50'}`}
                >
                  {/* Unread dot */}
                  <div className="flex-shrink-0 mt-1.5">
                    {isUnread ? (
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-transparent inline-block" />
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`flex-shrink-0 p-1.5 rounded-lg ${tConf.bg}`}>
                    <span className={`material-symbols-outlined text-base ${tConf.color}`}>
                      {tConf.icon}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-sm leading-snug truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {notif.short_summary}
                    </p>
                    {notif.category && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1">
                        {CATEGORY_LABEL[notif.category] || notif.category}
                      </span>
                    )}
                  </div>

                  {/* Mark read button (only for unread) */}
                  {isUnread && (
                    <button
                      onClick={(e) => handleMarkRead(e, notif)}
                      title="Mark as read"
                      className="flex-shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-100 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm text-blue-500">done</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/40">
          <button
            onClick={() => { onClose(); navigate('/dashboard/notifications'); }}
            className="w-full text-center text-xs font-bold text-primary hover:underline py-1"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPopup;
