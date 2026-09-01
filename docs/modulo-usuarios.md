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
**Nota:** la función `importar-alumnos` existía desde antes de terminar la migración completa de Usuarios y en su versión original escribía en tablas relacionales (`ciclos`/`modulos`/`user_modulos` del proyecto de migración) que el frontend ya no lee — nunca llegó a conectarse a ningún botón. Se reescribió para alinearla con la arquitectura final (tabla `usuarios`).

## Importar profesorado desde Sanidad CMA (2026-08-07)

Botón **📥 Importar profesorado** junto al de alumnado (renombrado a "📥 Importar alumnado" para diferenciarlos). Abre `modal-importar-profesores`, con **dos pasos** (a diferencia del de alumnado): el módulo que imparte un profesor determina de qué equipos es responsable (los equipos del lab de ese módulo), así que hay un paso intermedio para revisar/confirmar esa asignación antes de importar.

- Edge Function nueva `importar-profesores`, consulta `/api/bioDesk/profesores` de Sanidad CMA (mismo `x-api-key`). Igual que alumnos: una fila por profesor×módulo, `laboratorio` puede venir `null` si ese módulo concreto no tiene aula asignada en Sanidad CMA (caso legítimo, no error).
- **Paso 1** (`_pasoUnoImportarProfesores`): mismo checklist agrupado Ciclo → Módulo en cascada que alumnado (clase `importar-profesor-check`).
- **Paso 2** (`_pasoDosImportarProfesores`): fusiona por email las asignaciones marcadas, y para cada profesor calcula los labs derivados (`_extraerLabDeUbicacion`, regex `\b(\d{3})\b` sobre `Ubicacion`, igual que usan los exports de calidad) y muestra un checklist con los equipos de `DATA.equipos` en esos labs — todo calculado en el cliente, sin llamada al servidor. Premarcados por defecto, pero revisables: un lab compartido grande (p.ej. 205) puede tener ~90 equipos, no todos con sentido para ese profesor en concreto.
- **Solo se muestran/importan asignaciones profesor×módulo cuyo laboratorio tiene equipos en GestionLab** (decisión de la usuaria; endurecido 2026-09-01):
  - **Origen del dato:** `laboratorio` lo rellena Sanidad CMA (`/api/bioDesk/profesores`). Hasta 2026-09-01 salía de `modulos.aula_id` (aula de teoría por defecto del módulo) y venía `null` casi siempre → el import no encontraba ningún lab. Corregido en el repo `sanidade-cma-app` (`fix/biodesk-profesores-laboratorio-horarios`): ahora `laboratorio` se agrega de las **sesiones reales del docente** en la tabla `horarios` para ese módulo+ciclo (aulas distintas donde imparte, unidas por coma, p.ej. `"Lab 209, Lab 205"`), con fallback a `modulos.aula_lab_id` → `aula_id` si no hay horario.
  - **Filtro en cliente (`_cargarPreviewImportarProfesores`):** de `laboratorio` se extraen los nº de 3 cifras (`/\d{3}/g`), se intersecan con los labs que tienen algún equipo en `DATA.equipos` (`_extraerLabDeUbicacion` sobre `Ubicacion`) y el resultado se guarda en `p.labsValidos`. Una fila solo pasa a `_previewProfesoresCMA` si `labsValidos.length`. Así se descartan aulas teóricas (`"Aula 200-1 (202)"`). El contador de descartadas (`_profesoresSinLabDescartados`) se avisa en el paso 1. Paso 2 usa `p.labsValidos` directamente.
  - **Módulos transversales excluidos siempre:** `MODULOS_SIN_RESPONSABILIDAD_EQUIPOS` (constante en `js/ubicaciones.js`) — Afondamento nas Competencias Profesionais, FCT, Proxecto, FOL, EIE, Itinerario Personal para a Empregabilidade, Dixitalización/Sustentabilidade. `_moduloDaResponsabilidadEquipos()` los detecta por subcadena normalizada y les fuerza `labsValidos = []` aunque su aula del horario sí tenga equipos (caso real: Afondamento se imparte en "Lab 201", que tiene 27 equipos, pero no procede responsabilidad). Ampliar la lista si aparecen más.
- **Layout del paso 1 (2026-09-01):** el checklist ya no usa una `<table>` anidada por módulo (se veía fatal en el modal, peor en tablet/móvil). Cada profesor es un `<label>` flex que envuelve (nombre + email en bloque, lab, badge). Además se corrigió el bug de fondo: la regla global `input { width:100% }` de `css/styles.css` también aplicaba a los checkbox, que dentro de un `<label>` flex empujaban el texto al extremo y aparecían "flotando" — ahora hay `input[type="checkbox"], input[type="radio"] { width:auto }` global.
- `confirmarImportarProfesores()` envía `{accion:'importar', profesores:[{nombre,email,ciclo,modulo,laboratorio,equipos_responsable:[id_activo,...]}]}`. La Edge Function crea usuarios+Auth+public.users igual que alumnado (rol `Profesor`), y por cada `id_activo` en `equipos_responsable` **añade** el nombre al campo `equipos.responsable` (split por coma, evita duplicados) sin pisar los responsables que ya hubiera.
- Resultados: misma tabla de contraseñas temporales que alumnado, más una columna de equipos actualizados por profesor.

**Afinado por módulo, no solo por laboratorio (2026-08-22):** la sugerencia por laboratorio
tiene un problema en labs compartidos grandes (Lab 205 tiene 122 equipos): dos profesoras de
especialidades distintas en el mismo lab (p.ej. Hematología y Microbiología) recibían
exactamente el mismo checklist completo, obligando a desmarcar a mano equipos que no les
correspondían (el Coulter no es de Microbiología, aunque esté en el mismo lab). Para
resolverlo, `equipos` tiene ahora un campo opcional `Modulos_Responsables` (nombres de módulo
separados por coma, editable en el modal de equipo igual que "Responsable(s)", con
autocompletado sobre `DATA.ciclosModulos`). En `_pasoDosImportarProfesores()`
(`js/ubicaciones.js`): si un equipo tiene módulo(s) etiquetado(s), solo se premarca cuando
coincide con alguno de los módulos del profesor (comparación insensible a tildes/mayúsculas
vía `_normCiclo`); si no tiene ninguno, se mantiene el comportamiento anterior (premarcado por
laboratorio). La tabla del paso 2 ahora muestra también la columna "Módulo(s)" del equipo. Es
un campo opcional de etiquetado progresivo: no hace falta rellenarlo en los 305 equipos de
golpe, solo en los que compartan laboratorio con equipos de otras especialidades.

**Historia de esta sesión, por si se repite:** la API de Sanidad CMA (`sanidade-cma-app.vercel.app`) tuvo en algún momento un problema aparente de doble codificación UTF-8 en `nombre`/`ciclo`/`modulo` — resultó ser un falso positivo: los bytes en origen ya eran UTF-8 correcto (verificado con inspección de bytes crudos), el mojibake era solo cómo lo mostraba la terminal local. El equipo de Sanidad CMA añadió igualmente `charset=utf-8` explícito al `Content-Type` como medida defensiva (no hacía falta para Deno `fetch().json()`, que decodifica UTF-8 siempre, pero no está de más).
