import { create } from 'zustand';
import api from '../api/axios';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  // initializing = true means we haven't yet verified the token with the server.
  // It starts true only when a token exists in localStorage (i.e., a previous session).
  initializing: !!localStorage.getItem('token'),
  loading: false,
  error: null,

  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: !!token, error: null });
  },

  setUser: (user) => {
    set({ user });
  },

  loginUser: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
        initializing: false,
      });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Login failed',
        loading: false,
      });
      return false;
    }
  },

  registerUser: async (userData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/auth/register', userData);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
        initializing: false,
      });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Registration failed',
        loading: false,
      });
      return false;
    }
  },

  fetchMe: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ initializing: false });
      return;
    }

    set({ loading: true });
    try {
      const response = await api.get('/api/auth/me');
      set({
        user: response.data,
        isAuthenticated: true,
        loading: false,
        initializing: false,
      });
    } catch {
      // Token is invalid or expired — clear everything
      localStorage.removeItem('token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        initializing: false,
      });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
      initializing: false,
    });
    // PERF/correctness: clear cached per-user data in other stores so the next
    // user that logs in doesn't see stale info (and so fetchMyOrg actually
    // refetches instead of returning the cached object).
    Promise.all([
      import('./orgStore').then(({ useOrgStore }) =>
        useOrgStore.setState({ myOrg: null, orgs: [], adminOrgUsers: [], adminEligibleUsers: [], eligibleUsers: [], unassignedUsers: [] })
      ),
      import('./cartStore').then((m) =>
        (m.default || m.useCartStore).setState({ cart: { items: [] } })
      ),
    ]).catch(() => {});
  },
}));
