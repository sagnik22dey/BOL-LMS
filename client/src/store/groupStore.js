import { create } from 'zustand';
import api from '../api/axios';

export const useGroupStore = create((set, get) => ({
  groups: [],
  loading: false,
  error: null,

  fetchGroups: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/admin/groups');
      set({ groups: response.data || [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch groups', loading: false });
    }
  },

  createGroup: async (groupData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/admin/groups', groupData);
      set((state) => ({
        groups: [...state.groups, response.data],
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to create group', loading: false });
      return false;
    }
  },

  updateGroup: async (id, groupData) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/api/admin/groups/${id}`, groupData);
      set((state) => ({
        groups: state.groups.map((g) => (g.id === id ? { ...g, ...groupData } : g)),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to update group', loading: false });
      return false;
    }
  },

  deleteGroup: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/groups/${id}`);
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== id),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to delete group', loading: false });
      return false;
    }
  },

  addUsersToGroup: async (id, userIds) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/api/admin/groups/${id}/users`, { user_ids: userIds });
      // Refetch full group for simplicity, or optimistically update
      await get().fetchGroups();
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to add users to group', loading: false });
      return false;
    }
  },

  removeUserFromGroup: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/groups/${id}/users/${userId}`);
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === id ? { ...g, user_ids: g.user_ids?.filter((uid) => uid !== userId) || [] } : g
        ),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to remove user from group', loading: false });
      return false;
    }
  },

  assignCoursesToGroup: async (id, courseIds) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/api/admin/groups/${id}/courses`, { course_ids: courseIds });
      await get().fetchGroups();
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to assign courses to group', loading: false });
      return false;
    }
  },

  removeCourseFromGroup: async (id, courseId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/groups/${id}/courses/${courseId}`);
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === id ? { ...g, course_ids: g.course_ids?.filter((cid) => cid !== courseId) || [] } : g
        ),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to remove course from group', loading: false });
      return false;
    }
  },

  assignCourseToUser: async (userId, courseIds) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/api/admin/users/${userId}/courses`, { course_ids: courseIds });
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to assign courses to user', loading: false });
      return false;
    }
  },

  revokeCourseFromUser: async (userId, courseId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/users/${userId}/courses/${courseId}`);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to revoke course from user', loading: false });
      return false;
    }
  },

  fetchUserIndividualCourses: async (userId) => {
    // don't set global loading true as it might interrupt UI elsewhere, but return data directly
    try {
      const response = await api.get(`/api/admin/users/${userId}/courses`);
      return response.data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }
}));
