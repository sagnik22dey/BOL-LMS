import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import useNotificationStore from '../../store/notificationStore';

const TYPE_CONFIG = {
  success: { icon: 'check_circle', bg: 'bg-green-50', color: 'text-green-600', border: 'border-green-200' },
  warning: { icon: 'warning',      bg: 'bg-orange-50', color: 'text-orange-500', border: 'border-orange-200' },
  info:    { icon: 'info',         bg: 'bg-blue-50',  color: 'text-blue-600',  border: 'border-blue-200'  },
};

const CATEGORY_META = {
  course_assignment: { label: 'Course Assignment', icon: 'school' },
  purchase:          { label: 'Purchase',          icon: 'shopping_bag' },
  general:           { label: 'General',           icon: 'campaign' },
};

const NotificationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchById, markRead } = useNotificationStore();

  const [notif, setNotif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const data = await fetchById(id);
      if (!mounted) return;
      if (!data) {
        setError('Notification not found or you do not have access.');
      } else {
        setNotif(data);
        // Auto-mark as read when opened
        if (!data.is_read) {
          await markRead(data.id);
          setNotif((prev) => prev ? { ...prev, is_read: true } : prev);
        }
      }
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [id, fetchById, markRead]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !notif) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <span className="material-symbols-outlined text-5xl text-gray-300 block mb-4">notifications_off</span>
        <p className="text-lg font-bold text-gray-700 mb-2">Notification Not Found</p>
        <p className="text-sm text-gray-500 mb-6">{error || 'This notification does not exist.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const tConf = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
  const catMeta = CATEGORY_META[notif.category] || CATEGORY_META.general;
  const formattedDate = new Date(notif.created_at).toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // Build relevant action link
  let actionLink = null;
  if (notif.related_entity_type === 'course' && notif.related_entity_id) {
    actionLink = { label: 'View Course', path: `/dashboard/courses` };
  } else if (notif.related_entity_type === 'order' && notif.related_entity_id) {
    actionLink = { label: 'Go to My Learning', path: `/dashboard/learning` };
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-on-surface-variant">
        <RouterLink to="/dashboard" className="hover:text-primary transition-colors">Dashboard</RouterLink>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <RouterLink to="/dashboard/notifications" className="hover:text-primary transition-colors">Notifications</RouterLink>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-medium truncate max-w-[180px]">{notif.title}</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Top colour band */}
        <div className={`h-1.5 w-full ${tConf.bg.replace('bg-', 'bg-').replace('-50', '-400')}`} />

        <div className="p-6 md:p-8">
          {/* Category & type badge row */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${tConf.bg} ${tConf.color} ${tConf.border}`}>
              <span className="material-symbols-outlined text-sm">{tConf.icon}</span>
              {notif.type.charAt(0).toUpperCase() + notif.type.slice(1)}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
              <span className="material-symbols-outlined text-sm">{catMeta.icon}</span>
              {catMeta.label}
            </span>
            {!notif.is_read && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                Unread
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-extrabold font-headline text-gray-900 mb-2 tracking-tight" style={{ letterSpacing: '-0.5px' }}>
            {notif.title}
          </h1>

          {/* Timestamp */}
          <p className="text-xs text-gray-400 font-medium mb-6 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {formattedDate}
          </p>

          {/* Divider */}
          <div className="h-px bg-gray-100 mb-6" />

          {/* Full message body */}
          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mb-8">
            {notif.message}
          </div>

          {/* Related entity meta */}
          {notif.related_entity_type && notif.related_entity_id && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-xs text-gray-500 border border-gray-100">
              <span className="material-symbols-outlined text-sm text-gray-400">link</span>
              <span className="font-medium capitalize">{notif.related_entity_type.replace('_', ' ')} ID:</span>
              <span className="font-mono text-gray-600 truncate">{notif.related_entity_id}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {actionLink && (
              <RouterLink
                to={actionLink.path}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                {actionLink.label}
              </RouterLink>
            )}
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetail;
