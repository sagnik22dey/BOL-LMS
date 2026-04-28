import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCourseStore } from '../../store/courseStore';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
};

const CircleProgress = ({ pct, size = 56 }) => {
  const r = (size / 2) - 4;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * pct) / 100;
  return (
    <svg width={size} height={size} className="transform -rotate-90 origin-center flex-shrink-0">
      <circle
        cx={size / 2} cy={size / 2}
        r={r}
        fill="transparent"
        stroke="currentColor"
        strokeWidth="4"
        className="text-surface-container-high"
      />
      <circle
        cx={size / 2} cy={size / 2}
        r={r}
        fill="transparent"
        stroke="currentColor"
        strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={pct >= 100 ? 'text-green-500' : 'text-surface-tint'}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
};

// ── component ─────────────────────────────────────────────────────────────────

const MyLearning = () => {
  const {
    myLearningCourses,
    fetchMyLearningCourses,
    loading,
    myEnrollments,
    learningGoals,
    fetchMyLearningGoals,
  } = useCourseStore();

  const [tab, setTab] = useState(0); // 0=In Progress, 1=Completed, 2=Goals

  useEffect(() => {
    fetchMyLearningCourses();
    fetchMyLearningGoals();
  }, [fetchMyLearningCourses, fetchMyLearningGoals]);

  // Build a fast O(1) progress lookup map — only rebuilds when enrollments change
  const progressMap = useMemo(() => {
    const map = {};
    for (const e of myEnrollments) {
      map[e.course_id] = Math.min(100, Math.max(0, e.progress ?? 0));
    }
    return map;
  }, [myEnrollments]);

  const getProgress = (courseId) => progressMap[courseId] ?? 0;

  // Memoized: only recalculates when courses or enrollments change
  const { inProgress, completed } = useMemo(() => {
    const published = myLearningCourses.filter((c) => c.is_published);
    return {
      inProgress: published.filter((c) => (progressMap[c.id] ?? 0) < 100),
      completed:  published.filter((c) => (progressMap[c.id] ?? 0) >= 100),
    };
  }, [myLearningCourses, progressMap]);

  const displayed = tab === 0 ? inProgress : tab === 1 ? completed : [];

  const TABS = useMemo(() => [
    { label: 'In Progress',   count: inProgress.length },
    { label: 'Completed',     count: completed.length },
    { label: 'Learning Goals', count: learningGoals.length },
  ], [inProgress.length, completed.length, learningGoals.length]);

  return (
    <div className="bg-background font-body text-on-surface w-full min-h-screen">
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-headline text-4xl font-extrabold text-primary mb-2 tracking-tight">
            My Learning
          </h1>
          <p className="text-on-surface-variant font-body">
            {inProgress.length} course{inProgress.length !== 1 ? 's' : ''} in progress ·{' '}
            {completed.length} completed
          </p>
        </div>

        {/* Tabs + content */}
        <div className="flex flex-col lg:flex-row gap-8 mb-12 items-start">
          <div className="flex-1 w-full min-w-0">
            {/* Tab bar */}
            <div className="flex gap-8 mb-8 overflow-x-auto border-b border-outline-variant pb-1">
              {TABS.map(({ label, count }, i) => (
                <button
                  key={label}
                  onClick={() => setTab(i)}
                  className={`font-headline font-bold text-lg pb-4 transition-colors whitespace-nowrap ${
                    tab === i
                      ? 'text-primary border-b-2 border-surface-tint'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {label}{' '}
                  <span className="text-sm font-semibold">({count})</span>
                </button>
              ))}
            </div>

            {/* ── Courses grid (tabs 0 & 1) ── */}
            {tab <= 1 && (
              <>
                {loading ? (
                  <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse w-1/2 rounded-full" />
                  </div>
                ) : displayed.length === 0 ? (
                  <div className="text-center py-16 text-on-surface-variant flex flex-col items-center">
                    <span className="material-symbols-outlined text-6xl opacity-20 mb-4 block">
                      school
                    </span>
                    <h3 className="font-headline font-bold text-xl mb-2">
                      {tab === 0 ? 'No courses in progress' : 'No completed courses yet'}
                    </h3>
                    <p className="mb-6">
                      {tab === 0
                        ? 'Browse the course catalog to start learning.'
                        : 'Complete your enrolled courses to see them here.'}
                    </p>
                    <Link
                      to="/dashboard/courses"
                      className="bg-primary text-white font-headline font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all"
                    >
                      Browse Courses
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {displayed.map((course) => {
                      const progress = getProgress(course.id);
                      const isCompleted = progress >= 100;

                      return (
                        <div
                          key={course.id}
                          className="group bg-surface-container-lowest p-8 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 relative overflow-hidden border border-surface-dim"
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-xs font-bold font-label">
                              {course.category || 'Course'}
                            </div>
                            <div className="relative flex items-center justify-center">
                              <CircleProgress pct={progress} size={64} />
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-label text-primary">
                                {Math.round(progress)}%
                              </div>
                            </div>
                          </div>

                          <h3 className="font-headline text-xl font-bold text-on-surface mb-3 group-hover:text-primary transition-colors line-clamp-2">
                            {course.title}
                          </h3>
                          <p className="text-on-surface-variant text-sm mb-6 font-body leading-relaxed line-clamp-2">
                            {course.description || 'No description available.'}
                          </p>

                          <Link
                            to={`/dashboard/learning/${course.id}`}
                            className="block w-full text-center bg-surface-container-low text-primary font-headline font-bold py-3 rounded-xl group-hover:bg-primary group-hover:text-white transition-all"
                          >
                            {isCompleted ? 'Review Course' : 'Resume Lesson'}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Learning Goals tab ── */}
            {tab === 2 && (
              <>
                {loading ? (
                  <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse w-1/2 rounded-full" />
                  </div>
                ) : learningGoals.length === 0 ? (
                  <div className="text-center py-16 text-on-surface-variant flex flex-col items-center">
                    <span className="material-symbols-outlined text-6xl opacity-20 mb-4 block">
                      flag
                    </span>
                    <h3 className="font-headline font-bold text-xl mb-2">No learning goals yet</h3>
                    <p>Your instructor or admin can assign learning goals to your account.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {learningGoals.map((goal) => {
                      const pct = Math.round(goal.progress_pct ?? 0);
                      const isCompleted = pct >= 100;
                      const targetDate = fmtDate(goal.target_date);
                      const now = new Date();
                      const isPastDue =
                        goal.target_date && !isCompleted && new Date(goal.target_date) < now;

                      return (
                        <div
                          key={goal.id}
                          className="bg-surface-container-lowest border border-surface-dim rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4"
                        >
                          {/* Circle progress */}
                          <div className="relative flex-shrink-0 flex items-center justify-center w-14 h-14">
                            <CircleProgress pct={pct} size={56} />
                            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-primary">
                              {pct}%
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-headline font-bold text-on-surface text-base truncate">
                              {goal.course_title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-bold">
                                  <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
                                  In Progress
                                </span>
                              )}
                              {targetDate && (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                                    isPastDue ? 'text-red-600' : 'text-on-surface-variant'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">
                                    {isPastDue ? 'warning' : 'calendar_month'}
                                  </span>
                                  {isPastDue ? 'Due ' : 'Target: '}
                                  {targetDate}
                                </span>
                              )}
                            </div>

                            {/* Progress bar */}
                            <div className="mt-2 h-1.5 bg-surface-container-high rounded-full overflow-hidden w-full max-w-xs">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  isCompleted ? 'bg-green-500' : 'bg-primary'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* CTA */}
                          <Link
                            to={`/dashboard/learning/${goal.course_id}`}
                            className="flex-shrink-0 px-4 py-2 text-sm font-headline font-bold text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                          >
                            {isCompleted ? 'Review' : 'Continue'}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Stats Sidebar */}
          <aside className="w-full lg:w-80 space-y-8 flex-shrink-0">
            <div className="bg-surface-container-low p-8 rounded-xl">
              <h4 className="font-headline font-bold text-primary mb-6 text-sm uppercase tracking-wider">
                Your Progress
              </h4>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined">school</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black font-headline text-primary">
                      {inProgress.length}
                    </div>
                    <div className="text-xs text-on-surface-variant font-label uppercase">
                      In Progress
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined">workspace_premium</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black font-headline text-primary">
                      {completed.length}
                    </div>
                    <div className="text-xs text-on-surface-variant font-label uppercase">
                      Courses Completed
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined">flag</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black font-headline text-primary">
                      {learningGoals.filter((g) => (g.progress_pct ?? 0) >= 100).length}/
                      {learningGoals.length}
                    </div>
                    <div className="text-xs text-on-surface-variant font-label uppercase">
                      Goals Met
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall goals progress bar */}
              {learningGoals.length > 0 && (
                <div className="mt-6 pt-6 border-t border-outline-variant">
                  <p className="text-xs font-bold text-on-surface-variant uppercase mb-2">
                    Goals Overall
                  </p>
                  <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{
                        width: `${
                          learningGoals.length > 0
                            ? Math.round(
                                learningGoals.reduce((sum, g) => sum + (g.progress_pct ?? 0), 0) /
                                  learningGoals.length
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Avg.{' '}
                    {learningGoals.length > 0
                      ? Math.round(
                          learningGoals.reduce((sum, g) => sum + (g.progress_pct ?? 0), 0) /
                            learningGoals.length
                        )
                      : 0}
                    % across all goals
                  </p>
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-outline-variant">
                <p className="text-sm font-medium italic text-on-surface-variant leading-relaxed">
                  "The beautiful thing about learning is that no one can take it away from you."
                </p>
                <p className="text-xs mt-2 font-bold text-primary">— B.B. King</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default MyLearning;
