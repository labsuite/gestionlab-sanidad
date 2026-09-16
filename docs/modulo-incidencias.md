# Módulo de incidencias / intervenciones – COMPLETADO

Sustituye al flujo híbrido anterior (modal de intervención con edición libre,
`cambiarEstadoIncidencia`, modal de resolución parcial). Ahora hay un único camino guiado.

## Modelo

- **Incidencia** — el problema reportado (hoja `Incidencias`).
- **Intervención** — una visita/sesión, interna o de un SAT externo (hoja `Intervenciones`).
  Tiene fecha, quién la ejecuta y coste, pero **no** una sola descripción/resultado: eso vive
  en las tareas.
- **Tarea** — cada acción concreta dentro de una visita (hoja `Tareas_Intervencion`), con su
  propia descripción y resultado. Una intervención puede tener 1 o varias tareas, añadidas
  progresivamente durante la misma visita.

## Hojas en Sheets

- **Incidencias** — columnas A-J: `ID_Incidencia, Equipo, Reportado_Por, Fecha_Hora, Descripcion_Problema, Impacto, Urgencia, Estado, Intervencion_Generada, Relacionada_Con`
  - `Estado`: `Abierta` → `En gestión` → `Resuelta` | `Descartada`
  - `Intervencion_Generada`: FK a la intervención *activa* del hilo (no el historial completo — para eso, `getChainIntervencion`)
  - `Relacionada_Con`: ID de una incidencia previa (`Resuelta`/`Descartada`) cuando el mismo problema reaparece. No se reabre el hilo original, se enlaza uno nuevo.
- **Intervenciones** — columnas A-T (sin cambios de esquema, ver `CLAUDE.md`). `Resultado` (K) y `Estado` (R) ya no se editan a mano: se derivan de las tareas asociadas.
- **Tareas_Intervencion** — columnas A-F: `ID_Tarea, ID_Intervencion, Descripcion, Resultado, Operativo, Observaciones`
  - `Resultado`: `Resuelto` / `Resuelto parcialmente` / `Pendiente` / `No resuelto` / `Descartado`
  - `Operativo`: estado del equipo tras esa tarea concreta (`Sí`/`No`)
  - La fecha de la tarea es implícita: la de `Intervenciones.Fecha_Realizacion` de su visita.

## Derivación de Resultado/Estado de una intervención (`js/equipos-acciones.js`)

```
calcularResultadoAgregado(tareas):
  sin tareas               → ''
  alguna 'Pendiente'       → 'Pendiente'
  todas Resuelto/Descartado→ 'Resuelto' (si hay algún Resuelto) o 'Descartado' (si todas descartadas)
  resto (mezcla con No resuelto, sin pendientes) → 'Resuelto parcialmente'

calcularEstadoIntervencion(resultadoAgregado, tipoEjec):
  sin resultado                              → 'Planificada'
  'Pendiente' / 'Resuelto parcialmente'      → 'En gestión'
  'Resuelto' + ejecución Externa             → 'Pendiente factura'
  resto (Resuelto interno, o Descartado)     → 'Cerrada'
```

La incidencia vinculada **no** se cierra sola con las tareas: mientras siga abierta se
mantiene en `En gestión`, aunque la intervención llegue a `Cerrada`. Pasar a `Resuelta` o
`Descartada` es siempre un acto explícito en el hilo (ver abajo).

## Cierre explícito de la incidencia (desde 2026-09-16)

Antes, al marcar la última tarea como Resuelto la Edge Function cerraba la incidencia y
ponía el equipo en `Operativo` de golpe, y el modal se cerraba dejando a la usuaria en la
pantalla de fondo: parecía que la app decidía por su cuenta que el equipo ya funcionaba.
Ahora:

- `guardar_tarea` (`gestionar-intervencion`) solo **degrada** el estado del equipo
  (`No operativo` cuando la tarea dice que no quedó operativo). Nunca lo sube a `Operativo`.
  Y deja la incidencia en `En gestión`, sin cerrarla.
- `guardarFactura` cierra la **intervención** (`Cerrada`) y adjunta la factura, pero ya no
  toca la incidencia ni sube el equipo a `Operativo`.
- El cierre vive en el pie del hilo (`_renderCierreHilo` → `cerrarIncidenciaDesdeHilo`):
  un `select` con el estado operativo con el que queda el equipo (preseleccionado `Operativo`
  si todas las tareas de la actuación activa están resueltas/descartadas, y si no el estado
  actual) + botones **✅ Marcar resuelta** y **🚫 Descartar**, con confirmación. Llama a la
  acción `cerrar` de `gestionar-incidencia` (`requireStaff`), que actualiza incidencia y
  equipo en la misma llamada.
- Una incidencia ya cerrada muestra en el hilo **↩︎ Reabrir incidencia**
  (`reabrirIncidenciaDesdeHilo` → misma acción con `estado: 'En gestión'`); reabrir no toca
  el estado del equipo.
- **No se sale de la pantalla**: los modales que se abren desde el hilo (ejecutar/editar
  actuación, ficha, factura, programar otra actuación) vuelven a él al cerrarse o al guardar
  (`_hiloIncidenciaActiva` + `volverAlHilo` / `cerrarYVolverAlHilo`). Esos botones del hilo
  abren el nuevo modal **antes** de cerrarse a sí mismos, porque `_marcarOrigenHilo()` decide
  si hay hilo al que volver mirando si `modal-hilo-incidencia` sigue abierto. El botón
  Cerrar/✕ del propio hilo usa `cerrarHiloIncidencia()`, que borra ese retorno.

## Flujo end-to-end

1. **Reportar** (`guardarIncidencia` / `guardarAvisoAlumno`) → `Incidencias` con `Estado='Abierta'`; el equipo pasa a `En revisión` u `Operativo con fallos` según impacto.
2. **Planificar** (`abrirPlanificacion` → `_asegurarIntervencionPlanificada` / `guardarPlanificacion(finalizar)` / `agregarTareaPrevista`) → crea `Intervencion` con `Estado='Planificada'`; la incidencia pasa a `En gestión` y apunta a esa intervención; el equipo pasa a `Revisión planificada`. `Fecha_Planificada` es **opcional** — si aún no se sabe cuándo, se deja en blanco (se muestra "Por concretar" en badges/cards). "¿Quién la va a hacer?" (Interna/Externa + `Realizado_Por`/`Proveedor`) también es opcional aquí — si se indica, queda precargado (editable) al abrir "Ejecutar"; si no, se pide en ese momento como hasta ahora.
   - El modal no obliga a cerrar para guardar: **"💾 Guardar sin cerrar"** persiste los cambios (crea la intervención la primera vez que hace falta, o actualiza sus datos si ya existe) sin cerrar el modal; **"Crear intervención planificada"** (pasa a "Guardar y cerrar" una vez creada) hace lo mismo y cierra. Las tareas previstas se añaden una a una con `agregarTareaPrevista()` (input + botón "➕ Añadir", o tocando una sugerencia de "Pendiente de la visita anterior") y quedan visibles al momento en la lista — sin esperar a "guardar" el conjunto, para poder ir anotando ideas sueltas en distintos momentos.
3. **Registrar tareas de la visita** (`openModalRegistrarActuacion` → `guardarActuacion(finalizar)`):
   - Añadir una tarea solo pide **descripción** (+ observaciones/adjunto opcionales) — el resultado NO se elige al escribirla, se guarda como `Pendiente` y se marca después. Esto evita forzar una decisión antes de tiempo (p.ej. cuando aún no se sabe si algo se pudo arreglar).
   - Primera tarea de la visita: además fija los datos de la visita (fecha real, interna/externa, quién, coste) — quedan bloqueados para las tareas siguientes de esa misma visita. El proveedor externo admite texto libre además del catálogo (`<input list>` con `datalist`), para técnicos puntuales no dados de alta.
   - En "Tareas registradas en esta visita" (`_renderTareasEnModal`), cada tarea sin resolver (`Pendiente`) muestra sus propios controles: botón **"✓ Resuelto"** + desplegable pequeño para el resto (Resuelto parcialmente/No resuelto/Descartado). Al elegir uno se llama a `marcarResultadoTarea(tareaId, resultado)`, que actualiza esa fila de `Tareas_Intervencion` (no crea una duplicada) y recalcula/sincroniza la intervención vía `_sincronizarIntervencion`.
   - Botón **"➕ Añadir tarea a la lista"** (junto al campo de descripción): guarda como Pendiente, refresca la lista, deja el modal abierto.
   - Botón **"Guardar y finalizar visita"** (pie del modal): si hay una descripción sin guardar la añade primero; si no hay nada nuevo, simplemente cierra — no exige escribir algo para poder finalizar.
4. **Nueva visita** (`programarOtraVisita` → reutiliza `abrirPlanificacion` con un tercer argumento `origenIntId`) — para cuando hace falta volver otro día (pieza pendiente, otro técnico...). Crea una intervención encadenada (`Origen: 'Seguimiento de <ID>'`), reconstruible con `getChainIntervencion`. Distinto de añadir una tarea: eso es la misma visita, esto es una visita nueva.
   - Al abrir la planificación de esa nueva visita, las tareas sin resolver (`Pendiente`/`Resuelto parcialmente`/`No resuelto`) de la visita anterior aparecen como una lista de casillas ("Pendiente de la visita anterior") — se marcan solo las que correspondan a esta visita concreta (p.ej. si hay tareas para especialistas distintos, cada una se lleva a su propia visita programada). Al guardar, las marcadas + lo escrito a mano en "Otras tareas ya previstas" se crean como tareas `Pendiente` en la nueva intervención, ya listas para marcar su resultado desde "Ejecutar".
5. **Factura** (`guardarFactura`, solo si `Estado='Pendiente factura'`) → cierra la intervención (`Cerrada`) y adjunta la factura. La incidencia sigue `En gestión` hasta cerrarla a mano en el hilo.
5 bis. **Cerrar la incidencia** (pie del hilo, `cerrarIncidenciaDesdeHilo`) → `Resuelta`/`Descartada` + estado operativo del equipo elegido a propósito. Es el único sitio donde una incidencia se cierra y donde un equipo vuelve a `Operativo` tras una avería.
6. **Modo directo** (`openModalRegistrarActuacionDirecta`, botón 🔧 en la tabla de equipos) — crea una intervención sin pasar por una incidencia, con su primera tarea.

## UI

- **Página Intervenciones, dos bloques** (`js/equipos-render.js`): una Intervención sirve
  tanto de "cita" (recién planificada, casi sin datos) como de "registro" (ya ejecutada, con
  fecha real/resultado/etc.) — mezclar ambas en una sola tabla hacía que las planificadas se
  vieran como filas rotas llenas de guiones. Por eso:
  - `renderProximasVisitas()` → tabla compacta arriba ("📅 Próximas visitas") solo con
    `Estado='Planificada'`: Equipo, Tipo (+ nº de tareas previstas si las hay), Fecha (o "Por
    concretar"), Incidencia vinculada, botón Ejecutar. Se oculta si no hay ninguna.
  - `renderIntervenciones()` → la tabla de siempre, pero ahora excluye `Planificada`: solo
    entran intervenciones que ya tienen datos reales (incluidas las de modo directo, que nunca
    pasan por `Planificada` porque nacen ya con una tarea). Las filas se agrupan por cadena
    (misma incidencia, vía `getChainIntervencion`) en vez de ordenarse solo por fecha, para que
    varias visitas de un mismo caso no se dispersen entre el resto: columna "Incidencia" con
    el ID + posición ("2/3"), fondo distinto y prefijo "↳" en las filas que continúan una
    cadena.
- Ficha de intervención (`openFichaIntervencion`): eje cronológico real (`_buildTimelineIncidencia`)
  con un nodo "Incidencia" seguido de un nodo por cada actuación de `getChainIntervencion` (en vez
  del timeline de estados genérico Reportada→Planificada→Ejecutando→Cerrada que había antes) — cada
  nodo de actuación muestra estado, fecha, quién la hizo (Interna: `Realizado_Por` / SAT: `Proveedor`)
  y tareas resueltas; el nodo de la actuación abierta actualmente se resalta. Sustituye también al
  bloque "Historial de intervenciones" que existía aparte (misma información, ahora unificada arriba).
  Debajo: lista de tareas de la actuación actual, coste total del hilo completo (suma de
  `Coste_Intervencion`).
- **Modal "Hilo de la incidencia"** (`abrirHiloIncidencia`, `modal-hilo-incidencia`): todas
  las visitas de una incidencia (planificadas y ejecutadas) en una sola lista vertical, con
  posición, estado, fecha, quién y resumen de tareas de cada una; la visita activa
  (`Intervencion_Generada`) lleva su acción principal (Ejecutar / Añadir tarea / Factura /
  Programar otra visita) directamente ahí. Entradas: botón "🔗 Hilo" en la card de la
  incidencia, badge "🔗 &lt;incidencia&gt;" en "Próximas visitas", y botón "🔗 Ver hilo
  completo" en la ficha de intervención. Pensado para no tener que ir a buscar las visitas de
  un mismo caso por separado en "Próximas visitas" y en el registro de intervenciones.
- Cards de incidencias: mientras está `En gestión`, muestran cuántas tareas de la visita
  activa están resueltas (o la fecha planificada si aún no hay ninguna); si `Relacionada_Con`
  está informado, muestran "↳ continúa de INC-XXX".
- El modal de planificación (`modal-planificar-intervencion`) cambia de título y texto de
  ayuda según el contexto: "🗓 Responder a la incidencia" (primera respuesta, vía
  `abrirPlanificacion(incId, equipo)`) vs "📅 Programar próxima visita" (desde
  `programarOtraVisita`, que pasa un tercer argumento `origenIntId`) — mismo modal y misma
  operación de datos, pero framing distinto para no confundir "estoy respondiendo a algo
  recién abierto" con "ya llevo un rato gestionando este caso".

## Equipo retirado por el SAT (fuera del centro)

Una actuación puede hacerse **en el centro** (el técnico viene) o acabar con el **equipo
retirado** a su taller — el caso real que lo motivó: revisan WAT-001 aquí, ven que no pueden
arreglarlo y se lo llevan.

- **Dónde se anota**: modal de actuación, campo "¿Dónde se hace?" (`act-lugar`). Al elegir
  "Equipo retirado" aparecen "Fecha de retirada" (obligatoria) y "Fecha de devolución"
  (vacía mientras siga fuera). Se guardan en `intervenciones.lugar_intervencion` /
  `fecha_retirada` / `fecha_devolucion`.
- **Estado derivado, no duplicado**: `intervencionEquipoFuera(equipoId)` devuelve la
  intervención con `Lugar_Intervencion='Equipo retirado'` y sin `Fecha_Devolucion`;
  `badgeEquipoFuera(equipoId, mini)` genera el cartel. No se escribe nada en
  `Estado_Operativo` — si se hiciera, `guardar_tarea` lo pisaría al recalcular el estado del
  equipo desde las tareas, y habría dos fuentes que pueden contradecirse.
- **Dónde aparece el cartel** `📦 Fuera del centro`: tabla de equipos (junto al estado),
  tarjetas de incidencias reportadas, "Próximas visitas", registro de intervenciones, ficha de
  intervención (campo "Dónde se hace"), hilo de la incidencia, banner del dashboard, aviso con
  botón al desplegar el equipo, y columna F del Excel de inventario.
- **Devolución**: `registrarDevolucionEquipo(intId)` (botón "📦 Registrar devolución" en la
  ficha, el hilo y el equipo desplegado) pide la fecha y rellena `fecha_devolucion`; con eso
  el cartel desaparece en todas partes. También se puede corregir la fecha reabriendo el modal
  de la actuación.
- Si hace falta una actuación **nueva** mientras el equipo está fuera (p.ej. la reparación en
  el taller), se programa como actuación encadenada normal: el cartel lo aporta la actuación
  que registró la retirada, no hace falta repetirlo.

## Antes de usar este flujo en producción

Ejecutar una vez `scripts/preparar_hoja_tareas_intervencion.py` — crea la hoja
`Tareas_Intervencion` con su cabecera y añade la columna `Relacionada_Con` a `Incidencias` si
no existen ya. Es idempotente.
