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
    max_attempts: 1
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
          max_attempts: examData.max_attempts || 1
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
    setIsSavingConfig(true);
    try {
      const { error } = await supabase
        .from('exams')
        .update({
          title: examConfig.title,
          min_pass_score: parseInt(examConfig.min_pass_score),
          max_attempts: parseInt(examConfig.max_attempts)
        })
        .eq('id', examId);

      if (error) throw error;
      showNotification('Configuración del examen guardada', 'success');
      setExam({ ...exam, title: examConfig.title });
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
      <nav className="breadcrumb">
        <Link href={`/admin/courses/${courseId}/modules/${moduleId}`}>← Volver al Módulo</Link>
      </nav>

      <header className="page-header">
        <div className="header-info">
          <h1>Constructor de Examen</h1>
          <p>Editando: <strong>{exam?.title}</strong></p>
        </div>
      </header>

      <section className="config-section glass-card mb-10">
        <div className="section-title">
          <h2>Configuración General</h2>
          <p>Define las reglas de aprobación y re-intentos.</p>
        </div>
        
        <div className="config-grid">
          <div className="f-group">
            <label>Título del Examen</label>
            <input 
              type="text" 
              value={examConfig.title} 
              onChange={(e) => setExamConfig({...examConfig, title: e.target.value})}
              placeholder="Ej: Evaluación Final de Módulo"
            />
          </div>
          <div className="f-row">
            <div className="f-group">
              <label>Nota Mínima (%)</label>
              <input 
                type="number" 
                value={examConfig.min_pass_score} 
                onChange={(e) => setExamConfig({...examConfig, min_pass_score: e.target.value})}
                min="0" max="100"
              />
            </div>
            <div className="f-group">
              <label>Límite de Intentos</label>
              <input 
                type="number" 
                value={examConfig.max_attempts} 
                onChange={(e) => setExamConfig({...examConfig, max_attempts: e.target.value})}
                min="1"
              />
              <span className="hint">Mínimo 1 intento</span>
            </div>
          </div>
        </div>

        <div className="config-footer">
          <button 
            className="btn btn-primary" 
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
          >
            {isSavingConfig ? 'Guardando...' : 'Guardar Cambios General'}
          </button>
        </div>
      </section>

      <section className="questions-section">
        <div className="section-header">
          <div className="section-title">
            <h2>Banco de Preguntas</h2>
            <p>{questions.length} preguntas añadidas</p>
          </div>
          <button className="btn btn-secondary btn-with-icon" onClick={() => handleOpenModal()}>
            <span className="icon">➕</span> Nueva Pregunta
          </button>
        </div>

        <div className="questions-list mt-6">
          {questions.length === 0 ? (
            <div className="empty-state glass-card">
              <span className="icon">📑</span>
              <h3>No hay preguntas todavía</h3>
              <p>Empieza a construir tu evaluación añadiendo preguntas de opción múltiple, abierta o falso/verdadero.</p>
            </div>
          ) : (
            <div className="questions-grid">
              {questions.map((q, idx) => (
                <div key={q.id} className="question-card glass-card">
                  <div className="question-header">
                    <div className="header-labels">
                      <span className="num">Pregunta {idx + 1}</span>
                      <span className={`type-badge-mini ${q.question_type}`}>
                        {q.question_type === 'single_choice' ? 'Única' : q.question_type === 'multiple_choice' ? 'Múltiple' : q.question_type === 'text_answer' ? 'Abierta' : 'F/V'}
                      </span>
                    </div>
                    <div className="actions">
                      <button className="icon-btn" onClick={() => handleOpenModal(q)} title="Editar">✏️</button>
                      <button 
                        className={`icon-btn danger ${confirmDeleteId === q.id ? 'confirming-mini' : ''}`} 
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Eliminar"
                      >
                        {confirmDeleteId === q.id ? '¡Seguro?' : '🗑️'}
                      </button>
                    </div>
                  </div>
                  <h3 className="q-text">{q.question_text}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal de Pregunta */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-pop">
            <header className="modal-header">
              <h2>{editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </header>

            <form onSubmit={handleSaveQuestion}>
              <div className="form-group mb-6">
                <label>Tipo de Pregunta</label>
                <div className="type-selector">
                  <button type="button" className={questionType === 'single_choice' ? 'active' : ''} onClick={() => handleTypeChange('single_choice')}>Selección Única</button>
                  <button type="button" className={questionType === 'multiple_choice' ? 'active' : ''} onClick={() => handleTypeChange('multiple_choice')}>Múltiple</button>
                  <button type="button" className={questionType === 'text_answer' ? 'active' : ''} onClick={() => handleTypeChange('text_answer')}>Abierta</button>
                  <button type="button" className={questionType === 'true_false' ? 'active' : ''} onClick={() => handleTypeChange('true_false')}>F/V</button>
                </div>
              </div>

              <div className="form-group mb-6">
                <label>Enunciado de la Pregunta</label>
                <textarea 
                  value={questionText} 
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Escribe la pregunta aquí..."
                  required
                />
              </div>

              <div className="options-section">
                <div className="options-header">
                  <label>{questionType === 'text_answer' ? 'Palabras clave de validación' : 'Opciones de respuesta'}</label>
                  {['single_choice', 'multiple_choice'].includes(questionType) && (
                    <button type="button" className="text-btn" onClick={addOption}>+ Añadir Opción</button>
                  )}
                </div>

                <div className="options-list">
                  {options.map((opt, idx) => (
                    <div key={opt.id} className="option-row">
                      {questionType !== 'text_answer' && (
                        <input 
                          type={questionType === 'multiple_choice' ? 'checkbox' : 'radio'} 
                          checked={opt.is_correct} 
                          onChange={() => toggleOptionCorrect(idx)}
                          name="correct_option"
                        />
                      )}
                      <input 
                        type="text" 
                        value={opt.text} 
                        onChange={(e) => updateOptionText(idx, e.target.value)}
                        placeholder={questionType === 'text_answer' ? "Ej: 'fotosintesis'" : `Opción ${idx + 1}`}
                        required
                        className="opt-input"
                      />
                      {['single_choice', 'multiple_choice'].includes(questionType) && options.length > 1 && (
                        <button type="button" className="remove-opt" onClick={() => removeOption(idx)}>×</button>
                      )}
                    </div>
                  ))}
                  {questionType === 'text_answer' && <p className="hint">Ingresa la respuesta exacta o palabras clave que el sistema debe validar (no distingue mayúsculas ni tildes).</p>}
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Pregunta'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .exam-builder-page { max-width: 1200px; margin: 0 auto; }
        .breadcrumb { margin-bottom: 2rem; }
        .breadcrumb a { color: var(--primary-color); font-weight: 700; text-decoration: none; font-size: 0.9rem; }

        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; }
        .header-info h1 { font-family: 'Outfit', sans-serif; font-size: 2.5rem; color: var(--primary-color); margin-bottom: 0.5rem; }
        .header-info p { color: var(--gray-500); font-size: 1.1rem; }

        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .section-title h2 { font-family: 'Outfit', sans-serif; color: var(--primary-color); font-size: 1.6rem; }
        .section-title p { color: var(--gray-400); font-size: 0.9rem; }

        .config-grid { display: grid; gap: 1.5rem; padding: 1rem 0; }
        .f-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .f-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .f-group label { font-size: 0.85rem; font-weight: 700; color: var(--gray-700); text-transform: uppercase; letter-spacing: 0.5px; }
        .f-group input { padding: 0.8rem 1.2rem; border-radius: 12px; border: 1.5px solid var(--gray-200); font-size: 1rem; }
        .hint { font-size: 0.75rem; color: var(--gray-400); margin-top: 0.2rem; }
        .config-footer { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-100); display: flex; justify-content: flex-end; }

        .questions-grid { display: grid; gap: 1.5rem; }
        .question-card { padding: 2rem; position: relative; border-left: 5px solid var(--primary-color); }
        .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .header-labels { display: flex; gap: 1rem; align-items: center; }
        .num { font-weight: 800; color: var(--primary-color); font-size: 0.8rem; text-transform: uppercase; }
        .type-badge-mini { font-size: 0.65rem; font-weight: 900; padding: 0.2rem 0.6rem; border-radius: 4px; text-transform: uppercase; }
        .type-badge-mini.single_choice { background: #dcfce7; color: #166534; }
        .type-badge-mini.multiple_choice { background: #fef9c3; color: #854d0e; }
        .type-badge-mini.text_answer { background: #dbeafe; color: #1e40af; }
        .type-badge-mini.true_false { background: #f3e8ff; color: #6b21a8; }
        
        .q-text { font-family: 'Outfit', sans-serif; font-size: 1.2rem; color: var(--gray-800); line-height: 1.4; }

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
