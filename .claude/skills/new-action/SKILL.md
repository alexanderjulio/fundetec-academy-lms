---
description: Genera una nueva Server Action en src/app/actions/ siguiendo el patrón estándar del proyecto FUNDETEC.
---

Crea una nueva Server Action para el proyecto FUNDETEC.

## Argumentos esperados
`$ARGUMENTS` puede ser: `<archivo> <nombre-función> [descripción]`
- **archivo**: `admin`, `student` o `email` (el archivo actions donde agregarla)
- **nombre-función**: nombre en camelCase (ej. `enrollStudent`, `createInvoice`)
- **descripción**: qué hace la acción (opcional pero recomendado)

## Pasos a seguir

1. **Leer el archivo de actions correspondiente** para entender el patrón actual:
   - `admin` → `src/app/actions/admin_actions.js`
   - `student` → `src/app/actions/student_actions.js`
   - `email` → `src/app/actions/email_actions.js`

2. **Agregar la nueva función** al final del archivo siguiendo este patrón:

```js
/**
 * Descripción de lo que hace la acción.
 * @param {Object} params - Parámetros de entrada
 * @returns {{ data: any, error: string|null }}
 */
export async function nombreFuncion(params) {
  'use server';

  try {
    const { createClient } = await import('@supabase/ssr');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    // Validar parámetros requeridos
    if (!params.campoRequerido) {
      throw new Error('El campo requerido es obligatorio');
    }

    // Lógica principal
    const { data, error } = await supabase
      .from('tabla')
      .insert({ ...params })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error en nombreFuncion:', error.message);
    return { data: null, error: error.message };
  }
}
```

3. **Adaptar** la lógica según la descripción: puede ser un INSERT, UPDATE, DELETE, llamada a API externa, envío de email con Resend, etc.

4. **Verificar** que:
   - La directiva `'use server'` esté presente
   - Se use `SUPABASE_SERVICE_ROLE_KEY` (no el anon key) para operaciones privilegiadas
   - Siempre retorne `{ data, error }` — nunca lanzar excepciones sin atrapar
   - Los mensajes de error sean descriptivos y en español
   - El `console.error` incluya el nombre de la función para facilitar debugging

5. **Informar** al usuario cómo importar y usar la acción desde un componente o página:
```js
import { nombreFuncion } from '@/app/actions/admin_actions';

// Uso en un componente:
const { data, error } = await nombreFuncion({ campo: valor });
if (error) showNotification(error, 'error');
```
