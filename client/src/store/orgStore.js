import { create } from 'zustand';
import api from '../api/axios';

export const useOrgStore = create((set, get) => ({
  orgs: [],
  unassignedUsers: [],
  loading: false,
  error: null,

  fetchOrgs: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/admin/super/organizations');
      set({ orgs: response.data || [], loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch organizations', loading: false });
    }
  },

  createOrg: async (orgData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/admin/super/organizations', orgData);
      set({ orgs: [...get().orgs, response.data], loading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to create organization', loading: false });
      return false;
    }
  },

  fetchUnassignedUsers: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/admin/super/users/unassigned');
      set({ unassignedUsers: response.data || [], loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch unassigned users', loading: false });
    }
  },

  updateOrg: async (id, orgData) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/api/admin/super/organizations/${id}`, orgData);
      set({ 
        orgs: get().orgs.map(org => org.id === id ? { ...org, ...orgData } : org), 
        loading: false 
      });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to update organization', loading: false });
      return false;
    }
  },

  assignUserToOrg: async (orgId, userId, role) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/api/admin/super/organizations/${orgId}/assign-user`, { user_id: userId, role });
      set({ 
        unassignedUsers: get().unassignedUsers.filter(u => u.id !== userId),
        loading: false 
      });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to assign user', loading: false });
      return false;
    }
  },

  fetchMyOrg: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/auth/organizations/my');
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch organization', loading: false });
      return null;
    }
  },
}));
