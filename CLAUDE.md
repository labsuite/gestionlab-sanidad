# GestionLab – Estado del proyecto

App web de gestión de laboratorio para el CIFP Manuel Antonio (Vigo).
Stack: JS vanilla + HTML/CSS, Supabase (Postgres + Auth + Storage + Edge Functions) como backend.
URL de la app: `https://palomafedez.github.io/gestionlab-sanidad/`

---

## Commit y push tras cada cambio de código

La app se sirve directamente desde `main` en GitHub Pages — sin commit y push, la usuaria **no puede ver ni probar** el cambio en la app real. Por tanto: siempre que se termine un cambio de código (JS/HTML/CSS) y esté verificada la sintaxis, hacer `git add` + `git commit` + `git push` sin esperar a que lo pida explícitamente cada vez. Si hay cambios de sesiones anteriores no relacionados mezclados en el working tree, separarlos en su propio commit en vez de mezclarlos.

---

## Documentación de módulos

Ver `docs/` para detalles de módulos completados y patrones de implementación:
- `docs/modulo-mantenimiento.md` — hojas Planes_Mantenimiento / Registro_Mantenimientos, lógica de periodos
- `docs/modulo-incidencias.md` — flujo Incidencia → Intervención (visita) → Tarea, estados derivados, visitas de seguimiento
- `docs/modulo-residuos.md` — GHS, ciclo de vida de contenedores, consultas, NFC/QR
- `docs/modulo-reservas.md` — políticas BLOCK/COMPATIBLE, estados, 23 equipos configurados
- `docs/modulo-registros-uso.md` — registros de calidad por sesión (cabina/autoclave), check-in/check-out NFC flexible
- `docs/modulo-usuarios.md` — columnas Usuarios, lógica alumnos, ciclos/módulos, usuarios _sbOnly
- `docs/modulo-pedidos.md` — estados pedido/solicitud, recepción de líneas, historial, eliminar ítems
- `docs/supabase.md` — integración actual + fases 2-4 pendientes
- `docs/patrones-ui.md` — autocomplete incidencias, tablas/líneas responsive, alertas stock dashboard

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
- `importar_alumnos.py` — INSERT masivo en `usuarios` desde Excel (inicio de curso) — además da de alta una cuenta real de Supabase Auth con contraseña temporal para cada alumno nuevo (sin email no puede acceder, así que el email es obligatorio); las contraseñas se imprimen al final para repartirlas, nunca se guardan en fichero
- `onboardear_auth_supabase.py` — alta en bloque de cuentas reales de Supabase Auth para todo el profesorado/alumnado activo del catálogo `usuarios` que aún no la tenga (mismo patrón que la Edge Function `crear-usuario`, en bloque)
- `rellenar_mantenimientos.py` — INSERT en `registro_mantenimientos` de todos los periodos de un curso como realizados (solo Internos); `DRY_RUN = True` por defecto. Usar al inicio de cada curso para poblar el historial.
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
- Los periodos se calculan con `getPeriodosCursoCompleto` (incluye futuros, aplica filtro `Con_Alumnado` igual que el script Python).
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
`leer-documento-proveedor` — confirmado vigente el 2026-08-19/21). Si en el futuro deja de
responder, **volver a comprobar el modelo vigente** con `GET /v1beta/models?key=...` antes de
cambiar el nombre a ciegas — Google puede retirar modelos con el tiempo.

No enviar datos personales de usuarios a Gemini. Sin historial persistente (se borra al cerrar el modal).

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
