'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';
import { updateLandingSection } from '@/app/actions/admin_actions';
import { optimizeImage } from '@/utils/imageOptimizer';
import RichTextEditor from '@/components/ui/RichTextEditor';

const Icons = {
  Image: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
  Save: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>,
  Chevron: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  Eye: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11-8 11 8 11 8-4-8-11-8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
};

export default function AdminLandingPage() {
  const { showNotification } = useNotification();
  const [sections, setSections] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Estado del formulario de sección actual
  const [editData, setEditData] = useState({
    title: '',
    subtitle: '',
    is_visible: true,
    content: {}
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setCurrentUser(profile);

    const { data } = await supabase.from('landing_sections').select('*').order('id', { ascending: true });
    setSections(data || []);
    
    const initial = data?.find(s => s.slug === 'hero');
    if (initial) setEditData({ ...initial });
    
    setLoading(false);
  };

  const handleSelectSection = (slug) => {
    let section = sections.find(s => s.slug === slug);
    
    if (!section) {
      // Si la sección no existe en la DB todavía, inicializamos un objeto base
      section = {
        slug: slug,
        title: '',
        subtitle: '',
        is_visible: true,
        content: slug === 'faq' ? { items: [] } : {}
      };
    }

    setSelectedSlug(slug);
    // Asegurar que para FAQ siempre exista la estructura de items (incluso si viene de la DB vacía)
    let processed = { ...section };
    if (slug === 'faq') {
      if (!processed.content) processed.content = { items: [] };
      if (!processed.content.items) processed.content.items = [];
    }
    setEditData(processed);
  };

  const handleFileUpload = async (file, key) => {
    if (!file) return;
    setSaving(true);
    try {
      // Optimizar imagen antes de subir
      const optimizedFile = await optimizeImage(file);
      
      const fileExt = optimizedFile.name.split('.').pop();
      const fileName = `${selectedSlug}_${key}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `site_assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('site_assets')
        .upload(filePath, optimizedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site_assets')
        .getPublicUrl(filePath);

      setEditData(prev => ({
        ...prev,
        content: { ...prev.content, [key]: publicUrl }
      }));
      showNotification('Imagen cargada con éxito.', 'success');
    } catch (error) {
      console.error('Error al subir imagen:', error);
      let errorMsg = error.message;
      if (errorMsg.includes('400') || errorMsg.includes('bucket_not_found')) {
        errorMsg = 'Error 400: El contenedor de archivos "site_assets" no existe en Supabase o no es público. Por favor, créalo en la consola de Supabase Storage.';
      }
      showNotification(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, ...updatePackage } = editData;
    const res = await updateLandingSection(selectedSlug, updatePackage, currentUser.role_id);
    
    if (res.success) {
      showNotification(`Sección ${selectedSlug} actualizada.`, 'success');
      // Actualizar lista local
      setSections(sections.map(s => s.slug === selectedSlug ? { ...editData } : s));
    } else {
      showNotification(res.error, 'error');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-40 text-center animate-pulse font-black text-gray-300 uppercase tracking-widest text-xs">Sincronizando Gestor Visual...</div>;

  return (
    <div className="admin-landing-container max-w-[1400px] mx-auto p-4 md:p-10 space-y-10 animate-fade-in font-display">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
            Gestor de <span className="text-secondary-color">Portada Elite</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Administra los recursos visuales y textos de la página principal en tiempo real.</p>
        </div>
        <div className="flex bg-slate-50 p-2 rounded-[24px]">
           {['hero', 'stats', 'bachillerato', 'tecnicos', 'faq', 'contacto', 'institucional'].map(slug => (
              <button 
                key={slug}
                onClick={() => handleSelectSection(slug)}
                className={`px-6 py-3 rounded-[18px] text-[9px] font-black uppercase tracking-widest transition-all ${selectedSlug === slug ? 'bg-primary-color text-white shadow-xl' : 'text-gray-400 hover:text-primary-color'}`}
              >
                {slug}
              </button>
           ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* EDITOR DE SECCIÓN */}
        <div className="lg:col-span-12 bg-white rounded-[64px] border border-gray-100 shadow-xl overflow-hidden animate-pop">
           <header className="p-10 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-primary-color text-white rounded-2xl flex items-center justify-center font-black uppercase text-[10px]">{selectedSlug.substring(0,2)}</div>
                 <div>
                    <h2 className="text-xl font-black text-primary-color tracking-tighter capitalize underline decoration-secondary-color decoration-4 underline-offset-4">Sección: {selectedSlug}</h2>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-1">Modificando contenido dinámico</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <button 
                    onClick={() => setEditData({...editData, is_visible: !editData.is_visible})}
                    className={`px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${editData.is_visible ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'}`}
                 >
                    {editData.is_visible ? 'Visible en Web' : 'Sección Oculta'}
                 </button>
                 <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="px-10 py-3 bg-primary-color text-white rounded-full font-black text-[9px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 flex items-center gap-2"
                 >
                    <Icons.Save /> {saving ? 'Sincronizando...' : 'Guardar Cambios'}
                 </button>
              </div>
           </header>

           <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* TEXTO Y CONFIGURACIÓN */}
              <div className="space-y-8">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Título Principal</label>
                     <RichTextEditor 
                        value={editData.title || ''}
                        onChange={val => setEditData({...editData, title: val})}
                        placeholder="Escribe el título llamativo..."
                     />
                  </div>
                 
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Subtítulo / Descripción</label>
                    {selectedSlug === 'faq' ? (
                       <div className="space-y-6">
                          <header className="flex justify-between items-center bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm">
                             <h3 className="text-[10px] font-black text-primary-color uppercase tracking-widest">Preguntas Configuradas</h3>
                             <button 
                                onClick={() => {
                                   const currentContent = editData.content || {};
                                   const currentItems = currentContent.items || [];
                                   setEditData({
                                      ...editData, 
                                      content: { 
                                         ...currentContent, 
                                         items: [...currentItems, { q: 'Nueva Pregunta', a: 'Nueva Respuesta' }] 
                                      } 
                                   });
                                }}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest"
                             >+ Añadir</button>
                          </header>
                          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                             {(editData.content?.items || []).map((item, idx) => (
                                <div key={idx} className="bg-slate-50 p-6 rounded-[28px] border border-gray-100 space-y-4 relative group">
                                   <button 
                                      onClick={() => {
                                         const filtered = editData.content.items.filter((_, i) => i !== idx);
                                         setEditData({ ...editData, content: { ...editData.content, items: filtered } });
                                      }}
                                      className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center text-[10px] hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                   >✕</button>
                                   <div className="space-y-2">
                                      <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest pl-2">Pregunta</label>
                                      <input 
                                         value={item.q}
                                         onChange={e => {
                                            const currentItems = [...(editData.content?.items || [])];
                                            currentItems[idx] = { ...currentItems[idx], q: e.target.value };
                                            setEditData({ 
                                               ...editData, 
                                               content: { ...(editData.content || {}), items: currentItems } 
                                            });
                                         }}
                                         className="w-full bg-white border border-gray-100 p-4 rounded-[18px] outline-none font-bold text-primary-color text-xs focus:ring-2 focus:ring-secondary-color/20"
                                         placeholder="Escribe la pregunta aquí..."
                                      />
                                   </div>
                                   <div className="space-y-2">
                                      <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest pl-2">Respuesta</label>
                                      <textarea 
                                         value={item.a}
                                         onChange={e => {
                                            const currentItems = [...(editData.content?.items || [])];
                                            currentItems[idx] = { ...currentItems[idx], a: e.target.value };
                                            setEditData({ 
                                               ...editData, 
                                               content: { ...(editData.content || {}), items: currentItems } 
                                            });
                                         }}
                                         className="w-full bg-white border border-gray-100 p-4 rounded-[18px] outline-none font-medium text-gray-500 text-xs focus:ring-2 focus:ring-secondary-color/20 leading-relaxed"
                                         placeholder="Escribe la respuesta detallada..."
                                         rows="2"
                                      ></textarea>
                                   </div>
                                </div>
                             ))}
                             {(editData.content?.items || []).length === 0 && (
                                <div className="p-10 text-center border-2 border-dashed border-gray-100 rounded-[32px]">
                                   <p className="text-gray-300 font-bold text-xs uppercase tracking-widest">No hay preguntas registradas</p>
                                </div>
                             )}
                          </div>
                       </div>
                    ) : (
                       <RichTextEditor 
                           value={editData.subtitle || ''}
                           onChange={val => setEditData({...editData, subtitle: val})}
                           placeholder="Escribe la descripción de la sección..."
                        />
                    )}
                 </div>

                 {/* CAMPOS DINÁMICOS DEL JSON */}
                 {selectedSlug !== 'faq' && (
                    <div className="bg-slate-50 p-10 rounded-[48px] border border-gray-100 space-y-8">
                       <header className="flex items-center gap-2 mb-4">
                          <span className="text-lg">⚙️</span>
                          <h3 className="text-xs font-black text-primary-color uppercase tracking-widest">Ajustes del Bloque</h3>
                       </header>
                       <div className="grid grid-cols-1 gap-6">
                          {(() => {
                             const content = editData.content || {};
                             let keys = Object.keys(content);
                             
                             if (editData.slug === 'institucional') {
                                const essential = ['academy_name', 'copyright_text', 'footer_description', 'certification_text', 'facebook_link', 'instagram_link', 'whatsapp_link'];
                                essential.forEach(k => { if (!keys.includes(k)) keys.push(k); });
                                keys = keys.filter(k => {
                                   if (k.endsWith('_url')) {
                                      const base = k.replace('_url', '');
                                      if (keys.includes(`${base}_link`)) return false;
                                   }
                                   return true;
                                });
                             }

                             if (editData.slug === 'stats') {
                                ['stat1', 'stat2', 'stat3', 'stat4'].forEach(s => {
                                   if (!keys.includes(`${s}_val`)) keys.push(`${s}_val`);
                                   if (!keys.includes(`${s}_label`)) keys.push(`${s}_label`);
                                });
                             }

                             return keys.map(key => {
                                const val = content[key] || '';
                                if (/(image|img|logo|banner|thumbnail)/i.test(key)) return null;
                                
                                const isLong = typeof val === 'string' && (val.length > 50 || key === 'mision' || key === 'vision');
                                
                                return (
                                   <div key={key} className="space-y-2">
                                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter pl-2">
                                         {key.replace(/_/g, ' ')}
                                      </label>
                                      {isLong ? (
                                        <textarea 
                                          rows="4"
                                          value={val}
                                          onChange={e => setEditData({
                                             ...editData,
                                             content: { ...editData.content, [key]: e.target.value }
                                          })}
                                          className="w-full bg-white border border-gray-100 p-5 rounded-[24px] outline-none font-medium text-primary-color text-xs focus:ring-2 focus:ring-secondary-color/20 leading-relaxed"
                                        ></textarea>
                                      ) : (
                                        <input 
                                           type="text"
                                           value={val}
                                           onChange={e => setEditData({
                                              ...editData,
                                              content: { ...editData.content, [key]: e.target.value }
                                           })}
                                           className="w-full bg-white border border-gray-100 p-4 rounded-[18px] outline-none font-bold text-primary-color text-xs focus:ring-2 focus:ring-secondary-color/20"
                                        />
                                      )}
                                   </div>
                                );
                             });
                          })()}
                       </div>
                    </div>
                 )}
              </div>

              {/* GESTIÓN DE RECURSOS VISUALES */}
              <div className="space-y-8">
                 <header className="pl-4">
                    <h3 className="text-xs font-black text-primary-color uppercase tracking-[0.2em] flex items-center gap-3">
                       <Icons.Image /> Recursos Visuales
                    </h3>
                    <p className="text-[10px] font-medium text-gray-400 mt-1 italic">Sube archivos en formato WebP o PNG para máxima calidad.</p>
                 </header>

                 {/* PREVISUALIZADOR Y CARGADOR */}
                 <div className="space-y-8">
                    {Object.keys(editData.content || {}).filter(k => {
                       const val = editData.content[k];
                       const looksLikeImage = typeof val === 'string' && (val.includes('supabase') || val.match(/\.(jpg|jpeg|png|webp|svg|gif)/i));
                       const isImageName = /(image|img|logo|banner|thumbnail|url)/i.test(k);
                       return isImageName || looksLikeImage;
                    }).map(imgKey => (
                       <div key={imgKey} className="group relative bg-slate-50 p-2 rounded-[48px] border border-gray-100 overflow-hidden hover:border-secondary-color transition-all duration-500 shadow-sm">
                          <div className="relative aspect-video rounded-[40px] overflow-hidden bg-gray-200 shadow-inner">
                             {editData.content[imgKey] ? (
                                <img src={editData.content[imgKey]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Vista previa" />
                             ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                   <Icons.Image />
                                   <p className="text-[9px] font-black uppercase mt-4">Sin imagen asignada</p>
                                </div>
                             )}
                             <div className="absolute inset-0 bg-primary-color/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-10 text-center">
                                <label className="cursor-pointer bg-white text-primary-color px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color transition-all active:scale-95 shadow-2xl">
                                   Cambiar Imagen Principal
                                   <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e.target.files[0], imgKey)} />
                                </label>
                             </div>
                          </div>
                          <div className="p-8 pb-4 flex justify-between items-center">
                             <p className="text-[10px] font-black text-primary-color uppercase tracking-widest pl-2">Asset: {imgKey.replace(/_/g, ' ')}</p>
                             <div className="flex gap-2">
                                <a href={editData.content[imgKey]} target="_blank" className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-primary-color hover:bg-slate-50 transition-all shadow-sm">
                                   <Icons.Eye />
                                </a>
                             </div>
                          </div>
                       </div>
                    ))}
                    
                    {Object.keys(editData.content || {}).filter(k => /(image|img|logo|banner|thumbnail)/i.test(k)).length === 0 && (
                       <div className="bg-slate-50 border-4 border-dashed border-gray-100 p-20 rounded-[56px] text-center">
                          <p className="text-gray-300 font-black uppercase tracking-widest text-[10px]">Esta sección no utiliza assets visuales dinámicos.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>

    </div>
  );
}
