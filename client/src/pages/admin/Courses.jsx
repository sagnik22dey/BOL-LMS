import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useCourseStore } from '../../store/courseStore';
import { useAuthStore } from '../../store/authStore';
import useCartStore from '../../store/cartStore';

const CourseCard = ({ course, isAdmin, onTogglePublish, onDelete, enrolledCourseIds }) => {
  const { addToCart, loading: cartLoading } = useCartStore();
  const { enrollFree, loading: enrollLoading, error: enrollError } = useCourseStore();
  const navigate = useNavigate();
  const isFree = !course.price || course.price === 0;
  const isAlreadyEnrolled = enrolledCourseIds?.includes(course.id);
  const loading = cartLoading || enrollLoading;

  const handleEnrollFree = async () => {
    const success = await enrollFree(course.id);
    if (success) {
      navigate('/dashboard/learning');
    }
  };

  return (
    <div className="group bg-surface-container-lowest flex flex-col rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-surface-dim hover:-translate-y-1 h-full">
      {isAdmin ? (
        <RouterLink to={`/dashboard/learning/${course.id}`} className={`h-40 relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-primary-container group-hover:opacity-90 transition-opacity`}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 0%, transparent 60%)' }}></div>
          <span className="text-6xl font-black text-white/20 font-headline select-none pointer-events-none group-hover:scale-110 transition-transform">
            {course.title.charAt(0).toUpperCase()}
          </span>
          
          <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
            <div className="text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm border border-white/20 text-white font-headline" style={{ backgroundColor: course.is_published ? 'rgba(46, 204, 113, 0.4)' : 'rgba(255, 255, 255, 0.2)'}}>
              {course.is_published ? 'Published' : 'Draft'}
            </div>
            <div className="text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm border border-white/20 text-white font-headline" style={{ backgroundColor: course.is_public ? 'rgba(52, 152, 219, 0.4)' : 'rgba(155, 89, 182, 0.4)'}}>
              {course.is_public ? 'Public' : 'Org Only'}
            </div>
          </div>
        </RouterLink>
      ) : (
        <div className={`h-40 relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-primary-container`}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 0%, transparent 60%)' }}></div>
          <span className="text-6xl font-black text-white/20 font-headline select-none pointer-events-none group-hover:scale-110 transition-transform">
            {course.title.charAt(0).toUpperCase()}
          </span>
          <div className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm border border-white/20 text-white font-headline" style={{ backgroundColor: course.is_public ? 'rgba(52, 152, 219, 0.4)' : 'rgba(155, 89, 182, 0.4)'}}>
            {course.is_public ? 'Public Catalog' : 'Org Assigned'}
          </div>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-bold text-lg font-headline mb-2 text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 flex-1 font-body">
          {course.description || "No description provided."}
        </p>
        
        <div className="flex items-center gap-1.5 text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-[16px]">payments</span>
          <span className="text-[11px] font-bold uppercase tracking-wider">{course.price > 0 ? `${course.currency} ${course.price}` : 'Free'}</span>
        </div>

        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-surface-dim/40">
          {isAdmin ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <RouterLink to={`/dashboard/courses/builder/${course.id}`} className="flex-1 text-center py-2 px-3 rounded-xl border border-surface-dim text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors">
                  Edit
                </RouterLink>
                <button
                  onClick={() => onTogglePublish(course)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-colors ${course.is_published ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}`}>
                  {course.is_published ? 'Unpublish' : 'Publish'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <RouterLink to={`/dashboard/learning/${course.id}`} className="flex-1 text-center py-2 px-3 rounded-xl bg-primary-container text-on-primary-container text-sm font-bold hover:bg-primary hover:text-white transition-colors">
                  Preview Course
                </RouterLink>
                <button
                  onClick={() => onDelete(course)}
                  className="py-2 px-3 rounded-xl bg-red-100 text-red-700 text-sm font-bold hover:bg-red-200 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {enrollError && (
                <p className="text-xs text-error text-center">{enrollError}</p>
              )}
              <div className="flex gap-2 w-full">
                {isFree ? (
                  isAlreadyEnrolled ? (
                    <RouterLink
                      to={`/dashboard/learning/${course.id}`}
                      className="w-full text-center py-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-sm font-bold transition-colors font-headline shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Go to Course
                    </RouterLink>
                  ) : (
                    <button
                      onClick={handleEnrollFree}
                      disabled={loading}
                      className="w-full text-center py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors text-sm font-headline shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">school</span>
                      )}
                      Enroll Now — Free
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => addToCart('course', course.id)}
                    disabled={loading}
                    className="w-full text-center py-2.5 rounded-xl bg-primary-container text-primary font-bold hover:bg-primary hover:text-white transition-colors text-sm font-headline shadow-sm"
                  >
                    Add to Cart
                  </button>
                )}
                <RouterLink
                  to={`/dashboard/learning/${course.id}`}
                  className="flex-shrink-0 py-2.5 px-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-on-primary-fixed-variant transition-colors font-headline shadow-sm flex items-center justify-center"
                >
                  View
                </RouterLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Courses = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { courses, fetchCourses, fetchMyLearningCourses, myEnrollments, createCourse, deleteCourse, loading, error } = useCourseStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '', price: 0, currency: 'INR', validity_days: '', instructor_name: '', instructor_bio: '' });
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // course object to delete
  const [deleting, setDeleting] = useState(false);

  // Memoized: only recalculates when myEnrollments changes — not on every render
  const enrolledCourseIds = useMemo(
    () => (!isAdmin ? (myEnrollments || []).map((e) => e.course_id) : []),
    [isAdmin, myEnrollments]
  );

  useEffect(() => {
    fetchCourses();
    if (!isAdmin) fetchMyLearningCourses();
  }, [fetchCourses, fetchMyLearningCourses, isAdmin]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setFormData({ title: '', description: '', price: 0, currency: 'INR', validity_days: '', instructor_name: '', instructor_bio: '' });
    setFormError('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.title || !formData.description) {
      setFormError('Title and description are required.');
      return;
    }
    const payload = {
      ...formData,
      price: parseInt(formData.price, 10) || 0,
      validity_days: formData.validity_days ? parseInt(formData.validity_days, 10) : null
    };
    const created = await createCourse(payload);
    if (created) {
      handleClose();
      navigate(`/dashboard/courses/builder/${created.id}`);
    } else {
      setFormError(useCourseStore.getState().error || 'Failed to create course.');
    }
  }, [formData, createCourse, handleClose, navigate]);

  const handleTogglePublish = useCallback(async (course) => {
    await useCourseStore.getState().updateCourse(course.id, { ...course, is_published: !course.is_published });
  }, []);

  const handleDeleteCourse = useCallback(async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const success = await deleteCourse(deleteConfirm.id);
    setDeleting(false);
    setDeleteConfirm(null);
    if (!success) {
      setFormError(useCourseStore.getState().error || 'Failed to delete course.');
    }
  }, [deleteConfirm, deleteCourse]);

  // Memoized: only recalculates when courses list or search term changes
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [courses, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline text-primary tracking-tight">
            Course Library
          </h1>
          <p className="text-on-surface-variant font-body mt-1">
            {isAdmin ? 'Manage and organize your organization\'s learning content' : 'Browse available courses and continue learning'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Search courses..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-lowest border border-surface-dim rounded-xl py-2.5 pl-10 pr-4 text-sm font-body focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none"
            />
          </div>
          {isAdmin && (
            <button 
              onClick={() => setOpen(true)}
              className="bg-primary text-white flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold font-headline transition-transform hover:scale-[0.98] whitespace-nowrap shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              New Course
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-4 bg-error-container text-on-error-container rounded-xl font-body text-sm border border-error/20">{error}</div>}

      {loading && (
        <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden">
          <div className="bg-primary h-full w-1/3 animate-[pulse_2s_ease-in-out_infinite]"></div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-surface-container-lowest border border-surface-dim rounded-3xl p-16 text-center shadow-sm">
          <span className="material-symbols-outlined text-6xl text-outline opacity-50 mb-4 block">school</span>
          <h3 className="text-xl font-extrabold font-headline text-on-surface mb-2">
            {search ? 'No courses match your search' : (isAdmin ? 'No courses created yet' : 'No courses available')}
          </h3>
          <p className="text-on-surface-variant font-body">
            {isAdmin && !search ? 'Click "New Course" to get started.' : 'Try adjusting your search terms.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((course) => (
          <CourseCard key={course.id} course={course} isAdmin={isAdmin} onTogglePublish={handleTogglePublish} onDelete={(c) => setDeleteConfirm(c)} enrolledCourseIds={enrolledCourseIds} />
        ))}
      </div>

      {/* Tailwind Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-on-surface/40 backdrop-blur-sm transition-opacity">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-md shadow-2xl animate-[fadeInUp_0.3s_ease-out] border border-surface-dim">
            <h2 className="text-2xl font-extrabold font-headline text-primary mb-6">Create New Course</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {formError && <div className="p-3 bg-error-container text-on-error-container text-sm rounded-lg border border-error/20 font-body">{formError}</div>}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-on-surface font-headline">Course Title</label>
                <input 
                  required autoFocus type="text" 
                  value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-surface-container-low border border-surface-dim rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body transition-shadow"
                  placeholder="e.g. Advanced Leadership"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-on-surface font-headline">Description</label>
                <textarea 
                  required rows="3"
                  value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-surface-container-low border border-surface-dim rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body resize-none transition-shadow"
                  placeholder="Brief overview of the course content..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-on-surface font-headline">Instructor Name</label>
                <input 
                  type="text" 
                  value={formData.instructor_name} onChange={(e) => setFormData({...formData, instructor_name: e.target.value})}
                  className="w-full bg-surface-container-low border border-surface-dim rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body transition-shadow"
                  placeholder="e.g. Dr. Jane Smith"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-on-surface font-headline">Instructor Bio</label>
                <textarea 
                  rows="2"
                  value={formData.instructor_bio} onChange={(e) => setFormData({...formData, instructor_bio: e.target.value})}
                  className="w-full bg-surface-container-low border border-surface-dim rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary font-body resize-none transition-shadow"
                  placeholder="Brief bio about the instructor..."
                />
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <label className="text-sm font-bold text-on-surface font-headline">Price</label>
                  <input 
                    type="number" min="0" step="1"
                    value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full bg-surface-container-low border border-surface-dim rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary font-body"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <label className="text-sm font-bold text-on-surface font-headline">Validity (Days)</label>
                  <input 
                    type="number" min="1" step="1"
                    value={formData.validity_days} onChange={(e) => setFormData({...formData, validity_days: e.target.value})}
                    className="w-full bg-surface-container-low border border-surface-dim rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary font-body"
                    placeholder="Blank for lifetime"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <button type="button" onClick={handleClose} disabled={loading} className="px-5 py-2.5 font-bold font-headline text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 bg-primary text-white font-bold font-headline rounded-xl hover:bg-on-primary-fixed-variant transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md">
                  {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-on-surface/40 backdrop-blur-sm transition-opacity">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-[fadeInUp_0.3s_ease-out] border border-surface-dim">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100">
                <span className="material-symbols-outlined text-red-600 text-2xl">warning</span>
              </div>
              <h2 className="text-xl font-extrabold font-headline text-red-700">Delete Course</h2>
            </div>
            <p className="text-on-surface-variant font-body text-sm mb-2">
              Are you sure you want to permanently delete <strong className="text-on-surface">{deleteConfirm.title}</strong>?
            </p>
            <p className="text-red-600 text-xs font-body mb-6">
              This will remove all associated videos, documents, and data. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-5 py-2.5 font-bold font-headline text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={deleting}
                className="px-6 py-2.5 bg-red-600 text-white font-bold font-headline rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md"
              >
                {deleting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
