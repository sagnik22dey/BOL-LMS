import axios from 'axios';

const api = axios.create({
  // In production behind nginx proxy: VITE_API_URL should be set at build time
  // (e.g. https://api.yourdomain.com for Railway, or leave empty for docker-compose
  // where nginx proxies /api/* to the backend container).
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the JWT token to every outgoing request automatically.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired / revoked tokens globally.
// When the server returns 401 we clear the stored session so the user is
// cleanly redirected to login on the next navigation instead of being stuck
// in a broken authenticated-but-rejected state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Dynamically import to avoid a circular dependency at module load time.
      import('../store/authStore').then(({ useAuthStore }) => {
        const { logout } = useAuthStore.getState();
        logout();
        // Redirect to the login page if we're not already there.
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      });
    }
    return Promise.reject(error);
  }
);

export default api;
