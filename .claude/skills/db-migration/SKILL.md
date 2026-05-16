---
description: Genera un archivo SQL de migración para Supabase con estructura estándar, políticas RLS y triggers, siguiendo el patrón del proyecto FUNDETEC.
---

Crea un nuevo archivo de migración SQL para Supabase en el proyecto FUNDETEC.

## Argumentos esperados
`$ARGUMENTS` puede ser: `<nombre-migración> [descripción]`
- **nombre-migración**: en snake_case, descriptivo (ej. `add_payment_methods`, `fix_enrollment_rls`)
- **descripción**: qué hace esta migración (opcional)

## Pasos a seguir

1. **Leer migraciones existentes** para entender el estilo del proyecto. Lee uno de estos archivos como referencia:
   - `database_billing.sql` — para tablas de pagos/facturación
   - `database_lms_v2.sql` — para tablas del LMS
   - `database_notifications_realtime.sql` — para real-time
   - `database_rls_recursion_fix.sql` — para fixes de RLS

2. **Determinar el tipo de migración:**
   - Nueva tabla → incluir `CREATE TABLE`, índices, trigger `updated_at`, políticas RLS
   - Modificar tabla → usar `ALTER TABLE`, preservar datos existentes
   - Fix de RLS → `DROP POLICY IF EXISTS`, luego `CREATE POLICY`
   - Fix de permisos → `GRANT`, `REVOKE`

3. **Crear el archivo** con nombre `database_<nombre-migración>.sql` en la raíz del proyecto (`D:\FUNDETEC\`):

```sql
-- ============================================================
-- MIGRACIÓN: <nombre-migración>
-- Descripción: <descripción>
-- Fecha: <fecha actual>
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. TABLA PRINCIPAL
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nombre_tabla (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- campos específicos aquí
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─────────────────────────────────────────────
-- 2. ÍNDICES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_nombre_tabla_campo
  ON public.nombre_tabla(campo);

-- ─────────────────────────────────────────────
-- 3. TRIGGER updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nombre_tabla_updated_at ON public.nombre_tabla;
CREATE TRIGGER trg_nombre_tabla_updated_at
  BEFORE UPDATE ON public.nombre_tabla
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────
ALTER TABLE public.nombre_tabla ENABLE ROW LEVEL SECURITY;

-- Política: admin puede todo
DROP POLICY IF EXISTS "admin_all_nombre_tabla" ON public.nombre_tabla;
CREATE POLICY "admin_all_nombre_tabla"
  ON public.nombre_tabla FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role_id = 1
    )
  );

-- Política: usuario puede ver sus propios registros
DROP POLICY IF EXISTS "user_select_nombre_tabla" ON public.nombre_tabla;
CREATE POLICY "user_select_nombre_tabla"
  ON public.nombre_tabla FOR SELECT
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 5. PERMISOS
-- ─────────────────────────────────────────────
GRANT ALL ON public.nombre_tabla TO authenticated;
GRANT ALL ON public.nombre_tabla TO service_role;
```

4. **Adaptar el SQL** según la descripción: añadir los campos correctos, las políticas apropiadas para los roles del proyecto (role_id 1=admin, 2=coordinador, 3=estudiante), y los índices necesarios.

5. **Verificar** que:
   - Todo use `IF NOT EXISTS` / `IF EXISTS` para que sea re-ejecutable
   - Las políticas usen `DROP POLICY IF EXISTS` antes del `CREATE POLICY`
   - Los nombres de políticas sean únicos y descriptivos
   - Se respeten los role_ids del proyecto: 1=admin, 2=coordinador, 3=estudiante
   - La tabla tenga siempre `created_at` y `updated_at`

6. **Informar** al usuario:
   - La ruta del archivo creado
   - Cómo ejecutarlo: pegarlo en el SQL Editor de Supabase o con la CLI `supabase db push`
   - Qué tablas/políticas modifica para que pueda hacer rollback si es necesario
