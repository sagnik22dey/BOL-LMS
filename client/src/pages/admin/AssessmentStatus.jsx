import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

/* ─── tiny helpers ─────────────────────────────────────────────────── */
const thCls = 'px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] text-left';
const tdCls = 'px-4 py-3 text-sm text-[var(--text-primary)]';

function Badge({ ok, label }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      ok ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
    }`}>
      {label}
    </span>
  );
}

/* ─── Quiz Detail Modal ─────────────────────────────────────────────── */
function QuizDetailModal({ sub, onClose, onGrade, courseId, moduleId }) {
  const [gradeMap, setGradeMap] = useState({ score: sub.score ?? 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasWritten = (sub.quiz_questions || []).some(q => q.type === 'written');

  const answerFor = (questionId) =>
    (sub.answers || []).find(a => a.question_id === questionId);

  const isCorrect = (q, ans) => {
    if (!ans) return false;
    if (q.type === 'mcq_single') {
      return ans.selected_index != null &&
        q.choices?.[ans.selected_index]?.is_right === true;
    }
    if (q.type === 'mcq_multi') {
      const correctIdxs = (q.choices || []).reduce((acc, ch, i) => ch.is_right ? [...acc, i] : acc, []);
      const sel = ans.selected_indices || [];
      return correctIdxs.length === sel.length &&
        correctIdxs.every(i => sel.includes(i));
    }
    return false;
  };

  const handleSaveGrade = async () => {
    setSaving(true);
    try {
      await api.patch(
        `/api/courses/${courseId}/modules/${moduleId}/submissions/${sub.id}/grade`,
        { score: Number(gradeMap.score) }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--outline)]">
          <div>
            <h3 className="font-bold text-[var(--text-primary)] text-base">{sub.quiz_title}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {sub.user_name} &bull; <span className="font-mono text-xs">{sub.user_email}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {sub.score} / {sub.max_score}
            </span>
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Questions scroll area */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {(sub.quiz_questions || []).map((q, qi) => {
            const ans = answerFor(q.id);
            const correct = isCorrect(q, ans);
            return (
              <div key={q.id} className="bg-[var(--surface-low)] rounded-xl p-4 border border-[var(--outline)]">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    <span className="text-[var(--text-secondary)] font-normal">Q{qi + 1}. </span>{q.text}
                  </p>
                  <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                </div>

                {/* MCQ Single */}
                {q.type === 'mcq_single' && (
                  <div className="space-y-1.5">
                    {(q.choices || []).map((ch, ci) => {
                      const isSelected = ans?.selected_index === ci;
                      const isRight = ch.is_right;
                      return (
                        <div key={ci} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                          isRight ? 'border-green-300 bg-green-50 text-green-800' :
                          isSelected && !isRight ? 'border-red-300 bg-red-50 text-red-700' :
                          'border-transparent text-[var(--text-secondary)]'
                        }`}>
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                            isSelected ? 'border-current' : 'border-[var(--outline)]'
                          }`}>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-current" />}
                          </span>
                          {ch.label}
                          {isRight && <span className="material-symbols-outlined text-sm ml-auto text-green-600">check_circle</span>}
                        </div>
                      );
                    })}
                    {!ans && <p className="text-xs text-[var(--text-secondary)] italic">No answer given</p>}
                  </div>
                )}

                {/* MCQ Multi */}
                {q.type === 'mcq_multi' && (
                  <div className="space-y-1.5">
                    {(q.choices || []).map((ch, ci) => {
                      const isSelected = (ans?.selected_indices || []).includes(ci);
                      const isRight = ch.is_right;
                      return (
                        <div key={ci} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                          isRight ? 'border-green-300 bg-green-50 text-green-800' :
                          isSelected && !isRight ? 'border-red-300 bg-red-50 text-red-700' :
                          'border-transparent text-[var(--text-secondary)]'
                        }`}>
                          <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                            isSelected ? 'border-current bg-current' : 'border-[var(--outline)]'
                          }`}>
                            {isSelected && <span className="material-symbols-outlined text-white text-xs">check</span>}
                          </span>
                          {ch.label}
                          {isRight && <span className="material-symbols-outlined text-sm ml-auto text-green-600">check_circle</span>}
                        </div>
                      );
                    })}
                    {!ans && <p className="text-xs text-[var(--text-secondary)] italic">No answer given</p>}
                    <p className={`text-xs font-semibold mt-1 ${correct ? 'text-green-700' : 'text-red-600'}`}>
                      {correct ? '✓ Correct' : '✗ Incorrect'}
                    </p>
                  </div>
                )}

                {/* Written */}
                {q.type === 'written' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Student's Answer</p>
                    <div className="bg-[var(--surface)] rounded-lg p-3 border border-[var(--outline)] text-sm text-[var(--text-primary)] min-h-[60px] whitespace-pre-wrap">
                      {ans?.written_answer || <span className="italic text-[var(--text-secondary)]">No answer provided</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Manual grade footer (only if written questions exist) */}
        {hasWritten && (
          <div className="border-t border-[var(--outline)] p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-[var(--text-primary)]">Manual Score</label>
              <input
                type="number"
                min={0}
                max={sub.max_score}
                value={gradeMap.score}
                onChange={e => setGradeMap({ score: e.target.value })}
                className="w-20 px-3 py-1.5 border border-[var(--outline)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--surface-low)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none"
              />
              <span className="text-sm text-[var(--text-secondary)]">/ {sub.max_score}</span>
            </div>
            <button
              onClick={handleSaveGrade}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : saved ? (
                <span className="material-symbols-outlined text-base">check</span>
              ) : (
                <span className="material-symbols-outlined text-base">save</span>
              )}
              {saved ? 'Saved!' : 'Save Grade'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
const AssessmentStatus = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assessments, setAssessments] = useState({ quizzes: [], assignments: [] });
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [detailSub, setDetailSub] = useState(null);

  useEffect(() => {
    api.get(`/api/courses/${courseId}`)
      .then((res) => {
        setCourse(res.data);
        if (res.data.modules?.length > 0) {
          setSelectedModuleId(res.data.modules[0].id);
        }
      })
      .catch(() => setError('Failed to load course details.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const fetchAssessments = useCallback(async (moduleId) => {
    setLoadingAssessments(true);
    setError('');
    try {
      const res = await api.get(`/api/courses/${courseId}/modules/${moduleId}/assessments`);
      setAssessments(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load assessments.');
    } finally {
      setLoadingAssessments(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (selectedModuleId) fetchAssessments(selectedModuleId);
  }, [selectedModuleId, fetchAssessments]);

  const handleUnlockQuiz = async (quizId, userId) => {
    try {
      await api.patch(`/api/courses/${courseId}/modules/${selectedModuleId}/quizzes/${quizId}/retake/${userId}`);
      fetchAssessments(selectedModuleId);
    } catch { alert('Failed to unlock retake'); }
  };

  const handleResetAssignment = async (assignmentId, userId) => {
    try {
      await api.patch(`/api/courses/${courseId}/modules/${selectedModuleId}/assignments/${assignmentId}/reset/${userId}`);
      fetchAssessments(selectedModuleId);
    } catch { alert('Failed to reset assignment'); }
  };

  const handleViewFile = async (filePath) => {
    try {
      const res = await api.get('/api/learning/presign-get', {
        params: { object_name: filePath, bucket: 'bol-lms-documents' }
      });
      if (res.data?.url) window.open(res.data.url, '_blank', 'noreferrer');
    } catch { alert('Failed to get file URL'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const quizzes = assessments.quizzes || [];
  const assignments = assessments.assignments || [];

  return (
    <div>
      {/* Back + title */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/dashboard/courses/builder/${courseId}`)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-high)] transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Course Edit
        </button>
        <div className="hidden sm:block w-px h-5 bg-[var(--outline)]" />
        <h2 className="text-base sm:text-xl font-extrabold font-headline text-[var(--text-primary)] min-w-0 truncate" style={{ letterSpacing: '-0.5px' }}>
          Assessment Status — {course?.title}
        </h2>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">
          {error}
        </div>
      )}

      <div className="premium-card p-6 mb-6">
        {/* Module selector */}
        <div className="mb-6">
          <label className="text-sm font-semibold text-[var(--text-primary)] mb-1.5 block">Select Module</label>
          <select
            value={selectedModuleId}
            onChange={(e) => setSelectedModuleId(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
          >
            {course?.modules?.map((mod) => (
              <option key={mod.id} value={mod.id}>{mod.title}</option>
            ))}
          </select>
        </div>

        {loadingAssessments ? (
          <div className="flex items-center justify-center py-14">
            <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Quiz Submissions ─────────────────────────────────── */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Quiz Submissions</h3>
                <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-low)] px-2 py-0.5 rounded-full">
                  {quizzes.length} submission{quizzes.length !== 1 ? 's' : ''}
                </span>
              </div>

              {quizzes.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No quiz submissions yet.</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    {quizzes.map((sub) => (
                      <div key={sub.id} className="bg-[var(--surface-low)] rounded-xl p-4 border border-[var(--outline)] space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{sub.user_name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{sub.user_email}</p>
                          </div>
                          <Badge ok={!sub.retake_allowed} label={sub.retake_allowed ? 'Retake Unlocked' : 'Submitted'} />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-semibold text-[var(--text-primary)]">
                            Score: {sub.score} / {sub.max_score}
                            {sub.is_graded && <span className="ml-1 text-xs text-[var(--primary)]">(graded)</span>}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)]">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{sub.quiz_title}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDetailSub(sub)}
                            className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                          >
                            View Answers
                          </button>
                          <button
                            disabled={sub.retake_allowed}
                            onClick={() => handleUnlockQuiz(sub.quiz_id, sub.user_id)}
                            className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--outline)] text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Unlock Retake
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="data-table-container hidden sm:block">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[var(--surface-low)] border-b border-[var(--outline)]">
                          <th className={thCls}>Student</th>
                          <th className={thCls}>Quiz</th>
                          <th className={thCls}>Score</th>
                          <th className={thCls}>Submitted At</th>
                          <th className={thCls}>Status</th>
                          <th className={thCls}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--outline)]">
                        {quizzes.map((sub) => (
                          <tr key={sub.id} className="hover:bg-[var(--surface)] transition-colors">
                            <td className={tdCls}>
                              <p className="font-semibold text-[var(--text-primary)] text-sm">{sub.user_name}</p>
                              <p className="text-xs text-[var(--text-secondary)]">{sub.user_email}</p>
                            </td>
                            <td className={tdCls + ' text-[var(--text-secondary)] text-xs max-w-[140px] truncate'}>{sub.quiz_title}</td>
                            <td className={tdCls}>
                              <span className="font-semibold">{sub.score}</span>
                              <span className="text-[var(--text-secondary)]"> / {sub.max_score}</span>
                              {sub.is_graded && (
                                <span className="ml-1.5 text-[10px] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded-full">graded</span>
                              )}
                            </td>
                            <td className={tdCls + ' text-[var(--text-secondary)] text-xs'}>
                              {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}
                            </td>
                            <td className={tdCls}>
                              <Badge ok={!sub.retake_allowed} label={sub.retake_allowed ? 'Retake Unlocked' : 'Submitted'} />
                            </td>
                            <td className={tdCls}>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setDetailSub(sub)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-sm">visibility</span>
                                  View
                                </button>
                                <button
                                  disabled={sub.retake_allowed}
                                  onClick={() => handleUnlockQuiz(sub.quiz_id, sub.user_id)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--outline)] text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Unlock Retake
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* ── Assignment Submissions ───────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Assignment Submissions</h3>
                <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-low)] px-2 py-0.5 rounded-full">
                  {assignments.length} submission{assignments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {assignments.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No assignment submissions yet.</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    {assignments.map((sub) => (
                      <div key={sub.id} className="bg-[var(--surface-low)] rounded-xl p-4 border border-[var(--outline)] space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{sub.user_name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{sub.user_email}</p>
                          </div>
                          <Badge ok={!sub.retake_allowed} label={sub.retake_allowed ? 'Retake Allowed' : 'Submitted'} />
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{sub.assignment_title}</p>
                        <div className="flex justify-between items-center">
                          <button
                            onClick={() => handleViewFile(sub.file_path)}
                            className="text-[var(--primary)] font-medium text-xs hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                            View File
                          </button>
                          <span className="text-xs text-[var(--text-secondary)]">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                        </div>
                        <button
                          disabled={sub.retake_allowed}
                          onClick={() => handleResetAssignment(sub.assignment_id, sub.user_id)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-[#f5c6c6] text-[#ba1a1a] hover:bg-[#fdecea] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reset Submission
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="data-table-container hidden sm:block">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[var(--surface-low)] border-b border-[var(--outline)]">
                          <th className={thCls}>Student</th>
                          <th className={thCls}>Assignment</th>
                          <th className={thCls}>File</th>
                          <th className={thCls}>Submitted At</th>
                          <th className={thCls}>Status</th>
                          <th className={thCls}>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--outline)]">
                        {assignments.map((sub) => (
                          <tr key={sub.id} className="hover:bg-[var(--surface)] transition-colors">
                            <td className={tdCls}>
                              <p className="font-semibold text-[var(--text-primary)] text-sm">{sub.user_name}</p>
                              <p className="text-xs text-[var(--text-secondary)]">{sub.user_email}</p>
                            </td>
                            <td className={tdCls + ' text-[var(--text-secondary)] text-xs max-w-[140px] truncate'}>{sub.assignment_title}</td>
                            <td className={tdCls}>
                              <button
                                onClick={() => handleViewFile(sub.file_path)}
                                className="text-[var(--primary)] font-medium text-xs hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
                              >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                View File
                              </button>
                            </td>
                            <td className={tdCls + ' text-[var(--text-secondary)] text-xs'}>
                              {new Date(sub.submitted_at).toLocaleString()}
                            </td>
                            <td className={tdCls}>
                              <Badge ok={!sub.retake_allowed} label={sub.retake_allowed ? 'Retake Allowed' : 'Submitted'} />
                            </td>
                            <td className={tdCls}>
                              <button
                                disabled={sub.retake_allowed}
                                onClick={() => handleResetAssignment(sub.assignment_id, sub.user_id)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#f5c6c6] text-[#ba1a1a] hover:bg-[#fdecea] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Reset Submission
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quiz detail / grading modal */}
      {detailSub && (
        <QuizDetailModal
          sub={detailSub}
          onClose={() => setDetailSub(null)}
          courseId={courseId}
          moduleId={selectedModuleId}
        />
      )}
    </div>
  );
};

export default AssessmentStatus;
