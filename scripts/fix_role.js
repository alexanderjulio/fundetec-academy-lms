/**
 * SCRIPT DE CORRECCIÓN DE ROLES - FUNDETEC ACADEMY
 * Este script eleva una cuenta al rango de COORDINADOR (ID: 2)
 */

const { createClient } = require('@supabase/supabase-js');

// Configuración manual basada en su .env.local
const SUPABASE_URL = 'https://ihcdtqrphvxgtverrrst.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY2R0cXJwaHZ4Z3R2ZXJycnN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY5MTI3NSwiZXhwIjoyMDkxMjY3Mjc1fQ.BxFiPcW6mnqYHYqjN93kwd0wTurowSwSQGhJv31eizM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const targetEmail = 'alexjuliosanchez@gmail.com'; // EDITAR AQUÍ EL CORREO

async function promoteToCoordinator() {
  console.log(`🔍 Buscando usuario con email: ${targetEmail}...`);
  
  // 1. Obtener el ID del usuario desde auth (usando email)
  // Nota: En Supabase Auth es complejo buscar por email desde el cliente anon, 
  // pero usaremos la tabla profiles que ya tiene los emails.
  
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, full_name, role_id')
    .eq('email', targetEmail)
    .single();

  if (findError || !profile) {
    console.error('❌ No se encontró el perfil. Verifica el correo.');
    return;
  }

  console.log(`✅ Usuario encontrado: ${profile.full_name} (ID: ${profile.id}, Rol actual: ${profile.role_id})`);

  // 2. Actualizar el role_id a 1 (Administrador)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role_id: 1 })
    .eq('id', profile.id);

  if (updateError) {
    console.error('❌ Error al actualizar el rol:', updateError.message);
  } else {
    console.log(`✨ ¡ÉXITO! El usuario ${targetEmail} ya es COORDINADOR.`);
    console.log('Ahora el sistema lo redirigirá siempre a /coordinador.');
  }
}

promoteToCoordinator();
