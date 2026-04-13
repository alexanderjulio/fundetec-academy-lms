'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';

export default function AdminNotificationsPage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [coordinators, setCoordinators] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    target_type: 'all',
    coordinator_id: ''
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role_id').eq('id', session.user.id).single();
        setUserRole(profile?.role_id);
      }
      fetchCoordinators();
      fetchNotifications();
    }
    init();
  }, []);

  const fetchCoordinators = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role_id', 2);
    setCoordinators(data || []);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('global_notifications')
      .select('*, sender:sender_id(full_name), coordinator:coordinator_id(full_name)')
      .order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  const handleEdit = (notif) => {
    setEditingId(notif.id);
    setFormData({
      title: notif.title,
      message: notif.message,
      type: notif.type,
      target_type: notif.target_type,
      coordinator_id: notif.coordinator_id || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from('global_notifications').delete().eq('id', id);
      if (error) throw error;
      showNotification('Mensaje removido del historial.', 'success');
      setConfirmDeleteId(null);
      fetchNotifications();
    } catch (error) {
      showNotification('Error al eliminar: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ title: '', message: '', type: 'info', target_type: 'all', coordinator_id: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        sender_id: session.user.id,
        target_type: formData.target_type,
        coordinator_id: formData.target_type === 'coordinator_group' ? formData.coordinator_id : null
      };

      if (editingId) {
        const { error } = await supabase.from('global_notifications').update(payload).eq('id', editingId);
        if (error) throw error;
        showNotification('Anuncio actualizado en plataforma.', 'success');
      } else {
        const { error } = await supabase.from('global_notifications').insert(payload);
        if (error) throw error;
        showNotification('Comunicado enviado a la plataforma.', 'success');
      }

      if (sendViaWhatsapp) {
        const encodedMsg = encodeURIComponent(`*${formData.title}*\n\n${formData.message}\n\n_Atentamente: Fundetec Academy_`);
        window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
      }

      cancelEdit();
      fetchNotifications();
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const lastNotificationDate = notifications.length > 0 ? new Date(notifications[0].created_at).toLocaleDateString() : 'N/A';

  return (
    <div className="admin-notifications-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in relative">
      
      {/* HEADER BENTO */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none font-display">
            Premium <span className="text-secondary-color">Communicator</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Difusión de anuncios y alertas masivas.</p>
        </div>
        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          <div className="flex-1 lg:flex-none p-5 px-10 bg-slate-50 rounded-[32px] border border-gray-100 flex flex-col">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Envíos Totales</span>
            <span className="text-2xl font-black text-primary-color font-display">{notifications.length}</span>
          </div>
          <div className="flex-1 lg:flex-none p-5 px-10 bg-white border border-gray-100 rounded-[32px] shadow-sm flex flex-col">
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Último Comunicado</span>
            <span className="text-2xl font-black text-emerald-600 font-display">{lastNotificationDate}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* REDACTOR DE COMUNICADOS */}
        <aside className="lg:col-span-4 bg-white p-8 md:p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-10 sticky top-24">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-primary-color tracking-tight font-display">{editingId ? 'Editar Anuncio' : 'Nuevo Anuncio'}</h2>
            <p className="text-xs text-secondary-color font-black uppercase tracking-widest leading-none">Redacción y Lanzamiento</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* WHATSAPP MOCKUP PREVIEW */}
            <div className="relative group p-6 bg-[#E5DDD5] rounded-[40px] overflow-hidden border border-gray-100 shadow-inner">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: '400px' }}></div>
              
              <div className="relative z-10 space-y-4">
                <header className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black">F</div>
                  <div>
                    <p className="text-[10px] font-black text-gray-800 leading-none">Fundetec Academy</p>
                    <p className="text-[8px] text-emerald-600 font-bold">En línea</p>
                  </div>
                </header>

                <div className="max-w-[85%] ml-auto bg-[#DCF8C6] p-4 rounded-2xl rounded-tr-none shadow-sm relative animate-pop text-primary-color">
                   <p className="text-[11px] font-black mb-1">{formData.title || 'Título del Mensaje'}</p>
                   <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{formData.message || 'Tu comunicado aparecerá aquí en tiempo real...'}</p>
                   <div className="flex justify-end items-center gap-1 mt-1 opacity-40">
                      <span className="text-[8px] font-bold">11:42</span>
                      <span className="text-[10px]">✓✓</span>
                   </div>
                   <div className="absolute top-0 -right-2 w-0 h-0 border-l-[10px] border-l-[#DCF8C6] border-b-[10px] border-b-transparent"></div>
                </div>
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-white/50 backdrop-blur-md rounded-full text-[8px] font-black text-gray-500 uppercase tracking-widest border border-white/50">Vista Previa Realtime</div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Título del Mensaje</label>
              <input 
                type="text" required 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color"
                placeholder="Ej: Inicio de matrícula..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Detalle del Comunicado</label>
              <textarea 
                required rows="4"
                value={formData.message} 
                onChange={e => setFormData({...formData, message: e.target.value})}
                className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-medium text-gray-600 text-sm"
                placeholder="Escribe el mensaje aquí..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tipo de Alerta</label>
                <select 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none text-xs font-black text-primary-color appearance-none cursor-pointer"
                >
                  <option value="info">📋 Info</option>
                  <option value="success">✅ Éxito</option>
                  <option value="warning">⚠️ Alerta</option>
                  <option value="danger">🚨 Urgente</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Público</label>
                <select 
                  value={formData.target_type} 
                  onChange={e => setFormData({...formData, target_type: e.target.value})}
                  className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none text-xs font-black text-primary-color appearance-none cursor-pointer"
                >
                  <option value="all">🌐 Todos</option>
                  <option value="coordinator_group">🏠 Grupo</option>
                </select>
              </div>
            </div>

            {formData.target_type === 'coordinator_group' && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Seleccionar Mentor</label>
                <select 
                  required 
                  value={formData.coordinator_id} 
                  onChange={e => setFormData({...formData, coordinator_id: e.target.value})}
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none font-bold text-xs"
                >
                  <option value="">-- Seleccionar --</option>
                  {coordinators.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            )}

            <label className="flex items-center gap-4 p-5 bg-emerald-50 border border-emerald-100 rounded-3xl cursor-pointer transition-all hover:bg-emerald-100 group">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-emerald-300 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                checked={sendViaWhatsapp}
                onChange={(e) => setSendViaWhatsapp(e.target.checked)}
              />
              <div className="flex-1">
                 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Integrar con WhatsApp</p>
                 <p className="text-[8px] font-bold text-emerald-500/60 uppercase mt-1">Lanzar link de difusión masiva</p>
              </div>
              <span className="text-xl group-hover:scale-125 transition-transform">📱</span>
            </label>

            <div className="flex gap-2">
              {editingId && (
                <button type="button" onClick={cancelEdit} className="px-6 py-5 bg-slate-100 text-gray-400 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all">✕</button>
              )}
              <button type="submit" disabled={loading} className={`flex-1 py-5 rounded-[32px] font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl ${editingId ? 'bg-secondary-color text-primary-color shadow-secondary-color/20' : 'bg-primary-color text-white shadow-primary-color/20 hover:bg-secondary-color hover:text-primary-color'}`}>
                {loading ? 'Procesando...' : (editingId ? 'Actualizar' : 'Lanzar Comunicación')}
              </button>
            </div>
          </form>
        </aside>

        {/* HISTORIAL DE ANUNCIOS */}
        <main className="lg:col-span-8 bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[700px]">
          <header className="p-8 md:p-10 border-b border-gray-50 flex justify-between items-center bg-slate-50/30">
            <h2 className="text-2xl font-black text-primary-color tracking-tight font-display">Historial de Comunicados</h2>
            <div className="flex gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            </div>
          </header>

          <div className="flex-1 p-8 md:p-12 space-y-6 max-h-[900px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-40 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl shadow-inner">📬</div>
                <h3 className="text-xl font-black text-primary-color font-display">Bandeja Vacía</h3>
                <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">Aún no se han emitido comunicados.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`group p-8 rounded-[40px] border border-gray-100 transition-all duration-500 relative bg-white hover:shadow-2xl hover:shadow-primary-color/5 overflow-hidden border-l-[12px] ${
                  n.type === 'danger' ? 'border-l-red-500' : 
                  n.type === 'warning' ? 'border-l-amber-500' : 
                  n.type === 'success' ? 'border-l-emerald-500' : 'border-l-primary-color'
                }`}>
                  <header className="flex justify-between items-start mb-6">
                    <div className="flex flex-wrap gap-2">
                       <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${
                         n.type === 'danger' ? 'bg-red-50 text-red-500' :
                         n.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                         n.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-gray-500'
                       }`}>
                         {n.type === 'danger' ? 'Urgente' : n.type === 'warning' ? 'Alerta' : n.type === 'success' ? 'Logro' : 'Informativo'}
                       </span>
                       <span className="px-4 py-2 bg-slate-100 text-primary-color rounded-full text-[9px] font-black uppercase tracking-widest">
                         {n.target_type === 'all' ? '🌐 Toda la Academia' : `🏠 Grupo: ${n.coordinator?.full_name}`}
                       </span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => handleEdit(n)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center grayscale hover:grayscale-0 transition-all shadow-sm">✏️</button>
                       {userRole === 1 && (
                         <button 
                           onClick={() => handleDelete(n.id)}
                           className={`h-10 px-4 rounded-xl flex items-center justify-center text-[10px] font-black transition-all shadow-sm ${confirmDeleteId === n.id ? 'bg-red-500 text-white' : 'bg-slate-50 text-red-500 border border-red-100'}`}
                         >
                           {confirmDeleteId === n.id ? 'Confirmar' : '🗑️'}
                         </button>
                       )}
                    </div>
                  </header>

                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-primary-color tracking-tight font-display">{n.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed font-medium">{n.message}</p>
                  </div>

                  <footer className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-primary-color">
                         {n.sender?.full_name?.charAt(0)}
                       </div>
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Remitente: {n.sender?.full_name}</span>
                    </div>
                    <span className="text-[10px] font-black text-gray-300 uppercase">{new Date(n.created_at).toLocaleDateString()}</span>
                  </footer>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
