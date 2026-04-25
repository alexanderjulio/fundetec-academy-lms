'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useNotification } from '@/context/NotificationContext';

export default function StudentExamsListPage() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [examData, setExamData] = useState([]);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          course_id,
          courses ( title )
        `)
        .eq('student_id', session.user.id);

      if (!enrollments || enrollments.length === 0) {
        setExamData([]);
        setLoading(false);
        return;
      }

      const courseIds = enrollments.map(e => e.course_id);

      // 2. Fetch exams with max_attempts
      const { data: exams, error: examsError } = await supabase
        .from('exams')
        .select(`
          id,
          title,
          min_pass_score,
          max_attempts,
          modules!inner (
            id,
            title,
            course_id
          )
        `)
        .in('modules.course_id', courseIds);

      if (examsError) throw examsError;

      // 3. Fetch submissions for status and attempt counting
      const { data: submissions } = await supabase
        .from('exam_submissions')
        .select('exam_id, passed, score')
        .eq('student_id', session.user.id);

      // Group exams by course
      const grouped = enrollments.map(enr => {
        const courseExams = exams?.filter(ex => {
          const mod = Array.isArray(ex.modules) ? ex.modules[0] : ex.modules;
          return mod?.course_id === enr.course_id;
        }) || [];
        return {
          courseTitle: enr.courses.title,
          exams: courseExams.map(ex => {
            const mySubmissions = submissions?.filter(s => s.exam_id === ex.id) || [];
            return {
              ...ex,
              status: mySubmissions.some(s => s.passed) ? 'passed' : 
                     (mySubmissions.length > 0 ? 'failed' : 'pending'),
              bestScore: Math.max(0, ...(mySubmissions.map(s => s.score) || [0])),
              attemptsUsed: mySubmissions.length,
              remainingAttempts: ex.max_attempts ? Math.max(0, ex.max_attempts - mySubmissions.length) : null
            };
          })
        };
      }).filter(group => group.exams.length > 0);

      setExamData(grouped);
    } catch (error) {
      console.error('Error fetching exams:', error);
      showNotification('No se pudieron cargar tus exámenes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-pulse space-y-4">
        <div className="w-12 h-12 border-4 border-primary-color border-t-transparent rounded-full animate-spin"></div>
        <p className="text-primary-color font-bold tracking-widest text-xs uppercase">Preparando tus evaluaciones...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-20 space-y-24 animate-fade-in font-body">
      <header className="page-header relative pb-10 border-b border-gray-100">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-primary-color/5 blur-[80px] rounded-full"></div>
        <div className="relative z-10 space-y-3">
          <span className="text-xs font-black uppercase tracking-[0.4em] text-secondary-color">Certificación</span>
          <h1 className="text-5xl md:text-7xl font-black text-primary-color tracking-tighter leading-tight font-display">
            Mis Evaluaciones
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl font-medium">
            Completa tus exámenes para acreditar tus conocimientos en Fundetec Academy.
          </p>
        </div>
      </header>

      {examData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-gray-50/50 rounded-[48px] border border-dashed border-gray-200 space-y-8 animate-fade-in">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm">🏖️</div>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-primary-color">Todo al día</h3>
            <p className="text-gray-400 font-medium">No tienes exámenes pendientes en tus programas actuales.</p>
          </div>
          <Link 
            href="/dashboard/courses" 
            className="px-8 py-4 bg-primary-color text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary-color/20"
          >
            Explorar Cursos
          </Link>
        </div>
      ) : (
        <div className="space-y-24">
          {examData.map((group, idx) => (
            <section key={idx} className="space-y-12 animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
              <div className="flex items-center gap-6">
                 <h2 className="text-3xl font-black text-primary-color tracking-tight whitespace-nowrap">{group.courseTitle}</h2>
                 <div className="h-px bg-gray-100 flex-1"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {group.exams.map((exam) => (
                  <div 
                    key={exam.id} 
                    className={`group relative bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col justify-between min-h-[320px] ${exam.status === 'passed' ? 'hover:border-green-200' : 'hover:border-primary-color/20'}`}
                  >
                    <div className="space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                            {Array.isArray(exam.modules) ? exam.modules[0]?.title : exam.modules?.title}
                          </span>
                          <h3 className="text-2xl font-black text-primary-color leading-tight font-display">{exam.title}</h3>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${
                          exam.status === 'passed' ? 'bg-green-50 text-green-600 border-green-100' : 
                          exam.status === 'failed' ? 'bg-red-50 text-red-600 border-red-100' : 
                          'bg-gray-50 text-gray-400 border-gray-100'
                        }`}>
                          {exam.status === 'passed' ? 'Aprobado' : exam.status === 'failed' ? 'Reprobado' : 'Pendiente'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-6">
                        <div className="bg-gray-50/50 p-6 rounded-3xl space-y-1 border border-transparent group-hover:bg-white group-hover:border-gray-100 transition-colors">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Mejor Puntaje</span>
                          <p className={`text-2xl font-black ${exam.status === 'passed' ? 'text-green-500' : 'text-primary-color'}`}>{exam.bestScore}%</p>
                        </div>
                        <div className="bg-gray-50/50 p-6 rounded-3xl space-y-1 border border-transparent group-hover:bg-white group-hover:border-gray-100 transition-colors">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Requisito</span>
                          <p className="text-2xl font-black text-primary-color">{exam.min_pass_score}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-50 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${exam.remainingAttempts === 0 ? 'bg-red-500' : 'bg-secondary-color'}`}></div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Intentos</span>
                        </div>
                        <p className="text-xs font-black text-primary-color">
                          {exam.max_attempts ? `${exam.attemptsUsed} de ${exam.max_attempts}` : `${exam.attemptsUsed} realizados`}
                        </p>
                      </div>

                      <Link 
                        href={`/dashboard/exams/${exam.id}`}
                        className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                          exam.status === 'passed' 
                            ? 'bg-white text-primary-color border border-primary-color/10 hover:bg-gray-50' 
                            : 'bg-primary-color text-white shadow-primary-color/20 hover:scale-105 active:scale-95'
                        } ${exam.remainingAttempts === 0 && exam.status !== 'passed' ? 'opacity-50 pointer-events-none grayscale' : ''}`}
                      >
                        {exam.status === 'passed' ? 'Repasar' : 'Comenzar'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <style jsx>{`
        .animate-fade-in { animation: fade-in 1s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
