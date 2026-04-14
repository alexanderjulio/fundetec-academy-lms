'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [completedExams, setCompletedExams] = useState(new Set());

  useEffect(() => {
    async function fetchCourseData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch course info
        const { data: courseData } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();

        // Fetch modules, lessons and EXAMS
        const { data: modulesData } = await supabase
          .from('modules')
          .select(`
            id,
            title,
            lessons (
              id,
              title,
              content_type,
              content_url
            ),
            exams (
              id,
              title
            )
          `)
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        // Fetch student progress
        const { data: progressData } = await supabase
          .from('progress')
          .select('lesson_id')
          .eq('student_id', session.user.id)
          .eq('is_completed', true);

        // Fetch exam submissions to show status
        const { data: submissionsData } = await supabase
          .from('exam_submissions')
          .select('exam_id, passed')
          .eq('student_id', session.user.id);

        setCourse(courseData);
        setModules(modulesData || []);
        setCompletedLessons(new Set(progressData?.map(p => p.lesson_id) || []));
        setCompletedExams(new Set(submissionsData?.filter(s => s.passed).map(s => s.exam_id) || []));
      } catch (error) {
        console.error('Error fetching course detail:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCourseData();
  }, [courseId]);

  if (loading) return <div className="p-10 text-center">Cargando malla curricular...</div>;
  if (!course) return <div className="p-10 text-center">Curso no encontrado.</div>;

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons.size / totalLessons) * 100) : 0;

  return (
    <div className="course-detail-container px-4 py-8 max-w-7xl mx-auto">
      <nav className="breadcrumb mb-8">
        <Link href="/dashboard/courses" className="back-link group">
          <span className="icon group-hover:-translate-x-1 transition-transform inline-block mr-2">←</span>
          Volver a Mis Cursos
        </Link>
      </nav>

      <header className="course-hero glass-card overflow-hidden mb-12 border-none shadow-2xl relative">
        <div className="hero-gradient absolute inset-0 opacity-10"></div>
        <div className="hero-content relative z-10 p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="info-side max-w-2xl">
            <span className="course-badge text-xs font-black uppercase tracking-[0.2em] px-3 py-1 bg-white/20 rounded-full mb-4 inline-block">
              Diplomado Certificado
            </span>
            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight tracking-tight text-white drop-shadow-sm">
              {course.title}
            </h1>
            <div 
              className="text-lg opacity-90 text-white/90 leading-relaxed mb-8 max-w-xl"
              dangerouslySetInnerHTML={{ __html: course.description }}
            />

            <div className="overall-progress-container w-full max-w-md">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-white/80 uppercase tracking-wider">Avance del Curso </span>
                <span className="text-2xl font-black text-white">{progressPercent}%</span>
              </div>
              <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-secondary-color transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="stats-side flex gap-6">
            <div className="stat-glass text-center p-6 rounded-3xl min-w-[140px]">
              <span className="text-3xl font-black block mb-1">{totalLessons}</span>
              <span className="text-xs uppercase font-bold opacity-70 tracking-widest"> Lecciones</span>
            </div>
            <div className="stat-glass text-center p-6 rounded-3xl min-w-[140px] border-secondary-color/30 border">
              <span className="text-3xl font-black block mb-1 text-secondary-color">{completedLessons.size}</span>
              <span className="text-xs uppercase font-bold opacity-70 tracking-widest text-secondary-color"> Logros</span>
            </div>
          </div>
        </div>
      </header>

      <div className="curriculum-grid glass-card py-8 px-4">
        <div className="section-title-wrap mb-8 flex items-center gap-4">
          <div className="h-8 w-2 bg-secondary-color rounded-full"></div>
          <h2 className="text-2xl font-black text-primary-color tracking-tight">Malla Curricular</h2>
        </div>

        <div className="modules-stack space-y-8">
          {modules.map((module, mIdx) => (
            <div key={module.id} className="module-card glass-card-premium overflow-hidden border border-white/40">
              <div className="module-header flex items-center justify-between p-6 bg-gray-50/50 border-bottom border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="mod-number bg-primary-color text-white w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm">
                    {mIdx + 1}
                  </div>
                  <h3 className="text-xl font-bold text-primary-color">{module.title}</h3>
                </div>
                <span className="text-xs font-bold text-gray-400">
                  {module.lessons.length} LECCIONES · {module.exams?.length || 0} EXAMEN
                </span>
              </div>

              <div className="lessons-list">
                {module.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/dashboard/lessons/${courseId}/${lesson.id}`}
                    className="lesson-interactive-row group flex items-center justify-between p-5 transition-all hover:bg-white/60 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`status-indicator w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${completedLessons.has(lesson.id) ? 'bg-success border-success text-white' : 'border-gray-200 text-transparent group-hover:border-primary-color/30'}`}>
                        {completedLessons.has(lesson.id) && <span className="text-xs font-bold">✓</span>}
                      </div>
                      <div className="l-main text-left">
                        <p className="text-base font-bold text-gray-800 group-hover:text-primary-color transition-colors line-clamp-1">{lesson.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            {lesson.content_type === 'video' ? 'Video-Clase' : lesson.content_type === 'reading' ? 'Lectura Enriquecida' : 'Material Descargable'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="l-action opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-secondary-color font-black text-sm uppercase">
                      <span>Comenzar</span>
                      <span className="text-xl">→</span>
                    </div>
                  </Link>
                ))}

                {/* Exámenes */}
                {module.exams && module.exams.map((exam) => (
                  <Link
                    key={exam.id}
                    href={`/dashboard/exams/${exam.id}`}
                    className="exam-interactive-row group flex items-center justify-between p-6 bg-secondary-color/5 hover:bg-secondary-color/10 border-t border-secondary-color/10 transition-all font-bold"
                  >
                    <div className="flex items-center gap-5">
                      <div className="exam-status-icon w-8 h-8 rounded-lg bg-secondary-color text-primary-color flex items-center justify-center shadow-lg">
                        {completedExams.has(exam.id) ? '🏆' : '📝'}
                      </div>
                      <div className="e-main">
                        <p className="text-primary-color">EVALUACIÓN: {exam.title}</p>
                        <p className="text-[10px] text-secondary-color uppercase tracking-widest font-black">Certificación de Módulo</p>
                      </div>
                    </div>
                    <div className="e-action flex items-center gap-2 text-primary-color text-sm uppercase font-black">
                      <span>Iniciar Examen</span>
                      <span className="animate-pulse">🚀</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .course-hero { 
          background: linear-gradient(225deg, var(--primary-color), var(--primary-light));
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
        }
        .stat-glass {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .module-card {
           background: rgba(255, 255, 255, 0.4);
           backdrop-filter: blur(8px);
           border-radius: 24px;
           box-shadow: var(--shadow-sm);
           transition: all 0.3s ease;
        }
        .module-card:hover {
           box-shadow: var(--shadow-md);
           transform: translateY(-2px);
           border-color: var(--primary-color-20);
        }
        .lesson-interactive-row { border-bottom: 1px solid var(--gray-50); }
        .lesson-interactive-row:last-child { border-bottom: none; }
        
        .back-link { font-family: 'Outfit', sans-serif; font-weight: 700; color: var(--primary-color); text-decoration: none; font-size: 0.95rem; }
        
        :global(.bg-secondary-color) { background-color: var(--secondary-color) !important; }
        :global(.text-secondary-color) { color: var(--secondary-color) !important; }
        :global(.text-primary-color) { color: var(--primary-color) !important; }
        :global(.bg-primary-color) { background-color: var(--primary-color) !important; }
        :global(.bg-success) { background-color: var(--success) !important; }
        :global(.border-secondary-color) { border-color: var(--secondary-color) !important; }

        @media (max-width: 768px) {
           .hero-content { text-align: center; }
           .stats-side { width: 100%; justify-content: center; }
           .stat-glass { flex: 1; }
        }
      `}</style>
    </div>
  );
}
