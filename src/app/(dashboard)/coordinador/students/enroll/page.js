'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

const Icons = {
  Back: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Course: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  Money: () => <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="8" y1="12" x2="8.01" y2="12"/></svg>,
  Info: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Chevron: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
};

function EnrollmentForm() {
  const { showNotification } = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [negotiatedPrice, setNegotiatedPrice] = useState('');
  const [initialPayment, setInitialPayment] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function init() {
      if (!studentId) return;
      
      const { data: studentData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();
      
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(myProfile?.role_id === 1);
      }

      setStudent(studentData);
      setCourses(coursesData || []);
      setLoading(false);
    }
    init();
  }, [studentId]);

  const handleCourseSelect = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    setSelectedCourse(course);
    setNegotiatedPrice(course.price.toString());
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data: enrollment, error: enrError } = await supabase
        .from('enrollments')
        .insert({
          student_id: studentId,
          course_id: selectedCourse.id,
          status: 'active',
          total_price: parseFloat(negotiatedPrice),
          remaining_balance: parseFloat(negotiatedPrice) - parseFloat(initialPayment)
        })
        .select()
        .single();

      if (enrError) throw enrError;

      if (parseFloat(initialPayment) > 0) {
        await supabase
          .from('payments')
          .insert({
            enrollment_id: enrollment.id,
            amount: parseFloat(initialPayment),
            payment_method: 'efectivo',
            notes: 'Cuota inicial de matrícula',
            registered_by: session.user.id
          });
      }

      showNotification('🚀 Matrícula procesada y confirmada.', 'success');
      router.push(isAdmin ? '/admin/users' : '/coordinador/students');
    } catch (err) {
      console.error(err);
      showNotification('Error en matrícula: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-12 h-12 border-4 border-secondary-color border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Preparando Registro...</p>
    </div>
  );
  
  if (!student) return <div className="p-20 text-center font-black text-primary-color uppercase tracking-widest">Estudiante no identificado.</div>;

  return (
    <div className="enroll-page p-4 md:p-10 max-w-[1400px] mx-auto space-y-10 animate-fade-in font-display">
      <nav className="mb-4">
        <Link href={isAdmin ? "/admin/users" : "/coordinador/students"} className="inline-flex items-center gap-3 pl-2 pr-6 py-2 bg-white rounded-full border border-gray-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-primary-color hover:text-secondary-color hover:border-gray-200 transition-all">
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-primary-color">
            <Icons.Back />
          </div>
          <span className="hidden md:inline">Volver al Directorio</span>
          <span className="md:hidden">Volver</span>
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <header className="space-y-4">
            <span className="px-4 py-2 bg-secondary-color/10 text-secondary-color rounded-full text-[9px] font-black uppercase tracking-widest">Admisiones Academia</span>
            <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tighter leading-none">
              Matricular a <span className="underline decoration-secondary-color/30 decoration-8">{student.full_name}</span>
            </h1>
            <p className="text-gray-400 font-medium italic">Configura las condiciones financieras para el ingreso al programa.</p>
          </header>

          <form onSubmit={handleEnroll} className="space-y-8">
            <section className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8 relative overflow-hidden">
               <div className="space-y-6">
                 <div className="flex items-center gap-4 border-b border-gray-50 pb-6">
                    <div className="w-12 h-12 bg-primary-color text-white rounded-2xl flex items-center justify-center"><Icons.Course /></div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary-color">Selección de Programa Académico</h3>
                 </div>
                 
                 <div className="grid gap-6">
                    <div className="space-y-2 relative">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Programa / Diplomado</label>
                      <select 
                        required 
                        onChange={(e) => handleCourseSelect(e.target.value)}
                        value={selectedCourse?.id || ''}
                        className="w-full bg-slate-50 border-none p-4 md:p-6 pr-12 rounded-[20px] md:rounded-[28px] outline-none focus:ring-4 focus:ring-secondary-color/10 font-bold text-sm md:text-base text-primary-color cursor-pointer appearance-none shadow-inner"
                      >
                        <option value="">-- Selecciona un programa --</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.title} - ${c.price.toLocaleString()}</option>
                        ))}
                      </select>
                      <div className="absolute right-5 bottom-[18px] md:bottom-[26px] pointer-events-none opacity-40 text-primary-color">
                         <Icons.Chevron />
                      </div>
                    </div>
                 </div>
               </div>

               {selectedCourse && (
                 <div className="space-y-8 animate-fade-in pt-6">
                    <div className="flex items-center gap-4 border-b border-gray-50 pb-6">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center"><Icons.Money /></div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-primary-color">Acuerdo de Pago & Inversion</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Costo Pactado (Final)</label>
                            <div className="relative group">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-300">$</span>
                                <input 
                                  type="number" required 
                                  value={negotiatedPrice}
                                  onChange={(e) => setNegotiatedPrice(e.target.value)}
                                  className="w-full bg-slate-50 border-none p-6 pl-12 rounded-[28px] outline-none focus:ring-4 focus:ring-secondary-color/10 font-black text-xl text-primary-color shadow-inner"
                                />
                            </div>
                            <p className="text-[9px] font-bold text-gray-400 ml-4 italic">Precio base sugerido: ${selectedCourse.price.toLocaleString()}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Abono Inicial (Hoy)</label>
                            <div className="relative group">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-emerald-300">$</span>
                                <input 
                                  type="number" required 
                                  value={initialPayment}
                                  onChange={(e) => setInitialPayment(e.target.value)}
                                  className="w-full bg-emerald-50/30 border-none p-6 pl-12 rounded-[28px] outline-none focus:ring-4 focus:ring-emerald-500/10 font-black text-xl text-emerald-600 shadow-inner"
                                />
                            </div>
                            <p className="text-[9px] font-bold text-emerald-600/50 ml-4 italic">Este monto se restará del total pactado.</p>
                        </div>
                    </div>
                 </div>
               )}
            </section>

            {selectedCourse && (
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-primary-color text-white p-8 rounded-[32px] font-black text-xs uppercase tracking-[0.3em] hover:bg-secondary-color hover:text-primary-color transition-all shadow-2xl shadow-primary-color/20 flex items-center justify-center gap-4 group"
              >
                {submitting ? 'Formalizando Registro...' : 'Confirmar Matrícula Académica'}
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-primary-color group-hover:text-white transition-all">
                    <Icons.Check />
                </div>
              </button>
            )}
          </form>
        </div>

        <aside className="lg:col-span-4 space-y-8">
            <div className="bg-white p-10 rounded-[56px] border border-gray-100 shadow-xl space-y-8 sticky top-10">
                <header className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-2xl shadow-inner italic font-black text-primary-color">
                        {student.full_name?.substring(0,1)}
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xl font-black text-primary-color">{student.full_name}</h4>
                        <p className="text-[10px] font-black uppercase text-secondary-color tracking-widest">Ficha de Inscripción</p>
                    </div>
                </header>

                <div className="space-y-6">
                    <div className="p-8 bg-slate-50 rounded-[40px] border border-gray-100 space-y-6">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-4">Resumen Financiero</h5>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-bold text-gray-400">
                                <span>Inversión</span>
                                <span>${parseFloat(negotiatedPrice || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-500">
                                <span>Abono hoy</span>
                                <span>-${parseFloat(initialPayment || 0).toLocaleString()}</span>
                            </div>
                            <div className="pt-4 border-t border-gray-200 flex justify-between items-end">
                                <div className="space-y-1">
                                    <span className="block text-[8px] font-black uppercase text-gray-300 tracking-[0.2em]">Saldo Pendiente</span>
                                    <span className="text-2xl font-black text-primary-color">
                                        ${(parseFloat(negotiatedPrice || 0) - parseFloat(initialPayment || 0)).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 px-4">
                         <div className="flex gap-4 items-start">
                             <div className="mt-1 text-emerald-500"><Icons.Info /></div>
                             <p className="text-[11px] font-medium leading-relaxed text-gray-400">La matrícula genera una deuda automática en el **Libro Mayor** del estudiante que podrá ser auditada por administración.</p>
                         </div>
                    </div>
                </div>
            </div>
        </aside>
      </div>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}

export default function EnrollmentPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center animate-pulse text-[10px] font-black uppercase tracking-widest text-gray-300">Cargando Plataforma...</div>}>
      <EnrollmentForm />
    </Suspense>
  );
}
