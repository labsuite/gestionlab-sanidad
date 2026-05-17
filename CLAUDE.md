# GestionLab – Estado del proyecto

App web de gestión de laboratorio para el CIFP Manuel Antonio (Vigo).
Stack: JS vanilla + HTML/CSS, Google Sheets como base de datos vía REST API, Google OAuth client-side.

---

## Scripts de mantenimiento de base de datos (carpeta `scripts/`)

Permiten modificar Google Sheets directamente desde Claude Code sin exportar/importar CSV.
Autenticación vía cuenta de servicio (`scripts/credentials.json`, excluido de git).

### Estructura

- `base.py` — conexión y funciones comunes (importar desde aquí)
- `test_conexion.py` — verifica que la conexión funciona
- `nuevo_residuo.py` — INSERT en Tipos_Residuo
- `actualizar_planes.py` — UPDATE en Planes_Mantenimiento (operación, periodicidad, tipo...)
- `actualizar_equipos.py` — UPDATE en Equipos (protocolos, temporadas, ubicaciones...)
- `limpiar_hoja.py` — DELETE en cualquier hoja con filtro; tiene `DRY_RUN = True` por defecto
- `importar_alumnos.py` — INSERT masivo en Usuarios desde Excel (inicio de curso)

### Flujo de trabajo
1. Usuario describe el cambio a Claude
2. Claude rellena la sección `CONFIGURACIÓN` del script correspondiente
3. Usuario ejecuta `! python scripts/<nombre>.py`
4. Los cambios aparecen directamente en Sheets

### Funciones de base.py
| Función | Uso |
|---|---|
| `conectar()` | Devuelve el spreadsheet autenticado |
| `leer(sh, hoja)` | Devuelve `(ws, headers, datos)` |
| `buscar(ws, campo, valor)` | Filas con coincidencia exacta |
| `buscar_multi(ws, {campo: valor})` | Filas que cumplen todos los filtros |
| `buscar_contiene(ws, campo, texto)` | Búsqueda parcial sin distinción de mayúsculas |
| `todas_las_filas(ws)` | Índices de todas las filas de datos |
| `actualizar(ws, filas, campo, valor)` | Actualiza un campo (batch) |
| `actualizar_varios(ws, filas, {campo: valor})` | Actualiza varios campos (batch) |
| `actualizar_fila_por_fila(ws, [(fila, {campo: valor})])` | Cambios distintos por equipo |
| `eliminar(ws, filas)` | Borra filas de abajo arriba |
| `eliminar_todas(ws)` | Limpieza total manteniendo cabecera |
| `insertar(ws, dict)` | Añade una fila |
| `insertar_varios(ws, [dicts])` | Añade múltiples filas (batch) |
| `siguiente_id(ws, campo_id, prefijo)` | Genera el siguiente ID correlativo |
| `preview_filas(ws, filas, campos)` | Muestra preview antes de actuar |

### Formatos de ID por hoja
| Hoja | Formato | Ejemplo |
|---|---|---|
| Tipos_Residuo | `R` + 3 dígitos sin guión | `R001`, `R112` |
| Usuarios | `USR-` + 3 dígitos | `USR-001` |
| Planes_Mantenimiento | `PM` + 4 dígitos | `PM0046` |
| Equipos | prefijo tipo + guión + número | `CEN-02`, `PIP-035` |

⚠ Usar `siguiente_id()` de base.py solo si el formato es `PREF-NNN`. Para formatos sin guión (como Tipos_Residuo), calcular el ID manualmente.

### Formato Excel para importar alumnos
Cabecera: `Nombre | Apellidos | Email | Ciclo | Modulos | Labs`
- Ciclo: nombre completo coincidente con Ciclos_Modulos
- Modulos: separados por coma
- Labs: números de lab separados por coma (ej: `201,203`)

---

## Arquitectura general

- `index.html` — página principal, carga todos los scripts y modales
- `js/config.js` — constantes globales: DATA, COLS, ROLES, SHEETS_ID
- `js/auth.js` — OAuth Google (token management)
- `js/sheets.js` — helpers sheetsGet/sheetsAppend/sheetsUpdate/sheetsDeleteRow + loadAllData()
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

## Hoja de Equipos – columnas (A–W)

| Col | Campo |
|-----|-------|
| A | ID_Activo |
| B | Tipo_Equipo |
| C | Marca |
| D | Modelo |
| E | Numero_Serie |
| F | Ubicacion |
| G | Responsable |
| H | Fecha_Adquisicion |
| I | Origen_Financiacion |
| J | Proveedor_Compra |
| K | Proveedor_Servicio_Tecnico |
| L | Estado_Operativo |
| M | Periodicidad_Mantenimiento *(legado, no usar)* |
| N | Periodicidad_Custom *(legado, no usar)* |
| O | Fecha_Ultimo_Preventivo *(legado, no usar)* |
| P | Fecha_Proximo_Preventivo *(legado, no usar)* |
| Q | Manual_Ficha_Tecnica |
| R | Observaciones |
| S | Coste |
| T | Protocolo_Uso |
| U | Tipo_Mantenimiento |
| V | Mes_Inicio_Temporada |
| W | Mes_Fin_Temporada |

**Columnas M-P:** existen en Sheets pero la app las deja vacías. NO eliminar (desplazaría el resto).

---

## Sistema de mantenimiento preventivo – COMPLETADO

### Hojas nuevas en Sheets (ya creadas)
- **Planes_Mantenimiento** — columnas A-G: `ID_Plan, ID_Equipo, Tipo_Intervencion, Periodicidad, Operacion, Activo, Instrucciones`
- **Registro_Mantenimientos** — columnas A-I: `ID_Registro, ID_Plan, ID_Equipo, Curso_Academico, Periodo, Fecha_Realizacion, Realizado_Por, Supervisado_Por, Observaciones`

### Lógica de periodos (mantenimiento.js)
- Curso académico: Sep–Jun, formato "YYYY-YYYY+1"
- Periodo mensual: "YYYY-MM"
- Trimestral: meses 0, 3, 6, 9 del curso
- Semestral: meses 0, 6 del curso
- Anual/Bianual: solo el primer mes del curso
- Pretemporada: "pretemporada-YYYY-YYYY" (si hoy ≥ Mes_Inicio_Temporada)
- Posttemporada: "posttemporada-YYYY-YYYY" (si hoy ≥ Mes_Fin_Temporada)

### Código implementado
- `buildMantenimientoEquipo(equipoId)` — sección en card de equipo: protocolo de uso + filas de plan con botón Registrar
- `openModalRegistrarMant / guardarRegistroMant` — modal y guardado de registro
- `openModalPlan / guardarPlan / eliminarPlan` — CRUD de planes
- `renderMantenimiento()` — página completa con tabs: Pendientes (filtros lab+período) y Planes configurados
- `exportarModeloCalidad(cursoAcademico)` — genera xlsx usando JSZip sobre la plantilla `assets/templates/MD84MAN01_Plan_mantemento_Sanidade.xlsx`, preservando 100% del formato original. Una fila por equipo × tipo (Interno/Externo), todas las fechas previstas separadas por comas. Portada=sheet1, LAB201=sheet2, LAB203=sheet3, LAB205=sheet4, LAB207=sheet5. Columna I (Supervisado por) se rellena automáticamente con los gestores y admins activos de DATA.usuarios.
- `_detectarLabEquipo(eq)` — devuelve el lab de un equipo buscando en tabla Ubicaciones o inferiendo del campo Ubicacion (busca "201"/"203"/"205"/"207" con includes)
- `_labAHoja(labAula)` — mapea el lab detectado al nombre del sheet Excel

### Limpieza del sistema legado (COMPLETADO)
- Eliminadas funciones: `calcProximoPreventivo`, `togglePeriodicidadCustom`
- Eliminados campos del modal de equipos: eq-periodicidad, eq-periodicidad-custom, eq-ultimo-preventivo
- Eliminado campo "¿Actualizar próximo preventivo?" del modal de intervenciones
- Dashboard y tabla de equipos actualizados para usar el nuevo sistema

---

## Módulo de residuos – COMPLETADO (2026-05-17)

### Hojas en Sheets
- **Tipos_Residuo** — columnas A-G: `ID_Residuo, Nombre, Descripcion, Riesgo, Contenedor_Tipo, Lab, Zona`
  - `Lab` y `Zona` existen en el sheet pero ya no se usan en la UI (los residuos se generan en cualquier sitio)
- **Contenedores_Residuo** — columnas A-K: `ID_Contenedor, Categoria, Lab, Zona, Nivel, Estado, Fecha_Apertura, Fecha_Cierre, Fecha_Actualizacion, Actualizado_Por, Formato`
  - `Estado`: `activo` / `cerrado` (listo para recogida) / `recogido` (eliminado físicamente)
- **Adiciones_Residuo** — columnas A-F: `ID_Adicion, ID_Contenedor, ID_Residuo, Fecha, Usuario, Observaciones`

### Niveles de contenedor
`vacío` / `25%` / `50%` / `75%` / `lleno`. Badge en nav cuando hay alguno al 75%, lleno o cerrado.

### Ciclo de vida de un contenedor
1. Se crea como `activo` con nivel inicial.
2. Se registran adiciones (cada una actualiza el nivel).
3. Al cerrarlo: `Estado=cerrado`, `Fecha_Cierre` registrada, se crea automáticamente un contenedor nuevo vacío de la misma categoría+lab.
4. Al registrar la recogida de Consenur: `Estado=recogido`, la fila se elimina físicamente del sheet.

### Roles
- Todos los roles (incluido Alumno): pueden ver la Guía y registrar adiciones en contenedores
- Admin / Gestor / **Profesor**: pueden crear, editar, cerrar y eliminar tipos de residuo y contenedores

### Código implementado (`js/residuos.js`)
- `renderResiduosGuia()` — página con buscador y tabla agrupada por **Contenedor_Tipo** (categorías dinámicas)
- `openModalTipoResiduo / guardarTipoResiduo / eliminarTipoResiduo` — CRUD de tipos de residuo (Admin/Gestor/Profesor). El campo Contenedor_Tipo usa `<datalist>` — crear un nombre nuevo crea una nueva categoría automáticamente. No se puede eliminar un tipo si tiene contenedores asociados.
- `renderResiduosContenedores()` — dos tabs: **Activos** (cards con historial expandible) y **Pendientes de recogida** (tabla)
- `openModalAdicion / guardarAdicion` — registrar adición a un contenedor (filtra tipos de residuo por Categoria del contenedor)
- `cerrarContenedor` — marca Estado=cerrado y crea contenedor nuevo vacío automáticamente
- `registrarRecogida` — marca Estado=recogido y elimina la fila del sheet
- `openModalContenedor / guardarContenedor / eliminarContenedor` — CRUD de contenedores (incluye campo Formato)
- `mostrarUrlNfcContenedor(idx)` — genera URL con `?cont-cat=X&cont-lab=Y&action=adicion` para etiqueta NFC/QR
- `_abrirAdicionPorNfc(categoria, lab)` — localiza el contenedor activo por categoría+lab y abre el modal de adición
- `_WARNINGS_FORMATO / _getWarningFormato(formato)` — mapa de avisos de seguridad por formato físico; se muestran como banner amarillo en las cards y en el modal de adición (también vía NFC)
- `_updateBadgeResiduos()` — badge en nav (definida en ui.js)
- `exportarInformeConsenur()` — botón en pestaña "Pendientes de recogida"; abre nueva pestaña con informe HTML y dispara "Guardar como PDF". Agrupa por lab, incluye categoría/formato/zona/nivel/fecha cierre y lista de tipos de residuo con peligrosidad. Sin datos personales (sin usuario ni fechas individuales).
- `openModalConsultaResiduo / guardarConsultaResiduo` — flujo para residuos desconocidos: el alumno describe el residuo y dónde lo dejó; se guarda en Consultas_Residuo. Tras guardar llama a `renderPanelConsultasResiduo()` y `renderDashboard()` para actualizar UI en la misma sesión.
- `renderPanelConsultasResiduo / resolverConsultaResiduo` — panel visible a Gestor/Admin con las consultas pendientes; botón "Resuelta" marca Estado=Resuelta
- `abrirModalTipoDesdeConsulta(idxConsulta)` — botón "＋ Añadir a guía" en el panel de consultas; abre modal de nuevo tipo de residuo con la descripción pre-rellenada (editable antes de guardar)

### Avisos de seguridad por formato (`_WARNINGS_FORMATO`)
| Formato (matching parcial) | Aviso |
|---|---|
| bidón azul | Líquidos en bote propio, cerrado y rotulado dentro del bidón |
| cubo con tapa / contenedor rígido | NO cerrar tapa hasta que esté lleno y listo para Consenur |
| bolsa plástica | Solo envases vacíos de plástico/aluminio; nada a granel |
| garrafa | Mantener cerrada entre adiciones; zona ventilada sin calor |

### Consultas de residuo desconocido
- Hoja **Consultas_Residuo** — columnas A-F: `ID_Consulta, Fecha, Usuario, Descripcion, Ubicacion_Dejado, Estado` ✓ creada
- Estado: `Pendiente` / `Resuelta`
- Badge en nav (junto a contenedores) suma consultas pendientes + contenedores al 75%/lleno/cerrado
- Banner en dashboard para Gestor/Admin cuando hay consultas pendientes
- Stat card en dashboard: "Residuos por clasificar" (mismo cómputo que el badge)
- Cuando la búsqueda en la guía no encuentra resultados, aparece mensaje "No lo tires todavía" + botón "Avisar a la gestora"
- Desde el panel de consultas, botón "＋ Añadir a guía" abre el modal de nuevo tipo de residuo con la descripción pre-rellenada

### Etiquetas NFC/QR
La URL codifica **categoría + lab** (no el ID del contenedor), por lo que la etiqueta nunca necesita reprogramarse al cerrar un contenedor. `_checkPendingNfcAction()` en `ui.js` detecta los parámetros tras el login y redirige al modal de adición correcto.

### Navegación
Sección "Residuos" independiente en el sidebar, con dos items: "Guía de residuos" y "Contenedores".

---

## Módulo de reservas de equipos – COMPLETADO (2026-05-17)

### Hojas en Sheets (ya creadas)
- **Config_Reservas** — columnas A-E: `ID_Equipo, Politica, Params_Template, Max_Horas, Antelacion_Min_Horas`
  - `Params_Template`: JSON con lista de parámetros de condición, p.ej. `[{"nombre":"Temperatura","unidad":"°C","tolerancia":1}]`
- **Reservas_Equipos** — columnas A-L: `ID_Reserva, ID_Equipo, Usuario, Fecha_Inicio, Fecha_Fin, Condiciones, Proposito, Estado, Aprobado_Por, Observaciones_Admin, Inicio_Real, Fin_Real`
  - `Condiciones`: JSON con valores por parámetro, p.ej. `{"Temperatura":"37","CO2":"5"}`

### Equipos reservables pre-configurados (23 equipos)
- **BLOCK** (uso exclusivo): autoclaves (`AUTC-*`), termocicladores PCR (`PCR-*`), cabina de bioseguridad (`CAB-03`)
- **COMPATIBLE_CONDITIONS** con parámetro CO2+Temperatura: incubadoras (`INC-*`)
- **COMPATIBLE_CONDITIONS** con parámetro Temperatura: estufas (`EST-*`), baños termostáticos (`BAT-*`)

### Políticas de conflicto
- **BLOCK**: solo una reserva activa por tramo horario; cualquier solapamiento = conflicto
- **COMPATIBLE_CONDITIONS**: varias reservas coexisten si los parámetros numéricos están dentro de la tolerancia y los textuales coinciden exactamente

### Estados de reserva
`Pendiente` → `Confirmada` / `Rechazada`; `Confirmada` → `Activa` (al inicio real) → `Completada` / `En conflicto`

### Roles
- Todos los roles (incluido Alumno y Profesor): pueden solicitar reservas y ver disponibilidad
- Gestor y Administrador: además aprueban/rechazan, marcan conflictos y configuran equipos reservables
- Badge en nav muestra reservas `Pendiente` (solo visible para Gestor/Admin)

### Código implementado (`js/reservas.js`)
- `renderReservas()` — 3 tabs: **Disponibilidad** | **Mis reservas** | **Gestión** (Gestor/Admin)
- `_renderTimeline(idEquipo)` — barra de 14 días (07:00–22:00), bloques de color por estado
- `_verificarConflicto(idEquipo, inicioStr, finStr, condiciones, excludeId)` — lógica central de solapamiento; para COMPATIBLE_CONDITIONS compara parámetro a parámetro con tolerancia numérica
- `_actualizarVerificacion()` — verificación en tiempo real al rellenar el modal de nueva reserva; valida también duración máxima y antelación mínima
- `guardarReserva()` — append a Reservas_Equipos; ID formato `RSV-001`
- `_cambiarEstadoReserva(idReserva, nuevoEstado, obs, aprobadoPor, inicioReal, finReal)` — actualiza columnas H-L en un solo `sheetsUpdate`
- `_accionGestion(accion)` — botones aprobar/rechazar/conflicto en modal de gestión
- `openModalConfigEquipo() / _renderCfgParams() / guardarConfigEquipo()` — builder visual de parámetros; guarda Params_Template como JSON
- `_addParamRow()` — añade fila de parámetro (nombre, unidad, tolerancia) en el configurador
- `_updateBadgeReservas()` — badge en nav (definida en `ui.js`)
- `_solapan(i1,f1,i2,f2)` — `new Date(i1) < new Date(f2) && new Date(f1) > new Date(i2)`

### Navegación
Ítem "📅 Reservas" en el sidebar, dentro de la sección **Equipos**, justo debajo de "🛡️ Mantenimiento".

---

## Módulo de usuarios – COMPLETADO (2026-05-16)

### Hoja Usuarios – columnas (A–H)
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

- `sheetsGet('Usuarios!A2:H')` — rango actualizado para incluir la columna H
- `Modulo` (col G): nombres de módulos separados por coma, sin prefijo de ciclo (formato plano)
- `Ciclo_Principal` (col H): ciclo formativo explícito, determina el grupo en la UI. **La columna H debe existir en el sheet con ese encabezado.**

### Lógica de alumnos
- La pantalla de usuarios tiene 3 pestañas: **Admins y gestores | Profesores | Alumnos**
- La pestaña Alumnos agrupa por `Ciclo_Principal` (columna H). Fallback para registros antiguos: lee el prefijo embebido "Ciclo|Módulo" o hace lookup en DATA.ciclosModulos.
- Al crear/editar un alumno: se selecciona el ciclo en un dropdown (pobla desde DATA.ciclosModulos), luego se eligen los módulos de ese ciclo en una lista filtrada. Cambiar de ciclo elimina las selecciones que no pertenezcan al nuevo ciclo.
- `Ubicaciones_Asignadas` almacena números de lab ("201,203"), NO IDs de zona. `getUbicacionesAlumno()` en config.js los expande a IDs de zona al acceder.
- Búsqueda global por nombre/email y filtro por módulo dentro de la pestaña Alumnos.

### Ciclos_Modulos — estructura crítica
Varios módulos comparten nombre entre ciclos (ej. "Técnicas Xerais de Laboratorio" aparece en CS Lab Clínico, ZS Lab Clínico y CS Anatomía). Por eso el ciclo se guarda explícitamente en columna H y NO se infiere de los módulos. Los módulos se guardan como nombres planos.

### Tolerancia a diferencias de nombre de ciclo
`_normCiclo(s)` en `ubicaciones.js` normaliza tildes, mayúsculas, ñ y espacios antes de comparar. `_refreshModuloCheckboxes` intenta coincidencia exacta y cae a comparación normalizada si el valor guardado en Usuarios difiere ligeramente del nombre canónico en Ciclos_Modulos. Al guardar, el campo se sobreescribe con el nombre canónico del dropdown, eliminando la discrepancia.

---

## Módulo de pedidos/solicitudes – estado del código (2026-05-17)

### Archivos activos
- `js/pedidos-render.js` — render de solicitudes y pedidos, `openModalRecepcion`
- `js/pedidos-acciones.js` — toda la lógica de guardado
- `js/material.js` — búsquedas de material, autocompletado e inventario de fungibles
- `js/contabilidad.js` — cálculo de precios históricos
- `html/modales-pedidos.html` — todos los modales del módulo
- `html/modales-material.html` — modales de material (incluye `modal-historial-material`)
- **`js/pedidos.js` ELIMINADO** — era código obsoleto sin cargar, ya no existe

### Pedidos de servicio / equipo (SAT, compras de equipo)
- Los pedidos tienen un campo `Tipo` en col S de la hoja Pedidos (`COLS.pedidos` index 18): `'Material'` (defecto) o `'Servicio'`
- Las líneas tienen `ID_Equipo` en col I de Lineas_Pedido (`COLS.lineasPedido` index 8)
- `sheetsGet` carga `Pedidos!A2:S` y `Lineas_Pedido!A2:I` (rangos ampliados en 2026-05-17)
- Pedido de servicio: sin fase de solicitud, sin actualización de stock en recepción
- Modal línea servicio: toggle "Servicio/equipo existente" (autocomplete de equipo) vs "Compra equipo nuevo" (mini-form que crea el equipo en inventario antes de crear la línea)
- `buscarEquipoLinea / seleccionarEquipoLinea / clearEquipoLinea` — autocomplete de equipos en modal de línea de pedido
- Autocomplete de equipos (tanto en pedidos como en intervenciones) muestra ubicación resuelta vía `getNombreUbicacion`

### Inventario de fungibles — historial de movimientos
- La tabla de inventario ya NO muestra filas expandibles de movimientos inline.
- Cada fila tiene un botón 🕐 que abre `modal-historial-material` con todos los movimientos del ítem ordenados por fecha desc.
- `openModalHistorialMaterial(idMaterial)` — función en `material.js`; filtra `DATA.movimientos` por nombre de material.

### Estados de solicitud (canónicos)
`Pendiente` → `Añadida a pedido` → `En espera de recepción` → `Recibido` / `Rechazado` / `Cancelado`
- Transición a "En espera de recepción": automática al aprobar el presupuesto del pedido vinculado
- Transición a "Recibido": automática al registrar recepción completa de la línea

### Estados de pedido (canónicos)
`Abierto` → `Presupuesto solicitado` → `Presupuesto aprobado` → `Recepción parcial` → `Recepción completa` → `Archivado`
- "Recepción parcial" y "Recepción completa": solo automáticos, nunca manuales
- Archivado: solo posible cuando Estado=Recepción completa Y los tres checks de documentación están marcados

### Recepción de líneas — lógica clave
- `_completarRecepcionLinea(idx, l, cantRec, ...)` es el orquestador, dividido en 4 subfunciones:
  - `_persistirLinea` — actualiza la línea en Sheets (paso crítico: si falla, revierte memoria y aborta)
  - `_actualizarStockMaterial` — actualiza stock global y lotes; registra movimiento
  - `_actualizarEstadoPedidoPostRecepcion` — pasa pedido a Recepción parcial/completa
  - `_actualizarSolicitudOrigen` — busca la solicitud vinculada (2 intentos) y la marca Recibida
- **`cantRec` es incremental** (lo que viene en el albarán), se acumula sobre `Cantidad_Recibida` anterior
- Si un paso posterior a `_persistirLinea` falla, el toast indica exactamente qué no se guardó
- La búsqueda de solicitud origen usa 2 intentos: por ID en Observaciones ("Desde solicitud SOL-xxx"), luego por pedidoId+nombre normalizado. **No hay intento 3** (se eliminó por riesgo de vincular la solicitud equivocada)

### Documentación de pedido — checkboxes en detalle de pedido
- `Doc_Hoja_Generada` (col N) — hoja de pedido generada
- ~~`Doc_Hoja_Completada`~~ — eliminado (sobraba; la hoja ya se genera con los datos de factura)
- `Doc_Enviada_Jefatura` (col P) — hoja enviada a jefatura
- `toggleDocPedido(pedidoId, campo, valor)` — actualiza el campo en Sheets col por col

---

## Pendiente de hacer – CÓDIGO

*(Sin pendientes de código conocidos a 2026-05-18)*

---

## Pendiente de hacer – DATOS

*(Pendientes que requieren acceso físico al instituto)*

### 1. Datos – Planes_Mantenimiento ✓
271 planes importados con Con_Alumnado en formato Sí/No correcto.

### 2. Datos – Campos nuevos en equipos ✓ parcial
- `Protocolo_Uso` y `Tipo_Mantenimiento` — importados via CSV auxiliar generado automáticamente (231 equipos)
- `Mes_Inicio_Temporada` / `Mes_Fin_Temporada` — **PENDIENTE (instituto)** para los 15 equipos estacionales (criostatos, microtomos, procesadores, estaciones de parafina, coagulómetros, citómetro, densitómetro, lámpara hemaglutinación)
- `Ubicacion` — **PENDIENTE (instituto)**: actualizar al ID correcto de la tabla Ubicaciones para que el modelo de calidad los asigne al lab correcto

### 3. Modelo de calidad – FUNCIONAL ✓
- Verificado con registros reales; solo pequeños detalles a hablar con jefa
- Columna "Supervisado por" se rellena automáticamente con gestores/admins activos
- Pendiente: actualizar Ubicacion de equipos (ver punto 2)

### 4. Datos – Reservas
- Config_Reservas pre-poblada con 23 equipos (autoclaves, PCR, cabina, incubadoras, estufas, baños)
- Revisar parámetros de tolerancia de incubadoras (CO2 ±0.5%, temperatura ±0.5°C) y estufas/baños (temperatura ±1°C) con la gestora
- Añadir más equipos reservables si procede (procesador de tejidos, citómetro…)

### 5. Datos – Residuos
- Tipos de residuo: introducidos. Revisar que todos tengan `Contenedor_Tipo` relleno.
- Contenedores físicos: **PENDIENTE (instituto)** introducir en Contenedores_Residuo con su nivel inicial.

### 6. Datos – Usuarios ✓
- Alumnos con `Ciclo_Principal` correcto asignado (completado 2026-05-17).

---

## Tipos de intervención – lista canónica

Aplica a los tres selects: `int-tipo` (modal intervención), `plan-tipo` (plan desde incidencia) y `act-tipo-int` (modal actuación). **No incluir "Preventivo"** — el mantenimiento preventivo se gestiona íntegramente desde Planes_Mantenimiento.

`Correctivo` / `Calibración` / `Verificación funcional` / `Validación` / `Limpieza` / `Descontaminación` / `Sustitución de pieza` / `Cambio de consumibles` / `Control de temperatura` / `Puesta en marcha` / `Actualización de software`

---

## Categorías de material – lista canónica

Select `mat-categoria` en `html/modales-material.html`. Cada opción incluye ejemplos descriptivos:

- Reactivo químico — ácidos, disolventes, bases, sales...
- Solución y tampón — formol, PBS, fijadores, diluciones...
- Colorante y tinción — HE, Giemsa, Papanicolaou, Diff-Quick...
- Medio de cultivo — agares, caldos, medios selectivos...
- Kit diagnóstico — ELISA, pruebas rápidas, tiras...
- Material de vidrio — portas, cubreobjetos, matraces, pipetas...
- Material fungible — puntas, tubos, placas, Eppendorf...
- Papel y filtración — papel de filtro, membranas, papel secante...
- EPI y seguridad — guantes, gafas, batas, mascarillas...
- Equipamiento menor — aparatos pequeños no inventariados como activo fijo
- Otro

---

## Tablas responsive – patrones implementados

### Tabla de equipos (inventario de activos fijos)
- En desktop: tabla normal con panel expandible al hacer clic en la fila
- `toggleEquipoExpand(id)` llama a `_setExpandWidth(row)` **antes** de añadir la clase `open`
- `_setExpandWidth` mide `table.offsetWidth` (NO `card.clientWidth`) para obtener el ancho exacto de la tabla y asignárselo al panel expandido via `inner.style.width`
- `.equipo-expand-inner` usa `overflow-x: auto` (no `position: sticky`) para que contenido ancho (p.ej. mini-tabla de intervenciones) sea desplazable dentro del panel sin expandir la tabla exterior
- El listener de `resize` llama a `_setExpandWidth` en todos los paneles abiertos para recalcular al cambiar tamaño de ventana
- **NO usar `table-layout: fixed`** en esta tabla — causa que las columnas de acción queden demasiado estrechas

### Tabla de fungibles (inventario de material)
- En desktop: tabla completa con columnas de categoría, mínimo/óptimo y precio visibles
- En móvil (portrait): se ocultan las columnas 3 (categoría), 6 (mín/opt) y 7 (precio) vía CSS
- Para ítems con múltiples ubicaciones (`multiUbi`): al expandir (`toggleMatUbics`) se muestran las `mat-ubic-row` y se llama también `toggleMatDetail(id, true)` para mostrar la fila de detalle
- Para ítems con una sola ubicación: `onclick` llama directamente a `toggleMatDetail`
- **Orden en el DOM**: las `mat-ubic-row` se generan **antes** de `mat-detail-row` para que las ubicaciones aparezcan arriba al desplegar en móvil
- `mat-detail-row` para ítem de una sola ubicación incluye la ubicación en la parte superior del panel (antes de categoría/precio/mín-ópt)
- `.mat-detail-row`: siempre en el DOM; en desktop `display: none` siempre; en móvil portrait `display: table-row` cuando tiene clase `open`
- El icono ▶ de una sola ubicación: oculto en desktop (`#page-material .equipo-row:not(.expandable) .expand-icon { display: none }`), visible en móvil portrait

---

## Notas de diseño importantes

- Los **protocolos de uso** NO generan alertas; se muestran solo al expandir la card del equipo.
- Las **temporadas** (mes inicio/fin) son ajustables por Administrador y Gestor desde la app.
- El **lavador de microplacas** tiene una operación específica: limpieza periódica con disolución agua+lejía (incluir en su plan).
- Equipos muy específicos de una especialidad (densitómetro, etc.) → estacionales. Equipos de uso general (centrífugas, balanzas) → periódicos.
- El modelo de calidad se entrega una vez al año; la app debe poder generarlo con los datos del curso académico seleccionado.
- Las **categorías de contenedor de residuos** son dinámicas: emergen de los valores únicos de `Contenedor_Tipo` en Tipos_Residuo. Crear un tipo con un nombre de contenedor nuevo crea una nueva categoría automáticamente.
