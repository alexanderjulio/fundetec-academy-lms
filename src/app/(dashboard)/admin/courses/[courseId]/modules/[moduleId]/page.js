'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

export default function ModuleContentPage() {
  const { showNotification } = useNotification();
  const { courseId, moduleId } = useParams();
  const router = useRouter();

  const [course, setCourse] = useState(null);
  const [module, setModule] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lesson Modal State
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonForm, setLessonForm] = useState({ 
    title: '', 
    content_type: 'video', 
    content_url: '',
    content: '' // New field for rich text
  });

  // Exam Modal State
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', min_pass_score: '70' });

  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState(null);
  const [confirmDeleteExamId, setConfirmDeleteExamId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' or 'preview'

  useEffect(() => {
    fetchData();
  }, [moduleId]);

  const fetchData = async () => {
    setLoading(true);
    
    const [cRes, mRes, lRes, eRes] = await Promise.all([
      supabase.from('courses').select('title').eq('id', courseId).single(),
      supabase.from('modules').select('title').eq('id', moduleId).single(),
      supabase.from('lessons').select('*').eq('module_id', moduleId).order('order_index', { ascending: true }),
      supabase.from('exams').select('*').eq('module_id', moduleId)
    ]);

    setCourse(cRes.data);
    setModule(mRes.data);
    setLessons(lRes.data || []);
    setExams(eRes.data || []);
    setLoading(false);
  };

  // --- LESSON CRUD ---
  const handleOpenLessonModal = (lesson = null) => {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({ 
        title: lesson.title, 
        content_type: lesson.content_type, 
        content_url: lesson.content_url || '',
        content: lesson.content || ''
      });
    } else {
      setEditingLesson(null);
      setLessonForm({ title: '', content_type: 'video', content_url: '', content: '' });
    }
    setIsLessonModalOpen(true);
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { 
      ...lessonForm, 
      module_id: moduleId, 
      order_index: editingLesson ? editingLesson.order_index : lessons.length + 1 
    };
    
    let error;
    if (editingLesson) {
      const { error: err } = await supabase.from('lessons').update(payload).eq('id', editingLesson.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('lessons').insert([payload]);
      error = err;
    }

    if (!error) { 
      showNotification(editingLesson ? 'Lección actualizada' : 'Lección añadida correctamente', 'success');
      setIsLessonModalOpen(false); 
      fetchData(); 
    }
    else showNotification('Error: ' + error.message, 'error');
    setLoading(false);
  };

  const handleDeleteLesson = async (id) => {
    if (confirmDeleteLessonId !== id) {
      setConfirmDeleteLessonId(id);
      setTimeout(() => setConfirmDeleteLessonId(null), 3000);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (!error) {
      showNotification('Lección eliminada', 'success');
      setConfirmDeleteLessonId(null);
      fetchData();
    } else {
      showNotification('Error: ' + error.message, 'error');
    }
    setLoading(false);
  };

  // --- EXAM CRUD ---
  const handleOpenExamModal = (exam = null) => {
    if (exam) {
      setEditingExam(exam);
      setExamForm({ title: exam.title, min_pass_score: exam.min_pass_score.toString() });
    } else {
      setEditingExam(null);
      setExamForm({ title: '', min_pass_score: '70' });
    }
    setIsExamModalOpen(true);
  };

  const handleSaveExam = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...examForm, module_id: moduleId, min_pass_score: parseInt(examForm.min_pass_score) };
    
    let error;
    if (editingExam) {
      const { error: err } = await supabase.from('exams').update(payload).eq('id', editingExam.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('exams').insert([payload]);
      error = err;
    }

    if (!error) { 
      showNotification(editingExam ? 'Examen actualizado' : 'Examen creado con éxito', 'success');
      setIsExamModalOpen(false); 
      fetchData(); 
    }
    else showNotification('Error: ' + error.message, 'error');
    setLoading(false);
  };

  const handleDeleteExam = async (id) => {
    if (confirmDeleteExamId !== id) {
      setConfirmDeleteExamId(id);
      setTimeout(() => setConfirmDeleteExamId(null), 3000);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (!error) {
      showNotification('Examen eliminado junto con sus preguntas', 'success');
      setConfirmDeleteExamId(null);
      fetchData();
    } else {
      showNotification('Error: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const insertTag = (tag) => {
    const textarea = document.getElementById('lesson-content-editor');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selected = text.substring(start, end);

    let newText = "";
    if (tag === 'img') newText = `${before}<img src="URL_AQUI" alt="Imagen" style="max-width:100%; border-radius:12px; margin:1rem 0;" />${after}`;
    else if (tag === 'video') newText = `${before}<div style="position:relative; width:100%; padding-bottom:56.25%; margin:1.5rem 0;"><iframe src="URL_EMBED_YOUTUBE" style="position:absolute; width:100%; height:100%; border-radius:12px;" frameborder="0" allowfullscreen></iframe></div>${after}`;
    else if (tag === 'b') newText = `${before}<b>${selected}</b>${after}`;
    else if (tag === 'h3') newText = `${before}<h3>${selected}</h3>${after}`;
    else if (tag === 'li') newText = `${before}<ul>\n  <li>${selected}</li>\n</ul>${after}`;
    
    setLessonForm({ ...lessonForm, content: newText });
    textarea.focus();
  };

  if (loading && !module) return <div className="p-10 text-center">Cargando material...</div>;

  return (
    <div className="module-content-page">
      <nav className="breadcrumb">
        <Link href={`/admin/courses/${courseId}`}>← Volver al Malla del Curso</Link>
      </nav>

      <header className="page-header">
        <div className="header-info">
          <span className="course-name">{course?.title}</span>
          <h1>{module?.title}</h1>
          <p>Organiza las lecciones y evaluaciones de este módulo.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => handleOpenExamModal()}>+ Examen</button>
          <button className="btn btn-primary" onClick={() => handleOpenLessonModal()}>+ Lección</button>
        </div>
      </header>

      <div className="content-grid">
        <section className="column lessons-column">
          <div className="column-header">
            <h2>📚 Lecciones ({lessons.length})</h2>
          </div>
          <div className="items-list">
            {lessons.map((lesson, i) => (
              <div key={lesson.id} className="item-card glass-card">
                <div className="item-info">
                  <span className={`type-tag ${lesson.content_type}`}>{lesson.content_type === 'reading' ? '📖 Lectura' : lesson.content_type === 'video' ? '🎞️ Video' : '📄 Descargable'}</span>
                  <h3>{i + 1}. {lesson.title}</h3>
                </div>
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => handleOpenLessonModal(lesson)} title="Editar">✏️</button>
                  <button 
                    className={`icon-btn danger ${confirmDeleteLessonId === lesson.id ? 'confirming-mini' : ''}`} 
                    onClick={() => handleDeleteLesson(lesson.id)}
                    title="Eliminar"
                  >
                    {confirmDeleteLessonId === lesson.id ? '¡Seguro?' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
            {lessons.length === 0 && <p className="empty-msg">No hay lecciones todavía.</p>}
          </div>
        </section>

        <section className="column exams-column">
          <div className="column-header">
            <h2>📝 Exámenes ({exams.length})</h2>
          </div>
          <div className="items-list">
            {exams.map((exam) => (
              <div key={exam.id} className="item-card glass-card exam-card">
                <div className="item-info">
                  <span className="pass-badge">Aprueba con {exam.min_pass_score}%</span>
                  <h3>{exam.title}</h3>
                </div>
                <div className="item-actions">
                  <Link href={`/admin/courses/${courseId}/modules/${moduleId}/exams/${exam.id}`} className="icon-btn" title="Configurar Preguntas">⚙️</Link>
                  <button className="icon-btn" onClick={() => handleOpenExamModal(exam)} title="Editar">✏️</button>
                  <button 
                    className={`icon-btn danger ${confirmDeleteExamId === exam.id ? 'confirming-mini' : ''}`} 
                    onClick={() => handleDeleteExam(exam.id)}
                    title="Eliminar"
                  >
                    {confirmDeleteExamId === exam.id ? '¡Seguro?' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
            {exams.length === 0 && <p className="empty-msg">No hay exámenes todavía.</p>}
          </div>
        </section>
      </div>

      {/* Lesson Modal con Editor Enriquecido Fundetec */}
      {isLessonModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-pop wide-modal scrollable">
            <header className="modal-header">
              <h2>{editingLesson ? 'Editar Lección' : 'Nueva Lección'}</h2>
              <button className="close-btn" onClick={() => setIsLessonModalOpen(false)}>✕</button>
            </header>

            <form onSubmit={handleSaveLesson} className="modern-form">
              <div className="form-grid">
                <div className="form-main">
                  <div className="form-group">
                    <label>Título de la Lección</label>
                    <input type="text" required value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})} placeholder="Ej: Introducción a la anatomía" />
                  </div>

                  {lessonForm.content_type === 'reading' && (
                    <div className="rich-editor-container">
                      <div className="editor-tabs">
                        <button type="button" className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>✍️ Editor</button>
                        <button type="button" className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>👁️ Vista Previa</button>
                      </div>

                      {activeTab === 'editor' ? (
                        <div className="editor-area">
                          <div className="editor-toolbar">
                            <button type="button" onClick={() => insertTag('h3')}>H3</button>
                            <button type="button" onClick={() => insertTag('b')} style={{fontWeight:800}}>B</button>
                            <button type="button" onClick={() => insertTag('li')}>• Lista</button>
                            <button type="button" onClick={() => insertTag('img')}>🖼️ Imagen</button>
                            <button type="button" onClick={() => insertTag('video')}>🎥 Video</button>
                          </div>
                          <textarea 
                            id="lesson-content-editor"
                            rows="12" 
                            value={lessonForm.content} 
                            onChange={e => setLessonForm({...lessonForm, content: e.target.value})}
                            placeholder="Escribe el contenido aquí. Puedes usar HTML o los botones de arriba..."
                          ></textarea>
                        </div>
                      ) : (
                        <div className="preview-area glass-card" dangerouslySetInnerHTML={{ __html: lessonForm.content || '<p style="color:#aaa; text-align:center;">El contenido está vacío...</p>' }}>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-side">
                  <div className="form-group">
                    <label>Tipo de Contenido</label>
                    <select value={lessonForm.content_type} onChange={e => setLessonForm({...lessonForm, content_type: e.target.value})}>
                      <option value="video">🎞️ Video (Principal)</option>
                      <option value="reading">📖 Lectura / Artículo</option>
                      <option value="file">📄 Material Descargable</option>
                    </select>
                  </div>

                  {(lessonForm.content_type === 'video' || lessonForm.content_type === 'file') && (
                    <div className="form-group animate-slide">
                      <label>{lessonForm.content_type === 'video' ? 'URL del Video' : 'URL del Archivo'}</label>
                      <input type="text" value={lessonForm.content_url} onChange={e => setLessonForm({...lessonForm, content_url: e.target.value})} placeholder="https://..." />
                      <p className="hint">{lessonForm.content_type === 'video' ? 'Pega el link de YouTube, Vimeo o Cloudinary.' : 'Sube tu archivo a un storage y pega el link directo.'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setIsLessonModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : (editingLesson ? 'Guardar Cambios' : 'Añadir Lección')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exam Modal (Simple) */}
      {isExamModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-pop">
            <h2>{editingExam ? 'Editar Examen' : 'Nuevo Examen'}</h2>
            <form onSubmit={handleSaveExam} className="modern-form">
              <div className="form-group">
                <label>Título del Examen</label>
                <input type="text" required value={examForm.title} onChange={e => setExamForm({...examForm, title: e.target.value})} placeholder="Ej: Evaluación Primer Ciclo" />
              </div>
              <div className="form-group">
                <label>Puntaje Mínimo para Aprobar (%)</label>
                <input type="number" required value={examForm.min_pass_score} onChange={e => setExamForm({...examForm, min_pass_score: e.target.value})} min="1" max="100" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setIsExamModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>Crear Evaluación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .module-content-page { max-width: 1300px; animation: fadeIn 0.5s ease-out; }
        .breadcrumb { margin-bottom: 2rem; }
        .breadcrumb a { color: var(--primary-color); text-decoration: none; font-size: 0.9rem; font-weight: 700; }
        
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; background: var(--gray-50); padding: 2rem; border-radius: 24px; }
        .course-name { color: var(--secondary-color); font-weight: 800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; }
        .page-header h1 { color: var(--primary-color); font-family: 'Outfit', sans-serif; font-size: 2.2rem; margin: 0.2rem 0; letter-spacing: -1px; }
        .page-header p { color: var(--gray-500); }
        .header-actions { display: flex; gap: 1rem; }
        
        .content-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 3rem; }
        .column-header { margin-bottom: 2rem; border-bottom: 2px solid var(--gray-100); padding-bottom: 1rem; }
        .column-header h2 { font-size: 1.3rem; color: var(--primary-color); font-family: 'Outfit', sans-serif; font-weight: 800; }
        
        .items-list { display: flex; flex-direction: column; gap: 1.2rem; }
        .item-card { padding: 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-premium); border-radius: 16px; border: 1px solid transparent; }
        .item-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-interactive); background: white; border-color: var(--gray-100); }
        
        .type-tag { font-size: 0.65rem; text-transform: uppercase; background: var(--primary-color); padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: 800; margin-bottom: 0.6rem; display: block; width: fit-content; color: white; }
        .type-tag.reading { background: var(--secondary-color); }
        .type-tag.file { background: var(--accent-color); color: var(--primary-color); }

        .pass-badge { font-size: 0.7rem; background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 0.3rem 0.8rem; border-radius: 100px; font-weight: 800; margin-bottom: 0.6rem; display: block; width: fit-content; }
        .item-card h3 { font-size: 1.1rem; color: var(--primary-color); font-weight: 700; }
        .item-actions { display: flex; gap: 0.6rem; }
        
        .empty-msg { text-align: center; color: var(--gray-400); padding: 3rem; font-style: italic; background: var(--gray-50); border-radius: 16px; }
        
        /* Modal Expandido */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(12, 30, 69, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 2rem; }
        .modal-content { background: white; width: 100%; max-width: 600px; padding: 2.5rem; position: relative; }
        .modal-content.wide-modal { max-width: 1000px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .close-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--gray-50); color: var(--primary-color); font-size: 1rem; }
        .close-btn:hover { background: var(--error); color: white; }

        .modern-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .form-grid { display: grid; grid-template-columns: 1.8fr 1fr; gap: 2rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.2rem; }
        label { font-weight: 800; font-size: 0.85rem; color: var(--gray-700); text-transform: uppercase; letter-spacing: 0.5px; }
        input, select, textarea { padding: 0.9rem; border: 1.5px solid var(--gray-100); border-radius: 12px; transition: all 0.3s; font-family: inherit; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 4px rgba(12, 30, 69, 0.05); }

        /* Rich Editor */
        .rich-editor-container { border: 1.5px solid var(--gray-100); border-radius: 16px; overflow: hidden; background: var(--gray-50); }
        .editor-tabs { display: flex; gap: 4px; padding: 4px; background: var(--gray-100); }
        .tab-btn { flex: 1; padding: 0.6rem; border-radius: 10px; font-size: 0.85rem; font-weight: 700; color: var(--gray-500); }
        .tab-btn.active { background: white; color: var(--primary-color); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        
        .editor-toolbar { display: flex; gap: 0.5rem; padding: 0.8rem; border-bottom: 1px solid var(--gray-100); background: white; flex-wrap: wrap; }
        .editor-toolbar button { padding: 0.4rem 0.8rem; background: var(--gray-50); border-radius: 6px; font-size: 0.75rem; font-weight: 800; color: var(--primary-color); border: 1px solid var(--gray-100); }
        .editor-toolbar button:hover { background: var(--primary-color); color: white; }
        
        textarea { width: 100%; border: none !important; border-radius: 0 !important; font-family: 'Courier New', Courier, monospace; line-height: 1.6; }
        .preview-area { padding: 2rem; min-height: 350px; background: white; overflow-y: auto; font-size: 1rem; line-height: 1.8; color: var(--gray-800); }
        .preview-area h3 { color: var(--primary-color); margin: 1.5rem 0 1rem; font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.4rem; }
        .preview-area p { margin-bottom: 1rem; }
        .preview-area ul { padding-left: 1.5rem; margin-bottom: 1rem; list-style: disc; }

        .hint { font-size: 0.75rem; color: var(--gray-400); margin-top: 0.4rem; font-style: italic; }

        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--gray-100); padding-top: 2rem; }

        .icon-btn { padding: 0.5rem; border-radius: 8px; border: none; background: var(--gray-50); cursor: pointer; transition: all 0.2s; min-width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .icon-btn:hover { background: var(--gray-200); transform: translateY(-2px); }
        .icon-btn.danger:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .icon-btn.confirming-mini { background: #ef4444 !important; color: white !important; width: auto; padding: 0.5rem 0.8rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px; }

        .animate-slide { animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        @media (max-width: 1024px) { .content-grid { grid-template-columns: 1fr; } .form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
