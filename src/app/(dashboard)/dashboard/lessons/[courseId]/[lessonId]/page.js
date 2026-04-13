'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function LessonPlayerPage() {
  const { courseId, lessonId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [allLessons, setAllLessons] = useState([]);
  const [completedLessons, setCompletedLessons] = useState([]);

  useEffect(() => {
    async function fetchLessonData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch current lesson
        const { data: lessonData } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single();

        // Fetch course info
        const { data: courseData } = await supabase
          .from('courses')
          .select('title')
          .eq('id', courseId)
          .single();

        // Fetch modules and lessons for the sidebar
        const { data: modulesData } = await supabase
          .from('modules')
          .select(`
            id,
            title,
            lessons (
              id,
              title,
              content_type,
              order_index
            )
          `)
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        // Flatten lessons for navigation
        const flatLessons = modulesData?.reduce((acc, mod) => {
          const sortedLessons = mod.lessons.sort((a, b) => a.order_index - b.order_index);
          return [...acc, ...sortedLessons];
        }, []) || [];

        // Check if current is completed and get ALL completed lessons for indicators
        const { data: progressData } = await supabase
          .from('progress')
          .select('lesson_id, is_completed')
          .eq('student_id', session.user.id)
          .eq('is_completed', true);

        const currentCompleted = progressData?.some(p => p.lesson_id === lessonId);
        const completedIds = progressData?.map(p => p.lesson_id) || [];

        setLesson(lessonData);
        setCourse(courseData);
        setModules(modulesData || []);
        setAllLessons(flatLessons);
        setIsCompleted(currentCompleted);
        setCompletedLessons(completedIds);
      } catch (error) {
        console.error('Error fetching lesson:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLessonData();
  }, [courseId, lessonId]);

  const handleToggleComplete = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newStatus = !isCompleted;

      const { error } = await supabase
        .from('progress')
        .upsert({
          student_id: session.user.id,
          lesson_id: lessonId,
          is_completed: newStatus,
          completed_at: newStatus ? new Date().toISOString() : null
        }, { onConflict: 'student_id, lesson_id' });

      if (error) throw error;
      setIsCompleted(newStatus);
      if (newStatus) setCompletedLessons([...completedLessons, lessonId]);
      else setCompletedLessons(completedLessons.filter(id => id !== lessonId));
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  if (loading) return <div className="p-10 text-center">Iniciando aula virtual...</div>;
  if (!lesson) return <div className="p-10 text-center">Contenido no disponible.</div>;

  const currentIdx = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = allLessons[currentIdx - 1];
  const nextLesson = allLessons[currentIdx + 1];

  // Helper to format YouTube URLs
  const getEmbedUrl = (url) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
    return url;
  };

  const progressPercent = allLessons.length > 0 ? Math.round((completedLessons.length / allLessons.length) * 100) : 0;

  return (
    <div className="virtual-classroom bg-[#f0f4f8] min-h-screen">
      <header className="classroom-header h-20 bg-primary-color flex items-center justify-between px-8 shadow-xl sticky top-0 z-50 border-b border-white/10">
        <Link href={`/dashboard/courses/${courseId}`} className="classroom-back group flex items-center gap-3 text-white no-underline">
          <div className="back-icon bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-all">
            <span className="text-xl">←</span>
          </div>
          <div className="back-labels">
            <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Volver al Diplomado</span>
            <p className="font-bold text-sm tracking-tight line-clamp-1">{course?.title}</p>
          </div>
        </Link>
        <div className="classroom-progress hidden md:flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase font-black text-white/40 block leading-none mb-1">Tu Progreso</span>
            <span className="text-white font-black">{progressPercent}%</span>
          </div>
          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-secondary-color" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </header>

      <div className="classroom-body flex flex-col lg:flex-row gap-8 p-6 lg:p-10 max-w-[1800px] mx-auto">
        <main className="classroom-content flex-1 max-w-full">
          <div className="content-stage mb-10">
            {lesson.content_type === 'video' ? (
              <div className="premium-video-stage shadow-2xl rounded-[32px] overflow-hidden border-4 border-white aspect-video relative bg-black">
                {lesson.content_url ? (
                  <iframe
                    src={getEmbedUrl(lesson.content_url)}
                    title={lesson.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center flex-col text-white gap-4">
                    <span className="text-4xl">🎞️</span>
                    <p className="font-bold opacity-60">El video estará disponible pronto...</p>
                  </div>
                )}
              </div>
            ) : lesson.content_type === 'reading' ? (
              <article className="premium-reading-stage glass-card-pure p-8 md:p-16 rounded-[40px] shadow-xl animate-fade-in max-w-[960px] mx-auto border border-white">
                <header className="reading-meta mb-12 text-center">
                  <span className="inline-block py-1 px-4 bg-secondary-color/10 text-secondary-color text-xs font-black uppercase tracking-[0.3em] rounded-full mb-4">
                    Módulo de Lectura
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black text-primary-color tracking-tight leading-tight">
                    {lesson.title}
                  </h1>
                </header>
                <div
                  className="prose-premium"
                  dangerouslySetInnerHTML={{ __html: lesson.content || '<p className="text-center opacity-50">Contenido en redacción...</p>' }}
                ></div>
              </article>
            ) : (
              <div className="premium-file-stage glass-card-pure p-16 rounded-[40px] text-center border-2 border-dashed border-primary-color/20">
                <div className="w-24 h-24 bg-primary-color/5 text-primary-color rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6">
                  📄
                </div>
                <h2 className="text-3xl font-black text-primary-color mb-3">Recurso de Aprendizaje</h2>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto">Esta lección contiene material complementario para profundizar en tus conocimientos.</p>
                <a
                  href={lesson.content_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-lg transition-transform hover:scale-105"
                >
                  Descargar Material <span>📥</span>
                </a>
              </div>
            )}
          </div>

          <section className="classroom-footer glass-card-pure p-8 md:p-10 rounded-[40px] border border-white flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="lesson-info-footer">
              <span className="text-xs font-black uppercase tracking-widest text-primary-color/40 block mb-2">Estás estudiando:</span>
              <h2 className="text-2xl font-black text-primary-color tracking-tight line-clamp-1">{lesson.title}</h2>
            </div>
            <div className="lesson-actions flex items-center gap-4">
              <button
                onClick={handleToggleComplete}
                className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${isCompleted ? 'bg-success text-white shadow-success/40' : 'bg-primary-color text-white shadow-primary-color/20'} shadow-lg hover:-translate-y-1 active:scale-95`}
              >
                {isCompleted ? '✓ Completada' : 'Finalizar Lección'}
              </button>
            </div>
          </section>

          <nav className="classroom-navigation mt-10 grid grid-cols-2 gap-6">
            {prevLesson ? (
              <Link href={`/dashboard/lessons/${courseId}/${prevLesson.id}`} className="nav-card glass-card-pure p-6 rounded-3xl group border border-white hover:border-gray-200 transition-all flex items-center gap-4">
                <div className="nav-dir-icon w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center group-hover:bg-primary-color group-hover:text-white transition-all">←</div>
                <div className="nav-text">
                  <span className="text-[10px] font-black uppercase text-gray-400">Lección Anterior</span>
                  <p className="font-bold text-gray-800 line-clamp-1">{prevLesson.title}</p>
                </div>
              </Link>
            ) : <div />}

            {nextLesson ? (
              <Link href={`/dashboard/lessons/${courseId}/${nextLesson.id}`} className="nav-card glass-card-pure p-6 rounded-3xl group border border-white hover:border-gray-200 transition-all flex items-center gap-4 justify-end text-right">
                <div className="nav-text">
                  <span className="text-[10px] font-black uppercase text-gray-400">Siguiente Lección</span>
                  <p className="font-bold text-primary-color line-clamp-1">{nextLesson.title}</p>
                </div>
                <div className="nav-dir-icon w-12 h-12 rounded-2xl bg-secondary-color flex items-center justify-center text-primary-color font-bold group-hover:scale-110 transition-all">→</div>
              </Link>
            ) : (
              <div className="nav-card glass-card-pure p-6 rounded-3xl border border-secondary-color/20 flex items-center justify-center gap-3 bg-secondary-color/5">
                <span className="text-xl">🎓</span>
                <p className="font-black text-primary-color uppercase text-xs tracking-widest">Fin del Módulo</p>
              </div>
            )}
          </nav>
        </main>

        <aside className="classroom-sidebar w-full lg:w-[420px] shrink-0">
          <div className="sidebar-container glass-card-pure rounded-[40px] border border-white overflow-hidden sticky top-32 flex flex-col max-h-[calc(100vh-160px)] shadow-2xl">
            <header className="sidebar-head p-8 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-black text-primary-color uppercase text-sm tracking-[0.2em] mb-4">Contenido del Diplomado</h3>
              <div className="sidebar-progress-full">
                <div className="flex justify-between items-end text-[10px] font-black uppercase text-gray-400 mb-2">
                  <span>Tu Avance</span>
                  <span className="text-success">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-success transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
            </header>

            <div className="sidebar-body overflow-y-auto p-4 custom-scrollbar">
              {modules.map((mod, mIdx) => (
                <div key={mod.id} className="module-group mb-6">
                  <h4 className="px-4 text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="text-primary-color opacity-30">#0{mIdx + 1}</span> {mod.title}
                  </h4>
                  <div className="lesson-items-stack space-y-1">
                    {mod.lessons.sort((a, b) => a.order_index - b.order_index).map((l) => (
                      <Link
                        key={l.id}
                        href={`/dashboard/lessons/${courseId}/${l.id}`}
                        className={`lesson-item-sidebar flex items-center gap-4 p-4 rounded-2xl transition-all ${l.id === lessonId ? 'bg-primary-color text-white shadow-lg shadow-primary-color/20' : 'hover:bg-gray-100 text-gray-600'}`}
                      >
                        <div className={`l-status w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${l.id === lessonId ? 'border-secondary-color text-secondary-color bg-white/10' : (completedLessons.includes(l.id) ? 'bg-success border-success text-white' : 'border-gray-200 text-transparent')}`}>
                          {completedLessons.includes(l.id) && '✓'}
                        </div>
                        <div className="l-content flex-1 max-w-[200px]">
                          <p className="text-xs font-bold leading-tight line-clamp-2">{l.title}</p>
                          <span className={`text-[9px] uppercase font-black tracking-tighter mt-1 block opacity-60 ${l.id === lessonId ? 'text-secondary-color' : ''}`}>
                            {l.content_type === 'video' ? 'Película Instruccional' : l.content_type === 'reading' ? 'Módulo de Lectura' : 'Documento Técnico'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .glass-card-pure {
           background: rgba(255, 255, 255, 0.7);
           backdrop-filter: blur(20px);
           box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
        }
        .prose-premium :global(p) { margin-bottom: 2rem; color: var(--gray-700); font-size: 1.15rem; line-height: 1.9; }
        .prose-premium :global(h2) { font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; color: var(--primary-color); margin: 3rem 0 1.5rem; letter-spacing: -0.02em; }
        .prose-premium :global(img) { border-radius: 24px; margin: 3rem 0; box-shadow: var(--shadow-xl); }
        .prose-premium :global(blockquote) { border-left: 6px solid var(--secondary-color); padding: 2rem; background: var(--gray-50); border-radius: 12px 24px 24px 12px; font-style: italic; color: var(--primary-color); font-weight: 500; font-size: 1.25rem; }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--gray-200); border-radius: 10px; }

        :global(.bg-primary-color) { background-color: var(--primary-color) !important; }
        :global(.bg-secondary-color) { background-color: var(--secondary-color) !important; }
        :global(.bg-success) { background-color: var(--success) !important; }
        :global(.text-primary-color) { color: var(--primary-color) !important; }
        :global(.text-secondary-color) { color: var(--secondary-color) !important; }
        :global(.text-success) { color: var(--success) !important; }
        :global(.shadow-success) { box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3) !important; }
        :global(.shadow-primary-color) { box-shadow: 0 10px 30px rgba(12, 30, 69, 0.2) !important; }
      `}</style>
    </div>
  );
}
