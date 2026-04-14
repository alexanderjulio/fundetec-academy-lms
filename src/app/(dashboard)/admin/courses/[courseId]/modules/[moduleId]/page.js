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
    else if (tag === 'table') newText = `${before}<table style="width:100%;">\n  <thead>\n    <tr>\n      <th>Columna 1</th>\n      <th>Columna 2</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>Dato 1</td>\n      <td>Dato 2</td>\n    </tr>\n  </tbody>\n</table>${after}`;
    
    setLessonForm({ ...lessonForm, content: newText });
    textarea.focus();
  };

  if (loading && !module) return <div className="p-10 text-center">Cargando material...</div>;

  return (
    <div className="module-content-page">
      <nav className="mb-10 animate-fade-in">
        <Link href={`/admin/courses/${courseId}`} className="group inline-flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:bg-primary-color hover:text-white transition-all shadow-sm">
          <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
          Volver a la Malla del Curso
        </Link>
      </nav>

      <header className="bg-white rounded-[48px] p-10 md:p-14 mb-12 shadow-2xl shadow-slate-100 flex flex-col md:flex-row justify-between items-center md:items-end gap-8 animate-slide-up border border-slate-50">
        <div className="space-y-3 text-center md:text-left">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">{course?.title}</span>
          <h1 className="text-5xl font-black text-primary-color tracking-tighter font-display leading-tight">{module?.title}</h1>
          <p className="text-gray-400 font-bold text-sm">Gestiona la secuencia de aprendizaje y las evaluaciones de este módulo académico.</p>
        </div>
        <div className="flex gap-4 shrink-0">
          <button 
            className="flex items-center gap-3 bg-slate-50 text-gray-400 px-8 py-5 rounded-[28px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100" 
            onClick={() => handleOpenExamModal()}
          >
            <span className="text-lg">+</span> EXAMEN
          </button>
          <button 
            className="flex items-center gap-3 bg-primary-color text-white px-8 py-5 rounded-[28px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/20" 
            onClick={() => handleOpenLessonModal()}
          >
            <span className="text-lg">+</span> LECCIÓN
          </button>
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

      {/* MODAL DE LECCIÓN REDISEÑADO PREMIUM */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-fade-in" onClick={() => setIsLessonModalOpen(false)}></div>
          
          <div className="relative w-full max-w-5xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop max-h-[95vh] flex flex-col">
             <header className="p-10 pb-0 flex justify-between items-start flex-shrink-0">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Gestor de Contenidos</span>
                  <h2 className="text-4xl font-black text-primary-color font-display tracking-tighter">
                    {editingLesson ? 'Ajustar Lección' : 'Nueva Lección'}
                  </h2>
                </div>
                <button onClick={() => setIsLessonModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm">✕</button>
             </header>

             <form onSubmit={handleSaveLesson} className="flex-1 overflow-y-auto p-10 pt-8 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  <div className="lg:col-span-8 space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Título Institucional de la Lección</label>
                      <input 
                        type="text" required 
                        value={lessonForm.title} 
                        onChange={e => setLessonForm({...lessonForm, title: e.target.value})} 
                        className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color transition-all text-xl shadow-inner placeholder:text-gray-300"
                        placeholder="Ej: Introducción a la anatomía clínica"
                      />
                    </div>

                    {lessonForm.content_type === 'reading' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pl-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contenido Académico (Rich Text)</label>
                           <div className="flex bg-slate-100 p-1 rounded-2xl">
                             <button type="button" className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'editor' ? 'bg-white text-primary-color shadow-sm' : 'text-gray-400'}`} onClick={() => setActiveTab('editor')}>✍️ EDITOR</button>
                             <button type="button" className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'preview' ? 'bg-white text-primary-color shadow-sm' : 'text-gray-400'}`} onClick={() => setActiveTab('preview')}>👁️ VISTA PREVIA</button>
                           </div>
                        </div>

                        {activeTab === 'editor' ? (
                          <div className="space-y-4 animate-fade-in">
                            <div className="flex gap-2 p-2 bg-slate-50 rounded-[24px] overflow-x-auto">
                              {[
                                { tag: 'h3', label: 'H3' },
                                { tag: 'b', label: 'NEGRITA' },
                                { tag: 'li', label: '• LISTA' },
                                { tag: 'img', label: '🖼️ IMAGEN' },
                                { tag: 'video', label: '🎥 VIDEO' },
                                { tag: 'table', label: '📊 TABLA' }
                              ].map(tool => (
                                <button key={tool.tag} type="button" onClick={() => insertTag(tool.tag)} className="px-4 py-2 bg-white rounded-xl text-[9px] font-black text-primary-color shadow-sm border border-slate-100 hover:bg-primary-color hover:text-white transition-all shrink-0">
                                  {tool.label}
                                </button>
                              ))}
                            </div>
                            <textarea 
                              id="lesson-content-editor"
                              rows="12" 
                              value={lessonForm.content} 
                              onChange={e => setLessonForm({...lessonForm, content: e.target.value})}
                              className="w-full bg-slate-50 border-none p-8 rounded-[40px] outline-none focus:ring-4 focus:ring-secondary-color/10 font-mono text-sm leading-relaxed shadow-inner placeholder:text-gray-300 min-h-[400px]"
                              placeholder="Empieza a redactar el material para tus estudiantes..."
                            ></textarea>
                          </div>
                        ) : (
                          <div className="bg-white border-2 border-slate-50 p-10 rounded-[40px] shadow-inner min-h-[500px] animate-fade-in prose max-w-none" dangerouslySetInnerHTML={{ __html: lessonForm.content || '<p class="text-gray-300 text-center italic mt-20">El contenido está esperando ser redactado...</p>' }}>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-4 space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Formato de Lección</label>
                      <select 
                        value={lessonForm.content_type} 
                        onChange={e => setLessonForm({...lessonForm, content_type: e.target.value})}
                        className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-primary-color transition-all text-sm shadow-inner appearance-none cursor-pointer"
                      >
                        <option value="video">🎞️ VIDEO (PRINCIPAL)</option>
                        <option value="reading">📖 LECTURA / ARTÍCULO</option>
                        <option value="file">📄 MATERIAL DESCARGABLE</option>
                      </select>
                    </div>

                    {(lessonForm.content_type === 'video' || lessonForm.content_type === 'file') && (
                      <div className="space-y-2 animate-fade-in">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">
                          {lessonForm.content_type === 'video' ? 'Enlace del Video' : 'Localización del Archivo'}
                        </label>
                        <input 
                          type="text" 
                          value={lessonForm.content_url} 
                          onChange={e => setLessonForm({...lessonForm, content_url: e.target.value})} 
                          className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-medium text-gray-500 transition-all text-sm shadow-inner placeholder:text-gray-300"
                          placeholder="https://..." 
                        />
                        <p className="text-[9px] text-gray-400 font-bold px-3 leading-relaxed">
                          {lessonForm.content_type === 'video' ? 'Soportamos YouTube, Vimeo y links directos de Cloudinary.' : 'Asegúrate de que el link tenga permisos de acceso público.'}
                        </p>
                      </div>
                    )}

                    <div className="p-8 bg-emerald-50 rounded-[40px] border border-emerald-100/50 space-y-4">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tips Académicos</p>
                        <p className="text-xs font-bold text-emerald-800/60 leading-relaxed">
                          Utiliza títulos cortos y directos. Una lección ideal no debería superar los 15 minutos de video o las 1000 palabras de lectura.
                        </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 pb-4">
                   <button type="button" onClick={() => setIsLessonModalOpen(false)} className="flex-1 bg-slate-50 text-gray-400 py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-100 hover:text-gray-500 transition-all">Descartar</button>
                   <button type="submit" disabled={loading} className="flex-2 bg-primary-color text-white py-6 px-12 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/20">
                     {loading ? 'Sincronizando...' : (editingLesson ? 'Actualizar Lección' : 'Añadir Lección')}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL DE EXAMEN REDISEÑADO PREMIUM */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-fade-in" onClick={() => setIsExamModalOpen(false)}></div>
          
          <div className="relative w-full max-w-lg bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop">
             <header className="p-10 pb-0 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Evaluación Académica</span>
                  <h2 className="text-4xl font-black text-primary-color font-display tracking-tighter">
                    {editingExam ? 'Ajustar Examen' : 'Nuevo Examen'}
                  </h2>
                </div>
                <button onClick={() => setIsExamModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm">✕</button>
             </header>

             <form onSubmit={handleSaveExam} className="p-10 pt-8 space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Nombre del Examen</label>
                    <input 
                      type="text" required 
                      value={examForm.title} 
                      onChange={e => setExamForm({...examForm, title: e.target.value})} 
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color transition-all text-xl shadow-inner placeholder:text-gray-300"
                      placeholder="Ej: Evaluación Primer Ciclo" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Nota de Aprobación (%)</label>
                    <input 
                      type="number" required 
                      value={examForm.min_pass_score} 
                      onChange={e => setExamForm({...examForm, min_pass_score: e.target.value})} 
                      min="1" max="100" 
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-xl text-primary-color shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setIsExamModalOpen(false)} className="flex-1 bg-slate-50 text-gray-400 py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-100 hover:text-gray-500 transition-all">Cancelar</button>
                   <button type="submit" className="flex-2 bg-primary-color text-white py-6 px-12 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/20">
                     {editingExam ? 'Guardar Cambios' : 'Crear Evaluación'}
                   </button>
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
        
        /* Academic Content Preview System */
        .preview-area { 
          padding: 3rem; 
          min-height: 500px; 
          background: #fafafa; 
          overflow-y: auto; 
          font-size: 1.1rem; 
          line-height: 1.8; 
          color: var(--primary-color); 
          border-radius: 40px;
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.02);
        }
        .preview-area h1 { font-family: 'Outfit', sans-serif; font-size: 2.5rem; font-weight: 900; margin-bottom: 2rem; tracking: -0.05em; }
        .preview-area h2 { font-family: 'Outfit', sans-serif; font-size: 1.8rem; font-weight: 800; margin: 2rem 0 1rem; }
        .preview-area h3 { font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 800; margin: 1.5rem 0 1rem; color: #10B981; }
        .preview-area p { margin-bottom: 1.5rem; color: #4b5563; font-weight: 500; }
        .preview-area ul { padding-left: 1.5rem; margin-bottom: 1.5rem; list-style: none; }
        .preview-area li { margin-bottom: 0.8rem; position: relative; padding-left: 1.5rem; }
        .preview-area li::before { content: '•'; position: absolute; left: 0; color: #10B981; font-weight: 900; }
        .preview-area table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 2rem 0; background: white; border-radius: 20px; overflow: hidden; border: 1px solid #f3f4f6; }
        .preview-area th { background: #f9fafb; padding: 1rem; text-align: left; font-[10px] font-black uppercase tracking-widest text-gray-400 border-bottom: 1px solid #f3f4f6; }
        .preview-area td { padding: 1rem; border-bottom: 1px solid #f9fafb; font-size: 1rem; color: #4b5563; }
        .preview-area tr:last-child td { border-bottom: none; }
        .preview-area img { border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.05); margin: 2rem 0; width: 100%; object-fit: cover; }

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
