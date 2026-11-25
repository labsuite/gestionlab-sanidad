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

### Temporada por evaluaciones (desde 2026-10-26)

La temporada de un equipo ya **no se define por meses** sino por las **evaluaciones** en que
se usa. `mes_inicio_temporada` / `mes_fin_temporada` siguen en la tabla, pero no los lee nada.

- **`equipos.evaluaciones_uso`** (`Evaluaciones_Uso`): `"1"`, `"1,3"`, `"1,2,3"`… Vacío =
  todo el curso. Se marca en la ficha del equipo (botón **📅 Evaluaciones**, modal
  `modal-evaluaciones-equipo`) o desde el modal del plan. Lo puede cambiar el profesorado
  **responsable** del equipo y Admin/Gestor en todos — `gestionar-mantenimiento`, acción
  `evaluaciones_equipo`, con el mismo `profesorAutorizado()` que los planes.
- **Tabla `evaluaciones_curso`** (`curso_academico`, `numero` 1–3, `fecha_inicio`,
  `fecha_fin`): las fechas de las tres evaluaciones, una vez por curso. Las fija
  Admin/Gestor desde el panel de Mantenimiento (**📅 Fijar fechas**, modal
  `modal-evaluaciones-curso`; acción `evaluaciones_curso`, que exige las tres, en orden y sin
  solaparse). Si un curso no tiene fechas, el panel lo avisa y se usan unas aproximadas
  (1 sep–31 dic, 1 ene–31 mar, 1 abr–30 jun).

Vencimientos (`periodosPorEvaluacion()` en `js/mantenimiento.js`, que usan a la vez el panel
—`getPeriodosEsperados`— y el Excel del plan de calidad —`getPeriodosCursoCompleto` /
`periodoAFecha`—):

| Periodicidad | Vence | Periodo | Se pide desde |
|---|---|---|---|
| Pretemporada (revisión anual de **arranque**) | inicio de la primera evaluación en que se usa | `pretemporada-YYYY-YYYY` | ese día |
| Posttemporada (revisión anual de **cierre**) | fin de la última evaluación en que se usa | `posttemporada-YYYY-YYYY` | 14 días antes (`_DIAS_AVISO_CIERRE`) |
| Trimestral | inicio de cada evaluación en que se usa | `evaluacionN-YYYY-YYYY` | ese día |
| Anual, Bianual, Trianual (incl. externos) | como antes: septiembre (o junio si la operación es de "fin") | `YYYY-MM` | — |

En el Excel, la columna G lleva la **fecha exacta** de la evaluación (no el día 1 del mes).
Los trimestrales anteriores a este cambio usaban periodos `YYYY-MM`; solo los hay en planes ya
inactivos del curso 2025-2026.

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
| **Buscar un equipo** | Caja 🔍 "Buscar equipo…" en las pestañas Pendientes y Realizados (se suma a los filtros de lab y período) y "Buscar equipo u operación…" en Planes configurados. Pendientes/Realizados casan con ID, tipo, marca, modelo y ubicación, sin distinguir tildes y con varias palabras en cualquier orden (`_mantEquipoCoincide`). |
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

## El preventivo verifica: tipos de paso, qué se hizo y resultado (2026-11-25)

Decisión de Paloma: un mantenimiento preventivo **comprueba**; cambiar una pieza o ajustar el
equipo es una **intervención**, y queda **a la vez** en el paso del mantenimiento y en el
historial del equipo (para saber qué pieza se cambió, cuándo, y que vino de un preventivo).

**Tipo de cada paso** (`_tipoPasoDesdeTexto` en `js/mantenimiento.js`; los planes no lo traen,
sale del texto al abrir; se guarda en `pasos[i].tipo`):

| Tipo | Cuándo | En pantalla |
|---|---|---|
| `comprobar` | lleva criterio, empieza por Revisar/Comprobar/Verificar/Inspeccionar/Control…, o es una acción **condicional** («Cambio de junta … si procede», «Engrasar si procede») | ✓ / ⚠ / No aplica. Rótulos: con criterio «Cumple / No cumple»; condicional «No hacía falta / Hacía falta»; si no, «Correcto / Hay que actuar» |
| `sustituir` | empieza por Sustituir/Sustitución/Cambio/Cambiar/Reemplazar/Renovar, sin condición y sin ser un fluido (agua, parafina, aceite…) | casilla + tipo (pieza / consumibles) + pieza puesta |
| `hacer` | lo demás (limpiar, etiquetar, guardar…) | casilla |

Los pasos de la verificación de pipetas (`vpPasoAuto`) no se reclasifican. Los pasos guardados
antes de esto no tienen `tipo`: comprobación si llevan criterio, casilla si no.

**Una comprobación que sale ⚠** pide «¿Qué has visto?» y «¿Qué has hecho?» (`accion`):
- `corregido` — en el momento, sin pieza (engrasar, limpiar, reapretar): solo nota en el paso.
- `intervencion` — pieza cambiada o equipo ajustado: `tipo_intervencion` (Sustitución de pieza,
  Calibración, Cambio de consumibles, Correctivo) + `actuacion` (qué se cambió).
- `reparacion` — necesita reparación: al finalizar se abre el aviso de avería (lo de antes).
Una sustitución programada hecha se trata como `intervencion`.

**Intervenciones que salen de los pasos** (`registrarIntervencionesDeMant` en
`supabase/functions/_shared/mant_pasos.ts`): intervención **ya cerrada** con una tarea
«Resuelto», `origen = 'Mantenimiento preventivo RM…'`, fecha y autor del mantenimiento; su id
queda en `pasos[i].id_intervencion` (nunca se crea dos veces). Se crean cuando el registro es
válido: al **finalizar** si lo hace el profesorado, al **firmar el visto bueno** si lo hizo el
alumnado, y al **corregir** un finalizado. El ajuste de una micropipeta (AJUSTAR → repetición)
crea igual una «Calibración» (`verificacion.intervencion_ajuste`). Pruebas:
`node tools/mantenimiento/pasos.test.mjs` (y `--base` contra la base, con un registro ficticio
del curso 2099-2100 que se borra solo).

**Resultado del mantenimiento** (`registro_mantenimientos.resultado`): `apto` /
`apto_tras_intervencion` / `no_apto`. **Lo marca la persona** (obligatorio para finalizar en la
pantalla; el servidor lo acepta vacío para no bloquear pantallas antiguas); la app solo resalta
con borde discontinuo el que sale de los pasos (`_mantResultadoSugerido`: algo que necesita
reparación o pipeta RETIRAR → no apto; pieza cambiada o pipeta ajustada → apto tras
intervención). Sale en «Realizados», en «Visto bueno» y en el Excel de calidad (col. H junto a
la fecha; en J, por qué no fue «apto»).

**Periodicidad `Quinquenal`** (cada 5 años, `_CICLO_ANIOS`): para calibraciones externas como
la de las micropipetas, que sustituye al antiguo bianual interno «Cambio de juntas y
verificación» (y al bianual externo de las Multipette). Hecho el 2026-11-25 en los protocolos
(plantilla de micropipetas y `Eppendorf-Multipette-plus.md`, «Cada 5 años (externo)» →
`build_mantenimientos.py` → «Quinquenal») y recargado: 109 planes «Calibración externa». Ese
mismo día se reescribieron como comprobaciones los pasos «cambiar/engrasar … si procede» de
los protocolos; en la base no queda ninguno. Estos cambios se hacen siempre en los
protocolos y se recargan, nunca a mano en la base.

## Comprobaciones con criterio: «Cumple» / «No cumple» (2026-11-23)

Un paso de las instrucciones que acaba en `(criterio: …)` —así llegan de los protocolos vía
`recargar_protocolos_planes.py`— es una **comprobación**. En «Ejecutar mantenimiento» no lleva
casilla sino **✓ Cumple / ✗ No cumple** y debajo el criterio. Detalles:

- El criterio se separa del texto con `_RE_CRITERIO` (`js/mantenimiento.js`); admite paréntesis
  dentro del criterio («Δ ≤ 1 °C (≤ 0,5 °C en 37 °C)»). Los pasos guardados antes, con el
  criterio dentro del texto, se reinterpretan solos (`_normPasoMant`).
- En `registro_mantenimientos.pasos` un paso de comprobación es
  `{texto, criterio, resultado: 'cumple'|'no_cumple'|null, nota, hecho}` (`hecho` = tiene
  resultado). Los demás siguen siendo `{texto, hecho}`.
- **No cumple ⇒ nota obligatoria** («¿Qué has visto?»): lo exige la pantalla y también
  `gestionar-mantenimiento` (`pasoNoCumpleSinNota`) al finalizar y al editar.
- Al finalizar con algún «no cumple» se abre el **aviso de avería** del equipo con lo anotado ya
  escrito (`_ofrecerAvisoNoCumple`): 🚨 «Notificar aviso» para el alumnado, ⚠️ «Reportar
  incidencia» para el profesorado. Se abre, no se envía solo: quien está delante elige el impacto.
- **Si el equipo ya tiene un aviso abierto, no se abre otro** (decisión de Paloma, 2026-11-23):
  la misma ventana pasa a modo «Añadir al aviso abierto» (`openModalAnadirAviso`) y lo visto se
  añade al final de la descripción de ese aviso con fecha y autor (`anadir_a_aviso` en
  `gestionar-incidencia`, cualquier sesión; el autor lo pone `autorRegistro()`). La gravedad del
  aviso **solo puede subir**: bajarla es decir que el equipo está mejor, y eso lo decide el
  profesorado al cerrar (lo impone también el servidor).
- **Aviso abierto en la ventana del mantenimiento:** el recuadro de arriba (`htmlAvisoEquipo(id,
  'mantenimiento')`) da el consejo según el tipo, igual que la tabla de la tarea EQU-3 del manual:
  con «No funciona» el grupo **no hace el mantenimiento** («No hagas este mantenimiento hasta
  que el profesorado lo revise»); con los otros dos, sigue. Los consejos viven en
  `_IMPACTO_AVISO` (`js/equipos-render.js`): si se cambian, cambiar también EQU-3 y MAN-2.
- En la pestaña «Visto bueno» la fila avisa «⚠ N no cumple» y enseña qué paso, su criterio y la
  nota, para que quien firma lo vea.

### Calculadora de criterios (2026-11-23)

Si el criterio lleva una tolerancia numérica, el paso trae una **🧮 calculadora**: se teclea lo
que marca el equipo y lo que mide el instrumento de referencia y ella dice si cumple. No hay que
configurar nada: `analizarCriterio()` (`js/criterios-calc.js`, funciones puras, se prueban con
Node) lee el texto del criterio. Formas que entiende:

| Criterio | Tipo | Casillas | Cálculo |
|---|---|---|---|
| `±1 °C`, `Consigna ± 3 °C`, `Velocidad ±5 %`, `Δ ≤ 1 °C`, `Error ≤ 0,02 g`, `Diferencia ≤ 1 punto`, `CO₂ ≤ 0,3 % de desviación` | desviación | equipo + referencia | \|equipo − referencia\| ≤ tol; con `%`, relativo a la referencia (salvo CO₂/humedad, donde `%` es la unidad) |
| `37 ± 0,5 °C`, `0,0 ± 0,4 °C`, `1509 ± 10 rpm (o 1032 ± 10)` | nominal | nominal (ya escrito, editable) + medido | igual; con alternativa, la más cercana a lo programado |
| `Δ ≤ 1 °C (≤ 0,5 °C en 37 °C)` | desviación | equipo + referencia | la tolerancia estricta si el equipo está a ±1 de 37 |
| `Diferencia entre la mayor y la menor ≤ 0,8 °C` | rango | lecturas separadas por espacios | mayor − menor |
| `≥ 0,4 m/s`, `T ≥ 121 °C en meseta`, `CV ≤ 3 %`, `lámpara < 1000 h`, `≤ −5 °C en 45 min` | umbral | valor medido | valor frente al límite |

- **Conservadora a propósito**: lo ambiguo no lleva calculadora y lo juzga la persona —`≤ 1 °C`
  suelto o `T ≤ 0,5 °C` (¿desviación o temperatura?), `± 2 d` (¿cuánto es d?), `±0,1 / ±10 %`,
  `≥ 80 % del vacío nominal`, `excentricidad y error ≤ …`, condiciones con «si…». Un criterio
  se trocea por `;` (y por `, ` si todos los trozos llevan tolerancia); lo que no es calculable
  («junta estanca») queda como «Comprueba tú: …».
- **Veredicto**: cualquier medida que no cumple marca el paso **No cumple** y escribe sola la nota
  con los números (la persona puede añadir lo suyo). Todas cumplen y no queda nada cualitativo →
  **Cumple**. Todas cumplen pero queda algo cualitativo → no marca nada: lo decide la persona.
  Los botones siguen funcionando para corregir a mano.
- Se guarda en el paso como `medidas: [{regla, magnitud, unidad, equipo, referencia | valor |
  lecturas, cumple, detalle}]` (`parseMedidas` en `gestionar-mantenimiento`); al reabrir (seguir
  una ejecución, editar un finalizado) las casillas salen rellenas. En «Visto bueno», las medidas
  que cumplen salen bajo la fila (🧮), para que quien firma vea los números.
- Al 2026-11-23: 37 criterios distintos / 95 pasos de los planes activos llevan calculadora.
  Para ampliar a una forma nueva, añadir el patrón en `_ccRegla` y comprobarlo contra todos los
  criterios reales antes de subirlo.

## Datos
- 410 planes activos en `planes_mantenimiento` (2026-08-22; el número crece con el tiempo,
  no usar como referencia fija). Distribución de periodicidad: Anual 172, Semestral 78,
  Bianual 72, Mensual 30, Trimestral 25, Posttemporada 22, Pretemporada 9, Trianual 2.
  Los 74 planes Bianual/Trianual son casi todos revisiones/certificaciones externas
  (autoclaves, cabinas de bioseguridad, congeladores, lupas y microscopios por SAT).
- Columna "Supervisado por" se rellena automáticamente con gestores/admins activos.
- Pendiente: actualizar Ubicacion de equipos estacionales (ver pendientes en CLAUDE.md).
