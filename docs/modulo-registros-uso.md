# Módulo de registros de uso (Cabina de bioseguridad / Autoclave / Vitrina de gases) – COMPLETADO (2026-07-22, vitrina 2026-09-16)

Registros de calidad por sesión de uso, distintos de Reservas (que es agenda/planificación previa):
este módulo deja constancia de lo que realmente se hizo en cada sesión, con validez de auditoría.

## Tablas en Supabase
- **`registros_cabina`** — `id_registro, id_equipo, usuario, fecha, hora_inicio, hora_fin, practica_tecnica, nivel_riesgo, verificacion_previa, descontaminacion_posterior, incidencias, estado`
- **`registros_autoclave`** — `id_registro, id_equipo, usuario, fecha, hora_inicio, hora_fin, programa_ciclo, tipo_carga, resultado_control, incidencias, estado`
- **`registros_vitrina`** — `id_registro, id_equipo, usuario, fecha, hora_inicio, hora_fin, practica_tecnica, productos_quimicos, verificacion_previa, limpieza_posterior, incidencias, estado`
- `Estado`: `Abierta` (sesión iniciada, sin cerrar) / `Cerrada` (sesión completa)
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
| `permiteSesionAbierta` | flujo check-in/check-out frente a registro de un solo paso |
| `mostrarCicloModulo` | añade la columna "Ciclo / Módulo" al historial y al informe |
| `campos[]` | campos propios: `{campo, api, label, labelForm, tipo, full, requerido, placeholder, opciones, permiteOtro}` |

`campos[].tipo` es `text`, `select` o `check` (guarda `'Sí'`/`'No'`). `permiteOtro` en un select
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

## Cabina y vitrina: sesión abierta/cerrada — Autoclave: ciclo único
`_regConfig[tipo].permiteSesionAbierta` marca la diferencia (`true` en cabina y vitrina):
- **Cabina / vitrina de gases** — uso con presencia continua: tiene sentido abrir sesión al entrar y cerrarla al salir. Usan el flujo check-in/check-out de abajo, con `Estado` `Abierta`/`Cerrada`.
- **Autoclave** — ciclo automático: se registra en un solo paso al ponerlo en marcha (`openModalSesionRegistro`, sin `Estado` `Abierta` nunca). `Hora_Fin` es opcional — no hay nadie esperando delante para "cerrar" el ciclo.

## Vitrina de extracción de gases (2026-09-16)
Pedida por la profesora de Técnicas Generales de Laboratorio: mismo flujo que la cabina de
bioseguridad, pero con campos químicos en vez de biológicos (una vitrina de gases no tiene
nivel BSL):
- **Práctica / técnica** (obligatorio)
- **Productos / reactivos manipulados** (obligatorio) — trazabilidad química, el análogo del `Nivel_Riesgo` de la cabina
- **Verificación previa de la extracción** (caudal y pantalla a la altura marcada) — check
- **Limpieza y retirada de material al terminar** — check

## Flujo check-in / check-out flexible vía NFC (solo cabina)
URL: `?action=registro-uso&tipo=cabina|autoclave|vitrina&equipo=ID_ACTIVO` (capturada en `_checkPendingNfcAction()`, `js/ui.js`).
Para la cabina y la vitrina, la misma etiqueta NFC sirve para abrir y cerrar sesión — la app decide según el estado:
- **Sin sesión abierta del usuario en ese equipo** → crea una fila `Abierta` con `Hora_Inicio = ahora` (zero-tap, solo un toast con botón "Deshacer" 6s).
- **Con sesión abierta del usuario en ese equipo** → abre el formulario de cierre (`openModalCerrarSesion`), con `Hora_Inicio` y `Hora_Fin` editables por si el primer escaneo se olvidó o quedó mal registrado.

Para el autoclave, la misma URL abre directamente `openModalSesionRegistro(tipo, idEquipo)` con el equipo preseleccionado — sin comprobar sesión abierta.

**Alternativa manual sin NFC** (pensada para alumnado que no sabe activar el NFC del móvil): en las pestañas Cabina y Vitrina, botones **"▶ Empezar sesión"** / **"■ Terminar mi sesión"** directamente en la cabecera, que llaman a las mismas funciones (`_iniciarSesionRapida`, `openModalCerrarSesion`) que dispara el escaneo. El QR de la etiqueta (ver abajo) también sirve fotografiado con la cámara, sin NFC.

Para escaneos olvidados que dejan una sesión colgada: panel **"Sesiones abiertas"** dentro del módulo — el propio usuario ve las suyas y puede cerrarlas manualmente; Gestor/Administrador ven todas y además pueden "🗑️ Descartar" (borra la fila). Al cargar datos, `_avisarSesionesAbiertasAntiguas()` avisa una vez por sesión de la app si el usuario tiene sesiones abiertas de días anteriores.

Botón **🔗 NFC** (solo Gestor/Administrador) genera el QR/URL para imprimir en la etiqueta (`openModalNfcRegistro`, reutiliza `api.qrserver.com` como en el NFC de residuos).

## Permisos
Alta abierta a cualquier usuario logueado, incluidos Alumnos (`registros-uso` en `nav` de los 4 roles en `PERMISOS`, `js/ui.js`). Cerrar/descartar sesiones ajenas: solo Gestor/Administrador (`_puedeGestionarRegistros()`).

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
