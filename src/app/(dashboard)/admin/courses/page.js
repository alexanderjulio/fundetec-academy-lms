'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';
import { optimizeImage } from '@/utils/imageOptimizer';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { importCourse } from '@/app/actions/admin_actions';

const DEFAULT_COURSE_IMAGE = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800";

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

  // Importación desde PDF/DOCX
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // estructura generada por IA
  const [saving, setSaving] = useState(false);

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

  const handleFileUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const optimizedFile = await optimizeImage(file);
      const fileExt = optimizedFile.name.split('.').pop();
      const fileName = `course_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `course_thumbnails/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('site_assets')
        .upload(filePath, optimizedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site_assets')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, thumbnail_url: publicUrl }));
      showNotification('Portada cargada con éxito.', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      showNotification('Error al subir imagen: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
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

    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      ...formData,
      price: parseFloat(formData.price),
      created_by: user.id
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

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportPreview(null);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/import-course', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al procesar el archivo.');
      setImportPreview(json.estructura);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { success, courseId, error } = await importCourse({ estructura: importPreview, adminId: user.id });
    if (success) {
      showNotification('Curso importado con éxito.', 'success');
      setImportModalOpen(false);
      setImportPreview(null);
      fetchCourses();
    } else {
      showNotification('Error al guardar: ' + error, 'error');
    }
    setSaving(false);
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
            onClick={() => { setImportModalOpen(true); setImportPreview(null); }}
            className="flex-1 lg:flex-none px-8 py-5 bg-white border border-gray-200 text-gray-700 rounded-3xl font-black text-xs uppercase tracking-widest hover:border-primary-color hover:text-primary-color transition-all shadow-sm flex items-center justify-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            Importar PDF / Word
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex-1 lg:flex-none px-10 py-5 bg-primary-color text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color flex items-center justify-center gap-3"
          >
            Lanzar Nuevo Curso
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
            className="w-full bg-white border border-gray-100 p-5 pl-16 rounded-[32px] outline-none shadow-sm focus:ring-4 focus:ring-secondary-color transition-all font-bold text-primary-color"
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
                statusFilter === f.id ? 'bg-primary-color text-white shadow-lg' : 'text-gray-400 hover:bg-slate-50'
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
             <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} className="text-secondary-color font-black text-[10px] uppercase tracking-widest border-b-2 border-secondary-color">Limpiar Filtros</button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {filteredCourses.map(course => {
              const isPopular = course.studentCount > 5;
              return (
                <div key={course.id} className="group bg-white p-6 md:p-8 rounded-[48px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden relative">
                  {/* Destacado Badge */}
                  {isPopular && (
                    <div className="absolute top-0 right-10 bg-secondary-color text-primary-color px-6 py-2 rounded-b-2xl text-[9px] font-black uppercase tracking-widest shadow-lg z-10">
                      Top Ventas / Destacado
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row items-center gap-8 relative z-10">
                    <div className="w-full lg:w-48 h-48 lg:h-32 rounded-3xl overflow-hidden bg-slate-100 relative shadow-inner flex-shrink-0">
                      <img 
                        src={course.thumbnail_url || DEFAULT_COURSE_IMAGE} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        alt={course.title} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-10"></div>
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

                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 md:gap-3 w-full lg:w-auto mt-4 lg:mt-0">
                      <button 
                        onClick={() => handleOpenModal(course)}
                        className="p-3 md:p-5 bg-slate-50 text-primary-color rounded-2xl md:rounded-3xl hover:bg-primary-color hover:text-white transition-all font-bold flex items-center justify-center gap-2 shadow-sm"
                        title="Configuración"
                      >
                        <span className="text-lg md:text-base">⚙️</span> 
                        <span className="text-[10px] md:text-sm uppercase md:capitalize tracking-widest md:tracking-normal truncate">Ajustes</span>
                      </button>
                      <Link 
                        href={`/admin/courses/${course.id}`} 
                        className="p-3 md:p-5 bg-slate-50 text-primary-color rounded-2xl md:rounded-3xl hover:bg-secondary-color transition-all font-bold flex items-center justify-center gap-2 shadow-sm"
                        title="Estructura Educativa"
                      >
                        <span className="text-lg md:text-base">📖</span> 
                        <span className="text-[10px] md:text-sm uppercase md:capitalize tracking-widest md:tracking-normal truncate">Temario</span>
                      </Link>
                      <button 
                        onClick={() => handleDelete(course.id)}
                        className="p-3 md:p-5 bg-red-50 text-red-500 rounded-2xl md:rounded-3xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                        title="Dar de Baja"
                      >
                        <span className="text-lg md:text-base">🗑️</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL IMPORTAR CURSO */}
      {importModalOpen && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-fade-in" onClick={() => !importing && !saving && setImportModalOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-pop">

            {/* Header oscuro institucional */}
            <header className="bg-primary-color px-10 pt-10 pb-8 flex justify-between items-start flex-shrink-0 relative overflow-hidden">
              {/* Círculos decorativos de fondo */}
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
              <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-white/5" />
              <div className="space-y-2 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary-color animate-pulse" />
                  <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.4em]">IA + GPT-4o</span>
                </div>
                <h2 className="text-4xl font-black text-white font-display tracking-tighter">Importar Curso</h2>
                <p className="text-sm text-white/50 font-medium">Sube un PDF o Word y la IA lo estructura automáticamente.</p>
              </div>
              <button onClick={() => setImportModalOpen(false)} className="relative z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-red-500 transition-all">✕</button>
            </header>

            {/* Cuerpo blanco */}
            <div className="bg-white flex-1 overflow-y-auto px-10 py-8 space-y-6">
              {/* Zona de carga */}
              {!importPreview && (
                <label className={`flex flex-col items-center justify-center gap-5 p-12 border-2 border-dashed rounded-[32px] cursor-pointer transition-all ${importing ? 'border-secondary-color bg-secondary-color/5' : 'border-gray-200 hover:border-primary-color hover:bg-slate-50'}`}>
                  {importing ? (
                    <>
                      <div className="w-14 h-14 border-4 border-primary-color border-t-transparent rounded-full animate-spin" />
                      <div className="text-center">
                        <p className="font-black text-primary-color text-sm">Analizando con IA...</p>
                        <p className="text-xs text-gray-400 mt-1">Puede tomar hasta 30 segundos según el tamaño</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-primary-color rounded-3xl flex items-center justify-center shadow-lg shadow-primary-color/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-primary-color text-base">Arrastra tu archivo aquí</p>
                        <p className="text-sm text-gray-400 mt-1 font-medium">o haz click para seleccionar</p>
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <span className="px-3 py-1 bg-primary-color/10 rounded-full text-[10px] font-black text-primary-color uppercase tracking-widest">PDF</span>
                          <span className="px-3 py-1 bg-primary-color/10 rounded-full text-[10px] font-black text-primary-color uppercase tracking-widest">DOCX</span>
                          <span className="text-[10px] text-gray-300 font-bold">Máx. 20MB</span>
                        </div>
                      </div>
                    </>
                  )}
                  <input type="file" className="hidden" accept=".pdf,.docx,.doc" onChange={handleImportFile} disabled={importing} />
                </label>
              )}

              {/* Preview de la estructura generada */}
              {importPreview && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-5 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0">✓</div>
                    <div>
                      <p className="font-black text-emerald-700 text-sm">Curso estructurado correctamente</p>
                      <p className="text-xs text-emerald-600 mt-0.5">{importPreview.modulos.length} módulos · {importPreview.modulos.reduce((a, m) => a + m.lecciones.length, 0)} lecciones generadas</p>
                    </div>
                  </div>

                  {/* Título editable */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Título del Curso</label>
                    <input
                      type="text"
                      value={importPreview.titulo}
                      onChange={e => setImportPreview(p => ({ ...p, titulo: e.target.value }))}
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color transition-all font-black text-xl text-primary-color shadow-inner"
                    />
                  </div>

                  {/* Descripción editable */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Descripción</label>
                    <textarea
                      rows={3}
                      value={importPreview.descripcion}
                      onChange={e => setImportPreview(p => ({ ...p, descripcion: e.target.value }))}
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color transition-all font-medium text-sm text-gray-700 resize-none shadow-inner"
                    />
                  </div>

                  {/* Estructura de módulos */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Estructura del Curso</label>
                    {importPreview.modulos.map((mod, mi) => (
                      <div key={mi} className="bg-slate-50 rounded-3xl overflow-hidden">
                        <div className="flex items-center gap-3 p-4 px-5">
                          <span className="w-7 h-7 bg-primary-color text-white rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0">{mi + 1}</span>
                          <p className="font-black text-primary-color text-sm truncate flex-1">{mod.nombre}</p>
                          <span className="text-[10px] font-black text-gray-400 flex-shrink-0 bg-white px-2 py-1 rounded-lg">{mod.lecciones.length} lec.</span>
                        </div>
                        <div className="px-4 pb-3 space-y-1">
                          {mod.lecciones.map((lec, li) => (
                            <div key={li} className="flex items-center gap-2 px-3 py-2 bg-white rounded-2xl">
                              <span className="text-[10px] font-black text-gray-300 flex-shrink-0">{li + 1}.</span>
                              <p className="text-xs font-bold text-gray-600 truncate">{lec.titulo}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Procesar otro archivo */}
                  <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-gray-200 rounded-3xl cursor-pointer hover:border-primary-color hover:bg-slate-50 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Procesar otro archivo</span>
                    <input type="file" className="hidden" accept=".pdf,.docx,.doc" onChange={handleImportFile} disabled={importing} />
                  </label>
                </div>
              )}
            </div>

            {importPreview && (
              <div className="bg-white px-10 pb-8 pt-2 flex gap-3 flex-shrink-0 border-t border-gray-100">
                <button onClick={() => setImportPreview(null)} className="flex-1 bg-slate-50 text-gray-400 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">
                  Descartar
                </button>
                <button onClick={handleConfirmImport} disabled={saving} className="flex-[2] bg-primary-color text-white py-5 px-10 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all disabled:opacity-50 shadow-xl shadow-primary-color/30">
                  {saving ? 'Guardando...' : 'Crear Curso Completo'}
                </button>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* MODAL CREAR/EDITAR CURSO */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-fade-in" onClick={() => setIsModalOpen(false)}></div>

          <div className="relative w-full max-w-2xl bg-white rounded-[64px] shadow-2xl overflow-hidden animate-pop max-h-[92vh] flex flex-col">
             <header className="p-10 pb-4 flex justify-between items-start flex-shrink-0">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">
                    {editingCourse ? 'Módulo de Edición' : 'Fundetec Academy Builder'}
                  </span>
                  <h2 className="text-4xl font-black text-primary-color font-display tracking-tighter">
                    {editingCourse ? 'Ajustar Programa' : 'Crear Nueva Oferta'}
                  </h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-primary-color hover:bg-red-500 hover:text-white transition-all shadow-sm">✕</button>
             </header>

             <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 pt-4 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Título Institucional de la Oferta</label>
                    <input 
                      type="text" required 
                      value={formData.title} 
                      onChange={e => setFormData({...formData, title: e.target.value})} 
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color transition-all font-bold text-primary-color text-xl shadow-inner placeholder:text-gray-300"
                      placeholder="Ej: Validación Bachillerato"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Inversión Educativa (COP)</label>
                    <input 
                      type="number" required 
                      value={formData.price} 
                      onChange={e => setFormData({...formData, price: e.target.value})} 
                      className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color font-black text-xl text-primary-color shadow-inner"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Estado en Plataforma</label>
                    <div 
                      onClick={() => setFormData({...formData, is_published: !formData.is_published})}
                      className={`w-full p-5 rounded-3xl border-none cursor-pointer transition-all flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-inner ${
                        formData.is_published ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-gray-400'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                        formData.is_published ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-transparent'
                      }`}>✓</div>
                      {formData.is_published ? 'Lanzar en Vivo' : 'Borrador Técnico'}
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Imagen de Portada</label>
                    <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-50 p-6 rounded-[32px] border border-dashed border-gray-200">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden bg-white shadow-lg flex-shrink-0 group relative">
                        <img 
                          src={formData.thumbnail_url || DEFAULT_COURSE_IMAGE} 
                          className="w-full h-full object-cover" 
                          alt="Preview" 
                        />
                        {loading && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-primary-color border-t-transparent animate-spin rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-4 w-full">
                        <p className="text-[10px] text-gray-400 font-medium">Sube una imagen representativa para el curso (Recomendado: 800x600px, WebP/JPG/PNG).</p>
                        <div className="flex gap-3">
                          <label className="flex-1 bg-primary-color text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest text-center cursor-pointer hover:bg-secondary-color hover:text-primary-color transition-all shadow-md">
                            {formData.thumbnail_url ? 'Cambiar Imagen' : 'Subir Imagen'}
                            <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e.target.files[0])} />
                          </label>
                          {formData.thumbnail_url && (
                            <button 
                              type="button"
                              onClick={() => setFormData({...formData, thumbnail_url: ''})}
                              className="px-6 py-3 bg-white text-red-500 rounded-xl font-black text-[9px] uppercase tracking-widest border border-red-100 hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Descripción Académica Ampliada</label>
                    <RichTextEditor 
                      value={formData.description} 
                      onChange={val => setFormData({...formData, description: val})}
                      placeholder="Detalla los objetivos del programa..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 pb-4 flex-shrink-0 bg-white">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-50 text-gray-400 py-6 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-100 hover:text-gray-500 transition-all">Descartar</button>
                   <button type="submit" disabled={loading} className="flex-2 bg-primary-color text-white py-6 px-12 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl">
                     {loading ? 'Sincronizando...' : (editingCourse ? 'Actualizar Programa' : 'Lanzar Oferta')}
                   </button>
                </div>
             </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
