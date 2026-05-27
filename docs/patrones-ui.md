# Patrones UI implementados

## Tabla de equipos (inventario de activos fijos)
- `toggleEquipoExpand(id)` hace toggle de clase `open` — sin medición de ancho ni JS adicional
- `.equipo-expand-inner` no tiene ancho explícito ni overflow
- La sección de intervenciones usa grid con columnas de píxeles fijos (~520px mínimo). **Solución para que no expanda la tabla exterior**: envolver en `<div style="min-width:0;overflow-x:auto">`
- **NO usar `table-layout: fixed`** — deja la columna de acciones demasiado estrecha
- **NO usar `position: sticky`** en `.equipo-expand-inner` — interacciona mal con `overflow: hidden` del card
- **NO poner `overflow-x: auto` en `.equipo-expand-inner`** — el scroll debe estar en el wrapper interno de las intervenciones

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

## Visibilidad de notificaciones en el dashboard (2026-05-25)
`renderDashboard()` en `js/equipos-render.js` calcula `esGestorAdmin = !esProfesor && !esAlumno`.

| Notificación | Alumno | Profesor | Gestor / Admin |
|---|---|---|---|
| Equipos averiados / fuera de servicio | ✗ | ✗ | ✓ |
| Mantenimientos preventivos pendientes | ✗ | ✓ (solo sus equipos) | ✓ (todos) |
| Incidencias abiertas | ✗ | ✓ (solo sus equipos) | ✓ (todas) |
| Solicitudes de material pendientes | ✗ | ✗ | ✓ |
| Consultas de residuos pendientes | ✗ | ✗ | ✓ |
| Stock crítico / bajo mínimo / zona común | ✗ | ✗ | ✓ |
| Tabla de preventivos pendientes | ✗ | ✓ (solo sus equipos) | ✓ (todos) |

- Profesor ve incidencias de sus equipos: `DATA.equipos.find(e => i.Equipo.startsWith(e.ID_Activo))` + `esResponsableDeEquipo()`
- Preventivos del Profesor filtrados por `misEquipos` (col G de Equipos)
