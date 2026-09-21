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

## Eliminar usuarios (2026-09-14)

Botón 🗑️ junto al ✏️ en las tres pestañas de Usuarios. **Solo Administrador** —mismo criterio
que `eliminarItems` en `PERMISOS` (`js/ui.js`), que es como se borran equipos y material—,
comprobado en cliente (`borrarUsuario` en `js/ubicaciones.js`) y otra vez server-side con
`requireAdmin` en la acción `eliminar` de `gestionar-usuario`.

**Borra los tres sitios donde vive una persona**, en este orden: la cuenta de Supabase Auth
(el login), la fila de `public.users` (el rol) y la fila del catálogo `usuarios`. Borrar solo
el catálogo —que es lo que haría lo obvio— deja un medio-borrado confuso: esa persona sigue
pudiendo iniciar sesión y `getRealUserRole()` (`js/ui.js`) la trata como **Alumno**.

**Guardarraíles** (los tres devuelven error, no borran nada):

| Caso | Motivo |
|---|---|
| Es responsable de algún equipo | `equipos.responsable` guarda el **nombre** en texto; al borrarle, esos equipos quedarían apuntando a alguien que ya no existe. Hay que reasignarlos antes. Mismo criterio que `borrarProveedor` con pedidos asociados. |
| Es tu propia cuenta | Te dejaría fuera de la app. |
| Usuario `_sbOnly` | No tiene fila en el catálogo: se gestiona desde la otra app. El botón ni se pinta. |

El bloqueo por equipos es el importante: en septiembre de 2026 hubo que limpiar docentes
duplicados y dos de ellos eran responsables de 238 y 30 equipos — borrarlos sin más habría
dejado esos equipos huérfanos y sus dueñas sin verlos al entrar con la otra cuenta. Lo que se
hizo fue traspasar el nombre primero y borrar después; el guardarraíl obliga a ese orden.

Si la cuenta de Auth no se puede borrar pero sí el resto, la función responde `200` con un
campo `aviso` y el cliente lo enseña como error sin dar el borrado por limpio.

## `usuarios` (catálogo) vs `public.users` (permisos) — sincronizar el rol (2026-09-14)

⚠ Son dos sitios distintos y **los dos mandan, cada uno en su capa**:

- `usuarios` es el catálogo que lee el navegador; de ahí sale `getRealUserRole()`
  (`js/ui.js:208`) y por tanto qué botones se ven.
- `public.users` es lo que consultan las Edge Functions (`_shared/auth.ts`,
  `requireAdminOrGestor` / `requireStaff`) para decidir si aceptan la escritura.

Hasta ahora `gestionar-usuario` actualizaba solo el catálogo. Consecuencia real: promover a
alguien a Gestor desde la app le cambiaba el rol en la interfaz —veía los botones de Gestor—
pero el servidor le seguía tratando como Profesor y le devolvía **403** en todo lo de
Admin/Gestor. Apareció con el profesorado importado de Sanidad CMA: el import siempre crea
`public.users` con `rol: "Profesor"`, y al promocionar a alguien después el descuadre quedaba
fijo (había tres personas así, ya corregidas).

La acción `actualizar` de `gestionar-usuario` replica ahora `nombre`, `rol` y
`puede_revisar_inventario` en `public.users`, casando por el email **anterior**
(`existente.email`). El email **no** se sincroniza a propósito: `requireRoles` busca en
`public.users` por el correo con el que la persona inicia sesión en Auth, y cambiar el correo
del catálogo no cambia el de la cuenta de Auth — sincronizarlo dejaría a esa persona sin rol.
Que no exista fila en `public.users` no es un error (la persona aún no tiene cuenta de acceso):
se registra en el log y la actualización del catálogo sigue adelante.

**Al tocar roles, comprobar siempre las dos tablas.** Consulta de control:

```sql
SELECT u.nombre, u.rol AS catalogo, p.rol::text AS permisos
FROM usuarios u LEFT JOIN public.users p ON lower(p.email) = lower(u.email)
WHERE u.rol <> 'Alumno' AND (p.rol IS NULL OR p.rol::text <> u.rol);
```

`public.users.rol` es un enum (`user_role`), así que hace falta `::text` para compararlo con el
`text` de `usuarios.rol`.

**Contraseñas temporales:** la convención que usa el centro para repartirlas no se documenta
aquí — este repositorio es público. Igual que en `scripts/importar_alumnos.py`, se imprimen una
vez para repartirlas y nunca se guardan en un fichero. Ojo con el mínimo de 6 caracteres de
Supabase Auth: algún correo corto no llega y necesita otra contraseña.

## Módulos que no interesan en GestionLab (2026-09-17)

`MODULOS_AJENOS_A_GESTIONLAB` en `js/ubicaciones.js`: los transversales que no se dan en
laboratorio ni tocan equipamiento — Afondamento nas Competencias Profesionais, FCT, Proxecto,
FOL, EIE, Itinerario Persoal para a Empregabilidade, Dixitalización Aplicada aos Sectores
Produtivos, Sostenibilidade Aplicada ao Sistema Produtivo, Inglés Profesional y Habilidades
Comunicativas en Lingua Estranxeira. Se comparan por subcadena normalizada
(`_moduloInteresaEnGestionLab` → `_normCiclo`), así que **los nombres van en gallego, como los
devuelve Sanidad CMA** (una entrada castellanizada no excluye nada y no da ningún error).

Dónde se aplica:
- **Import de alumnado** (`_cargarPreviewImportarAlumnos`): las matrículas de esos módulos se
  descartan antes de pintar el checklist y se avisa de cuántas eran. Un alumno cuyo único
  módulo sea transversal deja de aparecer en el import; es lo buscado (no tiene laboratorio).
- **Checklist de módulos del modal de usuario** (`_renderModuloCheckboxesPorCiclo` y
  `_renderModuloCheckboxesDocente`): no se ofrecen. Excepción: si una persona ya los tenía
  guardados siguen visibles y marcados, para poder quitárselos.

`MODULOS_SIN_RESPONSABILIDAD_EQUIPOS` (import de profesorado) es ahora esta lista **más
`Necropsias`**: Necropsias sí es un módulo de laboratorio —su alumnado se importa— pero no usa
equipamiento inventariado, así que no genera responsabilidad de equipos. Al ampliar, pensar en
cuál de las dos listas toca.

## Permiso de revisar inventario en bloque (2026-09-17)

La casilla "Puede revisar inventario de material fungible" del modal de usuario sigue igual;
además, la pestaña **Alumnos** tiene ahora una columna **Inventario** con la misma casilla por
fila y, en la cabecera de cada tarjeta de ciclo, **✅ Todos / ⬜ Ninguno**.

- Las acciones de grupo actúan sobre las **filas visibles** de ese grupo, así que el buscador y
  el filtro por módulo acotan a quién se aplica (p.ej. "todo el alumnado de Microbioloxía
  Clínica de 1º"). Piden confirmación con el número de personas afectadas.
- Backend: acción `revisar_inventario` de `gestionar-usuario` (`{ids:[...], valor}`), que
  actualiza `usuarios` y replica en `public.users` por lo mismo que `actualizar`. `requireStaff`
  + un Profesor solo puede tocar filas con `Rol = Alumno`.
- Los usuarios `_sbOnly` salen con la casilla deshabilitada (no tienen fila en el catálogo).

## Cuentas de grupo del alumnado (2026-09-19)

⚠ **El alumnado ya no tiene cuenta personal.** Cada grupo comparte una única cuenta:

| Grupo | Cuenta | Contraseña |
|---|---|---|
| 1º CS LCB | `1cslcb@gestionlab.cma` | propia del grupo, aleatoria |
| 2º CS APC | `2csapc@gestionlab.cma` | … |

Formato del email: `<curso><ciclo><especialidad>@gestionlab.cma`, todo junto y en
minúsculas (`1cslcb`, `2zsapc`). El dominio es inventado y **no existe**: no se manda
ni se recibe correo en esas cuentas, solo sirven para el login (comprobado: Supabase Auth
acepta el dominio y admite varias sesiones simultáneas con la misma cuenta, cada una con
su token).

En el catálogo `usuarios` la fila del grupo tiene `nombre = "1º CS LCB"` y `rol = 'Alumno'`,
así que **toda la lógica de permisos sigue igual**: `getUserRole()`, `PERMISOS.Alumno`,
`getUbicacionesAlumno()`, la pestaña Alumnos agrupada por `Ciclo_Principal`… nada de eso
hubo que tocarlo. Lo único que cambia es que detrás de esa fila hay un grupo y no una persona.

**Alta:** `scripts/crear_grupos_alumnado.py` (lista de grupos en la sección `CONFIGURACIÓN`,
`DRY_RUN` por defecto). Es idempotente y se ejecuta **una sola vez**, no cada curso: los
grupos no cambian de un año a otro. Para quitar un grupo que no exista, bórralo desde la
página Usuarios con el botón 🗑️ (borra catálogo + rol + login).

**Contraseña:** aleatoria y dictable, tipo `monte-auga-698` (`passwordDeGrupo()` en
`_shared/auth.ts`). **No** se deriva del email como la del alumnado individual: la parte
local es el propio nombre del grupo, así que `passwordDesdeEmail()` la dejaría a la vista de
cualquiera. Se consulta y se cambia desde la app — ver el apartado siguiente. Conviene
cambiarlas al inicio de cada curso.

## Contraseña de un grupo: consultarla y cambiarla (2026-09-21)

La cuenta de un grupo es compartida a propósito: su contraseña no es un secreto personal,
es más bien como la clave del wifi del aula. El profesorado tiene que poder decírsela a su
grupo y rotarla sin llamar a nadie. Pero Supabase Auth solo guarda un **hash**: una
contraseña no se puede "ver", solo sustituir.

Por eso se guarda aparte una copia **cifrada** (AES-256-GCM,
`supabase/functions/_shared/secretos.ts`) en la tabla `credenciales_grupo`
(`id_usuario` → `password_cifrada`, `actualizado_en`, `actualizado_por`). La clave de
cifrado es el secreto de servidor `GRUPO_PASSWORD_KEY` de las Edge Functions, que **nunca
está en Postgres**: quien tenga una copia de la base de datos (o la contraseña del pooler de
`scripts/`) no puede leer ninguna contraseña. La tabla tampoco la lee el navegador — RLS
activa sin políticas y `revoke` a `anon`/`authenticated`, solo la toca el `service_role`.
Mismo planteamiento que `grupo_credenciais` en Trebello.

**Dónde:** Usuarios → pestaña Alumnos → botón 🔑 de la fila del grupo, que abre
`modal-password-grupo` (`abrirPasswordGrupo` en `js/ubicaciones.js`). No enseña nada al
abrirse: hay que pulsar **👁️ Mostrar contraseña**. Con ella a la vista hay **📋 Copiar**,
**🙈 Ocultar**, **🔄 Generar una nueva** y **✏️ Escribirla yo** (mínimo 6 caracteres, el de
Supabase Auth). La contraseña solo vive en memoria mientras el modal está abierto.

**Acciones de `gestionar-usuario`:** `ver_password_grupo` y `cambiar_password_grupo`, ambas
`requireStaff` — Administrador, Gestor y Profesor, que son quienes dan clase al grupo. Las
dos comprueban en el servidor que la fila es de verdad una cuenta de grupo
(`esCuentaDeGrupo()`): la contraseña de una **persona** no se guarda en ningún sitio, ni
cifrada, y pedirla devuelve 400. `resetear_password` también refresca la copia cuando la
cuenta es de grupo, para que "Mostrar contraseña" no enseñe una que ya no vale.

**Grupos creados antes de esto** (los que dio de alta `crear_grupos_alumnado.py`) no tienen
copia guardada: el modal lo dice y ofrece generar una nueva. Si algún día se pierde el
secreto `GRUPO_PASSWORD_KEY`, pasa lo mismo — no se recupera nada, se rotan las contraseñas.

**Por qué:** protección de datos — así no hay nombres ni emails de menores en la base de
datos. Ver `docs/proteccion-datos.md` para el detalle, incluido el efecto sobre los registros
de uso (pasan a identificar al grupo, no a la persona).

## Import de alumnado: RETIRADO (2026-09-19)

Los tres caminos que creaban cuentas personales de alumnado están cerrados:

| Camino | Estado |
|---|---|
| Botón "📥 Importar alumnado" | Eliminado: botón, modal `modal-importar-alumnos` y funciones `abrirModalImportarAlumnos` / `_cargarPreviewImportarAlumnos` / `_renderPreviewImportarAlumnos` / `confirmarImportarAlumnos` |
| Edge Function `importar-alumnos` | Desplegada pero responde **410** con el motivo (mejor que un 404 mudo para una pestaña sin recargar) |
| `scripts/importar_alumnos.py` | Aborta nada más arrancar |

**Trebello no servía para esto de todos modos.** `/api/bioDesk/alumnos` devuelve
`{nombre, email, ciclo, modulo, laboratorio}` — una fila por matrícula alumno×módulo — y
**no expone el curso (1º/2º)** ni ningún endpoint de grupos (`/grupos`, `/cursos`, `/ciclos`
dan 404). Tampoco devuelve los ciclos **ZS**: solo CS. Por eso la lista de grupos vive en
`scripts/crear_grupos_alumnado.py` y no se importa.

El import de **profesorado** no se toca: son adultos, personal del centro, y su nombre hace
falta para la responsabilidad sobre equipos.

## Contraseña del alumnado y "Restablecer contraseña" (2026-09-17)

> ⚠ Lo de abajo describe el sistema de **cuentas personales**, ya retirado. Se conserva
> porque el botón 🔑 y `passwordDesdeEmail()` siguen existiendo para el profesorado y para
> cualquier cuenta que no sea de grupo.


La contraseña de una cuenta de alumnado es **la parte del email anterior a `@`**, en minúsculas
— la misma convención que TRebello, para no obligarles a recordar dos. Se genera con
`passwordDesdeEmail()` (`supabase/functions/_shared/auth.ts`); las partes locales de menos de 6
caracteres se completan con dígitos (`ana` → `ana123`) porque Supabase Auth exige ese mínimo.
La usa el import de alumnado de la app (`importar-alumnos`) y `scripts/importar_alumnos.py`.
El profesorado sigue con contraseña aleatoria: su import no se ha tocado.

**Restablecer:** botón 🔑 en cada fila de alumnado que **no** sea cuenta de grupo (las de
grupo abren el modal de contraseña descrito arriba; el botón de restablecer en bloque se
retiró al quedar un grupo por ciclo). Acción `resetear_password` de
`gestionar-usuario`: busca la cuenta de Auth por `public.users` —y solo si no está ahí pide el
listado completo de Auth, una vez— y hace `auth.admin.updateUserById`. **No manda ningún
correo**: devuelve la contraseña para dictarla en clase (el alumnado no siempre puede abrir su
buzón de la Xunta desde el aula). Por eso el resultado se enseña en un `alert`, no en un toast.
Permisos: `requireStaff`, y un Profesor solo puede restablecer contraseñas de alumnado.

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

  **Revisión 2026-09-14 — tres fallos en este filtro:**
  1. `Itinerario Personal para a Empregabilidade` y `Sustentabilidade Aplicada ao Sistema
     Produtivo` estaban escritos con el nombre castellanizado; Sanidad CMA los devuelve como
     `Itinerario Persoal...` y `Sostenibilidade...`, así que **no excluían nada** y ambos
     ofrecían los labs 201/207/209.
  2. Añadidos `Inglés Profesional` y `Habilidades Comunicativas en Lingua Estranxeira`
     (transversales de idioma que se imparten en labs con equipos) y `Necropsias` (módulo de
     especialidad que no usa equipamiento inventariado, confirmado por la usuaria).
  3. **El número de aula de otro departamento se confundía con el laboratorio de Sanidade.**
     `const nums` usaba `/\d{3}/g` sobre `p.laboratorio`, así que `"Aula 207 (Dpto. Química)"`
     se leía como el Lab 207 y ofrecía sus 61 equipos de Anatomía Patolóxica al profesorado de
     Química (lo mismo con `"Aula 209 (Dpto. Química)"` y los 8 módulos de ese departamento).
     Ahora se exige el patrón `Lab NNN` (`/\bLab\.?\s*(\d{3})\b/gi`): las aulas propias
     siempre llegan como `"Lab 205"`, las ajenas como `"Aula 207 (Dpto. Química)"` o
     `"Lab A-204.1 (Dpto. Química)"`. Ojo: `_extraerLabDeUbicacion()` sigue usando `\d{3}`
     porque se aplica a `equipos.Ubicacion`, donde sí valen formatos como `205-ZC-2.1`.

  Tras la revisión, los módulos que generan responsabilidad de equipos son exactamente los 11
  de laboratorio de Sanidade más `Elección e Adaptación de Próteses Auditivas` (audioloxía
  usa el Lab 209 según el horario de origen).

  **Módulos sin equipos a propósito:** `Necropsias` (no usa equipamiento) y `Xestión de
  Mostras Biolóxicas` (muy general, apenas usa equipamiento propio). No hace falta etiquetarles
  equipos: la acotación de lo que ve un profesor va por `equipos.Responsable`, no por
  `Modulos_Responsables` — en Equipos se ve el catálogo completo y solo Dashboard y
  Mantenimiento se filtran, por responsabilidad nominal.
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

**Actualización 2026-09-14 — el paso 2 ya no filtra solo por laboratorio.** `equiposDeSusLabs`
era `DATA.equipos.filter(e => p.labs.includes(_extraerLabDeUbicacion(e.Ubicacion)))`, así que un
equipo etiquetado con el módulo del profesor pero **guardado en otro laboratorio** no llegaba
siquiera a aparecer en la lista: no había forma de premarcarlo ni de marcarlo a mano. Casos
reales: el lector y el lavador de microplacas de `Técnicas de Inmunodiagnóstico` viven en el Lab
205 y el módulo se imparte en el 201 (la profesora veía 0 de 27 marcados); los autoanalizadores
y fotómetros de `Análise Bioquímica` están en el 203 y el módulo se da en el 201. Ahora la lista
es **equipos de sus labs ∪ equipos etiquetados con alguno de sus módulos**, y el premarcado sigue
siendo el mismo criterio de coincidencia de módulo.

Efecto conocido y aceptado por la usuaria: como `Técnicas Xerais de Laboratorio` etiqueta 238
equipos repartidos por todos los laboratorios, quien imparte ese módulo pasa de ~76 a ~171
equipos premarcados. Para eso están los botones **Ninguno** y **Solo por módulo** del paso 2.

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
