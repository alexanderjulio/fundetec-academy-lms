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

  return (
    <div className="ledger-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-10 animate-fade-in font-display">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="space-y-1 z-10">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
            Libro Mayor <span className="text-secondary-color">Estudiantes</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Estado de cartera, abonos y auditoría individual.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full lg:w-auto z-10">
            <div className="bg-slate-50 p-6 rounded-[32px] border border-gray-100">
               <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">Total Contratado</span>
               <span className="text-xl font-black text-primary-color">${(totals.cost || 0).toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100">
               <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest block mb-1">Total Recaudado</span>
               <span className="text-xl font-black text-emerald-600">${(totals.paid || 0).toLocaleString()}</span>
            </div>
            <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 col-span-2 md:col-span-1">
               <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest block mb-1">Cartera Pendiente</span>
               <span className="text-xl font-black text-amber-600">${(totals.balance || 0).toLocaleString()}</span>
            </div>
        </div>
      </header>

      <section className="bg-white rounded-[48px] border border-gray-100 shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row gap-6 items-center">
              <div className="relative flex-1 group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20"><Icons.Search /></span>
                  <input 
                    type="text" 
                    placeholder="Buscar estudiante..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full bg-slate-50 border-none p-4 pl-14 rounded-2xl outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10 transition-all font-display"
                  />
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                  <select 
                    value={filters.coordinator}
                    onChange={(e) => setFilters({...filters, coordinator: e.target.value})}
                    className="bg-slate-50 border-none p-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest text-primary-color outline-none focus:ring-4 focus:ring-secondary-color/10 cursor-pointer shadow-sm"
                  >
                    <option value="all">Todos los Mentores</option>
                    <option value="admin">Administración</option>
                    {coordinators.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>

                  <select 
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="bg-slate-50 border-none p-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest text-primary-color outline-none focus:ring-4 focus:ring-secondary-color/10 cursor-pointer shadow-sm"
                  >
                    <option value="all">Cualquier Estado</option>
                    <option value="paid">Saldados</option>
                    <option value="outstanding">Con Deuda</option>
                  </select>

                  <div className="flex gap-2">
                    <button onClick={() => handleExport('pdf')} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm font-black text-[9px] uppercase tracking-widest">PDF</button>
                    <button onClick={() => handleExport('excel')} className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm font-black text-[9px] uppercase tracking-widest">EXCEL</button>
                  </div>
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                  <thead>
                      <tr className="bg-slate-50/50">
                          <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Estudiante / Programa</th>
                          <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Responsable</th>
                          <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 text-center">Inversión Total</th>
                          <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 text-center">Total Pagado</th>
                          <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 text-center">Saldo Restante</th>
                          <th className="p-8 text-right text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100"></th>
                      </tr>
                  </thead>
                  <tbody>
                      {loading ? (
                          <tr><td colSpan="6" className="p-40 text-center animate-pulse"><p className="text-gray-300 font-black uppercase tracking-[0.5em] text-[10px]">Cargando Libro Mayor...</p></td></tr>
                      ) : filteredLedger.length > 0 ? (
                        filteredLedger.map(enr => (
                              <Fragment key={enr.id}>
                                <tr className={`group hover:bg-slate-50/50 transition-all cursor-pointer ${expandedRow === enr.id ? 'bg-slate-50' : ''}`} onClick={() => setExpandedRow(expandedRow === enr.id ? null : enr.id)}>
                                    <td className="p-8 border-b border-gray-50">
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-primary-color">{enr.student?.full_name}</p>
                                            <p className="text-[10px] font-black uppercase text-secondary-color tracking-widest">{enr.courses?.title}</p>
                                        </div>
                                    </td>
                                    <td className="p-8 border-b border-gray-50">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{enr.student?.coordinator?.full_name || 'Admin Central'}</span>
                                    </td>
                                    <td className="p-8 border-b border-gray-50 text-center font-display font-black text-gray-400">${(enr.total_price || 0).toLocaleString()}</td>
                                    <td className="p-8 border-b border-gray-50 text-center font-display font-black text-emerald-500">${(enr.totalPaid || 0).toLocaleString()}</td>
                                    <td className="p-8 border-b border-gray-50 text-center">
                                        <span className={`px-4 py-2 rounded-full text-[10px] font-black font-display ${enr.calculatedBalance <= 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                                            ${(enr.calculatedBalance || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="p-8 border-b border-gray-50 text-right">
                                        <span className={`transition-transform duration-300 inline-block ${expandedRow === enr.id ? 'rotate-180' : ''}`}><Icons.ArrowDown /></span>
                                    </td>
                                </tr>
                                {expandedRow === enr.id && (
                                    <tr>
                                        <td colSpan="6" className="bg-slate-50/50 p-0 border-b border-gray-100">
                                            <div className="p-10 space-y-6 animate-fade-in">
                                                <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                                    <Icons.Wallet />
                                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary-color">Desglose de Movimientos</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    {enr.payments?.length > 0 ? (
                                                        enr.payments.map(p => (
                                                            <div key={p.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                                                                <div className="flex justify-between items-start">
                                                                    <span className="text-xl font-black text-emerald-600">${(p.amount || 0).toLocaleString()}</span>
                                                                    <span className="text-[9px] font-black uppercase text-gray-300">{new Date(p.payment_date).toLocaleDateString()}</span>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-gray-400 leading-tight uppercase tracking-wider">{p.payment_method}</p>
                                                                {p.notes && <p className="text-[10px] italic text-gray-300 border-t border-gray-50 pt-2">{p.notes}</p>}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="col-span-full text-center py-10 text-gray-400 italic text-sm">No se han registrado abonos para esta matrícula.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                              </Fragment>
                          ))
                      ) : (
                          <tr><td colSpan="6" className="p-20 text-center italic text-gray-400">No se encontraron registros que coincidan con los filtros.</td></tr>
                      )}
                  </tbody>
              </table>
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
