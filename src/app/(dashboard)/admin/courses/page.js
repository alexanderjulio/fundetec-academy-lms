'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

export default function AdminCoursesPage() {
  const { showNotification } = useNotification();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    thumbnail_url: '',
    is_published: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchCourses();
  }, []);

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : 
                         statusFilter === 'published' ? c.is_published : !c.is_published;
    return matchesSearch && matchesStatus;
  });

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        modules(id),
        enrollments(id)
      `)
      .order('created_at', { ascending: false });

    if (!error) {
      const formatted = data.map(c => ({
        ...c,
        moduleCount: c.modules?.length || 0,
        studentCount: c.enrollments?.length || 0
      }));
      setCourses(formatted);
    }
    setLoading(false);
  };

  const handleOpenModal = (course = null) => {
    if (course) {
      setEditingCourse(course);
      setFormData({
        title: course.title,
        description: course.description || '',
        price: course.price,
        thumbnail_url: course.thumbnail_url || '',
        is_published: course.is_published
      });
    } else {
      setEditingCourse(null);
      setFormData({
        title: '',
        description: '',
        price: '0',
        thumbnail_url: '',
        is_published: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    
    const payload = {
      ...formData,
      price: parseFloat(formData.price),
      created_by: session.user.id
    };

    let error;
    if (editingCourse) {
      const { error: err } = await supabase
        .from('courses')
        .update(payload)
        .eq('id', editingCourse.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('courses')
        .insert([payload]);
      error = err;
    }

    if (error) {
      showNotification('Error: ' + error.message, 'error');
    } else {
      showNotification(editingCourse ? 'Malla curricular actualizada.' : 'Nuevo curso lanzado con éxito.', 'success');
      setIsModalOpen(false);
      fetchCourses();
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este curso? Esta acción es irreversible.')) return;
    
    setLoading(true);
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (!error) {
       showNotification('Curso removido de la oferta académica.', 'success');
       fetchCourses();
    } else {
       showNotification('Error al eliminar: ' + error.message, 'error');
    }
    setLoading(false);
  };

  const totalInscribed = courses.reduce((acc, c) => acc + c.studentCount, 0);

  return (
    <div className="courses-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none font-display">
            Oferta <span className="text-secondary-color">Académica</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Gestión de programas, módulos e inscripciones.</p>
        </div>
        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          <div className="flex-1 lg:flex-none p-4 px-8 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Inscritos Totales</span>
            <span className="text-2xl font-black text-primary-color font-display">{totalInscribed.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => handleOpenModal()} 
            className="flex-1 lg:flex-none px-10 py-5 bg-primary-color text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 flex items-center justify-center gap-3"
          >
            🚀 Lanzar Nuevo Curso
          </button>
        </div>
      </header>

      {/* SEARCH AND FILTERS BOUTIQUE */}
      <section className="flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-1 w-full group">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl group-focus-within:scale-110 transition-transform">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por nombre de curso..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-100 p-5 pl-16 rounded-[32px] outline-none shadow-sm focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color transition-all"
          />
        </div>
        <div className="flex p-2 bg-white border border-gray-100 rounded-[32px] shadow-sm">
          {[
            { id: 'all', label: 'Todo', icon: '📁' },
            { id: 'published', label: 'En Línea', icon: '✅' },
            { id: 'draft', label: 'Borrador', icon: '📝' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-8 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                statusFilter === f.id ? 'bg-primary-color text-white shadow-lg shadow-primary-color/20' : 'text-gray-400 hover:bg-slate-50'
              }`}
            >
              <span>{f.icon}</span> {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* CURSOS GRID (LIST STYLE BOUTIQUE) */}
      <section className="space-y-6">
        {loading && !isModalOpen ? (
          <div className="p-40 text-center animate-pulse">
            <div className="w-16 h-16 bg-slate-50 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl">📚</div>
            <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">Sincronizando Currículo...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-20 bg-white rounded-[48px] border border-dashed border-gray-200 text-center flex flex-col items-center gap-4 animate-fade-in">
             <span className="text-5xl">📂</span>
             <h3 className="text-xl font-black text-primary-color font-display">Sin resultados</h3>
             <p className="text-gray-400 max-w-xs mx-auto text-sm">No encontramos coincidencias para tu búsqueda en la oferta académica.</p>
             <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} className="text-secondary-color font-black text-[10px] uppercase tracking-widest border-b-2 border-secondary-color/20">Limpiar Filtros</button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {filteredCourses.map(course => {
              const isPopular = course.studentCount > 5;
              return (
                <div key={course.id} className="group bg-white p-6 md:p-8 rounded-[48px] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-primary-color/5 transition-all duration-500 overflow-hidden relative">
                  {/* Destacado Badge */}
                  {isPopular && (
                    <div className="absolute top-0 right-10 bg-secondary-color text-primary-color px-6 py-2 rounded-b-2xl text-[9px] font-black uppercase tracking-widest shadow-lg z-10">
                      🔥 Top Ventas / Destacado
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row items-center gap-8 relative z-10">
                    <div className="w-full lg:w-48 h-48 lg:h-32 rounded-3xl overflow-hidden bg-slate-100 relative shadow-inner flex-shrink-0">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={course.title} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">📚</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    </div>

                    <div className="flex-1 space-y-3 min-w-0 w-full text-center lg:text-left">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
                        <span className={`w-fit mx-auto lg:mx-0 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${course.is_published ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-100 text-gray-400'}`}>
                          {course.is_published ? 'En Línea' : 'Borrador'}
                        </span>
                        <span className="text-[10px] font-black text-secondary-color tracking-widest uppercase">ID: {course.id.substring(0,8)}</span>
                      </div>
                      <h3 className="text-2xl font-black text-primary-color tracking-tight font-display truncate leading-tight">{course.title}</h3>
                      <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inscritos:</span>
                          <span className="text-sm font-black text-primary-color">{course.studentCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Módulos:</span>
                          <span className="text-sm font-black text-primary-color">{course.moduleCount}</span>
                        </div>
                        <div className="hidden lg:block w-px h-4 bg-gray-100"></div>
                        <span className="text-lg font-black text-secondary-color font-display">${parseFloat(course.price).toLocaleString()} <small className="text-[10px] uppercase font-bold text-gray-400">COP</small></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto">
                      <button 
                        onClick={() => handleOpenModal(course)}
                        className="flex-1 lg:flex-none p-5 bg-slate-50 text-primary-color rounded-3xl hover:bg-primary-color hover:text-white transition-all text-sm font-bold flex items-center justify-center gap-2"
                        title="Configuración"
                      >
                        ⚙️ <span className="lg:hidden">Configuración</span>
                      </button>
                      <Link 
                        href={`/admin/courses/${course.id}`} 
                        className="flex-1 lg:flex-none p-5 bg-slate-50 text-primary-color rounded-3xl hover:bg-secondary-color transition-all text-sm font-bold flex items-center justify-center gap-2"
                        title="Estructura Educativa"
                      >
                        📖 <span className="lg:hidden">Contenido</span>
                      </Link>
                      <button 
                        onClick={() => handleDelete(course.id)}
                        className="flex-1 lg:flex-none p-5 bg-slate-50 text-red-500 rounded-3xl hover:bg-red-500 hover:text-white transition-all"
                        title="Dar de Baja"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL REDISEÑADO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-color/60 backdrop-blur-xl animate-fade-in" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-2xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop">
             <header className="p-10 pb-0 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.3em]">
                    {editingCourse ? 'Módulo de Edición' : 'Fundetec Academy Builder'}
                  </span>
                  <h2 className="text-3xl font-black text-primary-color font-display tracking-tight">
                    {editingCourse ? 'Ajustar Programa' : 'Crear Nueva Oferta'}
                  </h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all">✕</button>
             </header>

             <form onSubmit={handleSubmit} className="p-10 pt-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Título Institucional</label>
                    <input 
                      type="text" required 
                      value={formData.title} 
                      onChange={e => setFormData({...formData, title: e.target.value})} 
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color transition-all text-lg"
                      placeholder="Ej: Diplomado en Salud Pública"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Inversión (COP)</label>
                    <input 
                      type="number" required 
                      value={formData.price} 
                      onChange={e => setFormData({...formData, price: e.target.value})} 
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Estado en Plataforma</label>
                    <select 
                      value={formData.is_published} 
                      onChange={e => setFormData({...formData, is_published: e.target.value === 'true'})}
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-[10px] uppercase tracking-widest text-primary-color cursor-pointer appearance-none"
                    >
                      <option value="false">❌ Borrador Técnico</option>
                      <option value="true">✅ Lanzar en Vivo</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Portada Curada (URL)</label>
                    <div className="flex gap-4">
                      <input 
                        type="url" 
                        value={formData.thumbnail_url} 
                        onChange={e => setFormData({...formData, thumbnail_url: e.target.value})} 
                        className="flex-1 bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-medium text-sm text-gray-500"
                        placeholder="https://assets..."
                      />
                      {formData.thumbnail_url && (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0">
                          <img src={formData.thumbnail_url} className="w-full h-full object-cover" alt="Preview" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Descripción Académica</label>
                    <textarea 
                      rows="3" 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-medium text-gray-600 transition-all text-sm leading-relaxed"
                      placeholder="Detalla los objetivos del programa..."
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-50 text-gray-400 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Descartar</button>
                   <button type="submit" disabled={loading} className="flex-2 bg-primary-color text-white py-5 px-12 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10">
                     {loading ? 'Procesando...' : (editingCourse ? 'Actualizar Programa' : 'Lanzar Oferta 🚀')}
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
    </div>
  );
}
