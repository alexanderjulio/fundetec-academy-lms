'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

export default function ExamSessionPage() {
  const { showNotification } = useNotification();
  const { examId } = useParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attemptsInfo, setAttemptsInfo] = useState({ used: 0, allowed: 1 });
  const [submissionResult, setSubmissionResult] = useState(null);
  const [hasPassedPrev, setHasPassedPrev] = useState(false);
  const [forceStart, setForceStart] = useState(false);

  useEffect(() => {
    async function fetchExamData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Fetch Exam Settings
        const { data: examData } = await supabase
          .from('exams')
          .select('*, modules(course_id)')
          .eq('id', examId)
          .single();

        // 2. Check Previous Submissions (Attempts)
        const { data: prevSubmissions } = await supabase
          .from('exam_submissions')
          .select('id, score, passed')
          .eq('exam_id', examId)
          .eq('student_id', session.user.id);

        const usedAttempts = prevSubmissions?.length || 0;
        const allowedAttempts = examData?.max_attempts || 1;
        const hasPassed = prevSubmissions?.some(s => s.passed);

        setAttemptsInfo({ used: usedAttempts, allowed: allowedAttempts });
        setHasPassedPrev(hasPassed);

        // Calculate best score if already passed
        if (hasPassed && !forceStart) {
          const bestScore = Math.max(...prevSubmissions.map(s => s.score));
          setSubmissionResult({ passed: true, score: bestScore });
        }

        // 3. Fetch Questions and Options
        const { data: questionsData } = await supabase
          .from('exam_questions')
          .select(`
            id,
            question_text,
            question_type,
            exam_options (
              id,
              option_text,
              is_correct 
            )
          `)
          .eq('exam_id', examId)
          .order('order_index', { ascending: true });

        setExam(examData);
        setQuestions(questionsData || []);
        
        const initialAnswers = {};
        questionsData?.forEach(q => {
          if (q.question_type === 'multiple_choice') initialAnswers[q.id] = [];
          else if (q.question_type === 'text_answer') initialAnswers[q.id] = '';
          else initialAnswers[q.id] = null;
        });
        setAnswers(initialAnswers);

      } catch (error) {
        console.error('Error fetching exam:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchExamData();
  }, [examId, forceStart]);

  const normalize = (val) => val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const handleToggleMultiple = (qId, optId) => {
    const current = answers[qId] || [];
    if (current.includes(optId)) {
      setAnswers({ ...answers, [qId]: current.filter(id => id !== optId) });
    } else {
      setAnswers({ ...answers, [qId]: [...current, optId] });
    }
  };

  const handleSubmit = async () => {
    const unanswered = questions.some(q => {
      const resp = answers[q.id];
      if (q.question_type === 'multiple_choice') return resp.length === 0;
      if (q.question_type === 'text_answer') return resp.trim() === '';
      return resp === null || resp === undefined;
    });

    if (unanswered) {
      showNotification('Por favor responde todas las preguntas antes de finalizar.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let correctPoints = 0;
      questions.forEach(q => {
        const studentResp = answers[q.id];
        const correctOpts = q.exam_options.filter(o => o.is_correct);

        if (q.question_type === 'single_choice' || q.question_type === 'true_false') {
          if (studentResp === correctOpts[0]?.id) correctPoints++;
        } 
        else if (q.question_type === 'multiple_choice') {
          const correctIds = correctOpts.map(o => o.id).sort();
          const studentIds = [...studentResp].sort();
          if (correctIds.length === studentIds.length && correctIds.every((v, i) => v === studentIds[i])) {
            correctPoints++;
          }
        } 
        else if (q.question_type === 'text_answer') {
          const expected = normalize(correctOpts[0]?.option_text || '');
          const submitted = normalize(studentResp || '');
          if (expected === submitted) correctPoints++;
        }
      });

      const finalScore = Math.round((correctPoints / questions.length) * 100);
      const passed = finalScore >= (exam?.min_pass_score || 70);

      const { error } = await supabase
        .from('exam_submissions')
        .insert({
          exam_id: examId,
          student_id: session.user.id,
          score: finalScore,
          passed: passed,
          attempt_number: attemptsInfo.used + 1
        });

      if (error) throw error;
      
      setSubmissionResult({ passed, score: finalScore });
      setAttemptsInfo({...attemptsInfo, used: attemptsInfo.used + 1});
      setHasPassedPrev(passed || hasPassedPrev);
      setForceStart(false);

    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loader-container"><div className="loader"></div><p>Cargando evaluación...</p></div>;

  // Screen: All attempts used and never passed
  if (attemptsInfo.used >= attemptsInfo.allowed && !hasPassedPrev && !submissionResult) {
    return (
      <div className="exam-feedback text-center p-10 glass-card animate-pop">
        <span className="big-icon">🛑</span>
        <h2>Intentos Agotados</h2>
        <p>Has alcanzado el límite de {attemptsInfo.allowed} intentos sin aprobar.</p>
        <Link href={`/dashboard/courses/${exam?.modules?.course_id}`} className="btn btn-outline block mt-6">
          Volver al Curso
        </Link>
      </div>
    );
  }

  // Screen: Progress Summary / Retake Choice (If passed previously or attempts left)
  if (submissionResult && !forceStart) {
    return (
      <div className="exam-feedback text-center p-10 glass-card animate-pop">
        {submissionResult.passed ? (
          <>
            <span className="big-icon">🏆</span>
            <h2>¡Contenido Dominado!</h2>
            <p>Has aprobado esta evaluación satisfactoriamente.</p>
          </>
        ) : (
          <>
            <span className="big-icon">📚</span>
            <h2>Puedes Mejorar</h2>
            <p>Tu puntaje actual es de {submissionResult.score}%. Se requiere {exam?.min_pass_score}%.</p>
          </>
        )}
        
        <div className="score-ring mb-6">
          <span className="score-val">{submissionResult.score}%</span>
          <span className="score-label">Última Nota</span>
        </div>

        <div className="actions-flex">
          {attemptsInfo.used < attemptsInfo.allowed && (
            <button onClick={() => { setSubmissionResult(null); setForceStart(true); }} className="btn btn-secondary">
              {submissionResult.passed ? 'Repetir para mejorar nota' : 'Intentar de nuevo'}
            </button>
          )}
          <Link href={`/dashboard/courses/${exam?.modules?.course_id}`} className="btn btn-primary">
            Continuar con el Diplomado
          </Link>
        </div>
        <p className="mt-4 hint">Intentos usados: <strong>{attemptsInfo.used} de {attemptsInfo.allowed}</strong></p>
      </div>
    );
  }

  // Active Exam Session
  return (
    <div className="exam-session">
      <header className="exam-header glass-card">
        <div className="header-main">
          <span className="exam-type">Evaluación de Módulo</span>
          <h1>{exam?.title}</h1>
        </div>
        <div className="exam-meta">
          <div className="meta-item">
            <span className="meta-label">Aprobación</span>
            <span className="meta-value">{exam?.min_pass_score}%</span>
          </div>
          <div className="spacer"></div>
          <div className="meta-item text-right">
            <span className="meta-label">ID Seguimiento</span>
            <span className="meta-value">Intento {attemptsInfo.used + 1} de {attemptsInfo.allowed}</span>
          </div>
        </div>
      </header>

      <div className="questions-list">
        {questions.map((q, idx) => (
          <div key={q.id} className="question-card glass-card">
            <div className="q-header">
               <span className="q-number">Pregunta {idx + 1}</span>
            </div>
            <h3>{q.question_text}</h3>
            
            <div className="options-container">
              {q.question_type === 'text_answer' ? (
                <div className="text-answer-input">
                   <input 
                     type="text" 
                     placeholder="Escribe tu respuesta aquí..."
                     value={answers[q.id] || ''}
                     onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                   />
                </div>
              ) : (
                <div className="options-grid">
                  {q.exam_options.map((opt) => (
                    <label 
                      key={opt.id} 
                      className={`option-item ${
                        q.question_type === 'multiple_choice' 
                          ? (answers[q.id]?.includes(opt.id) ? 'selected' : '')
                          : (answers[q.id] === opt.id ? 'selected' : '')
                      }`}
                    >
                      <input 
                        type={q.question_type === 'multiple_choice' ? "checkbox" : "radio"}
                        name={`q-${q.id}`}
                        checked={q.question_type === 'multiple_choice' ? answers[q.id]?.includes(opt.id) : answers[q.id] === opt.id}
                        onChange={() => {
                          if (q.question_type === 'multiple_choice') handleToggleMultiple(q.id, opt.id);
                          else setAnswers({...answers, [q.id]: opt.id});
                        }}
                      />
                      <div className="opt-content">
                        <span className="opt-marker">
                          {q.question_type === 'multiple_choice' 
                            ? (answers[q.id]?.includes(opt.id) ? '☑' : '☐') 
                            : (answers[q.id] === opt.id ? '●' : '○')}
                        </span>
                        {opt.option_text}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="submit-area">
          <button onClick={handleSubmit} className="btn btn-primary btn-xl submit-btn" disabled={loading}>
            {loading ? 'Procesando Calificación...' : 'Entregar y Finalizar Evaluación'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .exam-session { max-width: 900px; margin: 0 auto; padding-bottom: 5rem; }
        .exam-header { padding: 3rem; margin-bottom: 3rem; display: flex; justify-content: space-between; align-items: center; border-left: 8px solid var(--secondary-color); }
        .exam-type { text-transform: uppercase; font-size: 0.75rem; font-weight: 800; color: var(--secondary-color); letter-spacing: 1px; }
        .header-main h1 { font-family: 'Outfit', sans-serif; font-size: 2.2rem; color: var(--primary-color); margin-top: 0.3rem; }
        
        .exam-meta { display: flex; gap: 2rem; }
        .meta-item { display: flex; flex-direction: column; }
        .meta-label { font-size: 0.7rem; color: var(--gray-400); font-weight: 700; text-transform: uppercase; }
        .meta-value { font-size: 1.1rem; font-weight: 800; color: var(--primary-color); }

        .question-card { padding: 2.5rem; margin-bottom: 2rem; }
        .q-header { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; }
        .q-number { font-size: 0.8rem; font-weight: 900; color: var(--secondary-color); text-transform: uppercase; }
        .question-card h3 { font-family: 'Outfit', sans-serif; font-size: 1.4rem; color: var(--gray-800); line-height: 1.5; margin-bottom: 2rem; }

        .options-grid { display: grid; gap: 1rem; }
        .option-item { 
          display: flex; align-items: center; gap: 1rem; padding: 1.2rem 1.5rem; 
          border: 2px solid var(--gray-100); border-radius: 12px; cursor: pointer; transition: all 0.2s;
          position: relative;
        }
        .option-item:hover { background: var(--gray-50); border-color: var(--gray-200); }
        .option-item.selected { border-color: var(--primary-color); background: rgba(var(--primary-color-rgb), 0.05); }
        .option-item input { display: none; }
        
        .opt-content { display: flex; align-items: center; gap: 1rem; font-size: 1.05rem; font-weight: 500; color: var(--gray-700); }
        .opt-marker { font-size: 1.2rem; color: var(--gray-300); }
        .option-item.selected .opt-marker { color: var(--primary-color); }

        .text-answer-input input { width: 100%; padding: 1.2rem; border-radius: 12px; border: 2px solid var(--gray-200); font-size: 1.1rem; outline: none; }
        .text-answer-input input:focus { border-color: var(--primary-color); }

        .submit-area { margin-top: 4rem; text-align: center; }
        .btn-xl { padding: 1.2rem 3rem; font-size: 1.1rem; font-weight: 800; }

        .exam-feedback { max-width: 600px; margin: 4rem auto; }
        .big-icon { font-size: 5rem; display: block; margin-bottom: 1rem; }
        .score-ring { margin-top: 2rem; border: 10px solid var(--secondary-color); width: 140px; height: 140px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 2rem auto; }
        .score-val { font-size: 2.2rem; font-weight: 900; color: var(--primary-color); font-family: 'Outfit', sans-serif; }
        .score-label { font-size: 0.7rem; color: var(--gray-400); text-transform: uppercase; font-weight: 700; }

        .actions-flex { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; }
        .hint { font-size: 0.85rem; color: var(--gray-400); }

        .loader-container { padding: 5rem; text-align: center; }
        .loader { width: 40px; height: 40px; border: 4px solid var(--gray-200); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
