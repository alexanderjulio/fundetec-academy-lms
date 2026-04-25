require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Cliente con service_role para saltar confirmación de email y RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrate() {
  console.log('--- INICIANDO MIGRACIÓN DE ESTUDIANTES ---');
  
  const csvPath = path.join(__dirname, '../data/students_to_migrate.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Error: No se encuentra el archivo data/students_to_migrate.csv');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',');
  const students = lines.slice(1);

  for (const studentLine of students) {
    const values = studentLine.split(',');
    const student = {};
    headers.forEach((header, i) => {
      student[header.trim()] = values[i]?.trim();
    });

    if (!student.email) continue;

    console.log(`Procesando: ${student.email}...`);

    try {
      // 1. Crear usuario en Auth (sin confirmación de email)
      const { data: userData, error: authError } = await supabase.auth.admin.createUser({
        email: student.email,
        password: 'Fundetec' + Math.floor(1000 + Math.random() * 9000), // Contraseña temporal
        email_confirm: true,
        user_metadata: { full_name: student.full_name }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.warn(`  - Aviso: El usuario ${student.email} ya existe en Auth.`);
        } else {
          throw authError;
        }
      }

      const userId = userData?.user?.id;

      if (userId) {
        // 2. Crear perfil en public.profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            full_name: student.full_name,
            role_id: 3, // Estudiante
            updated_at: new Date()
          });

        if (profileError) throw profileError;
        console.log(`  - Perfil creado/actualizado correctamente.`);

        // 3. Registrar progreso (opcional)
        if (student.progress_percent) {
           // Aquí podrías vincular a un curso específico si tienes el ID
           console.log(`  - Progreso detectado: ${student.progress_percent}% (Vincular manualmente a curso)`);
        }
      }

    } catch (err) {
      console.error(`  - Error migrando ${student.email}:`, err.message);
    }
  }

  console.log('--- MIGRACIÓN FINALIZADA ---');
  console.log('Nota: Los estudiantes deberán usar la opción "Olvidé mi contraseña" para establecer una propia al entrar por primera vez.');
}

migrate();
