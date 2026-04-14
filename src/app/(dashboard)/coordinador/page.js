'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

export default function CoordinatorDashboard() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    totalCollected: 0,
    portfolioBalance: 0,
    activeEnrollments: 0
  });
  const [recentStudents, setRecentStudents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [updating, setUpdating] = useState(false);

  // Filtros de fecha
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchCoordinatorStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // 1. Obtener Perfil (Solo la primera vez o si cambia)
      if (!profile) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (prof) {
          setProfile(prof);
          setWhatsapp(prof.whatsapp || '');
        }
      }

      // 2. Conteo de Estudiantes (Afectado por Rango de Fecha)
      let studentQuery = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('coordinator_id', userId)
        .eq('role_id', 3);
      
      if (startDate) studentQuery = studentQuery.gte('created_at', startDate);
      if (endDate) studentQuery = studentQuery.lte('created_at', endDate + 'T23:59:59');
      
      const { count: studentCount } = await studentQuery;

      // 3. Recaudo (Afectado por Rango de Fecha)
      // Usamos !inner para forzar que el pago pertenezca a un alumno del coordinador
      let payQuery = supabase
        .from('payments')
        .select('amount, created_at, enrollment:enrollment_id!inner(student:student_id!inner(coordinator_id))')
        .eq('enrollment.student.coordinator_id', userId);

      if (startDate) payQuery = payQuery.gte('created_at', startDate);
      if (endDate) payQuery = payQuery.lte('created_at', endDate + 'T23:59:59');

      const { data: payments } = await payQuery;
      const totalCollected = payments?.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) || 0;

      // 4. Cartera Pendiente (Histórica y Dinámica)
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          total_price, 
          status, 
          student:student_id!inner(coordinator_id),
          payments(amount)
        `)
        .eq('student.coordinator_id', userId)
        .eq('status', 'active');
      
      const portfolioBalance = enrollments?.reduce((acc, e) => {
        const total_price = parseFloat(e.total_price || 0);
        const totalPaid = e.payments?.reduce((pAcc, p) => pAcc + parseFloat(p.amount || 0), 0) || 0;
        return acc + (total_price - totalPaid);
      }, 0) || 0;

      // 5. Estudiantes Recientes
      const { data: recent } = await supabase
        .from('profiles')
        .select('id, full_name, created_at')
        .eq('coordinator_id', userId)
        .eq('role_id', 3)
        .order('created_at', { ascending: false })
        .limit(5);

      setMetrics({
        totalStudents: studentCount || 0,
        totalCollected: totalCollected,
        portfolioBalance: portfolioBalance,
        activeEnrollments: enrollments?.length || 0
      });
      setRecentStudents(recent || []);
    } catch (error) {
      console.error('Error dashboard:', error);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [startDate, endDate, profile]);

  useEffect(() => {
    fetchCoordinatorStats();

    // Sincronización Real-Time
    const channel = supabase.channel('coordinator-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchCoordinatorStats(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchCoordinatorStats(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => fetchCoordinatorStats(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCoordinatorStats]);

  const handleUpdateContact = async () => {
    setUpdating(true);
    const { error } = await supabase.from('profiles').update({ whatsapp }).eq('id', profile.id);
    if (!error) {
      showNotification('✅ Canal de soporte actualizado.', 'success');
    } else {
      showNotification('Error: ' + error.message, 'error');
    }
    setUpdating(false);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  if (loading && !profile) return (
    <div className="p-40 text-center animate-pulse">
      <div className="w-16 h-16 bg-slate-50 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl">🎛️</div>
      <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">Sincronizando Plataforma...</p>
    </div>
  );

  return (
    <div className="coordinator-dashboard max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in font-display">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Sistema Conectado / En Vivo</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
            Panel de <span className="text-secondary-color text-outline">Gestión</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Control comercial y académico personalizado.</p>
        </div>
        
        {/* FILTROS DE FECHA CLASE APPLE */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[32px] border border-gray-100 shadow-xl w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 border-r border-gray-100 last:border-0 h-full">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Desde</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-xs text-primary-color cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2 px-4 border-r border-gray-100 last:border-0 h-full">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Hasta</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-xs text-primary-color cursor-pointer"
            />
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={clearFilters}
              className="w-10 h-10 rounded-full bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >✕</button>
          )}
        </div>
      </header>

      {/* METRICS BENTO GRID EVO */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-2xl transition-all duration-700">
           <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Estudiantes</span>
              <span className="text-2xl group-hover:scale-125 transition-transform duration-500">🎓</span>
           </div>
           <div className="mt-10">
              <span className="text-6xl font-black text-primary-color tracking-tighter leading-none">{metrics.totalStudents}</span>
              <p className="text-[10px] font-bold text-gray-300 uppercase mt-4">Inscripciones {startDate || endDate ? 'en periodo' : 'totales'}</p>
           </div>
        </div>

        <div className="bg-primary-color p-10 rounded-[48px] shadow-2xl shadow-primary-color/20 flex flex-col justify-between group overflow-hidden relative">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
           <div className="flex justify-between items-start relative z-10">
              <span className="text-[10px] font-black uppercase text-white/50 tracking-[0.2em]">Recaudo Personal</span>
              <span className="text-2xl group-hover:rotate-12 transition-transform duration-500">💰</span>
           </div>
           <div className="mt-10 relative z-10">
              <span className="text-4xl font-black text-white tracking-tighter leading-none">${metrics.totalCollected.toLocaleString()}</span>
              <p className="text-[10px] font-bold text-white/30 uppercase mt-4">Valor {startDate || endDate ? 'en periodo' : 'histórico'}</p>
           </div>
        </div>

        <div className="bg-amber-500 p-10 rounded-[48px] shadow-2xl shadow-amber-500/20 flex flex-col justify-between group overflow-hidden relative">
           <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-12 -mb-12"></div>
           <div className="flex justify-between items-start relative z-10">
              <span className="text-[10px] font-black uppercase text-white/50 tracking-[0.2em]">Cartera Pendiente</span>
              <span className="text-2xl group-hover:-rotate-12 transition-transform duration-500">🚨</span>
           </div>
           <div className="mt-10 relative z-10">
              <span className="text-4xl font-black text-white tracking-tighter leading-none">${metrics.portfolioBalance.toLocaleString()}</span>
              <p className="text-[10px] font-bold text-white/30 uppercase mt-4">Saldo total por cobrar</p>
           </div>
        </div>

        <div className="bg-white p-10 rounded-[48px] border border-secondary-color/20 shadow-sm flex flex-col justify-between group hover:border-secondary-color transition-all duration-700">
           <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase text-secondary-color tracking-[0.2em]">Programas Activos</span>
              <span className="text-2xl group-hover:scale-125 transition-transform duration-500">📚</span>
           </div>
           <div className="mt-10">
              <span className="text-6xl font-black text-secondary-color tracking-tighter leading-none">{metrics.activeEnrollments}</span>
              <p className="text-[10px] font-bold text-gray-300 uppercase mt-4">Matrículas en curso</p>
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* SOPORTE Y CONTACTO */}
        <section className="lg:col-span-5 bg-emerald-500 p-12 rounded-[64px] shadow-2xl shadow-emerald-500/10 flex flex-col justify-between gap-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-40 -mt-40"></div>
          <div className="space-y-6 relative z-10">
             <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center text-4xl shadow-xl shadow-emerald-600/20 group-hover:scale-110 transition-transform duration-700">📱</div>
             <div className="space-y-2">
                <h2 className="text-3xl font-black text-white tracking-tight">Canal de Soporte</h2>
                <p className="text-emerald-100 font-medium">Este número se mostrará a tus alumnos para que te contacten directamente.</p>
             </div>
          </div>

          <div className="space-y-4 relative z-10">
            <input 
              type="text" 
              value={whatsapp} 
              onChange={(e) => setWhatsapp(e.target.value)} 
              className="w-full bg-white/10 border border-white/20 p-6 rounded-[32px] outline-none font-black text-white placeholder:text-white/30 text-lg focus:bg-white/20 transition-all backdrop-blur-md"
              placeholder="WhatsApp (Cód + Número)"
            />
            <button 
              onClick={handleUpdateContact} 
              disabled={updating}
              className="w-full py-6 bg-white text-emerald-600 rounded-[32px] font-black text-[11px] uppercase tracking-widest hover:bg-primary-color hover:text-white transition-all shadow-xl"
            >
              {updating ? 'Procesando...' : 'Actualizar mi Identidad Digital'}
            </button>
          </div>
        </section>

        {/* ACTIVIDAD RECIENTE */}
        <section className="lg:col-span-7 bg-white p-12 rounded-[64px] border border-gray-100 shadow-sm space-y-10">
           <header className="flex justify-between items-end border-b border-gray-50 pb-8">
              <div className="space-y-1">
                 <h2 className="text-3xl font-black text-primary-color tracking-tight font-display">Recién Registrados</h2>
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Alumnos bajo tu tutoría</p>
              </div>
              <Link href="/coordinador/students" className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl hover:bg-primary-color hover:text-white transition-all">👤</Link>
           </header>

           <div className="space-y-6">
              {recentStudents.length === 0 ? (
                <div className="p-20 text-center bg-slate-50 rounded-[48px] text-gray-300 font-bold italic">Aún no hay inscripciones registradas.</div>
              ) : (
                recentStudents.map((s) => (
                  <div key={s.id} className="flex items-center gap-6 p-6 bg-white hover:bg-slate-50/50 rounded-[40px] border border-transparent hover:border-gray-50 transition-all group">
                    <div className="w-16 h-16 rounded-[24px] bg-primary-color text-white flex items-center justify-center font-black text-lg shadow-lg shadow-primary-color/10 group-hover:scale-105 transition-transform duration-500">
                      {s.full_name?.substring(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-md font-black text-primary-color truncate uppercase leading-tight">{s.full_name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                        <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">INSCRITO: {new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Link href="/coordinador/students" className="px-8 py-3 bg-slate-50 text-gray-400 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-color hover:text-white transition-all shadow-sm">Gestión</Link>
                  </div>
                ))
              )}
           </div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .text-outline { -webkit-text-stroke: 1px var(--secondary-color); color: transparent; }
      `}</style>
    </div>
  );
}
