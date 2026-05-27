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
- Un material **no aparece en la alerta si ya tiene línea activa en un pedido**: `DATA.lineasPedido` con `Estado_Linea !== 'Recibido'` y pedido no archivado, O solicitud con estado `'Añadida a pedido'` / `'En espera de recepción'`.
- Zona común: solo alerta si algún lote de zona común tiene `Stock_Local === 0`.
- Profesor ve incidencias de sus equipos: `DATA.equipos.find(e => i.Equipo.startsWith(e.ID_Activo))` + `esResponsableDeEquipo()`
- Preventivos del Profesor filtrados por `misEquipos` (col G de Equipos)
