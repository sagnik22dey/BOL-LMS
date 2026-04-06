import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';

const QuizView = ({ quizId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const qRes = await api.get(`/api/quizzes/${quizId}`);
        setQuiz(qRes.data);

        try {
          const sRes = await api.get(`/api/quizzes/${quizId}/my-submission`);
          if (sRes.data) {
            setSubmission(sRes.data);
            if (!sRes.data.submitted_at) {
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
          }
        } catch (subErr) {
          if (subErr.response?.status !== 404) console.error(subErr);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load quiz. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [quizId]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payloadAnswers = Object.values(answers);
      await api.post(`/api/quizzes/${quizId}/submit`, { answers: payloadAnswers });
      // Reload submission data instead of full page reload
      const sRes = await api.get(`/api/quizzes/${quizId}/my-submission`);
      const qRes = await api.get(`/api/quizzes/${quizId}`);
      setQuiz(qRes.data);
      setSubmission(sRes.data);
      if (sRes.data?.answers) {
        const ansMap = {};
        sRes.data.answers.forEach((a) => { ansMap[a.question_id] = a; });
        setAnswers(ansMap);
      }
      setTimeLeft(null);
      setCurrentQ(0);
      setShowReview(false);
    } catch (err) {
      console.error(err);
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, answers, quizId]);

  useEffect(() => {
    let timer;
    if (timeLeft !== null && timeLeft > 0 && submission && !submission.submitted_at) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [timeLeft, submission, handleSubmit]);

  const handleStart = async () => {
    try {
      setLoading(true);
      await api.post(`/api/quizzes/${quizId}/start`);
      // Reload everything fresh
      const qRes = await api.get(`/api/quizzes/${quizId}`);
      setQuiz(qRes.data);
      const sRes = await api.get(`/api/quizzes/${quizId}/my-submission`);
      setSubmission(sRes.data);
      if (sRes.data && !sRes.data.submitted_at) {
        const startedDate = new Date(sRes.data.started_at);
        const timeLimitMs = qRes.data.time_limit_mins * 60 * 1000;
        const expiresAt = startedDate.getTime() + timeLimitMs;
        const remaining = Math.max(0, expiresAt - Date.now());
        setTimeLeft(Math.floor(remaining / 1000));
      }
      setAnswers({});
      setCurrentQ(0);
    } catch (err) {
      console.error(err);
      setError('Failed to start quiz. Please try again.');
    } finally {
      setLoading(false);
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

  const handleWrittenChange = (questionId, text) => {
    setAnswers({ ...answers, [questionId]: { question_id: questionId, written_answer: text } });
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getTimerColor = () => {
    if (timeLeft === null) return 'text-gray-700';
    if (timeLeft < 60) return 'text-red-600';
    if (timeLeft < 300) return 'text-amber-600';
    return 'text-gray-800';
  };

  const getTimerBg = () => {
    if (timeLeft === null) return 'bg-gray-100';
    if (timeLeft < 60) return 'bg-red-50 border-red-200';
    if (timeLeft < 300) return 'bg-amber-50 border-amber-200';
    return 'bg-gray-50 border-gray-200';
  };

  const isAnswered = (q) => {
    const ans = answers[q.id];
    if (!ans) return false;
    if (q.type === 'mcq_single') return ans.selected_index !== null && ans.selected_index !== undefined;
    if (q.type === 'mcq_multi') return ans.selected_indices && ans.selected_indices.length > 0;
    if (q.type === 'written') return ans.written_answer && ans.written_answer.trim().length > 0;
    return false;
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'mcq_single': return 'Single Choice';
      case 'mcq_multi': return 'Multiple Choice';
      case 'written': return 'Written Answer';
      default: return type;
    }
  };

  const getQuestionTypeBadge = (type) => {
    switch (type) {
      case 'mcq_single': return 'bg-blue-100 text-blue-700';
      case 'mcq_multi': return 'bg-violet-100 text-violet-700';
      case 'written': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm font-medium">Loading quiz…</p>
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto mt-8 p-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
      <span className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5">error</span>
      <div>
        <p className="font-bold text-sm">Error</p>
        <p className="text-sm mt-0.5">{error}</p>
      </div>
    </div>
  );

  if (!quiz) return null;

  const isSubmitted = submission && submission.submitted_at && !submission.retake_allowed;
  const questions = quiz.questions || [];
  const answeredCount = questions.filter(q => isAnswered(q)).length;
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // ── START SCREEN ──────────────────────────────────────────────────────────
  if (!submission || (submission.submitted_at && submission.retake_allowed)) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-8 text-white">
            <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-base">quiz</span>
              Assessment
            </div>
            <h2 className="text-2xl font-extrabold leading-tight mb-1">{quiz.title}</h2>
            <p className="text-blue-200 text-sm">{questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} points total</p>
          </div>

          {/* Details */}
          <div className="px-8 py-6 space-y-4">
            {/* Question type breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: 'mcq_single', label: 'Single Choice', icon: 'radio_button_checked' },
                { type: 'mcq_multi', label: 'Multi Choice', icon: 'check_box' },
                { type: 'written', label: 'Written', icon: 'edit_note' },
              ].map(({ type, label, icon }) => {
                const count = questions.filter(q => q.type === type).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex flex-col items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-center">
                    <span className="material-symbols-outlined text-gray-500 text-xl mb-1">{icon}</span>
                    <p className="text-xl font-extrabold text-gray-800">{count}</p>
                    <p className="text-xs text-gray-500 font-medium leading-tight">{label}</p>
                  </div>
                );
              }).filter(Boolean)}
            </div>

            {/* Timer & Instructions */}
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <span className="material-symbols-outlined text-amber-600 text-2xl flex-shrink-0">timer</span>
              <div>
                <p className="font-bold text-amber-800 text-sm">Time Limit: {quiz.time_limit_mins} Minutes</p>
                <p className="text-amber-700 text-xs mt-0.5">The timer starts when you click "Start Exam". Once started, you must complete it in one session.</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-sm text-blue-800 space-y-1.5">
              <p className="font-bold">Before you begin:</p>
              <ul className="space-y-1 list-none">
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-blue-500 text-base mt-0.5">check_circle</span>Ensure a stable internet connection</li>
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-blue-500 text-base mt-0.5">check_circle</span>Do not refresh or close the page during the exam</li>
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-blue-500 text-base mt-0.5">check_circle</span>Your answers are submitted when time expires</li>
              </ul>
            </div>

            {submission?.retake_allowed && (
              <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-sm text-green-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">replay</span>
                Retake allowed by your instructor
              </div>
            )}
          </div>

          <div className="px-8 pb-8">
            <button
              onClick={handleStart}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-200"
            >
              <span className="material-symbols-outlined text-xl">play_arrow</span>
              {submission?.retake_allowed ? 'Start Retake' : 'Start Exam'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS SCREEN ────────────────────────────────────────────────────────
  if (isSubmitted) {
    const pct = submission.max_score > 0 ? Math.round((submission.score / submission.max_score) * 100) : 0;
    const passed = pct >= 60;
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Score card */}
        <div className={`rounded-3xl overflow-hidden border mb-6 ${passed ? 'border-green-200' : 'border-red-200'}`}>
          <div className={`px-8 py-8 text-center ${passed ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-red-50 to-rose-50'}`}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-extrabold ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {pct}%
            </div>
            <h2 className={`text-xl font-extrabold mb-1 ${passed ? 'text-green-800' : 'text-red-800'}`}>
              {passed ? 'Well Done!' : 'Better luck next time'}
            </h2>
            <p className={`text-sm ${passed ? 'text-green-600' : 'text-red-600'}`}>
              You scored <strong>{submission.score}</strong> out of <strong>{submission.max_score}</strong> points
            </p>
          </div>

          <div className="px-8 py-6 bg-white">
            <div className="grid grid-cols-3 gap-4 mb-6 text-center">
              <div>
                <p className="text-2xl font-extrabold text-gray-800">{questions.length}</p>
                <p className="text-xs text-gray-500 font-medium">Questions</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-green-600">{submission.score}</p>
                <p className="text-xs text-gray-500 font-medium">Points Earned</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-400">{submission.max_score}</p>
                <p className="text-xs text-gray-500 font-medium">Total Points</p>
              </div>
            </div>

            {/* Score bar */}
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-6">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${passed ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wider">Review Answers</h3>
          </div>
        </div>

        {/* Question review */}
        <div className="space-y-4">
          {questions.map((q, qIndex) => {
            const ans = answers[q.id];
            let questionCorrect = false;
            if (q.type === 'mcq_single') {
              questionCorrect = ans?.selected_index !== null && ans?.selected_index !== undefined &&
                q.choices?.[ans.selected_index]?.is_right === true;
            } else if (q.type === 'mcq_multi') {
              const correctIndices = q.choices?.map((c, i) => c.is_right ? i : -1).filter(i => i >= 0) || [];
              const selectedIndices = ans?.selected_indices || [];
              questionCorrect = correctIndices.length === selectedIndices.length &&
                correctIndices.every(i => selectedIndices.includes(i));
            }

            return (
              <div key={q.id} className={`rounded-2xl border overflow-hidden ${q.type === 'written' ? 'border-gray-200' : questionCorrect ? 'border-green-200' : 'border-red-200'}`}>
                <div className={`px-5 py-3 flex items-center gap-3 ${q.type === 'written' ? 'bg-gray-50' : questionCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${q.type === 'written' ? 'bg-gray-200 text-gray-600' : questionCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {q.type === 'written' ? qIndex + 1 : questionCorrect ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{q.text}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getQuestionTypeBadge(q.type)}`}>
                      {getQuestionTypeLabel(q.type)}
                    </span>
                    <span className="text-xs text-gray-500 font-semibold">{q.points} pt</span>
                  </div>
                </div>

                <div className="px-5 py-4 bg-white">
                  {(q.type === 'mcq_single' || q.type === 'mcq_multi') && (
                    <div className="space-y-2">
                      {q.choices?.map((c, cIndex) => {
                        const isSelected = q.type === 'mcq_single'
                          ? ans?.selected_index === cIndex
                          : ans?.selected_indices?.includes(cIndex);
                        const isRight = c.is_right;
                        let choiceBg = 'bg-gray-50 border-gray-200';
                        let choiceText = 'text-gray-700';
                        if (isRight) { choiceBg = 'bg-green-50 border-green-300'; choiceText = 'text-green-800 font-semibold'; }
                        else if (isSelected && !isRight) { choiceBg = 'bg-red-50 border-red-300'; choiceText = 'text-red-800'; }
                        return (
                          <div key={cIndex} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${choiceBg}`}>
                            <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs border-2 ${isRight ? 'bg-green-500 border-green-500 text-white' : isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300'}`}>
                              {isRight ? '✓' : isSelected ? '✗' : ''}
                            </span>
                            <span className={`text-sm ${choiceText}`}>{c.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.type === 'written' && (
                    <div>
                      <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Your Answer</p>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {ans?.written_answer || <span className="text-gray-400 italic">No answer provided</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        Written answers are graded by the instructor
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── ACTIVE EXAM ────────────────────────────────────────────────────────────
  const currentQuestion = questions[currentQ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Exam Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Quiz title */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{quiz.title}</p>
            <p className="text-xs text-gray-400">{answeredCount} of {questions.length} answered</p>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-medium">{Math.round(questions.length > 0 ? (answeredCount / questions.length) * 100 : 0)}%</span>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-sm flex-shrink-0 ${getTimerBg()} ${getTimerColor()}`}>
            <span className="material-symbols-outlined text-base">timer</span>
            {formatTime(timeLeft || 0)}
          </div>

          {/* Submit */}
          <button
            onClick={() => setShowReview(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">send</span>
            <span className="hidden sm:inline">Submit</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 max-w-5xl mx-auto w-full px-4 py-6 gap-6">
        {/* Question Navigator sidebar */}
        <div className="hidden lg:flex flex-col gap-3 w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, idx) => {
                const answered = isAnswered(q);
                const isCurrent = idx === currentQ;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQ(idx)}
                    className={`w-full aspect-square rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                        : answered
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={`Q${idx + 1}: ${answered ? 'Answered' : 'Unanswered'}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
                Answered
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
                Unanswered
              </div>
            </div>
          </div>
        </div>

        {/* Main question area */}
        <div className="flex-1 min-w-0">
          {currentQuestion && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Question header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-extrabold flex-shrink-0 mt-0.5">
                  {currentQ + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${getQuestionTypeBadge(currentQuestion.type)}`}>
                      {getQuestionTypeLabel(currentQuestion.type)}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold">{currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-gray-900 font-semibold text-base leading-relaxed">{currentQuestion.text}</p>
                </div>
              </div>

              {/* Answer area */}
              <div className="px-6 py-5">
                {/* MCQ Single */}
                {currentQuestion.type === 'mcq_single' && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Select one answer</p>
                    {currentQuestion.choices?.map((c, cIndex) => {
                      const isSelected = answers[currentQuestion.id]?.selected_index === cIndex;
                      return (
                        <label
                          key={cIndex}
                          className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <input
                            type="radio"
                            name={`q-${currentQuestion.id}`}
                            value={cIndex}
                            checked={isSelected}
                            onChange={() => handleSingleChange(currentQuestion.id, cIndex)}
                            className="sr-only"
                          />
                          <span className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* MCQ Multi */}
                {currentQuestion.type === 'mcq_multi' && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Select all that apply</p>
                    {currentQuestion.choices?.map((c, cIndex) => {
                      const isChecked = answers[currentQuestion.id]?.selected_indices?.includes(cIndex) || false;
                      return (
                        <label
                          key={cIndex}
                          className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                            isChecked
                              ? 'border-violet-500 bg-violet-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isChecked ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
                          }`}>
                            {isChecked && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleMultiChange(currentQuestion.id, cIndex, e.target.checked)}
                            className="sr-only"
                          />
                          <span className={`text-sm font-medium ${isChecked ? 'text-violet-800' : 'text-gray-700'}`}>{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Written */}
                {currentQuestion.type === 'written' && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Write your answer below</p>
                    <textarea
                      value={answers[currentQuestion.id]?.written_answer || ''}
                      onChange={(e) => handleWrittenChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here…"
                      rows={6}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 font-medium resize-y focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all placeholder-gray-300"
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      {(answers[currentQuestion.id]?.written_answer || '').length} characters
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                  Previous
                </button>

                <span className="text-xs text-gray-400 font-medium">
                  {currentQ + 1} / {questions.length}
                </span>

                {currentQ < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Next
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowReview(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
                  >
                    Review & Submit
                    <span className="material-symbols-outlined text-base">done_all</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mobile question navigator */}
          <div className="mt-4 lg:hidden">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Navigate Questions</p>
              <div className="flex flex-wrap gap-1.5">
                {questions.map((q, idx) => {
                  const answered = isAnswered(q);
                  const isCurrent = idx === currentQ;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQ(idx)}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                        isCurrent ? 'bg-blue-600 text-white' : answered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review & Submit modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-extrabold text-gray-900">Submit Exam?</h3>
              <p className="text-sm text-gray-500 mt-0.5">Please review before submitting. This cannot be undone.</p>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-2xl font-extrabold text-green-700">{answeredCount}</p>
                  <p className="text-xs text-green-600 font-medium">Answered</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-2xl font-extrabold text-amber-700">{questions.length - answeredCount}</p>
                  <p className="text-xs text-amber-600 font-medium">Unanswered</p>
                </div>
              </div>

              {questions.length - answeredCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2 mb-4">
                  <span className="material-symbols-outlined text-base flex-shrink-0 mt-0.5">warning</span>
                  You have {questions.length - answeredCount} unanswered question{questions.length - answeredCount !== 1 ? 's' : ''}. These will be marked as incorrect.
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                <span className="material-symbols-outlined text-base text-gray-400">timer</span>
                Time remaining: <strong>{formatTime(timeLeft || 0)}</strong>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all"
              >
                Continue Exam
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                ) : (
                  <><span className="material-symbols-outlined text-base">send</span> Submit Exam</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizView;
