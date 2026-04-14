'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';

const Icons = {
  Mail: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  WhatsApp: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.2a8.38 8.38 0 0 1 3.8.9L22 4Z"/></svg>,
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Filter: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>,
  Eye: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  More: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
};

export default function AdminLeadsPage() {
  const { showNotification } = useNotification();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchLeads();

    // Suscripción en Tiempo Real
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLeads(prev => [payload.new, ...prev]);
          showNotification('¡Nuevo prospecto recibido!', 'success');
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(lead => lead.id === payload.new.id ? payload.new : lead));
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(lead => lead.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setLeads(data || []);
    setLoading(false);
  };

  const updateStatus = async (id, newStatus) => {
    setUpdatingId(id);
    const { data, error, count } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', id)
      .select(); // Forzamos select para verificar que la fila fue realmente actualizada

    if (!error && data?.length > 0) {
      setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, status: newStatus } : lead));
      if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status: newStatus });
      showNotification('Estado actualizado con éxito.', 'success');
    } else {
      console.error('Update Error:', error);
      showNotification('No se pudo actualizar en la base de datos. ¿Ejecutaste el SQL de permisos?', 'error');
    }
    setUpdatingId(null);
  };

  const deleteLead = async (id) => {
    const idToUse = id || confirmDeleteId;
    if (!idToUse) return;

    const { data, error } = await supabase
      .from('leads')
      .delete()
      .eq('id', idToUse)
      .select(); // Verificamos que realmente se eliminó algo

    if (!error && data?.length > 0) {
      setLeads(prev => prev.filter(lead => lead.id !== idToUse));
      setIsModalOpen(false);
      setConfirmDeleteId(null);
      showNotification('Prospecto eliminado permanentemente.', 'success');
    } else {
      console.error('Delete Error:', error);
      showNotification('Error al eliminar. Verifica tus permisos de administrador.', 'error');
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesFilter = filter === 'all' || lead.status === filter;
      const matchesSearch = 
        lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [leads, filter, searchTerm]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      today: leads.filter(l => l.created_at.startsWith(today)).length,
      contacted: leads.filter(l => l.status === 'contacted').length,
    };
  }, [leads]);

  const getWhatsAppLink = (phone, name) => {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hola ${name}, te hablamos de FUNDETEC. Recibimos tu interés en nuestros programas. ¿Cómo podemos orientarte?`);
    return `https://wa.me/${cleanPhone.startsWith('57') ? cleanPhone : '57' + cleanPhone}?text=${message}`;
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSecs = Math.floor((now - date) / 1000);
    
    if (diffInSecs < 60) return 'Hace un momento';
    if (diffInSecs < 3600) return `Hace ${Math.floor(diffInSecs / 60)} min`;
    if (diffInSecs < 86400) return `Hace ${Math.floor(diffInSecs / 3600)} h`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="admin-crm-container max-w-[1400px] mx-auto p-4 md:p-10 space-y-10 animate-fade-in font-display">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
            Gestión de <span className="text-secondary-color">Prospectos</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Monitoriza y convierte interesados en estudiantes de élite.</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary-color transition-colors">
              <Icons.Search />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 pr-8 py-4 bg-slate-50 border-none rounded-[24px] text-xs font-bold text-primary-color outline-none focus:ring-4 focus:ring-secondary-color/10 transition-all w-[300px]"
            />
          </div>
        </div>
      </header>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Histórico', val: stats.total, color: 'bg-primary-color', textColor: 'text-white' },
          { label: 'Nuevos (Pendientes)', val: stats.new, color: 'bg-amber-400', textColor: 'text-primary-color' },
          { label: 'Recibidos Hoy', val: stats.today, color: 'bg-secondary-color', textColor: 'text-primary-color' },
          { label: 'Ya Contactados', val: stats.contacted, color: 'bg-emerald-400', textColor: 'text-primary-color' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.color} ${stat.textColor} p-8 rounded-[40px] shadow-2xl shadow-gray-200/50 flex flex-col justify-between h-[180px] group hover:-translate-y-2 transition-transform duration-500`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{stat.label}</p>
            <h3 className="text-6xl font-black tracking-tighter font-display leading-none">{stat.val}</h3>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="flex p-1.5 bg-slate-50 rounded-[24px]">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'new', label: 'Nuevos' },
            { id: 'contacted', label: 'Contactados' },
            { id: 'archived', label: 'Archivados' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-8 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${filter === opt.id ? 'bg-primary-color text-white shadow-xl' : 'text-gray-400 hover:text-primary-color'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest pr-4">Mostrando: <span className="text-primary-color">{filteredLeads.length}</span> resultados</p>
      </div>

      {/* MAIN CONTENT TABLE */}
      <div className="bg-white rounded-[56px] border border-gray-100 shadow-2xl overflow-hidden animate-pop">
        {loading ? (
          <div className="p-40 text-center animate-pulse font-black text-gray-300 uppercase tracking-widest text-xs">Sincronizando Base de Datos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100">
                  <th className="p-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Fecha</th>
                  <th className="p-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Información del Prospecto</th>
                  <th className="p-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Programa</th>
                  <th className="p-8 text-[11px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                  <th className="p-8 text-[11px] font-black uppercase tracking-widest text-gray-400 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map(lead => (
                    <tr key={lead.id} className={`group hover:bg-slate-50/80 transition-colors ${lead.status === 'new' ? 'bg-amber-50/30' : ''}`}>
                      <td className="p-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-primary-color">{getRelativeTime(lead.created_at)}</span>
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mr-auto">
                            {new Date(lead.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col">
                          <h4 className="text-lg font-black text-primary-color tracking-tight leading-tight">{lead.full_name}</h4>
                          <span className="text-xs font-semibold text-gray-400 group-hover:text-primary-color transition-colors">{lead.email}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <span className="inline-block px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          {lead.program_of_interest || 'Sin especificar'}
                        </span>
                      </td>
                      <td className="p-8">
                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          lead.status === 'new' ? 'bg-amber-100 text-amber-600' : 
                          lead.status === 'contacted' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-gray-400'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                             lead.status === 'new' ? 'bg-amber-500 animate-pulse' : 
                             lead.status === 'contacted' ? 'bg-emerald-500' : 'bg-gray-300'
                          }`}></span>
                          {lead.status === 'new' ? 'Nuevo' : lead.status === 'contacted' ? 'Contactado' : 'Archivado'}
                        </span>
                      </td>
                      <td className="p-8 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setSelectedLead(lead); setIsModalOpen(true); }}
                            className="w-10 h-10 bg-white border border-gray-100 text-primary-color rounded-xl flex items-center justify-center hover:bg-primary-color hover:text-white transition-all shadow-sm"
                            title="Ver Ficha"
                          >
                            <Icons.Eye />
                          </button>
                          <a 
                            href={getWhatsAppLink(lead.whatsapp, lead.full_name)}
                            target="_blank"
                            className="w-10 h-10 bg-white border border-gray-100 text-emerald-500 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            title="WhatsApp"
                          >
                            <Icons.WhatsApp />
                          </a>
                          <button 
                            onClick={() => setConfirmDeleteId(lead.id)}
                            className="w-10 h-10 bg-white border border-gray-100 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                            title="Eliminar"
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-32 text-center text-gray-300 font-bold italic">No se encontraron prospectos con estos criterios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
        {/* MODALS RENDERED VIA PORTAL PREMIUM */}
      {mounted && isModalOpen && selectedLead && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-900/40 animate-fade-in">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-white w-full max-w-4xl rounded-[64px] shadow-2xl overflow-hidden animate-pop max-h-[90vh] flex flex-col">
            <header className="p-12 pb-0 flex justify-between items-start flex-shrink-0">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Ficha de Prospecto</span>
                <h2 className="text-4xl font-black text-primary-color tracking-tighter leading-none mt-2 font-display">{selectedLead.full_name}</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-primary-color hover:text-white hover:bg-red-500 transition-all font-light text-3xl shadow-sm"
              >✕</button>
            </header>

            <div className="p-12 grid grid-cols-1 lg:grid-cols-12 gap-16">
              <div className="lg:col-span-4 space-y-10">
                 <div className="flex flex-col gap-10">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Contacto Directo</p>
                      <div className="bg-slate-50 p-6 rounded-3xl shadow-inner">
                        <p className="text-xl font-black text-primary-color tracking-tight">{selectedLead.whatsapp}</p>
                        <p className="text-sm font-bold text-gray-400 truncate">{selectedLead.email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Programa de Interés</p>
                      <div className="bg-amber-50 p-6 rounded-3xl shadow-inner border border-amber-100/50">
                        <p className="text-xl font-black text-amber-600 tracking-tight">{selectedLead.program_of_interest || 'Varios'}</p>
                      </div>
                    </div>
 
                    <div className="pt-6 border-t border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 pl-2">Gestión de Tráfico</p>
                      <div className="flex flex-col gap-3">
                         {['new', 'contacted', 'archived'].map(status => (
                            <button
                              key={status}
                              onClick={() => updateStatus(selectedLead.id, status)}
                              disabled={updatingId === selectedLead.id}
                              className={`px-8 py-5 rounded-3xl text-[10px] font-black uppercase tracking-widest text-left transition-all flex items-center justify-between shadow-sm ${
                                selectedLead.status === status 
                                  ? 'bg-primary-color text-white shadow-xl shadow-primary-color/20' 
                                  : 'bg-slate-50 text-gray-400 hover:bg-slate-100 hover:text-primary-color'
                              }`}
                            >
                               {status === 'new' ? 'Nuevo Registro' : status === 'contacted' ? 'Contactado' : 'Mover al Archivo'}
                               {selectedLead.status === status && <span className="w-2.5 h-2.5 bg-secondary-color rounded-full animate-pulse"></span>}
                            </button>
                         ))}
                      </div>
                    </div>
                 </div>
              </div>
 
              <div className="lg:col-span-8 flex flex-col h-full">
                <div className="flex-1 bg-slate-50 p-10 rounded-[48px] border border-gray-100 relative group overflow-hidden shadow-inner">
                  <div className="absolute top-0 right-0 p-8 text-primary-color/5 group-hover:text-primary-color/10 transition-colors">
                    <Icons.Mail />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 pl-2">Mensaje del Interesado</p>
                  <p className="text-2xl font-black text-primary-color leading-[1.3] tracking-tighter italic">
                    "{selectedLead.message_detail || 'Sin mensaje adicional.'}"
                  </p>
                  <div className="mt-12 flex items-center gap-4">
                    <div className="w-10 h-[2px] bg-secondary-color"></div>
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                       Recibido el {new Date(selectedLead.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
 
                <div className="mt-10 flex gap-4">
                  <a 
                    href={getWhatsAppLink(selectedLead.whatsapp, selectedLead.full_name)}
                    target="_blank"
                    className="flex-1 bg-emerald-500 text-white p-7 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] text-center shadow-2xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 group"
                  >
                    <div className="group-hover:rotate-12 transition-transform"><Icons.WhatsApp /></div>
                    Iniciar Conversación Elite
                  </a>
                  <button 
                    onClick={() => setConfirmDeleteId(selectedLead.id)}
                    className="w-24 bg-red-50 text-red-500 p-6 rounded-[32px] font-black text-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
 
      {/* CUSTOM CONFIRM DELETE MODAL PREMIUM */}
      {mounted && confirmDeleteId && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 animate-fade-in">
           <div className="absolute inset-0 bg-primary-color/70 backdrop-blur-xl" onClick={() => setConfirmDeleteId(null)}></div>
           <div className="relative bg-white p-10 rounded-[56px] shadow-2xl max-w-[400px] w-full text-center space-y-8 animate-pop border border-white/20">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-inner">
                 <Icons.Trash />
              </div>
              <div className="space-y-2">
                 <h2 className="text-2xl font-black text-primary-color tracking-tighter font-display">¿Eliminar Prospecto?</h2>
                 <p className="text-sm text-gray-400 font-medium leading-relaxed px-4">Esta acción removerá permanentemente al interesado de la base de datos de control.</p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                 <button 
                  onClick={() => deleteLead()}
                  className="w-full py-5 bg-red-500 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-red-600 transition-all shadow-xl shadow-red-500/20"
                 >
                  Confirmar Eliminación
                 </button>
                 <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-full py-5 bg-slate-50 text-gray-400 rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-100 transition-all"
                 >
                  Mantener Registro
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}
      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pop { animation: pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        .admin-crm-container { font-family: 'Outfit', sans-serif; }
        
        /* Ocultar barra de desplazamiento */
        ::-webkit-scrollbar { width: 0px; background: transparent; }
      `}</style>
    </div>
  );
}
