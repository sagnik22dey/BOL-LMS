import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';

const getInitials = (name) => {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase()).slice(0, 2).join('');
};

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
};

const CommentSection = ({ moduleId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const isMounted = useRef(true);

  const connectWs = useCallback(() => {
    if (!moduleId) return;
    const token = localStorage.getItem('token');

    // VITE_WS_URL should be set on Railway to the API service's public URL
    // e.g.  VITE_WS_URL=https://api-xxx.up.railway.app
    // When unset (docker-compose / same-origin nginx proxy) fall back to the
    // current page's host so relative WebSocket paths work correctly.
    const apiBase = import.meta.env.VITE_WS_URL || '';
    let wsUrl;
    if (apiBase) {
      // Strip trailing slash then convert http(s) → ws(s)
      const normalised = apiBase.replace(/\/$/, '');
      const wsBase = normalised.replace(/^http/, 'ws');
      wsUrl = `${wsBase}/ws/comments/${moduleId}${token ? `?token=${token}` : ''}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws/comments/${moduleId}${token ? `?token=${token}` : ''}`;
    }

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'new_comment') {
          const comment = message.data;
          setComments((prev) => {
            if (prev.some((c) => c.id === comment.id)) return prev;
            return [...prev, comment];
          });
        }
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    socket.onclose = () => {
      if (!isMounted.current) return;
      reconnectTimer.current = setTimeout(() => {
        if (isMounted.current) connectWs();
      }, 3000);
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      socket.close();
    };
  }, [moduleId]);

  useEffect(() => {
    isMounted.current = true;

    const fetchComments = async () => {
      try {
        const response = await api.get(`/api/courses/modules/${moduleId}/comments`);
        setComments(response.data || []);
      } catch (err) {
        console.error('Failed to fetch comments:', err);
        setComments([]);
      }
    };

    fetchComments();
    connectWs();

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [moduleId, connectWs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.post(`/api/courses/modules/${moduleId}/comments`, { text: newComment });
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  return (
    <div className="mt-6">
      <h4 className="font-bold text-base text-[var(--text-primary)] mb-4 font-headline">Comments</h4>

      <div className="bg-[var(--surface-lowest)] rounded-2xl border border-[var(--outline)] p-4 mb-5 shadow-[var(--shadow-sm)]">
        <form onSubmit={handleSubmit}>
          <textarea
            rows={2}
            placeholder="Add a comment…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all resize-none mb-2"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Post Comment
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-0">
        {comments.length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] text-sm py-6">No comments yet. Start the conversation!</p>
        ) : (
          comments.map((comment, index) => (
            <div key={comment.id || index}>
              <div className="flex items-start gap-3 py-3.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: stringToColor(comment.user_name || 'user') }}
                  title={comment.user_name || 'Unknown User'}
                >
                  {getInitials(comment.user_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{comment.user_name || 'Unknown User'}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{comment.text}</p>
                </div>
              </div>
              {index < comments.length - 1 && <div className="border-t border-[var(--outline)]" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentSection;
