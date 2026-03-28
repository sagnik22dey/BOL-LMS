import { useState, useEffect } from 'react';
import api from '../../api/axios';

const QuizView = ({ quizId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const qRes = await api.get(`/api/quizzes/${quizId}`);
        setQuiz(qRes.data);

        try {
          const sRes = await api.get(`/api/quizzes/${quizId}/my-submission`);
          setSubmission(sRes.data);

          if (sRes.data && !sRes.data.submitted_at) {
            const startedDate = new Date(sRes.data.started_at);
            const timeLimitMs = qRes.data.time_limit_mins * 60 * 1000;
            const expiresAt = startedDate.getTime() + timeLimitMs;
            const remaining = Math.max(0, expiresAt - Date.now());
            setTimeLeft(Math.floor(remaining / 1000));
          }

          if (sRes.data?.answers) {
            const ansMap = {};
            sRes.data.answers.forEach((a) => { ansMap[a.question_id] = a; });
            setAnswers(ansMap);
          }
        } catch (subErr) {
          if (subErr.response?.status !== 404) console.error(subErr);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quizId]);

  useEffect(() => {
    let timer;
    if (timeLeft !== null && timeLeft > 0 && submission && !submission.submitted_at) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { clearInterval(timer); handleSubmit(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [timeLeft, submission]);

  const handleStart = async () => {
    try {
      setLoading(true);
      await api.post(`/api/quizzes/${quizId}/start`);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError('Failed to start quiz');
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payloadAnswers = Object.values(answers);
      await api.post(`/api/quizzes/${quizId}/submit`, { answers: payloadAnswers });
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError('Failed to submit quiz');
      setIsSubmitting(false);
    }
  };

  const handleSingleChange = (questionId, index) => {
    setAnswers({ ...answers, [questionId]: { question_id: questionId, selected_index: index, selected_indices: null } });
  };

  const handleMultiChange = (questionId, index, isChecked) => {
    const prev = answers[questionId]?.selected_indices || [];
    const next = isChecked ? [...prev, index] : prev.filter((i) => i !== index);
    setAnswers({ ...answers, [questionId]: { question_id: questionId, selected_index: null, selected_indices: next } });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return <div className="px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>;
  if (!quiz) return null;

  const isSubmitted = submission && submission.submitted_at && !submission.retake_allowed;

  if (!submission || (submission.submitted_at && submission.retake_allowed)) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-xl font-extrabold font-headline text-[var(--primary)] mb-2">{quiz.title}</h3>
        <p className="text-[var(--text-secondary)] text-base mb-6">
          Time Limit: <strong className="text-[var(--text-primary)]">{quiz.time_limit_mins} Minutes</strong>
        </p>
        <button
          onClick={handleStart}
          className="px-8 py-3 rounded-full bg-[var(--primary)] text-white font-bold text-base hover:bg-[var(--primary-dark)] transition-colors"
        >
          {submission?.retake_allowed ? 'Start Retake' : 'Start Quiz'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4">
      <div className="flex justify-between items-center mb-6 p-4 bg-[var(--surface-low)] rounded-2xl border border-[var(--outline)]">
        <h3 className="text-lg font-extrabold text-[var(--primary)] font-headline">{quiz.title}</h3>
        {!isSubmitted && (
          <span className={`font-bold text-base ${(timeLeft || 0) < 60 ? 'text-[#ba1a1a]' : 'text-[var(--text-primary)]'}`}>
            Time Remaining: {formatTime(timeLeft || 0)}
          </span>
        )}
      </div>

      {isSubmitted && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-[#e8f0fe] border border-[#c5d4f7] text-[#1565c0]">
          <p className="font-bold text-base">Quiz Submitted</p>
          <p className="text-sm mt-0.5">You scored {submission.score} out of {submission.max_score} points.</p>
        </div>
      )}

      {quiz.questions?.map((q, qIndex) => {
        const ans = answers[q.id];
        return (
          <div key={q.id} className="mb-5 p-5 rounded-2xl border border-[var(--outline)] bg-[var(--surface-lowest)] shadow-[var(--shadow-sm)]">
            <p className="font-bold text-base text-[var(--text-primary)] mb-3">
              {qIndex + 1}. {q.text}{' '}
              <span className="text-[var(--text-secondary)] font-normal text-sm">({q.points} pt)</span>
            </p>

            {q.type === 'mcq_single' && (
              <div className="flex flex-col gap-2">
                {q.choices?.map((c, cIndex) => {
                  let labelColor = 'text-[var(--text-primary)]';
                  let labelWeight = 'font-medium';
                  if (isSubmitted) {
                    if (c.is_right) { labelColor = 'text-[#1e7e34]'; labelWeight = 'font-bold'; }
                    else if (ans?.selected_index === cIndex && !c.is_right) { labelColor = 'text-[#ba1a1a]'; }
                  }
                  return (
                    <label key={cIndex} className={`flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-[var(--surface-low)] transition-colors ${isSubmitted ? 'cursor-default' : ''}`}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={cIndex}
                        checked={ans?.selected_index === cIndex}
                        onChange={() => handleSingleChange(q.id, cIndex)}
                        disabled={isSubmitted}
                        className="accent-[var(--primary)]"
                      />
                      <span className={`text-sm ${labelColor} ${labelWeight}`}>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === 'mcq_multi' && (
              <div className="flex flex-col gap-2">
                {q.choices?.map((c, cIndex) => {
                  const isChecked = ans?.selected_indices?.includes(cIndex) || false;
                  let labelColor = 'text-[var(--text-primary)]';
                  let labelWeight = 'font-medium';
                  if (isSubmitted) {
                    if (c.is_right) { labelColor = 'text-[#1e7e34]'; labelWeight = 'font-bold'; }
                    else if (isChecked && !c.is_right) { labelColor = 'text-[#ba1a1a]'; }
                  }
                  return (
                    <label key={cIndex} className={`flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-[var(--surface-low)] transition-colors ${isSubmitted ? 'cursor-default' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleMultiChange(q.id, cIndex, e.target.checked)}
                        disabled={isSubmitted}
                        className="accent-[var(--primary)]"
                      />
                      <span className={`text-sm ${labelColor} ${labelWeight}`}>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!isSubmitted && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full mt-4 py-3.5 rounded-full bg-[var(--primary)] text-white font-bold text-base hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Quiz'}
        </button>
      )}
    </div>
  );
};

export default QuizView;
