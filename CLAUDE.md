@AGENTS.md

# FUNDETEC Academy — Guía para Claude

## Descripción del Proyecto
Plataforma educativa (LMS) para FUNDETEC. Gestiona cursos, inscripciones, exámenes, pagos y usuarios. Tiene tres roles principales: **admin**, **coordinador** y **estudiante** (dashboard).

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.3 |
| UI | React | 19.2.4 |
| Estilos | Tailwind CSS | 4.2.2 |
| Backend/Auth/DB | Supabase | @supabase/supabase-js ^2 |
| Email | Resend | ^6 |
| PDFs | jsPDF + jspdf-autotable | ^4 / ^5 |
| Google | googleapis | ^171 |

> **Importante:** Next.js 16 y Tailwind 4 tienen cambios de ruptura. Consultar `node_modules/next/dist/docs/` antes de tocar configuración o APIs del framework.

---

## Estructura de Carpetas

```
src/
  app/
    (dashboard)/          # Grupo de rutas del dashboard (layout compartido)
      admin/              # Rutas exclusivas del rol admin
        billing/          # Facturación
        courses/          # Gestión de cursos, módulos y exámenes
        landing/          # Editor de landing page
        leads/            # Prospectos/CRM
        ledger/           # Libro mayor
        notifications/    # Notificaciones (admin)
        profile/
        users/            # Gestión de usuarios
      coordinador/        # Rutas del rol coordinador
        billing/
        pagos/
        students/         # Gestión de estudiantes e inscripciones
        notifications/
        profile/
      dashboard/          # Rutas del rol estudiante
        courses/          # Cursos inscritos
        exams/            # Exámenes
        lessons/          # Lecciones
        notifications/
        profile/
        progress/         # Progreso académico
    actions/              # Server Actions de Next.js
      admin_actions.js
      student_actions.js
      email_actions.js
    login/                # Autenticación y reset de contraseña
    privacidad/
    terminos/
    page.js               # Landing pública
  components/
    dashboard/            # Componentes del dashboard por sección
    layout/               # Header, sidebar, etc.
    ui/                   # Componentes reutilizables (botones, modales, etc.)
  context/                # React Context (estado global)
  hooks/                  # Custom hooks
  lib/
    supabase.js           # Cliente Supabase para el browser (createBrowserClient)
  utils/                  # Funciones auxiliares
  styles/                 # CSS global
scripts/                  # Scripts Node.js de mantenimiento y migración
```

---

## Autenticación y Roles

- Se usa `@supabase/ssr` con `createBrowserClient` en el cliente.
- **Siempre usar `getUser()`** — `getSession()` fue reemplazado en toda la app (ver commit f4afbe1).
- Roles en la base de datos: `admin`, `coordinador`, `estudiante`.
- Las rutas del dashboard están protegidas por el layout del grupo `(dashboard)`.

---

## Base de Datos (Supabase)

- **RLS habilitado** en todas las tablas. Cualquier cambio de esquema requiere revisar las políticas.
- Esquemas principales (ver archivos `database_*.sql`):
  - LMS: cursos, módulos, lecciones, inscripciones, progreso
  - Exámenes: intentos, preguntas, seguridad
  - Billing: pagos, facturación
  - CMS: contenido de landing
  - Notificaciones: tiempo real
  - Contacto/Leads: prospectos y CRM
- Las variables de entorno requeridas son:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Server Actions

Las Server Actions van en `src/app/actions/`. Son el patrón preferido para mutaciones en lugar de API Routes.

---

## Comandos Frecuentes

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build de producción
npm run start            # Iniciar en producción
npm run lint             # ESLint
npm run migrate-students # Migrar estudiantes (scripts/migrate_students.js)

# Scripts manuales (ejecutar con node directamente)
node scripts/backup_data.js
node scripts/sync_drive.js
node scripts/fix_role.js
node scripts/check_admin.js
```

---

## Deployment

- **VPS**: `179.50.78.207` — Ubuntu 24.04
- **Proceso**: PM2 + Nginx como reverse proxy
- **Build**: Output `standalone` (configurado en `next.config.mjs`)
- **CI/CD**: GitHub Actions con control de concurrencia (deploy automático a VPS en push a `main`)
- **Red local dev**: `192.168.1.17` permitida como origen de desarrollo

---

## Convenciones

- Todo el código, comentarios y documentación en **español**.
- Preferir Server Components por defecto; usar `"use client"` solo cuando sea necesario (interactividad, hooks de estado).
- No usar `getSession()` — usar siempre `getUser()`.
- Las imágenes remotas permitidas están en `next.config.mjs` (Supabase, Unsplash, Pravatar).
