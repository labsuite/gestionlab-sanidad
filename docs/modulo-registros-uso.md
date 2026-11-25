# Módulo de registros de uso (Cabina de bioseguridad / Autoclave / Vitrina de gases) – COMPLETADO (2026-07-22, vitrina 2026-09-16)

Registros de calidad por sesión de uso, distintos de Reservas (que es agenda/planificación previa):
este módulo deja constancia de lo que realmente se hizo en cada sesión, con validez de auditoría.

⚠ **Desde 2026-11-25 sustituyen a las hojas en papel** de la cabina, las vitrinas y los autoclaves
(decisión de Paloma del 23/11/2026; apartado 11 de sus protocolos ya corregido y recargado):
recogen lo que pedía cada hoja (ver «Lo que pide cada registro»), y **un registro cerrado solo lo
corrige Gestión, dejando constancia** (ver «Correcciones de Gestión»). Tareas de la Ayuda: USO-1,
USO-2 y USO-3.

## Tablas en Supabase
- **`registros_cabina`** — `id_registro, id_equipo, usuario, fecha, hora_inicio, hora_fin, practica_tecnica, nivel_riesgo, grupo_riesgo, verificacion_previa, desinfeccion_inicial, descontaminacion_posterior, minutos_uv, incidencias, estado, correcciones`
- **`registros_autoclave`** — `id_registro, id_equipo, usuario, fecha, hora_inicio, hora_fin, programa_ciclo, tipo_carga, resultado_control, temperatura_max, presion_max, cinta_indicadora, integrador_quimico, indicador_biologico, resultado_biologico, fecha_lectura_biologico, biologico_leido_por, incidencias, estado, correcciones`
- **`registros_vitrina`** — `id_registro, id_equipo, usuario, fecha, hora_inicio, hora_fin, practica_tecnica, productos_quimicos, verificacion_previa, limpieza_posterior, incidencias, estado, correcciones`
- Columnas antiguas que ya no se escriben, con lo que tenían: `registros_cabina.nivel_riesgo` (nivel BSL; el campo bueno es `grupo_riesgo`, grupo de riesgo del agente) y `registros_autoclave.resultado_control` (los indicadores juntos). El historial las enseña solo si algún registro las tiene (`soloSiHay`).
- `Estado`: `Abierta` (sesión iniciada sin cerrar, o ciclo de autoclave en marcha) / `Cerrada` (completa)
- `Hora_Inicio` / `Hora_Fin`: strings `HH:MM`, combinadas con `Fecha` para calcular duración
- Prefijos de ID: `RC` (cabina), `RA` (autoclave), `RV` (vitrina), secuenciales de 4 dígitos (`nextIdReg`).

## Una pestaña = una entrada de `_regConfig`
Toda la pestaña se describe en `_regConfig[tipo]` (`js/registros-uso.js`) y el resto del módulo
es genérico: tabs, historial, informe, modal y validación se construyen a partir de esa
configuración. Añadir un equipo nuevo = añadir una entrada + su tabla + su `_xSbToObj`, sin
tocar ninguna función de render.

| Clave | Para qué |
|---|---|
| `key` / `prefix` | array de `DATA` y prefijo de ID |
| `tiposEquipo` | **array** de `Tipo_Equipo` de `DATA.equipos` que alimentan la pestaña |
| `label` / `tabLabel` | título en modales/informe y texto de la pestaña |
| `permiteSesionAbierta` | flujo check-in/check-out frente a registro de un solo paso (hoy, las tres) |
| `arranqueConDatos` | autoclave: se arranca con un formulario (campos de `fase: 'inicio'`), no con inicio rápido |
| `cierraCualquiera` | autoclave: el ciclo en marcha lo completa cualquier cuenta (el ciclo es del autoclave) |
| `labelIncidencias` / `placeholderIncidencias` | rótulo y ejemplo propios del campo de incidencias («Alarmas e incidencias» en la cabina) |
| `mostrarCicloModulo` | añade la columna "Ciclo / Módulo" al historial y al informe |
| `campos[]` | campos propios: `{campo, api, label, labelForm, tipo, fase, full, requerido, placeholder, opciones, permiteOtro, mostrar, soloHistorial, soloSiHay}` |

`campos[].tipo` es `text`, `number` (admite coma; el servidor valida el rango), `select` o `check`
(guarda `'Sí'`/`'No'`). Un `select` obligatorio empieza en «— Elige —». `mostrar(r)` da el texto
del historial y del informe (el indicador biológico: «Negativo (leído el …)» o «⏳ Pendiente de leer»). `permiteOtro` en un select
añade la opción "Otro" + un campo de texto libre (lo usa el programa del autoclave).
`_renderCamposSesion` / `_leerCamposSesion` los pintan y los leen con `id="reg-campo-<api>"`;
`camposApi` para la Edge Function se arma con `Object.fromEntries` sobre `campos[].api`, así que
los nombres de columna solo se escriben una vez.

## Equipos afectados
Filtrado dinámico por `Tipo_Equipo` en `DATA.equipos` — nada hardcodeado:
- **Autoclave**: `AUTC-001`, `AUTC-002` (dos equipos → selector)
- **Cabina de bioseguridad**: `CAB-03` (uno solo → se autoselecciona, sin selector visible)
- **Vitrina de extracción de gases**: `CAB-01`, `CAB-02` y `CAB-04` — los tres son Indelab
  Flow lan sv, pero el inventario arrastra tres `Tipo_Equipo` distintos para ellos
  (`Vitrina de extracción de gases`, `Cabina de extracción de gases` y `Campana de seguridadd`,
  este último con errata). Por eso `tiposEquipo` es un array con los tres nombres. La usuaria
  confirmó (2026-09-16) que **CAB-04 es también vitrina de gases**, de recirculación con filtro
  de carbono en vez de expulsión al exterior — un matiz que importa al mantenimiento (sustituir
  el filtro), no al registro de uso. Queda pendiente unificar los tres nombres en el inventario;
  mientras tanto el array los cubre.

## Lo que pide cada registro (lo que pedía la hoja en papel)
- **Cabina** (CAB-03): práctica / técnica · **grupo de riesgo del agente** (`No aplica` / `1` / `2`: laboratorios de nivel de contención 2) · **minutos de UV** si se usa · casillas «Comprobaciones previas hechas (apartado 4 del protocolo)», **desinfección inicial** y **desinfección final** · «**Alarmas e incidencias**» (derrames).
- **Vitrina** (CAB-01, CAB-02, CAB-04): práctica · productos manipulados · «Comprobaciones previas hechas (apartado 4 del protocolo)» · limpieza al terminar · incidencias.
- **Autoclave** (AUTC-001, AUTC-002), en dos tiempos:
  1. **Al arrancar** («▶ Arrancar ciclo», o su etiqueta): hora de inicio, programa (temperatura y minutos; los habituales del apartado 7 + «Otro»), tipo de carga (`Material` / `Medios` / `Residuos` + «Otro») y si lleva **indicador biológico**. Queda `Abierta` («Ciclos en marcha»); no se puede arrancar otro en el mismo autoclave hasta completarlo.
  2. **Al terminar, antes de abrir** («■ Completar ciclo»): hora de fin, **temperatura y presión máximas**, **cinta indicadora** e **integrador químico** por separado (`Viró` / `No viró` / `No se puso`). Si uno no ha virado, la app avisa de que la carga no se da por tratada.
  3. **Indicador biológico**, 24–48 h después: el ciclo sale en «Indicadores biológicos por leer» y «🧫 Apuntar resultado» guarda `Negativo` / `Positivo` (una sola vez; cambiarlo es una corrección). Si es positivo, se abre el aviso de avería del autoclave ya escrito («NO USAR»).

  Vocabulario: «indicador», nunca «control» (salvo el «control positivo» del biológico).
  «📝 Registrar ciclo completo» queda para el ciclo que no se apuntó al arrancar.

## Correcciones de Gestión (2026-11-25)
Un registro `Cerrada` ya **no** se reescribe con `guardar_sesion` (antes se podía, sin dejar rastro):
el servidor responde que lo corrige Gestión. Gestor y Administrador tienen «✏️ Corregir» en cada
fila del historial (`openModalCorregirRegistro`): el mismo formulario, con todos los campos (y el
resultado del biológico) y **motivo obligatorio**. La acción `corregir_registro` de
`gestionar-registro-uso` compara campo a campo y añade a la columna `correcciones` (jsonb) del propio
registro `{fecha_hora, corregido_por (nombre corto de quien corrige), motivo, cambios: {columna: {antes, despues}}}`.
El historial marca la fila con «✏️ Corregido» (abre el detalle) y el informe imprimible añade una
columna «Correcciones». «🗑️ Descartar» sigue siendo solo para sesiones **abiertas** por error: un
registro cerrado no se borra.

## Cabina y vitrina: sesión abierta/cerrada — Autoclave: ciclo en marcha
- **Cabina / vitrina de gases** — uso con presencia continua: sesión al entrar y al salir, con el flujo check-in/check-out de abajo.
- **Autoclave** — el ciclo se arranca con sus datos y se completa al terminar (ver arriba). Lo completa cualquiera.

## Vitrina de extracción de gases (2026-09-16)
Pedida por la profesora de Técnicas Generales de Laboratorio: mismo flujo que la cabina de
bioseguridad, pero con campos químicos en vez de biológicos (una vitrina de gases no tiene
nivel BSL):
- **Práctica / técnica** (obligatorio)
- **Productos / reactivos manipulados** (obligatorio) — trazabilidad química, el análogo del `Nivel_Riesgo` de la cabina
- **Comprobaciones previas hechas (apartado 4 del protocolo)** — check (antes, «Verificación previa de la extracción»)
- **Limpieza y retirada de material al terminar** — check

## Flujo check-in / check-out flexible vía NFC (solo cabina)
URL: `?action=registro-uso&tipo=cabina|autoclave|vitrina&equipo=ID_ACTIVO` (capturada en `_checkPendingNfcAction()`, `js/ui.js`).
Para la cabina y la vitrina, la misma etiqueta NFC sirve para abrir y cerrar sesión — la app decide según el estado:
- **Sin sesión abierta del usuario en ese equipo** → crea una fila `Abierta` con `Hora_Inicio = ahora` (zero-tap, solo un toast con botón "Deshacer" 6s).
- **Con sesión abierta del usuario en ese equipo** → abre el formulario de cierre (`openModalCerrarSesion`), con `Hora_Inicio` y `Hora_Fin` editables por si el primer escaneo se olvidó o quedó mal registrado.

Para el autoclave, la misma URL abre «Arrancar ciclo» con el autoclave elegido o, si tiene un ciclo en marcha, «Completar ciclo».

**Alternativa manual sin NFC** (pensada para alumnado que no sabe activar el NFC del móvil): en las pestañas Cabina y Vitrina, botones **"▶ Empezar sesión"** / **"■ Terminar mi sesión"** directamente en la cabecera, que llaman a las mismas funciones (`_iniciarSesionRapida`, `openModalCerrarSesion`) que dispara el escaneo. El QR de la etiqueta (ver abajo) también sirve fotografiado con la cámara, sin NFC.

Para escaneos olvidados que dejan una sesión colgada: panel **"Sesiones abiertas"** dentro del módulo — el propio usuario ve las suyas y puede cerrarlas manualmente; Gestor/Administrador ven todas y además pueden "🗑️ Descartar" (borra la fila). Al cargar datos, `_avisarSesionesAbiertasAntiguas()` avisa una vez por sesión de la app si el usuario tiene sesiones abiertas de días anteriores.

Botón **🔗 NFC** (solo Gestor/Administrador) genera el QR/URL para imprimir en la etiqueta (`openModalNfcRegistro`, reutiliza `api.qrserver.com` como en el NFC de residuos).

## Permisos
Alta abierta a cualquier usuario logueado, incluidos Alumnos (`registros-uso` en `nav` de los 4 roles en `PERMISOS`, `js/ui.js`). Cerrar sesiones ajenas de cabina o vitrina, descartar sesiones abiertas y corregir registros cerrados: solo Gestor/Administrador (`_puedeGestionarRegistros()` en el cliente; `requireAdminOrGestor` en el servidor). El ciclo de autoclave en marcha y el resultado del biológico, cualquiera.

## Horas acumuladas
`_horasAcumuladasReg()` suma la duración de todas las sesiones `Cerrada` de un equipo — dato informativo mostrado en la cabecera de cada pestaña, pensado como apoyo visual al plan de mantenimiento (no dispara nada automáticamente todavía).

## Informe imprimible
`generarInformeRegistro()` — vista HTML propia con `window.print()` (mismo patrón que el informe de Consenur en `residuos.js`), sin plantilla oficial de fondo porque no existe una para este registro.

## Ciclo / Módulo del usuario
`mostrarCicloModulo = true` en `_regConfig` (las tres pestañas) añade una columna "Ciclo / Módulo" al historial y al informe, con `_cicloModuloUsuario(email)` haciendo lookup en `DATA.usuarios` (`Ciclo_Principal` + `Modulo`) por email.

## Navegación
Ítem "📝 Registros de uso" en el sidebar, dentro de la sección **Equipos**, justo debajo de "📅 Reservas".

## Pendiente
- Vincular horas acumuladas con la generación automática de próximos mantenimientos (fase futura, no implementado).
- Decidir si conviene imprimir/plastificar ya las etiquetas NFC físicas (pendiente de instituto).
