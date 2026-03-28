import { create } from 'zustand';
import api from '../api/axios';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
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
        loading: false 
      });
      return true;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Login failed', 
        loading: false 
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
        loading: false 
      });
      return true;
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Registration failed', 
        loading: false 
      });
      return false;
    }
  },

  fetchMe: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    set({ loading: true });
    try {
      const response = await api.get('/api/auth/me');
      set({ user: response.data, isAuthenticated: true, loading: false });
    } catch {
      // Token is invalid or expired
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },
}));
