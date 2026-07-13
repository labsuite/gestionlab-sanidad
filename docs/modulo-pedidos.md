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
- "+ Añadir línea" (`puedeAddLinea` en `pedidos-render.js`): permitido en `Abierto` y `Presupuesto solicitado` — en la práctica se pueden seguir añadiendo artículos mientras se espera el presupuesto. A partir de `Presupuesto aprobado` el pedido se considera cerrado en firme.

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

## Eliminar pedido
- Botón 🗑️ en el header del detalle, visible solo para **Administrador** (`puedeHacer('eliminarItems')`).
- `eliminarPedido(pedidoId)` en `js/pedidos-acciones.js`: elimina las líneas de mayor a menor índice (para no desplazar filas) y luego el pedido; actualiza `DATA.lineasPedido` y `DATA.pedidos`; vuelve a la lista con `showPage('pedidos')`.
- Si hay líneas ya recibidas, el `confirm()` lo advierte (no revierte stock).

## Snooze de solicitudes
- Almacenado en `localStorage` bajo la clave `glab_sol_snooze` (`{ID_Solicitud: 'YYYY-MM-DD'}`).
- Solo aplicable a estados activos: `Pendiente`, `Añadida a pedido`, `En espera de recepción`.
- Las solicitudes con snooze activo **no cuentan** en el badge del sidebar (ni en `updateBadges` de `ui.js` ni en `_actualizarBadgeSolicitudes` de `pedidos-render.js`).
- El indicador de pospuestas es un pequeño botón `💤 N` alineado a la derecha, con opacidad reducida; el tooltip muestra la fecha más próxima. El toggle `_mostrarSnoozed` muestra/oculta las cards pospuestas en la lista.

## Coste total en detalle de pedido
Campo "Coste total (IVA 21%)" en `verDetallePedido`: suma `Precio_Unitario × Cantidad_Pedida` de todas las líneas + `Gasto_Extra_Importe`, y multiplica por 1.21.

## Gasto extra del pedido (2026-07-13)
- Cols `T` (`Gasto_Extra_Concepto`) y `U` (`Gasto_Extra_Importe`) en `Pedidos` — para tasas puntuales (transporte con hielo, impuestos raros...) que **no** deben generar una línea de pedido normal (eso obligaría a "recibirla" y crearía un ítem falso en el inventario).
- Un solo gasto por pedido (no hace falta hoja aparte para algo tan infrecuente); si hay varios conceptos, se combinan en un único texto+importe.
- `openModalGastoExtra` / `guardarGastoExtraPedido` en `js/pedidos-acciones.js`; botón ✏️ junto a "Gasto extra" en `verDetallePedido`.
- Entra en la **base del IVA** en los tres sitios donde se calcula un total: "Coste total" del detalle, `modal-precios` (`js/contabilidad.js`), resumen de contabilidad por ciclo/módulo, y la hoja Word generada (`generarHojaPedido`, como fila extra tras las líneas de material, antes de la fila de IVA).
- No toca `Lineas_Pedido` ni el flujo de recepción/stock.

## Traslado de stock a otra ubicación (2026-07-13)
`openModalTrasladoLote` / `guardarTraslado` en `js/material.js`: el destino ahora puede ser **cualquier ubicación activa**, no solo una donde ya exista un lote del material. Si el lote destino no existe, se crea con `añadirLote`. Este botón (🔀) es para mover stock ya existente entre ubicaciones (p.ej. "ir a buscar algo al almacén") — **no** es el flujo de subdivisión (ver siguiente sección).

## Subdividir lote — botes madre/hija (2026-07-13)
Caso: se compra un envase "madre" (p.ej. un bote de tinción o DPX) y se reparte en varios botes de uso más pequeños hacia distintas ubicaciones, en cantidades no necesariamente iguales. Solo se puede *pedir* la madre (el proveedor no vende "un falcon de DPX"), así que los botes de uso nunca deben ser un ítem de `Material` nuevo — son lotes de `Material_Ubicaciones` del mismo material, enlazados a su origen.
- Col `G` nueva en `Material_Ubicaciones`: `ID_Lote_Padre` — vacío en un lote normal/madre; contiene el `ID` (col A, `LU-xxx`) del lote de origen en un lote "hija".
- `añadirLote(idMaterial, idUbicacion, stockLocal, stockMin, stockOpt, idLotePadre)` en `js/sheets.js` — el 6º parámetro es opcional y por defecto `''` (compatible con todas las llamadas existentes).
- Botón ✂️ "Subdividir en botes de uso" en cada fila de lote (`js/material.js`, junto a 🔀): abre `modal-subdividir-lote`, con filas repetibles de destino+cantidad para repartir en varias ubicaciones a la vez (p.ej. 3 a un lab, 2 a otro, 4 a otro, en una sola pantalla). Resta el total del lote origen; crea un lote nuevo por destino (con `ID_Lote_Padre` = lote origen) o suma a uno ya existente.
- `openModalSubdividirLote` / `guardarSubdivision` en `js/material.js`. Registra un movimiento tipo `'Subdivisión'` por cada destino.
- En el listado de lotes se ve de un vistazo quién es madre y quién es hija: 🫙 en la fila que tiene subdivisiones, ↳🧪 en cada lote hijo (con tooltip indicando de dónde viene).
- La recepción de pedidos sigue sin tocarse: se recibe lo que dice el albarán (la madre) tal cual; subdividir es una acción posterior e independiente, disponible en cualquier momento.

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
