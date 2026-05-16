import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Instancia lazy para evitar errores en build cuando la env var no está definida
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Subir imagen a Supabase Storage y devolver URL pública
async function uploadImage(buffer, ext, supabase) {
  const fileName = `import_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const path = `lesson_assets/${fileName}`;
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

  const { error } = await supabase.storage
    .from('site_assets')
    .upload(path, buffer, { contentType: mimeMap[ext] || 'image/png', upsert: false });

  if (error) return null;

  const { data: { publicUrl } } = supabase.storage.from('site_assets').getPublicUrl(path);
  return publicUrl;
}

// Parsear DOCX con mammoth
async function parseDocx(buffer, supabase) {
  const mammoth = (await import('mammoth')).default;

  const imageUrls = [];

  // Convertir con extracción de imágenes
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imgBuffer = await image.read();
        const ext = image.contentType?.split('/')[1] || 'png';
        const url = await uploadImage(Buffer.from(imgBuffer), ext, supabase);
        if (url) imageUrls.push(url);
        return { src: url || '' };
      }),
    }
  );

  return result.value; // HTML limpio con imágenes ya subidas
}

// Parsear PDF con unpdf (diseñado para servidor, sin web workers)
async function parsePdf(buffer) {
  const { extractText } = await import('unpdf');
  const result = await extractText(new Uint8Array(buffer));
  if (typeof result === 'string') return result;
  if (result?.text) return String(result.text);
  // Si es objeto con totalPages y páginas, unir todo el texto
  return JSON.stringify(result);
}

// Estructurar contenido con GPT-4o
async function structureWithAI(content, fileName) {
  const prompt = `Eres un experto en diseño instruccional. A continuación tienes el contenido extraído de un documento llamado "${fileName}".

Tu tarea es estructurarlo como un curso educativo completo en formato JSON. Sigue estas reglas estrictamente:

1. Identifica el título general del curso y una descripción breve.
2. Divide el contenido en MÓDULOS (capítulos o secciones principales).
3. Dentro de cada módulo, crea LECCIONES (temas o subtemas).
4. Para cada lección, genera el contenido en HTML limpio y bien estructurado usando: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>. Si hay imágenes en el HTML, consérvala con su <img src="...">.
5. Mantén TODO el texto original — no omitas información.
6. El HTML debe ser prolijo: párrafos separados, listas bien formadas, títulos jerarquizados.

Devuelve ÚNICAMENTE el JSON válido con esta estructura exacta, sin texto adicional:
{
  "titulo": "string",
  "descripcion": "string",
  "modulos": [
    {
      "nombre": "string",
      "lecciones": [
        {
          "titulo": "string",
          "contenido_html": "string"
        }
      ]
    }
  ]
}

CONTENIDO DEL DOCUMENTO:
${String(content).substring(0, 80000)}`; // límite de tokens

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content || '{}';
  return JSON.parse(text);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });

    const fileName = file.name || 'documento';
    const ext = fileName.split('.').pop().toLowerCase();

    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF o Word (.docx).' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = getAdminClient();
    let content = '';

    if (ext === 'pdf') {
      content = await parsePdf(buffer);
    } else {
      content = await parseDocx(buffer, supabase);
    }

    if (!content || (typeof content === 'string' && !content.trim())) {
      return NextResponse.json({ error: 'No se pudo extraer contenido del archivo.' }, { status: 422 });
    }

    const estructura = await structureWithAI(content, fileName);

    if (!estructura?.titulo || !estructura?.modulos?.length) {
      return NextResponse.json({ error: 'La IA no pudo estructurar el contenido. Intenta con un documento más organizado.' }, { status: 422 });
    }

    return NextResponse.json({ estructura });

  } catch (err) {
    console.error('Error en import-course:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
