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
  const [attemptsInfo, setAttemptsInfo] = useState({ used: 0, allowed: 10 });
  const [submissionResult, setSubmissionResult] = useState(null);
  const [hasPassedPrev, setHasPassedPrev] = useState(false);
  const [forceStart, setForceStart] = useState(false);

  useEffect(() => {
    async function fetchExamData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
          .eq('student_id', user.id);

        const usedAttempts = prevSubmissions?.length || 0;
        const allowedAttempts = examData?.max_attempts || 10;
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
      const { data: { user } } = await supabase.auth.getUser();
      
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

      if (questions.length === 0) {
        throw new Error('Esta evaluación no tiene preguntas registradas.');
      }

      const rawScore = Math.round((correctPoints / questions.length) * 100);
      const finalScore = isNaN(rawScore) ? 0 : rawScore;
      const passed = finalScore >= (exam?.min_pass_score || 70);

      const { error } = await supabase
        .from('exam_submissions')
        .insert({
          exam_id: examId,
          student_id: user.id,
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
      <header className="glass-card p-6 md:p-12 mb-8 md:mb-12 border-l-8 border-secondary-color flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <span className="text-[10px] md:text-[11px] font-black text-secondary-color uppercase tracking-[0.2em] block">Evaluación de Módulo</span>
          <h1 className="text-3xl md:text-5xl font-black text-primary-color font-display tracking-tighter leading-tight mt-1">{exam?.title}</h1>
        </div>
        
        <div className="relative z-10 flex flex-row gap-4 w-full md:w-auto bg-slate-50/80 md:bg-transparent p-5 md:p-0 rounded-2xl md:rounded-none border md:border-none border-gray-100">
          <div className="flex flex-col flex-1">
            <span className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest">Aprobación</span>
            <span className="text-xl md:text-2xl font-black text-primary-color">{exam?.min_pass_score}%</span>
          </div>
          <div className="w-px bg-gray-200"></div>
          <div className="flex flex-col flex-1 md:text-right">
            <span className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest">Intento Actual</span>
            <span className="text-xl md:text-2xl font-black text-secondary-color">
              {attemptsInfo.used + 1} <span className="text-xs md:text-sm text-gray-400 font-bold">de {attemptsInfo.allowed}</span>
            </span>
          </div>
        </div>
      </header>

      <div className="questions-list">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-gray-50/50 rounded-[48px] border border-dashed border-gray-200 space-y-8 animate-fade-in">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm">🧩</div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-primary-color">Contenido en preparación</h3>
              <p className="text-gray-400 font-medium max-w-sm mx-auto text-balance">Esta evaluación aún no cuenta con preguntas cargadas. Vuelve más tarde o continúa con otro módulo.</p>
            </div>
            <Link 
              href="/dashboard/exams" 
              className="px-8 py-4 bg-primary-color text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary-color/20"
            >
              Volver al listado
            </Link>
          </div>
        ) : (
          questions.map((q, idx) => (
            <div key={q.id} className="glass-card p-6 md:p-10 mb-8 rounded-[32px] border border-white shadow-xl animate-fade-in relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-100 group-hover:bg-secondary-color transition-colors duration-500"></div>
              
              <div className="mb-4 flex items-center gap-4">
                 <span className="text-[10px] md:text-xs font-black text-secondary-color uppercase tracking-[0.2em] bg-secondary-color/10 px-4 py-1.5 rounded-full">
                   Pregunta {idx + 1}
                 </span>
              </div>
              <h3 className="font-display text-xl md:text-2xl font-black text-primary-color leading-snug mb-8">{q.question_text}</h3>
            
              <div className="flex flex-col gap-3 md:gap-4">
                {q.question_type === 'text_answer' ? (
                  <div className="relative">
                     <input 
                       type="text" 
                       placeholder="Escribe tu respuesta aquí de forma precisa..."
                       value={answers[q.id] || ''}
                       onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                       className="w-full bg-slate-50 border-2 border-gray-100 p-5 md:p-6 rounded-2xl outline-none focus:border-primary-color focus:ring-4 focus:ring-primary-color/10 font-medium text-gray-700 transition-all text-sm md:text-base shadow-inner"
                     />
                  </div>
                ) : (
                  q.exam_options.map((opt) => {
                    const isSelected = q.question_type === 'multiple_choice' 
                      ? answers[q.id]?.includes(opt.id) 
                      : answers[q.id] === opt.id;

                    return (
                      <label 
                        key={opt.id} 
                        className={`group/opt flex items-center gap-4 p-4 md:p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 ${
                          isSelected 
                            ? 'border-primary-color bg-primary-color/5 shadow-md' 
                            : 'border-gray-100 hover:border-gray-200 hover:bg-slate-50'
                        }`}
                      >
                        <input 
                          type={q.question_type === 'multiple_choice' ? "checkbox" : "radio"}
                          name={`q-${q.id}`}
                          className="hidden"
                          checked={isSelected}
                          onChange={() => {
                            if (q.question_type === 'multiple_choice') handleToggleMultiple(q.id, opt.id);
                            else setAnswers({...answers, [q.id]: opt.id});
                          }}
                        />
                        <div className="flex items-center gap-4 w-full">
                          <div className={`w-6 h-6 md:w-7 md:h-7 shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isSelected 
                              ? (q.question_type === 'multiple_choice' ? 'border-primary-color bg-primary-color text-white' : 'border-primary-color border-8') 
                              : 'border-gray-300 group-hover/opt:border-gray-400'
                          }`}>
                            {q.question_type === 'multiple_choice' && isSelected && <span className="text-xs font-bold">✓</span>}
                          </div>
                          <span className={`text-sm md:text-base font-bold transition-colors duration-300 ${
                            isSelected ? 'text-primary-color' : 'text-gray-500 group-hover/opt:text-gray-700'
                          }`}>
                            {opt.option_text}
                          </span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ))
        )}

        {questions.length > 0 && (
          <div className="mt-12 flex justify-center pb-8">
            <button 
              onClick={handleSubmit} 
              className="px-8 md:px-16 py-5 bg-primary-color text-white rounded-[32px] font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/30 hover:-translate-y-1 active:scale-95" 
              disabled={loading}
            >
              {loading ? 'Procesando Calificación...' : 'Entregar Evaluación'}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .exam-session { max-width: 900px; margin: 0 auto; padding: 1rem; padding-bottom: 5rem; }

        .btn { 
          display: inline-flex; align-items: center; gap: 0.8rem; padding: 1.2rem 2.4rem; 
          border-radius: 20px; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; 
          letter-spacing: 0.05em; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
          cursor: pointer; text-decoration: none; border: none;
        }
        .btn-primary { background: var(--primary-color); color: white; }
        .btn-primary:hover { transform: scale(1.05) translateY(-3px); box-shadow: 0 15px 30px rgba(12, 30, 69, 0.2); }
        .btn-outline { background: white; border: 2.5px solid var(--primary-color); color: var(--primary-color); }
        .btn-outline:hover { background: var(--primary-color); color: white; transform: translateY(-3px); }
        .btn-secondary { background: var(--secondary-color); color: var(--primary-color); }

        .btn-xl { padding: 1.5rem 4rem; font-size: 1.1rem; }

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
