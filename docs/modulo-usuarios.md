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

## Módulos y labs del profesorado / Gestores (2026-09-14)

Hasta ahora el bloque de **ciclo + módulos + labs** del modal de usuario solo se mostraba con
`Rol = Alumno`. El profesorado sí tenía esos datos en `usuarios` (los rellena
`importar-profesores` desde Sanidad CMA: `modulo`, `ubicaciones_asignadas`, `ciclo_principal`),
pero no había forma de verlos ni corregirlos desde la app — y peor: editar a un profesor para
cualquier otra cosa **le borraba módulos y labs**, porque `guardarUsuario` mandaba cadena vacía
en esos campos para todo rol que no fuera Alumno.

Ahora el bloque se muestra para `Alumno`, `Profesor` y `Gestor` (constante
`ROLES_CON_ASIGNACION` en `js/ubicaciones.js`). Administrador queda fuera a propósito: ve toda
la app, no se acota por laboratorio. La Edge Function `gestionar-usuario` ya aceptaba estos
campos para cualquier rol, así que no hizo falta tocarla.

**Diferencias entre el modo alumno y el modo docente** (`_esRolDocente(rol)`):

| | Alumno | Profesor / Gestor |
|---|---|---|
| Ciclo | `Ciclo formativo *`, obligatorio; filtra los módulos | `Ciclo principal (opcional)`; solo informativo, **no** filtra |
| Módulos | solo los del ciclo elegido | catálogo completo (`_renderModuloCheckboxesDocente`) + buscador `usr-modulos-buscar` |
| "Puede revisar inventario" | visible | oculto (y se guarda `false`) |

Un docente puede impartir en varios ciclos, de ahí que vea el catálogo entero. Como
`usuarios.modulo` guarda **nombres planos sin prefijo de ciclo**, un módulo que se repite en
varios ciclos aparece una sola vez, con los ciclos en los que existe como subtítulo.
`_onCicloPrincipalChange` sale pronto en modo docente para no borrar los módulos de otros
ciclos al cambiar el desplegable.

**Labs dinámicos:** los checkbox de laboratorio ya no están escritos a mano (`201/203/205/207`)
sino que salen de `_labsConocidos()` — números de 3 cifras de `DATA.ubicaciones.Laboratorio_Aula`
∪ `DATA.equipos.Ubicacion`, más los que ya tuviera el usuario. El profesorado importado puede
tener labs fuera de esa lista fija (p.ej. 209) y quedaban invisibles. Por lo mismo,
`_getLabsDeUbics` acepta ahora texto libre tipo `"Lab 209"` (lo que devuelve Sanidad CMA)
además de `"209"` y de IDs de `Ubicaciones`.

**Listado:** la tabla de `_renderTablaUsuarios` (pestañas *Admins y gestores* y *Profesores*)
muestra columnas **Módulo(s)** y **Labs**, con los helpers `_badgesModulos` / `_badgesLabs`
que comparte con la tabla de alumnado.

**IDs del modal renombrados:** `usr-alumno-fields` → `usr-asignacion-fields` y
`_populateModalUsuarioAlumno()` → `_populateModalUsuarioAsignacion(rol, ...)`, porque ya no son
solo de alumnado. Los checkbox de lab se pintan en `usr-labs-checks`.

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
- **Paso 2** (`_pasoDosImportarProfesores`): fusiona por email las asignaciones marcadas, calcula los labs (`p.labsValidos` del paso 1) y muestra los equipos de `DATA.equipos` en esos labs — todo en cliente, sin llamada al servidor. **Una `<details>` plegable por profesor** (`.importar-prof-details`, cerrada por defecto): el `<summary>` resume `Lab NNN · X equipos · Y marcados` (contador vivo, `_actualizarContadorEquiposImportar`). Con varios profesores a la vez la lista completa era inrevisable. Dentro de cada tarjeta: buscador (`_filtrarEquiposImportar`, sobre `tr[data-buscar]`) y botones **Todos / Ninguno / Solo por módulo** (`_bulkEquiposImportar`, `modo` ∈ `todos|ninguno|modulo`; "modulo" usa `data-modmatch` de cada checkbox).
  - **Premarcado (cambiado 2026-09-01):** SOLO se premarca un equipo si su `Modulos_Responsables` coincide con un módulo del profesor. Sin etiqueta (o etiqueta que no casa) → sin marcar. Antes se premarcaba el lab entero para los equipos sin etiqueta; con varios profesores eso sobreasignaba y era inmanejable. "Todos" recupera el marcado por lab completo para un profesor concreto.
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
vía `_normCiclo`). La tabla del paso 2 ahora muestra también la columna "Módulo(s)" del equipo. Es
un campo opcional de etiquetado progresivo: no hace falta rellenarlo en los 305 equipos de
golpe, solo en los que compartan laboratorio con equipos de otras especialidades.
**Actualización 2026-09-01:** los equipos SIN etiqueta ya no se premarcan por laboratorio (antes sí);
quedan sin marcar y se añaden con el botón "Todos" o uno a uno. Ver el punto de Paso 2 arriba.

**⚠ Los nombres de módulo se escriben en GALLEGO (2026-09-14).** El catálogo real de
módulos es el de Sanidad CMA (`/api/bioDesk/profesores`), que los devuelve en gallego
("Análise Bioquímica", "Microbioloxía Clínica", "Bioloxía Molecular e Citoxenética",
"Técnicas Xerais de Laboratorio"...) y así se guardan en `usuarios.modulo`.
`equipos.modulos_responsables` se había rellenado en castellano; como `_normCiclo()` sólo
quita tildes y mayúsculas —**no traduce**— ninguna etiqueta casaba y el afinado por módulo
no premarcaba nada en 302 de los 305 equipos. Corregido con
`scripts/normalizar_modulos_equipos.py`. **Al etiquetar un equipo, usar siempre el nombre
del catálogo** (el autocompletado del modal ya lo ofrece); una etiqueta en castellano es
silenciosamente inútil, no da ningún error.

**Criterio de la etiqueta (confirmado 2026-09-14):** identifica el **módulo al que pertenece
el equipo**, no "material de uso común". Por eso `scripts/reasignar_modulos_labs_207_209.py`
pasó los 51 equipos generales del Lab 207 a `Procesamento Citolóxico e Tisular` (único módulo
que se imparte allí) y los 16 microscopios del Lab 209 a `Citoloxía Xeral, Citoloxía
Xinecolóxica`. Ojo: el laboratorio del horario es una pista, no una regla — un autoanalizador
guardado en el Lab 203 sigue siendo de `Análise Bioquímica` aunque el módulo se imparta en el
201. Manda lo que el equipo es, no dónde está guardado.

**Historia de esta sesión, por si se repite:** la API de Sanidad CMA (`sanidade-cma-app.vercel.app`) tuvo en algún momento un problema aparente de doble codificación UTF-8 en `nombre`/`ciclo`/`modulo` — resultó ser un falso positivo: los bytes en origen ya eran UTF-8 correcto (verificado con inspección de bytes crudos), el mojibake era solo cómo lo mostraba la terminal local. El equipo de Sanidad CMA añadió igualmente `charset=utf-8` explícito al `Content-Type` como medida defensiva (no hacía falta para Deno `fetch().json()`, que decodifica UTF-8 siempre, pero no está de más).
