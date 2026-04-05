import { useState, useEffect } from 'react';
import api from '../../api/axios';

const inputClass = "w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all";
const iconBtn = "p-1.5 rounded-lg hover:bg-[var(--surface-high)] text-[var(--text-secondary)] transition-colors";

const QuizEditor = ({ material, courseId, moduleId, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quizData, setQuizData] = useState({
    title: material.title || 'New Quiz',
    time_limit_mins: 15,
    questions: [],
  });

  useEffect(() => {
    if (material.file_key && material.file_key.trim().length > 0) {
      setLoading(true);
      api.get(`/api/quizzes/${material.file_key}`)
        .then((res) => { setQuizData(res.data); setLoading(false); })
        .catch((err) => { console.error(err); setError('Failed to load existing quiz.'); setLoading(false); });
    }
  }, [material.file_key]);

  const handleAddQuestion = () => {
    setQuizData({
      ...quizData,
      questions: [...quizData.questions, { text: '', type: 'mcq_single', points: 1, choices: [{ label: '', is_right: false }, { label: '', is_right: false }] }],
    });
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...quizData.questions];
    updated[index][field] = value;
    setQuizData({ ...quizData, questions: updated });
  };

  const handleChoiceChange = (qIndex, cIndex, field, value) => {
    const updated = [...quizData.questions];
    if (updated[qIndex].type === 'mcq_single' && field === 'is_right' && value === true) {
      updated[qIndex].choices.forEach((c) => (c.is_right = false));
    }
    updated[qIndex].choices[cIndex][field] = value;
    setQuizData({ ...quizData, questions: updated });
  };

  const handleAddChoice = (qIndex) => {
    const updated = [...quizData.questions];
    updated[qIndex].choices.push({ label: '', is_right: false });
    setQuizData({ ...quizData, questions: updated });
  };

  const handleRemoveChoice = (qIndex, cIndex) => {
    const updated = [...quizData.questions];
    updated[qIndex].choices.splice(cIndex, 1);
    setQuizData({ ...quizData, questions: updated });
  };

  const handleRemoveQuestion = (index) => {
    const updated = [...quizData.questions];
    updated.splice(index, 1);
    setQuizData({ ...quizData, questions: updated });
  };

  const handleSubmit = async () => {
    if (!quizData.title || quizData.questions.length === 0) {
      alert('Please add at least one question');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (material.file_key && material.file_key.trim().length > 0) {
        // Update existing quiz
        await api.put(
          `/api/courses/${courseId}/modules/${moduleId}/quizzes/${material.file_key}`,
          quizData
        );
        onSave(material.file_key);
      } else {
        // Create new quiz
        const res = await api.post(`/api/courses/${courseId}/modules/${moduleId}/quizzes`, quizData);
        onSave(res.data.id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to save quiz to backend.');
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

      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-[var(--text-primary)]">Quiz Title</label>
          <input className={inputClass} value={quizData.title} onChange={(e) => setQuizData({ ...quizData, title: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-[var(--text-primary)]">Time Limit (Minutes)</label>
          <input type="number" className={inputClass} value={quizData.time_limit_mins} onChange={(e) => setQuizData({ ...quizData, time_limit_mins: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      <h4 className="font-bold text-sm text-[var(--text-primary)] mb-3">Questions</h4>

      {quizData.questions.map((q, qIndex) => (
        <div key={qIndex} className="border border-[var(--outline)] rounded-2xl p-4 mb-3 bg-[var(--surface-lowest)]">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-sm text-[var(--text-primary)]">Question {qIndex + 1}</span>
            <button onClick={() => handleRemoveQuestion(qIndex)} className={iconBtn + ' text-[#ba1a1a] hover:bg-[#fdecea]'}>
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <textarea
              rows={2}
              className={inputClass + ' resize-none'}
              placeholder="Question text…"
              value={q.text}
              onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Type</label>
                <select className={inputClass} value={q.type} onChange={(e) => handleQuestionChange(qIndex, 'type', e.target.value)}>
                  <option value="mcq_single">Single Select MCQ</option>
                  <option value="mcq_multi">Multi-Select MCQ</option>
                  <option value="written">Written</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Points</label>
                <input type="number" className={inputClass} value={q.points} onChange={(e) => handleQuestionChange(qIndex, 'points', parseInt(e.target.value) || 1)} />
              </div>
            </div>

            {(q.type === 'mcq_single' || q.type === 'mcq_multi') && (
              <div className="ml-2">
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Choices</p>
                {q.choices.map((c, cIndex) => (
                  <div key={cIndex} className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => handleChoiceChange(qIndex, cIndex, 'is_right', !c.is_right)}
                      className={`min-w-[36px] h-9 rounded-lg text-xs font-bold transition-colors flex items-center justify-center ${c.is_right ? 'bg-[#e6f4ea] text-[#1e7e34] border border-[#b7dfbe]' : 'bg-[var(--surface-high)] text-[var(--text-secondary)] border border-[var(--outline)]'}`}
                    >
                      {c.is_right ? '✓' : ''}
                    </button>
                    <input
                      className={inputClass}
                      placeholder="Choice label…"
                      value={c.label}
                      onChange={(e) => handleChoiceChange(qIndex, cIndex, 'label', e.target.value)}
                    />
                    <button onClick={() => handleRemoveChoice(qIndex, cIndex)} className={iconBtn + ' text-[#ba1a1a] hover:bg-[#fdecea]'}>
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => handleAddChoice(qIndex)}
                  className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline mt-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span> Add Choice
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={handleAddQuestion}
        className="flex items-center gap-2 w-full justify-center py-2.5 mb-4 rounded-xl border border-dashed border-[var(--outline)] text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--surface-low)] transition-all"
      >
        <span className="material-symbols-outlined text-base">add</span> Add Question
      </button>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60"
      >
        Save Quiz Configuration
      </button>
    </div>
  );
};

export default QuizEditor;
