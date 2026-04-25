import { create } from 'zustand';
import api from '../api/axios';

export const useOrgStore = create((set, get) => ({
  orgs: [],
  unassignedUsers: [],
  eligibleUsers: [],
  myOrg: null,
  adminOrgUsers: [],
  adminEligibleUsers: [],
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

  fetchEligibleUsers: async (search = '', role = 'user') => {
    try {
      const params = new URLSearchParams({ role, search });
      const res = await api.get(`/api/admin/super/users/eligible?${params}`);
      set({ eligibleUsers: res.data || [] });
    } catch (err) {
      set({ eligibleUsers: [] });
    }
  },

  bulkAssignUsersToOrg: async (orgId, userIds, role) => {
    const res = await api.post(`/api/admin/super/organizations/${orgId}/assign-user`, {
      user_ids: userIds,
      role,
    });
    // After successful assignment, remove assigned users from eligibleUsers
    const assigned = res.data.assigned || [];
    set((state) => ({
      eligibleUsers: state.eligibleUsers.filter((u) => !assigned.includes(u.id)),
    }));
    return res.data;
  },

  fetchMyOrg: async () => {
    // PERF: Avoid refetching if we already have it. DashboardLayout mounts on
    // every navigation and was hitting /api/auth/organizations/my repeatedly.
    const existing = get().myOrg;
    if (existing) return existing;
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/auth/organizations/my');
      set({ myOrg: response.data, loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch organization', loading: false });
      return null;
    }
  },

  fetchAdminOrgUsers: async () => {
    try {
      const res = await api.get('/api/admin/users');
      set({ adminOrgUsers: res.data || [] });
    } catch (err) {
      set({ adminOrgUsers: [] });
    }
  },

  fetchAdminEligibleUsers: async (search = '') => {
    try {
      const params = new URLSearchParams({ search });
      const res = await api.get(`/api/admin/users/eligible?${params}`);
      set({ adminEligibleUsers: res.data || [] });
    } catch (err) {
      set({ adminEligibleUsers: [] });
    }
  },

  adminBulkAssignUsers: async (userIds) => {
    const res = await api.post('/api/admin/organizations/assign-users', {
      user_ids: userIds,
    });
    const assigned = res.data.assigned || [];
    set((state) => ({
      adminEligibleUsers: state.adminEligibleUsers.filter((u) => !assigned.includes(u.id)),
      adminOrgUsers: [
        ...state.adminOrgUsers,
        ...state.adminEligibleUsers.filter((u) => assigned.includes(u.id)),
      ],
    }));
    return res.data;
  },
}));
