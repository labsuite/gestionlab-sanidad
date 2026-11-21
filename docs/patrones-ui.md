# Patrones UI implementados

## Tabla de equipos (inventario de activos fijos)
- `toggleEquipoExpand(id)` hace toggle de clase `open` — sin medición de ancho ni JS adicional
- `.equipo-expand-inner` no tiene ancho explícito ni overflow
- La sección de intervenciones usa grid con columnas de píxeles fijos (~520px mínimo). **Solución para que no expanda la tabla exterior**: envolver en `<div style="min-width:0;overflow-x:auto">`
- **NO usar `table-layout: fixed`** — deja la columna de acciones demasiado estrecha
- **NO usar `position: sticky`** en `.equipo-expand-inner` — interacciona mal con `overflow: hidden` del card
- **NO poner `overflow-x: auto` en `.equipo-expand-inner`** — el scroll debe estar en el wrapper interno de las intervenciones

## Modal incidencias — autocomplete de equipo
El campo "Equipo afectado" usa el patrón `search-material-wrap` (mismo que intervenciones y pedidos):
- `<div class="search-material-wrap">` con icono 🔍 e `input#inc-equipo-search`
- `<div class="autocomplete-list" id="inc-equipo-autocomplete">`
- `<input type="hidden" id="inc-equipo">` — valor real que usa `guardarIncidencia()`
- Chip de seleccionado: `#inc-equipo-selected` con botón ✕ → `limpiarEquipoIncidencia()`
- Funciones en `js/equipos-acciones.js`: `buscarEquipoIncidencia`, `seleccionarEquipoIncidencia`, `limpiarEquipoIncidencia`
- `openModalIncidencia()` limpia el autocomplete (ya NO llama a `poblarSelects()`)
- `openModalIncidenciaEquipo(equipoId)` usa `seleccionarEquipoIncidencia` en lugar del `<select>`
- **`inc-equipo` ya NO está en `poblarSelects()`** de `ui.js`

## Vista de incidencias (card layout)
- `<div id="lista-incidencias" class="inc-lista">` en lugar de `<table>` — el problema nunca se trunca
- `renderIncidencias()` genera `.inc-card`; las urgentes añaden `.inc-urgente` (borde izquierdo rojo)
- Estructura: cabecera (ID + equipo + badges + fecha) → bloque problema (`var(--surface2)`) → pie (badge impacto + reportado por + botón acción)
- Botón contextual: "Responder" si Abierta, "Ver / Actuar" o "📎 Adjuntar factura" si En gestión
- **NO volver a tabla** — `Descripcion_Problema` puede ser largo

## Vista de solicitudes de material (card layout)
- `<div id="tabla-solicitudes">` en lugar de `<table>` — permite mostrar más info sin columnas estrechas
- `_renderFilaSolicitud()` genera `.sol-card`; grupos colapsables por estado con `.sol-sec-header` (div)
- Estructura card: izquierda (`sol-card-left`) → nombre + cantidad chip + badge urgente si aplica → meta (ID · solicitante · fecha · proveedor · 📅 fecha necesaria) → hint precio. Derecha (`sol-card-right`) → badge estado + botones acción
- **Fecha necesaria** se extrae de `s.Motivo` con regex `/Necesario:\s*(\d{4}-\d{2}-\d{2})/` — no hay columna separada en Sheets, se concatena al motivo al guardar
- **NO volver a tabla** — la meta row necesita espacio flexible y la fecha necesaria no cabe como columna adicional

## Tabla de fungibles (inventario de material)
- En desktop: tabla completa con todas las columnas
- En móvil portrait: se ocultan columnas 3 (categoría), 6 (mín/opt) y 7 (precio) vía CSS
- **Todos los ítems son expandibles**: clase `expandable`, cursor pointer, `▶` siempre visible, `onclick` llama a `toggleMatUbics`
- **`mat-ubic-row`**: siempre al menos una. Ítems con lotes → una sub-fila por lote. Ítems legacy → sub-fila sintética con datos de `m.Ubicacion`
- `toggleMatUbics` usa `Math.max(lotes.length, 1)` para toggler también la sub-fila sintética
- El 📦 (consumo) está **siempre en la sub-fila**. Ítems con lotes: `openModalConsumoLote`; legacy: `openModalConsumoMaterial`
- **Orden en el DOM**: `mat-ubic-row` se generan **antes** de `mat-detail-row`
- `.mat-detail-row`: siempre en el DOM; en desktop `display: none`; en móvil portrait `display: table-row` cuando tiene clase `open` (solo en media query portrait, NO en tablet)

## Líneas de pedido — layout responsive
`.linea-row` usa flex con tres clases hijas:
- `.linea-nombre` — `flex:1`, nombre del material (+ equipo vinculado si lo hay)
- `.linea-meta` — `flex-shrink:0`, contiene "Ped: X", "Rec: Y" y el badge de estado
- `.linea-actions` — botones 📥 y 🗑️

En portrait móvil (`@media (max-width:768px) and (orientation:portrait)`):
- `.linea-row` → `flex-wrap:wrap`
- `.linea-nombre` → `flex: 0 0 100%` (ocupa fila completa arriba)
- `.linea-meta` → `flex:1` (comparte fila con `.linea-actions`)

## Visibilidad de notificaciones en el dashboard (2026-05-27)
`renderDashboard()` en `js/equipos-render.js` calcula `esGestorAdmin = !esProfesor && !esAlumno`.

| Notificación | Alumno | Profesor | Gestor / Admin |
|---|---|---|---|
| Equipos averiados / fuera de servicio | ✗ | ✗ | ✓ |
| Mantenimientos preventivos pendientes | ✗ | ✓ (solo sus equipos) | ✓ (todos) |
| Incidencias abiertas | ✗ | ✓ (solo sus equipos) | ✓ (todas) |
| Solicitudes de material pendientes | ✗ | ✗ | ✓ |
| Consultas de residuos pendientes | ✗ | ✗ | ✓ |
| Stock = 0 (sin stock) / zona común sin stock | ✗ | ✗ | ✓ |
| Tabla de preventivos pendientes | ✗ | ✓ (solo sus equipos) | ✓ (todos) |

- Alerta de stock **solo cuando `getStockTotal(m) === 0`** (barra roja). Bajo mínimo (barra amarilla) no genera alerta en el dashboard.
- Un material **no aparece en la alerta si ya tiene gestión activa**: línea en `DATA.lineasPedido` con `Estado_Linea !== 'Recibido'` y pedido no archivado, O solicitud con estado `'Pendiente'`, `'Añadida a pedido'` o `'En espera de recepción'`. Incluir `'Pendiente'` evita que la alerta persista tras crear una solicitud antes de formalizarla en pedido.
- Zona común: solo alerta si algún lote de zona común tiene `Stock_Local === 0`.
- Profesor ve incidencias de sus equipos: `DATA.equipos.find(e => i.Equipo.startsWith(e.ID_Activo))` + `esResponsableDeEquipo()`
- Preventivos del Profesor filtrados por `misEquipos` (col G de Equipos)

---

## Protocolos de uso de equipos (`js/protocolo.js`)

`equipos.protocolo_uso` guarda el protocolo en **Markdown** (título `#`, tabla de datos, resumen en
cita `>` y apartados `##` numerados). `buildProtocoloUso(md)` lo pinta en la ficha desplegada del
equipo (lo llama `buildMantenimientoEquipo` en `js/mantenimiento.js`):

- Plegado por defecto; cada apartado `##` es un `<details>` cerrado, con un índice de "chips" para saltar.
- Buscador sin tildes ni mayúsculas: oculta los apartados sin coincidencias, abre los demás y resalta con `<mark>`.
- "⤢ Ampliar" lo pasa a pantalla completa (Esc o "✕ Cerrar" para salir).
- El renderizador Markdown es propio y mínimo (encabezados, tablas, citas, listas con `- [ ]`, `---`,
  negrita/cursiva/código, enlaces y URLs sueltas); escapa todo el texto antes de dar formato. Si un
  protocolo nuevo usa algo más (imágenes, bloques de código ```), hay que añadirlo en `_mdRender`.
- `position: sticky` no funciona dentro del `<details>` en Chrome: por eso la barra de búsqueda no se queda fija al hacer scroll.

## Ubicaciones: siempre con zona y subzona (2026-11-21)
Nadie se sabe los códigos (`205-ZC-2.3`) de memoria: en cualquier sitio donde se muestre
una ubicación tiene que salir también su zona y subzona. Usar `getNombreUbicacion(id)`
(`js/config.js`) → `205-ZC-2.3 – Zona común · Reactivos · Inferior`, o
`descripcionUbicacion(u)` si el código ya se pinta aparte. Sin subzona se usa
`Descripcion_Completa`. El código va siempre delante: zona y subzona solas no
identifican el sitio (siete «Izquierda · Encimera» en el 201). Para **elegir** una
ubicación, el selector de `js/ubic-picker.js` (no un `<select>` con todas).

**Sección Ubicaciones** (`renderUbicaciones`, `js/ubicaciones.js`): buscador por código /
laboratorio / zona / subzona / descripción; los laboratorios desplegados se recuerdan por
nombre en `_ubiAbiertos`, así que siguen abiertos tras guardar (antes `renderAll()` los
cerraba todos); la fila recién guardada se centra en pantalla y se marca un momento
(`_ubiResaltar`). El recuento de material cuenta los botes (`material_ubicaciones`), no solo
`material.ubicacion`.
Lo que hay en cada sitio (botes con su stock y equipos) se despliega **en la misma fila**
pulsando «N ítems ▾» (`toggleUbiItems` / `_ubiPanelItems`), sin saltar a Inventario —
cambiar de pantalla hacía perder el hilo. Los desplegados se recuerdan en `_ubiItemsAbiertos`.
El buscador también encuentra por lo que hay dentro ("etanol" → sitios con etanol, ya
desplegados).
Cada ítem del desplegable tiene **📍 Mover** (Admin/Gestor) para corregir lo que está mal
inventariado ahí mismo: se elige el sitio con el selector de `js/ubic-picker.js` y, si es
un bote, cuánto se mueve (por defecto, todo). Va a `gestionar-material` →
`corregir_ubicacion`, que **no es un traslado**: el bote entero cambia de sitio (o se funde
con el del destino si es de la misma unidad) sin dejar un bote vacío atrás, y no aplica la
regla de «desde zona común solo a un laboratorio». Equipos: `gestionar-equipo` →
`cambiar_ubicacion`.
**Inventariar desde la ubicación** (Admin/Gestor): al final de cada desplegable,
«➕ Añadir algo que hay aquí» (y «＋ Añadir» en los sitios vacíos). Busca en material y
equipos; material → «hay N» con `gestionar-material` → `anadir_en_ubicacion` (si ya
constaba un bote de esa unidad ahí, lo contado **sustituye** a su stock, como en
Inventariar; si no, crea el bote; el material legacy se materializa antes); equipo →
`cambiar_ubicacion`. Si no existe, «Material nuevo» / «Equipo nuevo» abren el alta con el
sitio puesto. Tras guardar, el buscador del mismo sitio sigue abierto (`_ubiAnadirAbiertos`)
para seguir con lo siguiente.
