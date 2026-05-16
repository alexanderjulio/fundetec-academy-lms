-- ============================================================
-- CHATBOT: Profesor Virtual
-- Tablas: chatbot_config, chatbot_messages
-- ============================================================

-- Configuración del bot (singleton — una sola fila)
CREATE TABLE IF NOT EXISTS chatbot_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name      text NOT NULL DEFAULT 'Profesor Virtual',
  system_prompt text NOT NULL DEFAULT 'Eres un profesor virtual de FUNDETEC Academy. Ayudas a los estudiantes con dudas académicas de forma clara, paciente y en español. No respondas temas ajenos a la academia.',
  is_active     boolean NOT NULL DEFAULT true,
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES profiles(id)
);

-- Insertar fila inicial si no existe
INSERT INTO chatbot_config (bot_name, system_prompt, is_active)
SELECT 'Profesor Virtual', 'Eres un profesor virtual de FUNDETEC Academy. Ayudas a los estudiantes con dudas académicas de forma clara, paciente y en español. No respondas temas ajenos a la academia.', true
WHERE NOT EXISTS (SELECT 1 FROM chatbot_config);

-- Historial de mensajes por estudiante
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_student ON chatbot_messages(student_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE chatbot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;

-- chatbot_config: todos pueden leer, solo admin puede escribir
CREATE POLICY "chatbot_config_read" ON chatbot_config
  FOR SELECT USING (true);

CREATE POLICY "chatbot_config_write" ON chatbot_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_id = 1)
  );

-- chatbot_messages: estudiante ve solo los suyos, admin ve todos
CREATE POLICY "chatbot_messages_student_read" ON chatbot_messages
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role_id = 1)
  );

CREATE POLICY "chatbot_messages_student_insert" ON chatbot_messages
  FOR INSERT WITH CHECK (student_id = auth.uid());
