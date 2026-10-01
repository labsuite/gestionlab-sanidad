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
- Todos los roles (incluido Alumno): pueden ver la Guía y registrar adiciones en contenedores (botón "+ Añadir residuo")
- Admin / Gestor (solo): pueden crear, editar, cerrar y eliminar **contenedores**, ver la pestaña "Pendientes de recogida" y registrar la recogida. El **Profesor** solo añade residuos a los activos (antes también podía gestionarlos; retirado 2026-09-06). La Edge Function `gestionar-residuo` exige `requireAdminOrGestor` para esas acciones.
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

## Normas generales del gestor de residuos (2026-10-01)

Reglas acordadas con el gestor de residuos y contadas por la usuaria. Viven en
`_NORMAS_GESTOR` (`js/residuos.js`) y, copiadas, en `NORMAS_GESTOR`
(`supabase/functions/gestionar-residuo/index.ts`) — **mantener las dos iguales**. Se usan en
tres sitios:
1. Tarjeta plegable **📋 Normas generales del gestor de residuos** en la Guía (`_renderNormasGestor`), para todos los roles.
2. Prompt del consultorio (`_construirSystemPromptResiduo`).
3. Prompt del validador IA de `añadir_adicion` (Nivel 3).

En los dos prompts las normas **mandan sobre una ficha del catálogo** que diga otra cosa (son
lo más reciente). Resumen: aguas de laboratorio = mezclas acuosas de autoanalizadores/lavador de
ELISA/kits y lo habitual de tinciones · contenedor cuadrado azul = SOLO formol/etanol CON
muestra (incinera); sin muestra → no halogenados (= Contenedor Inertes aquí) · bolsa plástica =
envases vacíos y papel/guantes/filtros manchados, sin líquido acumulado, volátiles en zip ·
rígidos negros → autoclave, azules → incinerar, azules de ballesta y bolsa → químicos ·
punzantes = todo lo punzante; portas NO contaminados con material fijado pueden ir a la
basura protegidos · **salvavidas**: bote azul de ballesta "Reactivos de laboratorio" para
cantidades <~1 L de químicos de destino dudoso, en frasco cerrado y resistente.

Consecuencias en los prompts: el guardarraíl "nunca basura general" tiene la excepción de esos
portas, y la guía provisional de un químico pequeño sin contenedor claro es el salvavidas (no
para biológico/cortopunzante, riesgo agudo ni mezclas accidentales).

**Catálogo recolocado el 2026-10-01** en dos rondas con las decisiones de la usuaria
(`scripts/recolocar_residuos_2026_10.py`, ya ejecutado, refleja el estado final): efluente del
lavador ELISA, reactivos de autoanalizadores y **todas** las tinciones (etanólicas/metanólicas,
ácidas, fenólicas, Lugol, Coomassie — "juntas mientras no reaccionen entre sí"; el ácido
peryódico, oxidante, se queda en el salvavidas) → `Aguas Laboratorio`; agua con formol y
fijador de citometría → `Contenedor Inertes` (no halogenados); tejidos en formol →
`Muestras en formol` (nombre que usa el gestor); frotis/portas teñidos, secciones, bloques de
parafina y preparación histológica completa (solo trazas de X-Free) → `Basura normal` (no es
un contenedor, no se registran adiciones); frotis con lactofenol → `Residuo Cortante`; fuera del
catálogo los portas de Neubauer sin tripán y los cartuchos DRI-CHEM; `Pendiente Consenur` ya no
existe; `Frasco Propio` **es** el
salvavidas y se renombró a `Reactivos de laboratorio`. Categoría nueva `Bolsa plástica
(químicos)` con dos tipos. Contenedores dados de alta en el lab 207 (Almacén de residuos): la
bolsa (formato `Bolsa plástica`) y el salvavidas (formato `Bidón azul de ballesta`). La bolsa
lleva el recordatorio de que es la misma para todo y hay que marcar con una X su uso.

El choque con la exclusividad CMR se resolvió quitando esa regla (ver Nivel 2 más abajo).

Tercera ronda: la **lejía diluida** va al fregadero (categoría `Fregadero`, no es contenedor); la
indicación está en su descripción, que es lo que permite a las IAs decir "al desagüe".

**Las IAs explican siempre el porqué** (petición de la usuaria): por qué va a un sitio y por qué
no al de al lado, con algo concreto del residuo (qué lleva, con qué reacciona, qué norma lo
decide). El bloqueo fijo de Nivel 1 también lo hace: dice a qué categoría va el residuo y añade
la razón de `MOTIVO_CATEGORIA` (`gestionar-residuo`), sacada de las normas del gestor.

**Aguas en dos garrafas** (2026-10-01): `Aguas Laboratorio - Tinciones` (todo lo de tinciones,
que suele ser ácido) y `Aguas Laboratorio - Equipos` (autoanalizadores, citómetro, coagulómetros,
botella del lavador de ELISA —que lleva la lejía de la limpieza, NO la parada ni el TMB, que se
quedan en la placa—, kits de diagnóstico, tampones, medios, PCR, OCT). Así lo ácido y lo que
lleva lejía nunca coinciden. La garrafa del 203 pasó a Equipos (ahí están casi todos los
autoanalizadores) y la del 205 a Tinciones. Luego (decisión de la usuaria) se añadieron
garrafas de Tinciones en el 203 y el 207: **203 = Equipos + Tinciones, 205 = Tinciones, 207 =
Tinciones**. El lavador de ELISA está en el 205 y se vacía en la de Equipos del 203 (pocos ELISA).
Etiquetas NFC antiguas con `cont-cat=Aguas Laboratorio`: `_abrirAdicionPorNfc` abre la garrafa
de aguas del lab si solo hay una; si hay dos (203) no adivina, deja elegir en Contenedores. Regrabarlas.

**Kits de tinción con botes desconocidos**: por defecto a Tinciones; las IAs separan oxidantes,
pícrico/Bouin y DAB (salvavidas) y xileno/X-Free/formol (Inertes). Los que llevan plata,
mercurio o cromo son kits diagnósticos y van también a Tinciones (decisión de la usuaria).

Azul tripán y yoduro de propidio → salvavidas `Reactivos de laboratorio` (se usan en poca
cantidad; decisión de la usuaria). La categoría `Contenedor Citotóxicos` se quedó sin tipos;
el cubo "Citotóxicos" del 207 sigue activo hasta que la usuaria decida qué hacer con él.

No se usa `Residuo Biológico GII`: calibradores/controles de autoanalizadores → `Aguas Laboratorio -
Equipos`; ropa/EPI con sangre → `Bolsa de autoclave`. La categoría desaparece.

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
  `Categoria` del contenedor de destino. Solo se aplica si se ha elegido un tipo del catálogo.
- **Nivel 2 — incompatibilidad GHS**: el `Riesgo` del nuevo residuo se compara contra el de los
  tipos ya registrados en ese contenedor concreto (vía su historial en `Adiciones_Residuo`), usando
  una matriz pequeña de pares incompatibles (Comburente↔Inflamable, Comburente↔Explosivo,
  Corrosivo↔Comburente, Explosivo↔Inflamable, Explosivo↔Corrosivo). **Solo se aplica donde el
  contenido se mezcla de verdad** (`contenidoSeMezcla`): formato garrafa, o sin formato y categoría
  a granel (Aguas, Inertes, Ácidos, Halogenados). En bidón azul, bolsa, cubo, rígido, punzantes o
  ballesta cada cosa va en su envase cerrado y no hay reacción posible (antes bloqueaba sin motivo,
  p. ej. etanol:éter en el salvavidas tras un permanganato).
  La antigua regla de "exclusividad" (CMR/citotóxico solo en su contenedor) **se quitó el
  2026-10-01**: no venía del gestor y chocaba con sus normas ("juntas mientras no reaccionen").
- **Nivel 2b — cloro**: donde se mezcla, lejía/hipoclorito nunca con algo ácido (en los dos
  sentidos). Como los pictogramas no lo distinguen (ambos "Corrosivo"), se reconoce por texto
  (`claseCloro`: nombre + descripción de la ficha, o el texto libre; ignora "ácidos nucleicos").
  La IA sola no lo frenaba en la prueba real.

Si hay conflicto en Nivel 1/2, la Edge Function devuelve **400** con un mensaje explicando qué ya
hay dentro y por qué no es compatible; el cliente lo muestra vía `showToast`. Este bloqueo
determinista **no es forzable**.

- **Nivel 3 — comprobación con IA** (desde 2026-09): si Nivel 1/2 pasan y no viene `ia_override`,
  la Edge Function llama a Gemini (`llamarGeminiChat`, misma clave de servidor que el consultorio)
  con: el contenedor de destino (categoría, lab, formato + aviso de `_WARNINGS_FORMATO`), los tipos
  distintos que ya lleva dentro con su `Riesgo`/`Descripcion`, lo que se quiere añadir (tipo del
  catálogo **y/o** un texto libre que escribe la persona en el modal), el catálogo completo, los
  contenedores activos de todo el centro y las excepciones ya aprobadas para esa categoría. La
  respuesta empieza con etiqueta anclada, parseada por `parseRespuestaComprobacionIA`:
  - `[OK]` → sigue adelante e inserta.
  - `[BLOQUEO|categoria=<GHS|Desconocido>|contenedor_sugerido=<Contenedor_Tipo|ninguno>]` → la
    Edge Function responde **200** con `{ ia_bloqueo:true, mensaje, categoria_ia, contenedor_sugerido }`
    (no un 400, para que `callEdgeFunction` no lo convierta en throw). El cliente
    (`_mostrarBloqueoIaAdicion`) muestra el motivo + a dónde llevarlo y un botón **"La IA se
    equivoca — registrar igualmente"** que reenvía con `ia_override:true` + `registrar_excepcion:true`.
  - Si la IA no respeta el formato → fail-safe: se trata como bloqueo (`categoria=Desconocido`).
  - Si Gemini falla o da 503 (reintentos agotados): si hay tipo del catálogo (ya validado por
    Nivel 1/2) se permite y se inserta; si es **solo texto libre**, la Edge Function responde
    `{ ia_no_verificado:true, mensaje }` y `_mostrarIaNoVerificado` ofrece "Registrar sin comprobar"
    (`ia_override:true`, `registrar_excepcion:false` — no crea excepción porque no hubo juicio de la IA).
  - `llamarGeminiChat` reintenta 2 veces (0 / 2 s) ante 503/429/500 —`gemini-3.6-flash` sufre
    picos de "high demand" que afectan por igual al consultorio— y aborta cada intento a los 16 s
    para que el worker de Supabase no muera con `WORKER_RESOURCE_LIMIT` (546 sin cuerpo útil).
  - El historial que se manda a Gemini **debe terminar en un turno `user`** (si no: 400
    "Requests ending with a model turn are not supported"): el caso concreto a evaluar va como
    último mensaje del usuario en `construirHistoryComprobacionIA`, no dentro del systemText. El
    catálogo se manda con el `Detalle` solo de los tipos de la categoría de destino o ya presentes
    dentro (el resto, una línea) para no inflar el prompt y disparar los 503.
  - `añadir_adicion` acepta `debug: true` en el body: añade un campo `detalle` con el texto real
    del error de Gemini a la respuesta `ia_no_verificado` (solo para diagnóstico manual).

### Registro de adiciones no catalogadas

`adiciones_residuo.id_residuo` es **nullable** y hay columna `descripcion_libre`: una adición
puede quedar registrada solo con el texto que escribió la persona (sin tipo del catálogo). El
historial de adiciones (`_renderContenedoresActivos`) muestra `Descripcion_Libre` con la etiqueta
"(texto libre)" cuando no hay tipo.

### Tabla `excepciones_residuo_ia`

`id_excepcion, id_contenedor, categoria_contenedor, id_residuo (nullable), descripcion_libre
(nullable), motivo_ia, usuario, fecha`. Una fila por cada vez que alguien pulsa "registrar
igualmente" tras un `[BLOQUEO]` real de la IA (no tras "IA no disponible"). Doble uso:
1. **Auditoría para Gestión** — panel en `renderPanelConsultasResiduo` (Admin/Gestor): bloque
   "🤖 Adiciones registradas pese al aviso de la IA" con qué se añadió, a qué contenedor, qué
   objetó la IA, quién y cuándo. El panel se muestra si hay consultas pendientes **o** excepciones.
2. **Realimentación del prompt** — `añadir_adicion` pasa a la IA las excepciones ya aprobadas para
   esa `categoria_contenedor` con la instrucción de considerar compatible el caso si coincide
   claramente con una de ellas ("aprende" sin reentrenar nada).

## Etiquetas NFC/QR
La URL codifica **categoría + lab** (no el ID del contenedor) → la etiqueta nunca necesita reprogramarse al cerrar un contenedor. `_checkPendingNfcAction()` en `ui.js` detecta los parámetros tras el login y redirige al modal de adición correcto.

## Categorías de contenedor
Dinámicas: emergen de los valores únicos de `Contenedor_Tipo` en Tipos_Residuo. Crear un tipo con nombre de contenedor nuevo crea una nueva categoría automáticamente.

## Pendiente (datos)
- Revisar que todos los tipos tengan `Contenedor_Tipo` relleno.
- Contenedores físicos: introducir en Contenedores_Residuo con nivel inicial (requiere acceso al instituto).
