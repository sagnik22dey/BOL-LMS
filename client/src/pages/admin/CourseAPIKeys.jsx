import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { useCourseStore } from '../../store/courseStore';

// ─── tiny helpers ────────────────────────────────────────────────────────────

const copyToClipboard = (text) => navigator.clipboard?.writeText(text);

function Badge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
        active
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`} />
      {active ? 'Active' : 'Revoked'}
    </span>
  );
}

// ─── KeyRow ──────────────────────────────────────────────────────────────────

function KeyRow({ k, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(k.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const masked = k.key.slice(0, 8) + '•'.repeat(20) + k.key.slice(-4);

  return (
    <tr className="hover:bg-[var(--surface)] transition-colors border-b border-[var(--outline-variant)]">
      {/* Label */}
      <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{k.label}</td>

      {/* Key */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <code className="text-xs bg-[var(--surface-low)] text-[var(--text-secondary)] px-2 py-1 rounded-lg font-mono break-all">
            {revealed ? k.key : masked}
          </code>
          <button
            onClick={() => setRevealed((v) => !v)}
            title={revealed ? 'Hide key' : 'Reveal key'}
            className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors flex-shrink-0"
          >
            {revealed ? (
              // eye-off
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              // eye
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors flex-shrink-0"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge active={k.is_active} />
      </td>

      {/* Created */}
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
        {new Date(k.created_at).toLocaleDateString()}
      </td>

      {/* Revoked */}
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
        {k.revoked_at ? new Date(k.revoked_at).toLocaleDateString() : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        {k.is_active && (
          <button
            onClick={() => onRevoke(k.id)}
            className="text-xs font-semibold px-3 py-1 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseAPIKeys() {
  const { courses, fetchCourses } = useCourseStore();

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Generate key form
  const [label, setLabel] = useState('');
  const [generating, setGenerating] = useState(false);

  // Integration guide toggle
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const loadKeys = useCallback(async (courseId) => {
    if (!courseId) { setKeys([]); return; }
    setLoadingKeys(true);
    setError('');
    try {
      const { data } = await api.get(`/api/admin/courses/${courseId}/api-keys`);
      setKeys(data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load API keys.');
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    loadKeys(selectedCourseId);
  }, [selectedCourseId, loadKeys]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) { setError('Please select a course first.'); return; }
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post(`/api/admin/courses/${selectedCourseId}/api-keys`, {
        course_id: selectedCourseId,
        label: label.trim() || 'API Key',
      });
      setKeys((prev) => [data, ...prev]);
      setLabel('');
      setSuccess('API key generated successfully. Copy it now – it is shown in full below.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not generate API key.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId) => {
    if (!window.confirm('Revoke this API key? Third-party websites using it will immediately lose the ability to provision access.')) return;
    setError('');
    try {
      await api.delete(`/api/admin/api-keys/${keyId}`);
      setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, is_active: false, revoked_at: new Date().toISOString() } : k));
      setSuccess('API key revoked.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not revoke API key.');
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // Example snippet for the integration guide
  const exampleKey = keys.find((k) => k.is_active)?.key || 'lms_<your-api-key>';
  const provisionUrl = `${window.location.origin.replace(':5173', ':8080')}/api/external/provision`;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold font-headline text-[var(--text-primary)]">
          Course API Keys
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Generate per-course API keys and share them with third-party websites so they can
          automatically grant students access after a purchase.
        </p>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* ── Course selector + generate form ───────────────────────────────── */}
      <div className="bg-[var(--surface-low)] rounded-3xl border border-[var(--outline-variant)] p-6 space-y-5">
        <h2 className="font-semibold text-[var(--text-primary)] font-headline">Generate a New Key</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Course */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
            >
              <option value="">— select a course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Label <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main website, Partner store"
              className="w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!selectedCourseId || generating}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          )}
          {generating ? 'Generating…' : 'Generate API Key'}
        </button>
      </div>

      {/* ── Keys table ────────────────────────────────────────────────────── */}
      {selectedCourseId && (
        <div className="bg-[var(--surface-low)] rounded-3xl border border-[var(--outline-variant)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--outline-variant)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--text-primary)] font-headline">
              Keys for&nbsp;
              <span className="text-[var(--primary)]">{selectedCourse?.title}</span>
            </h2>
            <span className="text-xs text-[var(--text-secondary)]">{keys.length} key{keys.length !== 1 ? 's' : ''}</span>
          </div>

          {loadingKeys ? (
            <div className="flex justify-center py-12">
              <svg className="w-6 h-6 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            </div>
          ) : keys.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-secondary)] py-12">
              No API keys yet. Generate one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[var(--text-secondary)] bg-[var(--surface)]">
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Revoked</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <KeyRow key={k.id} k={k} onRevoke={handleRevoke} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Integration guide ─────────────────────────────────────────────── */}
      <div className="bg-[var(--surface-low)] rounded-3xl border border-[var(--outline-variant)] overflow-hidden">
        <button
          onClick={() => setShowGuide((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[var(--surface)] transition-colors"
        >
          <span className="font-semibold text-[var(--text-primary)] font-headline">
            📖 Third-party Integration Guide
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-5 h-5 text-[var(--text-secondary)] transition-transform ${showGuide ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showGuide && (
          <div className="px-6 pb-6 space-y-4 text-sm text-[var(--text-secondary)]">
            <p>
              After generating a key for a course, share it with the third-party website owner.
              Once a customer completes a purchase on their site, they must send a&nbsp;
              <code className="bg-[var(--surface)] px-1 rounded">POST</code> request to the LMS
              provision endpoint with the key in the&nbsp;
              <code className="bg-[var(--surface)] px-1 rounded">X-API-Key</code> header.
            </p>

            <div>
              <p className="font-semibold text-[var(--text-primary)] mb-2">Endpoint</p>
              <code className="block bg-[var(--surface)] rounded-xl px-4 py-3 text-xs font-mono break-all">
                POST {provisionUrl}
              </code>
            </div>

            <div>
              <p className="font-semibold text-[var(--text-primary)] mb-2">Headers</p>
              <pre className="bg-[var(--surface)] rounded-xl px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{`X-API-Key: ${exampleKey}
Content-Type: application/json`}</pre>
            </div>

            <div>
              <p className="font-semibold text-[var(--text-primary)] mb-2">Request Body</p>
              <pre className="bg-[var(--surface)] rounded-xl px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{`{
  "email": "customer@example.com",
  "name":  "Customer Name"        // optional – used only when creating a new account
}`}</pre>
            </div>

            <div>
              <p className="font-semibold text-[var(--text-primary)] mb-2">Success Response&nbsp;<span className="font-normal text-green-600">200 OK</span></p>
              <pre className="bg-[var(--surface)] rounded-xl px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{`{
  "user_id":     "uuid",
  "course_id":   "uuid",
  "email":       "customer@example.com",
  "is_new_user": false,
  "assigned_at": "2026-01-01T12:00:00Z"
}`}</pre>
            </div>

            <div>
              <p className="font-semibold text-[var(--text-primary)] mb-2">Error Responses</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code className="bg-[var(--surface)] px-1 rounded">401</code> – missing or revoked <code className="bg-[var(--surface)] px-1 rounded">X-API-Key</code></li>
                <li><code className="bg-[var(--surface)] px-1 rounded">400</code> – missing or invalid <code className="bg-[var(--surface)] px-1 rounded">email</code> field</li>
                <li><code className="bg-[var(--surface)] px-1 rounded">403</code> – user account is suspended</li>
                <li><code className="bg-[var(--surface)] px-1 rounded">500</code> – internal server error</li>
              </ul>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Security Notes</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-400">
                <li>Each key is scoped to exactly one course — it cannot provision access to any other course.</li>
                <li>Store API keys as server-side secrets; never expose them in client-side JavaScript.</li>
                <li>Revoke keys immediately if a third-party integration is decommissioned.</li>
                <li>If a new user account is created, they will receive a random password. Encourage them to use "Forgot Password" to set their own.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
