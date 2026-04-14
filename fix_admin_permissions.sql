-- SQL FIX: PERMISOS ADMINISTRATIVOS PARA GESTIÓN DE COMUNIDAD
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Eliminar la política restrictiva anterior
DROP POLICY IF EXISTS "Edicion propia de perfil" ON profiles;

-- 2. Crear nueva política de actualización que incluya a administradores
-- Permite editar si:
-- a) El usuario es el dueño del perfil (auth.uid() = id)
-- b) O el usuario es un Administrador (role_id = 1)
CREATE POLICY "Gestion administrativa de perfiles" 
ON profiles FOR UPDATE 
TO authenticated
USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role_id = 1
  )
)
WITH CHECK (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role_id = 1
  )
);

-- 3. Notificar recarga
NOTIFY pgrst, 'reload schema';
