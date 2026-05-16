'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';

export default function AdminReportesPage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    totalIngresos: 0,
    pagosEsteMes: 0,
    pagosCount: 0,
    estudiantesActivos: 0,
  });
  const [pagosRecientes, setPagosRecientes] = useState([]);

  useEffect(() => {
    fetchReportes();

    // Suscripción en tiempo real a pagos
    const channel = supabase
      .channel('reportes-pagos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchReportes)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchReportes() {
    try {
      setLoading(true);

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      // Traer pagos del mes actual y estudiantes activos en paralelo
      const [pagosRes, estudiantesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount, created_at, status')
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role_id', 3),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (estudiantesRes.error) throw estudiantesRes.error;

      const pagos = pagosRes.data || [];
      const totalIngresos = pagos.reduce((sum, p) => sum + (p.amount || 0), 0);
      const pagosEsteMes = pagos
        .filter(p => new Date(p.created_at) >= inicioMes)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      setMetricas({
        totalIngresos,
        pagosEsteMes,
        pagosCount: pagos.length,
        estudiantesActivos: estudiantesRes.count || 0,
      });
      setPagosRecientes(pagos.slice(0, 10));
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-color border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: 'Ingresos Totales', valor: formatCurrency(metricas.totalIngresos), icono: '💰' },
    { label: 'Ingresos Este Mes', valor: formatCurrency(metricas.pagosEsteMes), icono: '📅' },
    { label: 'Pagos Registrados', valor: metricas.pagosCount, icono: '🧾' },
    { label: 'Estudiantes Activos', valor: metricas.estudiantesActivos, icono: '🎓' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-10 space-y-8 animate-fade-in">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">Reportes Financieros</h1>
        <p className="text-gray-500 mt-1">Métricas de ingresos y pagos de la academia</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            <div className="text-3xl mb-2">{kpi.icono}</div>
            <div className="text-2xl font-black text-gray-900">{kpi.valor}</div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Pagos recientes */}
      <div className="bg-white rounded-[32px] p-6 md:p-10 shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-gray-900 mb-6">Pagos Recientes</h2>
        {pagosRecientes.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No hay pagos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-xs font-black uppercase tracking-widest text-gray-400">ID</th>
                  <th className="text-left py-3 px-2 text-xs font-black uppercase tracking-widest text-gray-400">Monto</th>
                  <th className="text-left py-3 px-2 text-xs font-black uppercase tracking-widest text-gray-400">Fecha</th>
                  <th className="text-left py-3 px-2 text-xs font-black uppercase tracking-widest text-gray-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagosRecientes.map((pago) => (
                  <tr key={pago.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2 text-gray-500 font-mono text-xs">{pago.id.slice(0, 8)}…</td>
                    <td className="py-3 px-2 font-bold text-gray-900">{formatCurrency(pago.amount)}</td>
                    <td className="py-3 px-2 text-gray-500">{new Date(pago.created_at).toLocaleDateString('es-VE')}</td>
                    <td className="py-3 px-2">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                        {pago.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
