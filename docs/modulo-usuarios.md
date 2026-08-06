# Módulo de usuarios – COMPLETADO (2026-05-16)

## Hoja Usuarios – columnas (A–H)
| Col | Campo |
|-----|-------|
| A | ID_Usuario |
| B | Nombre |
| C | Email |
| D | Rol |
| E | Activo |
| F | Ubicaciones_Asignadas |
| G | Modulo |
| H | Ciclo_Principal |

- `sheetsGet('Usuarios!A2:H')` — rango incluye columna H
- `Modulo` (col G): nombres de módulos separados por coma, sin prefijo de ciclo (formato plano)
- `Ciclo_Principal` (col H): ciclo formativo explícito, determina el grupo en la UI

## Lógica de alumnos
- Pantalla de usuarios: 3 pestañas — **Admins y gestores | Profesores | Alumnos**
- Pestaña Alumnos agrupa por `Ciclo_Principal` (col H). Fallback para registros antiguos: lee prefijo embebido "Ciclo|Módulo" o hace lookup en DATA.ciclosModulos.
- Al crear/editar alumno: dropdown de ciclo → módulos filtrados. Cambiar ciclo elimina selecciones que no pertenezcan al nuevo ciclo.
- `Ubicaciones_Asignadas` almacena números de lab ("201,203"), NO IDs de zona. `getUbicacionesAlumno()` en config.js los expande a IDs de zona.
- Búsqueda global por nombre/email y filtro por módulo.

## Ciclos_Modulos — estructura crítica
Varios módulos comparten nombre entre ciclos (ej. "Técnicas Xerais de Laboratorio" aparece en CS Lab Clínico, ZS Lab Clínico y CS Anatomía). Por eso el ciclo se guarda explícitamente en col H y **NO se infiere de los módulos**.

## Tolerancia a diferencias de nombre de ciclo
`_normCiclo(s)` en `ubicaciones.js` normaliza tildes, mayúsculas, ñ y espacios. `_refreshModuloCheckboxes` intenta coincidencia exacta y cae a comparación normalizada. Al guardar, el campo se sobreescribe con el nombre canónico del dropdown.

## Usuarios _sbOnly (desde Supabase)
- Alumnos `_sbOnly`: sin botón ✏️ — se gestionan desde la otra app
- Profesores `_sbOnly`: botón ✏️ para Admin/Gestor — permite promoverlos a `Gestor`. Al guardar, `editingRow = null` → crea fila nueva vía `gestionar-usuario` con ID `USR-XXX`.
- Aparecen solo cuando `user_modulos` de Supabase (proyecto compartido `_sb`) tiene filas con `lab_teoria`/`lab_practicas` asignados.

## Importar alumnado desde Sanidad CMA (2026-08-06)

Botón **📥 Importar desde Sanidad CMA** junto a "+ Nuevo usuario" (`js/ubicaciones.js`, `renderUsuarios()`), visible solo Admin/Gestor. Abre `modal-importar-alumnos` (`html/modales-catalogo.html`).

- `abrirModalImportarAlumnos()` → `_cargarPreviewImportarAlumnos()` llama a la Edge Function `importar-alumnos` con `{accion:'preview'}`: trae el alumnado de la API de Sanidad CMA (`sanidade-cma-app.vercel.app/api/bioDesk/alumnos`, credenciales en `scripts/sanidad_cma_credentials.json` / secretos `SANIDAD_CMA_API_URL`+`SANIDAD_CMA_API_KEY` de la Edge Function) y marca quién ya existe (comparando por email contra `usuarios`).
- **Cada fila que trae Sanidad CMA es una matrícula (alumno × módulo), no un alumno único** — un mismo alumno puede repetirse con módulo/lab distintos (módulo y lab van asociados 1:1 en origen). `_renderPreviewImportarAlumnos()` agrupa el checklist por Ciclo → Módulo con checkboxes en cascada (`_toggleGrupoImportar`), para poder incluir/excluir un ciclo o un módulo entero de golpe además de fila a fila. Los ya existentes salen atenuados y sin checkbox activo.
- `confirmarImportarAlumnos()` fusiona por email las matrículas marcadas (un alumno con varios módulos seleccionados junta `modulo`/`laboratorio` como listas separadas por coma con solo lo marcado) y llama a `{accion:'importar', alumnos:[{nombre,email,ciclo,modulo,laboratorio}, ...]}`.
- Por cada alumno importado, la Edge Function replica exactamente el patrón de `scripts/importar_alumnos.py`: fila en el catálogo `usuarios` (`id_usuario` con `genId('USR-')`) + cuenta real de Supabase Auth con contraseña temporal + fila en `public.users` (resolviendo/creando el `ciclo` si hace falta) — sin la cuenta de Auth el alumno no podría iniciar sesión. La función **no vuelve a consultar Sanidad CMA** en `accion:'importar'`: confía en los datos ya fusionados que manda el cliente (mismo nivel de confianza que ya tiene un Admin/Gestor en `gestionar-usuario`), para no perder qué módulos concretos se marcaron.
- Tras importar se muestra la tabla de contraseñas temporales (para repartir, no se guardan) y los omitidos con motivo; luego se recarga `loadAllData()`.
- **Pendiente:** importar también profesorado desde Sanidad CMA — bloqueado porque esa API hoy solo expone `/api/bioDesk/alumnos` (comprobado: `/profesores`, `/profesorado`, `/docentes` devuelven 404).

**Nota:** la función `importar-alumnos` existía desde antes de terminar la migración completa de Usuarios y en su versión original escribía en tablas relacionales (`ciclos`/`modulos`/`user_modulos` del proyecto de migración) que el frontend ya no lee — nunca llegó a conectarse a ningún botón. Se reescribió para alinearla con la arquitectura final (tabla `usuarios`).
