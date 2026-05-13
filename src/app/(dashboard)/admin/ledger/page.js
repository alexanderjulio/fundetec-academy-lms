'use client';

import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { exportToPDF, exportToExcel, exportToCSV } from '@/utils/export_finance';

const Icons = {
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Filter: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  ArrowDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  Wallet: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>
};

export default function StudentLedgerPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    coordinator: 'all',
    status: 'all'
  });
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchCoordinators();
    fetchLedgerData();

    // Sincronización en tiempo real
    const channel = supabase
      .channel('ledger-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchLedgerData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => fetchLedgerData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCoordinators = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role_id', 2);
    setCoordinators(data || []);
  };

  const fetchLedgerData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        student:profiles!enrollments_student_id_fkey(full_name, coordinator:coordinator_id(full_name)),
        courses(title),
        payments(id, amount, payment_date, payment_method, notes)
      `)
      .order('enrolled_at', { ascending: false });

    if (!error) {
      // Calculate total paid and real balance per enrollment
      const enriched = data.map(enr => {
        const total_price = Number(enr.total_price) || 0;
        const totalPaid = enr.payments?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
        const calculatedBalance = total_price - totalPaid;
        
        return { 
          ...enr, 
          total_price,
          totalPaid, 
          calculatedBalance 
        };
      });
      setEnrollments(enriched);
    }
    setLoading(false);
  };

  const handleExport = (type) => {
    const exportData = filteredLedger.map(enr => ({
      date: new Date(enr.enrolled_at).toLocaleDateString(),
      student: enr.student?.full_name,
      course: enr.courses?.title,
      coordinator: enr.student?.coordinator?.full_name || 'Administración',
      total_cost: enr.total_price,
      paid: enr.totalPaid,
      balance: enr.calculatedBalance
    }));

    const filename = `Libro_Mayor_Estudiantes_${new Date().getTime()}`;
    const options = { title: 'LIBRO MAYOR DE ESTUDIANTES - FUNDETEC', filename };
    
    if (type === 'pdf') exportToPDF(exportData, options);
    if (type === 'excel') exportToExcel(exportData, options);
    if (type === 'csv') exportToCSV(exportData, options);
  };

  const filteredLedger = enrollments.filter(enr => {
    const matchesSearch = enr.student?.full_name?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCoordinator = filters.coordinator === 'all' 
      ? true 
      : (filters.coordinator === 'admin' ? !enr.student?.coordinator : enr.student?.coordinator?.id === filters.coordinator);
    const matchesStatus = filters.status === 'all'
      ? true
      : (filters.status === 'paid' ? enr.calculatedBalance <= 0 : enr.calculatedBalance > 0);
    
    return matchesSearch && matchesCoordinator && matchesStatus;
  });

  const totals = {
    cost: filteredLedger.reduce((acc, curr) => acc + curr.total_price, 0),
    paid: filteredLedger.reduce((acc, curr) => acc + curr.totalPaid, 0),
    balance: filteredLedger.reduce((acc, curr) => acc + curr.calculatedBalance, 0)
  };

  const collectionPct = totals.cost > 0 ? Math.min(100, Math.round((totals.paid / totals.cost) * 100)) : 0;

  return (
    <div className="ledger-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-6 animate-fade-in font-display">
      <header className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-1">
            <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
              Libro Mayor <span className="text-secondary-color">Estudiantes</span>
            </h1>
            <p className="text-gray-400 font-medium italic">Estado de cartera, abonos y auditoría individual.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{filteredLedger.length} registros</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-t border-gray-100">
          <div className="p-8 md:p-10 flex flex-col gap-2 border-b sm:border-b-0 sm:border-r border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Contratado</span>
            <span className="text-3xl font-black text-primary-color">${(totals.cost || 0).toLocaleString('es-CO')}</span>
            <span className="text-[10px] text-gray-300 font-medium">{filteredLedger.length} matrículas</span>
          </div>
          <div className="p-8 md:p-10 flex flex-col gap-2 border-b sm:border-b-0 sm:border-r border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Total Recaudado</span>
            <span className="text-3xl font-black text-emerald-600">${(totals.paid || 0).toLocaleString('es-CO')}</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{width: `${collectionPct}%`}}></div>
              </div>
              <span className="text-[10px] font-black text-emerald-500">{collectionPct}%</span>
            </div>
          </div>
          <div className="p-8 md:p-10 flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Cartera Pendiente</span>
            <span className="text-3xl font-black text-amber-600">${(totals.balance || 0).toLocaleString('es-CO')}</span>
            <span className="text-[10px] text-gray-300 font-medium">
              {filteredLedger.filter(e => e.calculatedBalance > 0).length} con saldo
            </span>
          </div>
        </div>
      </header>

      <section className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col gap-4">
              <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300"><Icons.Search /></span>
                  <input
                    type="text"
                    placeholder="Buscar estudiante..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full bg-slate-50 border-none p-4 pl-14 rounded-2xl outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10 transition-all font-display text-sm"
                  />
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                  <select
                    value={filters.coordinator}
                    onChange={(e) => setFilters({...filters, coordinator: e.target.value})}
                    className="flex-1 min-w-[140px] bg-slate-50 border-none p-3 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest text-primary-color outline-none cursor-pointer"
                  >
                    <option value="all">Todos los Mentores</option>
                    <option value="admin">Administración</option>
                    {coordinators.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>

                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="flex-1 min-w-[120px] bg-slate-50 border-none p-3 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest text-primary-color outline-none cursor-pointer"
                  >
                    <option value="all">Cualquier Estado</option>
                    <option value="paid">Saldados</option>
                    <option value="outstanding">Con Deuda</option>
                  </select>

                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => handleExport('pdf')} className="px-4 py-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all font-black text-[9px] uppercase tracking-widest">PDF</button>
                    <button onClick={() => handleExport('excel')} className="px-4 py-3 bg-emerald-50 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all font-black text-[9px] uppercase tracking-widest">Excel</button>
                  </div>
              </div>
          </div>

          {/* Tabla desktop */}
          <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                  <thead>
                      <tr className="bg-slate-50/50">
                          <th className="p-6 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Estudiante / Programa</th>
                          <th className="p-6 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Responsable</th>
                          <th className="p-6 text-center text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Inversión</th>
                          <th className="p-6 text-center text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Pagado</th>
                          <th className="p-6 text-center text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Saldo</th>
                          <th className="p-6 border-b border-gray-100"></th>
                      </tr>
                  </thead>
                  <tbody>
                      {loading ? (
                          <tr><td colSpan="6" className="p-32 text-center animate-pulse"><p className="text-gray-300 font-black uppercase tracking-[0.5em] text-[10px]">Cargando...</p></td></tr>
                      ) : filteredLedger.length > 0 ? (
                        filteredLedger.map(enr => (
                              <Fragment key={enr.id}>
                                <tr className={`group hover:bg-slate-50/30 transition-all cursor-pointer ${expandedRow === enr.id ? 'bg-slate-50/50' : ''}`} onClick={() => setExpandedRow(expandedRow === enr.id ? null : enr.id)}>
                                    <td className="p-6 border-b border-gray-50">
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-primary-color">{enr.student?.full_name}</p>
                                            <p className="text-[10px] font-black uppercase text-secondary-color tracking-widest">{enr.courses?.title}</p>
                                        </div>
                                    </td>
                                    <td className="p-6 border-b border-gray-50">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{enr.student?.coordinator?.full_name || 'Admin Central'}</span>
                                    </td>
                                    <td className="p-6 border-b border-gray-50 text-center font-black text-gray-500">${(enr.total_price || 0).toLocaleString('es-CO')}</td>
                                    <td className="p-6 border-b border-gray-50 text-center font-black text-emerald-500">${(enr.totalPaid || 0).toLocaleString('es-CO')}</td>
                                    <td className="p-6 border-b border-gray-50 text-center">
                                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black ${enr.calculatedBalance <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                            ${(enr.calculatedBalance || 0).toLocaleString('es-CO')}
                                        </span>
                                    </td>
                                    <td className="p-6 border-b border-gray-50 text-right">
                                        <span className={`transition-transform duration-300 inline-block text-gray-300 ${expandedRow === enr.id ? 'rotate-180' : ''}`}><Icons.ArrowDown /></span>
                                    </td>
                                </tr>
                                {expandedRow === enr.id && (
                                    <tr>
                                        <td colSpan="6" className="bg-slate-50/50 p-0 border-b border-gray-100">
                                            <div className="p-8 space-y-5 animate-fade-in">
                                                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                                    <Icons.Wallet />
                                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary-color">Desglose de Movimientos</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    {enr.payments?.length > 0 ? (
                                                        enr.payments.map(p => (
                                                            <div key={p.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                                                                <div className="flex justify-between items-start">
                                                                    <span className="text-lg font-black text-emerald-600">${(p.amount || 0).toLocaleString('es-CO')}</span>
                                                                    <span className="text-[9px] font-black uppercase text-gray-300">{new Date(p.payment_date).toLocaleDateString('es-CO')}</span>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{p.payment_method}</p>
                                                                {p.notes && <p className="text-[10px] italic text-gray-300 border-t border-gray-50 pt-2">{p.notes}</p>}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="col-span-full text-center py-8 text-gray-400 italic text-sm">Sin abonos registrados.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                              </Fragment>
                          ))
                      ) : (
                          <tr><td colSpan="6" className="p-16 text-center italic text-gray-400 text-sm">No se encontraron registros.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>

          {/* Lista móvil */}
          <div className="md:hidden divide-y divide-gray-50">
              {loading ? (
                  <div className="p-16 text-center animate-pulse">
                      <p className="text-gray-300 font-black uppercase tracking-[0.5em] text-[10px]">Cargando...</p>
                  </div>
              ) : filteredLedger.length > 0 ? (
                  filteredLedger.map(enr => {
                      const pct = enr.total_price > 0 ? Math.min(100, Math.round((enr.totalPaid / enr.total_price) * 100)) : 0;
                      return (
                          <Fragment key={enr.id}>
                              <div className={`p-5 cursor-pointer transition-all ${expandedRow === enr.id ? 'bg-slate-50' : ''}`} onClick={() => setExpandedRow(expandedRow === enr.id ? null : enr.id)}>
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex-1 pr-4">
                                          <p className="font-black text-primary-color text-sm leading-tight">{enr.student?.full_name}</p>
                                          <p className="text-[10px] font-black uppercase text-secondary-color tracking-widest mt-0.5">{enr.courses?.title}</p>
                                      </div>
                                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-black flex-shrink-0 ${enr.calculatedBalance <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                          {enr.calculatedBalance <= 0 ? 'Saldado' : `$${(enr.calculatedBalance || 0).toLocaleString('es-CO')}`}
                                      </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                      <div>
                                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">Inversión</span>
                                          <span className="text-sm font-black text-gray-600">${(enr.total_price || 0).toLocaleString('es-CO')}</span>
                                      </div>
                                      <div>
                                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 block">Pagado</span>
                                          <span className="text-sm font-black text-emerald-600">${(enr.totalPaid || 0).toLocaleString('es-CO')}</span>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{width: `${pct}%`}}></div>
                                      </div>
                                      <span className="text-[10px] font-black text-gray-400">{pct}%</span>
                                      <span className={`transition-transform duration-300 inline-block text-gray-300 ml-1 ${expandedRow === enr.id ? 'rotate-180' : ''}`}><Icons.ArrowDown /></span>
                                  </div>
                              </div>
                              {expandedRow === enr.id && (
                                  <div className="bg-slate-50/80 px-5 pb-5 animate-fade-in">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3 pt-4">Movimientos</p>
                                      <div className="space-y-3">
                                          {enr.payments?.length > 0 ? enr.payments.map(p => (
                                              <div key={p.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                                                  <div>
                                                      <span className="font-black text-emerald-600">${(p.amount || 0).toLocaleString('es-CO')}</span>
                                                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{p.payment_method}</p>
                                                  </div>
                                                  <span className="text-[9px] font-black text-gray-300">{new Date(p.payment_date).toLocaleDateString('es-CO')}</span>
                                              </div>
                                          )) : (
                                              <p className="text-center py-4 text-gray-400 italic text-sm">Sin abonos.</p>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </Fragment>
                      );
                  })
              ) : (
                  <p className="p-12 text-center italic text-gray-400 text-sm">No se encontraron registros.</p>
              )}
          </div>
      </section>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
