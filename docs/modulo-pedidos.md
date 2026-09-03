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

## Editar solicitud — Gestor/Administrador (2026-07-13)
`openModalEditarSolicitud` / `guardarEdicionSolicitud` en `js/pedidos-acciones.js`, solo con `Estado === 'Pendiente'`.
- Antes solo el propio solicitante (Profesor/Alumno) podía editar su solicitud. Ahora Gestor/Administrador también pueden (`puedeEditarGestor` en `_renderFilaSolicitud`), para corregir cantidad (nombres mal escritos, ajustar lo que realmente se puede pedir...).
- El **nombre del material solo es editable si el ítem todavía no está catalogado** (`!DATA.material.some(m => m.Nombre === sol.Material...)`) — si ya existe en `Material`, el nombre se muestra de solo lectura para no desincronizar la solicitud del ítem real del catálogo.
- El botón 🗑️ "Cancelar solicitud" sigue siendo solo del solicitante — el Gestor ya tiene "✕ Rechazar" para el mismo efecto.

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

## Folla de pedido generada — se conserva solo la última (2026-09-03)
`generarHojaPedido` (`js/generador.js`) sube el `.docx` a Storage y ahora guarda su ruta en
`pedidos.doc_hoja_path` (columna nueva) vía `gestionar-pedido` `actualizar_campos`. En cada
regeneración se **reemplaza**: `subir-documento` (`tipo === 'documento'`) hace `storage.list`
+ `remove` de la carpeta `documentos-generados/<id_pedido>/` antes de subir la nueva, así que
esa carpeta solo tiene un archivo. La ficha del pedido ("Documentación interna",
`js/pedidos-render.js`) muestra un botón "📥 Abrir" junto a "📄 Hoja de pedido generada"
cuando `p.Doc_Hoja_Path` tiene valor — antes el único enlace era el efímero del modal de
generación. `obtener-documento` firma la ruta con `requireValidSession` (no es `facturas/`);
el botón solo se renderiza para Admin/Gestor porque toda la sección es `puedeEditar`.
Requiere `python scripts/migrar_doc_hoja_path.py`.

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
- **(2026-07-13) Migrado de `localStorage` a Sheets** — col `K` (`Snooze_Hasta`) en `Solicitudes`. Antes era local a cada navegador/dispositivo (el cambio hecho en el móvil no se veía en el PC); ahora se sincroniza porque vive en la misma fila de la solicitud. `_getSnoozes()` sigue devolviendo el mismo mapa `{ID_Solicitud: 'YYYY-MM-DD'}` para no romper el resto del código, pero ahora lo construye leyendo `DATA.solicitudes` en vez de `localStorage`. Efecto colateral: al ser compartido, cualquier Gestor/Administrador ve y puede tocar el snooze de cualquier otro.
- (Histórico) Antes: almacenado en `localStorage` bajo la clave `glab_sol_snooze` (`{ID_Solicitud: 'YYYY-MM-DD'}`).
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
- Botón ✂️ "Subdividir/alicuotar" en cada fila de lote (`js/material.js`, junto a 🔀): abre `modal-subdividir-lote`, con filas repetibles de destino+cantidad para repartir en varias ubicaciones a la vez (p.ej. 3 a un lab, 2 a otro, 4 a otro, en una sola pantalla). Resta el total del lote origen; crea un lote nuevo por destino (con `ID_Lote_Padre` = lote origen) — nunca suma a uno ya existente en esa ubicación (ver "Varios botes en la misma ubicación" más abajo).
- `openModalSubdividirLote` / `guardarSubdivision` en `js/material.js`. Registra un movimiento tipo `'Subdivisión'` por cada destino.
- En el listado de lotes se ve de un vistazo quién es madre y quién es hija: 🫙 en la fila que tiene subdivisiones, ↳🧪 en cada lote hijo (con tooltip indicando de dónde viene).
- La recepción de pedidos sigue sin tocarse: se recibe lo que dice el albarán (la madre) tal cual; subdividir es una acción posterior e independiente, disponible en cualquier momento.

### Unidad por bote y eliminar bote (2026-07-13)
- Col `H` nueva en `Material_Ubicaciones`: `Unidad_Lote` — texto libre opcional (p.ej. "goteros", "falcons"). Si está vacío, el lote usa la `Unidad` del material como hasta ahora. Solo se rellena al crear el lote desde el modal de subdividir; si el destino ya existía, conserva su unidad.
- El modal de subdividir permite fijar **Mínimo/Óptimo por destino** desde el principio (se guardan en `Stock_Minimo_Local`/`Stock_Optimo_Local` igual que cualquier lote). Para cambiarlos más tarde no hace falta nada nuevo: se edita como cualquier lote existente, desde ✏️ "Editar" en la fila del material → sección de ubicaciones (`_lotesTemp` en `js/material.js`).
- El listado de lotes (fila expandida de cada ubicación) muestra `Unidad_Lote` si existe, si no cae de vuelta a `Unidad` del material.

### Varios botes en la misma ubicación (2026-07-13)
Caso real: alícuotas guardadas junto al bote madre (mismo estante/armario), no en una "zona de alícuotas" separada. Antes esto era imposible: todas las acciones de lote (📦 consumo, 📥 entrada, ✂️ subdividir, 🔀 trasladar, 🗑️ eliminar) identificaban el bote por la pareja `(ID_Material, ID_Ubicacion)`, así que solo podía existir un bote por ubicación.

- Las 5 funciones (`openModalConsumoLote`, `openModalEntradaLote`, `openModalSubdividirLote`, `openModalTrasladoLote`, `eliminarLoteDirecto`) ahora reciben el **`ID` propio del lote** (col A, `LU-xxx`) en vez de `(matId, idUbicacion)`. Los botones de cada fila pasan `l.ID`. Los modales de consumo/entrada usan un input hidden `consumo-lote-fixed`/`entrada-lote-fixed` (igual que ya hacía consumo) en vez de fijar el valor de un `<select>` por ubicación — así no hay ambigüedad si dos lotes comparten ubicación.
- `buscarDestinoSubdiv` ya no excluye la ubicación de origen: el destino de una subdivisión puede ser la misma ubicación que el bote madre.
- `guardarSubdivision` **siempre crea un lote nuevo** para cada destino (nunca fusiona con uno ya existente en esa ubicación) — evita tener que elegir a ciegas entre varios botes que ya hubiera allí. Si se repite una subdivisión hacia el mismo sitio en otro momento, se crean botes adicionales, no se acumulan en uno.
- **Limitación que queda pendiente:** `guardarTraslado` sigue resolviendo el destino por `(matId, ubicación)` — si esa ubicación ya tiene 2+ lotes, coge el primero que encuentra. No es el caso de uso que motivó este cambio (trasladar es para mover a un sitio distinto, no para juntar en el mismo), pero si aparece, habría que aplicarle el mismo tratamiento de "siempre crear nuevo" o pedir explícitamente a qué lote sumar.
- La UI de "editar material" (`_lotesTemp`, `seleccionarUbicacionMatLote`) **todavía bloquea** añadir dos ubicaciones iguales a mano (`js/material.js:582`) — ese camino no se tocó; solo Subdividir permite el caso de misma ubicación por ahora.

### Cantidad a descontar de la madre desacoplada (2026-09-02)
Antes, `guardarSubdivision` y la acción `subdivision` de `gestionar-material` sumaban las cantidades de todos los botes de uso y bloqueaban si el total superaba el stock del bote madre. Eso rompía el caso real de alicuotar "1 bote → 10 goteros": las cantidades de los botes de uso no son magnitudes comparables con el stock de la madre.
- El modal `modal-subdividir-lote` tiene un campo nuevo **"A descontar del bote madre"** (`subdiv-descontar`), independiente de las cantidades de cada destino. Por defecto trae el stock entero de la madre (comportamiento previo: decantar el envase completo); se puede bajar si solo se alicuota una parte.
- `guardarSubdivision` ya no compara `totalRepartido` con `stockOrigen`; solo valida que lo indicado en el campo sea `≥ 0` y `≤ stock de la madre`. Envía `descontar_madre` a la Edge Function.
- La Edge Function resta `descontar_madre` del bote madre (con el mismo bloqueo optimista). Si el campo no llega (llamadas antiguas), cae al comportamiento previo de restar `totalRepartido`.

### Auditoría de la subdivisión (2026-08-12)
- La resta de stock en el bote madre (acción `subdivision` de `gestionar-material`) usa bloqueo optimista: el `UPDATE` incluye `.eq("stock_local", <valor leído>)`, así que si dos subdivisiones del mismo bote madre se solapan, la segunda no pisa a la primera — falla con 409 y un mensaje pidiendo reintentar.
- `guardarSubdivision` en `js/material.js` ya no descarta en silencio las filas a medio rellenar (ubicación sin cantidad o viceversa): bloquea el envío entero y pide completarlas o quitarlas. Las filas totalmente vacías (fila añadida con "+ Añadir destino" y no tocada) se siguen ignorando sin más, eso sí es lo esperado.
- El `catch` de `guardarSubdivision` ahora muestra `e.message` (el motivo real que devuelve la Edge Function) en vez de un "Error al subdividir" genérico.

### Trasladar hijas siempre a su madre (2026-07-13)
Regla de negocio: 🔀 Trasladar sobre un bote **hija** (tiene `ID_Lote_Padre`) ya no deja elegir destino — siempre va a la ubicación de su bote madre, apuntando directo al `ID` del lote madre (no a su ubicación, para no ambigüedad si hija y madre comparten sitio). Sobre el bote **madre** o un ítem sin subdividir, el destino sigue siendo libre como antes. Ver `openModalTrasladoLote`/`guardarTraslado` en `js/material.js` — nuevo hidden `traslado-destino-lote-id`.

### Editar lote desde "editar material": linaje y unidad (2026-07-13)
El modal de editar material (`renderLotesModal`, `_lotesTemp`) no mostraba si un lote era madre/hija ni dejaba tocar `Unidad_Lote` una vez creado (solo se podía fijar al subdividir). Ahora:
- `editMaterial()` copia `ID` (como `_loteId`), `ID_Lote_Padre` y `Unidad_Lote` de cada lote a `_lotesTemp`.
- `renderLotesModal()` muestra el mismo badge 🫙/↳🧪 que la tabla principal, calculado entre los propios `_lotesTemp` (no hace falta ir a `DATA.materialUbicaciones`).
- Cada fila tiene un campo "Unidad" editable; vacío = usa la del material, como siempre.
- `guardarMaterial()` persiste el cambio de unidad en la col `H` de `Material_Ubicaciones`, reescribiendo `D:H` (incluye `ID_Lote_Padre` en `G`, que se reenvía tal cual para no perderlo — no es editable desde esta pantalla).

### Destino con autocomplete (2026-07-13)
El `<select>` de destino en el modal de subdividir (poco usable con muchas ubicaciones) se sustituyó por el mismo patrón `search-material-wrap` / `autocomplete-list` que ya usan incidencias y equipos (`docs/patrones-ui.md`). Adaptado a filas repetibles: `buscarDestinoSubdiv(i, query)` / `seleccionarDestinoSubdiv(i, id)` / `limpiarDestinoSubdiv(i)` en `js/material.js`, con ids únicos por fila (`subdiv-destino-autocomplete-${i}`). Al seleccionar, se re-renderiza todo el modal (`renderSubdivModal()`), lo cual es seguro porque cada input ya escribe su valor en `_subdivTemp[i]` en el propio `oninput`.
- Botón 🗑️ "Eliminar este bote" en cada fila de lote (`eliminarLoteDirecto` en `js/material.js`): antes solo se podía "quitar" un lote desde el modal de editar material, pero ese flujo no lo persistía en Sheets (solo lo hacía desaparecer del formulario hasta el siguiente recargo). Ahora hay un borrado real vía `eliminarLote()`, con aviso si el bote tiene stock o si es un bote madre con hijas (las hijas no se borran, solo pierden la referencia).

## Link público para el proveedor + lectura con IA (2026-08-18)

**Link público:** botón "🔗 Link para proveedor" en el detalle del pedido (`abrirModalLinkProveedor`, `js/pedidos-render.js`) genera (idempotente) un `token_publico` en `pedidos` vía `gestionar-pedido` (`accion: 'generar_link_publico'`) y compone la URL a `subir-factura.html?pedido=...&token=...`. Esa página standalone (sin login, sin cargar el resto de la app) llama a la Edge Function pública `pedido-publico` (`accion: 'info'` / `'subir'`), que guarda el archivo en Storage (bucket `documentos`, carpeta `facturas-proveedor/<pedido>/`) y una fila en `documentos_proveedor`. La seguridad la da el token aleatorio, no una sesión — por eso `pedido-publico` no usa `requireAdminOrGestor`.

**Lectura con IA (Gemini):** botón manual por documento en el detalle del pedido — 🤖 si aún no se ha leído, 📋/🔄 (ver datos / releer) si ya tiene resultado guardado. Dispara `leerDocumentoConIA` (`js/pedidos-acciones.js`) → Edge Function `leer-documento-proveedor` (Admin/Gestor):
1. Descarga el archivo de Storage y lo manda a `gemini-3.6-flash` (modelo vigente en agosto 2026 — Google retira modelos con frecuencia, comprobar contra `GET /v1beta/models?key=...` si vuelve a dar 404) con `responseSchema` (structured output) pidiendo un array de líneas `{material, cantidad, precio_unitario, unidad, id_linea_sugerida, confianza_match}` — **`precio_unitario` es explícitamente el precio sin IVA** (coherente con `lineas_pedido.precio_unitario` y con el aviso de `modal-precios`: "Precios unitarios introducidos sin IVA"). El prompt instruye a ignorar IVA/totales/cabeceras y a devolver aparte, si existe, cualquier cargo que no sea artículo (transporte, portes, envasado especial, hielo, tasas...) como `cargo_extra: {concepto, importe}` (nunca como artículo).
2. **El emparejamiento contra `lineas_pedido` lo hace el propio Gemini, no comparación de texto** (`construirPrompt` en `leer-documento-proveedor`, `js/pedidos-*` no interviene aquí): se le pasa la lista de líneas del pedido (id + nombre + cantidad) en el mismo prompt y es él quien decide a qué `id_linea` corresponde cada artículo, usando su conocimiento de marcas/sinónimos del sector — un intento anterior con comparación de palabras normalizada fallaba en casos reales como "Aquatex 50 mL" ↔ "Medio de montaje para muestras hidratadas" o "Calcofluor White Stain" ↔ "Tinción blanco de calcoflúor" (cero palabras en común pese a ser el mismo producto). El servidor **nunca se fía a ciegas**: `resolverMatches` descarta cualquier `id_linea_sugerida` que no exista de verdad entre las líneas del pedido, y si el modelo asigna dos artículos a la misma línea se queda con el de mayor `confianza_match` (el otro cae a `sin_match`, no se pierde). **Nunca crea líneas nuevas**; lo que no encaja se guarda aparte (`sin_match`) solo a título informativo.
3. Guarda el resultado completo en `documentos_proveedor.datos_extraidos` (jsonb) + `extraido_en`, para no tener que volver a llamar a Gemini si se reabre el pedido.

**Revisión humana obligatoria — solo precio, nunca recepción:** `abrirModalRevisionExtraccion` (`js/pedidos-render.js`) muestra una tabla con checkbox + precio editable por línea; un único botón "Aplicar precios seleccionados" (`aplicarPreciosExtraccion`, `js/pedidos-acciones.js`) llama en lote a `gestionar-linea-pedido` `accion:'actualizar_precio'` — la misma acción que ya usa 💶 Precios (`js/contabilidad.js`), así que también queda registrado en `historico_precio`. **Nunca toca `cantidad_recibida`** (decisión explícita: recibir exige comprobar físicamente lo que ha llegado, no lo que diga una factura) **ni `cantidad_pedida`** (eso es lo que se decidió pedir, no lo que facture el proveedor). Lo que la IA leyó mal se desmarca o se corrige en el propio campo antes de aplicar — no hay un "rechazar" especial. El cargo extra sigue teniendo su propio botón "Precargar en Gasto extra" → `openModalGastoExtra(pedidoId, conceptoSugerido, importeSugerido)`.

**Cantidad detectada — sin comparar contra lo pedido (2026-08-19).** La columna "Detectado" solo muestra la cantidad tal cual la lee la factura, nunca en rojo/verde: no hay forma de saber desde el documento si esa línea se cuenta por unidad suelta o por envase — eso es un criterio de compra de cada material, no algo deducible del texto (ej. "Pinzas estériles" se pide de 1 en 1 aunque el proveedor las venda en packs de 10, mientras que "Pipetas serológicas" se pide por caja aunque la caja traiga 100 uds). Comparar `cantidad` detectada contra `cantidad_pedida` daba falsos positivos. Si el propio nombre del artículo en la factura menciona un tamaño de envase ("pack 10 uds", "c/100 uds"), Gemini lo extrae aparte en `unidades_por_envase` (nullable, tal cual aparece escrito, sin calcular nada) y se muestra como nota neutra bajo la cantidad — la interpretación es cosa tuya.

**Excepción: añadir línea nueva desde un artículo sin coincidencia.** Normalmente no se pueden añadir líneas a partir de `Presupuesto aprobado` (`puedeAddLinea` en `verDetallePedido`), pero a veces la factura trae un reactivo que no estaba en el presupuesto original. Cada ítem de `sin_match` (solo si `pedido.Tipo !== 'Servicio'`) tiene un botón "+ Añadir línea nueva" → `anadirLineaDesdeSinMatch(idx)`: abre `openModalNuevaLinea` de siempre, precargado en modo "material libre" con nombre/cantidad/precio detectados y una observación de trazabilidad ("No estaba en el pedido — detectada en *archivo* leído con IA"). Funciona en cualquier estado del pedido porque la acción `crear` de `gestionar-linea-pedido` **no tiene restricción de estado server-side** (solo `editar` la tiene) — `puedeAddLinea` es únicamente una restricción de UI del botón "+ Añadir línea" normal, no del backend.

**Documentación interna vs. del proveedor (2026-08-19).** La sección "Documentación" del detalle (`verDetallePedido`) se dividió en dos bloques para separar "lo que genero yo" de "lo que espero que me llegue": *Documentación interna* (botones Precios/Generar hoja + checkboxes Hoja de pedido generada/Enviada a jefatura) y *Documentación del proveedor* (botón Link para proveedor + checkbox de solo lectura "📎 Factura subida (N)", marcada automáticamente cuando `documentos_proveedor` tiene alguna fila para el pedido, con la lista de archivos y sus botones de IA debajo). El listado de pedidos (`renderPedidos` → `_card`) también muestra ahora el icono 📎 junto a 📄/📬 en la cabecera de cada tarjeta cuando hay algún documento subido — los tres iconos comparten un único `title` con el desglose completo en vez de un genérico "Documentación".

**Solo facturas, no presupuestos (2026-08-19).** El link público, `subir-factura.html` y el prompt de `leer-documento-proveedor` dejaron de mencionar "o presupuesto" — el precio de un presupuesto no es firme, así que no tiene sentido usarlo para actualizar `precio_unitario` de las líneas. No hay validación técnica que bloquee subir un presupuesto (el formulario no distingue tipos de archivo), es solo cuestión de qué le pide el texto a la casa comercial y a quien comparte el link.

**Eliminar un documento subido.** Botón 🗑️ por documento en "Documentación del proveedor" (por si el proveedor sube el archivo equivocado o duplicado) → `eliminarDocumentoProveedor(idDocumento, pedidoId)` (`js/pedidos-acciones.js`) → `gestionar-pedido` `accion:'eliminar_documento'`: borra el objeto de Storage (best-effort) y la fila de `documentos_proveedor`. No revierte nada de lo que ya se haya aplicado a las líneas (precios, líneas nuevas) — eso se corrige a mano igual que cualquier otro dato.

**Aviso en el Panel principal.** `renderDashboard` (`js/equipos-render.js`) añade un `alert-banner` 📎 con el recuento de `documentos_proveedor` sin leer (`Extraido_En` vacío) de pedidos no archivados, visible para quien puede gestionar pedidos, con los nombres de los pedidos afectados y clic a la lista de Pedidos — mismo patrón que las demás alertas del panel (incidencias, mantenimientos, solicitudes). Deliberadamente **no** cubre "leído pero con precios sin aplicar" — no hay campo que distinga ese estado (aplicar precios es una decisión legítima de dejar algunos fuera, no un "pendiente" claro) y añadirlo requeriría una columna nueva sin un caso de uso claro todavía.

**Requiere:** `python scripts/migrar_extraccion_documentos_proveedor.py` (añade `datos_extraidos`/`extraido_en` a `documentos_proveedor`), desplegar `leer-documento-proveedor`, y configurar el secreto `GEMINI_API_KEY` en el proyecto de Supabase (`supabase secrets set GEMINI_API_KEY=...`) — clave de Google AI Studio, distinta de la que en su día use el asistente de chat pendiente (esa es client-side con restricción de HTTP referrer; esta vive solo en la Edge Function).

## Unidad pedida por línea, para materiales con varios formatos (2026-08-19)
Caso: un material que se compra en más de un formato (ej. azul de lactofenol en botella o en gotero) necesitaba poder indicarse en cada pedido cuál se está pidiendo.
- Col `unidades_extra` nueva en `material`: unidades alternativas del ítem, coma-separadas (la "de serie" sigue siendo `Material.Unidad`). Se edita en `modal-material` (`js/material.js`), campo opcional junto a "Unidad de medida".
- Col `unidad` nueva en `lineas_pedido`: unidad elegida para esa línea concreta; vacío = se usa la `Unidad` del material como siempre.
- En "Añadir línea al pedido" (`html/modales-pedidos.html`), al elegir un material del catálogo con más de un tipo de unidad, aparece un `<select id="linea-catalogo-unidad">` (`_mostrarSelectorUnidadLinea` en `js/pedidos-render.js`, llamada desde `seleccionarMaterial` en `js/material.js`). Si el material solo tiene un tipo, el selector no se muestra — se comporta igual que antes.
- Para material no catalogado ("Material libre"), el campo de texto libre `linea-material-unidades` (ya existía en el HTML pero no se guardaba en ningún sitio) ahora sí se envía como `unidad` de la línea.
- `_unidadLineaPedido(l)` (`js/pedidos-render.js`) prioriza `l.Unidad` (lo elegido al pedir) sobre `Material.Unidad`; se usa en detalle de pedido, recepción individual, recepción masiva (albarán, con columna "Unidad") y edición de línea.
- **La recepción también fija la unidad del lote que recibe el stock**: `actualizarStockMaterial` en `gestionar-linea-pedido` (accion `recepcion`) escribe `unidad_lote` del lote afectado (o `Material.Unidad` si el ítem no tiene lotes) con la unidad de la línea, para no tener que corregirlo luego a mano en el catálogo.
- Requiere `python scripts/migrar_unidad_pedido.py` (añade `material.unidades_extra` y `lineas_pedido.unidad`).
- **También se puede cambiar la unidad al editar una línea ya creada** (no solo al añadirla): `openModalEditarLinea`/`guardarEdicionLinea` en `js/pedidos-acciones.js` muestran el mismo `<select id="edlinea-unidad">` cuando el material tiene más de un tipo de unidad, y envían `unidad` a la acción `editar` de `gestionar-linea-pedido` (ya la aceptaba). Solo disponible mientras la línea sigue en `Pendiente` (`accion: 'editar'` bloquea cambios en líneas con recepción registrada, ver más abajo).

## Elegir ubicación al recibir una línea (2026-09-03)
Caso: al recibir un pedido, el material no siempre va al mismo sitio de siempre — a veces toca un laboratorio, a veces otro — y a veces es la primera vez que ese material tiene stock en un sitio concreto.
- `openModalRecepcion` (recepción de una línea) y `openModalRecepcionMasiva` (albarán con varias líneas) muestran un `<select>` de ubicación (`rec-ubicacion-sel` / `recmas-ubic-<ID_Linea>`) con **todas** las ubicaciones activas del catálogo, no solo las que ya tienen bote de ese material — las que ya tienen bote muestran su stock actual entre paréntesis (`_opcionesUbicacionRecepcion` en `js/pedidos-render.js`). Preselecciona la única ubicación existente si solo hay un bote, o `Material.Ubicacion` si no hay ninguno.
- El selector no aparece para pedidos de tipo Servicio ni para líneas de material no catalogado (sin ficha en `material`, no hay dónde crear el lote).
- `gestionar-linea-pedido` (`accion: 'recepcion'` y `'recepcion_masiva'`) acepta `id_ubicacion`; `actualizarStockMaterial` busca un lote de ese material en esa ubicación — si existe, suma el stock recibido; si no existe, **lo crea** (mismo criterio que el destino de un Traslado en `gestionar-material`). Si no se manda `id_ubicacion` (llamadas antiguas, o el flujo de catalogar-material-sobre-la-marcha desde una recepción pendiente) se mantiene el comportamiento previo: usa el primer lote existente, o el nivel del propio material si no tiene lotes.

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

## Subida del Word de "Generar folla de pedido" — dos listas blancas de MIME (2026-09-03)
`generarHojaPedido` (`js/generador.js`) crea el `.docx` con JSZip y lo sube vía `subirDocumento('documento', ...)` → Edge Function `subir-documento`. Hay **dos** filtros de tipo que deben coincidir:
1. `TIPOS_MIME_PERMITIDOS` en `supabase/functions/subir-documento/index.ts` (ya incluye `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
2. `allowed_mime_types` del **bucket `documentos`** en Supabase Storage (config del bucket, no está en el repo). Si falta el tipo aquí, el upload falla con `mime type ... wordprocessingml.document is not supported` **aunque la Edge Function lo permita**.
Corregido el 2026-09-03 añadiendo el tipo docx al bucket (`update storage.buckets set allowed_mime_types = array_append(...) where id='documentos'`). El bucket ahora acepta: pdf, jpeg, png, docx.
