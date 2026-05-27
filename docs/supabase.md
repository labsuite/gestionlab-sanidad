# Integración con Supabase

Segunda app (Vercel + Supabase) para gestión integral del departamento. GestionLab comparte ciclos/módulos, usuarios y (en el futuro) reservas de autoclaves.

## Credenciales
- **Project URL:** `https://clxcjsvkmaydpxvtqesv.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseGNqc3ZrbWF5ZHB4dnRxZXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDI1OTEsImV4cCI6MjA5NDYxODU5MX0._uu-RO_AtA88mh3eC8oPBf7ikD2X5w-otl91pHSJ7GA`
- **Dashboard:** `https://supabase.com/dashboard/project/clxcjsvkmaydpxvtqesv`

La anon key es pública y segura en cliente. NO usar la service key en el cliente ni en git.

## Estado actual (2026-05-19) – PARCIALMENTE COMPLETADO

| Ámbito | Estado | Fuente activa |
|---|---|---|
| Cliente Supabase (`_sb`) | ✓ integrado | `js/config.js` + CDN en `index.html` |
| `ciclos` | ✓ migrado + datos cargados | Supabase |
| `modulos` | ✓ migrado + datos cargados | Supabase |
| `modulo_ciclo` | ✓ migrado + datos cargados | Supabase |
| `user_modulos` | ✓ tabla creada, vacía | Supabase |
| `puede_revisar_inventario` | ✓ columna añadida a `public.users` | Supabase |
| `DATA.sbUsuarios` | ✓ cargado en paralelo | Supabase (solo para lookup de UUID) |
| `DATA.usuarios` | ✓ parcial | Sheets + complementado con Supabase |
| Reservas autoclaves | ✗ pendiente | Sheets |

## Cómo funciona en GestionLab
`loadAllData()` lanza en paralelo lecturas de Sheets y cuatro queries a Supabase: `ciclos`, `modulos`, `modulo_ciclo` y `users`. Si Supabase falla, cae al fallback de Sheets sin romperse.

- `DATA.ciclosModulos` desde Supabase (`modulo_ciclo` + `modulos` + `ciclos`), con `lab_teoria` y `lab_practicas`. Fallback a Sheets si vacío.
- `DATA.sbUsuarios` carga `id, email, full_name, role, ciclo_principal, is_active, puede_revisar_inventario`. Solo para obtener UUID del usuario actual.
- `getUbicacionesAlumno()` busca UUID en `DATA.sbUsuarios` → módulos en `DATA.userModulos` → labs. Fallback a `Ubicaciones_Asignadas` de Sheets si `user_modulos` vacía.

## Estructura de tablas relevante
- **`public.ciclos`**: `id (uuid), nombre (text), created_at, department_id (uuid, nullable)`
- **`public.modulos`**: `id (uuid), nombre (text), created_at, lab_teoria (text), lab_practicas (text), horas_semanales (integer)`
- **`public.modulo_ciclo`**: `ciclo_id (uuid), modulo_id (uuid)` — pivot pura
- **`public.user_modulos`**: `id (uuid), user_id (uuid→users), modulo_id (uuid→modulos), curso_academico (text), created_at` — RLS: anon SELECT, authenticated ALL
- **`public.users`**: `id, email, full_name, role (enum), ciclo_principal, is_active, xade_id, department_id, puede_revisar_inventario`

RLS en `ciclos`, `modulos` y `modulo_ciclo`: `SELECT TO anon` añadido para GestionLab.

## Complementación de DATA.usuarios desde Supabase (2026-05-20)
Al final de `loadAllData()` se añaden usuarios de Supabase que cumplan:
1. Rol `TEACHER` o `STUDENT`
2. Tienen al menos un módulo en `user_modulos` con `lab_teoria` o `lab_practicas` asignado
3. No están ya en Sheets (deduplicación por email)

Marcados con `_sbOnly: true`. Mapeo: `TEACHER → Profesor`, `STUDENT → Alumno`.

**Nota:** mientras `user_modulos` esté vacía, ningún usuario de Supabase aparece. Empezarán a aparecer cuando la otra app asigne módulos.

---

## Pendiente — Fase 2: migración de usuarios a Supabase

**Objetivo:** `DATA.usuarios` lea de Supabase en lugar de Sheets.

**Bloqueante:** verificar que el enum `role` de Supabase (`Admin`, `Gestor`, `Profesor`, `Alumno`) coincide con GestionLab.

**Nota sobre ID_Usuario:** GestionLab usa `USR-001`. Al migrar a UUID, añadir campo `gestionlab_id text` en `public.users`.

**Cambios:**
1. En `loadAllData()`: reemplazar `sheetsGet('Usuarios!A2:I')` por query a `_sb.from('users').select(...)`.
2. En `js/ubicaciones.js`: reemplazar `sheetsAppend`/`sheetsUpdate` por `_sb.from('users').insert()` / `.update()`.
3. Mantener hoja `Usuarios` como backup hasta verificar en producción.

## Pendiente — Fase 3: migración a Supabase Auth

**Objetivo:** GestionLab usa Supabase Auth con proveedor Google en lugar de Google GIS directo.

**Alcance:** solo `js/auth.js` (~30-40 líneas). El token de Google para Sheets API se obtiene de `session.provider_token`.

**Requisito previo:** añadir `https://clxcjsvkmaydpxvtqesv.supabase.co/auth/v1/callback` como URL autorizada en Google Cloud Console. La renovación silenciosa actual se sustituye por `_sb.auth.getSession()`.

**Hacer en sesión dedicada** — si falla, el login deja de funcionar.

## Pendiente — Fase 4: reservas de autoclaves compartidas

**Objetivo:** reserva de autoclave visible desde GestionLab y la app de Vercel.

**Cambios:**
1. Crear tabla `reservas_autoclave` en Supabase (misma estructura que `Reservas_Equipos`, solo `AUTC-*`).
2. En `loadAllData()`: cargar reservas de autoclaves desde Supabase; el resto sigue en Sheets.
3. En `guardarReserva()`, `_cambiarEstadoReserva()`, `_actualizarVerificacion()`: detectar `idEquipo.startsWith('AUTC-')` y usar Supabase.
4. Opcional: Supabase Realtime para actualizar el timeline sin recargar.
