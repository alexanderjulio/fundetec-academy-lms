'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

export default function ExamBuilderPage() {
  const { showNotification } = useNotification();
  const { courseId, moduleId, examId } = useParams();
  const router = useRouter();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Exam Configuration State
  const [examConfig, setExamConfig] = useState({
    title: '',
    min_pass_score: 70,
    max_attempts: 10
  });

  // Question Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionType, setQuestionType] = useState('single_choice');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState([
    { id: '1', text: '', is_correct: true },
    { id: '2', text: '', is_correct: false },
    { id: '3', text: '', is_correct: false },
    { id: '4', text: '', is_correct: false }
  ]);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    fetchExamAndQuestions();
  }, [examId]);

  const fetchExamAndQuestions = async () => {
    setLoading(true);
    try {
      const { data: examData } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examData) {
        setExam(examData);
        setExamConfig({
          title: examData.title,
          min_pass_score: examData.min_pass_score || 70,
          max_attempts: examData.max_attempts || 10
        });
      }

      const { data: questionsData } = await supabase
        .from('exam_questions')
        .select('*, exam_options(*)')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });

      setQuestions(questionsData || []);
    } catch (e) {
      console.error(e);
      showNotification('Error al cargar datos del examen', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    const parsedAttempts = parseInt(examConfig.max_attempts);
    const parsedScore = parseInt(examConfig.min_pass_score);
    if (isNaN(parsedAttempts) || parsedAttempts < 1) {
      showNotification('El límite de intentos debe ser un número mayor a 0', 'error');
      return;
    }
    setIsSavingConfig(true);
    try {
      const { data, error } = await supabase
        .from('exams')
        .update({
          title: examConfig.title,
          min_pass_score: parsedScore,
          max_attempts: parsedAttempts
        })
        .eq('id', examId)
        .select('id, title, min_pass_score, max_attempts');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No se actualizó el examen. Verifica los permisos en la base de datos.');
      showNotification('Configuración del examen guardada', 'success');
      setExam({ ...exam, ...data[0] });
    } catch (e) {
      showNotification('Error: ' + e.message, 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleOpenModal = (q = null) => {
    if (q) {
      setEditingQuestion(q);
      setQuestionType(q.question_type || 'single_choice');
      setQuestionText(q.question_text);
      setOptions(q.exam_options.map(opt => ({ id: opt.id, text: opt.option_text, is_correct: opt.is_correct })));
    } else {
      setEditingQuestion(null);
      setQuestionType('single_choice');
      setQuestionText('');
      setOptions([
        { id: 'temp-1', text: '', is_correct: true },
        { id: 'temp-2', text: '', is_correct: false },
        { id: 'temp-3', text: '', is_correct: false },
        { id: 'temp-4', text: '', is_correct: false }
      ]);
    }
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let qId;
      const questionPayload = { 
        exam_id: examId, 
        question_text: questionText, 
        question_type: questionType,
        order_index: editingQuestion ? editingQuestion.order_index : questions.length + 1 
      };

      if (editingQuestion) {
        await supabase.from('exam_questions').update(questionPayload).eq('id', editingQuestion.id);
        qId = editingQuestion.id;
        
        await supabase.from('exam_options').delete().eq('question_id', qId);
        
        const optionsPayload = options.map(opt => ({
          question_id: qId,
          option_text: opt.text,
          is_correct: opt.is_correct
        }));
        await supabase.from('exam_options').insert(optionsPayload);
        
        showNotification('Pregunta actualizada correctamente', 'success');
      } else {
        const { data: newQ, error: qErr } = await supabase
          .from('exam_questions')
          .insert(questionPayload)
          .select()
          .single();
        
        if (qErr) throw qErr;
        qId = newQ.id;
        
        const optionsPayload = options.map(opt => ({
          question_id: qId,
          option_text: opt.text,
          is_correct: opt.is_correct
        }));
        await supabase.from('exam_options').insert(optionsPayload);
        showNotification('Pregunta añadida al examen', 'success');
      }

      setIsModalOpen(false);
      fetchExamAndQuestions();
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('exam_questions').delete().eq('id', id);
    if (!error) {
      showNotification('Pregunta eliminada', 'success');
      setConfirmDeleteId(null);
      fetchExamAndQuestions();
    } else {
      showNotification('Error al eliminar: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const updateOptionText = (idx, text) => {
    const newOptions = [...options];
    newOptions[idx].text = text;
    setOptions(newOptions);
  };

  const toggleOptionCorrect = (idx) => {
    const newOptions = [...options];
    if (questionType === 'single_choice' || questionType === 'true_false') {
      newOptions.forEach((opt, i) => opt.is_correct = i === idx);
    } else {
      newOptions[idx].is_correct = !newOptions[idx].is_correct;
    }
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, { id: `temp-${Date.now()}`, text: '', is_correct: false }]);
  };

  const removeOption = (idx) => {
    if (options.length <= 1) return;
    const newOptions = options.filter((_, i) => i !== idx);
    setOptions(newOptions);
  };

  const handleTypeChange = (type) => {
    setQuestionType(type);
    if (type === 'true_false') {
      setOptions([
        { id: 'temp-t', text: 'Verdadero', is_correct: true },
        { id: 'temp-f', text: 'Falso', is_correct: false }
      ]);
    } else if (type === 'text_answer') {
      setOptions([
        { id: 'temp-text', text: '', is_correct: true }
      ]);
    } else {
      if (options.length < 2) {
        setOptions([
          { id: 'temp-1', text: '', is_correct: true },
          { id: 'temp-2', text: '', is_correct: false }
        ]);
      }
    }
  };

  if (loading && !exam) return <div className="p-10 text-center">Cargando constructor...</div>;

  return (
    <div className="exam-builder-page">
      <nav className="mb-10 animate-fade-in">
        <Link href={`/admin/courses/${courseId}/modules/${moduleId}`} className="group inline-flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:bg-primary-color hover:text-white transition-all shadow-sm">
          <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
          Volver al Módulo
        </Link>
      </nav>

      <header className="bg-white rounded-[48px] p-10 md:p-14 mb-12 shadow-2xl shadow-slate-100 flex flex-col md:flex-row justify-between items-center md:items-end gap-8 animate-slide-up border border-slate-50">
        <div className="space-y-3 text-center md:text-left">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Constructor de Evaluación</span>
          <h1 className="text-5xl font-black text-primary-color tracking-tighter font-display leading-tight">{exam?.title || 'Cargando...'}</h1>
          <p className="text-gray-400 font-bold text-sm">Configura las reglas y añade las preguntas de este examen.</p>
        </div>
      </header>

      <section className="bg-white rounded-[40px] p-8 md:p-12 mb-12 shadow-xl shadow-slate-100 border border-slate-50 animate-slide-up">
        <div className="mb-8 border-b border-gray-50 pb-6">
          <h2 className="text-2xl font-black text-primary-color font-display">Configuración General</h2>
          <p className="text-sm font-bold text-gray-400 mt-2">Define las reglas de aprobación y re-intentos.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Título del Examen</label>
            <input 
              type="text" 
              value={examConfig.title} 
              onChange={(e) => setExamConfig({...examConfig, title: e.target.value})}
              placeholder="Ej: Evaluación Final de Módulo"
              className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color transition-all text-xl shadow-inner placeholder:text-gray-300"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Nota Mínima (%)</label>
            <input 
              type="number" 
              value={examConfig.min_pass_score} 
              onChange={(e) => setExamConfig({...examConfig, min_pass_score: e.target.value})}
              min="0" max="100"
              className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-xl text-primary-color shadow-inner"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Límite de Intentos</label>
            <input 
              type="number" 
              value={examConfig.max_attempts} 
              onChange={(e) => setExamConfig({...examConfig, max_attempts: e.target.value})}
              min="1"
              className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-xl text-primary-color shadow-inner"
            />
            <p className="text-[9px] text-gray-400 font-bold px-3 pt-1">Mínimo 1 intento — por defecto 10</p>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-50">
          <button 
            className="bg-primary-color text-white px-10 py-5 rounded-[28px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/20"
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
          >
            {isSavingConfig ? 'Guardando...' : 'Guardar Cambios General'}
          </button>
        </div>
      </section>

      <section className="bg-slate-50 rounded-[48px] p-8 md:p-12 mb-12 border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-primary-color font-display">Banco de Preguntas</h2>
            <p className="text-sm font-bold text-gray-400 mt-2">{questions.length} preguntas añadidas a esta evaluación</p>
          </div>
          <button 
            className="flex items-center gap-3 bg-white text-primary-color px-8 py-5 rounded-[28px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary-color hover:text-white transition-all shadow-sm border border-slate-200" 
            onClick={() => handleOpenModal()}
          >
            <span className="text-lg">➕</span> NUEVA PREGUNTA
          </button>
        </div>

        <div className="questions-list">
          {questions.length === 0 ? (
            <div className="p-20 text-center bg-white rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center gap-4">
              <span className="text-5xl">📑</span>
              <h3 className="text-xl font-black text-primary-color font-display">No hay preguntas todavía</h3>
              <p className="text-sm font-bold text-gray-400 max-w-sm">Empieza a construir tu evaluación añadiendo preguntas de opción múltiple, abierta o falso/verdadero.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[32px] border-l-8 border-l-primary-color shadow-sm hover:shadow-xl transition-all relative group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <span className="bg-slate-50 text-primary-color px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100">Pregunta {idx + 1}</span>
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        q.question_type === 'single_choice' ? 'bg-emerald-50 text-emerald-600' : 
                        q.question_type === 'multiple_choice' ? 'bg-amber-50 text-amber-600' : 
                        q.question_type === 'text_answer' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {q.question_type === 'single_choice' ? 'Única' : q.question_type === 'multiple_choice' ? 'Múltiple' : q.question_type === 'text_answer' ? 'Abierta' : 'F/V'}
                      </span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="w-10 h-10 rounded-xl bg-slate-50 text-primary-color hover:bg-primary-color hover:text-white transition-all flex items-center justify-center" onClick={() => handleOpenModal(q)} title="Editar">✏️</button>
                      <button 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${confirmDeleteId === q.id ? 'bg-red-500 text-white w-auto px-4 text-xs font-bold' : 'bg-slate-50 text-red-400 hover:bg-red-50'}`} 
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Eliminar"
                      >
                        {confirmDeleteId === q.id ? '¡Seguro?' : '🗑️'}
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 leading-relaxed pr-10">{q.question_text}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MODAL DE PREGUNTA PREMIUM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-color/60 backdrop-blur-xl animate-fade-in" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-3xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop">
            <header className="p-10 pb-0 flex justify-between items-start">
               <div className="space-y-1">
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Configuración de Reactivo</span>
                 <h2 className="text-4xl font-black text-primary-color font-display tracking-tighter">
                   {editingQuestion ? 'Editar Pregunta' : 'Añadir al Banco'}
                 </h2>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm">✕</button>
            </header>

            <form onSubmit={handleSaveQuestion} className="p-10 pt-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Metodología de Evaluación</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'single_choice', label: 'Opción Única' },
                      { id: 'multiple_choice', label: 'Selección Múltiple' },
                      { id: 'text_answer', label: 'Abierta' },
                      { id: 'true_false', label: 'Falso/Verdadero' }
                    ].map(type => (
                      <button 
                        key={type.id}
                        type="button" 
                        onClick={() => handleTypeChange(type.id)}
                        className={`p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          questionType === type.id ? 'bg-primary-color text-white shadow-lg' : 'bg-slate-50 text-gray-400 hover:bg-slate-100'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Enunciado / Premisa</label>
                  <textarea 
                    value={questionText} 
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full bg-slate-50 border-none p-6 rounded-[32px] outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-gray-700 text-lg shadow-inner min-h-[120px]"
                    placeholder="Escribe la pregunta académica aquí..."
                    required
                  />
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-6">
                  <header className="flex justify-between items-center px-2">
                    <label className="text-[10px] font-black text-primary-color uppercase tracking-widest">
                      {questionType === 'text_answer' ? 'Configuración de Respuestas Cortas' : 'Alternativas de Respuesta'}
                    </label>
                    {['single_choice', 'multiple_choice'].includes(questionType) && (
                      <button type="button" onClick={addOption} className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline">+ Nueva Opción</button>
                    )}
                  </header>

                  <div className="space-y-3">
                    {options.map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-4 animate-fade-in">
                        {questionType !== 'text_answer' && (
                          <button 
                            type="button"
                            onClick={() => toggleOptionCorrect(idx)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                              opt.is_correct ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-transparent'
                            }`}
                          >
                            ✓
                          </button>
                        )}
                        <input 
                          type="text" 
                          value={opt.text} 
                          onChange={(e) => updateOptionText(idx, e.target.value)}
                          placeholder={questionType === 'text_answer' ? "Ej: 'fotosintesis'" : `Texto de la opción ${idx + 1}`}
                          className="flex-1 bg-slate-50 border-none p-5 rounded-[24px] outline-none focus:bg-white focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color shadow-inner"
                          required
                        />
                        {['single_choice', 'multiple_choice'].includes(questionType) && options.length > 1 && (
                          <button type="button" onClick={() => removeOption(idx)} className="w-10 h-10 flex items-center justify-center text-red-300 hover:text-red-500 transition-colors">✕</button>
                        )}
                      </div>
                    ))}
                    {questionType === 'text_answer' && <p className="text-[10px] text-gray-400 font-medium italic pl-4">Define palabras clave o frases exactas para la validación automática.</p>}
                  </div>
                </div>
              </div>

              <footer className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-50 text-gray-400 py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-100 transition-all">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-2 bg-primary-color text-white py-6 px-12 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/20">
                  {loading ? 'Guardando...' : (editingQuestion ? 'Actualizar Pregunta' : 'Añadir al Examen 📚')}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .exam-builder-page { max-width: 1200px; margin: 0 auto; animation: fadeIn 0.5s ease-out; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--gray-200); border-radius: 10px; }
        
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-slide-up { animation: slideUp 0.4s ease-out; }
        .animate-pop { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .modal-overlay { position: fixed; inset: 0; background: rgba(12, 30, 69, 0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 2rem; }
        .modal-content { width: 100%; max-width: 650px; padding: 0; overflow: hidden; max-height: 90vh; display: flex; flex-direction: column; }
        .modal-header { padding: 2rem; background: var(--gray-50); border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; color: var(--primary-color); margin: 0; }
        .close-btn { font-size: 2rem; background: none; border: none; cursor: pointer; color: var(--gray-400); line-height: 1; }
        
        form { padding: 2rem; overflow-y: auto; }
        .type-selector { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .type-selector button { flex: 1; padding: 0.7rem; border-radius: 8px; border: 1.5px solid var(--gray-200); background: white; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .type-selector button.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
        
        textarea { width: 100%; min-height: 100px; padding: 1rem; border-radius: 12px; border: 1.5px solid var(--gray-200); font-size: 1rem; resize: vertical; }

        .options-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .text-btn { background: none; border: none; color: var(--secondary-color); font-weight: 800; cursor: pointer; font-size: 0.9rem; }
        
        .options-list { display: flex; flex-direction: column; gap: 0.8rem; }
        .option-row { display: flex; align-items: center; gap: 1rem; background: var(--gray-50); padding: 0.8rem 1.2rem; border-radius: 12px; }
        .opt-input { flex: 1; background: none; border: none; font-size: 0.95rem; font-weight: 500; outline: none; }
        .remove-opt { color: #ef4444; font-size: 1.5rem; background: none; border: none; cursor: pointer; }

        .modal-footer { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--gray-100); display: flex; justify-content: flex-end; gap: 1rem; }

        .mb-10 { margin-bottom: 2.5rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mt-6 { margin-top: 1.5rem; }
      `}</style>
    </div>
  );
}
