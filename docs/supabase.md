# Integración con la base de datos de Sanidad CMA

GestionLab comparte el catálogo de ciclos/módulos con "Sanidad CMA" (la otra app del
departamento, Vercel + Supabase, `sanidade-cma-app.vercel.app`). Hay **dos canales
distintos** hacia esa app — no confundirlos:

## Canal 1 — lectura directa de `ciclos`/`modulos` (catálogo, en vivo)

`DATA.ciclosModulos` (usado en el desplegable de módulo de Contabilidad, y en el
selector de ciclo/módulo de Usuarios) se lee **en directo** del proyecto Supabase de
Sanidad CMA, con la clave `anon` pública — no es una tabla propia de GestionLab.

- **Project URL:** `https://clxcjsvkmaydpxvtqesv.supabase.co`
- **Cliente en el código:** `_sb` en `js/config.js` (constantes `SUPABASE_URL` /
  `SUPABASE_ANON`) — distinto del cliente `_sbMigracion` que apunta a la base de datos
  propia de GestionLab (`vnoecaqldymonkgrmvlj.supabase.co`).
- `loadAllData()` en `js/sheets.js` consulta `ciclos`, `modulos` y `modulo_ciclo` (tabla
  pivote muchos-a-muchos) de `_sb` y construye `DATA.ciclosModulos` combinando las tres
  (ver función alrededor de `sbCiclosRes`/`sbModulosRes`/`sbModuloCicloRes`).
- Confirmado en vivo (2026-08-18): la consulta devuelve datos reales y actualizados
  (52 módulos, ciclos como "CS Laboratorio Clínico e Biomédico", "CS Anatomía
  Patolóxica e Citodiagnóstico"...). Confirmado con la usuaria que este proyecto
  **es** la base de datos de Sanidad CMA.
- `DATA.sbUsuarios` / `DATA.userModulos` también se leen de aquí (`ciclos`, `modulos`,
  `modulo_ciclo`, `user_modulos`, `users`) — se usan para `getUbicacionesAlumno()`
  (labs del alumno a partir de sus módulos matriculados en Sanidad CMA).
- Este canal es de **solo lectura** desde GestionLab (RLS: `SELECT TO anon`). No hay
  forma de editar ciclos/módulos desde GestionLab — se gestionan en Sanidad CMA.

## Canal 2 — API REST con `x-api-key` (importación de alumnado/profesorado)

Para dar de alta alumnado y profesorado como usuarios de GestionLab (con cuenta de
Supabase Auth propia), se usa una API REST distinta y más reciente, documentada en
`scripts/sanidad_cma_credentials.json` y en la memoria de la sesión que la implementó:

- **API URL:** `https://sanidade-cma-app.vercel.app`
- **Endpoints:** `/api/bioDesk/alumnos`, `/api/bioDesk/profesores` (una fila por
  matrícula alumno/profesor × módulo, con `ciclo`/`modulo`/`laboratorio` incluidos)
- **Auth:** cabecera `x-api-key`, secreto guardado como variable de entorno de las
  Edge Functions `importar-alumnos` / `importar-profesores`
  (`SANIDAD_CMA_API_URL` / `SANIDAD_CMA_API_KEY`)
- Esta API **no expone** un endpoint de catálogo de ciclos/módulos como tal (probado
  2026-08-18: `/ciclos`, `/modulos`, `/ciclosModulos`, `/catalogo` devuelven 404) — solo
  alumnado y profesorado ya matriculados. Para el catálogo de ciclos/módulos en sí,
  usar el Canal 1.
- Ver `docs/modulo-usuarios.md` para el flujo completo de importación.

## Notas históricas

Este documento describía antes (mayo 2026) una migración por fases de usuarios y login
a Supabase que ya se completó — GestionLab usa Supabase Auth (email+contraseña) desde
la migración completa documentada en `CLAUDE.md` y en la memoria de sesión
`project_migracion_supabase_gestionlab`. Las fases 2 y 3 de aquella versión del
documento ya no aplican. La fase de "reservas de autoclaves compartidas" sigue sin
implementarse; si se retoma, revisar primero si sigue siendo necesaria dado que ahora
Reservas vive enteramente en la base de datos propia de GestionLab (`_sbMigracion`).
