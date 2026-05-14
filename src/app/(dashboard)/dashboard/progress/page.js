'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const Icons = {
  Badge: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15l-2 5 2 2 2-2-2-5z"/><circle cx="12" cy="7" r="4"/></svg>,
  ArrowRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
};

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ courses: 0, lessons: 0, exams: 0 });
  const [coursesProgress, setCoursesProgress] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [examHistory, setExamHistory] = useState([]);

  useEffect(() => {
    async function fetchProgressData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch Enrollments
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('id, course_id, courses(id, title, thumbnail_url)')
          .eq('student_id', user.id);

        if (!enrollments) return;

        // 2. Fetch All Progress info
        const { data: progress } = await supabase
          .from('progress')
          .select('lesson_id')
          .eq('student_id', user.id)
          .eq('is_completed', true);

        // 3. Fetch Exam Submissions (Rectified: Removed non-existent created_at column)
        const { data: submissions, error: subError } = await supabase
          .from('exam_submissions')
          .select('*, exams(title)')
          .eq('student_id', user.id);

        if (subError) console.error('💠 DB Debug (Logros):', subError.message);
        console.log('💠 DB Debug (Logros):', submissions?.length, 'registros recuperados.');

        // Calculate Stats & Fetch Suggestions
        const coursesWithData = [];
        const studySuggestions = [];

        for (const enr of enrollments) {
          const course = enr.courses;
          
          // Total lessons
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('id, modules!inner(course_id)', { count: 'exact', head: true })
            .eq('modules.course_id', course.id);

          // Completed lessons
          const { count: completedCount } = await supabase
            .from('progress')
            .select('id, lessons!inner(modules!inner(course_id))', { count: 'exact', head: true })
            .eq('student_id', user.id)
            .eq('lessons.modules.course_id', course.id)
            .eq('is_completed', true);

          const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

          coursesWithData.push({
            ...course,
            total: totalLessons || 0,
            completed: completedCount || 0,
            percent
          });

          // Fetch Next Lesson Suggestion if not finished
          if (percent < 100) {
            const { data: nextLesson } = await supabase
              .from('lessons')
              .select('id, title, modules!inner(id, course_id, order_index)')
              .eq('modules.course_id', course.id)
              .not('id', 'in', `(${progress.map(p => p.lesson_id).join(',') || '0'})`)
              .order('modules(order_index)', { ascending: true })
              .limit(1)
              .single();

            if (nextLesson) {
              studySuggestions.push({
                courseTitle: course.title,
                lessonTitle: nextLesson.title,
                courseId: course.id
              });
            }
          }
        }

        setStats({
          courses: enrollments.length,
          lessons: progress?.length || 0,
          exams: submissions?.filter(s => s.passed).length || 0
        });
        setCoursesProgress(coursesWithData);
        setSuggestions(studySuggestions.slice(0, 3)); 
        setExamHistory(submissions || []);
      } catch (error) {
        console.error('Error dashboard progress:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProgressData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 animate-pulse space-y-4">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-3xl">🧩</div>
      <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">Consultando Trayectoria Académica...</p>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-10 space-y-16 animate-fade-in relative overflow-hidden">
      
      {/* HEADER BENTO */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-8 space-y-2">
          <span className="text-[10px] font-black text-secondary-color uppercase tracking-[0.4em]">Dashboard Académico</span>
          <h1 className="text-5xl md:text-7xl font-black text-primary-color tracking-tighter leading-none font-display">
            Mi Progreso <span className="text-secondary-color">Elite</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl font-medium italic">Monitorea tu evolución, logros y próximos desafíos en tiempo real.</p>
        </div>
        <div className="lg:col-span-4 grid grid-cols-3 gap-4">
          {[
            { label: 'Cursos', val: stats.courses, color: 'text-primary-color' },
            { label: 'Clases', val: stats.lessons, color: 'text-secondary-color' },
            { label: 'Logros', val: stats.exams, color: 'text-accent-color' }
          ].map((item, i) => (
            <div key={i} className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm text-center">
              <h3 className={`text-2xl font-black ${item.color} leading-none`}>{item.val}</h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </header>

      {/* SUGERENCIAS (TARJETAS DINÁMICAS) */}
      {suggestions.length > 0 && (
        <section className="space-y-8">
           <div className="flex items-center gap-4">
              <div className="w-1.5 h-8 bg-accent-color rounded-full"></div>
              <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight font-display">Próximos Pasos</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {suggestions.map((sug, i) => (
                <Link key={i} href={`/dashboard/courses/${sug.courseId}`} className="group relative bg-primary-color p-8 rounded-[48px] overflow-hidden hover:scale-[1.02] transition-all shadow-xl shadow-primary-color/20">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[40px] -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                  <div className="relative z-10 space-y-4">
                    <span className="text-[8px] font-black uppercase tracking-widest text-secondary-color bg-white/10 px-3 py-1.2 rounded-full">Recomendado</span>
                    <h4 className="text-lg font-bold leading-snug text-white line-clamp-2">{sug.lessonTitle}</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{sug.courseTitle}</p>
                    <div className="pt-4 flex justify-end">
                       <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-secondary-color group-hover:text-primary-color transition-colors translate-x-4 group-hover:translate-x-0">
                          <Icons.ArrowRight />
                       </div>
                    </div>
                  </div>
                </Link>
              ))}
           </div>
        </section>
      )}

      {/* AVANCE POR PROGRAMA */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-secondary-color rounded-full"></div>
          <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight font-display">Programas en Proceso</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coursesProgress.length === 0 ? (
            <div className="col-span-2 p-20 border-2 border-dashed border-gray-100 rounded-[48px] text-center space-y-4">
               <span className="text-3xl text-gray-200 block">📚</span>
               <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No hay programas registrados</p>
            </div>
          ) : (
            coursesProgress.map((course) => (
              <div key={course.id} className="p-8 bg-white border border-gray-100 rounded-[48px] hover:shadow-2xl transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-4 h-full bg-secondary-color/5"></div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-black text-primary-color font-display leading-tight">{course.title}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{course.completed} de {course.total} lecciones dominadas</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                       <span className={`text-4xl font-black tracking-tighter ${course.percent === 100 ? 'text-emerald-500' : 'text-primary-color opacity-10'}`}>{course.percent}%</span>
                       {course.percent === 100 && <span className="bg-emerald-500 text-white p-2 rounded-full drop-shadow-lg"><Icons.Check/></span>}
                    </div>
                    <div className="h-2.5 bg-gray-50 rounded-full overflow-hidden">
                       <div className={`h-full transition-all duration-1000 ${course.percent === 100 ? 'bg-emerald-500' : 'bg-primary-color'}`} style={{ width: `${course.percent}%` }}></div>
                    </div>
                  </div>
                  <Link href={`/dashboard/courses/${course.id}`} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary-color hover:text-secondary-color transition-colors">
                    Continuar Programa <Icons.ArrowRight />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* HISTORIAL ACADÉMICO (PREMIUM FEED) */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary-color rounded-full"></div>
          <h2 className="text-2xl font-black text-primary-color uppercase tracking-tight font-display">Historial de Logros</h2>
        </div>
        
        <div className="space-y-4">
          {examHistory.length === 0 ? (
            <div className="p-20 bg-gray-50/50 rounded-[48px] text-center space-y-4">
               <span className="text-3xl grayscale block">🏆</span>
               <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Aún no has realizado exámenes. ¡Tu primer logro te espera!</p>
            </div>
          ) : (
            examHistory.map((sub) => (
              <div key={sub.id} className="bg-white border border-gray-100 p-8 rounded-[40px] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl transition-all relative group">
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-lg ${sub.passed ? 'bg-emerald-50 text-emerald-600 shadow-emerald-500/10' : 'bg-red-50 text-red-600 shadow-red-500/10'}`}>
                    {sub.passed ? '🥇' : '📑'}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-primary-color font-display lowercase first-letter:uppercase">{sub.exams?.title || 'Evaluación General'}</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {sub.created_at 
                        ? new Date(sub.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                        : `Intento #${sub.attempt_number || '1'}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-10 pr-4">
                   <div className="text-center">
                      <span className="block text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">Puntaje</span>
                      <span className={`text-2xl font-black ${sub.passed ? 'text-primary-color' : 'text-red-400'}`}>{sub.score}%</span>
                   </div>
                   <div className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${sub.passed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-red-100 text-red-600'}`}>
                      {sub.passed ? 'Aprobado' : 'Reprobado'}
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .font-display { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
