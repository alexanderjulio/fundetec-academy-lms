'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

export default function CourseStructurePage() {
  const { showNotification } = useNotification();
  const { courseId } = useParams();
  const router = useRouter();
  
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    icon_url: ''
  });

  useEffect(() => {
    fetchCourseAndModules();
  }, [courseId]);

  const fetchCourseAndModules = async () => {
    setLoading(true);
    
    // Fetch Course
    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();
    
    // Fetch Modules
    const { data: modulesData } = await supabase
      .from('modules')
      .select('*, lessons(id), exams(id)')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    setCourse(courseData);
    setModules(modulesData || []);
    setLoading(false);
  };

  const handleOpenModal = (mod = null) => {
    if (mod) {
      setEditingModule(mod);
      setFormData({
        title: mod.title,
        icon_url: mod.icon_url || ''
      });
    } else {
      setEditingModule(null);
      setFormData({
        title: '',
        icon_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      title: formData.title,
      icon_url: formData.icon_url,
      course_id: courseId,
      order_index: editingModule ? editingModule.order_index : modules.length + 1
    };

    let error;
    if (editingModule) {
      const { error: err } = await supabase
        .from('modules')
        .update({ title: formData.title, icon_url: formData.icon_url })
        .eq('id', editingModule.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('modules')
        .insert([payload]);
      error = err;
    }

    if (error) {
      showNotification('Error al guardar: ' + error.message, 'error');
    } else {
      showNotification(editingModule ? 'Estructura actualizada.' : 'Nuevo módulo integrado.', 'success');
      setIsModalOpen(false);
      fetchCourseAndModules();
    }
    setLoading(false);
  };

  const handleDeleteModule = (id) => {
    setDeleteModuleConfirm(id);
  };

  const confirmDeleteModule = async () => {
    if (!deleteModuleConfirm) return;
    setLoading(true);
    const { error } = await supabase.from('modules').delete().eq('id', deleteModuleConfirm);
    if (!error) {
      showNotification('Módulo removido de la malla.', 'success');
      fetchCourseAndModules();
    } else {
      showNotification('Error al eliminar: ' + error.message, 'error');
    }
    setDeleteModuleConfirm(null);
    setLoading(false);
  };

  const swapOrder = async (idx1, idx2) => {
    const mod1 = modules[idx1];
    const mod2 = modules[idx2];
    
    setLoading(true);
    
    const { error: err1 } = await supabase
      .from('modules')
      .update({ order_index: mod2.order_index })
      .eq('id', mod1.id);
      
    const { error: err2 } = await supabase
      .from('modules')
      .update({ order_index: mod1.order_index })
      .eq('id', mod2.id);

    if (err1 || err2) {
      showNotification('Error al reordenar.', 'error');
    } else {
      fetchCourseAndModules();
    }
  };

  const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
  const totalExams = modules.reduce((acc, m) => acc + (m.exams?.length || 0), 0);

  if (loading && !course) return (
    <div className="p-40 text-center animate-pulse">
      <div className="w-16 h-16 bg-slate-50 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl">🏗️</div>
      <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">Cargando Estructura Académica...</p>
    </div>
  );

  return (
    <div className="course-structure-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in relative">
      
      {/* HEADER BENTO */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-12 mb-4">
          <Link href="/admin/courses" className="inline-flex items-center gap-2 px-6 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-primary-color hover:bg-slate-50 transition-all shadow-sm">
            ← Volver a Cursos
          </Link>
        </div>
        
        <div className="lg:col-span-7 space-y-1">
          <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.3em]">Gestión de Autoría</span>
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-tight font-display">
            {course?.title || 'Cargando...'}
          </h1>
          <p className="text-gray-400 font-medium italic">Define la secuencia pedagógica y organiza el contenido.</p>
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <div className="p-5 bg-white border border-gray-100 rounded-[32px] shadow-sm flex flex-col items-center text-center">
            <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Total Lecciones</span>
            <span className="text-2xl font-black text-primary-color font-display">{totalLessons}</span>
          </div>
          <div className="p-5 bg-white border border-gray-100 rounded-[32px] shadow-sm flex flex-col items-center text-center">
            <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-1">Exámenes Totales</span>
            <span className="text-2xl font-black text-secondary-color font-display">{totalExams}</span>
          </div>
        </div>
      </header>

      <section className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex -space-x-4">
          <div className="w-12 h-12 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center font-black text-xs">M</div>
          <div className="w-12 h-12 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center font-black text-xs">A</div>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="w-full md:w-auto px-10 py-5 bg-primary-color text-white rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary-color/10 hover:bg-secondary-color hover:text-primary-color transition-all"
        >
          + Añadir Nuevo Módulo
        </button>
      </section>

      {/* MODULES GRID BOUTIQUE */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {modules.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 p-20 bg-white rounded-[64px] border border-dashed border-gray-200 text-center flex flex-col items-center gap-6 animate-fade-in">
             <span className="text-6xl">📽️</span>
             <h3 className="text-2xl font-black text-primary-color font-display">Malla curricular vacía</h3>
             <p className="text-gray-400 max-w-sm mx-auto text-sm">Comienza a estructurar el aprendizaje añadiendo el primer módulo del programa.</p>
             <button onClick={() => handleOpenModal()} className="px-8 py-4 bg-slate-50 text-primary-color rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100">Crear Módulo #1</button>
          </div>
        ) : (
          modules.map((mod, idx) => (
            <div key={mod.id} className="group bg-white p-1 rounded-[48px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden relative border-t-4 border-t-secondary-color">
              <div className="p-8 space-y-6">
                <header className="flex justify-between items-start">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shadow-inner relative overflow-hidden">
                    {mod.icon_url ? (
                      <img src={mod.icon_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="relative z-10">{idx + 1}</span>
                    )}
                    <div className="absolute inset-0 bg-secondary-color/5"></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenModal(mod)} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-sm grayscale hover:grayscale-0 transition-all shadow-sm">✏️</button>
                    <button onClick={() => handleDeleteModule(mod.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-red-500 flex items-center justify-center text-sm shadow-sm hover:bg-red-500 hover:text-white transition-all">🗑️</button>
                  </div>
                </header>

                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-black text-secondary-color uppercase tracking-widest">Nivel de Contenido</span>
                    <h3 className="text-xl font-black text-primary-color tracking-tight font-display leading-tight h-14 line-clamp-2">{mod.title}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50/50 rounded-2xl flex flex-col items-center">
                      <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Lecciones</span>
                      <span className="text-lg font-black text-primary-color">{mod.lessons?.length || 0}</span>
                    </div>
                    <div className="p-4 bg-slate-50/50 rounded-2xl flex flex-col items-center">
                      <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Exámenes</span>
                      <span className="text-lg font-black text-primary-color">{mod.exams?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <footer className="flex gap-4">
                  <Link href={`/admin/courses/${courseId}/modules/${mod.id}`} className="flex-1 py-4 bg-primary-color text-white text-center rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-lg shadow-primary-color/10">
                    Gestionar Contenido →
                  </Link>
                  <div className="flex flex-col gap-1">
                    <button 
                      disabled={idx === 0}
                      onClick={() => swapOrder(idx, idx - 1)}
                      className="w-10 h-full bg-slate-50 rounded-xl border border-gray-100 flex items-center justify-center text-[10px] disabled:opacity-30 hover:bg-secondary-color"
                    >
                      ▲
                    </button>
                    <button 
                      disabled={idx === modules.length - 1}
                      onClick={() => swapOrder(idx, idx + 1)}
                      className="w-10 h-full bg-slate-50 rounded-xl border border-gray-100 flex items-center justify-center text-[10px] disabled:opacity-30 hover:bg-secondary-color"
                    >
                      ▼
                    </button>
                  </div>
                </footer>
              </div>
            </div>
          ))
        )}
      </section>

      {/* MODAL REDISEÑADO PREMIUM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-color/60 backdrop-blur-xl animate-fade-in" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop">
             <header className="p-10 pb-0 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">
                    {editingModule ? 'Edición de Estructura' : 'Arquitectura Educativa'}
                  </span>
                  <h2 className="text-4xl font-black text-primary-color font-display tracking-tighter">
                    {editingModule ? 'Ajustar Módulo' : 'Nuevo Módulo'}
                  </h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm">✕</button>
             </header>

             <form onSubmit={handleSubmit} className="p-10 pt-8 space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Título del Módulo</label>
                    <input 
                      type="text" required 
                      value={formData.title} 
                      onChange={e => setFormData({...formData, title: e.target.value})} 
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color text-xl shadow-inner"
                      placeholder="Ej: Fundamentos de Gestión"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Icono del Módulo (URL)</label>
                    <div className="flex gap-4">
                      <input 
                        type="url" 
                        value={formData.icon_url} 
                        onChange={e => setFormData({...formData, icon_url: e.target.value})} 
                        className="flex-1 bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-medium text-sm text-gray-500 shadow-inner"
                        placeholder="https://icon-sets..."
                      />
                      {formData.icon_url && (
                        <div className="w-16 h-16 rounded-[20px] overflow-hidden bg-slate-50 flex-shrink-0 animate-pop shadow-lg ring-4 ring-white">
                          <img src={formData.icon_url} className="w-full h-full object-cover" alt="" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-50 text-gray-400 py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-100 transition-all">Descartar</button>
                   <button type="submit" disabled={loading} className="flex-1 bg-primary-color text-white py-6 px-12 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/20">
                     {loading ? 'Procesando...' : (editingModule ? 'Actualizar Nivel' : 'Integrar Módulo')}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pop { animation: pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>

      {/* MODAL CONFIRMAR ELIMINACIÓN DE MÓDULO */}
      {deleteModuleConfirm && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-fade-in" onClick={() => setDeleteModuleConfirm(null)} />
          <div className="relative bg-white rounded-[40px] shadow-2xl p-10 max-w-md w-full text-center space-y-6 animate-pop">
            <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-primary-color font-display tracking-tighter">Eliminar Módulo</h3>
              <p className="text-sm text-gray-400 mt-2">Se borrarán todas las lecciones y exámenes asociados. Esta acción es irreversible.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModuleConfirm(null)} className="flex-1 bg-slate-50 text-gray-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">
                Cancelar
              </button>
              <button onClick={confirmDeleteModule} className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/30">
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
