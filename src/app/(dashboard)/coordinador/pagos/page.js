'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { generateReceipt } from '@/utils/generateReceipt';
import { useNotification } from '@/context/NotificationContext';
import { optimizeImage } from '@/utils/imageOptimizer';

const Icons = {
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  PDF: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Link: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
  Chevron: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  Receipt: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5V6.5"/></svg>,
  Transfer: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 7 10 10"/><path d="M17 7v10H7"/></svg>,
  Cash: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
};

export default function ManualPaymentsPage() {
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);
  const [stats, setStats] = useState({ today: 0, month: 0 });

  useEffect(() => {
    fetchRecentPayments();

    const channel = supabase
      .channel('payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchRecentPayments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => fetchRecentPayments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSearch = async (term) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, 
        full_name, 
        enrollments(
          id, 
          total_price,
          remaining_balance, 
          courses(title), 
          payments(amount)
        )
      `)
      .eq('coordinator_id', session.user.id)
      .ilike('full_name', `%${term}%`)
      .limit(6);

    if (!error) setSearchResults(data);
  };

  const selectStudent = (student) => {
    setSelectedStudent(student);
    
    // Calcular saldos dinámicos para cada inscripción
    const processedEnrollments = (student.enrollments || []).map(enr => {
      const total_price = Number(enr.total_price) || 0;
      const totalPaid = enr.payments?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;
      return {
        ...enr,
        calculatedBalance: total_price - totalPaid
      };
    });

    setEnrollments(processedEnrollments);
    setSearchResults([]);
    setSearchTerm(student.full_name);
    if (processedEnrollments.length > 0) {
      setSelectedEnrollment(processedEnrollments[0].id);
    }
  };

  const fetchRecentPayments = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('payments')
      .select('*, enrollment:enrollment_id(courses(title), student:student_id(full_name))')
      .eq('registered_by', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) {
      setRecentPayments(data);
      
      // 2. Cálculo de estadísticas independiente (sin límite de historial)
      const now = new Date();
      const todayString = now.toDateString();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Consultamos todos los pagos del mes para este coordinador
      const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
      
      const { data: monthData } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('registered_by', session.user.id)
        .gte('created_at', startOfMonth);

      if (monthData) {
        const todayTotal = monthData
          .filter(p => new Date(p.created_at).toDateString() === todayString)
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        
        const monthTotal = monthData
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          
        setStats({ today: todayTotal, month: monthTotal });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEnrollment || !amount) {
      showNotification('Completa todos los campos obligatorios.', 'error');
      return;
    }
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let receiptUrl = '';

      if (file) {
        // Optimizar comprobante antes de subir
        const optimizedFile = await optimizeImage(file);
        
        const fileExt = optimizedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, optimizedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
        receiptUrl = publicUrl;
      }

      const { data: insertedPayment, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          enrollment_id: selectedEnrollment,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          notes: notes,
          receipt_url: receiptUrl,
          registered_by: session.user.id
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Actualizar automáticamente el saldo en la matrícula (como respaldo, aunque ahora usamos cálculo dinámico)
      const currentEnrollment = enrollments.find(e => e.id === selectedEnrollment);
      const currentRemaining = currentEnrollment.remaining_balance ?? (Number(currentEnrollment.total_price) || 0);
      const newBalance = currentRemaining - parseFloat(amount);

      const { error: updateError } = await supabase
        .from('enrollments')
        .update({ remaining_balance: newBalance })
        .eq('id', selectedEnrollment);

      if (updateError) throw updateError;

      generateReceipt({
        student: selectedStudent.full_name,
        course: currentEnrollment.courses.title,
        amount: amount,
        payment_method: paymentMethod
      });

      showNotification('💰 Pago procesado y PDF generado.', 'success');
      setAmount('');
      setNotes('');
      setFile(null);
      setSelectedStudent(null);
      setSearchTerm('');
      fetchRecentPayments();
      
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payments-container max-w-[1440px] mx-auto p-4 md:p-8 space-y-8 animate-fade-in font-display">
      <header className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6 bg-primary-color p-1 relative rounded-[40px] overflow-hidden shadow-2xl shadow-primary-color/20">
        <div className="flex-1 p-8 md:p-12 relative z-10">
          <div className="flex items-center gap-3 mb-4 opacity-70">
            <span className="w-2 h-2 bg-secondary-color rounded-full animate-ping"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Central de Finanzas</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none mb-3">
            Centro de <span className="text-secondary-color">Recaudación</span>
          </h1>
          <p className="text-white/50 font-medium italic text-sm md:text-base max-w-xl">Gestión financiera y comprobantes de mentoría personalizada con trazabilidad total.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 p-4 lg:p-8 relative z-10 w-full lg:w-auto">
           <div className="bg-white/10 backdrop-blur-3xl p-8 rounded-[40px] border border-white/10 flex-1 min-w-[220px] group hover:bg-white/20 transition-all duration-500">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black uppercase text-secondary-color tracking-[0.2em]">Recaudado Hoy</span>
                <span className="text-xl opacity-50">⚡</span>
              </div>
              <p className="text-4xl font-black text-white tracking-tighter leading-tight">${stats.today.toLocaleString()}</p>
           </div>
           <div className="bg-secondary-color p-8 rounded-[40px] flex-1 min-w-[220px] shadow-xl shadow-secondary-color/20 group hover:scale-[1.02] transition-all duration-500">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black uppercase text-primary-color tracking-[0.2em] opacity-60">Balance Mensual</span>
                <Icons.Receipt />
              </div>
              <p className="text-4xl font-black text-primary-color tracking-tighter leading-tight">${stats.month.toLocaleString()}</p>
           </div>
        </div>
        
        {/* Mesh Background Effect */}
        <div className="absolute top-0 right-0 w-[50%] h-full bg-gradient-to-l from-secondary-color/20 to-transparent pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CONSOLA DE REGISTRO PREMIUM */}
        <section className="lg:col-span-4 bg-white/70 backdrop-blur-3xl p-10 rounded-[56px] border border-white shadow-2xl space-y-8 relative group">
           {/* Glass Decorative */}
           <div className="absolute -top-20 -right-20 w-40 h-40 bg-secondary-color/10 rounded-full blur-[60px] group-hover:bg-secondary-color/20 transition-all duration-700"></div>
           
           <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-primary-color rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-color/20">
                <Icons.Receipt />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-2xl font-black text-primary-color tracking-tighter">Nuevo Registro</h2>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Consola de Abonos</p>
              </div>
           </div>

           <form onSubmit={handleSubmit} className="space-y-7 relative z-10">
              <div className="space-y-3 relative">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Buscar Alumno</label>
                 <div className="relative group/search">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within/search:opacity-100 group-focus-within/search:text-secondary-color transition-all transition-duration-300"><Icons.Search /></span>
                    <input 
                      type="text" 
                      placeholder="Escribe el nombre aquí..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full bg-slate-100/50 border-none p-6 pl-14 rounded-[32px] outline-none font-bold text-primary-color focus:ring-[6px] focus:ring-secondary-color/20 focus:bg-white transition-all duration-500 shadow-inner"
                    />
                 </div>
                 
                 {searchResults.length > 0 && (
                    <div className="absolute top-[calc(100%+12px)] left-2 right-2 z-50 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden divide-y divide-gray-50 animate-pop">
                       {searchResults.map(s => (
                          <button 
                            key={s.id} 
                            type="button"
                            onClick={() => selectStudent(s)}
                            className="w-full p-6 text-left hover:bg-secondary-color/10 transition-all flex items-center gap-5 group/item"
                          >
                             <div className="w-12 h-12 rounded-2xl bg-primary-color text-white flex items-center justify-center font-black text-sm group-hover/item:scale-110 transition-transform">
                                {s.full_name?.substring(0,1).toUpperCase()}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-primary-color truncate uppercase">{s.full_name}</p>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.enrollments?.length} Inscripción(es) Activa(s)</p>
                             </div>
                             <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"><Icons.Chevron /></span>
                          </button>
                       ))}
                    </div>
                 )}
              </div>

              {selectedStudent && (
                 <div className="space-y-7 animate-fade-in">
                    <div className="space-y-3 relative">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Matrícula / Deuda Real</label>
                       <div className="relative group">
                          <select 
                            value={selectedEnrollment}
                            onChange={(e) => setSelectedEnrollment(e.target.value)}
                            className="w-full appearance-none bg-emerald-500 text-white border-none p-6 pr-14 rounded-[32px] outline-none font-black text-[13px] uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                          >
                             {enrollments.map(e => (
                                <option key={e.id} value={e.id} className="text-primary-color">
                                   {e.courses.title} - SALDO: ${(e.calculatedBalance ?? 0).toLocaleString()}
                                </option>
                             ))}
                          </select>
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/50"><Icons.Chevron /></div>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Monto del Abono</label>
                       <div className="relative group">
                          <span className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-black text-primary-color/20">$</span>
                          <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-100/50 border-none p-10 pl-16 rounded-[40px] outline-none text-5xl font-black text-primary-color focus:ring-[8px] focus:ring-emerald-500/10 focus:bg-white placeholder:text-gray-100 transition-all duration-500 shadow-inner"
                          />
                       </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Método de Pago</label>
                       <div className="grid grid-cols-2 gap-4">
                          <button 
                            type="button"
                            onClick={() => setPaymentMethod('transfer')}
                            className={`p-6 rounded-[32px] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'transfer' ? 'bg-primary-color text-white shadow-2xl shadow-primary-color/20' : 'bg-slate-100 text-gray-400 hover:bg-slate-200'}`}
                          >
                             <Icons.Transfer />
                             <span>Transferencia</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={`p-6 rounded-[32px] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'cash' ? 'bg-secondary-color text-primary-color shadow-2xl shadow-secondary-color/20' : 'bg-slate-100 text-gray-400 hover:bg-slate-200'}`}
                          >
                             <Icons.Cash />
                             <span>Efectivo</span>
                          </button>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Comprobante (Archivo)</label>
                       <label className="block w-full cursor-pointer group">
                          <div className="w-full border-3 border-dashed border-gray-100 p-8 rounded-[40px] text-center group-hover:bg-slate-50 group-hover:border-emerald-500/30 transition-all duration-500">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{file ? file.name : 'Subir Imagen / PDF'}</p>
                             <p className="text-[8px] text-emerald-500 font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Optimizado automático</p>
                          </div>
                          <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                       </label>
                    </div>

                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-8 bg-emerald-500 text-white rounded-[40px] font-black text-[12px] uppercase tracking-[0.2em] shadow-3xl shadow-emerald-500/30 hover:bg-primary-color hover:scale-[1.02] active:scale-[0.98] transition-all duration-500"
                    >
                       {loading ? 'Sincronizando...' : 'Completar Registro y PDF'}
                    </button>
                 </div>
              )}
           </form>
        </section>

        {/* LIBRO MAYOR DE TRANSACCIONES PREMIUM */}
        <div className="lg:col-span-8 space-y-6 group/table">
           <div className="bg-white rounded-[64px] border border-gray-100 shadow-sm overflow-hidden min-h-[700px] flex flex-col hover:shadow-2xl hover:shadow-primary-color/5 transition-all duration-700">
              <header className="p-10 border-b border-gray-50 flex justify-between items-center bg-slate-50/30">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                       <Icons.Receipt />
                    </div>
                    <div>
                       <h2 className="text-xl font-black text-primary-color tracking-tighter">Historial Reciente</h2>
                       <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Trazabilidad de Últimos 10 movimientos</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Conectado</span>
                 </div>
              </header>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-white">
                      <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-50">Estudiante / Programa</th>
                      <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-50">Método</th>
                      <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-50">Monto</th>
                      <th className="p-8 text-right text-[9px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-50">Comprobante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentPayments.map(p => (
                       <tr key={p.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                          <td className="p-8">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary-color font-black text-xs group-hover:bg-primary-color group-hover:text-white transition-all duration-500">
                                   {p.enrollment?.student?.full_name?.substring(0,1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                   <p className="text-sm font-black text-primary-color truncate group-hover:text-emerald-600 transition-colors uppercase">{p.enrollment?.student?.full_name}</p>
                                   <p className="text-[9px] font-black text-secondary-color uppercase tracking-wider">{p.enrollment?.courses?.title}</p>
                                </div>
                             </div>
                          </td>
                          <td className="p-8">
                             <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${p.payment_method === 'transfer' ? 'bg-indigo-50 text-indigo-500 border border-indigo-100' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'}`}>
                                {p.payment_method === 'transfer' ? <Icons.Transfer /> : <Icons.Cash />}
                                {p.payment_method === 'transfer' ? 'Transf.' : 'Efectivo'}
                             </span>
                          </td>
                          <td className="p-8">
                             <div className="space-y-0.5">
                                <p className="text-lg font-black text-primary-color font-display tracking-tighter">${p.amount.toLocaleString()}</p>
                                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{new Date(p.created_at).toLocaleDateString()} · {new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                             </div>
                          </td>
                          <td className="p-8 text-right">
                             <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
                                <button 
                                  onClick={() => generateReceipt({
                                    student: p.enrollment?.student?.full_name,
                                    course: p.enrollment?.courses?.title,
                                    amount: p.amount,
                                    payment_method: p.payment_method
                                  })}
                                  className="h-10 px-5 bg-white border border-gray-100 text-primary-color rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-widest hover:bg-primary-color hover:text-white transition-all shadow-sm"
                                >
                                   <Icons.PDF />
                                   <span>Recibo</span>
                                </button>
                                
                                {p.receipt_url && (
                                  <a 
                                    href={p.receipt_url} 
                                    target="_blank" 
                                    className="w-10 h-10 bg-secondary-color text-primary-color rounded-xl flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-secondary-color/20"
                                  ><Icons.Link /></a>
                                )}
                             </div>
                          </td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {recentPayments.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-4 opacity-20">
                   <div className="text-6xl">📊</div>
                   <p className="font-black uppercase tracking-[0.4em] text-[10px]">Sin movimientos recientes</p>
                </div>
              )}
           </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pop { animation: pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .payments-container { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
