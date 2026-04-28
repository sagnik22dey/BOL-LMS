import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { useCourseStore } from '../../store/courseStore';
import useCartStore from '../../store/cartStore';
import DocumentViewer from '../../components/learning/DocumentViewer';
import QuizView from '../../components/learning/QuizView';
import AssignmentView from '../../components/learning/AssignmentView';
import CustomVideoPlayer from '../../components/learning/CustomVideoPlayer';

const NAV_H = 64;

const MaterialIcon = ({ type }) => {
  const icons = {
    video: 'play_circle',
    text: 'article',
    quiz: 'quiz',
    assignment: 'assignment',
    pdf: 'picture_as_pdf',
  };
  return <span className="material-symbols-outlined text-[18px]">{icons[type] || 'description'}</span>;
};

// ── Auto-completion timing helpers ────────────────────────────────────────────

/** Seconds to wait before auto-completing a text material. Scales with word count. */
const textAutoCompleteSecs = (content = '') => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  // ~200 wpm average reading speed; minimum 15 s, maximum 600 s
  return Math.min(600, Math.max(15, Math.round((words / 200) * 60)));
};

/** PDF always auto-completes after 10 s */
const PDF_AUTO_COMPLETE_SECS = 10;

// ─────────────────────────────────────────────────────────────────────────────

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToCart, loading: cartLoading } = useCartStore();
  const {
    completions: allCompletions,
    fetchCourseProgress,
    markMaterialComplete,
    unmarkMaterialComplete,
  } = useCourseStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [course, setCourse] = useState(null);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [expandedModules, setExpandedModules] = useState({});
  const [hoveringContent, setHoveringContent] = useState(false);

  // Completion state
  const [videoWatched, setVideoWatched] = useState(false); // true once video reaches end
  // markingComplete is kept as a ref to avoid re-render; only used to prevent duplicate calls
  const markingCompleteRef = useRef(false);
  const autoCompleteTimerRef = useRef(null);
  const [autoCompleteCountdown, setAutoCompleteCountdown] = useState(null); // seconds remaining
  const autoCompleteCountdownRef = useRef(null);

  const toggleRef = useRef(null);

  // ── Derived completion set (memoized) ────────────────────────────────────
  /** Set of material UUIDs the user has completed for this course */
  const completedSet = useMemo(
    () => new Set((allCompletions[courseId]?.completions || []).map((c) => c.material_id)),
    [allCompletions, courseId]
  );

  const progressPct = useMemo(
    () => allCompletions[courseId]?.progress_pct ?? 0,
    [allCompletions, courseId]
  );

  // ── Flat material list (memoized) ─────────────────────────────────────────
  const flatMaterials = useMemo(
    () =>
      isAdmin || course?.is_enrolled
        ? (course?.modules || []).flatMap((mod) =>
            (mod.materials || []).map((mat) => ({ mod, mat }))
          )
        : [],
    [isAdmin, course]
  );

  const currentIndex = useMemo(
    () => flatMaterials.findIndex((item) => item.mat.id === activeMaterial?.id),
    [flatMaterials, activeMaterial?.id]
  );

  const hasNext = currentIndex >= 0 && currentIndex < flatMaterials.length - 1;
  const hasPrev = currentIndex > 0;

  // ── Course load ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/api/courses/${courseId}`);
        setCourse(data);
        if (data.is_enrolled !== false && data.modules?.length > 0) {
          const firstMod = data.modules[0];
          setActiveModule(firstMod);
          if (firstMod.materials?.length > 0) setActiveMaterial(firstMod.materials[0]);
          const initial = {};
          data.modules.forEach((m) => { initial[m.id] = true; });
          setExpandedModules(initial);
        } else if (data.locked_module_preview?.length > 0) {
          const initial = {};
          data.locked_module_preview.forEach((_, i) => { initial[`locked-${i}`] = true; });
          setExpandedModules(initial);
        }
      } catch {
        setError('Failed to load course details.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId]);

  // ── Fetch progress once enrolled (single call) ───────────────────────────
  useEffect(() => {
    if (course?.is_enrolled || isAdmin) {
      fetchCourseProgress(courseId);
    }
  }, [course?.is_enrolled, isAdmin, courseId, fetchCourseProgress]);

  // ── File URL fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchFileUrl = async () => {
      if (activeMaterial?.file_key && activeMaterial.type !== 'text') {
        const isHttp =
          activeMaterial.file_key.startsWith('http') ||
          activeMaterial.file_key.includes('youtube.com') ||
          activeMaterial.file_key.includes('youtu.be');
        if (isHttp) {
          let finalUrl = activeMaterial.file_key;
          if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
          setFileUrl(finalUrl);
          return;
        }
        try {
          const bucket =
            activeMaterial.type === 'video' ? 'bol-lms-videos' : 'bol-lms-documents';
          const { data } = await api.get('/api/learning/presign-get', {
            params: { object_name: activeMaterial.file_key, bucket },
          });
          setFileUrl(data.url);
        } catch {
          setFileUrl('');
        }
      } else {
        setFileUrl('');
      }
    };
    fetchFileUrl();
  }, [activeMaterial]);

  // ── Auto-completion timer — reset on every material change ────────────────
  const clearAutoCompleteTimers = useCallback(() => {
    if (autoCompleteTimerRef.current) {
      clearTimeout(autoCompleteTimerRef.current);
      autoCompleteTimerRef.current = null;
    }
    if (autoCompleteCountdownRef.current) {
      clearInterval(autoCompleteCountdownRef.current);
      autoCompleteCountdownRef.current = null;
    }
    setAutoCompleteCountdown(null);
  }, []);

  const startAutoCompleteTimer = useCallback(
    (seconds, mat, mod) => {
      if (!mat || !mod) return;
      // Don't auto-complete if already completed
      if (completedSet.has(mat.id)) return;

      setAutoCompleteCountdown(seconds);
      autoCompleteCountdownRef.current = setInterval(() => {
        setAutoCompleteCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(autoCompleteCountdownRef.current);
            autoCompleteCountdownRef.current = null;
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      autoCompleteTimerRef.current = setTimeout(async () => {
        if (!completedSet.has(mat.id)) {
          // markMaterialComplete already handles optimistic update + background sync
          markMaterialComplete({
            courseId,
            moduleId: mod.id,
            materialId: mat.id,
          });
        }
      }, seconds * 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courseId, completedSet, markMaterialComplete]
  );

  useEffect(() => {
    clearAutoCompleteTimers();
    setVideoWatched(false);

    if (!activeMaterial || !activeModule) return;

    // Already completed — no need for timers
    if (completedSet.has(activeMaterial.id)) return;

    if (activeMaterial.type === 'text') {
      const secs = textAutoCompleteSecs(activeMaterial.content || '');
      startAutoCompleteTimer(secs, activeMaterial, activeModule);
    } else if (activeMaterial.type === 'pdf') {
      startAutoCompleteTimer(PDF_AUTO_COMPLETE_SECS, activeMaterial, activeModule);
    }

    return () => clearAutoCompleteTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMaterial?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectMaterial = useCallback((mod, mat) => {
    setActiveModule(mod);
    setActiveMaterial(mat);
  }, []);

  const toggleModule = useCallback((id) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleFreeEnroll = async () => {
    try {
      setEnrolling(true);
      await api.post('/api/learning/enroll', { course_id: courseId });
      const { data } = await api.get(`/api/courses/${courseId}`);
      setCourse(data);
      if (data.modules?.length > 0) {
        const firstMod = data.modules[0];
        setActiveModule(firstMod);
        if (firstMod.materials?.length > 0) setActiveMaterial(firstMod.materials[0]);
        const initial = {};
        data.modules.forEach((m) => { initial[m.id] = true; });
        setExpandedModules(initial);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to enroll';
      setError(msg);
    } finally {
      setEnrolling(false);
    }
  };

  const handleAddToCart = useCallback(() => {
    if (!course?.price || course.price === 0) return handleFreeEnroll();
    addToCart('course', courseId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.price, courseId, addToCart]);

  /** Called when the video player fires its natural end event. */
  const handleVideoComplete = useCallback(() => {
    setVideoWatched(true);
    if (!activeMaterial || !activeModule) return;
    if (completedSet.has(activeMaterial.id)) return;
    // Fire-and-forget: optimistic update is immediate in the store
    markMaterialComplete({
      courseId,
      moduleId: activeModule.id,
      materialId: activeMaterial.id,
    });
  }, [activeMaterial, activeModule, completedSet, courseId, markMaterialComplete]);

  /**
   * Called by CustomVideoPlayer once the user has watched ≥ 80% of the video.
   * Sets videoWatched=true and auto-completes the material.
   */
  const handleWatched80 = useCallback(() => {
    setVideoWatched(true);
    if (!activeMaterial || !activeModule) return;
    if (completedSet.has(activeMaterial.id)) return;
    // Fire-and-forget: optimistic update is immediate in the store
    markMaterialComplete({
      courseId,
      moduleId: activeModule.id,
      materialId: activeMaterial.id,
    });
  }, [activeMaterial, activeModule, completedSet, courseId, markMaterialComplete]);

  /** Manually toggle completion for any material from the checkbox or button. */
  const handleToggleComplete = useCallback(
    (mat, mod, e) => {
      if (e) e.stopPropagation();
      // Prevent duplicate in-flight requests
      if (markingCompleteRef.current) return;
      markingCompleteRef.current = true;

      const action = completedSet.has(mat.id) ? unmarkMaterialComplete : markMaterialComplete;
      // Fire-and-forget: the store applies optimistic update synchronously
      action({ courseId, moduleId: mod.id, materialId: mat.id }).finally(() => {
        markingCompleteRef.current = false;
      });
    },
    [completedSet, courseId, markMaterialComplete, unmarkMaterialComplete]
  );

  const handleNext = useCallback(() => {
    if (hasNext) {
      const next = flatMaterials[currentIndex + 1];
      handleSelectMaterial(next.mod, next.mat);
    }
  }, [hasNext, flatMaterials, currentIndex, handleSelectMaterial]);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prev = flatMaterials[currentIndex - 1];
      handleSelectMaterial(prev.mod, prev.mat);
    }
  }, [hasPrev, flatMaterials, currentIndex, handleSelectMaterial]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading)
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: `calc(100vh - ${NAV_H}px)` }}
      >
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (error)
    return (
      <div className="m-8 p-4 bg-error-container text-on-error-container rounded-lg font-body">
        {error}
      </div>
    );
  if (!course)
    return (
      <div className="m-8 p-4 bg-surface-container text-on-surface rounded-lg font-body">
        Course not found
      </div>
    );

  const isEnrolled = isAdmin || course.is_enrolled === true;
  const isVideo = activeMaterial?.type === 'video';
  const isAssessment =
    activeMaterial?.type === 'quiz' || activeMaterial?.type === 'assignment';
  const instructorInitial = course.instructor_name?.charAt(0).toUpperCase() || 'I';
  const instructorName = course.instructor_name || 'Instructor';

  const SIDEBAR_W = 380;

  // ── Render current material ───────────────────────────────────────────────
  const renderPlayer = () => {
    if (!isEnrolled) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 text-center gap-5 p-8">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-white/60">lock</span>
          </div>
          <div className="max-w-md">
            <h2 className="font-headline font-extrabold text-xl text-white mb-2">
              Course Content Locked
            </h2>
            <p className="text-white/50 font-body text-sm leading-relaxed">
              Purchase this course to unlock all modules, videos, and materials.
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={cartLoading || enrolling}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-headline font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {cartLoading || enrolling ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">
                {course.price > 0 ? 'shopping_cart' : 'school'}
              </span>
            )}
            {course.price > 0
              ? `Add to Cart — ${course.currency} ${course.price}`
              : 'Enroll for Free'}
          </button>
        </div>
      );
    }

    if (!activeMaterial)
      return (
        <div className="flex items-center justify-center h-full bg-gray-950 text-white/40 font-headline text-sm">
          Select a lesson to begin
        </div>
      );

    switch (activeMaterial.type) {
      case 'video': {
        let videoUrl = fileUrl;
        const isHttpUrl =
          activeMaterial.file_key?.startsWith('http') ||
          activeMaterial.file_key?.includes('youtube.com') ||
          activeMaterial.file_key?.includes('youtu.be');
        if (!videoUrl && isHttpUrl) {
          videoUrl = activeMaterial.file_key;
          if (!videoUrl.startsWith('http')) videoUrl = 'https://' + videoUrl;
        }
        const isYouTube =
          activeMaterial.file_key?.includes('youtube.com') ||
          activeMaterial.file_key?.includes('youtu.be');
        return (
          <CustomVideoPlayer
            key={activeMaterial.file_key}
            url={videoUrl}
            isYouTube={isYouTube}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onNext={handleNext}
            onPrev={handlePrev}
            onVideoComplete={handleVideoComplete}
            onWatched80={handleWatched80}
            onEnded={handleNext}
          />
        );
      }
      case 'text':
        return (
          <div className="w-full h-full overflow-y-auto bg-white p-8 md:p-12">
            <div className="max-w-3xl mx-auto whitespace-pre-wrap leading-relaxed text-gray-700 font-body">
              {activeMaterial.content}
            </div>
          </div>
        );
      default:
        if (activeMaterial.file_key && fileUrl) {
          return (
            <div className="w-full h-full">
              <DocumentViewer url={fileUrl} fileType={activeMaterial.type} />
            </div>
          );
        }
        if (fileUrl === '' && activeMaterial.file_key) {
          return (
            <div className="flex items-center justify-center h-full bg-gray-950">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gray-950 text-center gap-3">
            <span className="material-symbols-outlined text-5xl text-white/20">description</span>
            <p className="text-white/40 font-body text-sm">{activeMaterial.title}</p>
          </div>
        );
    }
  };

  // ── Mark-as-completed button (shown below media player) ───────────────────
  const renderMarkCompleteBar = () => {
    if (!isEnrolled || !activeMaterial || isAssessment) return null;

    const isCompleted = completedSet.has(activeMaterial.id);

    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-200">
        {autoCompleteCountdown !== null && !isCompleted && (
          <span className="text-xs text-gray-500 font-body">
            Auto-completing in {autoCompleteCountdown}s…
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={(e) => handleToggleComplete(activeMaterial, activeModule, e)}
          title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold font-headline transition-all border ${
            isCompleted
              ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isCompleted ? 'check_circle' : 'radio_button_unchecked'}
          </span>
          {isCompleted ? 'Completed' : 'Mark as Completed'}
        </button>
      </div>
    );
  };

  const modules = isEnrolled ? course.modules || [] : course.locked_module_preview || [];

  // ── Page progress bar ─────────────────────────────────────────────────────
  const totalMats = flatMaterials.length;
  const completedMats = flatMaterials.filter((item) => completedSet.has(item.mat.id)).length;

  return (
    <div className="flex flex-col bg-white" style={{ height: `calc(100vh - ${NAV_H}px)` }}>
      {/* ═══ Top course bar ═══ */}
      <div className="flex-shrink-0 h-12 bg-gray-900 text-white flex items-center px-4 gap-4 z-30 border-b border-gray-800">
        <button
          onClick={() => navigate('/dashboard/courses')}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back</span>
        </button>
        <div className="h-5 w-px bg-white/20" />
        <p className="text-sm font-semibold truncate flex-1">{course.title}</p>

        {/* Overall progress pill */}
        {isEnrolled && totalMats > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-white/70">
            <span className="material-symbols-outlined text-[14px]">bar_chart</span>
            {completedMats}/{totalMats} completed
            <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span>{Math.round(progressPct)}%</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <span className="hidden sm:flex items-center gap-1 bg-primary/20 text-primary-fixed-dim px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                Admin Preview
              </span>
              <button
                onClick={() => navigate(`/dashboard/courses/${courseId}/assessments`)}
                className="flex items-center gap-1 px-2 py-1 bg-white/10 text-white text-xs font-semibold rounded hover:bg-white/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">assignment_turned_in</span>
                <span>Submissions</span>
              </button>
            </>
          )}
          {!isAdmin && !isEnrolled && (
            <button
              onClick={handleAddToCart}
              disabled={cartLoading || enrolling}
              className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white text-xs font-bold rounded hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {cartLoading || enrolling ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[14px]">
                  {course.price > 0 ? 'shopping_cart' : 'school'}
                </span>
              )}
              {course.price > 0 ? `${course.currency} ${course.price}` : 'Enroll Free'}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Main content: left + right ═══ */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── LEFT column ── */}
        <div
          className="flex-1 overflow-y-auto bg-white transition-all duration-300 ease-in-out"
          style={{ minWidth: 0 }}
          onMouseEnter={() => setHoveringContent(true)}
          onMouseLeave={() => setHoveringContent(false)}
        >
          {/* ── Assessment materials get full-page treatment ── */}
          {isEnrolled && isAssessment ? (
            <div className="relative">
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 h-12 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400 text-base">
                  {activeMaterial?.type === 'quiz' ? 'quiz' : 'assignment'}
                </span>
                <p className="text-sm font-semibold text-gray-700 truncate">
                  {activeMaterial?.title}
                </p>
                {activeModule && (
                  <>
                    <span className="text-gray-300 text-sm">·</span>
                    <p className="text-xs text-gray-400 truncate hidden sm:block">
                      {activeModule.title}
                    </p>
                  </>
                )}
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-base">menu_book</span>
                    <span className="hidden sm:inline">Course Content</span>
                  </button>
                )}
              </div>

              {activeMaterial?.type === 'quiz' && (
                <QuizView
                  key={activeMaterial.file_key}
                  quizId={activeMaterial.file_key}
                  onCompleted={() => {
                    markMaterialComplete({
                      courseId,
                      moduleId: activeModule?.id,
                      materialId: activeMaterial.id,
                    });
                  }}
                />
              )}
              {activeMaterial?.type === 'assignment' && (
                <AssignmentView
                  key={activeMaterial.file_key}
                  assignmentId={activeMaterial.file_key}
                  onCompleted={() => {
                    markMaterialComplete({
                      courseId,
                      moduleId: activeModule?.id,
                      materialId: activeMaterial.id,
                    });
                  }}
                />
              )}
            </div>
          ) : (
            <>
              {/* ── Media player box ── */}
              <div
                className="w-full bg-gray-950 relative"
                style={
                  isVideo
                    ? { aspectRatio: '16/9', maxHeight: `calc(100vh - ${NAV_H + 48}px)` }
                    : { height: '60vh', minHeight: 300 }
                }
              >
                {renderPlayer()}

                {!sidebarOpen && (
                  <button
                    ref={toggleRef}
                    onClick={() => setSidebarOpen(true)}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 px-2 py-6 rounded-l-lg transition-all duration-200 ${
                      hoveringContent
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 translate-x-2 pointer-events-none'
                    } bg-gray-800/90 hover:bg-gray-700 text-white shadow-lg backdrop-blur-sm`}
                    title="Show course content"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                )}
              </div>

              {/* ── Mark as Completed bar ── */}
              {renderMarkCompleteBar()}

              {/* ── Overview tab ── */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6">
                <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
                  <button
                    className="py-3 px-3 text-sm font-bold font-headline whitespace-nowrap border-b-2 border-gray-900 text-gray-900"
                  >
                    Overview
                  </button>
                </div>
              </div>

              {/* ── Overview content ── */}
              <div className="p-6 md:p-8 lg:p-10 max-w-4xl">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl md:text-2xl font-extrabold font-headline text-gray-900 mb-1">
                      {isEnrolled ? activeMaterial?.title || course.title : course.title}
                    </h1>
                    {isEnrolled && activeModule && (
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                        {activeModule.title}
                      </p>
                    )}
                  </div>

                  <p className="text-gray-600 font-body leading-relaxed">
                    {course.description || 'No description provided.'}
                  </p>

                  {!isEnrolled && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                      <span className="material-symbols-outlined text-amber-500 mt-0.5 text-xl">
                        info
                      </span>
                      <div>
                        <p className="font-headline font-bold text-amber-900 mb-0.5 text-sm">
                          Purchase required
                        </p>
                        <p className="text-amber-800 text-xs">
                          Buy this course to access all modules and materials.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 py-2">
                    <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-sm font-headline">
                      {instructorInitial}
                    </div>
                    <div>
                      <p className="font-headline font-bold text-gray-900 text-sm">
                        {instructorName}
                      </p>
                      <p className="text-xs text-gray-400">Instructor</p>
                    </div>
                  </div>

                  {course.instructor_bio && (
                    <p className="text-sm text-gray-500 font-body leading-relaxed">
                      {course.instructor_bio}
                    </p>
                  )}

                  {!isEnrolled && course.price > 0 && (
                    <div className="flex items-center gap-4 p-5 bg-gray-50 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-headline font-extrabold text-2xl text-gray-900">
                          {course.currency} {course.price}
                        </p>
                        <p className="text-xs text-gray-400">
                          {course.validity_days
                            ? `${course.validity_days}-day access`
                            : 'Lifetime access'}
                        </p>
                      </div>
                      <button
                        onClick={handleAddToCart}
                        disabled={cartLoading}
                        className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-headline font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-60"
                      >
                        {cartLoading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">
                            shopping_cart
                          </span>
                        )}
                        Add to Cart
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <footer className="bg-gray-900 text-white/60 py-8 px-8">
                <div className="max-w-4xl flex flex-col sm:flex-row justify-between items-center gap-4">
                  <p className="text-xs tracking-wide">
                    © {new Date().getFullYear()} BOL-LMS. Elevating Intellectual Curiosity.
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="hover:text-white cursor-pointer transition-colors">
                      Privacy Policy
                    </span>
                    <span className="hover:text-white cursor-pointer transition-colors">Terms</span>
                  </div>
                </div>
              </footer>
            </>
          )}
        </div>

        {/* ── RIGHT sidebar ── */}
        <aside
          className="flex-shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            width: sidebarOpen ? SIDEBAR_W : 0,
            minWidth: sidebarOpen ? SIDEBAR_W : 0,
          }}
        >
          {/* Sidebar header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-gray-200 bg-white">
            <h3 className="font-headline font-bold text-sm text-gray-900">Course content</h3>
            {isEnrolled && totalMats > 0 && (
              <span className="text-xs text-gray-500 font-body">
                {completedMats}/{totalMats}
              </span>
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
              title="Close sidebar"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Progress bar in sidebar */}
          {isEnrolled && totalMats > 0 && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-600">
                  {Math.round(progressPct)}%
                </span>
              </div>
            </div>
          )}

          {/* Scrollable modules */}
          <div className="flex-1 overflow-y-auto">
            {modules.map((mod, modIdx) => {
              const modKey = isEnrolled ? mod.id : `locked-${modIdx}`;
              const isExpanded = expandedModules[modKey] !== false;
              const materials = mod.materials || [];
              const modCompletedCount = materials.filter((m) => completedSet.has(m.id)).length;

              return (
                <div key={modKey}>
                  <button
                    onClick={() => toggleModule(modKey)}
                    className="w-full h-14 flex items-center justify-between px-4 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left flex-shrink-0"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[13px] font-bold text-gray-900 font-headline truncate">
                        Module {modIdx + 1}: {mod.title}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {modCompletedCount}/{materials.length} completed
                      </p>
                    </div>
                    <span
                      className={`material-symbols-outlined text-gray-400 text-lg flex-shrink-0 transition-transform duration-200 ${
                        isExpanded ? '' : '-rotate-90'
                      }`}
                    >
                      expand_more
                    </span>
                  </button>

                  {isExpanded && (
                    <div>
                      {materials.map((mat, matIdx) => {
                        const active = isEnrolled && activeMaterial?.id === mat.id;
                        const isCompleted = completedSet.has(mat.id);

                        if (!isEnrolled) {
                          return (
                            <div
                              key={matIdx}
                              className="h-14 flex items-center gap-3 px-4 border-b border-gray-100 opacity-50 cursor-not-allowed flex-shrink-0"
                            >
                              <span className="material-symbols-outlined text-[16px] text-gray-400 flex-shrink-0">
                                lock
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-gray-600 truncate">
                                  {matIdx + 1}. {mat.title}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                                  <MaterialIcon type={mat.type} />
                                  <span className="text-[11px]">{mat.type}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={mat.id}
                            onClick={() => handleSelectMaterial(mod, mat)}
                            className={`w-full h-14 flex items-center gap-3 px-4 text-left border-b border-gray-100 transition-colors flex-shrink-0 ${
                              active ? 'bg-gray-100' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div
                              className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isCompleted
                                  ? 'bg-green-500 border-green-500'
                                  : (mat.type === 'quiz' || mat.type === 'assignment')
                                  ? 'border-gray-200 cursor-default'
                                  : 'border-gray-300 hover:border-primary cursor-pointer'
                              }`}
                              onClick={(e) => {
                                if (mat.type === 'quiz' || mat.type === 'assignment') {
                                  e.stopPropagation();
                                } else {
                                  handleToggleComplete(mat, mod, e);
                                }
                              }}
                              title={
                                (mat.type === 'quiz' || mat.type === 'assignment')
                                  ? 'Complete the assessment to mark it done'
                                  : isCompleted
                                  ? 'Mark incomplete'
                                  : 'Mark complete'
                              }
                            >
                              {isCompleted && (
                                <span className="material-symbols-outlined text-white text-[12px]">
                                  check
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-[13px] truncate ${
                                  active
                                    ? 'font-semibold text-gray-900'
                                    : isCompleted
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-700'
                                }`}
                              >
                                {matIdx + 1}. {mat.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={active ? 'text-primary' : 'text-gray-400'}>
                                  <MaterialIcon type={mat.type} />
                                </span>
                                <span className="text-[11px] text-gray-400">{mat.type}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {modules.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                {isEnrolled ? 'No modules available.' : 'Purchase to view course contents.'}
              </div>
            )}
          </div>
        </aside>

        {/* ── Floating open sidebar tab ── */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute right-0 top-0 z-20 flex items-center gap-1 bg-primary text-white pl-3 pr-2 py-2 rounded-bl-lg shadow-md hover:bg-primary/90 transition-colors text-xs font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Course content
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseView;
