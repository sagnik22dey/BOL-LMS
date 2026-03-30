import { create } from 'zustand';
import api from '../api/axios';

export const useCourseBundleStore = create((set, get) => ({
  courseBundles: [],
  loading: false,
  error: null,

  fetchCourseBundles: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/admin/course-bundles');
      set({ courseBundles: response.data || [], loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch course bundles', loading: false });
    }
  },

  createCourseBundle: async (bundleData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/admin/course-bundles', bundleData);
      set((state) => ({
        courseBundles: [...state.courseBundles, response.data],
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to create course bundle', loading: false });
      return false;
    }
  },

  updateCourseBundle: async (id, bundleData) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/api/admin/course-bundles/${id}`, bundleData);
      set((state) => ({
        courseBundles: state.courseBundles.map((g) => (g.id === id ? { ...g, ...bundleData } : g)),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to update course bundle', loading: false });
      return false;
    }
  },

  deleteCourseBundle: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/course-bundles/${id}`);
      set((state) => ({
        courseBundles: state.courseBundles.filter((g) => g.id !== id),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to delete course bundle', loading: false });
      return false;
    }
  },

  addUsersToCourseBundle: async (id, userIds) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/api/admin/course-bundles/${id}/users`, { user_ids: userIds });
      await get().fetchCourseBundles();
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to add users to course bundle', loading: false });
      return false;
    }
  },

  removeUserFromCourseBundle: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/course-bundles/${id}/users/${userId}`);
      set((state) => ({
        courseBundles: state.courseBundles.map((g) =>
          g.id === id ? { ...g, user_ids: g.user_ids?.filter((uid) => uid !== userId) || [] } : g
        ),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to remove user from course bundle', loading: false });
      return false;
    }
  },

  assignCoursesToCourseBundle: async (id, courseIds) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/api/admin/course-bundles/${id}/courses`, { course_ids: courseIds });
      await get().fetchCourseBundles();
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to assign courses to course bundle', loading: false });
      return false;
    }
  },

  removeCourseFromCourseBundle: async (id, courseId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/admin/course-bundles/${id}/courses/${courseId}`);
      set((state) => ({
        courseBundles: state.courseBundles.map((g) =>
          g.id === id ? { ...g, course_ids: g.course_ids?.filter((cid) => cid !== courseId) || [] } : g
        ),
        loading: false,
      }));
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to remove course from course bundle', loading: false });
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
    try {
      const response = await api.get(`/api/admin/users/${userId}/courses`);
      return response.data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }
}));
