'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function StudentDashboardHome() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        // Fetch enrollments with course details
        const { data } = await supabase
          .from('enrollments')
          .select(`
            *,
            courses (
              id,
              title,
              thumbnail_url,
              description
            )
          `)
          .eq('student_id', authUser.id);
        
        // Fetch real progress for each course
        const enrollmentsWithProgress = await Promise.all((data || []).map(async (enr) => {
          // Get total lessons for this course
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('id, modules!inner(course_id)', { count: 'exact', head: true })
            .eq('modules.course_id', enr.course_id);

          // Get completed lessons
          const { count: completedLessons } = await supabase
            .from('progress')
            .select('id, lessons!inner(modules!inner(course_id))', { count: 'exact', head: true })
            .eq('student_id', authUser.id)
            .eq('lessons.modules.course_id', enr.course_id)
            .eq('is_completed', true);

          const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
          return { ...enr, progress };
        }));

        setEnrollments(enrollmentsWithProgress);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resumeCourse = enrollments.length > 0 
    ? [...enrollments].sort((a, b) => b.progress - a.progress)[0] 
    : null;

  return (
    <div className="student-home max-w-[1400px] mx-auto p-4 md:p-10 space-y-12">
      <header className="dashboard-hero bg-primary-color text-white p-10 md:p-16 rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-secondary-color/20 to-transparent"></div>
        <div className="relative z-10 space-y-4 max-w-xl">
          <span className="text-secondary-color text-xs font-black uppercase tracking-[0.3em]">Panel de Estudiante</span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">
            ¡Hola, {user?.user_metadata?.full_name?.split(' ')[0] || 'de nuevo'}! 👋
          </h1>
          <p className="text-lg text-white/70 font-medium">
            Tienes {enrollments.length} {enrollments.length === 1 ? 'diplomado activo' : 'diplomados activos'}. Es un excelente momento para avanzar en tu carrera profesional.
          </p>
          <div className="pt-4 flex gap-4">
            <Link href="/dashboard/courses" className="bg-secondary-color text-primary-color px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-secondary-color/20">
              Ver Catálogo
            </Link>
          </div>
        </div>
        
        {resumeCourse && (
          <div className="resume-widget relative z-10 w-full max-w-sm glass-card-white p-6 rounded-[32px] border border-white/20 shadow-2xl backdrop-blur-xl animate-fade-in">
             <span className="text-[10px] font-black uppercase tracking-widest text-primary-color/40 block mb-4">Continuar últimamente:</span>
             <h3 className="text-primary-color text-lg font-black leading-tight mb-4">{resumeCourse.courses?.title}</h3>
             <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs font-black text-primary-color">
                   <span>Tu Progreso Actual</span>
                   <span className="text-secondary-color">{resumeCourse.progress}%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                   <div className="h-full bg-secondary-color rounded-full" style={{ width: `${resumeCourse.progress}%` }}></div>
                </div>
             </div>
             <Link href={`/dashboard/courses/${resumeCourse.course_id}`} className="block text-center bg-primary-color text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary-color hover:text-primary-color transition-colors">
                Retomar Lección 🚀
             </Link>
          </div>
        )}
      </header>

      <section className="active-learning space-y-8">
        <div className="flex items-center justify-between px-4">
           <h2 className="text-3xl font-black text-primary-color tracking-tight">Tus Diplomados</h2>
           <Link href="/dashboard/courses" className="text-sm font-black text-secondary-color hover:underline">Ver todos los cursos →</Link>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <div key={i} className="h-[450px] bg-gray-50 rounded-[40px] animate-pulse"></div>)}
          </div>
        ) : enrollments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
            {enrollments.map((enr) => (
              <div key={enr.id} className="small-course-card glass-card-pure p-6 rounded-[40px] border border-white shadow-xl hover:-translate-y-2 transition-transform duration-500 flex flex-col">
                <div className="thumb relative h-48 rounded-[30px] overflow-hidden mb-6">
                   <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${enr.courses?.thumbnail_url || 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=600'})` }}></div>
                   <div className="absolute top-3 right-3">
                      <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black uppercase text-primary-color tracking-widest shadow-lg">
                        {enr.progress}% Completado
                      </span>
                   </div>
                </div>
                <h3 className="text-xl font-black text-primary-color mb-4 leading-tight flex-1">{enr.courses?.title}</h3>
                <Link href={`/dashboard/courses/${enr.course_id}`} className="bg-gray-100/50 text-primary-color text-center py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-color hover:text-white transition-all">
                  Abrir Malla Curricular
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state-home glass-card-pure p-20 text-center rounded-[48px] border border-white shadow-2xl max-w-2xl mx-auto">
            <span className="text-6xl mb-6 block">🎓</span>
            <h3 className="text-2xl font-black text-primary-color mb-2">Comienza tu formación hoy</h3>
            <p className="text-gray-500 mb-8 font-medium">Aún no tienes suscripciones activas. Explora nuestra oferta académica y elige tu próximo paso profesional.</p>
            <Link href="/dashboard/courses" className="btn btn-primary px-10 py-4 rounded-2xl font-black">Explorar Oferta Académica</Link>
          </div>
        )}
      </section>

      <div className="widgets-grid grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="widget-card glass-card-pure p-10 rounded-[48px] border border-white shadow-xl hover:shadow-2xl transition-shadow">
          <div className="w-14 h-14 bg-secondary-color/10 text-secondary-color rounded-2xl flex items-center justify-center text-2xl mb-6">📝</div>
          <h3 className="text-2xl font-black text-primary-color mb-2">Exámenes Próximos</h3>
          <p className="text-gray-400 font-medium">No tienes evaluaciones pendientes por realizar en este momento.</p>
        </div>
        <div className="widget-card glass-card-pure p-10 rounded-[48px] border border-white shadow-xl hover:shadow-2xl transition-shadow">
          <div className="w-14 h-14 bg-primary-color/5 text-primary-color rounded-2xl flex items-center justify-center text-2xl mb-6">🔔</div>
          <h3 className="text-2xl font-black text-primary-color mb-2">Notificaciones</h3>
          <p className="text-gray-400 font-medium">Te damos la bienvenida oficial a Fundetec Academy: Tu aula virtual premium.</p>
        </div>
      </div>

      <style jsx>{`
        .glass-card-white {
           background: rgba(255, 255, 255, 0.9);
           border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .glass-card-pure {
           background: rgba(255, 255, 255, 0.6);
           backdrop-filter: blur(20px);
           box-shadow: 0 15px 40px rgba(12, 30, 69, 0.05);
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.8s ease-out both 0.5s; }
      `}</style>
    </div>
  );
}
