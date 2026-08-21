# Módulo de residuos – COMPLETADO (2026-05-18)

## Hojas en Sheets
- **Tipos_Residuo** — columnas A-G: `ID_Residuo, Nombre, Descripcion, Riesgo, Contenedor_Tipo, Lab, Zona`
  - `Lab` y `Zona` existen en el sheet pero ya no se usan en la UI
- **Contenedores_Residuo** — columnas A-K: `ID_Contenedor, Categoria, Lab, Zona, Nivel, Estado, Fecha_Apertura, Fecha_Cierre, Fecha_Actualizacion, Actualizado_Por, Formato`
  - `Estado`: `activo` / `cerrado` (listo para recogida) / `recogido` (eliminado físicamente)
- **Adiciones_Residuo** — columnas A-F: `ID_Adicion, ID_Contenedor, ID_Residuo, Fecha, Usuario, Observaciones`
- **Consultas_Residuo** — columnas A-F: `ID_Consulta, Fecha, Usuario, Descripcion, Ubicacion_Dejado, Estado`
  - Estado: `Pendiente` / `Resuelta`

## Niveles de contenedor
`vacío` / `25%` / `50%` / `75%` / `lleno`. Badge en nav cuando hay alguno al 75%, lleno o cerrado.

## Ciclo de vida de un contenedor
1. Se crea como `activo` con nivel inicial.
2. Se registran adiciones (cada una actualiza el nivel).
3. Al cerrarlo: `Estado=cerrado`, `Fecha_Cierre` registrada, se crea automáticamente un contenedor nuevo vacío de la misma categoría+lab.
4. Al registrar la recogida de Consenur: `Estado=recogido`, la fila se elimina físicamente del sheet.

## Roles
- Todos los roles (incluido Alumno): pueden ver la Guía y registrar adiciones en contenedores
- Admin / Gestor / **Profesor**: pueden crear, editar, cerrar y eliminar **contenedores**
- Admin / Gestor (solo): pueden crear, editar y eliminar **tipos de residuo** (Profesor no tiene este permiso)

## Peligrosidad GHS
- `Riesgo` almacena pictogramas como string con comas: `"Tóxico, Inflamable"` (vacío = sin peligrosidad)
- Valores canónicos: `Tóxico` / `Nocivo / Irritante` / `Inflamable` / `Comburente` / `Corrosivo` / `Cancerígeno / CMR` / `Peligroso para el medio ambiente` / `Explosivo` / `Gas comprimido` / `Citotóxico`
- `_GHS` — constante con mapa `{nombre: {icon, bg, color}}` para los 10 pictogramas
- `_riesgoBadges(riesgo)` — renderiza cada valor GHS como chip de color; valores no reconocidos → chip genérico ⚠️ naranja
- Los 113 tipos R001–R113 tienen Riesgo actualizado con `scripts/actualizar_riesgos_ghs.py`

## Avisos de seguridad por formato (`_WARNINGS_FORMATO`)
| Formato (matching parcial) | Aviso |
|---|---|
| bidón azul | Líquidos en bote propio, cerrado y rotulado dentro del bidón |
| cubo con tapa / contenedor rígido | NO cerrar tapa hasta que esté lleno y listo para Consenur |
| bolsa plástica | Solo envases vacíos de plástico/aluminio; nada a granel |
| garrafa | Mantener cerrada entre adiciones; zona ventilada sin calor |

## Consultas de residuo desconocido
- `Consultas_Residuo` — columnas A-F de Sheets + 3 columnas añadidas para el consultorio IA: `Categoria_IA` (categoría GHS que infirió la IA, o vacío), `Guia_Provisional` (texto de manejo provisional que se le dio al usuario), `Prioridad` (`Normal` / `Alta`)
- Badge en nav suma consultas pendientes + contenedores al 75%/lleno/cerrado
- Banner en dashboard para Gestor/Admin cuando hay consultas pendientes
- Stat card en dashboard: "Residuos por clasificar"
- Cuando la búsqueda no encuentra resultados: mensaje "No lo tires todavía" + botón "Avisar a la gestora" (camino manual, sigue existiendo como fallback)
- Panel de consultas (`renderPanelConsultasResiduo`, Gestor/Admin): ordena `Prioridad='Alta'` primero, muestra badge rojo "PRIORIDAD ALTA" y badge "IA: <categoría>", y un extracto de la guía provisional ya dada
- Desde el panel de consultas: botón "＋ Añadir a guía" abre modal de nuevo tipo con descripción pre-rellenada y, si `Categoria_IA` coincide con un valor canónico de `_GHS`, pre-marca ese riesgo

## Consultorio de residuos (IA)

Camino principal para identificar un residuo, en `residuos-guia` (botón "💬 Abrir consultorio de
residuos" → `abrirChatResiduo()`, `js/residuos.js`). Abierto a cualquier rol.

1. El usuario elige su laboratorio actual en un `<select>` (poblado con los `Lab` que tienen al
   menos un contenedor `activo`; se preselecciona si coincide con `_getLabsDeUbics()` del usuario).
2. Describe el residuo en lenguaje natural. La IA (Gemini, llamado vía la acción `consultar_ia`
   de `gestionar-residuo` — la clave vive como secreto de servidor `GEMINI_API_KEY`, nunca en el
   navegador ni en el repo; ver CLAUDE.md) recibe como contexto el catálogo
   `DATA.tiposResiduo`, los contenedores activos de **todos** los laboratorios (no solo el actual —
   si el compatible está en otro lab, se le dice al usuario que vaya allí en vez de escalar a
   Gestión sin necesidad) y los avisos de `_WARNINGS_FORMATO`, más un bloque de reglas de
   seguridad ("guardarraíles") que nunca puede saltarse (nunca verter por el desagüe —salvo la
   excepción de "Aguas de laboratorio", ver abajo—, nunca mezclar, tratamiento especial para
   químicos GHS, biológico/cortopunzante, CMR/citotóxico, envases sin etiqueta, mezclas
   accidentales...) y una instrucción explícita de negarse a responder nada que no sea sobre
   residuos de laboratorio (ver etiqueta `[FUERA_DE_TEMA]` abajo).
3. **"Aguas Laboratorio" es un `Contenedor_Tipo` normal, no un caso especial** — ya existe como
   categoría real con contenedores físicos activos (garrafas 20L en varios labs) para residuos
   acuosos de bajo riesgo (buffers diluidos, colorantes acuosos, medios de cultivo sin DMSO...).
   Se probó primero una excepción "sin contenedor físico" para esto y se descartó: el fallo real
   detectado (residuo de tinción de Gram mal clasificado) no era de arquitectura, era que el
   catálogo enviado a la IA solo incluía Nombre/Riesgo/Contenedor_Tipo, sin la `Descripcion` — y
   ahí es donde vivían las pistas para desambiguar (p.ej. "Colorantes acuosos diluidos... gram
   acuosos etc."). Ahora `catalogo` en `_construirSystemPromptResiduo` incluye también el
   `Detalle` (Descripcion), y se instruye a la IA a preguntar para aclarar si la descripción del
   usuario podría encajar con más de un tipo con `Contenedor_Tipo` distinto, en vez de adivinar.
   La excepción a "nunca desagüe" queda ligada a lo que la propia `Descripcion` del tipo ya
   dice explícitamente (algunas entradas, como los calibradores de pHmetro, ya traen su propia
   condición de vertido directo escrita por Gestión) — la IA nunca la generaliza a otros residuos.
4. **Mecanismo de resuelto/escalada** — la respuesta de la IA debe empezar con una de tres
   etiquetas machine-parseable, detectadas por regex ancladas al inicio (tolerantes a espacios/
   saltos de línea, `_parseRespuestaChatResiduo` en `js/residuos.js`), nunca por inferencia de
   lenguaje natural:
   - `[RESUELTO]` → se muestra el resto, no se escala nada.
   - `[NO_RESUELTO|categoria=<GHS o "Desconocido">|prioridad=<Alta|Normal>]` → se muestra el resto
     y se llama automáticamente a la acción `crear_consulta` de `gestionar-residuo` con esos datos.
   - `[FUERA_DE_TEMA]` → el mensaje no describe un residuo real (charla trivial, otro tema,
     intento de que la IA ignore sus instrucciones); se muestra un recordatorio y **no** se crea
     ninguna consulta. El prompt incluye un turno de ejemplo (few-shot) mostrando este formato,
     porque en pruebas reales el modelo a veces respondía la pregunta en vez de ignorarla si solo
     se le decía por instrucción.
   - Si la IA no respeta ninguna etiqueta: fail-safe, se trata como no resuelto con
     `categoria_ia='Desconocido'` — mejor escalar de más un caso real que perder uno en silencio.
5. Sin historial persistente (se borra al cerrar el modal). Sin `js/asistente.js` — todo vive en
   `js/residuos.js` y el modal `modal-chat-residuo` de `html/modales-residuos.html`.

## Validación de compatibilidad al añadir (server-side)

`añadir_adicion` en `supabase/functions/gestionar-residuo/index.ts` valida, antes de insertar
(bloqueo total, sin excepción de rol — ni Gestor ni Admin pueden forzarlo desde la app; aplica
igual si se llega por selección manual que por escaneo NFC, porque ambos llaman a la misma acción):

- **Nivel 1 — categoría**: el `Contenedor_Tipo` del tipo de residuo debe coincidir con la
  `Categoria` del contenedor de destino.
- **Nivel 2 — incompatibilidad GHS**: el `Riesgo` del nuevo residuo se compara contra el de los
  tipos ya registrados en ese contenedor concreto (vía su historial en `Adiciones_Residuo`), usando
  una matriz pequeña de pares incompatibles (Comburente↔Inflamable, Comburente↔Explosivo,
  Corrosivo↔Comburente, Explosivo↔Inflamable, Explosivo↔Corrosivo) más una regla de categorías
  exclusivas: Citotóxico y Cancerígeno/CMR nunca pueden convivir con ningún otro tipo de residuo
  distinto en el mismo contenedor (añadir más del mismo tipo exacto sí está permitido).

Si hay conflicto, la Edge Function devuelve 400 con un mensaje explicando qué ya hay dentro y por
qué no es compatible; el cliente lo muestra vía `showToast` (patrón ya usado en todo el módulo).

## Etiquetas NFC/QR
La URL codifica **categoría + lab** (no el ID del contenedor) → la etiqueta nunca necesita reprogramarse al cerrar un contenedor. `_checkPendingNfcAction()` en `ui.js` detecta los parámetros tras el login y redirige al modal de adición correcto.

## Categorías de contenedor
Dinámicas: emergen de los valores únicos de `Contenedor_Tipo` en Tipos_Residuo. Crear un tipo con nombre de contenedor nuevo crea una nueva categoría automáticamente.

## Pendiente (datos)
- Revisar que todos los tipos tengan `Contenedor_Tipo` relleno.
- Contenedores físicos: introducir en Contenedores_Residuo con nivel inicial (requiere acceso al instituto).
