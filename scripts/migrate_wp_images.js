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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const UPLOADS_DIR = path.join(__dirname, '../data/uploads');

async function migrateImages() {
  console.log('--- INICIANDO MIGRACIÓN DE IMÁGENES DE WORDPRESS ---');
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`❌ Error: No se encuentra la carpeta local de subidas.`);
    console.error(`Debes descargar la carpeta 'uploads' de WordPress y colocarla en:`);
    console.error(`👉 ${UPLOADS_DIR}`);
    return;
  }

  // Fetch all lessons that might have content
  const { data: lessons, error: fetchError } = await supabase
    .from('lessons')
    .select('id, title, content');

  if (fetchError) {
    console.error('Error obteniendo lecciones:', fetchError);
    return;
  }

  console.log(`Buscando en ${lessons.length} lecciones...`);
  
  // Regex to find images uploaded to wp-content/uploads/
  // It matches anything containing wp-content/uploads/ followed by the path until a quote
  const wpRegex = /https?:\/\/[^\/]+\/wp-content\/uploads\/([^"']+)/gi;

  let totalImagesFound = 0;
  let totalImagesUploaded = 0;

  for (const lesson of lessons) {
    if (!lesson.content) continue;

    let contentUpdated = false;
    let newContent = lesson.content;

    const matches = [...newContent.matchAll(wpRegex)];
    
    if (matches.length > 0) {
      console.log(`\n📚 Lección: "${lesson.title}" - Encontradas ${matches.length} imágenes.`);
      
      for (const match of matches) {
        const fullUrl = match[0];
        let relativePath = match[1]; // e.g. "2021/01/boton-whastapp-300x61.png"
        
        // Remove query parameters if any
        relativePath = relativePath.split('?')[0];

        totalImagesFound++;
        
        const localFilePath = path.join(UPLOADS_DIR, relativePath);
        
        if (fs.existsSync(localFilePath)) {
          console.log(`  ✅ Archivo local encontrado: ${relativePath}`);
          
          try {
            const fileBuffer = fs.readFileSync(localFilePath);
            const ext = path.extname(localFilePath);
            const fileName = `lesson_img_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
            const supabasePath = `lesson_assets/${fileName}`;

            console.log(`     Subiendo a Supabase: ${supabasePath}...`);
            
            // Upload to Supabase 'site_assets' bucket
            const { data, error: uploadError } = await supabase.storage
              .from('site_assets')
              .upload(supabasePath, fileBuffer, {
                 contentType: ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream',
                 upsert: false
              });

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
              .from('site_assets')
              .getPublicUrl(supabasePath);

            console.log(`     Éxito. Nueva URL: ${publicUrl}`);
            
            // Replace the URL in the HTML content
            newContent = newContent.replace(fullUrl, publicUrl);
            contentUpdated = true;
            totalImagesUploaded++;

          } catch (err) {
            console.error(`  ❌ Error subiendo ${relativePath}:`, err.message);
          }
        } else {
          console.error(`  ⚠️ Archivo NO encontrado en disco local: ${localFilePath}`);
        }
      }
      
      // If content was updated, save it back to the database
      if (contentUpdated) {
        console.log(`  💾 Guardando lección actualizada en la base de datos...`);
        const { error: updateError } = await supabase
          .from('lessons')
          .update({ content: newContent })
          .eq('id', lesson.id);
          
        if (updateError) {
          console.error(`  ❌ Error actualizando lección:`, updateError);
        } else {
          console.log(`  ✅ Lección guardada con éxito.`);
        }
      }
    }
  }

  console.log('\n--- RESUMEN DE MIGRACIÓN ---');
  console.log(`Imágenes WordPress encontradas en DB: ${totalImagesFound}`);
  console.log(`Imágenes migradas y actualizadas a Supabase: ${totalImagesUploaded}`);
  if (totalImagesFound > totalImagesUploaded) {
    console.log(`⚠️ Atención: Algunas imágenes no se migraron porque no se encontraron en la carpeta local o hubo errores.`);
  }
}

migrateImages();
