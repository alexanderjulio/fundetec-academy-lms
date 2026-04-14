'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { exportToPDF, exportToExcel, exportToCSV } from '@/utils/export_finance';

export default function AdminDashboardHome() {
  const [stats, setStats] = useState({
    students: 0,
    leads: 0,
    courses: 0,
    revenue: 0,
    pendingRevenue: 0,
    actualRevenue: 0,
    studentRevenue: 0,
    portfolioBalance: 0,
    monthlyGraphData: []
  });
  const [activity, setActivity] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [selectedCoordinator, setSelectedCoordinator] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorVisible, setErrorVisible] = useState(null);

  useEffect(() => {
    fetchCoordinators();
    fetchDashboardData();

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchDashboardData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinator_invoices' }, () => fetchDashboardData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchDashboardData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => fetchDashboardData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchDashboardData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCoordinator]);

  const fetchCoordinators = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role_id', 2);
    setCoordinators(data || []);
  };

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Conteo de Estudiantes (Filtrado si aplica)
      let studentsQuery = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', 3);
      if (selectedCoordinator !== 'all') {
        if (selectedCoordinator === 'admin') studentsQuery = studentsQuery.is('coordinator_id', null);
        else studentsQuery = studentsQuery.eq('coordinator_id', selectedCoordinator);
      }
      const { count: studentsCount } = await studentsQuery;

      // 2. Leads (Globales)
      const { count: leadsCount } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
      
      // 3. Cursos (Globales)
      const { count: coursesCount } = await supabase.from('courses').select('id', { count: 'exact', head: true });

      // 4. Finanzas (Filtrado)
      let invQuery = supabase.from('coordinator_invoices').select('total_amount, status, created_at, coordinator:coordinator_id(full_name)');
      if (selectedCoordinator !== 'all') {
        if (selectedCoordinator === 'admin') invQuery = invQuery.is('coordinator_id', null);
        else invQuery = invQuery.eq('coordinator_id', selectedCoordinator);
      }
      const { data: invoicesData, error: invErr } = await invQuery;
      if (invErr) throw invErr;

      // 5. Actividad Reciente (Filtrada)
      let recentStQuery = supabase.from('profiles').select('full_name, created_at').eq('role_id', 3).order('created_at', { ascending: false }).limit(3);
      if (selectedCoordinator !== 'all') {
        if (selectedCoordinator === 'admin') recentStQuery = recentStQuery.is('coordinator_id', null);
        else recentStQuery = recentStQuery.eq('coordinator_id', selectedCoordinator);
      }
      const { data: recentSt } = await recentStQuery;

      const { data: recentLd } = await supabase.from('leads').select('full_name, created_at').order('created_at', { ascending: false }).limit(3);
      
      // 6. Ingresos Individuales (Abonos) - Obtenidos a través de la matrícula para filtrar por coordinador
      let payQuery = supabase.from('payments').select('amount, enrollment:enrollment_id(student:student_id(coordinator_id))');
      if (selectedCoordinator !== 'all') {
        if (selectedCoordinator === 'admin') payQuery = payQuery.is('enrollment.student.coordinator_id', null);
        else payQuery = payQuery.eq('enrollment.student.coordinator_id', selectedCoordinator);
      }
      const { data: paymentsData } = await payQuery;

      // 7. Cartera Pendiente (Saldos en Matrículas)
      let enrQuery = supabase.from('enrollments').select('remaining_balance, student:student_id(coordinator_id)');
      if (selectedCoordinator !== 'all') {
        if (selectedCoordinator === 'admin') enrQuery = enrQuery.is('student.coordinator_id', null);
        else enrQuery = enrQuery.eq('student.coordinator_id', selectedCoordinator);
      }
      const { data: enrollData } = await enrQuery;

      const totalPaid = (invoicesData || []).filter(i => i.status === 'paid').reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
      const totalPending = (invoicesData || []).filter(i => i.status === 'pending').reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
      
      const totalStudentPayments = (paymentsData || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const totalOutstanding = (enrollData || []).reduce((acc, curr) => acc + (Number(curr.remaining_balance) || 0), 0);

      setStats({
        students: studentsCount || 0,
        leads: leadsCount || 0,
        courses: coursesCount || 0,
        revenue: totalPaid + totalPending,
        actualRevenue: totalPaid,
        pendingRevenue: totalPending,
        studentRevenue: totalStudentPayments,
        portfolioBalance: totalOutstanding,
        monthlyGraphData: await calculateMonthlyTrends(selectedCoordinator)
      });

      const combinedActivity = [
        ...(recentSt || []).map(item => ({ ...item, type: 'student', action: 'Inscripción Estudiante' })),
        ...(recentLd || []).map(item => ({ ...item, type: 'lead', action: 'Nuevo Prospecto' })),
        ...(invoicesData || []).slice(0, 3).map(item => ({ 
          ...item, 
          type: 'payment', 
          action: item.status === 'paid' ? `Cobro Confirmado ($${Number(item.total_amount).toLocaleString()})` : `Cobro Generado ($${Number(item.total_amount).toLocaleString()})`, 
          full_name: item.coordinator?.full_name || 'Administración'
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

      setActivity(combinedActivity);
      setErrorVisible(null);
    } catch (error) {
      console.error('Error Dashboard:', error);
      setErrorVisible(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type) => {
    const exportData = activity.filter(a => a.type === 'payment').map(inv => ({
      date: new Date(inv.created_at).toLocaleDateString(),
      entity: inv.full_name,
      description: inv.action,
      amount: inv.total_amount,
      status: inv.status
    }));

    if (exportData.length === 0) {
      // Si no hay actividad reciente, exportamos el resumen de facturas general
      // Tendríamos que traer más datos si queremos un reporte completo, 
      // pero por ahora usamos los datos cargados.
    }

    const filename = `Reporte_Finanzas_${selectedCoordinator === 'all' ? 'Global' : 'Filtrado'}`;
    if (type === 'pdf') exportToPDF(exportData, { title: 'REPORTE FINANCIERO FUNDETEC', filename: `${filename}.pdf` });
    if (type === 'excel') exportToExcel(exportData, { filename: `${filename}.xlsx` });
    if (type === 'csv') exportToCSV(exportData, { filename: `${filename}.csv` });
  };

  /**
   * Calcula el conteo de estudiantes por mes para los últimos 6 meses.
   */
  const calculateMonthlyTrends = async (coordinatorId) => {
    const months = [];
    const now = new Date();
    
    // Generar últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleString('es-ES', { month: 'short' }).replace('.', ''),
        start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
        count: 0
      });
    }

    // Consultar Supabase para cada mes
    for (let month of months) {
      let q = supabase.from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role_id', 3)
        .gte('created_at', month.start)
        .lte('created_at', month.end);
      
      if (coordinatorId !== 'all') {
        if (coordinatorId === 'admin') q = q.is('coordinator_id', null);
        else q = q.eq('coordinator_id', coordinatorId);
      }

      const { count } = await q;
      month.count = count || 0;
    }

    return months;
  };

  /**
   * Genera el path del SVG dinámicamente basado en los datos reales.
   */
  const generateDynamicPath = (data) => {
    if (!data || data.length === 0) return "M0,40 L100,40";
    
    const maxVal = Math.max(...data.map(m => m.count), 5); // Base mínima de 5 para escala
    const points = data.map((m, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 35 - (m.count / maxVal) * 30; // 35 es el piso, 5 es el tope (SVG viewbox 100x40)
      return { x, y };
    });

    // Crear curva suavizada básica
    let path = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const cp1x = (points[i].x + points[i+1].x) / 2;
        path += ` Q${cp1x},${points[i].y} ${points[i+1].x},${points[i+1].y}`;
    }
    return path;
  };

  const kpis = [
    { label: 'Estudiantes', value: stats.students || 0, icon: '🎓', color: 'bg-primary-color', trend: 'Filtro Activo', link: '/admin/users' },
    { label: 'Prospectos', value: stats.leads || 0, icon: '💬', color: 'bg-secondary-color', trend: 'Nuevos', link: '/admin/leads' },
    { label: 'Cursos', value: stats.courses || 0, icon: '📚', color: 'bg-amber-500', trend: 'Activos', link: '/admin/courses' },
    { 
      label: 'Recaudo Estudiantes', 
      value: `$${(stats.studentRevenue || 0).toLocaleString()}`, 
      icon: '💵', 
      color: 'bg-indigo-500', 
      trend: `Cartera: $${(stats.portfolioBalance || 0).toLocaleString()}`, 
      link: '/admin/ledger' 
    },
  ];

  return (
    <div className="admin-dashboard max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in">
      {errorVisible && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center justify-between">
          <span><strong>Error de Datos:</strong> {errorVisible}</span>
          <button onClick={() => fetchDashboardData()} className="text-xs bg-red-100 px-3 py-1 rounded-full hover:bg-red-200">Reintentar</button>
        </div>
      )}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none font-display">
            Panel <span className="text-secondary-color">Administrativo</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Gestión centralizada de Fundetec Academy.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <select 
            value={selectedCoordinator}
            onChange={(e) => setSelectedCoordinator(e.target.value)}
            className="bg-white border-2 border-gray-100 p-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest text-primary-color outline-none focus:ring-4 focus:ring-secondary-color/10 cursor-pointer shadow-sm"
          >
            <option value="all">🌐 Vista Global</option>
            <option value="admin">🏢 Administración</option>
            {coordinators.map(c => (
              <option key={c.id} value={c.id}>👤 {c.full_name}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <button onClick={() => handleExport('pdf')} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm font-black text-[9px] uppercase tracking-widest">PDF</button>
            <button onClick={() => handleExport('excel')} className="p-3 bg-emerald-50 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm font-black text-[9px] uppercase tracking-widest">Excel</button>
          </div>

          <Link href="/admin/landing" className="px-8 py-3.5 bg-primary-color text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color transition-all shadow-xl shadow-primary-color/10">
            Web CMS
          </Link>
        </div>
      </header>

      {/* KPI GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <Link href={kpi.link} key={i} className="group bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
            <div className="flex items-center justify-between mb-6">
              <div className={`w-12 h-12 ${kpi.color} text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-black/5`}>
                {kpi.icon}
              </div>
              <span className="text-[10px] font-black text-secondary-color bg-secondary-color/10 px-3 py-1.5 rounded-full">{kpi.trend}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</span>
              <h3 className="text-3xl font-black text-primary-color tracking-tighter font-display">
                {loading ? '...' : kpi.value}
              </h3>
            </div>
          </Link>
        ))}
      </section>

      {/* CHARTS & ACTIVITY */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm flex flex-col justify-between overflow-hidden relative">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-primary-color tracking-tight font-display">Tendencia Mensual</h3>
            <span className="text-xs font-black text-secondary-color uppercase tracking-widest">Operación {selectedCoordinator === 'all' ? 'Global' : 'Filtrada'}</span>
          </div>
          
          <div className="h-64 relative flex items-end justify-between px-4">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--secondary-color)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--secondary-color)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path 
                d={`${generateDynamicPath(stats.monthlyGraphData)} L100,40 L0,40 Z`} 
                fill="url(#chartGradient)" 
              />
              <path 
                d={generateDynamicPath(stats.monthlyGraphData)} 
                fill="none" 
                stroke="var(--secondary-color)" 
                strokeWidth="2" 
                strokeLinecap="round" 
                className="animate-draw" 
              />
            </svg>
            {(stats.monthlyGraphData.length > 0 ? stats.monthlyGraphData : [{name:'Ene'},{name:'Feb'},{name:'Mar'},{name:'Abr'},{name:'May'},{name:'Jun'}]).map((m, i) => (
              <span key={i} className="relative z-10 text-[9px] font-black text-gray-400/60 uppercase tracking-widest">{m.name}</span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
          <h3 className="text-2xl font-black text-primary-color tracking-tight font-display mb-8">Historial de Actividad</h3>
          <div className="space-y-6">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-3xl animate-pulse"></div>)
            ) : activity.length > 0 ? (
              activity.map((ev, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
                    ev.type === 'student' ? 'bg-blue-50 text-blue-500' : 
                    ev.type === 'payment' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                  }`}>
                    {ev.type === 'student' ? '👤' : ev.type === 'payment' ? '💵' : '📩'}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{ev.action}</p>
                    <h4 className="text-sm font-bold text-primary-color truncate">{ev.full_name || 'Alguien'}</h4>
                  </div>
                  <span className="text-[10px] font-black text-gray-300 uppercase shrink-0">
                    {new Date(ev.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 font-medium italic text-center py-10">Sin actividad reciente para este filtro.</p>
            )}
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS BENTO */}
      <section className="space-y-8">
        <h2 className="text-3xl font-black text-primary-color tracking-tight font-display">Campus Management</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Usuarios', icon: '👥', desc: 'Roles y mentores', link: '/admin/users' },
            { label: 'Libro Mayor', icon: '📖', desc: 'Cartera y Abonos', link: '/admin/ledger' },
            { label: 'Cobros', icon: '💳', desc: 'Cierres mentores', link: '/admin/billing' },
            { label: 'Prospectos', icon: '📩', desc: 'Nuevos leads', link: '/admin/leads' },
          ].map((item, i) => (
            <Link href={item.link} key={i} className="group p-8 bg-white rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col items-center text-center space-y-4">
              <span className="text-4xl group-hover:scale-110 transition-transform duration-500">{item.icon}</span>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-primary-color">{item.label}</h4>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes draw { from { stroke-dasharray: 100; stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
        .animate-draw { animation: draw 3s ease-out forwards; }

        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
