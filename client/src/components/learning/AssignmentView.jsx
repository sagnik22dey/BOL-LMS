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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const aRes = await api.get(`/api/assignments/${assignmentId}`);
        setAssignment(aRes.data);

        try {
          const sRes = await api.get(`/api/assignments/${assignmentId}/my-submission`);
          if (sRes.data) setSubmission(sRes.data);
        } catch (subErr) {
          if (subErr.response?.status !== 404) console.error(subErr);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load assignment. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [assignmentId]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    const icons = { pdf: 'picture_as_pdf', doc: 'description', docx: 'description', jpg: 'image', jpeg: 'image', png: 'image', xlsx: 'table_chart', pptx: 'slideshow' };
    return icons[ext] || 'attach_file';
  };

  const handleSubmit = async () => {
    if (!file) { setError('Please select a file to submit.'); return; }
    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const objectName = `assignments/${assignment.module_id}/${Date.now()}_${file.name}`;

      // Use the student-accessible presign-put endpoint (not the admin-only /api/courses/presign)
      const { data } = await api.post('/api/learning/presign-put', {
        bucket: 'bol-lms-documents',
        object_name: objectName,
        expiry_mins: 15,
      });

      // Upload directly to storage with progress tracking
      await axios.put(data.url, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(pct);
        },
      });

      await api.post(`/api/assignments/${assignmentId}/submit`, { file_path: objectName });

      // Reload submission data
      const sRes = await api.get(`/api/assignments/${assignmentId}/my-submission`);
      setSubmission(sRes.data);
      setFile(null);
      setUploadProgress(0);
    } catch (err) {
      console.error(err);
      setError('Failed to upload assignment. Please check your connection and try again.');
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
      setError('Failed to get download URL. Please try again.');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm font-medium">Loading assignment…</p>
    </div>
  );

  if (error && !assignment) return (
    <div className="max-w-2xl mx-auto mt-8 p-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
      <span className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5">error</span>
      <div>
        <p className="font-bold text-sm">Error</p>
        <p className="text-sm mt-0.5">{error}</p>
      </div>
    </div>
  );

  if (!assignment) return null;

  const isSubmitted = submission && !submission.retake_allowed;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-8 text-white">
          <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold uppercase tracking-widest mb-3">
            <span className="material-symbols-outlined text-base">assignment</span>
            Assignment
          </div>
          <h2 className="text-2xl font-extrabold leading-tight">{assignment.title}</h2>
        </div>

        {/* Instructions */}
        <div className="px-8 py-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Instructions</h3>
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
              {assignment.description || 'No instructions provided. Please contact your instructor if you have questions.'}
            </p>
          </div>

          {/* Accepted formats info */}
          <div className="mt-4 flex flex-wrap gap-2">
            {['PDF', 'DOCX', 'JPG', 'PNG', 'XLSX', 'PPTX'].map(fmt => (
              <span key={fmt} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-mono font-semibold">.{fmt.toLowerCase()}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
          <span className="material-symbols-outlined text-xl flex-shrink-0">error</span>
          <div>
            <p className="font-bold text-sm">Upload Error</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Submitted state */}
      {isSubmitted ? (
        <div className="bg-white rounded-3xl border border-green-200 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-br from-green-50 to-emerald-50 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-green-600 text-3xl">task_alt</span>
            </div>
            <div>
              <h3 className="font-extrabold text-green-800 text-lg">Submitted Successfully!</h3>
              <p className="text-green-600 text-sm mt-0.5">Your assignment is under review by the instructor.</p>
            </div>
          </div>

          {submission?.file_path && (
            <div className="px-8 py-5 border-t border-green-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Submitted File</p>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-blue-600 text-xl">
                    {getFileIcon(submission.file_path)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {submission.file_path.split('/').pop()}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Submitted file</p>
                </div>
                <button
                  onClick={() => handleDownload(submission.file_path)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download
                </button>
              </div>
            </div>
          )}

          {submission?.retake_allowed === false && (
            <div className="px-8 py-4 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-amber-700 text-sm">
              <span className="material-symbols-outlined text-base">info</span>
              Contact your instructor if you need to resubmit.
            </div>
          )}
        </div>
      ) : (
        /* Upload state */
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Submit Your Work</h3>
            <p className="text-sm text-gray-500 mt-0.5">Upload your completed assignment file below.</p>
          </div>

          <div className="px-8 py-6">
            {/* Drop zone */}
            <label
              htmlFor="assignment-file"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : file
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {file ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600 text-3xl">{getFileIcon(file.name)}</span>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-800 text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatFileSize(file.size)}</p>
                  </div>
                  <span className="text-xs text-gray-400 px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors">
                    Change file
                  </span>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-gray-400 text-3xl">upload_file</span>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-700 text-sm">Drag & drop your file here</p>
                    <p className="text-xs text-gray-400 mt-1">or click to browse your computer</p>
                  </div>
                  <span className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:border-blue-300 hover:text-blue-700 transition-all">
                    Choose File
                  </span>
                </>
              )}
            </label>
            <input
              type="file"
              id="assignment-file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.pptx"
              onChange={handleFileChange}
              disabled={uploading}
            />

            {/* Upload progress */}
            {uploading && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-600">Uploading…</p>
                  <p className="text-xs font-bold text-blue-600">{uploadProgress}%</p>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit button */}
            {file && !uploading && (
              <button
                onClick={handleSubmit}
                className="w-full mt-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
              >
                <span className="material-symbols-outlined text-xl">send</span>
                Submit Assignment
              </button>
            )}

            {uploading && (
              <button
                disabled
                className="w-full mt-5 py-4 bg-blue-600 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
              >
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentView;
