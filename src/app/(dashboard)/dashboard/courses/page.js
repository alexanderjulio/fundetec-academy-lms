'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function StudentCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    async function fetchMyCourses() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch enrollments with course details
        const { data: enrollments, error } = await supabase
          .from('enrollments')
          .select(`
            id,
            courses (
              id,
              title,
              description,
              thumbnail_url
            )
          `)
          .eq('student_id', user.id);

        if (error) throw error;

        // Fetch progress and lesson counts for each course
        const coursesWithProgress = await Promise.all(enrollments.map(async (enr) => {
          const course = enr.courses;

          // Get total lessons for this course
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('id, modules!inner(course_id)', { count: 'exact', head: true })
            .eq('modules.course_id', course.id);

          // Get completed lessons for this student in this course
          const { count: completedLessons } = await supabase
            .from('progress')
            .select('id, lessons!inner(modules!inner(course_id))', { count: 'exact', head: true })
            .eq('student_id', user.id)
            .eq('lessons.modules.course_id', course.id)
            .eq('is_completed', true);

          const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

          return {
            ...course,
            progress,
            total: totalLessons || 0,
            completed: completedLessons || 0
          };
        }));

        setCourses(coursesWithProgress);
      } catch (error) {
        console.error('Error fetching student courses:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMyCourses();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-pulse">
        <div className="w-16 h-16 border-4 border-primary-color border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-primary-color font-black uppercase tracking-widest text-xs">Preparando tu academia...</p>
      </div>
    );
  }

  const activeCourses = courses.filter(c => c.progress < 100);
  const completedCourses = courses.filter(c => c.progress === 100);

  const CourseCard = ({ course, idx }) => (
    <div
      className="group relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
      style={{ animationDelay: `${idx * 100}ms` }}
    >
      <div className="relative h-48 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${course.thumbnail_url || 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=600'})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute bottom-4 left-4">
          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${course.progress === 100 ? 'bg-green-500 text-white' : 'bg-primary-color text-white'}`}>
            {course.progress === 100 ? 'Completado' : 'En Curso'}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <h3 className="text-xl font-bold text-primary-color line-clamp-2 min-h-[3.5rem] leading-tight font-display">
          {course.title}
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase text-gray-400">
            <span>Progreso</span>
            <span className="text-primary-color">{course.progress}%</span>
          </div>
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${course.progress === 100 ? 'bg-green-500' : 'bg-secondary-color'}`}
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>

        <Link
          href={`/dashboard/courses/${course.id}`}
          className="flex items-center justify-center w-full py-3 bg-primary-color text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-light transition-colors"
        >
          Entrar al Aula
        </Link>
      </div>
    </div>
  );

  return (
    <div className="classroom-boutique max-w-[1400px] mx-auto px-6 py-12 md:py-20 space-y-20 font-body">
      <header className="page-header relative pb-10 border-b border-gray-100 mb-16">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-secondary-color/5 blur-[100px] rounded-full"></div>
        <div className="relative z-10 flex flex-col gap-3">
          <span className="text-xs font-black uppercase tracking-[0.4em] text-secondary-color/80">Fundetec Academy</span>
          <h1 className="text-5xl md:text-7xl font-black text-primary-color tracking-tighter leading-tight font-display">
            Mis Programas
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl font-medium">
            Gestiona tu conocimiento con una interfaz diseñada para la excelencia académica.
          </p>
        </div>
      </header>

      {courses.length === 0 ? (
        <div className="empty-state bg-gray-50/50 p-24 text-center rounded-3xl border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-white text-gray-300 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm">📂</div>
          <h3 className="text-2xl font-black text-primary-color mb-2">Tu estantería está vacía</h3>
          <p className="text-gray-400 max-w-xs mx-auto mb-8">Explora nuestro catálogo para comenzar tu próxima gran aventura intelectual.</p>
          <button className="bg-primary-color text-white px-10 py-4 rounded-full font-bold shadow-lg shadow-primary-color/20 hover:scale-105 transition-all">Ver Catálogo</button>
        </div>
      ) : (
        <div className="gallery-layout space-y-24">

          {/* SECCIÓN 1: EN AULA */}
          <section className="active-section space-y-10">
            <div className="section-head flex items-end justify-between border-b border-gray-100 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-secondary-color rounded-full"></div>
                <h2 className="text-3xl font-black text-primary-color tracking-tight uppercase">En Aula</h2>
              </div>
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{activeCourses.length} Programas Activos</span>
            </div>

            {activeCourses.length === 0 ? (
              <div className="bg-gray-50/50 border border-dashed border-gray-200 p-16 rounded-3xl text-center">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No hay diplomados en curso</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {activeCourses.map((course, idx) => (
                  <div key={course.id} className="max-w-md mx-auto w-full">
                    <CourseCard course={course} idx={idx} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECCIÓN 2: LOGROS */}
          {completedCourses.length > 0 && (
            <section className="completed-section space-y-10">
              <div className="section-head flex items-end justify-between border-b border-gray-100 pb-5">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-8 bg-success rounded-full"></div>
                  <h2 className="text-3xl font-black text-primary-color tracking-tight uppercase">Mis Logros</h2>
                </div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{completedCourses.length} Certificaciones</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {completedCourses.map((course, idx) => (
                  <div key={course.id} className="max-w-md mx-auto w-full">
                    <CourseCard course={course} idx={idx} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <style jsx>{`
        .course-card-boutique {
          animation: slide-up 1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(80px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: slide-up 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-fade-in {
          animation: fade 1.5s ease-out both;
        }
        @keyframes fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .delay-300 { animation-delay: 0.3s; }
      `}</style>
    </div>
  );
}

