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
2. **Planificar** (`abrirPlanificacion` → `guardarPlanificacion`) → crea `Intervencion` con `Estado='Planificada'`; la incidencia pasa a `En gestión` y apunta a esa intervención; el equipo pasa a `Revisión planificada`. `Fecha_Planificada` es **opcional** — si aún no se sabe cuándo, se deja en blanco (se muestra "Por concretar" en badges/cards) y se añade más tarde reabriendo la planificación.
3. **Registrar tareas de la visita** (`openModalRegistrarActuacion` → `guardarActuacion(finalizar)`):
   - Primera tarea: además fija los datos de la visita (fecha real, interna/externa, quién, coste) — quedan bloqueados para las tareas siguientes de esa misma visita. El campo de proveedor externo admite texto libre además del catálogo (`<input list>` con `datalist`), para técnicos puntuales no dados de alta.
   - Cada tarea añadida recalcula el Resultado/Estado agregado de la intervención y sincroniza la incidencia y el `Estado_Operativo` del equipo.
   - Botón **"➕ Guardar esta tarea y añadir otra"** (junto a los campos, no en el pie): guarda, refresca la lista, deja el modal abierto — para cuando surgen más acciones sobre la marcha.
   - Botón **"Guardar y finalizar visita"** (pie del modal): guarda y cierra el modal.
   - Resultado se elige con un botón "✓ Resuelto" (atajo al caso común) + un desplegable pequeño para el resto (Pendiente/No resuelto/Resuelto parcialmente/Descartado); "¿Operativo?" es un botón toggle 🟢/🔴 en vez de un desplegable Sí/No.
4. **Nueva visita** (`programarOtraVisita` → reutiliza `abrirPlanificacion` con un tercer argumento `origenIntId`) — para cuando hace falta volver otro día (pieza pendiente, otro técnico...). Crea una intervención encadenada (`Origen: 'Seguimiento de <ID>'`), reconstruible con `getChainIntervencion`. Distinto de añadir una tarea: eso es la misma visita, esto es una visita nueva.
   - Al abrir el registro de actuación de esa nueva visita, las tareas del padre con resultado no definitivo (`Pendiente`/`Resuelto parcialmente`/`No resuelto`) aparecen en "Pendiente de la visita anterior" (`_tareasHeredadas`) — un clic copia la descripción a "Nueva tarea" sin reescribirla.
5. **Factura** (`guardarFactura`, solo si `Estado='Pendiente factura'`) → cierra la intervención y la incidencia (`Resuelta`).
6. **Modo directo** (`openModalRegistrarActuacionDirecta`, botón 🔧 en la tabla de equipos) — crea una intervención sin pasar por una incidencia, con su primera tarea.

## UI

- Ficha de intervención (`openFichaIntervencion`): timeline (Reportada → Planificada →
  Ejecutando → Cerrada), lista de tareas de la visita, coste total del hilo completo
  (`getChainIntervencion` + suma de `Coste_Intervencion`).
- Cards de incidencias: mientras está `En gestión`, muestran cuántas tareas de la visita
  activa están resueltas (o la fecha planificada si aún no hay ninguna); si `Relacionada_Con`
  está informado, muestran "↳ continúa de INC-XXX".

## Antes de usar este flujo en producción

Ejecutar una vez `scripts/preparar_hoja_tareas_intervencion.py` — crea la hoja
`Tareas_Intervencion` con su cabecera y añade la columna `Relacionada_Con` a `Incidencias` si
no existen ya. Es idempotente.
