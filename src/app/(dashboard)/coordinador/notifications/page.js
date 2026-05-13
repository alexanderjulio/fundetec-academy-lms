'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';

const Icons = {
  Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Info: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
  Alert: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Danger: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>,
  Chevron: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
};

export default function CoordinatorNotificationsPage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [currentCordinador, setCurrentCordinador] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info'
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentCordinador(session.user.id);
        fetchNotifications(session.user.id);
      }
    }
    init();
  }, []);

  const fetchNotifications = async (userId) => {
    const { data } = await supabase
      .from('global_notifications')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('global_notifications')
        .insert({
          title: formData.title,
          message: formData.message,
          type: formData.type,
          sender_id: currentCordinador,
          target_type: 'coordinator_group',
          coordinator_id: currentCordinador
        });

      if (error) throw error;

      showNotification('✅ Comunicado enviado a tus estudiantes.', 'success');
      setFormData({ title: '', message: '', type: 'info' });
      fetchNotifications(currentCordinador);
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (type) => {
    const configs = {
      'info': { bg: 'bg-indigo-50', text: 'text-indigo-500', icon: <Icons.Info />, label: 'Informativo' },
      'warning': { bg: 'bg-amber-50', text: 'text-amber-600', icon: <Icons.Alert />, label: 'Recordatorio' },
      'danger': { bg: 'bg-red-50', text: 'text-red-500', icon: <Icons.Danger />, label: 'Urgente' }
    };
    const c = configs[type] || configs.info;
    return (
      <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${c.bg} ${c.text} ring-2 ring-current ring-opacity-10 shadow-sm`}>
        {c.icon} {c.label}
      </span>
    );
  };

  return (
    <div className="notifications-container max-w-[1400px] mx-auto p-4 md:p-10 space-y-10 animate-fade-in font-display">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
            Comando de <span className="text-secondary-color">Difusión</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Emite anuncios oficiales y mantén informada a tu mentoría.</p>
        </div>
        <div className="flex items-center gap-4 relative z-10 bg-slate-50 p-4 px-8 rounded-full border border-gray-100">
           <div className="flex -space-x-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-white border-2 border-slate-50 flex items-center justify-center text-[10px] font-black text-primary-color">U</div>
              ))}
           </div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Canal Directo a Alumnos</p>
        </div>
        {/* Decorativo */}
        <div className="absolute right-0 bottom-0 w-40 h-1 bg-secondary-color opacity-20"></div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CONSOLA DE REDACCIÓN VIP */}
        <section className="lg:col-span-5 bg-white p-6 md:p-10 rounded-[40px] md:rounded-[64px] border border-gray-100 shadow-xl space-y-8 md:space-y-10 relative overflow-hidden">
           <div className="space-y-2">
              <h2 className="text-2xl font-black text-primary-color tracking-tighter">Enviar Comunicado</h2>
              <div className="h-1 w-12 bg-secondary-color rounded-full"></div>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
              <div className="space-y-2 md:space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Asunto del Mensaje</label>
                 <input 
                    type="text" 
                    required 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej: Recordatorio de Examen Final"
                    className="w-full bg-slate-50 border-none p-4 md:p-5 rounded-[20px] md:rounded-[28px] outline-none font-bold text-sm md:text-base text-primary-color focus:ring-4 focus:ring-secondary-color/10 transition-all placeholder:text-gray-300"
                 />
              </div>

              <div className="space-y-2 md:space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Cuerpo del Comunicado</label>
                 <textarea 
                    required 
                    rows="6"
                    value={formData.message} 
                    onChange={e => setFormData({...formData, message: e.target.value})}
                    placeholder="Escribe aquí las instrucciones detalladas para tu grupo..."
                    className="w-full bg-slate-50 border-none p-5 md:p-7 rounded-[24px] md:rounded-[38px] outline-none font-medium text-sm md:text-base text-primary-color focus:ring-4 focus:ring-secondary-color/10 transition-all placeholder:text-gray-300 leading-relaxed resize-none"
                 ></textarea>
              </div>

              <div className="space-y-3 md:space-y-4">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Prioridad del Envío</label>
                 <div className="grid grid-cols-3 gap-2 md:gap-3">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'info'})}
                      className={`p-3 md:p-4 rounded-[20px] md:rounded-[24px] flex flex-col items-center gap-2 transition-all ${formData.type === 'info' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-50 text-gray-400 hover:bg-slate-100'}`}
                    >
                       <Icons.Info />
                       <span className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter">Informar</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'warning'})}
                      className={`p-3 md:p-4 rounded-[20px] md:rounded-[24px] flex flex-col items-center gap-2 transition-all ${formData.type === 'warning' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-50 text-gray-400 hover:bg-slate-100'}`}
                    >
                       <Icons.Alert />
                       <span className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter">Alerta</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'danger'})}
                      className={`p-3 md:p-4 rounded-[20px] md:rounded-[24px] flex flex-col items-center gap-2 transition-all ${formData.type === 'danger' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-50 text-gray-400 hover:bg-slate-100'}`}
                    >
                       <Icons.Danger />
                       <span className="text-[8px] md:text-[9px] font-black uppercase tracking-tighter">Urgente</span>
                    </button>
                 </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 md:py-7 bg-primary-color text-white rounded-[24px] md:rounded-[32px] font-black text-[10px] md:text-[11px] uppercase tracking-widest shadow-2xl shadow-primary-color/20 hover:bg-secondary-color hover:text-primary-color transition-all flex items-center justify-center gap-3"
              >
                 {loading ? 'Transmitiendo...' : (
                    <>
                       <Icons.Send /> Emitir Comunicado
                    </>
                 )}
              </button>
           </form>
           {/* Decorativo */}
           <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-slate-50 rounded-full opacity-50 blur-3xl"></div>
        </section>

        {/* INBOX DE COMUNICADOS ENVIADOS */}
        <div className="lg:col-span-7 space-y-6">
           <div className="bg-white rounded-[40px] md:rounded-[64px] border border-gray-100 shadow-sm overflow-hidden min-h-[400px] md:min-h-[600px] flex flex-col">
              <header className="p-6 md:p-10 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-2 sm:gap-0">
                 <h2 className="text-xl font-black text-primary-color tracking-tighter">Historial de Envío</h2>
                 <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em]">Registro Cronológico</span>
              </header>

              <div className="flex-1 p-6 md:p-8 space-y-4 md:space-y-6 overflow-y-auto">
                 {notifications.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 md:p-20 space-y-4">
                       <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-3xl opacity-40">📬</div>
                       <p className="text-gray-300 font-black uppercase tracking-widest text-[10px]">Sin anuncios registrados todavía.</p>
                    </div>
                 ) : (
                    notifications.map(n => (
                       <article key={n.id} className="group bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 hover:border-secondary-color transition-all duration-500 hover:shadow-xl hover:shadow-primary-color/5 animate-pop relative overflow-hidden">
                          <header className="flex flex-col sm:flex-row justify-between items-start mb-4 md:mb-6 gap-4 sm:gap-0">
                             <div className="space-y-2 md:space-y-3">
                                {getPriorityBadge(n.type)}
                                <h3 className="text-base md:text-lg font-black text-primary-color group-hover:text-secondary-color transition-colors leading-tight">{n.title}</h3>
                             </div>
                             <time className="text-[8px] md:text-[9px] font-black text-gray-300 uppercase tracking-widest bg-slate-50 p-2 md:p-3 rounded-xl md:rounded-2xl shrink-0">{new Date(n.created_at).toLocaleString()}</time>
                          </header>
                          <p className="text-sm font-medium text-gray-400 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-700">
                             {n.message}
                          </p>
                          {/* Decorativo hover */}
                          <div className="absolute right-0 top-0 w-1 h-full bg-secondary-color opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       </article>
                    ))
                 )}
              </div>
           </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pop { animation: pop 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .notifications-container { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
