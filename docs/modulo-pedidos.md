# Módulo de pedidos/solicitudes – estado del código (2026-05-17)

## Archivos activos
- `js/pedidos-render.js` — render de solicitudes y pedidos, `openModalRecepcion`
- `js/pedidos-acciones.js` — toda la lógica de guardado
- `js/material.js` — búsquedas de material, autocompletado e inventario de fungibles
- `js/contabilidad.js` — cálculo de precios históricos
- `html/modales-pedidos.html` — todos los modales del módulo
- `html/modales-material.html` — modales de material (incluye `modal-historial-material`)
- **`js/pedidos.js` ELIMINADO** — era código obsoleto, ya no existe

## Pedidos de servicio / equipo (SAT, compras de equipo)
- Campo `Tipo` en col S de Pedidos (`COLS.pedidos` index 18): `'Material'` (defecto) o `'Servicio'`
- Las líneas tienen `ID_Equipo` en col I de Lineas_Pedido (`COLS.lineasPedido` index 8)
- `sheetsGet` carga `Pedidos!A2:S` y `Lineas_Pedido!A2:I`
- Pedido de servicio: sin fase de solicitud, sin actualización de stock en recepción
- Modal línea servicio: toggle "Servicio/equipo existente" (autocomplete) vs "Compra equipo nuevo" (mini-form que crea el equipo en inventario antes de crear la línea)
- `buscarEquipoLinea / seleccionarEquipoLinea / clearEquipoLinea` — autocomplete de equipos en modal de línea
- Autocomplete muestra ubicación resuelta vía `getNombreUbicacion`

## Inventario de fungibles — historial de movimientos
- Cada fila tiene botón 🕐 que abre `modal-historial-material` con movimientos ordenados por fecha desc.
- `openModalHistorialMaterial(idMaterial)` en `material.js`; filtra `DATA.movimientos` por nombre de material.

## Estados de solicitud (canónicos)
`Pendiente` → `Añadida a pedido` → `En espera de recepción` → `Recibido` / `Rechazado` / `Cancelado`
- "En espera de recepción": automático al aprobar presupuesto del pedido vinculado
- "Recibido": automático al registrar recepción completa de la línea

## Estados de pedido (canónicos)
`Abierto` → `Presupuesto solicitado` → `Presupuesto aprobado` → `Recepción parcial` → `Recepción completa` → `Archivado`
- "Recepción parcial" y "Recepción completa": solo automáticos, nunca manuales
- Archivado: solo posible cuando Estado=Recepción completa Y los tres checks de documentación están marcados

## Recepción de líneas — lógica clave
`_completarRecepcionLinea(idx, l, cantRec, ...)` dividido en 4 subfunciones:
- `_persistirLinea` — actualiza la línea en Sheets (si falla, revierte memoria y aborta)
- `_actualizarStockMaterial` — actualiza stock global y lotes; registra movimiento
- `_actualizarEstadoPedidoPostRecepcion` — pasa pedido a Recepción parcial/completa
- `_actualizarSolicitudOrigen` — busca la solicitud vinculada (2 intentos) y la marca Recibida

**`cantRec` es incremental** (lo que viene en el albarán), se acumula sobre `Cantidad_Recibida` anterior.

Búsqueda de solicitud origen: 2 intentos — por ID en Observaciones ("Desde solicitud SOL-xxx"), luego por pedidoId+nombre normalizado. **No hay intento 3** (eliminado por riesgo de vincular la solicitud equivocada).

## Documentación de pedido — checkboxes
- `Doc_Hoja_Generada` (col N) — hoja de pedido generada
- ~~`Doc_Hoja_Completada`~~ — eliminado (sobraba)
- `Doc_Enviada_Jefatura` (col P) — hoja enviada a jefatura
- `toggleDocPedido(pedidoId, campo, valor)` — actualiza el campo en Sheets col por col

## Eliminar línea de pedido
`eliminarLineaPedido(lineaId, pedidoId)` en `js/pedidos-acciones.js`: al eliminar una línea en estado `Pendiente`, busca la solicitud vinculada (2 intentos) y la revierte a `Pendiente` limpiando `Lista_Pedido`, si estaba en `Añadida a pedido` o `En espera de recepción`. Toast diferenciado según si se revirtió o no.

## Inventario de fungibles — data model
La hoja `Material` (col G: `Ubicacion`) es un campo legacy que almacena solo la ubicación primaria. Las adicionales se guardan en `Material_Ubicaciones` (cols A-F: `ID, ID_Material, ID_Ubicacion, Stock_Local, Stock_Minimo_Local, Stock_Optimo_Local`). Si un ítem tiene filas en `Material_Ubicaciones`, la app usa esas (modo lote) e ignora la col G.

### Flag `_esPrepoblado` en `_lotesTemp`
Al editar un ítem legacy, `editMaterial()` pre-rellena `_lotesTemp` con `_esPrepoblado: true`. `guardarMaterial()` omite crear el lote si es `_esPrepoblado` y no hay ningún otro lote nuevo real. Evita convertir ítems legacy a modo lote involuntariamente.

## Eliminar ítems del inventario (2026-05-22)
- Permiso `eliminarItems: true` en **Administrador** únicamente (Gestor no lo tiene)
- Botón "Eliminar" en footer izquierdo de los modales `modal-material` y `modal-equipo`, solo al editar
- Confirmación con `confirm()` nativo antes de actuar
- `eliminarMaterial()` en `js/material.js`:
  1. Vacía todos los lotes en `Material_Ubicaciones` (de mayor a menor índice con `eliminarLote`)
  2. Elimina la fila de `Material` con `sheetsDeleteRow`
  3. Actualiza `DATA.material` y re-renderiza
- `eliminarEquipo()` en `js/equipos-acciones.js`: elimina la fila de `Equipos` con `sheetsDeleteRow`
- `eliminarIncidencia(incId)` en `js/equipos-acciones.js`: botón "Eliminar" en cada `.inc-card` para Administrador. Si tiene `Intervencion_Generada`, el `confirm()` lo advierte. Usa `sheetsDeleteRow('Incidencias', idx)`.
