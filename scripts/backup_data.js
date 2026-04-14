/**
 * SCRIPT DE RESPALDO - FUNDETEC ACADEMY
 * Este script extrae los datos actuales de Supabase y los guarda en la carpeta /backups
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { syncDrive } = require('./sync_drive');

// Configuración manual basada en .env.local
const SUPABASE_URL = 'https://ihcdtqrphvxgtverrrst.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY2R0cXJwaHZ4Z3R2ZXJycnN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY5MTI3NSwiZXhwIjoyMDkxMjY3Mjc1fQ.BxFiPcW6mnqYHYqjN93kwd0wTurowSwSQGhJv31eizM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const tables = [
  'profiles',
  'courses',
  'lessons',
  'enrollments',
  'payments',
  'leads',
  'notifications',
  'coordinator_invoices'
];

async function runBackup() {
  console.log('🚀 Iniciando Respaldo de Seguridad...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backups', `backup_${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const table of tables) {
    console.log(`📡 Exportando tabla: ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    
    if (error) {
      console.error(`❌ Error en tabla ${table}:`, error.message);
      continue;
    }

    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ ${table} respaldado (${data.length} registros)`);
  }

  console.log('\n✨¡Respaldo completado con éxito!');
  console.log(`📂 Ubicación: /backups/backup_${timestamp}`);

  // Integración con Google Drive
  await syncDrive();
}

runBackup();
