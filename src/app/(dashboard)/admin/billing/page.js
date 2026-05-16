'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';
import { exportToPDF, exportToExcel, exportToCSV } from '@/utils/export_finance';
import { createInvoice } from '@/app/actions/admin_actions';

export default function AdminBillingPage() {
  const { showNotification } = useNotification();
  const [coordinators, setCoordinators] = useState([]);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [unbilledStudents, setUnbilledStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ total_amount: '', notes: '' });

  // Pestaña activa en el panel lateral
  const [activeTab, setActiveTab] = useState('coordinador');

  // Estado para factura directa a estudiante
  const [allStudents, setAllStudents] = useState([]);
  const [directForm, setDirectForm] = useState({ studentId: '', amount: '', concept: '' });
  const [submittingDirect, setSubmittingDirect] = useState(false);

  useEffect(() => {
    fetchCoordinators();
    fetchInvoices();
    fetchAllStudents();
  }, []);

  const fetchAllStudents = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role_id', 3).order('full_name');
    setAllStudents(data || []);
  };

  const handleDirectInvoice = async (e) => {
    e.preventDefault();
    setSubmittingDirect(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('role_id').eq('id', user.id).single();

    const { error } = await createInvoice({
      studentId: directForm.studentId,
      amount: parseFloat(directForm.amount),
      concept: directForm.concept,
      actorRole: profile?.role_id ?? 1,
    });

    if (error) {
      showNotification('Error: ' + error, 'error');
    } else {
      showNotification('Factura generada con éxito.', 'success');
      setDirectForm({ studentId: '', amount: '', concept: '' });
    }
    setSubmittingDirect(false);
  };

  const fetchCoordinators = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email').eq('role_id', 2);
    setCoordinators(data || []);
  };

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from('coordinator_invoices')
      .select('*, coordinator:coordinator_id(full_name), items:coordinator_invoice_items(id, student:profiles(full_name), unit_price, created_at)')
      .order('created_at', { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  const fetchUnbilledStudents = async (coordinatorId) => {
    setLoading(true);
    const { data: billedItems } = await supabase.from('coordinator_invoice_items').select('student_id');
    const billedIds = billedItems?.map(item => item.student_id) || [];

    let query = supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .eq('role_id', 3);

    if (coordinatorId === 'admin') {
      query = query.is('coordinator_id', null);
    } else {
      query = query.eq('coordinator_id', coordinatorId);
    }

    if (billedIds.length > 0) {
      query = query.not('id', 'in', `(${billedIds.join(',')})`);
    }

    const { data } = await query;
    setUnbilledStudents(data || []);
    setSelectedStudents([]);
    setLoading(false);
  };

  const handleCoordinatorSelect = (e) => {
    const id = e.target.value;
    if (id === 'admin') {
      setSelectedCoordinator({ id: 'admin', full_name: 'Administración Central' });
      fetchUnbilledStudents('admin');
    } else {
      const coord = coordinators.find(c => c.id === id);
      setSelectedCoordinator(coord);
      if (coord) fetchUnbilledStudents(id);
      else setUnbilledStudents([]);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId) 
        : [...prev, studentId]
    );
  };

  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    if (selectedStudents.length === 0) return showNotification('Selecciona al menos un estudiante.', 'warning');
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    const insertData = {
      coordinator_id: selectedCoordinator.id === 'admin' ? null : selectedCoordinator.id,
      total_amount: parseFloat(formData.total_amount),
      notes: formData.notes,
      created_by: user.id,
      status: 'pending'
    };

    const { data: invoice, error: invError } = await supabase
      .from('coordinator_invoices')
      .insert(insertData)
      .select()
      .single();

    if (invError) {
      showNotification('Error: ' + invError.message, 'error');
      setSubmitting(false);
      return;
    }

    const items = selectedStudents.map(sId => ({
      invoice_id: invoice.id,
      student_id: sId,
      unit_price: parseFloat(formData.total_amount) / selectedStudents.length
    }));

    const { error: itemsError } = await supabase.from('coordinator_invoice_items').insert(items);

    if (itemsError) {
      showNotification('Error en items: ' + itemsError.message, 'error');
    } else {
      showNotification('Cobro generado con éxito.', 'success');
      setFormData({ total_amount: '', notes: '' });
      setSelectedCoordinator(null);
      fetchInvoices();
    }
    setSubmitting(false);
  };

  const markAsPaid = async (invoiceId) => {
    const { error } = await supabase
      .from('coordinator_invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId);
    
    if (!error) {
      showNotification('Pago confirmado y registrado.', 'success');
      fetchInvoices();
    } else {
      showNotification('Error: ' + error.message, 'error');
    }
  };

  const handleExport = (type) => {
    const filteredInvoices = historyFilter === 'all' 
      ? invoices 
      : invoices.filter(inv => (historyFilter === 'admin' ? !inv.coordinator_id : inv.coordinator_id === historyFilter));

    const exportData = filteredInvoices.map(inv => ({
      date: new Date(inv.created_at).toLocaleDateString(),
      entity: inv.coordinator?.full_name || 'Administración Central',
      description: `Factura por ${inv.items?.length || 0} alumnos`,
      amount: inv.total_amount,
      status: inv.status
    }));

    const filename = `Auditoria_Ingresos_${new Date().getTime()}`;
    if (type === 'pdf') exportToPDF(exportData, { title: 'REPORTE DE INGRESOS FUNDETEC', filename: `${filename}.pdf` });
    if (type === 'excel') exportToExcel(exportData, { filename: `${filename}.xlsx` });
    if (type === 'csv') exportToCSV(exportData, { filename: `${filename}.csv` });
  };

  const filteredHistory = historyFilter === 'all' 
    ? invoices 
    : invoices.filter(inv => (historyFilter === 'admin' ? !inv.coordinator_id : inv.coordinator_id === historyFilter));

  const totalCollected = filteredHistory.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.total_amount, 0);
  const totalPending = filteredHistory.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.total_amount, 0);

  return (
    <div className="admin-billing-page max-w-[1400px] mx-auto p-4 md:p-10 space-y-12 animate-fade-in">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none font-display">
            Gestión de <span className="text-secondary-color">Ingresos</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Control financiero y auditoría por entidad.</p>
        </div>
        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          <div className="flex-1 lg:flex-none p-5 px-10 bg-emerald-50 rounded-[32px] border border-emerald-100 flex flex-col">
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">{historyFilter === 'all' ? 'Total' : 'Filtrado'} Recaudado</span>
            <span className="text-2xl font-black text-emerald-600 font-display">${totalCollected.toLocaleString()}</span>
          </div>
          <div className="flex-1 lg:flex-none p-5 px-10 bg-amber-50 rounded-[32px] border border-amber-100 flex flex-col">
            <span className="text-[10px] font-black uppercase text-amber-500 tracking-[0.2em]">Por Cobrar</span>
            <span className="text-2xl font-black text-amber-600 font-display">${totalPending.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* GENERADOR DE COBROS */}
        <aside className="lg:col-span-4 bg-white p-8 md:p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-10">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-primary-color tracking-tight font-display">Generar Cobro</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-none">Facturación de Alumnos</p>
          </div>

          {/* Pestañas */}
          <div className="flex bg-slate-50 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('coordinador')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'coordinador' ? 'bg-white text-primary-color shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Por Coordinador
            </button>
            <button
              onClick={() => setActiveTab('directo')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'directo' ? 'bg-white text-primary-color shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Factura Directa
            </button>
          </div>

          {/* Formulario: Factura Directa */}
          {activeTab === 'directo' && (
            <form onSubmit={handleDirectInvoice} className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Estudiante</label>
                <select
                  required
                  value={directForm.studentId}
                  onChange={e => setDirectForm({ ...directForm, studentId: e.target.value })}
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color cursor-pointer appearance-none shadow-inner"
                >
                  <option value="">-- Seleccionar estudiante --</option>
                  {allStudents.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Concepto</label>
                <input
                  type="text" required
                  value={directForm.concept}
                  onChange={e => setDirectForm({ ...directForm, concept: e.target.value })}
                  placeholder="Ej: Inscripción, Mensualidad..."
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monto (USD)</label>
                <input
                  type="number" required min="0.01" step="0.01"
                  value={directForm.amount}
                  onChange={e => setDirectForm({ ...directForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-xl text-primary-color shadow-inner"
                />
              </div>
              <button type="submit" disabled={submittingDirect} className="w-full py-5 bg-primary-color text-white rounded-[32px] font-black text-xs uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 disabled:opacity-50">
                {submittingDirect ? 'Procesando...' : 'Generar Factura'}
              </button>
            </form>
          )}

          {/* Formulario: Por Coordinador */}
          {activeTab === 'coordinador' && <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Entidad Responsable</label>
              <select 
                onChange={handleCoordinatorSelect} 
                value={selectedCoordinator?.id || ''}
                className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-primary-color cursor-pointer appearance-none shadow-inner"
              >
                <option value="">-- Seleccionar --</option>
                <option value="admin">🏢 Administración Central</option>
                <optgroup label="Coordinadores Académicos">
                  {coordinators.map(c => <option key={c.id} value={c.id}>👤 {c.full_name}</option>)}
                </optgroup>
              </select>
            </div>

            {selectedCoordinator && (
              <div className="space-y-8 animate-fade-in">
                <div className="space-y-4">
                  <header className="flex justify-between items-center px-1">
                    <h3 className="text-xs font-black text-primary-color uppercase tracking-widest">Alumnos Pendientes ({unbilledStudents.length})</h3>
                    <span className="text-[10px] font-black text-secondary-color">{selectedStudents.length} Seleccionados</span>
                  </header>
                  
                  <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {unbilledStudents.length === 0 ? (
                      <div className="p-8 bg-slate-50 rounded-3xl text-center text-gray-400 text-xs italic">No hay alumnos para facturar.</div>
                    ) : (
                      unbilledStudents.map(s => (
                        <label key={s.id} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${selectedStudents.includes(s.id) ? 'bg-primary-color text-white shadow-lg' : 'bg-slate-50 hover:bg-slate-100 text-primary-color'}`}>
                          <input 
                            type="checkbox" 
                            className="hidden"
                            checked={selectedStudents.includes(s.id)}
                            onChange={() => toggleStudentSelection(s.id)}
                          />
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] ${selectedStudents.includes(s.id) ? 'bg-secondary-color text-primary-color' : 'bg-white text-primary-color'}`}>
                            {s.full_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{s.full_name}</p>
                            <p className={`text-[9px] font-black uppercase tracking-widest ${selectedStudents.includes(s.id) ? 'text-white/50' : 'text-gray-400'}`}>{new Date(s.created_at).toLocaleDateString()}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {selectedStudents.length > 0 && (
                  <form onSubmit={handleGenerateInvoice} className="space-y-6 pt-6 border-t border-gray-100">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Monto Total a Cobrar (COP)</label>
                       <input 
                        type="number" required 
                        value={formData.total_amount} 
                        onChange={e => setFormData({...formData, total_amount: e.target.value})}
                        className="w-full bg-slate-50 border-none p-5 rounded-3xl outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-xl text-primary-color shadow-inner"
                        placeholder="0.00"
                       />
                    </div>
                    <button type="submit" disabled={submitting} className="w-full py-5 bg-primary-color text-white rounded-[32px] font-black text-xs uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10">
                      {submitting ? 'Procesando...' : `Generar Factura (${selectedStudents.length})`}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>}
        </aside>

        {/* HISTORIAL DE FACTURACIÓN */}
        <main className="lg:col-span-8 bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[700px]">
          <header className="p-8 md:p-10 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <h2 className="text-2xl font-black text-primary-color tracking-tight font-display">Historial de Auditoría</h2>
            
            <div className="flex flex-wrap gap-4 items-center">
              <select 
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="bg-slate-50 border-none p-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest text-primary-color outline-none focus:ring-4 focus:ring-secondary-color/10 cursor-pointer"
              >
                <option value="all">Ver Todos</option>
                <option value="admin">Administración</option>
                {coordinators.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>

              <div className="flex gap-2">
                <button onClick={() => handleExport('pdf')} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm font-black text-[9px] uppercase tracking-widest">PDF</button>
                <button onClick={() => handleExport('excel')} className="p-3 bg-emerald-50 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm font-black text-[9px] uppercase tracking-widest">Excel</button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="p-40 text-center animate-pulse">
                <div className="w-16 h-16 bg-slate-50 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl">🧾</div>
                <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">Cargando Transacciones...</p>
              </div>
            ) : (
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="p-8 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Entidad / Coordinador</th>
                    <th className="p-8 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Monto Auditoría</th>
                    <th className="p-8 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Estado</th>
                    <th className="p-8 text-right text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(inv => (
                    <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="p-8 border-b border-gray-50">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${!inv.coordinator ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-primary-color'}`}>
                            {inv.coordinator?.full_name?.substring(0,2).toUpperCase() || 'AD'}
                          </div>
                          <div>
                            <p className="text-sm font-black text-primary-color">{inv.coordinator?.full_name || 'Administración Central'}</p>
                            <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">{new Date(inv.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-8 border-b border-gray-50">
                        <span className="text-base font-black text-primary-color font-display">${inv.total_amount.toLocaleString()}</span>
                      </td>
                      <td className="p-8 border-b border-gray-50">
                        <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          inv.status === 'paid' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                        }`}>
                          {inv.status === 'paid' ? 'Saldado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-8 border-b border-gray-50 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {inv.status === 'pending' && (
                            <button 
                              onClick={() => markAsPaid(inv.id)}
                              className="p-3 bg-emerald-50 text-emerald-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10"
                            >
                              Confirmar
                            </button>
                          )}
                          <button className="p-3 bg-slate-100 text-gray-400 rounded-xl text-[9px] hover:bg-primary-color hover:text-white transition-all">Detalles</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-20 text-center text-gray-400 font-medium italic">No se han encontrado registros para este filtro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
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
