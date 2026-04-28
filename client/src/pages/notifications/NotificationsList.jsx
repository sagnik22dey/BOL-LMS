import { useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import useNotificationStore from '../../store/notificationStore';

const TYPE_CONFIG = {
  success: { icon: 'check_circle', bg: 'bg-green-50',  color: 'text-green-600'  },
  warning: { icon: 'warning',      bg: 'bg-orange-50', color: 'text-orange-500' },
  info:    { icon: 'info',         bg: 'bg-blue-50',   color: 'text-blue-600'   },
};

const CATEGORY_LABEL = {
  course_assignment: 'Course Assigned',
  purchase:          'Purchase',
  general:           'General',
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

const NotificationsList = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleItemClick = async (notif) => {
    if (!notif.is_read) await markRead(notif.id);
    navigate(`/dashboard/notifications/${notif.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-on-surface-variant">
        <RouterLink to="/dashboard" className="hover:text-primary transition-colors">Dashboard</RouterLink>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-medium">Notifications</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold font-headline text-gray-900 tracking-tight" style={{ letterSpacing: '-0.5px' }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold bg-red-500 text-white rounded-full min-w-[22px]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">All your notifications in one place</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-primary hover:bg-blue-50 transition-colors"
          >
            <span className="material-symbols-outlined text-base">done_all</span>
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <span className="material-symbols-outlined text-6xl mb-3 opacity-20">notifications_off</span>
            <p className="text-base font-bold text-gray-600">No notifications yet</p>
            <p className="text-sm text-gray-400 mt-1">You'll see course assignments and purchase updates here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((notif) => {
              const tConf = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
              const isUnread = !notif.is_read;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors group
                    ${isUnread ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'hover:bg-gray-50/60'}`}
                >
                  {/* Unread indicator */}
                  <div className="flex-shrink-0 mt-3">
                    {isUnread ? (
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full inline-block" />
                    )}
                  </div>

                  {/* Type icon */}
                  <div className={`flex-shrink-0 p-2 rounded-xl mt-0.5 ${tConf.bg}`}>
                    <span className={`material-symbols-outlined text-lg ${tConf.color}`}>
                      {tConf.icon}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm leading-snug ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                        {notif.title}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(notif.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {notif.short_summary || notif.message}
                    </p>
                    {notif.category && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1.5">
                        {CATEGORY_LABEL[notif.category] || notif.category}
                      </span>
                    )}
                  </div>

                  {/* Chevron */}
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-gray-500 mt-1 flex-shrink-0 transition-colors">
                    chevron_right
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsList;
