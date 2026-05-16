---
description: Genera una nueva página del dashboard con el patrón estándar del proyecto FUNDETEC (fetch, estados, real-time, loading, layout).
---

Crea una nueva página de dashboard para el proyecto FUNDETEC siguiendo el patrón estándar del proyecto.

## Argumentos esperados
`$ARGUMENTS` puede ser: `<rol> <nombre-página> [descripción]`
- **rol**: `admin`, `coordinador` o `dashboard` (estudiante)
- **nombre-página**: nombre en kebab-case (ej. `reportes`, `pagos-extra`)
- **descripción**: para qué sirve la página (opcional)

## Pasos a seguir

1. **Determinar la ruta** según el rol:
   - `admin` → `src/app/(dashboard)/admin/<nombre-página>/page.js`
   - `coordinador` → `src/app/(dashboard)/coordinador/<nombre-página>/page.js`
   - `dashboard` → `src/app/(dashboard)/dashboard/<nombre-página>/page.js`

2. **Leer una página similar existente** del mismo rol para seguir el estilo exacto del proyecto. Usa el Read tool en alguna de estas:
   - Admin: `src/app/(dashboard)/admin/leads/page.js`
   - Coordinador: `src/app/(dashboard)/coordinador/pagos/page.js`
   - Estudiante: `src/app/(dashboard)/dashboard/progress/page.js`

3. **Crear el archivo** `page.js` con esta estructura base:

```js
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/context/NotificationContext';

export default function NombrePagina() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [datos, setDatos] = useState([]);

  useEffect(() => {
    fetchDatos();

    // Suscripción en tiempo real
    const channel = supabase
      .channel('nombre-canal-unico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nombre_tabla' }, fetchDatos)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchDatos() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('tabla').select('*');
      if (error) throw error;
      setDatos(data || []);
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-color border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-10 space-y-8 animate-fade-in">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">Título de Página</h1>
        <p className="text-gray-500 mt-1">Descripción breve</p>
      </div>

      {/* Contenido */}
    </div>
  );
}
```

4. **Adaptar el contenido** según la descripción proporcionada: tablas, tarjetas KPI, formularios, etc.

5. **Verificar** que:
   - El nombre del canal de Supabase sea único en el proyecto (buscar con Grep si hay duplicados)
   - Se use `showNotification` para errores
   - El estado de loading muestre el spinner estándar
   - Las clases Tailwind sigan el estilo del proyecto (`rounded-[32px]`, `animate-fade-in`, etc.)
   - Los comentarios estén en español

6. **Informar** al usuario la ruta del archivo creado y los próximos pasos (qué queries conectar, qué tabla de Supabase usar).
