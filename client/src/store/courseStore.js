import { create } from 'zustand';
import api from '../api/axios';

export const useCourseStore = create((set, get) => ({
  courses: [],
  myLearningCourses: [],
  myEnrollments: [],
  currentCourse: null,
  loading: false,
  error: null,

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
}));
