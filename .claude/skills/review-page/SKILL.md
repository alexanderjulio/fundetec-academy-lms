---
description: Analiza una página del proyecto FUNDETEC e identifica código duplicado, estados redundantes, queries mal ubicadas, y patrones que no siguen las convenciones del proyecto.
---

Realiza una revisión de código de una página del proyecto FUNDETEC.

## Argumentos esperados
`$ARGUMENTS`: ruta a la página a revisar (relativa o absoluta).
- Ejemplos: `src/app/(dashboard)/admin/users/page.js`, `admin/users`, `coordinador/students`

## Pasos a seguir

1. **Resolver la ruta** si el usuario dio una ruta parcial:
   - `admin/<nombre>` → `src/app/(dashboard)/admin/<nombre>/page.js`
   - `coordinador/<nombre>` → `src/app/(dashboard)/coordinador/<nombre>/page.js`
   - `dashboard/<nombre>` → `src/app/(dashboard)/dashboard/<nombre>/page.js`

2. **Leer el archivo completo** con el Read tool.

3. **Analizar en estas categorías:**

### A. Métricas básicas
- Número total de líneas
- Número de `useState` (más de 8 es señal de alerta)
- Número de `useEffect`
- Número de llamadas `supabase.from()`
- ¿Tiene `'use client'`? ¿Es necesario o podría ser Server Component?

### B. Código duplicado del proyecto
Buscar con Grep si hay patrones de esta página repetidos en otras:
- El mismo spinner de loading
- El mismo patrón de `useEffect` con `supabase.channel()`
- Definiciones de íconos SVG inline (deberían estar en `/components/ui/Icons.js`)
- KPI Cards definidas como arrays `const kpis = [...]` inline

### C. Queries a Supabase
- ¿Hay queries condicionales con múltiples `if/else` que podrían estar en `src/lib/queries.js`?
- ¿Se traen todos los datos para filtrar en JS en lugar de filtrar en la query?
- ¿Las búsquedas de texto tienen debounce o filtran en cada keystroke?
- ¿Hay `supabase.from()` fuera de funciones `fetchXxx()` dedicadas?

### D. Real-time
- ¿Hay suscripciones con `supabase.channel()`?
- ¿Se limpian correctamente en el `return` del `useEffect`?
- ¿Deberían tener real-time y no lo tienen?

### E. Manejo de errores
- ¿Cada `try/catch` llama a `showNotification(error.message, 'error')`?
- ¿Hay errores que se ignoran silenciosamente?
- ¿Los mensajes de error son descriptivos?

### F. Estilos
- ¿Hay bloques `<style jsx global>` que deberían estar en `dashboard.css`?
- ¿Hay clases Tailwind muy largas repetidas que podrían ser una clase CSS?

### G. Estructura
- ¿La página supera 400 líneas? Identificar qué secciones deberían ser componentes separados.
- ¿Hay modales definidos inline que deberían ser un componente `<Modal>`?
- ¿Hay tablas definidas inline que podrían reutilizar un componente `<DataTable>`?

4. **Generar reporte estructurado** con:

```
## Revisión: src/app/(dashboard)/ruta/page.js

### Métricas
- Líneas: XXX
- useState: X  
- supabase.from(): X llamadas

### Problemas encontrados

#### 🔴 Críticos (afectan rendimiento o mantenibilidad)
1. [descripción + línea aproximada + sugerencia concreta]

#### ⚠️ Moderados (deuda técnica)
1. [descripción + línea aproximada + sugerencia concreta]

#### 🔵 Menores (estilo/convención)
1. [descripción + sugerencia]

### Acciones recomendadas (orden de prioridad)
1. ...
2. ...
```

5. **Preguntar** al usuario si quiere que se aplique alguna de las mejoras encontradas.
