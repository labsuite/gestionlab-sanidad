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
- `actualizar_riesgos_ghs.py` — UPDATE masivo del campo Riesgo en Tipos_Residuo con pictogramas GHS; usa matching por nombre + OVERRIDES por ID; tiene `DRY_RUN = True` por defecto
- `actualizar_planes.py` — UPDATE en Planes_Mantenimiento (operación, periodicidad, tipo...)
- `actualizar_equipos.py` — UPDATE en Equipos (protocolos, temporadas, ubicaciones...)
- `limpiar_hoja.py` — DELETE en cualquier hoja con filtro; tiene `DRY_RUN = True` por defecto
- `limpiar_inventario_fungible.py` — DELETE de todas las filas de las 8 hojas del módulo de fungibles (útil para reset de datos de prueba)
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

---

## Módulo de residuos – COMPLETADO (2026-05-18)

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
- Admin / Gestor / **Profesor**: pueden crear, editar, cerrar y eliminar **contenedores**
- Admin / Gestor (solo): pueden crear, editar y eliminar **tipos de residuo** (Profesor no tiene este permiso)

### Peligrosidad GHS
- El campo `Riesgo` almacena los pictogramas GHS como string con comas: `"Tóxico, Inflamable"` (vacío = sin peligrosidad especial)
- Valores canónicos: `Tóxico` / `Nocivo / Irritante` / `Inflamable` / `Comburente` / `Corrosivo` / `Cancerígeno / CMR` / `Peligroso para el medio ambiente` / `Explosivo` / `Gas comprimido` / `Citotóxico`
- En la UI, el modal de tipo de residuo muestra checkboxes con cada categoría GHS
- `_GHS` — constante con mapa `{nombre: {icon, bg, color}}` para los 10 pictogramas
- `_riesgoBadges(riesgo)` — renderiza cada valor GHS como chip de color; los valores no reconocidos (datos legacy) muestran chip genérico ⚠️ naranja
- Los 113 tipos de residuo R001–R113 tienen Riesgo actualizado con GHS mediante `scripts/actualizar_riesgos_ghs.py`

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

## Módulo de reservas de equipos – COMPLETADO (2026-05-18)

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
- Sin conflicto → se guarda directamente como `Confirmada` (auto-aprobada)
- Con conflicto → se guarda como `Pendiente` + toast warning, queda en la cola de gestión
- `Confirmada` → `Activa` (al inicio real con `iniciarUso()`) → `Completada`
- `Pendiente` → `Confirmada` / `Rechazada` / `En conflicto` (por Gestor)

### Roles
- Todos los roles (incluido Alumno y Profesor): pueden solicitar reservas y ver disponibilidad
- Gestor y Administrador: además aprueban/rechazan, marcan conflictos y configuran equipos reservables
- Badge en nav muestra reservas `Pendiente` (solo visible para Gestor/Admin); solo aparecen cuando hay conflicto real

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

## Integración con Supabase (app de gestión del departamento)

La usuaria tiene una segunda app (Vercel + Supabase) para gestión integral del departamento. GestionLab comparte con ella ciclos/módulos, usuarios y (en el futuro) reservas de autoclaves.

### Credenciales de Supabase

- **Project URL (API):** `https://clxcjsvkmaydpxvtqesv.supabase.co`
- **Anon key (pública, segura en cliente):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseGNqc3ZrbWF5ZHB4dnRxZXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDI1OTEsImV4cCI6MjA5NDYxODU5MX0._uu-RO_AtA88mh3eC8oPBf7ikD2X5w-otl91pHSJ7GA`
- **Dashboard:** `https://supabase.com/dashboard/project/clxcjsvkmaydpxvtqesv`

La anon key es la clave pública diseñada para uso en cliente. NO usar la service key en el cliente ni en git.

### Estado actual de la integración (2026-05-19) ✓ PARCIALMENTE COMPLETADO

| Ámbito | Estado | Fuente activa |
|---|---|---|
| Cliente Supabase (`_sb`) | ✓ integrado | `js/config.js` + CDN en `index.html` |
| `ciclos` | ✓ migrado + datos cargados | Supabase |
| `modulos` | ✓ migrado + datos cargados | Supabase |
| `modulo_ciclo` | ✓ migrado + datos cargados | Supabase |
| `user_modulos` | ✓ tabla creada, vacía | Supabase (se puebla desde la otra app al asignar módulos a usuarios) |
| `puede_revisar_inventario` | ✓ columna añadida a `public.users` | Supabase |
| `DATA.sbUsuarios` | ✓ cargado en paralelo | Supabase (solo para lookup de UUID) |
| `DATA.usuarios` | ✓ parcial | **Sheets** + complementado con Supabase (ver abajo) |
| Reservas autoclaves | ✗ pendiente | **Sheets** |

### Cómo funciona actualmente en GestionLab

`loadAllData()` lanza en paralelo todas las lecturas de Sheets **y** cuatro queries a Supabase: `ciclos`, `modulos`, `modulo_ciclo` y `users`. Si Supabase falla, la app cae al fallback de Sheets sin romperse.

- `DATA.ciclosModulos` se construye desde Supabase (`modulo_ciclo` + `modulos` + `ciclos`), con `lab_teoria` y `lab_practicas` por módulo. Si Supabase devuelve vacío, se usa el de Sheets.
- `DATA.userModulos` se construye desde `user_modulos` de Supabase enriquecido con nombre de módulo y labs. Empieza vacío.
- `DATA.sbUsuarios` carga `id, email, full_name, role, ciclo_principal, is_active, puede_revisar_inventario` desde Supabase. Solo se usa para obtener el UUID del usuario actual.
- `getUbicacionesAlumno()` primero busca el UUID del usuario en `DATA.sbUsuarios`, luego sus módulos en `DATA.userModulos`, y deriva los labs de `lab_teoria`/`lab_practicas`. Si `user_modulos` está vacío, usa `Ubicaciones_Asignadas` de Sheets como fallback.

### Estructura de tablas en Supabase relevante para GestionLab

**`public.ciclos`**: `id (uuid), nombre (text), created_at, department_id (uuid, nullable)`
**`public.modulos`**: `id (uuid), nombre (text), created_at, lab_teoria (text), lab_practicas (text), horas_semanales (integer)`
**`public.modulo_ciclo`**: `ciclo_id (uuid), modulo_id (uuid)` — tabla pivot pura (muchos-a-muchos)
**`public.user_modulos`**: `id (uuid), user_id (uuid→users), modulo_id (uuid→modulos), curso_academico (text), created_at` — RLS: anon SELECT, authenticated ALL
**`public.users`**: vista/join de `auth.users` + tabla personalizada. Campos útiles: `id, email, full_name, role (enum), ciclo_principal, is_active, xade_id, department_id, puede_revisar_inventario`

**RLS en tablas compartidas:** `ciclos`, `modulos` y `modulo_ciclo` tienen `SELECT TO authenticated`. Se añadió `SELECT TO anon` para GestionLab (que usa anon key con Google OAuth propio, no Supabase Auth).

### Complementación de DATA.usuarios desde Supabase (2026-05-20) ✓ IMPLEMENTADO

Al final de `loadAllData()`, después de construir `DATA.userModulos`, se añaden a `DATA.usuarios` los usuarios de Supabase que cumplan:
1. Rol `TEACHER` o `STUDENT` (no `ADMIN` — los admins/gestores se gestionan en Sheets)
2. Tienen al menos un módulo en `user_modulos` con `lab_teoria` o `lab_practicas` asignado
3. No están ya en Sheets (deduplicación por email)

Estos usuarios se marcan con `_sbOnly: true` y sus campos `Ubicaciones_Asignadas` y `Modulo` se derivan automáticamente de `DATA.userModulos`.

**Mapeo de roles:** `TEACHER → Profesor`, `STUDENT → Alumno`

**Edición de usuarios `_sbOnly`:**
- Alumnos (`_sbOnly`): sin botón ✏️ — se gestionan desde la otra app
- Profesores (`_sbOnly`): botón ✏️ visible para Admin/Gestor — permite promoverlos a `Gestor`. Al guardar, `editingRow = null` → `sheetsAppend` crea fila nueva en Sheets con ID `USR-XXX`. En la siguiente carga el usuario se encuentra en Sheets y deja de ser `_sbOnly`.

**Nota:** mientras `user_modulos` esté vacía, ningún usuario de Supabase aparecerá (el filtro por lab no pasa). Empezarán a aparecer cuando la otra app asigne módulos.

### Flujo objetivo una vez completada la integración

Alta de usuario en Supabase (desde cualquier app) → asignar módulos en `user_modulos` → GestionLab deriva automáticamente los labs de `lab_teoria`/`lab_practicas` del módulo. Sin introducción manual de datos en múltiples apps.

### Pendiente — Fase 2: migración de usuarios a Supabase

**Objetivo:** `DATA.usuarios` lea de Supabase en lugar de Sheets. Alta de usuario = solo en Supabase.

**Bloqueante:** el enum `role` de Supabase tiene valores no confirmados. Los de GestionLab son `Admin`, `Gestor`, `Profesor`, `Alumno`. Verificar que coinciden antes de implementar; si no, mapearlos.

**Nota sobre `ID_Usuario`:** GestionLab usa formato `USR-001`. Al migrar a UUID de Supabase, las referencias en Sheets (pedidos, reservas, registros) quedan obsoletas. Opción: añadir campo `gestionlab_id text` en `public.users` que conserve el `USR-001` legado.

**Cambios en GestionLab cuando se implemente:**
1. En `loadAllData()`: reemplazar `sheetsGet('Usuarios!A2:I')` por query a `_sb.from('users').select(...)` y mapear a la estructura de `DATA.usuarios`.
2. En `js/ubicaciones.js`: reemplazar `sheetsAppend`/`sheetsUpdate` sobre `Usuarios` por `_sb.from('users').insert()` / `.update()`.
3. Mantener hoja `Usuarios` de Sheets en solo lectura como backup durante la transición; eliminar solo cuando esté verificado en producción.

### Pendiente — Fase 3: migración a Supabase Auth

**Objetivo:** GestionLab usa Supabase Auth con proveedor Google en lugar de Google GIS directo. Los usuarios pasan a ser `authenticated` en Supabase → acceden a tablas compartidas sin necesidad de políticas `anon`.

**Alcance:** solo `js/auth.js` (~30-40 líneas). El resto de la app no cambia. El token de Google para Sheets API se obtiene de `session.provider_token`.

**Requisito previo:** añadir `https://clxcjsvkmaydpxvtqesv.supabase.co/auth/v1/callback` como URL de redirección autorizada en Google Cloud Console. El flujo cambia de popup/token a redirección; la renovación silenciosa actual se sustituye por `_sb.auth.getSession()`.

**Hacer en sesión dedicada** — no mezclar con otras tareas; si falla, el login deja de funcionar.

### Pendiente — Fase 4: reservas de autoclaves compartidas

**Objetivo:** reserva de autoclave visible y gestionable desde GestionLab y la app de Vercel.

**Cambios:**
1. Crear tabla `reservas_autoclave` en Supabase (misma estructura que `Reservas_Equipos`, solo `AUTC-*`).
2. En `loadAllData()`: cargar reservas de autoclaves desde Supabase; el resto (`INC-*`, `EST-*`, etc.) sigue en Sheets.
3. En `guardarReserva()`, `_cambiarEstadoReserva()`, `_actualizarVerificacion()`: detectar `idEquipo.startsWith('AUTC-')` y usar Supabase.
4. Opcional: suscribirse a Supabase Realtime para actualizar el timeline sin recargar.

---

## Pendiente de hacer – CÓDIGO

### Asistente de IA guiado (Gemini Flash)

Añadir un asistente de IA contextual accesible desde cualquier página de la app. El asistente conoce los datos reales de la app (equipos, residuos, planes…) y responde preguntas sobre temas científicos y de gestión del laboratorio.

#### Requisito previo (usuario)
Antes de implementar, la usuaria debe:
1. Ir a [Google AI Studio](https://aistudio.google.com/) → iniciar sesión con su cuenta Google → "Get API key" → "Create API key" → copiar la clave (formato `AIza…`).
2. Ir a [Google Cloud Console](https://console.cloud.google.com/) → el mismo proyecto → "APIs y servicios" → "Credenciales" → hacer clic en la clave creada → en "Restricciones de aplicación" elegir "Referentes HTTP" → añadir `https://palomafedez.github.io/*` → guardar. Esto impide que nadie use la clave desde otro dominio.
3. En la misma consola, ir a "Cuotas" del servicio "Generative Language API" y poner un límite diario razonable (p.ej. 500 peticiones/día).
4. Proporcionar la clave a Claude para incluirla en `js/config.js` como constante `GEMINI_API_KEY`.

#### Archivos a crear/modificar
- **`js/asistente.js`** — lógica completa del asistente (nuevo archivo)
- **`html/modal-asistente.html`** — HTML del modal (nuevo archivo)
- **`css/styles.css`** — estilos del botón flotante y el modal
- **`index.html`** — cargar `asistente.js` al final del orden de scripts; cargar `modal-asistente.html` junto al resto de modales; añadir el botón flotante `<button id="btn-asistente">` justo antes de `</body>`
- **`js/config.js`** — añadir constante `GEMINI_API_KEY` con la clave proporcionada por la usuaria

#### Interfaz de usuario
- **Botón flotante** en esquina inferior derecha, siempre visible tras login: icono 🤖, circular, color `var(--primary)`. Solo se muestra si el usuario está autenticado (`currentUser` existe).
- Al hacer clic: abre modal centrado, tamaño medio (~560px ancho).
- El modal tiene **dos pantallas**:
  1. **Selección de tema** — grid de tarjetas con los 6 temas disponibles.
  2. **Chat** — área de mensajes + campo de texto + botón Enviar. Botón "← Volver" para cambiar de tema.
- El historial de chat se borra al cambiar de tema o al cerrar el modal.

#### Temas y contexto inyectado en el prompt de sistema

Cada tema construye un prompt de sistema distinto antes de enviar la pregunta a Gemini. El prompt de sistema se envía solo una vez por conversación (primer mensaje); las respuestas siguientes continúan en el mismo `contents[]` array.

| Tema | Icono | Contexto inyectado al prompt de sistema |
|---|---|---|
| Residuos | 🧪 | Lista completa de `DATA.tiposResiduo` (ID, nombre, descripción, Riesgo GHS, contenedor_tipo) + contenedores activos de `DATA.contenedores` (categoría, lab, nivel) |
| Uso de equipos | ⚙️ | Ficha del equipo seleccionado: tipo, marca, modelo, ubicación, protocolo de uso (`Protocolo_Uso`), estado operativo |
| Mantenimiento | 🔧 | Planes de mantenimiento del equipo (`DATA.planesMantenimiento` filtrado por ID_Equipo), tipos de intervención canónicos del CLAUDE.md, historial de los últimos 10 registros (`DATA.registros`) |
| Resultados analíticos | 📊 | Solo prompt genérico: "Eres un asistente experto en técnicas de laboratorio clínico y anatomía patológica. Ayuda al personal del laboratorio a interpretar resultados, identificar posibles errores de técnica y sugerir controles de calidad." Sin datos de la app. |
| Gestión de incidencias | 🚨 | Lista de tipos de intervención canónicos + estados de equipos en `DATA.equipos` (solo ID, tipo, estado operativo, ubicación) |
| Búsqueda de SAT | 📋 | Marca y modelo del equipo seleccionado inyectados en el prompt. Gemini debe sugerir cómo localizar el SAT oficial (web del fabricante, distribuidores habituales en España para equipamiento de laboratorio clínico). Aclarar siempre que el resultado es orientativo y que hay que verificar con el fabricante. |

Para los temas que requieren un equipo concreto ("Uso de equipos", "Mantenimiento", "Búsqueda de SAT"), mostrar primero un `<select>` con los equipos de `DATA.equipos` (formato: "AUTC-01 — Autoclave Raypa") antes de activar el chat.

#### Llamada a la API de Gemini

```js
// Endpoint (no cambiar el modelo sin probar primero — gemini-1.5-flash es el del tier gratuito)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Estructura de la petición
const body = {
  contents: _chatHistory, // array de {role:'user'|'model', parts:[{text:'...'}]}
  generationConfig: { maxOutputTokens: 1024, temperature: 0.3 }
};

// _chatHistory[0] es siempre el mensaje de sistema inyectado como role:'user'
// seguido de una respuesta ficticia role:'model' con "Entendido." para establecer contexto
// Los mensajes reales del usuario se añaden como role:'user' a continuación
```

Usar `fetch` estándar, `method: 'POST'`, `Content-Type: application/json`. La respuesta llega en `response.candidates[0].content.parts[0].text`.

Mostrar spinner mientras se espera respuesta. Si la API devuelve error, mostrar mensaje claro: "Error al conectar con el asistente. Inténtalo de nuevo."

#### Seguridad
- El botón flotante y el modal solo se renderizan si `currentUser` existe (tras login OAuth). No añadir ninguna lógica de autenticación adicional; la app ya gestiona esto.
- La clave API se almacena en `js/config.js` como constante en texto plano — aceptable para este caso de uso (app interna, login requerido, restricción de dominio en Google Cloud).
- No enviar a Gemini datos personales de usuarios (emails, nombres). Si el contexto incluye usuarios, omitir o anonimizar.

#### Orden de carga en index.html
`asistente.js` se carga después de `reservas.js` (al final de todo), ya que usa `DATA` que debe estar cargado.

#### Lo que NO hacer
- No crear un sistema de historial persistente entre sesiones (sin localStorage, sin Sheets).
- No enviar el contenido completo de todas las hojas de Sheets — solo los campos relevantes listados arriba para mantener los tokens bajos.
- No usar el modelo `gemini-1.5-pro` ni `gemini-2.0` en el tier gratuito — solo `gemini-1.5-flash`.

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
- `toggleEquipoExpand(id)` simplemente hace toggle de la clase `open` — sin medición de ancho ni JS adicional
- `.equipo-expand-inner` no tiene ancho explícito ni overflow: el `<td colspan="8">` ocupa el ancho natural de la tabla
- La sección de intervenciones (`.intervenciones-mini-header` / `.intervencion-mini-row`) usa un grid con columnas de píxeles fijos (~520px mínimo). Sin contención, ese min-content se propaga al `<td>` y la tabla se expande. **Solución**: esa sección va envuelta en `<div style="min-width:0;overflow-x:auto">`, lo que hace que su min-content sea 0 y el contenido ancho quede desplazable dentro del panel sin afectar la tabla exterior
- **NO usar `table-layout: fixed`** — causa que la columna de acciones quede demasiado estrecha
- **NO usar `position: sticky`** en `.equipo-expand-inner` — interacciona mal con `overflow: hidden` del card
- **NO poner `overflow-x: auto` en `.equipo-expand-inner`** — no impide la expansión si el min-content del contenido supera el ancho de la tabla; el scroll debe estar en el wrapper interno de las intervenciones

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
