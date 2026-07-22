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

La incidencia vinculada se sincroniza tras cada tarea: `Cerrada` → `Resuelta` (o `Descartada`
si el resultado agregado es `Descartado`); `Pendiente factura`/`En gestión` → la incidencia
sigue `En gestión`.

## Flujo end-to-end

1. **Reportar** (`guardarIncidencia` / `guardarAvisoAlumno`) → `Incidencias` con `Estado='Abierta'`; el equipo pasa a `En revisión` u `Operativo con fallos` según impacto.
2. **Planificar** (`abrirPlanificacion` → `guardarPlanificacion`) → crea `Intervencion` con `Estado='Planificada'`; la incidencia pasa a `En gestión` y apunta a esa intervención; el equipo pasa a `Revisión planificada`. `Fecha_Planificada` es **opcional** — si aún no se sabe cuándo, se deja en blanco (se muestra "Por concretar" en badges/cards) y se añade más tarde reabriendo la planificación. El campo "Tareas ya previstas" (una por línea) crea tareas `Pendiente` en esa misma intervención sin esperar a la visita. "¿Quién la va a hacer?" (Interna/Externa + `Realizado_Por`/`Proveedor`) también es opcional aquí — si se indica, queda precargado (editable) al abrir "Ejecutar"; si no, se pide en ese momento como hasta ahora.
3. **Registrar tareas de la visita** (`openModalRegistrarActuacion` → `guardarActuacion(finalizar)`):
   - Añadir una tarea solo pide **descripción** (+ observaciones/adjunto opcionales) — el resultado NO se elige al escribirla, se guarda como `Pendiente` y se marca después. Esto evita forzar una decisión antes de tiempo (p.ej. cuando aún no se sabe si algo se pudo arreglar).
   - Primera tarea de la visita: además fija los datos de la visita (fecha real, interna/externa, quién, coste) — quedan bloqueados para las tareas siguientes de esa misma visita. El proveedor externo admite texto libre además del catálogo (`<input list>` con `datalist`), para técnicos puntuales no dados de alta.
   - En "Tareas registradas en esta visita" (`_renderTareasEnModal`), cada tarea sin resolver (`Pendiente`) muestra sus propios controles: botón **"✓ Resuelto"** + desplegable pequeño para el resto (Resuelto parcialmente/No resuelto/Descartado). Al elegir uno se llama a `marcarResultadoTarea(tareaId, resultado)`, que actualiza esa fila de `Tareas_Intervencion` (no crea una duplicada) y recalcula/sincroniza la intervención vía `_sincronizarIntervencion`.
   - Botón **"➕ Añadir tarea a la lista"** (junto al campo de descripción): guarda como Pendiente, refresca la lista, deja el modal abierto.
   - Botón **"Guardar y finalizar visita"** (pie del modal): si hay una descripción sin guardar la añade primero; si no hay nada nuevo, simplemente cierra — no exige escribir algo para poder finalizar.
4. **Nueva visita** (`programarOtraVisita` → reutiliza `abrirPlanificacion` con un tercer argumento `origenIntId`) — para cuando hace falta volver otro día (pieza pendiente, otro técnico...). Crea una intervención encadenada (`Origen: 'Seguimiento de <ID>'`), reconstruible con `getChainIntervencion`. Distinto de añadir una tarea: eso es la misma visita, esto es una visita nueva.
   - Al abrir la planificación de esa nueva visita, las tareas sin resolver (`Pendiente`/`Resuelto parcialmente`/`No resuelto`) de la visita anterior aparecen como una lista de casillas ("Pendiente de la visita anterior") — se marcan solo las que correspondan a esta visita concreta (p.ej. si hay tareas para especialistas distintos, cada una se lleva a su propia visita programada). Al guardar, las marcadas + lo escrito a mano en "Otras tareas ya previstas" se crean como tareas `Pendiente` en la nueva intervención, ya listas para marcar su resultado desde "Ejecutar".
5. **Factura** (`guardarFactura`, solo si `Estado='Pendiente factura'`) → cierra la intervención y la incidencia (`Resuelta`).
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
- Ficha de intervención (`openFichaIntervencion`): timeline (Reportada → Planificada →
  Ejecutando → Cerrada), lista de tareas de la visita, coste total del hilo completo
  (`getChainIntervencion` + suma de `Coste_Intervencion`).
- Cards de incidencias: mientras está `En gestión`, muestran cuántas tareas de la visita
  activa están resueltas (o la fecha planificada si aún no hay ninguna); si `Relacionada_Con`
  está informado, muestran "↳ continúa de INC-XXX".
- El modal de planificación (`modal-planificar-intervencion`) cambia de título y texto de
  ayuda según el contexto: "🗓 Responder a la incidencia" (primera respuesta, vía
  `abrirPlanificacion(incId, equipo)`) vs "📅 Programar próxima visita" (desde
  `programarOtraVisita`, que pasa un tercer argumento `origenIntId`) — mismo modal y misma
  operación de datos, pero framing distinto para no confundir "estoy respondiendo a algo
  recién abierto" con "ya llevo un rato gestionando este caso".

## Antes de usar este flujo en producción

Ejecutar una vez `scripts/preparar_hoja_tareas_intervencion.py` — crea la hoja
`Tareas_Intervencion` con su cabecera y añade la columna `Relacionada_Con` a `Incidencias` si
no existen ya. Es idempotente.
