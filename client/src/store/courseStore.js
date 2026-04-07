import { create } from 'zustand';
import api from '../api/axios';

export const useCourseStore = create((set, get) => ({
  courses: [],
  myLearningCourses: [],
  myEnrollments: [],
  currentCourse: null,
  loading: false,
  error: null,
  enrollSuccess: null,

  fetchCourses: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/courses');
      set({ courses: response.data || [], loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch courses', loading: false });
    }
  },

  fetchMyLearningCourses: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/learning/my-courses');
      set({
        myLearningCourses: response.data?.courses || [],
        myEnrollments: response.data?.enrollments || [],
        loading: false
      });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch my learning courses', loading: false });
    }
  },

  enrollFree: async (courseId) => {
    set({ loading: true, error: null, enrollSuccess: null });
    try {
      await api.post('/api/learning/enroll', { course_id: courseId });
      set({ enrollSuccess: courseId, loading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to enroll in course', loading: false });
      return false;
    }
  },

  fetchCourseById: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/api/courses/${id}`);
      set({ currentCourse: response.data, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch course', loading: false });
    }
  },

  createCourse: async (courseData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/courses', courseData);
      set({ courses: [...get().courses, response.data], loading: false });
      return response.data; // Return created course to redirect
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to create course', loading: false });
      return null;
    }
  },

  updateCourse: async (id, courseData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(`/api/courses/${id}`, courseData);
      set(state => ({
        courses: state.courses.map(c => c.id === id ? response.data : c),
        loading: false
      }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to update course', loading: false });
      return false;
    }
  },

  deleteCourse: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/courses/${id}`);
      set(state => ({
        courses: state.courses.filter(c => c.id !== id),
        loading: false
      }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to delete course', loading: false });
      return false;
    }
  },

  deleteCourseContent: async (courseId, objectKey) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/api/courses/${courseId}/content?object_key=${encodeURIComponent(objectKey)}`);
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to delete content', loading: false });
      return false;
    }
  },

  courseDeleteLogs: [],
  fetchCourseDeleteLogs: async (isSuperAdmin = false) => {
    try {
      const endpoint = isSuperAdmin ? '/api/admin/super/course-delete-logs' : '/api/admin/course-delete-logs';
      const response = await api.get(endpoint);
      set({ courseDeleteLogs: response.data || [] });
    } catch (error) {
      console.error('Failed to fetch course delete logs:', error);
    }
  },
}));
