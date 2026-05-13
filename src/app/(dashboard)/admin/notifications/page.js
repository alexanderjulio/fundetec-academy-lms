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

  const typeOptions = [
    { value: 'info',    label: 'Info',    emoji: '📋', color: 'bg-slate-100 text-gray-600',   active: 'bg-primary-color text-white' },
    { value: 'success', label: 'Éxito',   emoji: '✅', color: 'bg-slate-100 text-gray-600',   active: 'bg-emerald-500 text-white' },
    { value: 'warning', label: 'Alerta',  emoji: '⚠️', color: 'bg-slate-100 text-gray-600',   active: 'bg-amber-500 text-white' },
    { value: 'danger',  label: 'Urgente', emoji: '🚨', color: 'bg-slate-100 text-gray-600',   active: 'bg-red-500 text-white' },
  ];

  return (
    <div className="admin-notifications-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-6 animate-fade-in font-display">

      {/* HEADER COMPACTO */}
      <header className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-primary-color tracking-tighter leading-none">
            Premium <span className="text-secondary-color">Communicator</span>
          </h1>
          <p className="text-gray-400 text-sm font-medium mt-1">Difusión de anuncios y alertas masivas.</p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <div className="text-center px-5 py-3 bg-slate-50 rounded-2xl border border-gray-100">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Envíos</p>
            <p className="text-xl font-black text-primary-color">{notifications.length}</p>
          </div>
          <div className="text-center px-5 py-3 bg-emerald-50 rounded-2xl border border-emerald-100">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Último</p>
            <p className="text-sm font-black text-emerald-600">{lastNotificationDate}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* FORMULARIO */}
        <aside className="lg:col-span-4 bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden sticky top-24">
          {/* Título del form */}
          <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-primary-color tracking-tight">{editingId ? 'Editar Anuncio' : 'Nuevo Anuncio'}</h2>
              <p className="text-[10px] text-secondary-color font-black uppercase tracking-widest">Redacción y Lanzamiento</p>
            </div>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="w-8 h-8 bg-slate-100 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all text-sm font-black">✕</button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* PREVIEW WHATSAPP COMPACTO */}
            <div className="relative p-4 bg-[#E5DDD5] rounded-3xl overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">F</div>
                <div>
                  <p className="text-[10px] font-black text-gray-800 leading-none">Fundetec Academy</p>
                  <p className="text-[8px] text-emerald-600 font-bold">En línea</p>
                </div>
              </div>
              <div className="max-w-[88%] ml-auto bg-[#DCF8C6] p-3 rounded-2xl rounded-tr-none shadow-sm relative text-primary-color">
                <p className="text-[11px] font-black mb-0.5 line-clamp-1">{formData.title || 'Título del Mensaje'}</p>
                <p className="text-[10px] leading-relaxed line-clamp-2 text-gray-600">{formData.message || 'Tu comunicado aparecerá aquí...'}</p>
                <div className="flex justify-end items-center gap-1 mt-1 opacity-40">
                  <span className="text-[8px] font-bold">11:42</span>
                  <span className="text-[10px]">✓✓</span>
                </div>
                <div className="absolute top-0 -right-2 w-0 h-0 border-l-[8px] border-l-[#DCF8C6] border-b-[8px] border-b-transparent"></div>
              </div>
              <p className="text-center text-[8px] font-black text-gray-400 uppercase tracking-widest mt-2">Vista previa en tiempo real</p>
            </div>

            {/* TÍTULO */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Título del Mensaje</label>
              <input
                type="text" required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color text-sm"
                placeholder="Ej: Inicio de matrícula..."
              />
            </div>

            {/* MENSAJE */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Detalle del Comunicado</label>
              <textarea
                required rows="3"
                value={formData.message}
                onChange={e => setFormData({...formData, message: e.target.value})}
                className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-medium text-gray-600 text-sm resize-none"
                placeholder="Escribe el mensaje aquí..."
              />
            </div>

            {/* TIPO — pill buttons */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tipo de Alerta</label>
              <div className="grid grid-cols-4 gap-1.5">
                {typeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({...formData, type: opt.value})}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all ${formData.type === opt.value ? opt.active : opt.color}`}
                  >
                    <span className="text-base">{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PÚBLICO — toggle */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Público</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'all', label: 'Todos', emoji: '🌐' },
                  { value: 'coordinator_group', label: 'Grupo', emoji: '🏠' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({...formData, target_type: opt.value, coordinator_id: ''})}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${formData.target_type === opt.value ? 'bg-primary-color text-white' : 'bg-slate-100 text-gray-500'}`}
                  >
                    <span>{opt.emoji}</span>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SELECTOR DE COORDINADOR */}
            {formData.target_type === 'coordinator_group' && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Seleccionar Mentor</label>
                <select
                  required
                  value={formData.coordinator_id}
                  onChange={e => setFormData({...formData, coordinator_id: e.target.value})}
                  className="w-full bg-slate-50 border-none p-4 rounded-2xl outline-none font-bold text-sm text-primary-color"
                >
                  <option value="">-- Seleccionar --</option>
                  {coordinators.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            )}

            {/* WHATSAPP TOGGLE */}
            <label className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-emerald-300 text-emerald-500 cursor-pointer"
                checked={sendViaWhatsapp}
                onChange={(e) => setSendViaWhatsapp(e.target.checked)}
              />
              <div className="flex-1">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Integrar con WhatsApp</p>
                <p className="text-[9px] text-emerald-500/70 font-bold mt-0.5">Difusión masiva al publicar</p>
              </div>
              <span className="text-lg group-hover:scale-125 transition-transform">📱</span>
            </label>

            {/* BOTÓN ENVIAR */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg ${
                editingId
                  ? 'bg-secondary-color text-primary-color shadow-secondary-color/20'
                  : 'bg-primary-color text-white shadow-primary-color/20 hover:opacity-90'
              }`}
            >
              {loading ? 'Procesando...' : editingId ? '✓ Actualizar Anuncio' : '🚀 Lanzar Comunicación'}
            </button>
          </form>
        </aside>

        {/* HISTORIAL */}
        <main className="lg:col-span-8 bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-black text-primary-color tracking-tight">Historial de Comunicados</h2>
            <div className="flex gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            </div>
          </div>

          <div className="flex-1 p-5 md:p-8 space-y-4 max-h-[900px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">📬</div>
                <h3 className="text-lg font-black text-primary-color">Bandeja Vacía</h3>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Sin comunicados emitidos.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`group p-5 md:p-6 rounded-2xl border border-gray-100 bg-white transition-all hover:shadow-lg relative border-l-4 ${
                  n.type === 'danger'  ? 'border-l-red-500' :
                  n.type === 'warning' ? 'border-l-amber-500' :
                  n.type === 'success' ? 'border-l-emerald-500' : 'border-l-primary-color'
                }`}>
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        n.type === 'danger'  ? 'bg-red-50 text-red-500' :
                        n.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                        n.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-gray-500'
                      }`}>
                        {n.type === 'danger' ? 'Urgente' : n.type === 'warning' ? 'Alerta' : n.type === 'success' ? 'Logro' : 'Informativo'}
                      </span>
                      <span className="px-3 py-1 bg-slate-100 text-primary-color rounded-full text-[9px] font-black uppercase tracking-widest">
                        {n.target_type === 'all' ? '🌐 Toda la Academia' : `🏠 ${n.coordinator?.full_name}`}
                      </span>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      <button onClick={() => handleEdit(n)} className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-sm hover:bg-slate-100 transition-all">✏️</button>
                      {userRole === 1 && (
                        <button
                          onClick={() => handleDelete(n.id)}
                          className={`h-8 px-3 rounded-lg text-[10px] font-black transition-all ${confirmDeleteId === n.id ? 'bg-red-500 text-white' : 'bg-red-50 text-red-400'}`}
                        >
                          {confirmDeleteId === n.id ? 'Confirmar' : '🗑️'}
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-black text-primary-color tracking-tight mb-1">{n.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{n.message}</p>

                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-primary-color">
                        {n.sender?.full_name?.charAt(0)}
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{n.sender?.full_name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-300">{new Date(n.created_at).toLocaleDateString('es-CO')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
