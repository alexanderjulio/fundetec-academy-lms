'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function StudentNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);

  useEffect(() => {
    const savedDeletions = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('deleted_notifs') || '[]') : [];
    setDeletedIds(savedDeletions);
    fetchEverything();
  }, []);

  const fetchEverything = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      // Filtrar por rol: coordinadores ven su grupo + individuales; estudiantes solo individuales
      let notifsQuery = supabase
        .from('global_notifications')
        .select('*, sender:sender_id(full_name)')
        .order('created_at', { ascending: false });

      if (profile.role_id === 2) {
        // Coordinador: notificaciones de su grupo + individuales para él
        notifsQuery = notifsQuery.or(
          `and(target_type.eq.coordinator_group,coordinator_id.eq.${profile.coordinator_id}),and(target_type.eq.individual,coordinator_id.eq.${user.id})`
        );
      } else {
        // Estudiante: solo individuales dirigidas a él
        notifsQuery = notifsQuery.eq('target_type', 'individual').eq('coordinator_id', user.id);
      }

      const { data: notifs } = await notifsQuery;

      // Fetch which ones are read
      const { data: reads } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      setNotifications(notifs || []);
      setReadIds(reads?.map(r => r.notification_id) || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const unreadNotifs = notifications.filter(n => !readIds.includes(n.id));
    if (unreadNotifs.length === 0) return;

    const inserts = unreadNotifs.map(n => ({
      notification_id: n.id,
      user_id: user.id
    }));

    await supabase.from('notification_reads').upsert(inserts);
    setReadIds([...readIds, ...unreadNotifs.map(n => n.id)]);
  };

  const markSingleAsRead = async (id) => {
    if (readIds.includes(id)) return;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('notification_reads').upsert({
      notification_id: id,
      user_id: user.id
    });
    setReadIds([...readIds, id]);
  };

  const deleteNotification = (id, e) => {
    e.stopPropagation();
    const newDeleted = [...deletedIds, id];
    setDeletedIds(newDeleted);
    localStorage.setItem('deleted_notifs', JSON.stringify(newDeleted));
  };

  const groupNotifications = () => {
    const groups = {
      hoy: { label: 'Hoy', items: [] },
      ayer: { label: 'Ayer', items: [] },
      estaSemana: { label: 'Esta Semana', items: [] },
      anteriores: { label: 'Anteriores', items: [] }
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    notifications
      .filter(n => !deletedIds.includes(n.id))
      .forEach(n => {
        const date = new Date(n.created_at);
        if (date >= today) groups.hoy.items.push(n);
        else if (date >= yesterday) groups.ayer.items.push(n);
        else if (date >= lastWeek) groups.estaSemana.items.push(n);
        else groups.anteriores.items.push(n);
      });

    return Object.values(groups).filter(g => g.items.length > 0);
  };

  const groupedNotifs = groupNotifications();
  const unreadCount = notifications.filter(n => !readIds.includes(n.id) && !deletedIds.includes(n.id)).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-pulse space-y-4">
        <div className="w-12 h-12 border-4 border-primary-color border-t-transparent rounded-full animate-spin"></div>
        <p className="text-primary-color font-bold tracking-widest text-xs uppercase">Sincronizando bandeja...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-12 md:py-20 space-y-16 animate-fade-in font-body">
      <header className="page-header relative pb-10 border-b border-gray-100 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-primary-color/5 blur-[80px] rounded-full"></div>
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-3">
             <span className="text-xs font-black uppercase tracking-[0.4em] text-secondary-color">Bandeja de Entrada</span>
             {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-primary-color tracking-tighter leading-tight font-display">
            Notificaciones
          </h1>
          <p className="text-lg text-gray-400 max-w-xl font-medium">
            Anuncios oficiales, recordatorios académicos y novedades importantes.
          </p>
        </div>
        <button 
          onClick={markAllAsRead}
          className="relative z-10 px-6 py-3 bg-gray-50 text-primary-color rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-primary-color hover:text-white transition-all shadow-sm flex items-center gap-2"
        >
          Limpiar Leídas
        </button>
      </header>

      {groupedNotifs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-gray-50/50 rounded-[48px] border border-dashed border-gray-200 space-y-8">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm">📭</div>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-primary-color">Bandeja Vacía</h3>
            <p className="text-gray-400 font-medium">No tienes notificaciones pendientes por ahora.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {groupedNotifs.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-6 animate-fade-in" style={{ animationDelay: `${groupIdx * 100}ms` }}>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">{group.label}</span>
                <div className="h-px bg-gray-100 flex-1"></div>
              </div>
              
              <div className="space-y-4">
                {group.items.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => markSingleAsRead(n.id)}
                    className={`group relative flex gap-6 p-8 rounded-[32px] border transition-all duration-300 cursor-pointer ${
                      readIds.includes(n.id) 
                        ? 'bg-white border-transparent opacity-80' 
                        : 'bg-white border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1'
                    }`}
                  >
                    {/* Indicador lateral de tipo */}
                    <div className={`absolute left-0 top-8 bottom-8 w-1.5 rounded-full ${
                      n.type === 'danger' ? 'bg-red-500' : 
                      n.type === 'warning' ? 'bg-yellow-500' : 
                      n.type === 'success' ? 'bg-green-500' : 'bg-primary-color'
                    }`}></div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary-color/60">{n.sender?.full_name || 'Academia Fundetec'}</span>
                          <span className="text-[10px] font-bold text-gray-300">•</span>
                          <span className="text-[10px] font-bold text-gray-400">{new Date(n.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {!readIds.includes(n.id) && <div className="w-2 h-2 bg-secondary-color rounded-full animate-pulse"></div>}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-xl font-bold text-primary-color font-display group-hover:text-secondary-color transition-colors">{n.title}</h3>
                        <p className="text-sm font-medium text-gray-400 leading-relaxed text-balance">{n.message}</p>
                      </div>
                    </div>

                    <button 
                      onClick={(e) => deleteNotification(n.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all self-center"
                      title="Eliminar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .animate-fade-in { animation: fade-in 1s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
