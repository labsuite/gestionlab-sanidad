# GestionLab – Estado del proyecto

App web de gestión de laboratorio para el CIFP Manuel Antonio (Vigo).
Stack: JS vanilla + HTML/CSS, Supabase (Postgres + Auth + Storage + Edge Functions) como backend.
URL de la app: `https://labsuite.github.io/gestionlab-sanidad/`

---

## Commit y push tras cada cambio de código

La app se sirve directamente desde `main` en GitHub Pages — sin commit y push, la usuaria **no puede ver ni probar** el cambio en la app real. Por tanto: siempre que se termine un cambio de código (JS/HTML/CSS) y esté verificada la sintaxis, hacer `git add` + `git commit` + `git push` sin esperar a que lo pida explícitamente cada vez. Si hay cambios de sesiones anteriores no relacionados mezclados en el working tree, separarlos en su propio commit en vez de mezclarlos.

---

## Documentación de módulos

Ver `docs/` para detalles de módulos completados y patrones de implementación:
- `docs/modulo-mantenimiento.md` — Planes_Mantenimiento / Registro_Mantenimientos, lógica de periodos, **dónde se gestiona cada cosa** (todo centralizado en la sección Mantenimiento desde 2026-09-06) y permisos por rol
- `docs/modulo-incidencias.md` — flujo Incidencia → Intervención (visita) → Tarea, estados derivados, visitas de seguimiento
- `docs/modulo-residuos.md` — GHS, ciclo de vida de contenedores, consultas, NFC/QR
- `docs/modulo-reservas.md` — políticas BLOCK/COMPATIBLE, estados, 23 equipos configurados
- `docs/modulo-registros-uso.md` — registros de calidad por sesión (cabina/autoclave/vitrina de gases), check-in/check-out NFC flexible; cada pestaña se describe entera en `_regConfig`
- `docs/modulo-usuarios.md` — columnas Usuarios, lógica alumnos, ciclos/módulos, usuarios _sbOnly
- `docs/modulo-pedidos.md` — estados pedido/solicitud, recepción de líneas, historial, eliminar ítems
- `docs/supabase.md` — integración actual + fases 2-4 pendientes
- `docs/patrones-ui.md` — autocomplete incidencias, tablas/líneas responsive, alertas stock dashboard
- `docs/proteccion-datos.md` — **qué datos personales guarda la app y por qué**; el alumnado entra por cuentas de grupo y firma con el nombre del grupo (lo impone el servidor con `autorRegistro()`). Leerlo antes de añadir cualquier campo de "quién hizo esto".

---

## Scripts de mantenimiento de base de datos (carpeta `scripts/`)

Permiten modificar Supabase (proyecto de migración `vnoecaqldymonkgrmvlj`) directamente
desde Claude Code, por conexión Postgres directa (pooler) con la contraseña de servicio —
bypassa RLS igual que las Edge Functions con la service_role key.
Credenciales en `scripts/supabase_credentials.json` (excluido de git).

**Google Sheets ya no es la base de datos de GestionLab** (retirado 2026-08-06 junto con el
cambio de login a Supabase Auth) — estos scripts operan sobre las tablas reales de Postgres,
no sobre ninguna hoja de cálculo. `scripts/credentials.json` (cuenta de servicio de Google)
ya no lo usa nada; se puede revocar si se quiere.

### Estructura
- `base.py` — conexión y funciones comunes (importar desde aquí)
- `test_conexion.py` — verifica que la conexión funciona
- `nuevo_residuo.py` — INSERT/UPDATE puntual en `tipos_residuo`
- `actualizar_riesgos_ghs.py` — UPDATE masivo del campo `riesgo` en `tipos_residuo` con pictogramas GHS; `DRY_RUN = True` por defecto
- `actualizar_planes.py` — UPDATE en `planes_mantenimiento` (operación, periodicidad, tipo...)
- `actualizar_equipos.py` — UPDATE en `equipos` (protocolos, temporadas, ubicaciones...)
- `limpiar_hoja.py` — DELETE en cualquier tabla con filtro; `DRY_RUN = True` por defecto
- `limpiar_inventario_fungible.py` — DELETE de todas las filas de las 8 tablas del módulo de fungibles; `DRY_RUN = True` por defecto
- `crear_grupos_alumnado.py` — alta de las cuentas de GRUPO del alumnado (`1cslcb@gestionlab.cma`…); `DRY_RUN` por defecto, idempotente, se ejecuta una sola vez
- `borrar_alumnado_personal.py` — elimina las cuentas personales de alumnado (catálogo + rol + login + recordatorios); `DRY_RUN` por defecto. ⚠ La baja del login falla con 504 muy a menudo: rematar siempre con `limpiar_logins_huerfanos.py`
- `asignar_grupos_profesorado.py` — primera propuesta de `usuarios.grupos_asignados` (qué grupo lleva cada docente), deducida de los módulos; `DRY_RUN` por defecto y solo escribe en quien no tenga nada. A partir de ahí se asigna a mano desde la app.
- `migrar_grupos_asignados.py` — crea la columna `usuarios.grupos_asignados`; ya ejecutado
- `limpiar_logins_huerfanos.py` — borra de Supabase Auth los logins sin fila en `usuarios` ni en `public.users`; `DRY_RUN` por defecto
- `anonimizar_propuestas.py` — borra el email de quien propuso en las propuestas ya resueltas; ejecutar al cerrar cada curso
- `importar_alumnos.py` — **RETIRADO**, aborta al arrancar (ya no hay cuentas personales de alumnado)
- `onboardear_auth_supabase.py` — alta en bloque de cuentas reales de Supabase Auth para todo el profesorado/alumnado activo del catálogo `usuarios` que aún no la tenga (mismo patrón que la Edge Function `crear-usuario`, en bloque)
- `rellenar_mantenimientos.py` — INSERT en `registro_mantenimientos` de todos los periodos de un curso como realizados (solo Internos); `DRY_RUN = True` por defecto. Usar al inicio de cada curso para poblar el historial.
- `migrar_solo_profesorado.py` — renombra `planes_mantenimiento.con_alumnado` a `solo_profesorado` e invierte el criterio (los mantenimientos internos pasan a ser del alumnado por defecto); se ejecuta una sola vez, idempotente
- `quitar_externos_excel.py` — elimina filas de Tipo_Intervencion=Externo de un XLSX ya exportado; busca automáticamente el más reciente en Descargas o acepta ruta como argumento. Genera `*_sin_externos.xlsx` sin tocar el original. (No toca Supabase — manipula el XLSX directamente.)
- `generar_modelo_calidad.py` — genera los dos Excel del modelo de calidad (inventario + plan de mantenimiento) desde Python; alternativa al botón de la app cuando se necesita uso puntual offline.
- `migrar_*.py` — scripts puntuales ya ejecutados que copiaron los datos de cada módulo desde Sheets a Supabase durante la migración; se conservan como registro histórico de cómo se pobló cada tabla, no hace falta volver a ejecutarlos.

### Flujo de trabajo
1. Usuario describe el cambio a Claude
2. Claude rellena la sección `CONFIGURACIÓN` del script correspondiente
3. Usuario ejecuta `! python scripts/<nombre>.py`
4. Los cambios aparecen directamente en Supabase (y por tanto en la app)

### Funciones de base.py
`ws`/`t` es un objeto `Tabla` (nombre de tabla + su PK + conexión) que devuelve `leer()` —
sustituye al `worksheet` de gspread. Las funciones de búsqueda devuelven valores de **clave
primaria**, no índices de fila (Postgres no tiene "fila 5").

| Función | Uso |
|---|---|
| `conectar()` | Devuelve la conexión a Postgres autenticada |
| `leer(conn, tabla)` | Devuelve `(t, columnas, datos)` |
| `buscar(t, campo, valor)` | PKs con coincidencia exacta |
| `buscar_multi(t, {campo: valor})` | PKs que cumplen todos los filtros |
| `buscar_contiene(t, campo, texto)` | Búsqueda parcial sin distinción de mayúsculas (`ilike`) |
| `todas_las_filas(t)` | PKs de todas las filas |
| `actualizar(t, pks, campo, valor)` | Actualiza un campo (batch) |
| `actualizar_varios(t, pks, {campo: valor})` | Actualiza varios campos (batch) |
| `actualizar_fila_por_fila(t, [(pk, {campo: valor})])` | Cambios distintos por fila |
| `eliminar(t, pks)` | Borra filas por PK |
| `eliminar_todas(t)` | Limpieza total de la tabla |
| `insertar(t, dict)` | Añade una fila |
| `insertar_varios(t, [dicts])` | Añade múltiples filas (batch) |
| `generar_id(prefijo)` | Genera un ID `PREFIJO` + 6 caracteres alfanuméricos al azar — mismo formato que `genId()` en `js/config.js` |
| `preview_filas(t, pks, campos)` | Muestra preview antes de actuar |

### Formatos de ID
Todas las tablas migradas usan IDs tipo `PREFIJO` + 6 caracteres alfanuméricos al azar
(p.ej. `RESHA8SA3`, `RM4F9K2X`), generados server-side en las Edge Functions o con
`generar_id()` en los scripts — ya no hay IDs secuenciales tipo `PREF-NNN` ni formatos
especiales por tabla que recordar (el antiguo `R` + 3 dígitos de `tipos_residuo` era propio
de Sheets; los residuos nuevos ya usan el formato `RES` + hash).

### Formato Excel para importar alumnos
Cabecera: `Nombre | Apellidos | Email | Ciclo | Modulos | Labs`
- Ciclo: nombre completo coincidente con Ciclos_Modulos
- Modulos: separados por coma
- Labs: números de lab separados por coma (ej: `201,203`)

---

## Exportación de documentos de calidad

Dos botones en el módulo de mantenimiento (`js/mantenimiento.js`) generan los Excel del modelo de calidad usando JSZip sobre las plantillas de `assets/templates/`. No requieren servidor; se ejecutan en el navegador.

### 📄 Exportar plan de mantenimiento (`exportarModeloCalidad`)
Plantilla: `assets/templates/MD84MAN01_Plan_mantemento_Sanidade.xlsx`
Salida: `MD84MAN01_Plan_mantemento_YYYY-YYYY.xlsx`
**Una fila por plan** (no por equipo × tipo). Columnas:

| Col | Contenido |
|-----|-----------|
| A | Denominación `Tipo_Equipo Marca Modelo (ID_Activo) · ID_Plan` |
| B | Nº de laboratorio extraído de Ubicacion (ej. `205`) |
| C | Responsable del equipo; si vacío → Gestores y Admins activos |
| D | Interno / Externo |
| E | Periodicidad del plan (normalizada; Pre/Posttemporada → `Anual`) |
| F | Operación del plan |
| G | Fechas previstas (`01/MM/YYYY` de cada periodo del curso completo) |
| H | Fechas de realización registradas en Registro_Mantenimientos |
| I | Gestores y Admins activos (supervisores) |
| J | Si hay incidencia abierta: `Descripcion_Problema (ID_Incidencia)` |

**Notas de implementación:**
- Los periodos se calculan con `getPeriodosCursoCompleto` (incluye futuros; los diez meses del curso, septiembre incluido, igual que el script Python).
- Al generar el XLSX se normalizan todas las fuentes del `xl/styles.xml`: Arial→Xunta Sans, `color theme="1"` (negro)→`#002B4A`, fuentes sin color→`#002B4A`, 8pt→10pt. El template tiene zonas de estilos que degeneran a negro a partir de la fila ~33-66 según hoja.
- Para eliminar los Externos del documento ya generado: usar `scripts/quitar_externos_excel.py`.

### 📋 Exportar inventario (`exportarInventario`)
Plantilla: `assets/templates/CIFP Manuel Antonio_Inventarios_Curso 2025-26.xlsx` (hoja `Sanidade`)
Salida: `Inventario_Sanidade_YYYY-YYYY.xlsx`
Una fila por equipo, ordenados por ubicación y tipo. Columnas:

| Col | Contenido |
|-----|-----------|
| A | Tipo_Equipo (ID_Activo) |
| B | Nº de laboratorio extraído de Ubicacion |
| C | Marca Modelo |
| D | Numero_Serie |
| E | 1 (unidades) |
| F | Si incidencia abierta: `Incidencia abierta. Impacto (ID_Incidencia)`; si no: Estado_Operativo |

**Extracción de nº de lab:** regex `\b(\d{3})\b` sobre el campo Ubicacion — funciona tanto con `Lab 205` como con `205-ZC-2.1`.

---

## Email al proveedor (detalle de pedido)

Botón **✉️ Email al proveedor** en la cabecera de "Líneas del pedido" en `verDetallePedido` (`js/pedidos-render.js`), visible para Administrador/Gestor cuando el pedido tiene al menos una línea. Abre el modal `modal-email-pedido` (`html/modales-pedidos.html`).

- `generarTextoEmailPedido(pedidoId)` construye el texto: saludo (usa `Persona_Contacto` del proveedor si existe, si no genérico "Buenos días,"), una línea por cada línea del pedido con material + cantidad + unidad (reutiliza `_unidadLineaPedido`, extraída de la lógica que ya usaba el listado de líneas), y cierre sin firma — la firma la añade el cliente de correo de la usuaria.
- Solo tiene botón **📋 Copiar texto** (`copiarTextoEmailPedido`, vía `navigator.clipboard`). No hay envío ni apertura directa del cliente de correo: la usuaria prefiere copiar, pegar y revisar antes de enviar.

---

## El alumnado entra por cuentas de GRUPO — minimización de datos

⚠ Desde 2026-09-19 **no hay cuentas personales de alumnado**. Cada grupo comparte una
cuenta (`1cslcb@gestionlab.cma` = "1º CS LCB", `nombre` del grupo en `usuarios`,
`rol = 'Alumno'`). No hay nombres ni emails de menores en ninguna tabla. Los permisos
no cambiaron: detrás de la fila de `usuarios` hay un grupo en vez de una persona.

- Alta de cuentas: `scripts/crear_grupos_alumnado.py` (una sola vez, no cada curso).
- Contraseña: aleatoria y dictable (`passwordDeGrupo()`). **Nunca** `passwordDesdeEmail()`
  en una cuenta de grupo — la parte local es el nombre del grupo.
- El profesorado la consulta y la cambia desde la app (Usuarios → Alumnos → 🔑). Se puede
  "ver" porque se guarda una copia **cifrada** en `credenciales_grupo`
  (`_shared/secretos.ts`, clave en el secreto `GRUPO_PASSWORD_KEY` de las Edge Functions,
  nunca en Postgres ni en el navegador). ⚠ Esto vale **solo** para cuentas de grupo: la
  contraseña de una persona no se guarda en ningún sitio, ni cifrada.
- Arriba de esa pestaña, la tarjeta **🎓 Mis grupos** da la cuenta y la contraseña de los
  grupos de quien mira. Cuáles son los "suyos" sale de `usuarios.grupos_asignados`, que se
  marca a mano en la ficha del docente (Admin/Gestor); **no** se deduce de los módulos, que
  da grupos de más y de menos.
- ⚠ Eso **sí restringe**: un Profesor solo ve y cambia la contraseña de sus grupos. Lo impone
  el servidor (`requiereGrupoPropio()`) en las tres puertas que tocan una contraseña de grupo:
  `ver_password_grupo`, `cambiar_password_grupo` y `resetear_password`. Admin y Gestor llegan
  a todos. Al añadir cualquier acción nueva que toque contraseñas de grupo, pasarla también
  por ahí. Ver `docs/modulo-usuarios.md`.
- El import de alumnado está **retirado** (botón quitado, Edge Function en 410, script
  aborta). El de profesorado sigue vivo.

**Cómo figura el profesorado en los registros: nombre y primer apellido**
("Paloma Fernández", no "Paloma Fernández López" ni "Paloma"). Lo aplica
`nombreCorto()` (`_shared/auth.ts`) en el servidor y su espejo `_nombreCorto()`
(`js/config.js`) en el cliente, para que en pantalla se vea lo que se va a
guardar. La regla es **quitar el último apellido**, no coger las dos primeras
palabras: "Ana Belén Silva Abuín" → "Ana Belén Silva" (con las dos primeras se
quedaría sin apellido) y "Sabela Fernández de Sanmamed Girón" → "Sabela Fernández
de Sanmamed". Con menos de tres palabras se deja igual ("Marta Alén"). ⚠ Nunca
aplicarlo a una cuenta de grupo ("1º CS LCB" → "1º CS") ni a un nombre de empresa
tecleado en "Realizado por" de un mantenimiento externo. Lo registrado antes de
2026-09-20 se dejó como estaba, a propósito.

Antes de guardar el nombre o el email de una persona en cualquier tabla, preguntarse si
la **seguridad del laboratorio** exige saber quién fue. Si no, usar `autorRegistro()` de
`supabase/functions/_shared/auth.ts`: devuelve el nombre del profesorado y el **nombre del
grupo** para el alumnado, decidiéndolo en el servidor a partir del rol del email de la
sesión e **ignorando lo que mande el navegador**.

Los registros de uso (`registros_cabina` / `registros_autoclave` / `registros_vitrina`) y
`reservas_equipos` guardan el email de la sesión, que ahora identifica **al grupo, no a la
persona** — decisión consciente, con su coste en trazabilidad. Detalle y justificación de
cada caso en `docs/proteccion-datos.md`.

---

## "Lee bien pero no deja guardar" = la sesión ha caducado

⚠ Las tablas se leen con la **clave anónima** (hay políticas RLS de solo lectura para
`anon`), pero escribir pasa siempre por una Edge Function, que exige el token de la sesión.
Por eso una sesión caducada no vacía la pantalla: la app pinta todos los datos como
siempre y solo falla al guardar. Pasa sobre todo en los dispositivos compartidos de las
cuentas de **grupo**, que se quedan abiertos días.

`callEdgeFunction()` (`js/sheets.js`) ya **no** manda la clave anónima como si fuese el
token cuando no hay sesión — eso producía un 401 "Sesión inválida o caducada" que cada
módulo traducía a su toast genérico ("Error al iniciar la sesión"…). Ahora avisa
"Tu sesión ha caducado…" y vuelve a la pantalla de login, tanto si no hay sesión como si
el servidor responde 401. No reintroducir el `|| SUPABASE_MIGRACION_ANON` de la cabecera
`Authorization`.

En los `catch` usar `showToast(e.message || '<texto de respaldo>', 'error')` — patrón ya
habitual en residuos, material y mantenimiento — para que el mensaje real del servidor
llegue a la pantalla en vez de quedar solo en la consola.

---

## Añadir una columna nueva a una tabla

⚠ Al añadir una columna a una tabla de Supabase, actualizar: la migración SQL (`supabase/schema.sql`),
la Edge Function `gestionar-*` correspondiente (leer/escribir el campo nuevo), la función
`_xSbToObj()` en `js/sheets.js` (mapea la fila de Supabase al objeto que usa el resto de la
app) y `COLS` en `js/config.js` si el módulo también tiene columnas legacy de Sheets. Si se
olvida el mapeo en `_xSbToObj()`, el campo llega siempre `undefined` en el navegador aunque
la columna exista en la base de datos.

(Ya no aplica el antiguo sistema de "rango A2:X" de Sheets — `loadAllData()` en `js/sheets.js`
lee todas las tablas directo de Supabase con `select('*')`.)

---

## Tablas dentro de tarjetas `.card`

⚠ **Nunca** poner `display: block` en un `<table>` (ni en el propio `<table>` ni vía un selector tipo `.card > table`) para darle scroll horizontal. Con `display: block` el navegador genera una caja de tabla anónima interna que ignora el `width`/`min-width` del `<table>` y lo encoge a su contenido, dejando una franja vacía en la tarjeta. Además, sin `display: block` los navegadores ignoran directamente `overflow` en un elemento con `display: table`, así que ponerlo en la propia tabla tampoco sirve.

El scroll horizontal de seguridad para tablas anchas está resuelto con `.card:has(table) { overflow-x: auto; overflow-y: hidden }` en `css/styles.css` — se aplica a la tarjeta, no a la tabla. La tabla se queda con su `display: table` normal para que `width: 100%` funcione bien. No reintroducir la variante `display:block` en ningún sitio.

---

## Etiquetas NFC/QR — la URL sale de `APP_URL`, nunca de `window.location`

⚠ Los tres generadores de etiqueta (`mostrarUrlNfc` en `js/ubicaciones.js`,
`mostrarUrlNfcContenedor` en `js/residuos.js`, `openModalNfcRegistro` en
`js/registros-uso.js`) llaman a `urlEtiqueta(params)` de `js/config.js`, que compone la URL
sobre la constante `APP_URL`. No volver a usar `window.location.origin + pathname`: la URL se
graba **físicamente en el chip** y se queda pegada a una puerta durante años, así que basta
generar la etiqueta desde un host distinto para dejar un tag muerto para siempre.

Ya pasó: las etiquetas escritas antes del traslado del repo a la organización `labsuite`
(2026-08-23) apuntan a `palomafedez.github.io`, que devuelve 404. **Cambiar `APP_URL` no
arregla los chips ya escritos** — si algún día se pone dominio propio u otro hosting, hay que
regrabar todas las etiquetas a mano desde la app (botones 🔗).

---

## Arquitectura general

- `index.html` — página principal, carga todos los scripts y modales
- `js/config.js` — constantes globales: DATA, COLS, ROLES, clientes Supabase (`_sb`, `_sbMigracion`)
- `js/auth.js` — Supabase Auth (email + contraseña), sesión gestionada por supabase-js
- `js/sheets.js` — `loadAllData()` (lee todas las tablas de Supabase), `callEdgeFunction()`, `subirDocumento()`/`abrirDocumento()` (Storage), y los `_xSbToObj()` de mapeo por tabla
- `js/ui.js` — navegación, renderAll(), badges, carga de modales
- `js/mantenimiento.js` — sistema completo de mantenimiento preventivo
- `js/residuos.js` — módulo de gestión de residuos
- `js/reservas.js` — módulo de reservas de equipos de laboratorio
- `js/equipos-render.js` — renderDashboard(), renderEquipos()
- `js/equipos-acciones.js` — guardarEquipo(), guardarIntervencion(), guardarActuacion()…
- `js/ubicaciones.js` — proveedores, ubicaciones, usuarios (incluye CRUD y modal de alumnos)
- `html/modales-equipos.html` — modales de equipo, intervención, actuación
- `html/modales-mantenimiento.html` — modales de registrar mantenimiento y gestionar plan
- `html/modales-residuos.html` — modales de residuos (tipo residuo, nivel, contenedor)
- `html/modales-reservas.html` — modales de reservas (nueva reserva, gestión, configurar equipo)
- `html/modales-catalogo.html` — modales de proveedor, ubicación, usuario
- `css/styles.css`

**Orden de carga de scripts en index.html:**
config.js → mantenimiento.js → auth.js → sheets.js → ui.js → equipos-render.js → equipos-acciones.js → … → tareas.js → residuos.js → reservas.js

---

## Tabla `equipos` — columnas

id_activo, tipo_equipo, marca, modelo, numero_serie, ubicacion, responsable,
modulos_responsables, fecha_adquisicion, origen_financiacion, proveedor_compra,
proveedor_servicio_tecnico, estado_operativo, manual_ficha_tecnica, observaciones, coste,
protocolo_uso, tipo_mantenimiento, mes_inicio_temporada, mes_fin_temporada.

`mes_inicio_temporada` / `mes_fin_temporada` siguen en esta tabla, pero desde 2026-09-06 se
editan **solo desde el modal del plan** (`Mantenimiento → Planes configurados`, planes
Pretemporada/Posttemporada) — los escribe la Edge Function `gestionar-mantenimiento`.
`gestionar-equipo` ya no los toca y se quitaron del modal de editar equipo. `tipo_mantenimiento`
sigue sin uso (nunca se rellena). Ver `docs/modulo-mantenimiento.md`.

`modulos_responsables` (añadido 2026-08-22): nombres de módulo separados por coma, texto
libre, igual que `responsable`. De qué módulo(s) depende el equipo — se usa al importar
profesorado desde Sanidad CMA para premarcar responsables por módulo coincidente en vez de
por laboratorio entero (ver "Importar profesorado" en `docs/modulo-usuarios.md`). Campo
opcional: si un equipo no lo tiene, se sigue premarcando por laboratorio como antes.

Las columnas legado de Sheets (Periodicidad_Mantenimiento, Periodicidad_Custom,
Fecha_Ultimo_Preventivo, Fecha_Proximo_Preventivo — sustituidas hace tiempo por
Planes_Mantenimiento + Registro_Mantenimientos) no se migraron a la tabla Postgres, no
existen aquí.

---

## Tabla `intervenciones` — columnas

id_intervencion, id_equipo, tipo, origen, fecha_planificada, fecha_realizacion,
realizado_por, tecnico_externo, proveedor, descripcion_actuacion, resultado,
equipo_operativo_tras_intervencion, url_adjunto, factura_asociada,
actualiza_proximo_preventivo, observaciones, nombre_adjunto, estado,
fecha_estimada_resolucion, coste_intervencion, actuacion_finalizada,
lugar_intervencion, fecha_retirada, fecha_devolucion.

`lugar_intervencion` / `fecha_retirada` / `fecha_devolucion` (añadidos 2026-09-16): el SAT
puede actuar en el propio centro (`'En el centro'`, valor por defecto) o llevarse el equipo a
su taller (`'Equipo retirado'`). Mientras haya una intervención retirada **sin**
`fecha_devolucion`, el equipo se considera fuera del centro y toda la app lo señala con el
cartel `📦 Fuera del centro` (`badgeEquipoFuera` / `intervencionEquipoFuera` en
`js/equipos-render.js`). Ese dato **no** se duplica en `estado_operativo`: se deriva de las
intervenciones, igual que el badge de impacto — si se copiara al estado del equipo,
`guardar_tarea` lo pisaría al recalcular el estado a partir de las tareas. Ver
`docs/modulo-incidencias.md`.

Una **Intervención** es una actuación/visita; cada `tareas_intervencion` es una acción
concreta dentro de ella. `resultado` y `estado` son **derivados** de las tareas por la Edge
Function `gestionar-intervencion` (`calcularResultadoAgregado` / `calcularEstadoIntervencion`)
— no se editan a mano.

`actuacion_finalizada` (boolean not null default false, añadido 2026-09-02): marca **explícita**
de que la usuaria pulsó "Guardar y finalizar actuación", independiente de `estado` (que puede
seguir "En gestión" si quedan tareas Pendiente). La escribe/borra la acción `actualizar` de la
Edge Function; `guardar_tarea` no la toca. Uso en cliente (`Actuacion_Finalizada` tras
`_intervencionSbToObj`, valor `'Sí'`/`'No'`):
- Al abrir el modal de actuación sobre una intervención finalizada → título "✏️ Editar
  intervención INT-XXX", banner ámbar de aviso ("no se crea una actuación nueva") y botón
  "↩︎ Reabrir actuación" (`reabrirActuacion`, pone la columna a `false`). Si está solo
  registrada (tiene `fecha_realizacion`) pero no finalizada → mismo título con banner azul.
- Los botones de entrada al modal se llaman siempre "✏️ Editar intervención"
  (ficha e hilo; "✏️ Editar" en las tablas, que la celda de acciones no da para más),
  esté la actuación finalizada o no — es la misma operación, y el modal edita la
  intervención entera (datos + tareas + resultado de cada tarea), no solo añade
  tareas. La excepción es una intervención aún `Planificada` sin finalizar:
  ahí el botón es "🔧 Ejecutar". El título del modal repite el nombre del botón.
- **Excepción — lista de Incidencias reportadas** (`renderIncidencias`): con la actuación
  finalizada NO se muestra botón de edición en la tarjeta (solo "🔗 Hilo" y "Eliminar"). Una
  incidencia puede acumular varias actuaciones, así que un "Editar actuación" ahí sería
  ambiguo; la edición se hace siempre desde el hilo. Mientras la actuación no está finalizada
  la tarjeta sí muestra "Ver / Actuar".
- Para una actuación **distinta** del mismo equipo: "📅 Programar otra actuación" en la ficha
  (crea una intervención encadenada), no reabrir la finalizada.

---

## Tipos de intervención – lista canónica

Aplica a los tres selects: `int-tipo` (modal intervención), `plan-tipo` (plan desde incidencia) y `act-tipo-int` (modal actuación). **No incluir "Preventivo"** — el mantenimiento preventivo se gestiona desde Planes_Mantenimiento.

`Correctivo` / `Calibración` / `Verificación funcional` / `Validación` / `Limpieza` / `Descontaminación` / `Sustitución de pieza` / `Cambio de consumibles` / `Control de temperatura` / `Puesta en marcha` / `Actualización de software`

---

## Categorías de material – lista canónica

Select `mat-categoria` en `html/modales-material.html`:

- Reactivo químico — ácidos, disolventes, bases, sales...
- Solución y tampón — formol, PBS, fijadores, diluciones...
- Colorante y tinción — HE, Giemsa, Papanicolaou, Diff-Quick...
- Medio de cultivo — agares, caldos, medios selectivos...
- Reactivo de biología molecular — extracción de ácidos nucleicos, electroforesis, cultivo celular... (Trizol, glucógeno, agarosa, poliacrilamida, FBS, antibióticos...)
- Kit diagnóstico — ELISA, pruebas rápidas, tiras...
- Material de vidrio — portas, cubreobjetos, matraces, pipetas...
- Material fungible — puntas, tubos, placas, Eppendorf...
- Papel y filtración — papel de filtro, membranas, papel secante...
- EPI y seguridad — guantes, gafas, batas, mascarillas...
- Equipamiento menor — aparatos pequeños no inventariados como activo fijo
- Otro

---

## Pendiente de hacer – CÓDIGO

### Árbol de decisión en Guía de residuos

**Pendiente:** esperando esquema definitivo de Consenur para estructurar el árbol.

Rediseñar `renderResiduosGuia()` para que la página tenga dos modos:

1. **Árbol de decisión** (vista por defecto) — estructura JS estática con nodos de pregunta y nodos hoja. Cada nodo hoja referencia un `Contenedor_Tipo` y opcionalmente IDs de `Tipos_Residuo`. Solo visible con login.
2. **Lista filtrada** (activada al escribir en el buscador) — el comportamiento actual de `_renderGuia()` agrupado por contenedor.

**Interactividad del árbol:**
- Clic en un **contenedor** (nodo hoja) → muestra los contenedores activos de ese tipo en `DATA.contenedoresResiduo` + botón "Añadir residuo aquí" que pre-selecciona el contenedor en el modal de adición (`openModalAdicion`).
- Clic en una **categoría de residuo** en el árbol → despliega inline los `tiposResiduo` de `DATA.tiposResiduo` que corresponden a esa rama.

**Archivos a modificar:** `js/residuos.js` (funciones `renderResiduosGuia`, `_renderGuia`, `filtrarGuia`). El árbol se define como objeto JS estático en el mismo archivo o en un bloque separado al inicio.

---

### Consultorio de residuos (Gemini) — implementado y activo

El antiguo plan de "asistente de IA guiado" genérico (6 temas, botón flotante) se descartó sin
llegar a implementarse. En su lugar se implementó un **consultorio de residuos** enfocado, dentro
de `residuos-guia` (`js/residuos.js`, funciones `abrirChatResiduo` / `_chatRes*`) — ver
`docs/modulo-residuos.md` para el diseño completo (guardarraíles del prompt, mecanismo de
etiquetas `[RESUELTO]`/`[NO_RESUELTO|...]`, validación de compatibilidad al añadir a un
contenedor). No hay `js/asistente.js` ni `html/modal-asistente.html` — todo vive en
`js/residuos.js` y `html/modales-residuos.html`.

**La clave de Gemini nunca vive en el navegador ni en el repo.** El chat (`js/residuos.js`,
`_llamarGemini()`) llama a `callEdgeFunction('gestionar-residuo', {accion:'consultar_ia', history})`,
y es la Edge Function (`llamarGeminiChat()` en `supabase/functions/gestionar-residuo/index.ts`)
quien de verdad habla con Gemini, leyendo la clave de `Deno.env.get("GEMINI_API_KEY")` — el mismo
secreto de servidor que ya usaba `leer-documento-proveedor` para leer facturas, configurado una
vez en Supabase (`updated_at` 2026-08-18), nunca en un archivo con `git`.

Se intentó primero un `fetch()` directo desde el navegador con la clave embebida en
`js/config.js` (como describía este plan originalmente) y GitHub bloqueó el push por
"push protection": la clave resultó ser de tipo "API Key ligada a una cuenta de servicio" de
Google Cloud, no una API Key normal restringida por referrer — exponerla en el HTML público
habría sido un riesgo real, no solo un secreto detectado por error. De ahí el cambio a proxy
server-side: **cualquier integración futura con Gemini (o cualquier API de terceros) debe pasar
por una Edge Function**, nunca por una clave incluida en JS/HTML servido desde GitHub Pages.

Modelo usado: `gemini-3.6-flash` (constante `GEMINI_MODELO` en el Edge Function, igual que
`leer-documento-proveedor` — confirmado vigente el 2026-08-19/21, y de nuevo el 2026-09-02 vía
`GET /v1beta/models`). Si en el futuro deja de responder, **volver a comprobar el modelo vigente**
con `GET /v1beta/models?key=...` antes de cambiar el nombre a ciegas — Google puede retirar modelos
con el tiempo. Ojo: `gemini-3.6-flash` devuelve **503 "high demand"** con cierta frecuencia (visto
el 2026-09-02, con el modelo perfectamente vigente); no confundir esos picos temporales con un
modelo retirado. `llamarGeminiChat` ya reintenta hasta 3 veces ante 503/429/500 y aborta cada
intento a los 22 s para no morir con `WORKER_RESOURCE_LIMIT`.

No enviar datos personales de usuarios a Gemini. Sin historial persistente (se borra al cerrar el modal).

### Comprobación de compatibilidad con IA al añadir a un contenedor (2026-09)

Además del consultorio, `añadir_adicion` en `gestionar-residuo` tiene una **capa IA** (Nivel 3)
que revisa si un residuo —del catálogo o descrito en texto libre en el modal "Añadir residuo"—
encaja de verdad en ESE contenedor con lo que ya lleva dentro. Ver `docs/modulo-residuos.md`
("Validación de compatibilidad al añadir"). Puntos a recordar al tocarlo:
- La validación determinista de Nivel 1/2 (categoría + matriz GHS) sigue siendo bloqueo duro y va
  **antes** de la IA; `ia_override` solo salta la IA, nunca Nivel 1/2.
- El bloqueo de la IA se devuelve como **200** con `{ ia_bloqueo:true, ... }` (no 400) para que
  `callEdgeFunction` no lo convierta en throw; el cliente inspecciona el objeto.
- `adiciones_residuo.id_residuo` es nullable + columna `descripcion_libre` (residuos no catalogados).
- Tabla `excepciones_residuo_ia`: se llena al pulsar "registrar igualmente" tras un `[BLOQUEO]`;
  es auditoría para Gestión y realimenta el prompt (casos ya aprobados no se vuelven a bloquear).

---

## Pendiente de hacer – DATOS

*(Pendientes que requieren acceso físico al instituto)*

### Campos en equipos – pendiente
- `Mes_Inicio_Temporada` / `Mes_Fin_Temporada` — **PENDIENTE (instituto)** para los 15 equipos estacionales (criostatos, microtomos, procesadores, estaciones de parafina, coagulómetros, citómetro, densitómetro, lámpara hemaglutinación)
- `Ubicacion` — **PENDIENTE (instituto)**: actualizar al ID correcto de la tabla Ubicaciones para coherencia interna. Los exports de calidad ya extraen el nº de lab por regex y funcionan con ambos formatos (`Lab 205` y `205-ZC-2.1`).

### Residuos
- Revisar que todos los tipos tengan `Contenedor_Tipo` relleno.
- Contenedores físicos: **PENDIENTE (instituto)** introducir en Contenedores_Residuo con nivel inicial.

### Reservas
- Revisar tolerancias de incubadoras (CO2 ±0.5%, temperatura ±0.5°C) y estufas/baños (temperatura ±1°C) con la gestora.
- Añadir más equipos reservables si procede.

---

## Notas de diseño importantes

- Los **protocolos de uso** NO generan alertas; se muestran solo al expandir la card del equipo.
- Las **temporadas** (mes inicio/fin) son ajustables por Administrador y Gestor desde la app.
- El **lavador de microplacas** tiene operación específica: limpieza periódica con disolución agua+lejía.
- Equipos muy específicos de una especialidad → estacionales. Equipos de uso general → periódicos.
- El modelo de calidad se entrega una vez al año; la app debe poder generarlo por curso académico.
- Las **categorías de contenedor de residuos** son dinámicas: emergen de los valores únicos de `Contenedor_Tipo` en Tipos_Residuo.
