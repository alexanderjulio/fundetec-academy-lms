'use server';

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Obtener configuración del chatbot
export async function getChatbotConfig() {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('chatbot_config').select('*').single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// Actualizar configuración (solo admin)
export async function updateChatbotConfig({ botName, systemPrompt, isActive, adminId }) {
  const supabase = getAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', adminId)
    .single();

  if (!profile || profile.role_id !== 1) {
    return { error: 'Acción restringida a administradores.' };
  }

  const { error } = await supabase
    .from('chatbot_config')
    .update({ bot_name: botName, system_prompt: systemPrompt, is_active: isActive, updated_at: new Date().toISOString(), updated_by: adminId })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // actualiza la única fila existente

  if (error) return { error: error.message };
  return { error: null };
}

// Obtener historial de mensajes de un estudiante (últimos 20)
export async function getChatHistory(studentId) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('chatbot_messages')
    .select('id, role, content, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

// Obtener todas las conversaciones (admin)
export async function getAllConversations() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('chatbot_messages')
    .select('id, role, content, created_at, student:student_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

// Enviar mensaje y obtener respuesta del AI
export async function sendMessage({ studentId, message }) {
  if (!message?.trim()) return { reply: null, error: 'Mensaje vacío.' };

  const supabase = getAdminClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Obtener config del bot
  const { data: config } = await getChatbotConfig();
  if (!config?.is_active) return { reply: null, error: 'El profesor virtual no está disponible en este momento.' };

  // Obtener historial reciente para contexto
  const { data: history } = await getChatHistory(studentId);

  // Guardar mensaje del estudiante
  await supabase.from('chatbot_messages').insert({ student_id: studentId, role: 'user', content: message });

  // Armar mensajes para OpenAI
  const messages = [
    { role: 'system', content: config.system_prompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages,
    });

    const reply = response.choices[0]?.message?.content || 'No pude generar una respuesta.';

    // Guardar respuesta del bot
    await supabase.from('chatbot_messages').insert({ student_id: studentId, role: 'assistant', content: reply });

    return { reply, error: null };
  } catch (err) {
    console.error('Error OpenAI:', err.message);
    return { reply: null, error: 'Error al conectar con el profesor virtual.' };
  }
}
