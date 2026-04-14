'use server';

import { createClient } from '@supabase/supabase-js';

/**
 * Verifica el progreso total de un curso para un estudiante.
 * Si llega al 100%, notifica al coordinador asignado.
 */
export async function checkAndNotifyCourseCompletion(studentId, courseId) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Obtener total de lecciones del curso
    const { count: totalLessons } = await adminClient
      .from('lessons')
      .select('id, modules!inner(course_id)', { count: 'exact', head: true })
      .eq('modules.course_id', courseId);

    // 2. Obtener lecciones completadas por el estudiante
    const { count: completedLessons } = await adminClient
      .from('progress')
      .select('id, lessons!inner(modules!inner(course_id))', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('lessons.modules.course_id', courseId)
      .eq('is_completed', true);

    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    if (percent === 100) {
      // 3. Obtener info del estudiante y su coordinador
      const { data: student } = await adminClient
        .from('profiles')
        .select('full_name, coordinator_id')
        .eq('id', studentId)
        .single();

      const { data: course } = await adminClient
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single();

      if (student && student.coordinator_id) {
        // 4. Crear notificación oficial para el coordinador
        await adminClient.from('global_notifications').insert({
          title: '🎓 Curso Finalizado (100%)',
          message: `El estudiante ${student.full_name} ha completado todas las lecciones del programa: ${course.title}. Listo para validación final.`,
          target_type: 'individual',
          coordinator_id: student.coordinator_id
        });

        return { success: true, completed: true, message: 'Coordinador notificado.' };
      }
    }

    return { success: true, completed: percent === 100 };
  } catch (error) {
    console.error('Error in checkAndNotifyCourseCompletion:', error);
    return { success: false, error: error.message };
  }
}
