import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const AssessmentStatus = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [assessments, setAssessments] = useState({ quizzes: [], assignments: [] });
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  useEffect(() => {
    api.get(`/api/courses/${courseId}`)
      .then((res) => {
        setCourse(res.data);
        if (res.data.modules && res.data.modules.length > 0) {
          setSelectedModuleId(res.data.modules[0].id);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load course details.');
        setLoading(false);
      });
  }, [courseId]);

  useEffect(() => {
    if (selectedModuleId) {
      fetchAssessments(selectedModuleId);
    }
  }, [selectedModuleId]);

  const fetchAssessments = async (moduleId) => {
    setLoadingAssessments(true);
    try {
      const res = await api.get(`/api/courses/${courseId}/modules/${moduleId}/assessments`);
      setAssessments(res.data);
    } catch {
      setError('Failed to load assessments.');
    } finally {
      setLoadingAssessments(false);
    }
  };

  const handleUnlockQuiz = async (quizId, userId) => {
    try {
      await api.patch(`/api/courses/${courseId}/modules/${selectedModuleId}/quizzes/${quizId}/retake/${userId}`);
      fetchAssessments(selectedModuleId);
    } catch {
      alert('Failed to unlock retake');
    }
  };

  const handleResetAssignment = async (assignmentId, userId) => {
    try {
      await api.patch(`/api/courses/${courseId}/modules/${selectedModuleId}/assignments/${assignmentId}/reset/${userId}`);
      fetchAssessments(selectedModuleId);
    } catch {
      alert('Failed to reset assignment');
    }
  };

  const handleViewFile = async (filePath) => {
    try {
      const res = await api.get('/api/learning/presign-get', {
        params: { object_name: filePath, bucket: 'bol-lms-documents' }
      });
      if (res.data && res.data.url) {
        window.open(res.data.url, '_blank', 'noreferrer');
      }
    } catch (err) {
      console.error('Failed to get file URL', err);
      alert('Failed to get file URL');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const thClass = "px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] text-left";
  const tdClass = "px-4 py-3 text-sm text-[var(--text-primary)]";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/dashboard/courses/builder/${courseId}`)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-high)] transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Course Edit
        </button>
        <div className="w-px h-5 bg-[var(--outline)]" />
        <h2 className="text-xl font-extrabold font-headline text-[var(--text-primary)]" style={{ letterSpacing: '-0.5px' }}>
          Assessment Status — {course?.title}
        </h2>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>}

      <div className="premium-card p-6 mb-6">
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
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Quiz Submissions */}
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 mt-2">Quiz Submissions</h3>
            {(assessments.quizzes || []).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] mb-6">No quiz submissions yet.</p>
            ) : (
              <div className="data-table-container mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--surface-low)] border-b border-[var(--outline)]">
                      <th className={thClass}>User ID</th>
                      <th className={thClass}>Score</th>
                      <th className={thClass}>Submitted At</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline)]">
                    {(assessments.quizzes || []).map((sub) => (
                      <tr key={sub.id} className="hover:bg-[var(--surface)] transition-colors">
                        <td className={tdClass + ' font-mono text-xs'}>{sub.user_id}</td>
                        <td className={tdClass}>{sub.score} / {sub.max_score}</td>
                        <td className={tdClass + ' text-[var(--text-secondary)] text-xs'}>{new Date(sub.submitted_at).toLocaleString()}</td>
                        <td className={tdClass}>
                          <span className={`badge ${sub.retake_allowed ? 'badge-warning' : 'badge-success'}`}>
                            {sub.retake_allowed ? 'Retake Unlocked' : 'Submitted'}
                          </span>
                        </td>
                        <td className={tdClass}>
                          <button
                            disabled={sub.retake_allowed}
                            onClick={() => handleUnlockQuiz(sub.quiz_id, sub.user_id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--outline)] text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Unlock Retake
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Assignment Submissions */}
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 mt-6">Assignment Submissions</h3>
            {(assessments.assignments || []).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No assignment submissions yet.</p>
            ) : (
              <div className="data-table-container">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--surface-low)] border-b border-[var(--outline)]">
                      <th className={thClass}>User ID</th>
                      <th className={thClass}>File</th>
                      <th className={thClass}>Submitted At</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline)]">
                    {(assessments.assignments || []).map((sub) => (
                      <tr key={sub.id} className="hover:bg-[var(--surface)] transition-colors">
                        <td className={tdClass + ' font-mono text-xs'}>{sub.user_id}</td>
                        <td className={tdClass}>
                          <button
                            onClick={() => handleViewFile(sub.file_path)}
                            className="text-[var(--primary)] font-medium text-xs hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                            View File
                          </button>
                        </td>
                        <td className={tdClass + ' text-[var(--text-secondary)] text-xs'}>{new Date(sub.submitted_at).toLocaleString()}</td>
                        <td className={tdClass}>
                          <span className={`badge ${sub.retake_allowed ? 'badge-warning' : 'badge-success'}`}>
                            {sub.retake_allowed ? 'Retake Allowed' : 'Submitted'}
                          </span>
                        </td>
                        <td className={tdClass}>
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AssessmentStatus;
