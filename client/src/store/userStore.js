import { create } from 'zustand';
import api from '../api/axios';

export const useUserStore = create((set) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async (role) => {
    set({ loading: true, error: null });
    try {
      const endpoint = role === 'super_admin' ? '/api/admin/super/users' : '/api/admin/users';
      const response = await api.get(endpoint);
      set({ users: response.data || [], loading: false });
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Failed to fetch users', 
        loading: false 
      });
    }
  },

  createAdmin: async (adminData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/admin/super/admins', adminData);
      set(state => ({ 
        users: [...state.users, response.data],
        loading: false 
      }));
      return true;
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Failed to create admin', 
        loading: false 
      });
      return false;
    }
  },

  createUser: async (userData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/admin/users', userData);
      set(state => ({ 
        users: [...state.users, response.data],
        loading: false 
      }));
      return true;
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Failed to create user', 
        loading: false 
      });
      return false;
    }
  },

  deleteUser: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/manage/users/${id}`);
      set(state => ({
        users: state.users.filter(u => u.id !== id),
        loading: false
      }));
      return true;
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Failed to delete user', 
        loading: false 
      });
      return false;
    }
  },

  suspendUser: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.patch(`/api/admin/manage/users/${id}/suspend`);
      set(state => ({
        users: state.users.map(u => 
          u.id === id ? { ...u, is_suspended: !u.is_suspended } : u
        ),
        loading: false
      }));
      return true;
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Failed to toggle suspension', 
        loading: false 
      });
      return false;
    }
  }
}));
