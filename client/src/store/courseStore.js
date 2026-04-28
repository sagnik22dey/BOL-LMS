import { create } from 'zustand';
import api from '../api/axios';

// Cache TTL: 60 seconds — prevents redundant refetches when navigating between pages
const CACHE_TTL_MS = 60_000;

export const useCourseStore = create((set, get) => ({
  courses: [],
  _coursesFetchedAt: 0, // timestamp of last successful fetch
  myLearningCourses: [],
  myEnrollments: [],
  _myLearningFetchedAt: 0,
  currentCourse: null,
  loading: false,
  error: null,
  enrollSuccess: null,

  // completions: { [courseId]: { completions: [...], progress_pct: number, total_materials: number } }
  completions: {},
  // learningGoals: LearningGoal[]
  learningGoals: [],

  /**
   * Fetch all courses. Skips the network call if data was fetched within the
   * last CACHE_TTL_MS milliseconds (e.g. navigating back to the Courses page).
   * Pass `force = true` to bypass the cache (e.g. after creating / deleting a course).
   */
  fetchCourses: async (force = false) => {
    const { _coursesFetchedAt, courses } = get();
    if (!force && courses.length > 0 && Date.now() - _coursesFetchedAt < CACHE_TTL_MS) {
      return; // still fresh — skip the network round-trip
    }
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/courses');
      set({ courses: response.data || [], _coursesFetchedAt: Date.now(), loading: false });
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to fetch courses', loading: false });
    }
  },

  /**
   * Fetch the current user's enrolled courses + enrollments.
   * Skips the network call if data was fetched within CACHE_TTL_MS.
   * Pass `force = true` to bypass (e.g. after enrolling in a new course).
   */
  fetchMyLearningCourses: async (force = false) => {
    const { _myLearningFetchedAt, myLearningCourses } = get();
    if (!force && myLearningCourses.length > 0 && Date.now() - _myLearningFetchedAt < CACHE_TTL_MS) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const response = await api.get('/api/learning/my-courses');
      set({
        myLearningCourses: response.data?.courses || [],
        myEnrollments: response.data?.enrollments || [],
        _myLearningFetchedAt: Date.now(),
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
      // Invalidate my-learning cache so next visit sees the new enrollment
      set({ enrollSuccess: courseId, loading: false, _myLearningFetchedAt: 0 });
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
      // Invalidate cache so the list reflects the new course
      set({ courses: [...get().courses, response.data], _coursesFetchedAt: 0, loading: false });
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
        _coursesFetchedAt: 0,
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
        _coursesFetchedAt: 0,
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

  // ── Completion tracking ───────────────────────────────────────────────────

  /**
   * Fetch the full progress/completions object for a course and cache it.
   * Returns the CourseProgressResponse.
   */
  fetchCourseProgress: async (courseId) => {
    try {
      const { data } = await api.get(`/api/learning/courses/${courseId}/progress`);
      set((state) => ({
        completions: {
          ...state.completions,
          [courseId]: data,
        },
      }));
      return data;
    } catch (err) {
      console.error('Failed to fetch course progress:', err);
      return null;
    }
  },

  /**
   * Mark a material as completed with OPTIMISTIC UI update.
   * The UI reflects the change instantly; the server syncs in the background.
   * On failure, the optimistic update is rolled back.
   * Returns the final progress_pct (from server), or null on failure.
   */
  markMaterialComplete: async ({ courseId, moduleId, materialId }) => {
    const state = get();
    const prevCourseData = state.completions[courseId];

    // ── Optimistic update ──────────────────────────────────────────────────
    const prevCompletions = prevCourseData?.completions || [];
    const alreadyDone = prevCompletions.some((c) => c.material_id === materialId);
    if (!alreadyDone) {
      const totalMaterials = prevCourseData?.total_materials || 1;
      const newCompletions = [
        ...prevCompletions,
        {
          material_id: materialId,
          module_id: moduleId,
          course_id: courseId,
          completed_at: new Date().toISOString(),
        },
      ];
      const optimisticPct = Math.round((newCompletions.length / totalMaterials) * 100);

      set((s) => ({
        completions: {
          ...s.completions,
          [courseId]: {
            ...(s.completions[courseId] || {}),
            completions: newCompletions,
            progress_pct: optimisticPct,
            total_materials: totalMaterials,
          },
        },
        // Optimistically update enrollment progress too
        myEnrollments: s.myEnrollments.map((e) =>
          e.course_id === courseId ? { ...e, progress: optimisticPct } : e
        ),
      }));
    }

    // ── Background API call ───────────────────────────────────────────────
    try {
      const { data } = await api.post('/api/learning/complete', {
        course_id: courseId,
        module_id: moduleId,
        material_id: materialId,
      });

      // Sync with real server data – re-fetch full completion list
      const progressData = await api.get(`/api/learning/courses/${courseId}/progress`);
      set((s) => ({
        completions: {
          ...s.completions,
          [courseId]: progressData.data,
        },
        myEnrollments: s.myEnrollments.map((e) =>
          e.course_id === courseId ? { ...e, progress: data.progress_pct } : e
        ),
      }));
      return data.progress_pct;
    } catch (err) {
      console.error('Failed to mark material complete:', err);
      // ── Rollback optimistic update ─────────────────────────────────────
      set((s) => ({
        completions: {
          ...s.completions,
          [courseId]: prevCourseData || s.completions[courseId],
        },
        myEnrollments: s.myEnrollments.map((e) =>
          e.course_id === courseId
            ? { ...e, progress: prevCourseData?.progress_pct ?? e.progress }
            : e
        ),
      }));
      return null;
    }
  },

  /**
   * Unmark a material as completed with OPTIMISTIC UI update.
   * The UI reflects the change instantly; the server syncs in the background.
   * On failure, the optimistic update is rolled back.
   * Returns the final progress_pct (from server), or null on failure.
   */
  unmarkMaterialComplete: async ({ courseId, moduleId, materialId }) => {
    const state = get();
    const prevCourseData = state.completions[courseId];

    // ── Optimistic update ──────────────────────────────────────────────────
    const prevCompletions = prevCourseData?.completions || [];
    const newCompletions = prevCompletions.filter((c) => c.material_id !== materialId);
    const totalMaterials = prevCourseData?.total_materials || 1;
    const optimisticPct = Math.round((newCompletions.length / totalMaterials) * 100);

    set((s) => ({
      completions: {
        ...s.completions,
        [courseId]: {
          ...(s.completions[courseId] || {}),
          completions: newCompletions,
          progress_pct: optimisticPct,
          total_materials: totalMaterials,
        },
      },
      myEnrollments: s.myEnrollments.map((e) =>
        e.course_id === courseId ? { ...e, progress: optimisticPct } : e
      ),
    }));

    // ── Background API call ───────────────────────────────────────────────
    try {
      const { data } = await api.delete('/api/learning/complete', {
        data: { course_id: courseId, module_id: moduleId, material_id: materialId },
      });

      // Sync with real server data
      const progressData = await api.get(`/api/learning/courses/${courseId}/progress`);
      set((s) => ({
        completions: {
          ...s.completions,
          [courseId]: progressData.data,
        },
        myEnrollments: s.myEnrollments.map((e) =>
          e.course_id === courseId ? { ...e, progress: data.progress_pct } : e
        ),
      }));
      return data.progress_pct;
    } catch (err) {
      console.error('Failed to unmark material complete:', err);
      // ── Rollback optimistic update ─────────────────────────────────────
      set((s) => ({
        completions: {
          ...s.completions,
          [courseId]: prevCourseData || s.completions[courseId],
        },
        myEnrollments: s.myEnrollments.map((e) =>
          e.course_id === courseId
            ? { ...e, progress: prevCourseData?.progress_pct ?? e.progress }
            : e
        ),
      }));
      return null;
    }
  },

  // ── Learning goals ────────────────────────────────────────────────────────

  fetchMyLearningGoals: async () => {
    try {
      const { data } = await api.get('/api/learning/goals');
      set({ learningGoals: data.goals || [] });
    } catch (err) {
      console.error('Failed to fetch learning goals:', err);
    }
  },
}));
