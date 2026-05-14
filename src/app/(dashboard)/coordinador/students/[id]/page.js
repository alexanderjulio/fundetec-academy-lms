'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

const Icons = {
  Back: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Academic: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Payment: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  WhatsApp: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Add: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
};

export default function StudentProfilePage({ params }) {
  const unwrappedParams = use(params);
  const studentId = unwrappedParams.id;
  const { showNotification } = useNotification();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState({ invested: 0, paid: 0, balance: 0 });

  const fetchStudentData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Perfil del Estudiante
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, roles(name)')
        .eq('id', studentId)
        .single();
      
      if (profileError) throw profileError;
      setStudent(profileData);

      // 2. Matrículas y Pagos (Consulta Unificada para Integridad Financiera)
      const { data: enrData, error: enrError } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses(title),
          payments(id, amount, created_at, notes)
        `)
        .eq('student_id', studentId);
      
      if (enrError) throw enrError;
      setEnrollments(enrData || []);

      // 3. Procesar Pagos (Aplanamos los pagos de todas las matrículas)
      const allPayments = (enrData || []).flatMap(enr => 
        (enr.payments || []).map(p => ({
          ...p,
          course_title: enr.courses?.title
        }))
      );
      
      // Ordenar cronológicamente (más recientes primero)
      const sortedPayments = allPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setPayments(sortedPayments);

      // 4. Calcular Totales (Fuente de Verdad: DB)
      const invested = enrData?.reduce((acc, curr) => acc + parseFloat(curr.total_price || 0), 0) || 0;
      const balance = enrData?.reduce((acc, curr) => acc + parseFloat(curr.remaining_balance || 0), 0) || 0;
      const paid = invested - balance;

      setTotals({ invested, paid, balance });

    } catch (err) {
      console.error('Error fetching student details:', err);
      showNotification('Error de integridad: ' + err.message, 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [studentId, showNotification]);

  useEffect(() => {
    fetchStudentData();

    // Tiempo Real: Escuchar cambios en saldos o pagos
    const channel = supabase.channel(`student-detail-${studentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchStudentData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => fetchStudentData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${studentId}` }, () => fetchStudentData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStudentData, studentId]);

  if (loading && !student) return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <div className="w-10 h-10 border-4 border-secondary-color border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Abriendo Expediente...</p>
    </div>
  );

  if (!student) return <div className="p-20 text-center font-black">Estudiante no encontrado.</div>;

  return (
    <div className="student-profile p-4 md:p-10 max-w-[1400px] mx-auto space-y-10 animate-fade-in font-display">
      <header className="flex flex-col md:flex-row justify-between items-start gap-8">
        <div className="space-y-6">
          <Link href="/coordinador/students" className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-primary-color hover:text-secondary-color transition-all">
            <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
              <Icons.Back />
            </div>
            Volver a Estudiantes
          </Link>
          
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 rounded-[32px] bg-primary-color text-white flex items-center justify-center text-4xl font-black shadow-2xl shadow-primary-color/20">
              {student.full_name?.substring(0,1)}
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none uppercase">{student.full_name}</h1>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary-color">Estudiante {student.student_type}</span>
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">ID: {student.id.slice(0,8).toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <Link 
            href={`/coordinador/students/enroll?id=${studentId}`}
            className="flex-1 md:flex-none px-8 py-5 bg-primary-color text-white rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-all shadow-xl shadow-primary-color/10 flex items-center justify-center gap-2"
          >
            <Icons.Add /> Nueva Matrícula
          </Link>
          <Link 
            href={`/coordinador/pagos?student=${studentId}`}
            className="flex-1 md:flex-none px-8 py-5 bg-white border border-gray-100 text-primary-color rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            💸 Registrar Abono
          </Link>
        </div>
      </header>

      {/* METRICAS FINANCIERAS DEL ALUMNO */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-1">
           <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Inversión Total</span>
           <h3 className="text-3xl font-black text-primary-color">${totals.invested.toLocaleString()}</h3>
        </div>
        <div className="bg-emerald-500 p-8 rounded-[40px] shadow-xl shadow-emerald-500/10 space-y-1">
           <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">Total Pagado</span>
           <h3 className="text-3xl font-black text-white">${totals.paid.toLocaleString()}</h3>
        </div>
        <div className={`p-8 rounded-[40px] shadow-sm space-y-1 ${totals.balance > 0 ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-slate-50 text-gray-400'}`}>
           <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">Saldo Pendiente</span>
           <h3 className="text-3xl font-black">${totals.balance.toLocaleString()}</h3>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* LADO IZQUIERDO: ACADEMICO */}
        <div className="lg:col-span-7 space-y-8">
           <div className="bg-white p-10 rounded-[56px] border border-gray-100 shadow-sm space-y-8">
              <header className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center"><Icons.Academic /></div>
                 <h2 className="text-2xl font-black text-primary-color tracking-tight italic">Trayectoria Académica</h2>
              </header>

              <div className="space-y-4">
                 {enrollments.length === 0 ? (
                   <div className="p-10 text-center bg-slate-50 rounded-[32px] text-gray-400 text-xs italic">Aún no tiene matrículas activas.</div>
                 ) : (
                   enrollments.map(enr => (
                     <div key={enr.id} className="p-6 bg-slate-50/50 rounded-[40px] border border-transparent hover:border-gray-200 transition-all group flex flex-col md:flex-row justify-between md:items-center gap-6">
                        <div className="flex items-center gap-5">
                           <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl">🎓</div>
                           <div>
                              <p className="text-md font-black text-primary-color uppercase leading-tight">{enr.courses?.title}</p>
                              <span className={`inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest mt-1 ${enr.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                {enr.status === 'active' ? 'Activo' : enr.status}
                              </span>
                           </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                           <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Saldo Curso</span>
                           <span className={`text-lg font-black ${enr.remaining_balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                             ${parseFloat(enr.remaining_balance).toLocaleString()}
                           </span>
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </div>

           {/* CAMPOS DE CONTACTO */}
           <div className="bg-slate-900 p-10 rounded-[56px] text-white space-y-8 overflow-hidden relative">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary-color/20 rounded-full blur-3xl"></div>
              <h3 className="text-xl font-black italic relative z-10">Información de Contacto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                 <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Email Registrado</span>
                    <p className="font-bold text-sm text-secondary-color truncate">{student.email || 'No registrado'}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">WhatsApp</span>
                    <div className="flex items-center gap-4">
                       <p className="font-bold text-sm">{student.whatsapp || student.phone || 'N/A'}</p>
                       {(student.whatsapp || student.phone) && (
                         <a href={`https://wa.me/57${student.whatsapp || student.phone}`} target="_blank" className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs hover:scale-110 transition-transform">
                            <Icons.WhatsApp />
                         </a>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* LADO DERECHO: PAGOS/FINANCIERO */}
        <div className="lg:col-span-5">
           <div className="bg-white p-10 rounded-[56px] border border-gray-100 shadow-sm space-y-8 sticky top-10">
              <header className="flex items-center justify-between border-b border-gray-50 pb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Icons.Payment /></div>
                    <h2 className="text-2xl font-black text-primary-color tracking-tight italic">Cronología de Pagos</h2>
                 </div>
                 <span className="px-5 py-2 bg-slate-50 rounded-full text-[9px] font-black text-gray-400 uppercase tracking-widest">{payments.length} Registros</span>
              </header>

              <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                 {payments.length === 0 ? (
                   <div className="p-20 text-center text-gray-300 italic text-xs">Aún no se registran pagos para este alumno.</div>
                 ) : (
                   payments.map(pay => (
                     <div key={pay.id} className="relative pl-10 before:absolute before:left-3 before:top-4 before:bottom-0 before:w-0.5 before:bg-slate-100 last:before:hidden">
                        <div className="absolute left-0 top-3 w-6 h-6 rounded-full bg-emerald-100 border-4 border-white shadow-sm flex items-center justify-center"></div>
                        <div className="p-6 bg-slate-50/50 rounded-[32px] space-y-2 group hover:bg-white hover:shadow-xl hover:shadow-emerald-500/5 transition-all">
                           <div className="flex justify-between items-start">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(pay.created_at).toLocaleDateString()}</span>
                              <span className="text-sm font-black text-emerald-600">+ ${parseFloat(pay.amount).toLocaleString()}</span>
                           </div>
                           <p className="text-[10px] font-bold text-primary-color uppercase truncate leading-tight">
                              {pay.enrollments?.courses?.title || 'Abono General'}
                           </p>
                           {pay.notes && <p className="text-[9px] italic text-gray-400 leading-none mt-1">"{pay.notes}"</p>}
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
      `}</style>
    </div>
  );
}
