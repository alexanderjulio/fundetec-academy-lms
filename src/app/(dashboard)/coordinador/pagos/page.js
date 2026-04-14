'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { generateReceipt } from '@/utils/generateReceipt';
import { useNotification } from '@/context/NotificationContext';
import { optimizeImage } from '@/utils/imageOptimizer';

const Icons = {
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  PDF: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Link: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
  Chevron: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
      // Calcular stats
      const today = new Date().toDateString();
      const month = new Date().getMonth();
      const year = new Date().getFullYear();
      
      const todayTotal = data
        .filter(p => new Date(p.created_at).toDateString() === today)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const monthTotal = data
        .filter(p => {
          const d = new Date(p.created_at);
          return d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((sum, p) => sum + p.amount, 0);
        
      setStats({ today: todayTotal, month: monthTotal });
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
    <div className="payments-container max-w-[1400px] mx-auto p-4 md:p-10 space-y-10 animate-fade-in font-display">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
            Centro de <span className="text-secondary-color">Recaudación</span>
          </h1>
          <p className="text-gray-400 font-medium italic">Gestión financiera y comprobantes de mentoría personalizada.</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 relative z-10">
           <div className="bg-emerald-50 p-6 px-10 rounded-[32px] border border-emerald-100/50">
              <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest pl-1">Recaudado Hoy</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">${stats.today.toLocaleString()}</p>
           </div>
           <div className="bg-primary-color p-6 px-10 rounded-[32px] text-white">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 pl-1">Balance Mensual</p>
              <p className="text-3xl font-black mt-1">${stats.month.toLocaleString()}</p>
           </div>
        </div>
        {/* Decorativo */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-secondary-color/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CONSOLA DE REGISTRO */}
        <section className="lg:col-span-4 bg-white p-10 rounded-[64px] border border-gray-100 shadow-xl space-y-8 relative overflow-hidden">
           <div className="space-y-2">
              <h2 className="text-2xl font-black text-primary-color tracking-tighter">Nuevo Registro</h2>
              <div className="h-1 w-12 bg-secondary-color rounded-full"></div>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3 relative">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Buscar Alumno</label>
                 <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20"><Icons.Search /></span>
                    <input 
                      type="text" 
                      placeholder="Nombre del estudiante..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full bg-slate-50 border-none p-5 pl-14 rounded-[28px] outline-none font-bold text-primary-color focus:ring-4 focus:ring-secondary-color/10 transition-all"
                    />
                 </div>
                 
                 {searchResults.length > 0 && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50 animate-pop">
                       {searchResults.map(s => (
                          <button 
                            key={s.id} 
                            type="button"
                            onClick={() => selectStudent(s)}
                            className="w-full p-5 text-left hover:bg-slate-50 transition-all flex items-center justify-between group/item"
                          >
                             <div>
                                <p className="text-sm font-black text-primary-color">{s.full_name}</p>
                                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{s.enrollments?.length} Inscripción(es)</p>
                             </div>
                             <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"><Icons.Chevron /></span>
                          </button>
                       ))}
                    </div>
                 )}
              </div>

              {selectedStudent && (
                 <div className="space-y-6 animate-fade-in">
                    <div className="space-y-3 relative">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Diplomado / Programa</label>
                       <div className="relative">
                          <select 
                            value={selectedEnrollment}
                            onChange={(e) => setSelectedEnrollment(e.target.value)}
                            className="w-full appearance-none bg-slate-50 border-none p-5 pr-14 rounded-[28px] outline-none font-bold text-sm text-primary-color cursor-pointer"
                          >
                             {enrollments.map(e => (
                                <option key={e.id} value={e.id}>
                                   {e.courses.title} (${(e.calculatedBalance ?? 0).toLocaleString()})
                                </option>
                             ))}
                          </select>
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-30"><Icons.Chevron /></div>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Monto del Abono</label>
                       <div className="relative group">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-primary-color/20">$</span>
                          <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-50 border-none p-8 pl-14 rounded-[32px] outline-none text-4xl font-black text-primary-color focus:ring-4 focus:ring-emerald-500/10 placeholder:text-gray-100 transition-all"
                          />
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Método de Pago</label>
                       <div className="grid grid-cols-2 gap-3">
                          <button 
                            type="button"
                            onClick={() => setPaymentMethod('transfer')}
                            className={`p-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'transfer' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-50 text-gray-400 hover:bg-slate-100'}`}
                          >Transferencia</button>
                          <button 
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={`p-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'cash' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-50 text-gray-400 hover:bg-slate-100'}`}
                          >Efectivo</button>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-4">Soporte Digital</label>
                       <label className="block w-full cursor-pointer group">
                          <div className="w-full border-2 border-dashed border-gray-100 p-6 rounded-[28px] text-center group-hover:bg-slate-50 group-hover:border-secondary-color transition-all">
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{file ? file.name : 'Click para subir comprobante'}</p>
                          </div>
                          <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                       </label>
                    </div>

                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-7 bg-primary-color text-white rounded-[32px] font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-primary-color/20 hover:bg-secondary-color hover:text-primary-color transition-all"
                    >
                       {loading ? 'Procesando Transacción...' : 'Registrar y Generar Comprobante'}
                    </button>
                 </div>
              )}
           </form>
        </section>

        {/* LIBRO MAYOR DE TRANSACCIONES */}
        <div className="lg:col-span-8 space-y-6">
           <div className="bg-white rounded-[64px] border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">
              <header className="p-10 border-b border-gray-100 flex justify-between items-center">
                 <h2 className="text-xl font-black text-primary-color tracking-tighter">Registros Recientes</h2>
                 <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full leading-none">Últimos 10 movimientos</span>
              </header>

              <table className="w-full border-separate border-spacing-0">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400">Estudiante / Programa</th>
                       <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400">Tipo</th>
                       <th className="p-8 text-left text-[9px] font-black uppercase tracking-widest text-gray-400">Monto</th>
                       <th className="p-8 text-right text-[9px] font-black uppercase tracking-widest text-gray-400">Acciones</th>
                    </tr>
                 </thead>
                 <tbody>
                    {recentPayments.map(p => (
                       <tr key={p.id} className="group hover:bg-slate-50/30 transition-all">
                          <td className="p-8 border-b border-gray-50">
                             <div className="min-w-0">
                                <p className="text-sm font-black text-primary-color truncate group-hover:text-secondary-color transition-colors">{p.enrollment?.student?.full_name}</p>
                                <p className="text-[10px] font-bold text-gray-300 uppercase">{p.enrollment?.courses?.title}</p>
                             </div>
                          </td>
                          <td className="p-8 border-b border-gray-50">
                             <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${p.payment_method === 'transfer' ? 'bg-indigo-50 text-indigo-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                {p.payment_method === 'transfer' ? 'Transf.' : 'Efectivo'}
                             </span>
                          </td>
                          <td className="p-8 border-b border-gray-50">
                             <p className="text-sm font-black text-slate-700 font-display">${p.amount.toLocaleString()}</p>
                             <p className="text-[9px] font-bold text-gray-300 uppercase">{new Date(p.created_at).toLocaleDateString()}</p>
                          </td>
                          <td className="p-8 border-b border-gray-50 text-right">
                             <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                <button 
                                  onClick={() => generateReceipt({
                                    student: p.enrollment?.student?.full_name,
                                    course: p.enrollment?.courses?.title,
                                    amount: p.amount,
                                    payment_method: p.payment_method
                                  })}
                                  className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-primary-color hover:text-white transition-all shadow-sm"
                                  title="Generar Copia PDF"
                                ><Icons.PDF /></button>
                                
                                {p.receipt_url && (
                                  <a 
                                    href={p.receipt_url} 
                                    target="_blank" 
                                    className="w-10 h-10 bg-secondary-color/10 text-secondary-color rounded-xl flex items-center justify-center hover:bg-secondary-color hover:text-primary-color transition-all shadow-sm"
                                    title="Ver Soporte"
                                  ><Icons.Link /></a>
                                )}
                             </div>
                          </td>
                       </tr>
                    ))}
                    {recentPayments.length === 0 && (
                       <tr><td colSpan="4" className="p-40 text-center text-gray-300 italic text-xs">Aún no has registrado transacciones en Fundetec.</td></tr>
                    )}
                 </tbody>
              </table>
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
