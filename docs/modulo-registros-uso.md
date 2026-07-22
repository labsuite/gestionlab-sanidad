# Módulo de registros de uso (Cabina de bioseguridad / Autoclave) – COMPLETADO (2026-07-22)

Registros de calidad por sesión de uso, distintos de Reservas (que es agenda/planificación previa):
este módulo deja constancia de lo que realmente se hizo en cada sesión, con validez de auditoría.

## Hojas en Sheets
- **Registros_Cabina** — columnas A-L: `ID_Registro, ID_Equipo, Usuario, Fecha, Hora_Inicio, Hora_Fin, Practica_Tecnica, Nivel_Riesgo, Verificacion_Previa, Descontaminacion_Posterior, Incidencias, Estado`
- **Registros_Autoclave** — columnas A-K: `ID_Registro, ID_Equipo, Usuario, Fecha, Hora_Inicio, Hora_Fin, Programa_Ciclo, Tipo_Carga, Resultado_Control, Incidencias, Estado`
- `Estado`: `Abierta` (sesión iniciada, sin cerrar) / `Cerrada` (sesión completa)
- `Hora_Inicio` / `Hora_Fin`: strings `HH:MM`, combinadas con `Fecha` para calcular duración

## Equipos afectados
Filtrado dinámico por `Tipo_Equipo` en `DATA.equipos` — nada hardcodeado:
- **Autoclave**: `AUTC-001`, `AUTC-002` (dos equipos → selector)
- **Cabina de bioseguridad**: `CAB-03` (uno solo → se autoselecciona, sin selector visible)

## Cabina: sesión abierta/cerrada — Autoclave: ciclo único
`_regConfig[tipo].permiteSesionAbierta` marca la diferencia (solo `true` para cabina):
- **Cabina** — uso con presencia continua: tiene sentido abrir sesión al entrar y cerrarla al salir. Usa el flujo check-in/check-out de abajo, con `Estado` `Abierta`/`Cerrada`.
- **Autoclave** — ciclo automático: se registra en un solo paso al ponerlo en marcha (`openModalSesionRegistro`, sin `Estado` `Abierta` nunca). `Hora_Fin` es opcional — no hay nadie esperando delante para "cerrar" el ciclo.

## Flujo check-in / check-out flexible vía NFC (solo cabina)
URL: `?action=registro-uso&tipo=cabina|autoclave&equipo=ID_ACTIVO` (capturada en `_checkPendingNfcAction()`, `js/ui.js`).
Para la cabina, la misma etiqueta NFC sirve para abrir y cerrar sesión — la app decide según el estado:
- **Sin sesión abierta del usuario en ese equipo** → crea una fila `Abierta` con `Hora_Inicio = ahora` (zero-tap, solo un toast con botón "Deshacer" 6s).
- **Con sesión abierta del usuario en ese equipo** → abre el formulario de cierre (`openModalCerrarSesion`), con `Hora_Inicio` y `Hora_Fin` editables por si el primer escaneo se olvidó o quedó mal registrado.

Para el autoclave, la misma URL abre directamente `openModalSesionRegistro(tipo, idEquipo)` con el equipo preseleccionado — sin comprobar sesión abierta.

**Alternativa manual sin NFC** (pensada para alumnado que no sabe activar el NFC del móvil): en la pestaña Cabina, botones **"▶ Empezar sesión"** / **"■ Terminar mi sesión"** directamente en la cabecera, que llaman a las mismas funciones (`_iniciarSesionRapida`, `openModalCerrarSesion`) que dispara el escaneo. El QR de la etiqueta (ver abajo) también sirve fotografiado con la cámara, sin NFC.

Para escaneos olvidados que dejan una sesión de cabina colgada: panel **"Sesiones abiertas"** dentro del módulo — el propio usuario ve las suyas y puede cerrarlas manualmente; Gestor/Administrador ven todas y además pueden "🗑️ Descartar" (borra la fila). Al cargar datos, `_avisarSesionesAbiertasAntiguas()` avisa una vez por sesión de la app si el usuario tiene sesiones abiertas de días anteriores.

Botón **🔗 NFC** (solo Gestor/Administrador) genera el QR/URL para imprimir en la etiqueta (`openModalNfcRegistro`, reutiliza `api.qrserver.com` como en el NFC de residuos).

## Permisos
Alta abierta a cualquier usuario logueado, incluidos Alumnos (`registros-uso` en `nav` de los 4 roles en `PERMISOS`, `js/ui.js`). Cerrar/descartar sesiones ajenas: solo Gestor/Administrador (`_puedeGestionarRegistros()`).

## Horas acumuladas
`_horasAcumuladasReg()` suma la duración de todas las sesiones `Cerrada` de un equipo — dato informativo mostrado en la cabecera de cada pestaña, pensado como apoyo visual al plan de mantenimiento (no dispara nada automáticamente todavía).

## Informe imprimible
`generarInformeRegistro()` — vista HTML propia con `window.print()` (mismo patrón que el informe de Consenur en `residuos.js`), sin plantilla oficial de fondo porque no existe una para este registro.

## Navegación
Ítem "📝 Registros de uso" en el sidebar, dentro de la sección **Equipos**, justo debajo de "📅 Reservas".

## Pendiente
- Vincular horas acumuladas con la generación automática de próximos mantenimientos (fase futura, no implementado).
- Decidir si conviene imprimir/plastificar ya las etiquetas NFC físicas (pendiente de instituto).
