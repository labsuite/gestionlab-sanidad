# Módulo de mantenimiento preventivo – COMPLETADO

## Hojas en Sheets
- **Planes_Mantenimiento** — columnas A-G: `ID_Plan, ID_Equipo, Tipo_Intervencion, Periodicidad, Operacion, Activo, Instrucciones`
- **Registro_Mantenimientos** — columnas A-I: `ID_Registro, ID_Plan, ID_Equipo, Curso_Academico, Periodo, Fecha_Realizacion, Realizado_Por, Supervisado_Por, Observaciones`

## Lógica de periodos (mantenimiento.js)
- Curso académico: Sep–Jun, formato "YYYY-YYYY+1"
- Periodo mensual: "YYYY-MM"
- Trimestral: meses 0, 3, 6, 9 del curso
- Semestral: meses 0, 6 del curso
- Anual: el primer (o último, si `_esMomentoFin`) mes del curso
- **Bianual/Trianual: igual que Anual, pero solo en los cursos que tocan** —
  `_esCursoDebidoMultianual()` mira el último `Curso_Academico` con un registro real en
  `registro_mantenimientos` para ese `ID_Plan` y solo lo da por "debido" si han pasado 2
  (Bianual) o 3 (Trianual) cursos desde entonces. Si el plan nunca se ha registrado como
  realizado, se sigue pidiendo todos los cursos (para no perder el aviso). Aplica tanto a
  `getPeriodosEsperados` (dashboard) como a `getPeriodosCursoCompleto` dentro de
  `exportarModeloCalidad` (el Excel del plan de mantenimiento).
- Pretemporada: "pretemporada-YYYY-YYYY" (si hoy ≥ Mes_Inicio_Temporada)
- Posttemporada: "posttemporada-YYYY-YYYY" (si hoy ≥ Mes_Fin_Temporada)

## Dónde se gestiona cada cosa (centralizado 2026-09-06)

Toda la **configuración** de mantenimiento vive en la sección **Mantenimiento**; la tarjeta
del equipo es solo lectura + ejecutar.

| Cosa | Dónde se hace |
|---|---|
| Alta / edición / borrado de un **plan** | `Mantenimiento → Planes configurados` (botón "+ Plan" con selector de equipo; ✏️/🗑️ por fila). Ya **no** se crean desde la tarjeta del equipo. |
| **Meses de temporada** (`Mes_Inicio_Temporada` / `Mes_Fin_Temporada`) | Dentro del modal del plan, bloque "Temporada del equipo", visible solo si la periodicidad es Pretemporada/Posttemporada. Se **siguen guardando en la tabla `equipos`** (los escribe `gestionar-mantenimiento` en `crear_plan`/`actualizar_plan`); `gestionar-equipo` ya no los toca. Se quitaron del modal de editar equipo. |
| **Responsable / Módulos responsables / Proveedor SAT** | Modal de editar equipo (no se movió: también gobierna permisos de intervenciones). El plan no tiene responsable propio; lo que cuenta es `realizado_por` al registrar. |
| **Protocolo de uso** | Modal de editar equipo (se muestra en la sección de mantenimiento de la tarjeta). |
| **Ejecutar** un mantenimiento (checklist) | Tarjeta del equipo o `Mantenimiento → Pendientes` (mismo modal `modal-registrar-mant`). |
| **Corregir un mantenimiento ya finalizado** | `Mantenimiento → Realizados` (pestaña solo Admin/Gestor) → ✏️ Editar → `modal-registrar-mant` en modo edición (título "✏️ Editar mantenimiento", sin "Guardar progreso"). Acción `editar_registro` en `gestionar-mantenimiento`. |
| **Marcar un periodo "no aplica" o aplazarlo** | Botón `⋯` en la fila de Pendientes y en la tarjeta del equipo → `modal-marcar-mant`. Bloque desplegable "No aplica / aplazados" bajo la tabla de Pendientes (revertir / editar). Acciones `marcar_periodo` / `revertir_periodo`. |
| **Reservar un plan al profesorado** (`solo_profesorado`) | Dos sitios, mismo campo del plan: casilla "Solo profesorado (el alumnado no lo realiza)" en el modal del plan (`plan-solo-profesorado`, oculta si el plan es Externo) y **atajo** en el modal `⋯` de cualquier periodo (`marcar-solo-profesorado`). En el atajo se guarda **sola al marcarla** (acción `alumnado_plan`, que toca solo esa columna) — no pasa por el botón Guardar, que es del periodo y exige motivo. Visible para Admin/Gestor en cualquier equipo y para el Profesor en los suyos; el servidor revalida con `profesorAutorizado`. |

## "Realizado por" en mantenimientos externos

En los planes con `Tipo_Intervencion = 'Externo'`, el campo **"Realizado por"** del modal
de ejecución es la **empresa** que hizo el trabajo: se precarga con
`equipos.proveedor_servicio_tecnico` (Proveedor SAT), es editable, y el label muestra
"(empresa)". En los internos sigue precargándose con el nombre de quien registra.

## Modal del botón `⋯` (`modal-marcar-mant`)

Titulado **"Opciones del mantenimiento"**, mezcla dos ámbitos distintos y por eso están
separados visualmente:

1. **Del plan** (arriba): "Puede realizarse con el alumnado" — vale para todos los periodos
   y se guarda al instante (`alumnado_plan`).
2. **Solo este periodo** (abajo, tras la línea): no aplica / aplazar + motivo, que es lo que
   guarda el botón del pie — etiquetado "Guardar «no aplica»" / "Guardar aplazamiento" según
   el radio elegido, para que no se confunda con el interruptor de arriba.

## "No aplica" / aplazar un periodo programado (2026-09-06)

Un periodo esperado que no toca hacer o que se pospone se marca en vez de dejarse pendiente
indefinidamente. Fila en `registro_mantenimientos` con `estado` `'no_aplica'` o `'aplazado'`:

- **Motivo obligatorio** → se guarda en `observaciones`.
- `'aplazado'` guarda además el **mes destino** en la columna nueva `aplazado_a` (día 1).
  El periodo original deja de contar como pendiente y **reaparece** (badge "aplazado,
  previsto MM/AAAA") cuando `aplazado_a <= hoy` (`estadoPeriodoMant` → `aplazado_vencido`).
- `'no_aplica'` oculta el periodo de pendientes de ese curso, sin más.
- Permiso: `requireStaff` (Admin/Gestor/Profesor), igual que finalizar.
- Al marcar se borra cualquier ejecución a medias (`en_curso`) o marcador previo del mismo
  periodo. No se puede marcar un periodo ya `finalizado`.
- **Revertir** (`revertir_periodo`): borra el marcador y el periodo vuelve a pendiente.

⚠ `getRegistroMant` / `_esCursoDebidoMultianual` / la lista de "Realizados" filtran ahora
`estado === 'finalizado'` **explícito** (antes `!== 'en_curso'`), para no confundir un
marcador `no_aplica`/`aplazado` con un mantenimiento hecho.

### Reflejo en el Excel del modelo de calidad (`exportarModeloCalidad`)
- Columna **H** (fechas de realización): para ese periodo, en vez de vacío, `No aplica` o
  `Aplazado a MM/AAAA`.
- Columna **J** (observaciones): se añade `<Periodo>: no aplica — <motivo>` /
  `<Periodo>: aplazado a MM/AAAA — <motivo>` (concatenado con la incidencia abierta si la hay).

### Permisos por rol en la sección Mantenimiento
- **Admin/Gestor**: todo (Pendientes, Realizados, Planes configurados, exportar Excel).
- **Profesor**: entra en la sección, pero **todo acotado a los equipos de los que es
  responsable** (`esResponsableDeEquipo`): ve/ejecuta Pendientes de sus equipos y
  crea/edita/borra Planes de sus equipos. **No** ve la pestaña Realizados ni los botones de
  exportar. El servidor (`gestionar-mantenimiento`) revalida: `requireStaff` + el nombre del
  profesor debe estar en `equipos.responsable`.
- **Alumno**: todos los Pendientes **Internos** de cualquier equipo, en cualquier mes del
  curso, salvo los planes marcados `solo_profesorado`. Los **Externos** no los ve.

## Quién realiza los mantenimientos (cambiado 2026-09-25)

Los **internos los realiza el alumnado** y el profesorado **supervisa**: lo que registra el
alumnado entra como `pendiente_vb` y no es válido (ni sale en el Excel de calidad) hasta que
un docente pulsa "✓ Firmar", que es quien rellena `supervisado_por`. Los **externos** siguen
siendo del profesorado: los hace una empresa y los registra un docente.

Antes el alumnado necesitaba que cada plan estuviera marcado `con_alumnado` (lista blanca de
247 planes) y solo podía entre octubre y mayo. Ahora:

- La columna se llama `solo_profesorado` y es la **excepción**, no el permiso: márcala para
  reservar un plan interno concreto al profesorado (`scripts/migrar_solo_profesorado.py`
  renombró la columna y puso todas las filas a `false`).
- **No hay ventana de meses**: el alumnado puede registrar cualquier periodo pendiente en el
  mes que sea. Con ello desapareció también la regla de "los planes con alumnado no se
  programan en septiembre" — afectaba a `getPeriodosEsperados`, a `getPeriodosCursoCompleto`
  (Excel de calidad) y a `scripts/rellenar_mantenimientos.py`, y los tres cuentan ya los diez
  meses del curso.
- El gate vive en `planAbiertoAlumnado(plan)` (`js/mantenimiento.js`) en el cliente y en la
  Edge Function `gestionar-mantenimiento` (bloque `!esStaff`) en el servidor, que rechaza por
  separado los externos y los `solo_profesorado`.

## Datos
- 410 planes activos en `planes_mantenimiento` (2026-08-22; el número crece con el tiempo,
  no usar como referencia fija). Distribución de periodicidad: Anual 172, Semestral 78,
  Bianual 72, Mensual 30, Trimestral 25, Posttemporada 22, Pretemporada 9, Trianual 2.
  Los 74 planes Bianual/Trianual son casi todos revisiones/certificaciones externas
  (autoclaves, cabinas de bioseguridad, congeladores, lupas y microscopios por SAT).
- Columna "Supervisado por" se rellena automáticamente con gestores/admins activos.
- Pendiente: actualizar Ubicacion de equipos estacionales (ver pendientes en CLAUDE.md).
