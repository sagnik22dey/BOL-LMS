import { useState, useEffect } from 'react';
import api from '../../api/axios';

const inputClass = "w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all";

const AssignmentEditor = ({ material, courseId, moduleId, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignmentData, setAssignmentData] = useState({
    title: material.title || 'New Assignment',
    description: '',
  });

  useEffect(() => {
    if (material.file_key && material.file_key.length === 24) {
      setLoading(true);
      api.get(`/api/assignments/${material.file_key}`)
        .then((res) => { setAssignmentData(res.data); setLoading(false); })
        .catch((err) => { console.error(err); setError('Failed to load existing assignment.'); setLoading(false); });
    }
  }, [material.file_key]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/api/courses/${courseId}/modules/${moduleId}/assignments`, assignmentData);
      onSave(res.data.id);
    } catch (err) {
      console.error(err);
      setError('Failed to save assignment.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-6">
      <div className="w-7 h-7 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-[var(--text-primary)]">Assignment Title</label>
          <input
            className={inputClass}
            value={assignmentData.title}
            onChange={(e) => setAssignmentData({ ...assignmentData, title: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-[var(--text-primary)]">Description / Instructions</label>
          <textarea
            rows={6}
            className={inputClass + ' resize-none'}
            value={assignmentData.description}
            onChange={(e) => setAssignmentData({ ...assignmentData, description: e.target.value })}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60"
        >
          Save Assignment Configuration
        </button>
      </div>
    </div>
  );
};

export default AssignmentEditor;
