import { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../../api/axios';

const AssignmentView = ({ assignmentId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const aRes = await api.get(`/api/assignments/${assignmentId}`);
        setAssignment(aRes.data);

        try {
          const sRes = await api.get(`/api/assignments/${assignmentId}/my-submission`);
          setSubmission(sRes.data);
        } catch (subErr) {
          if (subErr.response?.status !== 404) console.error(subErr);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load assignment');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [assignmentId]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) { setError('Please select a file to submit.'); return; }
    setUploading(true);
    setError('');

    try {
      const objectName = `assignments/${assignment.module_id}/${Date.now()}_${file.name}`;
      const { data } = await api.post('/api/courses/presign', {
        bucket: 'bol-lms-documents',
        object_name: objectName,
        expiry_mins: 15,
      });
      await axios.put(data.url, file, { headers: { 'Content-Type': file.type } });
      await api.post(`/api/assignments/${assignmentId}/submit`, { file_path: objectName });
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError('Failed to upload assignment.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath) => {
    try {
      const res = await api.get('/api/learning/presign-get', {
        params: { object_name: filePath, bucket: 'bol-lms-documents' }
      });
      if (res.data && res.data.url) {
        window.open(res.data.url, '_blank', 'noreferrer');
      }
    } catch (err) {
      console.error('Failed to get download URL', err);
      alert('Failed to get download URL');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error && !assignment) return <div className="px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>;
  if (!assignment) return null;

  const isSubmitted = submission && !submission.retake_allowed;

  return (
    <div className="p-2 md:p-4">
      <h3 className="text-xl font-extrabold font-headline text-[var(--primary)] mb-4">{assignment.title}</h3>

      <div className="p-4 bg-[var(--surface-low)] rounded-2xl border border-[var(--outline)] mb-6">
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
          {assignment.description || 'No instructions provided.'}
        </p>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>}

      {isSubmitted ? (
        <div className="px-4 py-4 rounded-xl bg-[#e6f4ea] border border-[#b7dfbe] text-[#1e7e34]">
          <p className="font-bold text-base">Assignment Submitted Successfully</p>
          <p className="text-sm mt-0.5 mb-2">Your file has been received and is pending review.</p>
          {submission.file_path && (
            <button 
              onClick={() => handleDownload(submission.file_path)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1565c0] hover:underline bg-transparent border-none cursor-pointer p-0"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download My Submission
            </button>
          )}
        </div>
      ) : (
        <div>
          <label
            htmlFor="assignment-file"
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--surface-high)] rounded-2xl p-10 cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--surface-low)] transition-all"
          >
            <span className="material-symbols-outlined text-4xl text-[var(--text-secondary)]">upload_file</span>
            <span className="px-6 py-2.5 rounded-full border border-[var(--outline)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition-colors">Choose File</span>
            <p className="text-sm text-[var(--text-secondary)] font-medium">
              {file ? file.name : 'Accepted formats: PDF, DOCX, JPG, PNG'}
            </p>
          </label>
          <input
            type="file"
            id="assignment-file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.pptx"
            onChange={handleFileChange}
          />

          {file && (
            <button
              onClick={handleSubmit}
              disabled={uploading}
              className="w-full mt-4 py-3.5 rounded-full bg-[var(--primary)] text-white font-bold text-base hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading…' : 'Submit Assignment'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AssignmentView;
