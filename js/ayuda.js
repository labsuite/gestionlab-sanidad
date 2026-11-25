// ============================================================
// AYUDA — manual de uso por tareas de laboratorio, un manual por rol
// ============================================================
// Plan, catálogo de tareas y plantilla: «B. Laboratorio/Manual GestionLab/CLAUDE.md»
// (fuera del repo). Cada tarea se escribe UNA vez (AYUDA_TAREAS) con una versión por
// manual cuando cambia según el rol; cada manual (AYUDA_MANUALES) es la selección y el
// orden de las tareas de ese rol.
//
// - Cada rol ve solo su manual; Gestor y Administrador pueden abrir todos.
// - Botón «?» de la barra superior (abrirAyudaPantalla): tareas del manual de quien ha
//   entrado que pasan por la pantalla actual (campo `pantallas`, ids de showPage).
// - El contenido de laboratorio (Quién, Cuándo, Antes de empezar, Comprobación…) viene
//   del guion de cada tarea («guiones/<código>_*.md») y NO se reescribe aquí; los pasos y
//   las capturas los escribe Claude Code. Capturas en assets/ayuda/<código>/, generadas con
//   tools/capturas-ayuda/ (datos de ejemplo, sin nombres reales).
// - Marcado del texto: **negrita** y [[CÓDIGO|texto]] para enlazar otra tarea (si esa
//   tarea aún no está escrita, sale el texto sin enlace). Los códigos son internos: nunca
//   se enseñan.

const AYUDA_MANUALES = {
  Alumno: {
    titulo: 'Manual del alumnado',
    intro: 'Lo que hace tu grupo en GestionLab, contado como tareas de laboratorio. Entras con la cuenta del grupo, y lo que registras sale a nombre del grupo.',
    secciones: [
      { titulo: 'Al llegar', tareas: ['EMP-1', 'EMP-6'] },
      { titulo: 'Durante la práctica', tareas: ['USO-1', 'USO-2', 'STO-1', 'STO-2', 'STO-3'] },
      { titulo: 'Al recoger', tareas: ['RES-1', 'RES-2'] },
      { titulo: 'Cuando toca mantenimiento', tareas: ['MAN-1', 'MAN-2'] },
      { titulo: 'Si algo falla', tareas: ['INC-1', 'EMP-2', 'USO-3'] },
      { titulo: 'Cuando el profesorado os lo pida', tareas: ['INV-1', 'INV-2', 'INV-3'] },
    ],
  },
  // EMP-6, EMP-2, USO-1, USO-2, STO-1, STO-3 y RES-1 son comunes a todos los roles (misma versión
  // en todos los manuales; STO-1 y STO-3 llevan además, solo en Gestor y Administrador, la
  // excepción del material común en la zona común). STO-2, RES-2, MAN-1/2, INC-1, USO-3 e
  // INV-1/2/3 de momento solo tienen la del alumnado.
  Profesor: { titulo: 'Manual del profesorado', intro: '', secciones: [{ titulo: 'Al llegar', tareas: ['EMP-6'] }, { titulo: 'Durante la práctica', tareas: ['USO-1', 'USO-2', 'STO-1', 'STO-3'] }, { titulo: 'Al recoger', tareas: ['RES-1'] }, { titulo: 'Si algo falla', tareas: ['EMP-2'] }] },
  Gestor: { titulo: 'Manual de gestión', intro: '', secciones: [{ titulo: 'Al llegar', tareas: ['EMP-6'] }, { titulo: 'Durante la práctica', tareas: ['USO-1', 'USO-2', 'STO-1', 'STO-3'] }, { titulo: 'Al recoger', tareas: ['RES-1'] }, { titulo: 'Si algo falla', tareas: ['EMP-2'] }] },
  Administrador: { titulo: 'Manual de administración', intro: '', secciones: [{ titulo: 'Al llegar', tareas: ['EMP-6'] }, { titulo: 'Durante la práctica', tareas: ['USO-1', 'USO-2', 'STO-1', 'STO-3'] }, { titulo: 'Al recoger', tareas: ['RES-1'] }, { titulo: 'Si algo falla', tareas: ['EMP-2'] }] },
};

const AYUDA_ORDEN_MANUALES = ['Alumno', 'Profesor', 'Gestor', 'Administrador'];

const _AYUDA_IMG = 'assets/ayuda/';

const AYUDA_TAREAS = {
  'MAN-2': {
    pantallas: ['equipos', 'mantenimiento'],
    versiones: {
      Alumno: {
        titulo: 'Hacer un mantenimiento y registrarlo paso a paso',
        quien: [
          'Tu grupo, con la cuenta del grupo. El registro sale a nombre del grupo: no hay que escribir nombres.',
          'El grupo puede hacer los mantenimientos internos que no lleven 🔒 «solo profesorado». Los que hace una empresa y los reservados al profesorado los registra un docente.',
          'Lo que finaliza el grupo no cuenta hasta que lo firma un docente: mientras, queda «⏳ Espera visto bueno».',
        ],
        cuando: [
          'Cuando el profesorado os encarga el mantenimiento de un equipo. Lo habitual: al inicio de una evaluación en que se usa el equipo (revisión anual de arranque; lectura de temperatura de estufas, incubadoras y baños) o al final de la última (revisión anual de cierre).',
          'En la app solo aparecen los mantenimientos que ya tocan; los de más adelante todavía no se ven.',
        ],
        antes: [
          '**El equipo delante** y el código de su etiqueta (por ejemplo, BAL-003).',
          '**Los pasos leídos enteros antes de tocar nada** («▸ Cómo»). Así se sabe qué material hace falta y cuánto tiempo lleva, y no se queda el equipo a medio revisar.',
          '**El protocolo del equipo abierto.** Muchos pasos citan un apartado entre paréntesis, por ejemplo «(6.2)»: está en el protocolo, en la tarjeta del equipo («📖 Protocolo de uso»). → [[EQU-2|Consultar cómo se usa un equipo]]',
          '**El material que piden los pasos**, reunido antes de empezar. Por ejemplo, el termómetro de referencia (TER-01 a TER-04) y el tacómetro (TAC-01), que están en la zona común (205-ZC), el almacén.',
          'Si no va a dar tiempo a terminar en la sesión, se puede guardar a medias y seguir otro día.',
        ],
        pasos: [
          {
            texto: '**Buscar el equipo y abrir su tarjeta.** Ir a «Equipos › Inventario» (en el móvil, abrir antes el menú con «☰»). Escribir el código de la etiqueta en «🔍 Buscar equipo...» y pulsar el equipo para desplegar su tarjeta. Es la entrada recomendada: en el laboratorio se está delante del equipo.',
            nota: 'Otra entrada: «Equipos › Mantenimiento», pestaña «Pendientes», botón «Registrar» de su fila ([[MAN-1|Ver qué mantenimientos tocan]]). En el móvil, esa tabla hay que desplazarla hacia la izquierda para llegar a «Registrar».',
            img: 'MAN-2/01-buscar-equipo.png',
            alt: 'Inventario de equipos con el código escrito en el buscador y la tarjeta del equipo señalada',
          },
          {
            texto: '**Abrir el mantenimiento que toca.** En la tarjeta, bajar hasta «Plan de mantenimiento». En la línea del mantenimiento, «▸ Cómo» enseña los pasos. Pulsar «Registrar», o «Continuar n/m» si estaba empezado.',
            img: 'MAN-2/02-plan-del-equipo.png',
            alt: 'Tarjeta del equipo con el plan de mantenimiento y el botón Registrar señalado',
          },
          {
            texto: '**Comprobar que es el equipo y el mantenimiento correctos**: arriba de la ventana «Ejecutar mantenimiento» están el código del equipo («Equipo»), la «Operación» y el periodo («Tipo»). Con equipos iguales (micropipetas, microscopios) es el error más fácil. Si no coincide, «Cancelar».',
            img: 'MAN-2/03-comprobar-equipo.png',
            alt: 'Ventana Ejecutar mantenimiento con los datos del equipo, la operación y el periodo señalados',
          },
          {
            texto: '**Si arriba sale un aviso de avería abierto, leerlo antes de seguir**:',
            lista: [
              '«No funciona / No se puede usar»: «Cancelar» y avisar al profesorado. El mantenimiento no se hace hasta que lo revise, aunque parezca que es justo lo que arreglaría el fallo: eso lo decide el profesorado.',
              '«Funciona, pero con limitaciones» o «Sí, funciona (pero hay algo que revisar)»: seguir con el mantenimiento. Si algo no cumple por lo mismo que dice el aviso, el mantenimiento sirve para confirmarlo.',
            ],
            img: 'MAN-2/03b-aviso-abierto.png',
            alt: 'Ventana Ejecutar mantenimiento con el recuadro rojo de un aviso abierto No funciona señalado',
          },
          {
            texto: '**Hacer cada paso en el equipo y marcarlo al terminarlo**, no antes ni todos al final: el registro tiene que decir lo que se hizo, y marcar de memoria al final acaba marcando pasos que no se hicieron. Los pasos que solo hay que hacer (limpiar, etiquetar, guardar) llevan casilla. Arriba a la derecha, el contador dice cuántos pasos van.',
          },
          {
            texto: '**En las comprobaciones** (revisar, comprobar, verificar, y los pasos que llevan «Criterio:» debajo), contestar lo que se ha encontrado: «✓ Correcto» o «⚠ Hay que actuar»; si llevan criterio, medir, comparar con el criterio y pulsar «✓ Cumple» o «✗ No cumple». Los pasos escritos como «Cambio de … si procede» o «Engrasar si procede» no mandan cambiar nada: piden mirar si hace falta («✓ No hacía falta» o «⚠ Hacía falta»). «No aplica», si ese paso no tiene sentido en este equipo (y explicarlo en Observaciones). Si el criterio lleva números, el paso trae 🧮 y pide lo que marca el equipo y lo que mide el instrumento de referencia: **anotar las dos lecturas completas, tal como salen (todos los decimales, sin redondear)**. En «Pantalla del equipo» va lo que marca la pantalla en ese momento (lo programado, solo si no tiene pantalla), y las dos lecturas se toman a la vez, con el equipo estable (el tiempo que diga el protocolo). La app hace la cuenta y decide sola si cumple; si no cumple, marca ella «✗ No cumple» y escribe las cifras en «¿Qué has visto?». Lo que no se mide con números aparece como «Comprueba tú: …»: mirarlo y pulsar «✓ Cumple» o «✗ No cumple». Si se pulsa el botón equivocado, pulsarlo otra vez lo desmarca.',
            img: 'MAN-2/04-comprobacion-con-calculadora.png',
            alt: 'Comprobación con calculadora: lectura del equipo y del termómetro de referencia, la app dice que cumple y se pulsa Cumple',
          },
          {
            texto: '**Si algo no está bien** («⚠» o «✗»), escribir «¿Qué has visto? *» y elegir en «¿Qué has hecho? *»: «🔧 Lo he corregido en el momento» (engrasar, limpiar, apretar: escribir qué), «🔩 He cambiado una pieza o ajustado el equipo» (elegir el tipo y escribir qué pieza; cuando el profesorado firme, queda también en el historial del equipo) o «🚨 Necesita reparación» (al finalizar se abre el aviso de avería). Ver también el bloque «Si una comprobación no cumple», más abajo.',
            img: 'MAN-2/05-no-cumple.png',
            alt: 'Comprobación marcada como No cumple, con lo que se ha visto escrito y «Necesita reparación» elegido en «¿Qué has hecho?»',
          },
          {
            texto: '**En las sustituciones programadas** (por ejemplo, «Sustitución de la tapa del rotor»): marcar la casilla al cambiar la pieza y escribir la pieza puesta (referencia o lote, si lo tiene). Cuando el profesorado firme, queda también en el historial del equipo.',
          },
          {
            texto: '**Marcar el resultado del mantenimiento**: «✓ Apto», «🔩 Apto tras intervención» (se ha cambiado una pieza o ajustado el equipo) o «✗ No apto» (necesita reparación). La app resalta con un borde discontinuo el que sale de los pasos, pero lo marca el grupo; si se marca otro, explicar por qué en Observaciones.',
            img: 'MAN-2/05b-resultado.png',
            alt: 'Bloque Resultado del mantenimiento con las opciones Apto, Apto tras intervención y No apto, esta última marcada',
          },
          {
            texto: '**Si hay que parar**: «💾 Guardar progreso». Otro día, en la tarjeta del equipo saldrá «Continuar n/m» con lo que ya estaba marcado. Lo puede continuar cualquier grupo: el progreso es del equipo, no del grupo.',
          },
          {
            texto: '**Escribir en «Observaciones»** el código del instrumento de referencia que se ha usado (por ejemplo, TER-02 o TAC-01), para saber qué comprobaciones revisar si un día ese instrumento resulta estar mal; y lo que no esté en los pasos, como un paso que no se pudo hacer y por qué, algo raro en el equipo o los valores medidos si el protocolo pide anotarlos. «Fecha de realización» ya trae la de hoy y «Realizado por» ya trae el nombre del grupo.',
            img: 'MAN-2/06-observaciones-y-finalizar.png',
            alt: 'Parte de abajo de la ventana: fecha, realizado por, observaciones, aviso de visto bueno y botón Finalizar señalado',
          },
          {
            texto: '**Pulsar «Finalizar».** Sin el resultado marcado no deja finalizar. Si queda un paso sin marcar, la app pide confirmación («Quedan … paso(s) sin marcar»): confirmar solo si ese paso no aplica a este equipo y está explicado en Observaciones. Al terminar sale «Registrado. Queda a la espera del visto bueno del profesorado.»',
          },
          {
            texto: '**Si en algún paso se eligió «🚨 Necesita reparación», se abre «Notificar aviso»** con la descripción ya rellenada. Elegir en «¿Se puede seguir usando el equipo?» si se puede seguir usando y pulsar «Enviar aviso». El aviso aparece en GestionLab al profesorado responsable del equipo y a quien abra el equipo; no se manda ningún correo.',
            nota: 'Si el equipo ya tenía un aviso abierto, se abre en cambio «Añadir al aviso abierto»: lo visto se añade a ese aviso («Añadir al aviso») y no se abre otro. Ahí se puede marcar que el equipo está peor que lo que decía el aviso, pero no mejor.',
            img: 'MAN-2/07-aviso-de-averia.png',
            alt: 'Ventana Notificar aviso con la descripción ya escrita y las opciones de si se puede seguir usando el equipo',
          },
        ],
        extras: [
          {
            titulo: 'Si una comprobación no cumple',
            numerada: true,
            items: [
              '**Antes de marcar «✗ No cumple», revisar cómo se ha hecho la comprobación**: lo que pida el protocolo (equipo nivelado o a temperatura, material de referencia correcto y limpio, lectura en las mismas unidades que el criterio). Si hay un error de procedimiento, corregirlo y repetir una vez. Si no lo hay, **no repetir hasta que salga bien ni cambiar las cifras para que la app diga «Cumple»**: un resultado que no cumple es un dato, y repetir o retocar hasta que cumpla lo esconde.',
              '**Completar «¿Qué has visto?»**. Si la app ha decidido con las cifras, ya las ha escrito ahí: añadir las condiciones (dónde estaba la sonda o la pesa, cuánto tiempo se dejó estabilizar, qué instrumento de referencia se usó). Si no, marcar «✗ No cumple» y escribir el valor medido, el criterio y las condiciones, con números, no «no va bien». Quien firma y quien repare el equipo trabajan con esos datos.',
              '**Seguir con los demás pasos, salvo que el fallo sea peligroso** (calor, presión, electricidad, piezas que giran) **o el protocolo diga parar**. En ese caso, dejar el equipo como indique el apartado 10 de su protocolo y llamar al profesorado antes de seguir.',
              '**Hacer lo que diga el apartado 10, «Resolución de problemas», del protocolo para ese fallo.** En muchos equipos incluye poner la etiqueta «NO USAR».',
              '**En el aviso de avería, elegir con criterio si se puede seguir usando**: si los resultados del equipo dejan de ser fiables (una balanza que pesa mal, una estufa fuera de temperatura), elegir «No funciona». Un equipo que mide mal no sirve aunque encienda. Si el equipo ya tenía un aviso abierto, lo visto se añade a ese aviso: no se abre otro por lo mismo.',
              '**Decírselo además en persona al profesorado.**',
            ],
          },
        ],
        comprobacion: [
          'El mantenimiento ya no aparece en «Pendientes», y en la tarjeta del equipo la línea pone «⏳ Espera visto bueno».',
          'Cuando un docente lo firma, pasa a «✓» con la fecha. Desde entonces cuenta como hecho y entra en el documento de Calidad.',
          'Si un docente lo devuelve, vuelve a salir «Continuar»; al abrirlo se ve «↩ Devuelto por …» con lo que hay que corregir. Corregirlo y finalizar otra vez.',
        ],
        comprobacionImg: { img: 'MAN-2/08-espera-visto-bueno.png', alt: 'Tarjeta del equipo con el mantenimiento en «Espera visto bueno»' },
        problemas: [
          ['No sale «Registrar», solo «Pendiente»', 'ese mantenimiento lo hace el profesorado (🔒 solo profesorado) o una empresa.'],
          ['El mantenimiento no está en la lista, o la tarjeta del equipo no enseña su plan de mantenimiento', 'puede que todavía no toque (solo salen los que ya han vencido), que otro grupo ya lo haya finalizado (está esperando el visto bueno), que el profesorado lo haya marcado como «no aplica» o lo haya aplazado, o que el equipo no esté en uno de vuestros laboratorios ni en la zona común, el almacén (sus mantenimientos los hace otro grupo o el profesorado).'],
          ['Estaba empezado', '«Continuar n/m» y seguir desde donde se dejó.'],
          ['Se ha marcado un paso por error', 'desmarcarlo antes de finalizar. Si ya está finalizado, decírselo al profesorado, que puede devolverlo para corregirlo.'],
          ['Un paso no se puede hacer (falta material, el equipo no tiene esa pieza)', 'si el equipo no tiene esa pieza, «No aplica» (en las comprobaciones) y explicarlo en Observaciones. Si falta material, no marcarlo, guardar el progreso, avisar al profesorado y terminar otro día.'],
          ['Al guardar sale «Tu sesión ha caducado»', 'volver a entrar con la misma cuenta del grupo. La ventana reaparece con lo marcado: pulsar otra vez el botón (→ [[EMP-2|La app te pide volver a entrar (sesión caducada)]]).'],
          ['En el móvil, «Registrar» queda fuera de la pantalla en «Pendientes»', 'desplazar la tabla hacia la izquierda, o entrar por la tarjeta del equipo.'],
        ],
        relacionado: [
          ['Antes', [['EQU-1', 'Encontrar un equipo'], ['MAN-1', 'Ver qué mantenimientos tocan'], ['EQU-2', 'Consultar cómo se usa un equipo']]],
          ['Después', [['INC-1', 'Avisar de una avería']]],
          ['Si falla la app', [['EMP-2', 'La app te pide volver a entrar (sesión caducada)']]],
        ],
      },
    },
  },

  // ── EMP-1 · versión alumnado (guion «EMP-1_entrar-y-que-puede-hacer.md», 23/11/2026) ──
  // Listas de «Qué puede hacer tu grupo» y del visto bueno contrastadas con lo que acepta el
  // servidor para una cuenta de grupo el 23/11/2026 (cambios respecto al guion: mantenimiento
  // y recuento acotados a sus laboratorios y la zona común; ubicaciones con doble
  // verificación; residuos sin «registrar igualmente»).
  'EMP-1': {
    pantallas: ['dashboard', 'perfil'],
    versiones: {
      Alumno: {
        titulo: 'Entrar en GestionLab y saber qué puede hacer tu grupo',
        quien: [
          'Tu grupo, con la cuenta del grupo (por ejemplo, «1º CS LCB»). La cuenta es de toda la clase: no hay cuentas personales del alumnado.',
          'La misma cuenta puede estar abierta a la vez en varios móviles y ordenadores.',
        ],
        cuando: [
          'La primera vez que vais a usar GestionLab en el curso, cuando el profesorado os da la cuenta y la contraseña del grupo.',
          'Después, en cada dispositivo la sesión se queda abierta y no hay que volver a escribir la contraseña. En los ordenadores del laboratorio que se comparten, se entra al empezar la práctica y se sale al terminarla (paso 5).',
        ],
        antes: [
          'El email de la cuenta del grupo y su contraseña, que os da el profesorado en clase. No es la contraseña de la Xunta: GestionLab tiene las suyas.',
        ],
        pasos: [
          {
            texto: '**Abrir GestionLab.** En el móvil, mejor instalada como app (→ [[EMP-6|Usar GestionLab en el móvil]]). En un ordenador, en el navegador: labsuite.github.io/gestionlab-sanidad.',
          },
          {
            texto: '**Escribir el email y la contraseña del grupo** en «Email» y «Contraseña» y pulsar «Iniciar sesión». Se abre el «Panel principal».',
            img: 'EMP-1/01-pantalla-de-entrada.png',
            alt: 'Pantalla de entrada con el email y la contraseña escritos y el botón Iniciar sesión señalado',
          },
          {
            texto: '**Qué se ve al entrar.** El «Panel principal» del grupo enseña lo que le atañe: sus mantenimientos pendientes y los equipos de sus laboratorios y de la zona común (el almacén, 205-ZC) que no se pueden usar o tienen un aviso de avería abierto. Arriba, dos cifras: «Preventivos pendientes» (los mantenimientos que tu grupo puede hacer ahora) y «Equipos con aviso o sin poder usarse». Debajo, el botón «Registrar consumo de material» («¿Has abierto un envase? Apúntalo ahora»), la lista de esos equipos (al pulsar uno se abre su tarjeta en el Inventario) y la de mantenimientos pendientes.',
            img: 'EMP-1/02-panel-principal.png',
            alt: 'Panel principal de una cuenta de grupo con sus dos cifras señaladas, la lista de equipos con aviso o sin poder usarse y la de mantenimientos pendientes',
          },
          {
            texto: '**Las secciones del grupo están en el menú** (en el móvil, se abre con «☰», arriba a la izquierda): «Panel principal»; «Equipos» (Inventario y Mantenimiento); «Material fungible» (Inventario); «Uso del laboratorio» (Reservas, Registros de uso y Muestras congeladas); «Residuos» (Guía de residuos y Contenedores); «Catálogo» (Ubicaciones); y «Mi cuenta» («Mi perfil» y «Ayuda»).',
            img: 'EMP-1/03-menu.png',
            alt: 'Menú lateral abierto en el móvil con las secciones de una cuenta de grupo',
          },
          {
            texto: '**Comprobar con qué cuenta se ha entrado** antes de registrar nada: al pie del menú salen el nombre del grupo y «Alumno» (también en «Mi cuenta › Mi perfil»). En un ordenador compartido puede seguir abierta la sesión del grupo anterior, y todo lo que se registre saldría a su nombre.',
            nota: 'En el móvil, el pie del menú queda debajo de «Ayuda»: hay que bajar hasta el final del menú.',
            imgs: [
              { img: 'EMP-1/04-pie-del-menu.png', alt: 'Pie del menú con el nombre del grupo, el rol Alumno y el botón de cerrar sesión', pie: 'Pie del menú: nombre del grupo, «Alumno» y «↩» para cerrar la sesión.' },
              { img: 'EMP-1/05-mi-perfil.png', alt: 'Mi perfil con el nombre del grupo, su email y el rol Alumno', pie: '«Mi perfil»: los datos de la cuenta con la que se ha entrado.' },
            ],
          },
          {
            texto: '**Al terminar la práctica en un ordenador compartido del laboratorio, cerrar la sesión**, para que el siguiente grupo no registre a vuestro nombre: botón «↩» al pie del menú, junto al nombre del grupo, y aceptar «¿Cerrar sesión en este dispositivo?». Solo se cierra en ese dispositivo: el resto de la clase sigue dentro. En el móvil propio, en cambio, dejarla abierta: las etiquetas NFC/QR solo registran con la sesión iniciada (→ [[EMP-6|Usar GestionLab en el móvil]]).',
            nota: 'En una tableta en horizontal el menú se queda estrecho, solo con iconos, y el «↩» no se ve: girar la tableta en vertical y abrir el menú con «☰».',
          },
        ],
        extras: [
          {
            titulo: 'Qué puede hacer tu grupo',
            intro: 'Cada punto enlaza a su tarea del manual.',
            items: [
              '**Equipos**: [[EQU-1|encontrarlos]], [[EQU-2|consultar su protocolo y su manual]], [[EQU-3|saber si se pueden usar]], [[EQU-4|reservarlos y empezar y terminar el uso de la reserva]].',
              '**Registros de uso**: [[USO-1|apuntar el trabajo en la cabina de bioseguridad y en la vitrina de gases]], y [[USO-2|cada ciclo de autoclave]].',
              '**Muestras congeladas**: [[MUE-1|encontrarlas]] y [[MUE-2|usarlas]] (sacar una bolita, gastar un tubo o tomar volumen). Un uso apuntado por error se puede deshacer durante 15 minutos; pasado ese tiempo, lo corrige el profesorado.',
              '**Material**: [[STO-1|encontrarlo]], [[STO-3|llevarlo del almacén (la zona común, 205-ZC) al laboratorio donde trabajáis]], y [[STO-2|apuntar el gasto en el momento de abrir un envase nuevo]] en vuestros laboratorios.',
              '**Residuos**: [[RES-1|consultar la Guía de residuos]] y [[RES-2|apuntar lo que se echa en cada contenedor]].',
              '**Mantenimiento**: [[MAN-2|hacer los mantenimientos internos]] que no están reservados al profesorado, de los equipos de vuestros laboratorios y de la zona común (el almacén).',
              '**Averías**: [[INC-1|avisar de que un equipo falla]].',
              '**Inventario**, cuando lo pide el profesorado: [[INV-1|ubicar equipos]], [[INV-2|contar el stock de un sitio]] de vuestros laboratorios o del almacén de la zona común (si el grupo tiene permiso) e [[INV-3|inventariar material que no está en la app]].',
            ],
          },
          {
            titulo: 'Qué necesita el visto bueno del profesorado',
            items: [
              'Los mantenimientos que finaliza el grupo.',
              'En el inventario: las ubicaciones de equipos que propone el grupo (salvo que otro grupo haya propuesto exactamente la misma: entonces se aplica sin esperar), los recuentos de stock y el material nuevo inventariado.',
              'Las reservas, solo si coinciden con otra: entonces las decide Gestión.',
            ],
            nota: 'Hasta que llega el visto bueno, lo registrado no cuenta como hecho, pero tampoco hay que repetirlo.',
          },
          {
            titulo: 'Lo que no hace el grupo (y a quién pedirlo)',
            items: [
              'Guardar muestras nuevas en el congelador, descartar tubos o cajas, cerrar un contenedor lleno, pedir material o compras: al profesorado.',
              'Apuntar en un contenedor un residuo que la app no admite. Si la app dice que no va ahí, no se tira: preguntar al profesorado.',
              'Si se ha olvidado o ha cambiado la contraseña del grupo: la da el profesorado. No hay botón «He olvidado la contraseña».',
            ],
          },
          {
            titulo: 'Normas de la cuenta del grupo',
            items: [
              '**La contraseña es solo para la clase.** No se le da a nadie de fuera del grupo. Si creéis que la sabe alguien que no debe, decídselo al profesorado, que la cambia.',
              '**Lo que registráis sale a nombre del grupo, no de una persona, y está hecho así a propósito.** No escribáis nombres de personas en observaciones, notas ni descripciones.',
              '**Registrad solo lo que se ha hecho de verdad.** El registro es la prueba de que se hizo, y lo que firma el profesorado se apoya en él.',
            ],
          },
        ],
        comprobacion: [
          'Se ve el Panel principal, y al pie del menú salen el nombre de vuestro grupo y «Alumno».',
        ],
        problemas: [
          ['«Email o contraseña incorrectos»', 'revisar mayúsculas y espacios. Si sigue, pedir la contraseña al profesorado (puede haber cambiado al empezar el curso).'],
          ['«🔒 Acceso no autorizado»', 'la cuenta no está dada de alta en GestionLab. Avisar al profesorado.'],
          ['Al pie del menú sale otro grupo', 'cerrar la sesión y entrar con la vuestra.'],
          ['La app vuelve sola a la pantalla de entrada, o sale «Tu sesión ha caducado»', 'volver a entrar con la misma cuenta (→ [[EMP-2|La app te pide volver a entrar (sesión caducada)]]).'],
          ['No aparece una sección que esperabais', 'el grupo no la tiene; mirar «Qué puede hacer tu grupo» y «Lo que no hace el grupo».'],
        ],
        relacionado: [
          ['Después', [['EMP-6', 'Usar GestionLab en el móvil'], ['EQU-1', 'Encontrar un equipo']]],
          ['Si falla la app', [['EMP-2', 'La app te pide volver a entrar (sesión caducada)']]],
        ],
      },
    },
  },

  // ── EMP-6 · común a todos los roles (guion «EMP-6_movil-y-etiquetas.md», 23/11/2026) ──
  'EMP-6': {
    pantallas: ['registros-uso', 'congelados', 'material', 'residuos-contenedores', 'perfil'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena justo debajo
  },

  // ── EMP-2 · común a todos los roles (guion «EMP-2_sesion-caducada.md», 23/11/2026) ──
  'EMP-2': {
    pantallas: ['dashboard', 'perfil'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena justo debajo
  },

  // ── STO-1 · común (guion «STO-1_encontrar-material.md», 23/11/2026) ──
  'STO-1': {
    pantallas: ['material'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena más abajo
  },

  // ── STO-2 · versión alumnado (guion «STO-2_apuntar-gasto.md», normas de Paloma del 23/11/2026) ──
  'STO-2': {
    pantallas: ['dashboard', 'material'],
    versiones: {
      Alumno: {
        titulo: 'Apuntar el gasto al abrir un envase nuevo',
        quien: [
          'Tu grupo, con la cuenta del grupo. El gasto queda a nombre del grupo.',
          'Solo de los botes de vuestros laboratorios. **La zona común (205-ZC) es un almacén**: lo que hay allí no se gasta allí, se lleva al laboratorio donde se trabaja (→ [[STO-3|Llevar material de un sitio a otro]]), y desde la zona común no se apunta gasto.',
        ],
        cuando: [
          '**En el momento de abrir un envase que estaba sin abrir** (un bote, una bolsa, una caja). No al final de la práctica: si se deja para luego, se olvida.',
        ],
        extrasAntes: [
          {
            titulo: 'Qué se apunta',
            items: [
              '**El envase que se abre, entero.** No se apuntan fracciones (mililitros, gramos, puntas sueltas): lo que se va usando de un envase abierto no se apunta. El siguiente gasto se apunta cuando se abra el siguiente envase.',
              '**Si el material se cuenta por unidades** (por ejemplo, tubos o placas que vienen en caja), al abrir la caja se apuntan todas las unidades que traía: la app las pide como «Unidades del envase abierto».',
              '**El material reutilizable no se gasta** (vidrio, gradillas, objetos: los que llevan «♻️ Reutilizable»). No se apunta gasto. Si se rompe o se pierde, avisar al profesorado.',
            ],
          },
        ],
        antes: [
          'El envase nuevo en el laboratorio. Si estaba en el almacén, primero se traslada al laboratorio (→ [[STO-3|Llevar material de un sitio a otro]]).',
        ],
        pasos: [
          {
            texto: '**Al abrir el envase, abrir el registro de consumo.** En el «Panel principal», botón «📦 Registrar consumo de material» («¿Has abierto un envase? Apúntalo ahora»). O en «Material fungible › Inventario»: desplegar el material y pulsar «📦» en la línea del bote que se ha abierto; así el material y el bote ya van elegidos.',
          },
          {
            texto: '**Elegir el material y el bote del que se ha cogido**, es decir, el sitio del laboratorio donde estaba: escribir el nombre en «Material» y elegirlo de la lista. Si el material está en más de un sitio de vuestros laboratorios, sale «¿De dónde has cogido el envase?»: elegir ese sitio. El stock se lleva por sitio: si se elige otro bote, un sitio queda con más de lo que hay y otro con menos. Si solo está en un sitio, la app lo elige sola.',
            img: 'STO-2/01-registro-de-consumo.png',
            alt: 'Registrar consumo con el material elegido, el sitio de donde se ha cogido el envase y 1 envase abierto señalados',
          },
          {
            texto: '**La cantidad**: en «Envases abiertos», los envases que se han abierto (viene con 1 puesto). Si el material se cuenta por unidades, el campo se llama «Unidades del envase abierto»: todas las que traía.',
          },
          {
            texto: '**En «Motivo», la práctica.** Sin nombres de personas.',
          },
          {
            texto: '**Pulsar «Registrar consumo».** Sale «Gasto apuntado» con el stock que queda del material.',
          },
        ],
        comprobacion: [
          'El stock de ese bote ha bajado en los envases abiertos, y en el historial del material aparece el gasto a nombre del grupo (en «Material fungible › Inventario», desplegar el material y pulsar «ver historial»: la línea «📦 Salida» con la cantidad, el motivo y el nombre del grupo).',
        ],
        comprobacionImg: { img: 'STO-2/02-historial.png', alt: 'Historial del material con el gasto del grupo señalado: Salida, 1, Práctica de PCR y el nombre del grupo' },
        problemas: [
          ['«Este material solo está en el almacén (zona común)»', 'el envase está en el almacén: trasladarlo antes a vuestro laboratorio (→ [[STO-3|Llevar material de un sitio a otro]]) y apuntarlo allí al abrirlo.'],
          ['«Este material no está disponible en tus ubicaciones asignadas»', 'ese envase es de otro laboratorio. Avisar al profesorado.'],
          ['Se ha apuntado mal (cantidad, material o bote)', 'avisar al profesorado para que lo corrija.'],
          ['El stock de la app no llega (el bote nunca baja de cero)', 'apuntarlo igualmente y avisar al profesorado. El stock no cuadraba.'],
          ['Era el último envase', 'avisar al profesorado, que es quien lo pide.'],
        ],
        relacionado: [
          ['Antes', [['STO-3', 'Llevar material de un sitio a otro'], ['STO-1', 'Encontrar un material']]],
          ['Cuando lo pide el profesorado', [['INV-2', 'Contar el stock de un sitio']]],
        ],
      },
    },
  },

  // ── STO-3 · común (guion «STO-3_llevar-material.md», 23/11/2026) ──
  'STO-3': {
    pantallas: ['material'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena más abajo
  },

  // ── RES-1 · común (guion «RES-1_a-que-contenedor.md», 25/11/2026) ──
  // Los vídeos de residuos (VIDEOS_RESIDUOS en js/residuos.js) se enlazan desde el paso 1.
  'RES-1': {
    pantallas: ['residuos-guia'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena más abajo
  },

  // ── RES-2 · versión alumnado (guion «RES-2_echar-residuo.md», 25/11/2026) ──
  // Sin «La IA se equivoca — registrar igualmente» ni «Registrar sin comprobar» para el
  // grupo (decisiones de Paloma del 23 y el 25/11/2026; lo impone también gestionar-residuo).
  'RES-2': {
    pantallas: ['residuos-contenedores'],
    versiones: {
      Alumno: {
        titulo: 'Echar un residuo en un contenedor y apuntarlo',
        quien: ['Tu grupo, con la cuenta del grupo. Lo apuntado queda a nombre del grupo.'],
        cuando: [
          'Cada vez que se echa algo en un contenedor de residuos del laboratorio (bidones, garrafas, contenedores de punzantes, de biológicos, bolsas…).',
          'Lo que según la guía va a la basura normal o al fregadero no tiene contenedor y no se apunta.',
        ],
        antes: [
          '**Saber a qué contenedor va**, por la guía (→ [[RES-1|Saber a qué contenedor va un residuo]]).',
          'El residuo preparado como diga la guía para ese contenedor (cerrado, en bolsa, etc.).',
          'Los guantes y gafas que pida el residuo.',
        ],
        pasos: [
          {
            texto: '**Ir al contenedor y comprobar que es el que dice la guía**: su categoría en la etiqueta del contenedor y en la app. En «Residuos › Contenedores» (en el móvil, menú «☰»), cada tarjeta dice la categoría, el laboratorio, el sitio y el formato.',
          },
          {
            texto: '**Mirar su nivel**, en el contenedor y en su tarjeta («Vacío», «25%», «50%», «75%», «Lleno»). Si está lleno, o se llenaría por encima de su marca, no se echa: ni apretar ni empujar. Avisar al profesorado, que es quien lo cierra y pone otro.',
            img: 'RES-2/01-contenedor.png',
            alt: 'Tarjeta de un contenedor de residuos con su categoría, laboratorio, sitio y nivel',
          },
          {
            texto: '**Apuntarlo antes de echarlo**: leer la etiqueta NFC/QR del contenedor (→ [[EMP-6|Usar GestionLab en el móvil: etiquetas]]) o pulsar «+ Añadir residuo» en su tarjeta. Se abre «Añadir residuo»:',
            lista: [
              '«Residuo que vas a echar»: escribirlo y elegirlo de la lista. Si no está en la lista, describirlo en «…o descríbelo (si no está en la lista)» con todos sus datos (qué lleva, de qué práctica sale).',
              '«Nivel en que quedará el contenedor al echarlo»: mirándolo de verdad.',
              '«Observaciones»: la práctica y la cantidad. Sin nombres de personas.',
            ],
            nota: 'Por qué **antes** de echarlo: la comprobación de la app sirve para no echar algo que no va ahí. Si se echa primero, ya no tiene arreglo.',
            img: 'RES-2/02-anadir-residuo.png',
            alt: 'Ventana Añadir residuo con un residuo de la lista elegido, el nivel en que quedará y las observaciones',
          },
          {
            texto: '**Pulsar «Registrar».** La app comprueba si se puede echar ahí: si es de otro contenedor, si reacciona con lo que ya hay dentro, y lo revisa con IA. Si lo admite, sale «Registrado: ya puedes echarlo en el contenedor».',
          },
          {
            texto: '**Si la app lo admite, echarlo. Si lo bloquea o la IA no lo recomienda, no se echa**: pulsar «Entendido, no lo tiro» si sale, dejar el residuo cerrado y rotulado, y preguntar al profesorado. La app dice a qué contenedor debería ir: comprobarlo en la guía.',
            imgs: [
              { img: 'RES-2/03-bloqueo.png', alt: 'Mensaje rojo No se puede añadir: el contenedor tiene algo ácido y la lejía con un ácido desprende cloro', pie: 'Bloqueo: «No se puede añadir…». No se salta nunca.' },
              { img: 'RES-2/04-ia-no-lo-recomienda.png', alt: 'Recuadro La IA no recomienda tirarlo en este contenedor, con el contenedor adecuado y el botón Entendido, no lo tiro', pie: '«⛔ La IA no recomienda tirarlo en este contenedor»: «Entendido, no lo tiro».' },
            ],
          },
          {
            texto: '**Cerrar el contenedor** como diga su aviso de seguridad (el recuadro amarillo de su tarjeta: tapa, cierre de la bolsa, tapón de la garrafa).',
          },
        ],
        comprobacion: [
          'El residuo está en el contenedor, el contenedor cerrado, y en su tarjeta aparece la adición a nombre del grupo («Historial de adiciones») con el nivel actualizado.',
        ],
        comprobacionImg: { img: 'RES-2/05-adicion-registrada.png', alt: 'Tarjeta del contenedor con el nivel actualizado, el historial de adiciones y el mensaje Registrado: ya puedes echarlo' },
        problemas: [
          ['La app lo bloquea porque va a otro contenedor, o porque reacciona con lo que ya hay dentro («No se puede añadir…»)', 'no echarlo. Estos bloqueos no se saltan nunca. Volver a la guía (→ [[RES-1|Saber a qué contenedor va un residuo]]).'],
          ['«⛔ La IA no recomienda tirarlo en este contenedor»', 'no echarlo. Preguntar al profesorado: si la IA se equivoca, es el profesorado quien lo registra.'],
          ['«No se ha podido comprobar con la IA en este momento» (con un residuo descrito con palabras propias)', 'el grupo no puede registrarlo sin comprobar. No echarlo: volver a intentarlo más tarde o preguntar al profesorado. Si el residuo está en la lista, elegirlo de la lista: así la app lo comprueba con sus reglas aunque la IA no responda.'],
          ['«No se encontró un contenedor activo…» al leer la etiqueta', 'el contenedor se ha cerrado y no se ha puesto el de recambio. No dejar el residuo encima: guardarlo cerrado y rotulado y avisar al profesorado.'],
          ['Se ha echado algo donde no iba', 'no intentar sacarlo. Avisar al profesorado en ese momento, diciendo qué y cuánto.'],
          ['El contenedor está lleno', 'avisar al profesorado. No dejar residuos en el suelo ni al lado.'],
        ],
        relacionado: [
          ['Antes', [['RES-1', 'Saber a qué contenedor va un residuo'], ['EMP-6', 'Usar GestionLab en el móvil: etiquetas de contenedor']]],
        ],
      },
    },
  },

  // ── MAN-1 · versión alumnado (guion «MAN-1_que-mantenimientos-tocan.md», 25/11/2026) ──
  'MAN-1': {
    pantallas: ['dashboard', 'mantenimiento'],
    versiones: {
      Alumno: {
        titulo: 'Ver qué mantenimientos tocan en tu laboratorio',
        quien: [
          'Tu grupo, con la cuenta del grupo. Solo salen los mantenimientos que puede hacer el grupo: los internos que no están reservados al profesorado, de los equipos de vuestros laboratorios y de la zona común.',
        ],
        cuando: [
          '**Al inicio de cada evaluación**: es cuando salen los mantenimientos nuevos (las revisiones anuales de arranque de los equipos que se usan en esa evaluación y las lecturas de temperatura de estufas, incubadoras y baños).',
          '**Al final de la última evaluación en que se usa un equipo**: salen sus revisiones de cierre.',
          'Cuando el profesorado reparte los mantenimientos entre los grupos.',
        ],
        antes: ['Nada: entrar con la cuenta del grupo.'],
        pasos: [
          {
            texto: '**El «Panel principal» dice cuántos mantenimientos pendientes tiene el grupo**: la cifra «Preventivos pendientes» y, más abajo, la tarjeta «Mantenimientos pendientes» con el equipo, la operación y el periodo.',
            img: 'MAN-1/01-panel-principal.png',
            alt: 'Panel principal con la cifra Preventivos pendientes señalada y la tarjeta Mantenimientos pendientes',
          },
          {
            texto: '**La lista de pendientes enseña cuáles son**: «Equipos › Mantenimiento» (en el móvil, menú «☰»), pestaña «Pendientes». Cada fila es un mantenimiento: equipo, tipo, periodicidad, periodo y operación. Se puede filtrar por laboratorio («Todos los labs») y por periodo («Todos los períodos»), o buscar un equipo por su código.',
            img: 'MAN-1/02-lista-de-pendientes.png',
            alt: 'Mantenimientos pendientes con el buscador y los filtros de laboratorio y periodo señalados',
          },
          {
            texto: '**Leer qué lleva cada uno antes de que os lo encarguen**: «▸ Cómo» despliega sus pasos debajo de la fila. Así se sabe qué material y cuánto tiempo hace falta.',
          },
          {
            texto: '**Fijarse en las marcas de cada fila**:',
            lista: [
              '«▶ En curso n/m»: alguien lo empezó y lo dejó a medias (lleva n pasos de m). Se continúa («Continuar n/m»), no se empieza otro igual.',
              '«📅 Aplazado (previsto …)»: el profesorado lo ha movido a otra fecha.',
            ],
            img: 'MAN-1/03-en-curso-y-como.png',
            alt: 'Fila de un mantenimiento con la marca En curso 1/3 señalada y sus pasos desplegados con Cómo',
          },
          {
            texto: '**El grupo hace los que le encarga el profesorado**, no los que elija por su cuenta: el profesorado reparte para que no coincidan dos grupos en el mismo equipo y para que cada uno tenga el material y el tiempo.',
          },
          {
            texto: 'Para hacerlo, «Registrar» (o «Continuar») en su fila: → [[MAN-2|Hacer un mantenimiento y registrarlo paso a paso]].',
          },
        ],
        comprobacion: ['Se sabe qué mantenimientos tiene el grupo, cuáles están empezados y qué necesita cada uno.'],
        problemas: [
          ['Un mantenimiento que esperabais no sale', 'puede que todavía no toque (solo salen los que ya han vencido), que lo haya finalizado otro grupo (espera el visto bueno), que el profesorado lo haya marcado «no aplica» o lo haya aplazado, que sea solo del profesorado o de una empresa, o que el equipo no esté en vuestros laboratorios ni en la zona común.'],
          ['En el móvil, la tabla no cabe', 'desplazarla de lado para llegar a «▸ Cómo» y «Registrar», o entrar por la tarjeta del equipo (→ [[MAN-2|Hacer un mantenimiento y registrarlo]]).'],
        ],
        relacionado: [
          ['Después', [['MAN-2', 'Hacer un mantenimiento y registrarlo']]],
          ['Antes', [['EQU-1', 'Encontrar un equipo']]],
        ],
      },
    },
  },

  // ── INC-1 · versión alumnado (guion «INC-1_avisar-averia.md», 25/11/2026) ──
  // El 🚨 sobre un equipo con un aviso abierto añade a ese aviso (abrirAvisoAlumno, 25/11/2026).
  'INC-1': {
    pantallas: ['equipos', 'dashboard'],
    versiones: {
      Alumno: {
        titulo: 'Avisar de una avería',
        quien: ['Tu grupo, con la cuenta del grupo. El aviso sale a nombre del grupo.'],
        cuando: [
          'Cuando un equipo falla, da un mensaje de error, hace algo raro (ruido, olor, calentamiento, fuga), mide mal o le falta o se ha roto una pieza.',
          'Cuando una comprobación de un mantenimiento no cumple: entonces el aviso se abre solo al finalizar (→ [[MAN-2|Hacer un mantenimiento y registrarlo]]).',
        ],
        antes: [
          '**Primero, la seguridad. Si hay peligro** (humo, olor a quemado, chispas, calor anormal, fuga de líquido o de gas, cristal roto, una pieza que gira descontrolada): parar el equipo, apagarlo y desenchufarlo si se puede hacer sin riesgo, apartarse y **avisar en ese momento, en persona, al profesorado presente**. La app va después.',
          '**Mirar el apartado 10, «Resolución de problemas», del protocolo del equipo** (→ [[EQU-2|Consultar cómo se usa un equipo]]). Si el fallo es de uso (una tapa mal cerrada, un ajuste mal puesto) y el protocolo dice cómo resolverlo sin herramientas, resolverlo. Nunca abrir el equipo, cambiar fusibles ni tocar la parte eléctrica: eso es del profesorado o del servicio técnico.',
          '**Si el protocolo lo indica, poner la etiqueta «NO USAR»** en el equipo.',
        ],
        pasos: [
          {
            texto: '**Buscar el equipo** en «Equipos › Inventario» (→ [[EQU-1|Encontrar un equipo]]) **y pulsar 🚨 («Notificar aviso») en su fila.**',
            img: 'INC-1/01-boton-aviso.png',
            alt: 'Inventario de equipos con el botón de aviso de la fila del equipo señalado',
          },
          {
            texto: '**Si el equipo ya tiene un aviso abierto, la ventana se abre como «Añadir al aviso abierto»** y enseña ese aviso. Si es por lo mismo, lo que se escriba se añade a ese aviso («Añadir al aviso»): no se abre otro. Si es un problema distinto, pulsar «Es otro problema: abrir un aviso nuevo». Al añadir se puede marcar que el equipo está peor de lo que decía el aviso, pero no mejor.',
            img: 'INC-1/03-anadir-al-aviso-abierto.png',
            alt: 'Ventana Añadir al aviso abierto con el aviso que ya tenía el equipo y el botón Es otro problema: abrir un aviso nuevo',
          },
          {
            texto: '**En «¿Se puede seguir usando el equipo?», elegir con criterio**:',
            lista: [
              '«No funciona / No se puede usar»: no enciende, no hace lo que tiene que hacer, es peligroso, **o sus resultados ya no son fiables** (una balanza que pesa mal, una estufa fuera de temperatura). Un equipo que mide mal no sirve aunque encienda.',
              '«Funciona, pero con limitaciones»: se puede usar para algunas cosas y no para otras. Decir para cuáles no.',
              '«Sí, funciona (pero hay algo que revisar)»: se puede usar con normalidad, pero hay algo que mirar.',
            ],
            img: 'INC-1/02-ventana-del-aviso.png',
            alt: 'Ventana Notificar aviso con No funciona elegido y una descripción con el error, desde cuándo y qué se ha hecho',
          },
          {
            texto: '**Describir el problema con datos** en «Descripción del problema»: qué se estaba haciendo, qué ha pasado, el mensaje de error tal como sale en la pantalla, desde cuándo, y qué se ha hecho ya (por ejemplo, «apagado y desenchufado; etiqueta NO USAR puesta»). Sin nombres de personas.',
          },
          {
            texto: '**Pulsar «Enviar aviso»** («Añadir al aviso» si se añade a uno abierto). Sale: «Aviso enviado. Le aparece en GestionLab al profesorado responsable del equipo (o, si no tiene, a la gestión del laboratorio), y quien abra el equipo verá el aviso. No se manda ningún correo: díselo también en persona.»',
          },
          {
            texto: '**Decírselo además en persona al profesorado**, sobre todo si es «No funciona».',
          },
        ],
        comprobacion: [
          'En la tarjeta del equipo aparece el aviso abierto con lo que se ha elegido, y el equipo sale en el «Panel principal» de los grupos que lo usan («Equipos de tus laboratorios con aviso o sin poder usarse»).',
        ],
        comprobacionImg: { img: 'INC-1/04-aviso-enviado.png', alt: 'Tarjeta del equipo con el recuadro Aviso abierto: No funciona y el mensaje Aviso enviado' },
        problemas: [
          ['No se sabe qué elegir en «¿Se puede seguir usando?»', 'elegir la opción más prudente y explicarlo en la descripción.'],
          ['El equipo no aparece (no está en la app o no tiene etiqueta)', 'avisar al profesorado en persona.'],
          ['Se ha enviado con un error', 'decírselo al profesorado.'],
        ],
        relacionado: [
          ['Antes', [['EQU-1', 'Encontrar un equipo'], ['EQU-2', 'Consultar cómo se usa: apartado 10 del protocolo'], ['EQU-3', 'Saber si se puede usar']]],
          ['Desde un mantenimiento', [['MAN-2', 'Hacer un mantenimiento y registrarlo']]],
        ],
      },
    },
  },

  // ── USO-3 · versión alumnado (guion «USO-3_sesiones-abiertas.md», 25/11/2026) ──
  // Gestión (Gestor/Administrador) corrige una sesión cerrada dejando constancia (desde el 25/11/2026).
  'USO-3': {
    pantallas: ['registros-uso', 'dashboard'],
    versiones: {
      Alumno: {
        titulo: 'Cerrar las sesiones de cabina o vitrina que se quedaron abiertas',
        quien: ['Tu grupo, con la cuenta del grupo: solo las sesiones del grupo.'],
        cuando: [
          'Al entrar en la app sale «Tienes N sesiones de uso sin cerrar de días anteriores».',
          'En el menú, «Registros de uso» lleva un número: las sesiones del grupo que siguen abiertas.',
          'Cuando alguien del grupo se ha ido sin terminar su sesión.',
        ],
        antes: ['Saber quién del grupo usó el equipo y qué hizo. Es quien tiene que cerrarla o, al menos, quien tiene que dar los datos.'],
        pasos: [
          {
            texto: '**Ir a «Uso del laboratorio › Registros de uso»** (en el móvil, menú «☰») y elegir la pestaña del equipo: «🧫 Cabina de bioseguridad» o «🌫️ Vitrina de gases».',
            imgs: [
              { img: 'USO-3/01-aviso-sesiones-sin-cerrar.png', alt: 'Panel principal con el aviso Tienes 1 sesión de uso sin cerrar de días anteriores', pie: 'El aviso al entrar.' },
              { img: 'USO-3/02-menu-registros-de-uso.png', alt: 'Menú con el número de sesiones abiertas junto a Registros de uso señalado', pie: 'El número junto a «Registros de uso».' },
            ],
          },
          {
            texto: '**En «Sesiones abiertas» están las del grupo**, con el equipo, el día y la hora de inicio. Pulsar «■ Cerrar sesión» en la que se va a cerrar.',
            img: 'USO-3/03-sesiones-abiertas.png',
            alt: 'Registros de uso de la cabina con una sesión abierta de otro día y su botón Cerrar sesión señalados',
          },
          {
            texto: '**Cerrarla con lo que se hizo de verdad ese día**, como al terminar una sesión normal (→ [[USO-1|Apuntar un uso de la cabina o de la vitrina]]). **«Hora fin» trae la hora de ahora: cambiarla por la hora real en que se terminó.**',
            img: 'USO-3/04-cerrar-con-la-hora-real.png',
            alt: 'Ventana Cerrar sesión con la hora de fin cambiada señalada y la nota cerrada después; hora de fin aproximada en Incidencias',
          },
          {
            texto: '**Lo que no se sepa no se inventa.** Si no se sabe con seguridad la hora de fin o algún dato, poner lo más aproximado y escribir en «Incidencias» «cerrada después; hora de fin aproximada» (o qué dato falta). Después, «Guardar y cerrar sesión».',
          },
          {
            texto: '**Si la sesión se abrió por error y no hubo uso**, no se cierra como si lo hubiera habido: avisar al profesorado, que pide a Gestión que la descarte.',
          },
        ],
        comprobacion: ['La sesión sale cerrada en el «Historial» del equipo, y el número de «Registros de uso» ha bajado.'],
        problemas: [
          ['Nadie del grupo sabe qué se hizo en esa sesión', 'no cerrarla con datos inventados. Avisar al profesorado.'],
          ['La sesión no es del grupo', 'el grupo solo ve las suyas; las de otros las cierra Gestión.'],
          ['Se ha cerrado con un dato mal', 'avisar al profesorado. Gestión lo corrige, y queda constancia del cambio.'],
        ],
        relacionado: [
          ['Antes', [['USO-1', 'Apuntar un uso de la cabina o de la vitrina']]],
        ],
      },
    },
  },
  // ── USO-1 y USO-2 · comunes (guiones «USO-1_cabina-y-vitrina.md» y «USO-2_ciclo-autoclave.md»,
  // 23/11/2026), con los registros que sustituyen a las hojas en papel (en la app desde el 25/11/2026)
  'USO-1': {
    pantallas: ['registros-uso'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena más abajo
  },
  'USO-2': {
    pantallas: ['registros-uso'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena más abajo
  },

  // ── INV-1 · versión alumnado (guion «INV-1_ubicar-equipos.md», 25/11/2026) ──
  'INV-1': {
    pantallas: ['equipos', 'ubicar-equipos'],
    versiones: {
      Alumno: {
        titulo: 'Ubicar los equipos de un laboratorio, o avisar de que falta uno',
        quien: ['Tu grupo, con la cuenta del grupo, en los laboratorios del grupo.'],
        cuando: ['Cuando el profesorado os pide revisar dónde está cada equipo de un laboratorio (inventario).'],
        antes: [
          'El móvil con la sesión del grupo abierta: esta tarea se hace recorriendo el laboratorio.',
          'Tiempo para hacerlo armario a armario, sin prisa. Un equipo mal ubicado se busca después donde no está.',
        ],
        pasos: [
          {
            texto: '**Abrir «📍 Ubicar equipos»**, en «Equipos › Inventario» (en el móvil, menú «☰»). Si el grupo tiene más de un laboratorio, elegirlo arriba, en «🔎 Ubicar equipos».',
          },
          {
            texto: '**Ponerse delante de un sitio** (un armario, una balda, una mesa) y elegirlo en «1 · ¿Dónde estás ahora?». El sitio se elige por su localización («Poyata 1 · Encima»), que es lo que se ve en el laboratorio. Debajo sale «✓ Estás en …».',
            img: 'INV-1/01-elegir-sitio.png',
            alt: 'Ubicar equipos con el sitio elegido en ¿Dónde estás ahora? señalado',
          },
          {
            texto: '**Marcar solo los equipos que se ven en ese sitio, comprobando el código de su etiqueta** (con equipos iguales, como micropipetas o microscopios, es el error más fácil). Lo que se recuerde o se suponga, no se marca. «Buscar por tipo, marca o ID…» ayuda a encontrarlos en la lista.',
          },
          {
            texto: '**Pulsar «📍 Están aquí (n)»**, abajo, y pasar al sitio siguiente.',
            img: 'INV-1/02-marcar-y-estan-aqui.png',
            alt: 'Lista de equipos con uno marcado y el botón Están aquí señalado',
          },
          {
            texto: '**No mover equipos para que cuadren con la app**: se apunta dónde están, no dónde deberían estar.',
          },
          {
            texto: '**Si un equipo de la lista no aparece en el laboratorio**: pulsar ❓ («No lo encuentro») en su fila y escribir en la nota dónde se ha buscado. No adivinar dónde está.',
            img: 'INV-1/03-no-lo-encuentro.png',
            alt: 'Fila de un equipo con el botón No lo encuentro señalado',
          },
          {
            texto: '**Si hay un equipo sin etiqueta o con una etiqueta que no está en la app**: no marcarlo como otro. Avisar al profesorado.',
          },
        ],
        comprobacion: [
          'En «📨 Lo que has propuesto», cada propuesta sale «Pendiente de validar» (o «Aceptada», si otra cuenta propuso el mismo sitio). La barra de progreso sube cuando el profesorado las acepta.',
        ],
        comprobacionImg: { img: 'INV-1/04-lo-que-has-propuesto.png', alt: 'Lo que has propuesto con propuestas pendientes, aceptadas y no aceptadas' },
        problemas: [
          ['El sitio no está en la lista', 'elegir el más cercano que exista y decirlo en la nota, o avisar al profesorado, que crea las ubicaciones.'],
          ['Una propuesta sale «No aceptada»', 'leer el motivo que ha escrito el profesorado, debajo.'],
          ['Se ha marcado un equipo en el sitio equivocado', 'volver a ese sitio, marcar «Mostrar también los que ya tienen ubicación concreta (para corregirla)» y marcarlo en el correcto.'],
        ],
        relacionado: [
          ['Antes', [['EQU-1', 'Encontrar un equipo'], ['EMP-6', 'Usar GestionLab en el móvil']]],
        ],
      },
    },
  },

  // ── INV-2 · versión alumnado (guion «INV-2_contar-stock.md», 25/11/2026) ──
  'INV-2': {
    pantallas: ['material'],
    versiones: {
      Alumno: {
        titulo: 'Contar el stock de un sitio',
        quien: ['Tu grupo, si el profesorado le ha dado permiso para contar stock. Solo en sitios de vuestros laboratorios y del almacén (zona común, 205-ZC).'],
        cuando: ['Cuando el profesorado os pide contar un armario o una balda.'],
        antes: [
          'El permiso del grupo (sin él, no sale el botón de contar).',
          'Guantes si hay reactivos.',
        ],
        extrasTrasAntes: [
          {
            titulo: 'Qué se cuenta',
            items: [
              '**Solo los envases cerrados**, en la misma unidad que usa la app para ese material (envases, cajas o unidades). Los envases abiertos no se cuentan: se apuntaron como gastados al abrirlos.',
              '**El material reutilizable** (♻️: vidrio, gradillas, objetos) se cuenta entero, porque no se gasta.',
              '**Solo lo que hay en ese sitio**, no lo de otros armarios.',
            ],
          },
        ],
        pasos: [
          {
            texto: '**Ponerse delante del sitio y buscar el material** en «Material fungible › Inventario» (→ [[STO-1|Encontrar un material]]). Pulsarlo para desplegar sus botes.',
          },
          {
            texto: '**Pulsar 🔢 en la línea del bote de ese sitio.** Si la app no lo tiene ahí pero lo hay, pulsar 🔢 en la línea del material y elegir el sitio en «¿Dónde lo has contado?»: está entre «Ahí no consta todavía» (los que ya tienen ese material, en «Donde ya consta»).',
            img: 'INV-2/01-boton-contar.png',
            alt: 'Material desplegado con el botón de contar de la línea de un bote señalado',
          },
          {
            texto: '**Contar lo que se ve, no lo que dice la app.** «En la app, ahí hay» enseña cuánto cree la app que hay; en «Cantidad real que ves», lo que hay de verdad, aunque no coincida. La ventana lo recuerda: «Cuenta solo los envases cerrados».',
            img: 'INV-2/02-ventana-de-recuento.png',
            alt: 'Ventana Contar stock con lo que dice la app, la cantidad real y el recordatorio de contar solo los envases cerrados',
          },
          {
            texto: '**En «Observaciones», lo que ayude a entender la diferencia**, con hechos: «2 cajas caducadas», «1 frasco roto». Sin nombres de personas.',
          },
          {
            texto: '**Pulsar «Enviar revisión».** Sale «Revisión enviada. El profesor la revisará pronto.» **No mover material mientras se cuenta**: si algo está fuera de sitio, se dice en observaciones.',
            img: 'INV-2/03-enviado.png',
            alt: 'Aviso Revisión enviada. El profesor la revisará pronto',
          },
          {
            texto: 'Si hay material que no está en la app, eso no se cuenta aquí: se inventaría (→ [[INV-3|Inventariar material que no está en la app]]).',
          },
        ],
        comprobacion: ['El recuento queda enviado y pendiente de que lo aplique un docente. Cuando lo aplica, el stock de ese sitio pasa a ser lo contado.'],
        problemas: [
          ['No sale el botón 🔢', 'el grupo no tiene permiso para contar, o ese sitio no es de vuestros laboratorios ni del almacén.'],
          ['Se ha enviado un número mal', 'avisar al profesorado antes de que lo aplique.'],
          ['Hay envases caducados o deteriorados', 'contarlos, decirlo en observaciones y avisar al profesorado. No tirarlos por vuestra cuenta (→ [[RES-1|Saber a qué contenedor va un residuo]]).'],
        ],
        relacionado: [
          ['Antes', [['STO-1', 'Encontrar un material']]],
          ['Junto a esta', [['INV-3', 'Inventariar material que no está en la app']]],
        ],
      },
    },
  },

  // ── INV-3 · versión alumnado (guion «INV-3_inventariar-material-nuevo.md», 25/11/2026) ──
  'INV-3': {
    pantallas: ['material', 'inventariar-material'],
    versiones: {
      Alumno: {
        titulo: 'Inventariar material que no está en la app',
        quien: ['Tu grupo, con la cuenta del grupo.'],
        cuando: ['Cuando el profesorado os pide inventariar un armario y aparece material que no está en la app.'],
        antes: [
          'El móvil con la sesión del grupo abierta y la cámara permitida. Si la app se abre dentro de otra aplicación (Classroom, Instagram…), abrirla en el navegador: dentro de esas aplicaciones la cámara suele estar bloqueada.',
          'Guantes si hay reactivos.',
        ],
        extrasTrasAntes: [
          {
            titulo: 'Normas que no cambian',
            items: [
              '**Un producto sin etiqueta o con la etiqueta ilegible no se inventaría ni se abre para ver qué es.** Apartarlo y avisar al profesorado: un producto desconocido es un problema de seguridad y de residuos, no de inventario.',
              '**Nada se abre para inventariarlo.** Se trabaja con lo que pone el envase por fuera.',
            ],
          },
        ],
        pasos: [
          {
            texto: '**Abrir «🧴 Inventariar material nuevo»**, en «Material fungible › Inventario», y **elegir el sitio donde se está** en «📍 ¿Dónde estás inventariando?»: el laboratorio y el armario o la balda. Todo lo que se envíe se guarda en ese sitio (lo dice debajo: «✓ Todo lo que envíes se guardará en …»): cambiarlo al pasar a otro armario.',
            img: 'INV-3/01-elegir-sitio.png',
            alt: 'Tarjeta ¿Dónde estás inventariando? con el laboratorio y el armario elegidos',
          },
          {
            texto: '**Comprobar antes que no está ya en la app** (→ [[STO-1|Encontrar un material]]). Si está, no se inventaría: se cuenta (→ [[INV-2|Contar el stock de un sitio]]).',
          },
          {
            texto: '**Fotografiar la etiqueta** entera y legible: «📷 Hacer una foto» (o «🖼️ Elegir una foto ya hecha»). Es obligatoria: es lo que mira el profesorado para validar.',
          },
          {
            texto: '**Elegir la categoría y el tipo de producto**, en «2 · ¿Qué es?». «✨ Leer la etiqueta» rellena los datos con IA: **comprobar cada dato con la etiqueta** y corregir lo que esté mal. Lo que no se ve en la foto se deja en blanco: la app lo marca con «no se ve en la foto».',
            imgs: [
              { img: 'INV-3/02-foto-de-la-etiqueta.png', alt: 'Foto de la etiqueta subida, con la categoría y el tipo elegidos y el botón Leer la etiqueta', pie: 'La foto, la categoría y el tipo; después, «✨ Leer la etiqueta».' },
              { img: 'INV-3/03-datos-leidos.png', alt: 'Datos leídos de la etiqueta con un dato marcado como no se ve en la foto, y la cantidad', pie: 'Lo leído, con lo que «no se ve en la foto» en blanco.' },
            ],
          },
          {
            texto: '**El nombre no se escribe: la app lo compone.** Lo que pone la etiqueta (marca, referencia) va en «Lo que pone en la etiqueta».',
          },
          {
            texto: '**Cantidad, en «4 · ¿Cuánto hay?»: los envases cerrados**, en su unidad. Si hay alguno abierto, decirlo en observaciones.',
          },
          {
            texto: '**En observaciones, la caducidad si ya ha pasado o el estado del envase si está deteriorado.**',
          },
          {
            texto: '**Pulsar «📨 Enviar propuesta».** Si la app avisa de que se parece a algo que ya existe («⚠️ Se parece a …»), mirar si es lo mismo; si hay duda, enviarlo igual con su foto.',
          },
        ],
        comprobacion: ['En «📨 Lo que has propuesto» sale «Pendiente de validar». Cuando el profesorado lo valida, pasa a «Aceptada» o «Ya existía»; si no, «No aceptada» con el motivo.'],
        comprobacionImg: { img: 'INV-3/05-lo-que-has-propuesto.png', alt: 'Lo que has propuesto con una propuesta pendiente, una que ya existía y una aceptada' },
        problemas: [
          ['No se puede enviar', 'falta la foto, la categoría o el tipo.'],
          ['El tipo de producto no está en la lista', 'elegir «No está en la lista» y escribir el nombre común (no el comercial).'],
          ['La cámara no se abre', 'dar permiso a la cámara, o abrir la app en el navegador en vez de dentro de otra aplicación. También vale elegir una foto ya hecha.'],
        ],
        relacionado: [
          ['Antes', [['STO-1', 'Encontrar un material']]],
          ['Junto a esta', [['INV-2', 'Contar el stock de un sitio'], ['INV-1', 'Ubicar los equipos de un laboratorio']]],
        ],
      },
    },
  },
};

(() => {
  const sto1 = {
    titulo: 'Encontrar un material y ver cuánto hay y dónde',
    quien: ['Cualquier cuenta.'],
    cuando: [
      'Antes de una práctica, para saber si hay bastante de un reactivo o de un fungible y dónde está.',
      'Cuando no se encuentra algo en el armario donde se esperaba.',
    ],
    antes: ['El nombre del material, su categoría o su referencia.'],
    pasos: [
      {
        texto: '**Buscar el material** en «Material fungible › Inventario»: escribir el nombre en «Buscar material...» (busca también por categoría, código y referencia del proveedor). Para ver solo lo de un sitio, escribir el laboratorio o el código en «Filtrar por ubicación...» (por ejemplo, 203 o 205-ZC).',
        nota: '**La zona común (205-ZC) es un almacén**: lo que hay allí se lleva al laboratorio para usarlo (→ [[STO-3|Llevar material de un sitio a otro]]).',
        img: 'STO-1/01-buscar-material.png',
        alt: 'Inventario de material fungible con «puntas» escrito en el buscador y el material encontrado señalado',
      },
      {
        texto: '**Leer la barra de stock**: verde, hay bastante; ámbar, está en el mínimo o por debajo; rojo, no queda. Al lado de la barra, lo que hay en total; a la derecha, el mínimo y el óptimo. **El stock son los envases cerrados**: los abiertos ya se apuntaron como gastados al abrirlos. El material reutilizable (♻️) cuenta entero.',
        img: 'STO-1/02-barra-de-stock.png',
        alt: 'Tres materiales con la barra de stock señalada: verde, ámbar y roja',
      },
      {
        texto: '**Pulsar el material para desplegarlo y ver cada bote**: una línea por sitio, con «📍», el código del sitio, dónde está (laboratorio, armario y balda, por ejemplo «Armario 1 · Balda 1») y qué se guarda en él («Puntas y guantes»), cuánto hay en cada uno y «☣️ ESTÉRIL» si es de uso estéril. Los botes del almacén llevan «Zona común» delante. El material reutilizable lleva «♻️ Reutilizable» junto a lo que hay en total.',
        img: 'STO-1/03-material-desplegado.png',
        alt: 'Material desplegado con una línea por bote y la línea de antigüedad señaladas',
      },
      {
        texto: '**Coger primero lo más antiguo**: la última línea, «🗓 Antigüedad», dice desde cuándo está cada tanda (por ejemplo, «sept 2026 (3 caja/s)»). Antes de usarlo, mirar la caducidad en el envase.',
        nota: 'La antigüedad es del material entero, no de cada bote: la app no sabe en qué sitio está cada tanda. El envase sí lo dice. «ver historial» enseña cada entrada, traslado y gasto del material.',
      },
    ],
    comprobacion: ['Se sabe en qué sitio está el bote que se va a usar, y en ese sitio está.'],
    problemas: [
      ['No aparece', 'probar con otro nombre, con la categoría o con la referencia del envase. Y comprobar que no queda nada escrito en «Filtrar por ubicación...».'],
      ['No está en la app pero sí en el laboratorio', 'cuando el profesorado lo pida, se inventaría (→ [[INV-3|Inventariar material que no está en la app]]).'],
      ['La app dice que hay y no hay, o al revés', 'no cambiar nada por vuestra cuenta. Avisar al profesorado: es un fallo del stock, que se corrige con un recuento.'],
      ['Está en ámbar o en rojo, o se ha acabado', 'avisar al profesorado, que es quien lo pide.'],
    ],
    relacionado: [
      ['Después', [['STO-3', 'Llevar material de un sitio a otro'], ['STO-2', 'Apuntar el gasto al abrir un envase nuevo']]],
      ['Cuando lo pide el profesorado', [['INV-2', 'Contar el stock de un sitio'], ['INV-3', 'Inventariar material nuevo']]],
    ],
  };
  const sto3 = {
    titulo: 'Llevar material de un sitio a otro (y apuntarlo)',
    quien: ['Cualquier cuenta. Con la cuenta de un grupo, el traslado queda a nombre del grupo.'],
    cuando: [
      '**Cada vez que se coge material del almacén para llevarlo al laboratorio donde se trabaja.** La zona común (205-ZC) es un almacén: lo que hay allí no se gasta allí, se lleva al laboratorio. El gasto se apunta después, en el laboratorio, al abrir el envase (→ [[STO-2|Apuntar el gasto al abrir un envase nuevo]]).',
      'Cada vez que un material cambia de sitio dentro del laboratorio (de un armario a otro).',
      'Si no se apunta, el siguiente lo busca donde ya no está y el stock de cada sitio queda mal.',
    ],
    antes: ['El sitio exacto donde se va a dejar (el armario, no solo el laboratorio).'],
    pasos: [
      {
        texto: '**Leer la etiqueta del armario de donde se coge** (→ [[EMP-6|Usar GestionLab en el móvil]]): se abre «¿Qué te llevas?» con lo que hay en ese armario. Es la forma más rápida.',
        nota: 'Sin etiqueta: en «Material fungible › Inventario», desplegar el material y pulsar «🔀» en la línea del bote del que se coge. Se abre «🔀 Trasladar material», con un solo material; el resto es igual.',
      },
      {
        texto: '**Marcar lo que se coge y cuánto**: «+» en cada material hasta lo que te llevas. Lo que no se coge se deja en 0.',
        img: 'STO-3/01-que-te-llevas.png',
        alt: '¿Qué te llevas? desde un armario del almacén (zona común), con 2 cajas de puntas de pipeta marcadas',
      },
      {
        texto: '**Elegir el destino donde se deja de verdad**, en «¿A dónde los llevas?». Si ese material ya está en algún sitio, la app propone esos sitios primero («📍 Donde ya hay — toca para elegirlo»): dejarlo junto a lo que ya hay, para no repartir el mismo material por varios armarios. Si no, «➕ Otro sitio (donde aún no hay)» y elegir el laboratorio y el sitio.',
        nota: 'Desde el almacén (la zona común) solo se puede llevar material a un laboratorio: la zona común no sale como destino.',
        img: 'STO-3/02-destino-donde-ya-hay.png',
        alt: 'Destino del traslado con los sitios donde ya hay de ese material señalados',
      },
      {
        texto: '**Pulsar «✅ Confirmar traslado»** («🔀 Trasladar» si se entró por el bote). La app comprueba todo antes de mover nada: si de algo no hay bastante, no traslada ninguno. Sale el aviso del traslado con el sitio de destino.',
        img: 'STO-3/03-traslado-confirmado.png',
        alt: 'Material desplegado tras el traslado: el bote del almacén ha bajado y el del laboratorio ha subido, con el aviso de traslado abajo',
      },
    ],
    comprobacion: [
      'En el inventario de material, ese material aparece en el sitio de destino con lo que se ha llevado, y en el de origen ha bajado. En su historial, la línea «🔀 Traslado» con quien lo hizo.',
    ],
    problemas: [
      ['«No hay bastante» y no se traslada nada', 'revisar las cantidades. Si la app tiene menos de lo que hay de verdad, avisar al profesorado: el stock no cuadraba.'],
      ['El sitio de destino no está en la app', 'elegir el más cercano que exista y avisar al profesorado, que crea las ubicaciones.'],
      ['Se ha llevado al sitio equivocado', 'hacer otro traslado al sitio correcto.'],
    ],
    relacionado: [
      ['Antes', [['EMP-6', 'Usar GestionLab en el móvil: etiquetas de armario'], ['STO-1', 'Encontrar un material']]],
      ['Después', [['STO-2', 'Apuntar el gasto al abrir un envase nuevo']]],
    ],
  };
  // Solo en los manuales de Gestor y Administrador (decisión de Paloma, 25/11/2026): el
  // material común del departamento sí se apunta como gasto desde la zona común. Al alumnado
  // y al profesorado no se les cuenta. Guiones: apartado «Solo en los manuales de Gestor y
  // Administrador» de STO-1 y STO-3. Regla de la app: gastoBloqueadoEnAlmacen() (js/config.js).
  const excepcionComun = '**Solo para gestión: el material común del departamento.** El que tiene marcada en su ficha la casilla «🤝 Material común del departamento» (guantes, papel…) **sí** se puede apuntar como gasto desde la zona común, porque de allí se lo llevan otros ciclos: sus botes del almacén tienen «📦». Los manuales del alumnado y del profesorado no lo cuentan.';
  const sto1Gestion = { ...sto1, pasos: sto1.pasos.map((p, i) => i === 0 ? { ...p, nota: p.nota + ' ' + excepcionComun } : p) };
  const sto3Gestion = { ...sto3, cuando: [sto3.cuando[0], excepcionComun, ...sto3.cuando.slice(1)] };
  AYUDA_ORDEN_MANUALES.forEach(r => {
    const gestion = r === 'Gestor' || r === 'Administrador';
    AYUDA_TAREAS['STO-1'].versiones[r] = gestion ? sto1Gestion : sto1;
    AYUDA_TAREAS['STO-3'].versiones[r] = gestion ? sto3Gestion : sto3;
  });
})();

// ── RES-1 · común a todos los roles (guion «RES-1_a-que-contenedor.md», 25/11/2026) ──
// Qué va a cada contenedor lo dice la Guía de residuos (catálogo y normas del gestor): aquí
// solo se enseña a encontrarlo y qué hacer si no se encuentra, sin copiar las normas.
(() => {
  const res1 = {
    titulo: 'Saber a qué contenedor va un residuo, y qué hacer si no está en la guía',
    quien: ['Cualquier cuenta.'],
    cuando: [
      '**Antes de tirar cualquier cosa que no sea basura normal**, aunque se crea saber dónde va. En el laboratorio, la mayoría de los errores con los residuos son de quien estaba seguro.',
      'Antes de empezar una práctica que va a generar un residuo nuevo: así el contenedor se localiza antes de necesitarlo.',
    ],
    antes: [
      'Qué es el residuo: qué lleva (reactivos, muestra biológica, formol, disolventes…), de qué práctica sale y en qué estado está (sólido, líquido, punzante).',
      'Si es un reactivo o lleva reactivos: su etiqueta y, si hace falta, su ficha de datos de seguridad.',
    ],
    extrasTrasAntes: [
      {
        titulo: 'Normas que no cambian',
        items: [
          '**No mezclar residuos** salvo que la guía lo diga. Mezclar lo que no debe juntarse puede reaccionar (por ejemplo, lejía con un ácido desprende cloro).',
          '**Los frascos de reactivos que se desechan no se vacían**: van cerrados, tal cual, a donde diga la guía.',
          '**Al fregadero, nada**, salvo lo que la guía diga expresamente que puede ir.',
          '**El bidón «Reactivos de laboratorio» no es el contenedor de las dudas.** Es para lo que la guía manda allí (lo que tiene dos naturalezas, lo que tiene que ir solo o lo que no se puede clasificar), no para lo que no se sabe dónde va.',
          '**Si hay un derrame, olor o alguien se ha expuesto**: no consultar la app; avisar en ese momento al profesorado presente.',
        ],
      },
    ],
    pasos: [
      {
        texto: '**Buscarlo en la Guía de residuos**: «Residuos › Guía de residuos» (en el móvil, menú «☰»). En «Buscar residuo, descripción o contenedor…» escribir el nombre, una palabra de lo que es («tinción», «formol») o el peligro («Inflamable»). Los resultados salen agrupados por contenedor: el título de cada grupo es el contenedor al que van.',
        nota: '**Los vídeos de residuos**: arriba de la Guía, «▶ Ver el vídeo completo, con su índice» recorre los contenedores del centro explicados en el laboratorio; en el índice se pulsa lo que se quiere tirar y el vídeo salta a esa explicación. Cada contenedor que sale en el vídeo tiene además su trozo («▶ Vídeo: …») en la lista de la Guía, en el asistente y en «Añadir residuo». Todos llevan subtítulos.',
        imgs: [
          { img: 'RES-1/01-buscar-en-la-guia.png', alt: 'Guía de residuos con «tinción» escrito en el buscador y los residuos encontrados bajo su contenedor', pie: 'El buscador de la Guía.' },
          { img: 'RES-1/00-videos.png', alt: 'Cabecera de la Guía de residuos con el botón Ver el vídeo completo, con su índice', pie: 'Los vídeos, arriba de la Guía.' },
        ],
      },
      {
        texto: '**Si no aparece, o no se está seguro: el asistente «🧭 ¿Dónde lo tiro?»**, en la misma página. Hace una pregunta cada vez: pulsar la respuesta que corresponde a lo que el residuo es de verdad, no a lo que se supone. «← Atrás» deshace la última respuesta y «Empezar de nuevo» vuelve al principio.',
        img: 'RES-1/02-asistente.png',
        alt: 'Asistente ¿Dónde lo tiro? a mitad de camino, con la pregunta ¿De dónde sale el líquido? y sus respuestas',
      },
      {
        texto: '**Al final, el asistente dice el contenedor** y por qué, con los contenedores de ese tipo que hay en el centro: laboratorio, sitio y nivel. «Qué residuos del catálogo van aquí» enseña los de la guía que van en él.',
        img: 'RES-1/03-asistente-resultado.png',
        alt: 'Resultado del asistente: Bolsa de autoclave, el porqué y el contenedor del laboratorio 205 con su nivel',
      },
      {
        texto: '**Leer también las «📋 Normas generales del gestor de residuos»** (pulsar para desplegarlas): son las reglas acordadas con la empresa de residuos y mandan sobre todo lo demás.',
        img: 'RES-1/04-normas-del-gestor.png',
        alt: 'Normas generales del gestor de residuos desplegadas',
      },
      {
        texto: '**Si sigue sin estar claro: el consultorio de residuos**, con «💬 Abrir consultorio de residuos» (arriba de la página). Elegir en «¿En qué laboratorio estás ahora mismo?» el laboratorio en el que se está y describir el residuo con todos los datos de «Antes de empezar». Si su respuesta no coincide con la guía, manda la guía.',
        img: 'RES-1/05-consultorio.png',
        alt: 'Consultorio de residuos con el laboratorio elegido y la caja Describe el residuo',
      },
      {
        texto: '**Si un reactivo no aparece en la guía**: mirar en su ficha de datos de seguridad el apartado 13, «Consideraciones relativas a la eliminación», y con eso volver a la guía o preguntar.',
      },
      {
        texto: '**Si después de todo sigue la duda, no tirarlo.** Dejarlo en su envase, cerrado y rotulado con lo que es, y preguntar al profesorado o avisar a la gestora desde la guía: el botón «Avisar a la gestora» sale cuando el buscador no encuentra el residuo y cuando el asistente no llega a un contenedor. En «¿Qué quieres tirar?», qué es; en «¿Dónde lo has dejado?», dónde se ha dejado; y «Enviar aviso». La consulta queda en GestionLab para la gestión del laboratorio: no se manda ningún correo.',
        img: 'RES-1/06-avisar-a-la-gestora.png',
        alt: 'Ventana Avisar a la gestora con qué se quiere tirar y dónde se ha dejado',
      },
      {
        texto: '**Con el contenedor claro, ir a echarlo y apuntarlo** (→ [[RES-2|Echar un residuo y apuntarlo]]). Si el contenedor está en otro laboratorio, se lleva allí.',
      },
    ],
    comprobacion: [
      'Se sabe a qué contenedor va y en qué laboratorio está, y lo dice la guía (no una suposición). O el residuo está cerrado, rotulado y avisado.',
    ],
    problemas: [
      ['«No hemos encontrado ese residuo»', 'no tirarlo todavía. Seguir con el asistente y el consultorio, o avisar a la gestora.'],
      ['El asistente dice que no hay ningún contenedor activo de ese tipo', 'dejarlo en su envase, cerrado y rotulado, y avisar a la gestora.'],
      ['El consultorio no responde («La IA de Google está saturada ahora mismo y no ha contestado»)', 'volver a intentarlo más tarde o preguntar al profesorado. Mientras, el residuo no se tira.'],
      ['La guía y el contenedor físico no coinciden (el contenedor que dice la guía no está donde dice, o tiene otra etiqueta)', 'no tirarlo y avisar al profesorado.'],
    ],
    relacionado: [['Después', [['RES-2', 'Echar un residuo y apuntarlo']]]],
  };
  AYUDA_ORDEN_MANUALES.forEach(r => { AYUDA_TAREAS['RES-1'].versiones[r] = res1; });
})();

// ── USO-1 y USO-2 · comunes a todos los roles (guiones del 23/11/2026) ──
(() => {
  const uso1 = {
    titulo: 'Apuntar un uso de la cabina de seguridad biológica o de la vitrina de gases',
    quien: ['Cualquier cuenta. Con la cuenta de un grupo, la sesión es del grupo: que la empiece y la termine la misma persona, que es quien sabe lo que se ha hecho.'],
    cuando: ['Cada vez que se trabaja en la cabina de seguridad biológica (CAB-03) o en una vitrina de gases (CAB-01, CAB-02, CAB-04). Este registro sustituye a la hoja en papel.'],
    antes: [
      '**El equipo adecuado**: la cabina es para trabajo biológico (cultivos, muestras humanas), y solo con agentes de los grupos de riesgo 1 y 2, porque los laboratorios son de nivel de contención 2. La vitrina es para productos químicos que desprenden vapores, y en ella nada de cultivos abiertos.',
      '**En la vitrina de carbón activo (CAB-02)**: que los productos estén entre los admitidos de su etiqueta y que el filtro esté en fecha.',
      '**El protocolo del equipo**: apartado 2 (seguridad), 4 (comprobaciones previas) y 7 (procedimiento de uso) (→ [[EQU-2|Consultar cómo se usa un equipo]]).',
      'La práctica que se va a hacer y, en la cabina, el grupo de riesgo del agente; en la vitrina, los productos.',
    ],
    pasos: [
      { texto: '**Encender el equipo y hacer las comprobaciones previas del apartado 4** de su protocolo, antes de abrir nada.' },
      {
        texto: '**Empezar la sesión**: leer la etiqueta del equipo con el móvil (→ [[EMP-6|Usar GestionLab en el móvil: etiquetas]]) o, en «Uso del laboratorio › Registros de uso», elegir la pestaña («🧫 Cabina de bioseguridad» o «🌫️ Vitrina de gases») y el equipo, y pulsar «▶ Empezar sesión». Si se ha empezado por error, «Deshacer» durante unos segundos.',
        imgs: [
          { img: 'USO-1/01-empezar-sesion.png', alt: 'Registros de uso de la cabina con el botón Empezar sesión señalado', pie: '«▶ Empezar sesión».' },
          { img: 'USO-1/02-sesion-empezada.png', alt: 'Sesión empezada con el aviso y su botón Deshacer, y el botón Terminar mi sesión señalado', pie: 'La sesión empezada: el botón pasa a «■ Terminar mi sesión».' },
        ],
      },
      { texto: 'Trabajar según el apartado 7 del protocolo.' },
      { texto: 'Al terminar, recoger y desinfectar como dice el protocolo. En la cabina, la UV solo con el frontal cerrado y sin nadie delante; nunca sustituye a la desinfección.' },
      {
        texto: '**Terminar la sesión** (leer otra vez la etiqueta, o «■ Terminar mi sesión») y rellenar con lo que se ha hecho de verdad. «Hora fin» trae la hora de ahora.',
        lista: [
          '**Cabina**: «Práctica / técnica» · «Grupo de riesgo del agente» · «Minutos de UV (si se ha usado)» · las casillas «Comprobaciones previas hechas (apartado 4 del protocolo)», «Desinfección inicial hecha» y «Desinfección final hecha» · en «Alarmas e incidencias», las alarmas que hayan saltado y los derrames.',
          '**Vitrina**: «Práctica / técnica» · «Productos / reactivos manipulados» · las casillas «Comprobaciones previas hechas (apartado 4 del protocolo)» y «Limpieza y retirada de material al terminar» · «Incidencias».',
        ],
        nota: 'Después, «Guardar y cerrar sesión».',
        imgs: [
          { img: 'USO-1/03-terminar-cabina.png', alt: 'Ventana Cerrar sesión de la cabina con la práctica, el grupo de riesgo, los minutos de UV y las tres casillas', pie: 'Cabina.' },
          { img: 'USO-1/04-terminar-vitrina.png', alt: 'Ventana Cerrar sesión de la vitrina con la práctica, los productos y las dos casillas', pie: 'Vitrina.' },
        ],
      },
      { texto: '**Si se olvidó empezar la sesión**: «📝 Registrar sesión completa» ese mismo día, con las horas reales.' },
    ],
    comprobacion: [
      'La sesión sale cerrada en el «Historial» del equipo, con los datos rellenados.',
      'La cuenta no tiene ninguna sesión abierta en ese equipo.',
    ],
    comprobacionImg: { img: 'USO-1/05-historial.png', alt: 'Historial de la cabina con la sesión cerrada y sus datos' },
    problemas: [
      ['Salta una alarma mientras se trabaja', 'parar y seguir el apartado 10 del protocolo; apuntarla en «Alarmas e incidencias». Si el equipo falla, avisar (→ [[INC-1|Avisar de una avería]]).'],
      ['Derrame', 'actuar según el apartado 2 del protocolo, apuntarlo en incidencias y avisar al profesorado.'],
      ['Se olvidó terminar la sesión', 'la app avisa al entrar. Cerrarla con los datos de ese día (→ [[USO-3|Cerrar las sesiones que se quedaron abiertas]]).'],
      ['Se ha apuntado algo mal en una sesión ya cerrada', 'avisar al profesorado. Gestión lo corrige, y queda constancia del cambio.'],
      ['Hay una reserva del equipo', 'la reserva no es el registro. Hay que apuntar el uso igualmente.'],
    ],
    relacionado: [
      ['Antes', [['EQU-2', 'Consultar cómo se usa'], ['EMP-6', 'Usar GestionLab en el móvil: etiquetas'], ['EQU-4', 'Reservar un equipo']]],
      ['Después', [['USO-3', 'Cerrar las sesiones que se quedaron abiertas'], ['INC-1', 'Avisar de una avería']]],
      ['Cepas del grupo 2', [['MUE-2', 'Usar una muestra congelada']]],
    ],
  };

  const uso2 = {
    titulo: 'Apuntar un ciclo de autoclave',
    quien: ['Cualquier cuenta.'],
    cuando: [
      'En cada ciclo de cualquiera de los dos autoclaves del 205 (AUTC-001 y AUTC-002, el grande de 75 l): al arrancarlo y al terminar.',
      'Si el ciclo llevaba indicador biológico, también al leerlo, 24–48 h después.',
      'Este registro sustituye a la hoja del autoclave.',
    ],
    antes: [
      '**El protocolo del autoclave**: apartados 2 (seguridad), 4 (comprobaciones previas) y 7 (procedimiento de uso, con los programas por tipo de carga) (→ [[EQU-2|Consultar cómo se usa un equipo]]).',
      '**La carga preparada como dice el apartado 7**: cinta indicadora en cada paquete o bolsa, e integrador químico en el centro de la carga.',
      'El programa (temperatura y minutos) y el tipo de carga: material, medios o residuos.',
    ],
    pasos: [
      { texto: 'Hacer las comprobaciones previas del apartado 4 y cargar.' },
      {
        texto: '**Arrancar el ciclo y apuntarlo en ese momento**: con la etiqueta del autoclave (→ [[EMP-6|Usar GestionLab en el móvil: etiquetas]]) o en «Uso del laboratorio › Registros de uso», pestaña «♨️ Autoclave», «▶ Arrancar ciclo». En «Arrancar ciclo»: la hora de inicio, el «Programa (temperatura y minutos)», el «Tipo de carga» y, si la carga lleva indicador biológico, la casilla «Lleva indicador biológico». Pulsar «Arrancar ciclo».',
        img: 'USO-2/01-arrancar-ciclo.png',
        alt: 'Ventana Arrancar ciclo con el programa, el tipo de carga y la casilla del indicador biológico',
      },
      { texto: '**Al terminar, antes de abrir**: leer en el panel la temperatura y la presión máximas alcanzadas. Abrir solo como dice el protocolo (manómetro a 0 bar, cara apartada).' },
      {
        texto: '**Comprobar la cinta y el integrador, y completar el registro**: «■ Completar ciclo» (o leer otra vez la etiqueta). «Hora fin», «Temperatura máxima alcanzada (°C)», «Presión máxima alcanzada (bar)», «Cinta indicadora» e «Integrador químico» («Viró», «No viró» o «No se puso»), e incidencias. Pulsar «Guardar y completar el ciclo».',
        nota: 'Mientras dura, el ciclo sale en «Ciclos en marcha». Lo puede completar cualquier cuenta: el ciclo es del autoclave, no de quien lo arrancó.',
        imgs: [
          { img: 'USO-2/02-ciclo-en-marcha.png', alt: 'Pestaña del autoclave con el ciclo en marcha y el botón Completar ciclo señalado', pie: 'El ciclo en marcha: «■ Completar ciclo».' },
          { img: 'USO-2/03-completar-ciclo.png', alt: 'Ventana Completar ciclo con la temperatura y la presión máximas y los dos indicadores', pie: 'Temperatura, presión e indicadores.' },
        ],
      },
      {
        texto: '**Si la carga llevaba indicador biológico**: el ciclo queda en «Indicadores biológicos por leer». Cuando se lea tras incubar (24–48 h a 56 °C, junto con su control positivo sin autoclavar), «🧫 Apuntar resultado» y elegir «Negativo» o «Positivo».',
        nota: 'Si es positivo, la app abre el aviso de avería del autoclave ya escrito (→ [[INC-1|Avisar de una avería]]).',
        imgs: [
          { img: 'USO-2/04-biologico-por-leer.png', alt: 'Indicadores biológicos por leer con el ciclo y el botón Apuntar resultado', pie: '«Indicadores biológicos por leer».' },
          { img: 'USO-2/05-resultado-biologico.png', alt: 'Ventana Resultado del indicador biológico con Negativo elegido', pie: 'El resultado, en ese mismo ciclo.' },
        ],
      },
    ],
    extras: [
      {
        titulo: 'Si el ciclo no sale bien',
        items: [
          '**Integrador sin virar, o temperatura o presión por debajo de lo previsto**: la carga no se da por tratada. El material no se usa y los residuos no se sacan como tratados. Seguir el apartado 10 del protocolo (recargar bien y repetir) y avisar al profesorado.',
          '**Indicador biológico positivo**: el autoclave pasa a «NO USAR». Avisar al profesorado y abrir un aviso de avería (→ [[INC-1|Avisar de una avería]]).',
          '**Mensaje de error en el panel**: apuntar el código tal como sale en incidencias y buscarlo en el apartado 10 del protocolo.',
        ],
      },
    ],
    comprobacion: ['El ciclo sale en el «Historial» del autoclave con todos sus datos: programa, carga, temperatura y presión máximas, indicadores y, cuando toque, el resultado del biológico.'],
    comprobacionImg: { img: 'USO-2/06-historial.png', alt: 'Historial del autoclave con la temperatura, la presión y la cinta del ciclo' },
    problemas: [
      ['Se ha apuntado algo mal', 'avisar al profesorado. Gestión lo corrige, y queda constancia del cambio.'],
      ['No se apuntó al arrancar', 'apuntarlo en cuanto se pueda, con la hora real de inicio: «📝 Registrar ciclo completo».'],
    ],
    relacionado: [
      ['Antes', [['EQU-2', 'Consultar cómo se usa'], ['EMP-6', 'Usar GestionLab en el móvil: etiquetas'], ['EQU-4', 'Reservar un equipo']]],
      ['Después', [['INC-1', 'Avisar de una avería'], ['RES-2', 'Echar un residuo y apuntarlo']]],
    ],
  };
  AYUDA_ORDEN_MANUALES.forEach(r => {
    AYUDA_TAREAS['USO-1'].versiones[r] = uso1;
    AYUDA_TAREAS['USO-2'].versiones[r] = uso2;
  });
})();

(() => {
  const emp2 = {
    titulo: 'La app te pide volver a entrar (sesión caducada)',
    quien: ['Cualquier cuenta.'],
    cuando: [
      'Al abrir la app sale la pantalla de entrada, aunque en ese dispositivo ya se había entrado.',
      'Al pulsar «Guardar» (o «Finalizar», «Registrar»…) sale «Tu sesión ha caducado. Vuelve a entrar para guardar cambios.» y se abre la pantalla de entrada.',
      'La app vuelve sola a la pantalla de entrada mientras estaba abierta.',
      'En los tres casos, la sesión de ese dispositivo ha dejado de valer. Sin sesión, la app no enseña datos ni guarda nada.',
    ],
    antes: [
      'El email y la contraseña de la cuenta con la que se estaba trabajando. Con la cuenta de un grupo, los del grupo.',
    ],
    pasos: [
      {
        texto: '**No cerrar la app ni recargar la página.** Lo que estaba a medio rellenar solo está en esa pantalla: si se cierra o se recarga, se pierde.',
      },
      {
        texto: '**Entrar con la misma cuenta** con la que se estaba trabajando: email, contraseña e «Iniciar sesión». Si había una ventana a medio rellenar, la pantalla de entrada lo recuerda: «Vuelve a entrar con la misma cuenta: lo que estabas rellenando sigue ahí y podrás guardarlo». Si no, pone solo «Tu sesión ha caducado. Vuelve a entrar.»',
        img: 'EMP-2/01-entrada-sesion-caducada.png',
        alt: 'Pantalla de entrada con el aviso de sesión caducada señalado y el mensaje Tu sesión ha caducado abajo',
      },
      {
        texto: '**Revisar que está todo y pulsar otra vez el botón** («Guardar», «Finalizar», «Registrar»…). Reaparece la ventana con todo lo rellenado y el aviso «Ya has vuelto a entrar: pulsa otra vez el botón para guardar». Hasta ese momento, no se ha guardado nada.',
        nota: 'En el móvil, ese aviso tapa unos segundos los botones de abajo de la ventana: esperar a que desaparezca.',
        img: 'EMP-2/02-ventana-reaparece.png',
        alt: 'La ventana del mantenimiento vuelve a aparecer con las observaciones escritas y el aviso Ya has vuelto a entrar',
      },
      {
        texto: '**Si se entra con otra cuenta, lo rellenado se pierde**: la app lo avisa («Has entrado con otra cuenta: lo que estaba sin guardar se ha descartado»). En un dispositivo del laboratorio, entrar con la cuenta del grupo que estaba trabajando, no con otra.',
      },
    ],
    comprobacion: [
      'Tras pulsar otra vez el botón, sale el mensaje de confirmación de siempre y lo registrado aparece donde tiene que estar. Por ejemplo, un mantenimiento finalizado por un grupo sale «⏳ Espera visto bueno» en la tarjeta del equipo.',
    ],
    problemas: [
      ['No se sabe la contraseña', 'la del grupo la da el profesorado; la personal, la restablece Gestión.'],
      ['Lo rellenado no reaparece', 'volver a rellenarlo. En registros largos, como un mantenimiento, conviene «💾 Guardar progreso» de vez en cuando: así, si la sesión cae, se pierde poco.'],
    ],
    relacionado: [
      ['Antes', [['EMP-1', 'Entrar en GestionLab']]],
    ],
  };
  AYUDA_ORDEN_MANUALES.forEach(r => { AYUDA_TAREAS['EMP-2'].versiones[r] = emp2; });
})();

(() => {
  const emp6 = {
    titulo: 'Usar GestionLab en el móvil: instalarla y leer las etiquetas NFC/QR',
    quien: [
      'Cualquier cuenta: la del grupo o la tuya. Una etiqueta no da más permisos que los que ya tiene la cuenta con la que se lee.',
    ],
    cuando: [
      '**Una vez**: al empezar a usar GestionLab en tu móvil, para instalarla.',
      '**Cada vez** que vayas a usar algo que lleva etiqueta: la cabina de bioseguridad, la vitrina de gases, el autoclave, una caja o un congelador de muestras, un armario del que te llevas material o un contenedor de residuos.',
    ],
    antes: [
      'El móvil con conexión. Sin conexión, la app abre, pero sin datos.',
      'El NFC del móvil activado, si lo tiene. Si no tiene NFC, la cámara para leer el QR.',
      'La sesión de GestionLab iniciada en ese móvil (→ [[EMP-1|Entrar en GestionLab]]).',
    ],
    pasos: [
      {
        texto: '**Instalar (una vez).** Abrir GestionLab en el navegador del móvil (labsuite.github.io/gestionlab-sanidad) y añadirla a la pantalla de inicio. En Chrome o Edge, menú «⋮» → «Instalar aplicación» o «Añadir a pantalla de inicio»; en iPhone, con Safari, «Compartir» → «Añadir a pantalla de inicio». Queda con su icono, se abre sin la barra del navegador y se actualiza sola.',
      },
      {
        texto: '**Entrar y dejar la sesión abierta en ese móvil.** Las etiquetas solo registran con la sesión iniciada. Si no la hay, al leer la etiqueta se abre la pantalla de entrada: al entrar, la app hace lo que pedía la etiqueta. En el móvil propio, no cerrar la sesión con «↩».',
        img: 'EMP-1/01-pantalla-de-entrada.png',
        alt: 'Pantalla de entrada de GestionLab, la que sale al leer una etiqueta sin sesión',
      },
      {
        texto: '**Leer la etiqueta**: acercar la parte de atrás del móvil a la pegatina NFC, o enfocar el QR con la cámara.',
      },
      {
        texto: '**Comprobar en la pantalla que se ha abierto lo que esperabas** (el equipo, la caja o el contenedor correctos) antes de seguir. Lo que abre cada etiqueta está en la tabla de abajo.',
        imgs: [
          { img: 'EMP-6/01-cabina-sesion-empezada.png', alt: 'Registros de uso de la cabina con la sesión recién empezada y el aviso con el botón Deshacer', pie: 'Cabina o vitrina: la sesión empezada, con «Deshacer» durante unos segundos.' },
          { img: 'EMP-6/02-autoclave-registro.png', alt: 'Ventana Arrancar ciclo del autoclave con el equipo ya elegido', pie: 'Autoclave: «Arrancar ciclo», con el autoclave ya elegido (si tiene un ciclo en marcha, «Completar ciclo»).' },
          { img: 'EMP-6/03-caja-de-muestras.png', alt: 'Caja del congelador abierta con sus tubos', pie: 'Caja de muestras: la caja abierta, para buscar y usar el tubo.' },
          { img: 'EMP-6/04-armario-que-te-llevas.png', alt: 'Ventana ¿Qué te llevas? con el material del armario', pie: 'Armario: «¿Qué te llevas?», con el material de ese armario.' },
          { img: 'EMP-6/05-contenedor-anadir-residuo.png', alt: 'Ventana Añadir residuo del contenedor biosanitario del laboratorio 205', pie: 'Contenedor: «Añadir residuo» del contenedor de esa categoría en ese laboratorio.' },
        ],
      },
    ],
    extras: [
      {
        titulo: 'Qué hace cada etiqueta',
        tabla: {
          cabeceras: ['Etiqueta', 'Qué abre', 'Tarea'],
          filas: [
            ['Cabina de bioseguridad, vitrina de gases', 'La primera lectura **empieza** la sesión de trabajo en ese equipo; la siguiente abre el formulario para **terminarla**', '[[USO-1|Apuntar un uso de la cabina o de la vitrina]]'],
            ['Autoclave', '«Arrancar ciclo», con el autoclave ya elegido; si tiene un ciclo en marcha, «Completar ciclo»', '[[USO-2|Apuntar un ciclo de autoclave]]'],
            ['Caja o congelador de muestras', 'La caja, lista para buscar el tubo y usarlo (con la del congelador, todas sus cajas)', '[[MUE-1|Encontrar una muestra]] · [[MUE-2|Usar una muestra]]'],
            ['Armario', '«¿Qué te llevas?»: el material de ese armario, para llevarlo a otro sitio', '[[STO-3|Llevar material de un sitio a otro]]'],
            ['Contenedor de residuos', '«Añadir residuo» del contenedor de esa categoría en ese laboratorio', '[[RES-2|Echar un residuo y apuntarlo]]'],
          ],
        },
        nota: 'Los equipos no tienen etiqueta que abra su ficha: se buscan por el código (→ [[EQU-1|Encontrar un equipo]]).',
      },
    ],
    comprobacion: [
      'La app instalada se abre desde su icono, sin la barra del navegador.',
      'Al leer una etiqueta se abre la ventana de la tabla, con el equipo, la caja, el armario o el contenedor de esa etiqueta.',
    ],
    problemas: [
      ['Al acercar el móvil no pasa nada', 'el NFC está desactivado, el móvil no tiene NFC o la antena está en otra zona del móvil (probar moviéndolo despacio por la parte de atrás). Si no hay manera, leer el QR con la cámara.'],
      ['Se abre la pantalla de entrada', 'no había sesión. Entrar; la app hace después lo que pedía la etiqueta.'],
      ['Cabina o vitrina con la cuenta del grupo', 'la app distingue por cuenta, no por persona. Si otra persona del grupo lee la etiqueta mientras el grupo tiene una sesión abierta en ese equipo, se abre el formulario para terminarla. Si no era para terminar, «Cancelar». Que en cada grupo empiece y termine la sesión la misma persona, que es quien sabe lo que se ha hecho en la cabina. Si se ha empezado por error, «Deshacer» durante unos segundos.'],
      ['«No se encontró un contenedor activo…»', 'el contenedor de esa categoría se ha cerrado y no se ha puesto el de recambio. Avisar al profesorado.'],
      ['En el laboratorio 203, la etiqueta de aguas pide elegir la garrafa', 'hay dos (tinciones y equipos); elegir a mano la que corresponde y avisar al profesorado de que esa etiqueta hay que regrabarla.'],
      ['«Esa caja ya no existe en la app»', 'avisar al profesorado.'],
      ['Recargar la página después de leer una etiqueta', 'no repite lo que hizo: no se duplica el registro.'],
    ],
    relacionado: [
      ['Antes', [['EMP-1', 'Entrar en GestionLab']]],
      ['Después', [['USO-1', 'Apuntar un uso de la cabina o de la vitrina'], ['USO-2', 'Apuntar un ciclo de autoclave'], ['MUE-2', 'Usar una muestra'], ['STO-3', 'Llevar material de un sitio a otro'], ['RES-2', 'Echar un residuo y apuntarlo']]],
    ],
  };
  AYUDA_ORDEN_MANUALES.forEach(r => { AYUDA_TAREAS['EMP-6'].versiones[r] = emp6; });
})();

// ── Estado de la página ────────────────────────────────────────────
let _ayudaManual = null;     // rol cuyo manual se está viendo
let _ayudaTarea = null;      // código de la tarea abierta, o null (índice del manual)
let _ayudaPantalla = null;   // si se llegó con «?», la pantalla de origen
let _ayudaPantallaTitulo = '';  // y su título, tomado antes de cambiar de página

function _ayudaRolPropio() {
  const r = getUserRole();
  return AYUDA_MANUALES[r] ? r : 'Alumno';
}

/** Gestor y Administrador ven todos los manuales; los demás, solo el suyo. */
function _ayudaVeTodos() {
  const r = getUserRole();
  return r === 'Gestor' || r === 'Administrador';
}

function _ayudaManualesVisibles() {
  return _ayudaVeTodos() ? AYUDA_ORDEN_MANUALES : [_ayudaRolPropio()];
}

/** Tareas (códigos) de un manual, en su orden. */
function _ayudaTareasDe(rol) {
  return (AYUDA_MANUALES[rol]?.secciones || []).flatMap(s => s.tareas)
    .filter(c => AYUDA_TAREAS[c]?.versiones?.[rol]);
}

function _ayudaEsc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** **negrita** y [[COD|texto]] → enlace a la tarea si está en el manual que se ve. */
function _ayudaTxt(t) {
  return _ayudaEsc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[\[([A-Z]{3}-\d+)\|(.+?)\]\]/g, (_, cod, txt) =>
      _ayudaTareasDe(_ayudaManual).includes(cod)
        ? `<a href="#" onclick="abrirTareaAyuda('${cod}');return false">${txt}</a>`
        : `<em>${txt}</em>`);
}

function _ayudaLista(items, numerada) {
  const tag = numerada ? 'ol' : 'ul';
  return `<${tag} class="ayuda-lista">${items.map(i => `<li>${_ayudaTxt(i)}</li>`).join('')}</${tag}>`;
}

function _ayudaImg(img, alt) {
  const src = _AYUDA_IMG + img;
  return `<a class="ayuda-captura" href="${src}" target="_blank" rel="noopener" title="Abrir la imagen a tamaño completo">
    <img src="${src}" alt="${_ayudaEsc(alt)}" loading="lazy"></a>`;
}


// ── Render ─────────────────────────────────────────────────────────
function renderAyuda() {
  const cont = document.getElementById('page-ayuda');
  if (!cont) return;
  const visibles = _ayudaManualesVisibles();
  if (!_ayudaManual || !visibles.includes(_ayudaManual)) _ayudaManual = _ayudaRolPropio();
  if (_ayudaTarea && !AYUDA_TAREAS[_ayudaTarea]?.versiones?.[_ayudaManual]) _ayudaTarea = null;

  const selector = visibles.length > 1 ? `
    <label class="ayuda-selector">Ver el manual de
      <select onchange="_ayudaCambiarManual(this.value)">
        ${visibles.map(r => `<option value="${r}" ${r === _ayudaManual ? 'selected' : ''}>${_ayudaEsc(AYUDA_MANUALES[r].titulo.replace(/^Manual (del |de la |de )/, '').replace(/^./, c => c.toUpperCase()))}${r === _ayudaRolPropio() ? ' (el tuyo)' : ''}</option>`).join('')}
      </select>
    </label>` : '';

  cont.innerHTML = `<div class="ayuda">${selector}${_ayudaTarea ? _ayudaHtmlTarea(_ayudaTarea) : _ayudaHtmlIndice()}</div>`;
}

function _ayudaHtmlIndice() {
  const man = AYUDA_MANUALES[_ayudaManual];
  const codigos = _ayudaTareasDe(_ayudaManual);
  let filtro = '';
  let lista = codigos;
  if (_ayudaPantalla) {
    lista = codigos.filter(c => AYUDA_TAREAS[c].pantallas.includes(_ayudaPantalla));
    filtro = `<div class="ayuda-filtro">Tareas que pasan por «${_ayudaEsc(_ayudaPantallaTitulo || _ayudaPantalla)}»
      · <a href="#" onclick="_ayudaQuitarFiltro();return false">ver el manual entero</a></div>`;
  }
  const secciones = (man.secciones || []).map(s => {
    const t = s.tareas.filter(c => lista.includes(c));
    if (!t.length) return '';
    return `<div class="ayuda-seccion"><div class="ayuda-seccion-titulo">${_ayudaEsc(s.titulo)}</div>
      ${t.map(c => `<a href="#" class="ayuda-tarea-enlace" onclick="abrirTareaAyuda('${c}');return false">
        ${_ayudaEsc(AYUDA_TAREAS[c].versiones[_ayudaManual].titulo)}<span>›</span></a>`).join('')}</div>`;
  }).join('');
  const vacio = !codigos.length
    ? `<p class="ayuda-vacio">Este manual todavía está en preparación.${_ayudaVeTodos() ? ' Mientras, puedes ver el manual del alumnado en «Ver el manual de».' : ''}</p>`
    : (!lista.length ? `<p class="ayuda-vacio">Todavía no hay tareas de esta pantalla en este manual.</p>` : '');
  return `<div class="card ayuda-card">
    <h2 class="ayuda-h1">📘 ${_ayudaEsc(man.titulo)}</h2>
    ${man.intro ? `<p class="ayuda-intro">${_ayudaEsc(man.intro)}</p>` : ''}
    ${filtro}${secciones}${vacio}
  </div>`;
}

function _ayudaHtmlTarea(cod) {
  const v = AYUDA_TAREAS[cod].versiones[_ayudaManual];
  const bloque = (titulo, html) => html ? `<section class="ayuda-bloque"><h3>${titulo}</h3>${html}</section>` : '';
  const pasos = `<ol class="ayuda-pasos">${v.pasos.map(p => `<li>
      <div>${_ayudaTxt(p.texto)}</div>
      ${(p.lista || []).length ? _ayudaLista(p.lista) : ''}
      ${p.nota ? `<div class="ayuda-nota">${_ayudaTxt(p.nota)}</div>` : ''}
      ${p.img ? _ayudaImg(p.img, p.alt) : ''}
      ${(p.imgs || []).length ? `<div class="ayuda-galeria">${p.imgs.map(i => `<figure>${_ayudaImg(i.img, i.alt)}<figcaption>${_ayudaTxt(i.pie)}</figcaption></figure>`).join('')}</div>` : ''}
    </li>`).join('')}</ol>`;
  // Bloques extra del guion: una lista (items) o una tabla (tabla: { cabeceras, filas }),
  // con una nota opcional debajo.
  const tabla = t => `<div class="ayuda-tabla-wrap"><table class="ayuda-tabla"><thead><tr>${t.cabeceras.map(c => `<th>${_ayudaEsc(c)}</th>`).join('')}</tr></thead>
    <tbody>${t.filas.map(f => `<tr>${f.map(c => `<td>${_ayudaTxt(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  // `extrasAntes` va después de «Cuándo» (p. ej. «Qué se apunta» de STO-2); `extrasTrasAntes`,
  // después de «Antes de empezar» («Normas que no cambian» de RES-1); `extras`, tras los pasos.
  const extrasDe = lista => (lista || []).map(x => bloque(_ayudaEsc(x.titulo),
    (x.intro ? `<p class="ayuda-p">${_ayudaTxt(x.intro)}</p>` : '') +
    (x.tabla ? tabla(x.tabla) : _ayudaLista(x.items, x.numerada)) +
    (x.nota ? `<p class="ayuda-p">${_ayudaTxt(x.nota)}</p>` : ''))).join('');
  const extras = extrasDe(v.extras);
  const problemas = (v.problemas || []).length ? `<ul class="ayuda-lista">${v.problemas.map(([q, r]) =>
    `<li><strong>${_ayudaTxt(q)}</strong>: ${_ayudaTxt(r)}</li>`).join('')}</ul>` : '';
  const relacionado = (v.relacionado || []).length ? `<ul class="ayuda-lista ayuda-relacionado">${v.relacionado.map(([etq, refs]) =>
    `<li><span>${_ayudaEsc(etq)}:</span> ${refs.map(([c, t]) => _ayudaTxt(`[[${c}|${t}]]`)).join(' · ')}</li>`).join('')}</ul>` : '';
  const volver = _ayudaPantalla
    ? `<a href="#" onclick="_ayudaVolverIndice();return false">← Tareas de esta pantalla</a>`
    : `<a href="#" onclick="_ayudaVolverIndice();return false">← ${_ayudaEsc(AYUDA_MANUALES[_ayudaManual].titulo)}</a>`;
  return `<div class="ayuda-volver">${volver}</div>
    <article class="card ayuda-card ayuda-articulo">
      <h2 class="ayuda-h1">${_ayudaEsc(v.titulo)}</h2>
      ${bloque('Quién', _ayudaLista(v.quien))}
      ${bloque('Cuándo', _ayudaLista(v.cuando))}
      ${extrasDe(v.extrasAntes)}
      ${bloque('Antes de empezar', _ayudaLista(v.antes))}
      ${extrasDe(v.extrasTrasAntes)}
      ${bloque('Pasos', pasos)}
      ${extras}
      ${bloque('Comprobación', _ayudaLista(v.comprobacion) + (v.comprobacionImg ? _ayudaImg(v.comprobacionImg.img, v.comprobacionImg.alt) : ''))}
      ${bloque('Si algo no sale', problemas)}
      ${bloque('Relacionado', relacionado)}
    </article>`;
}

// ── Navegación ─────────────────────────────────────────────────────
function abrirTareaAyuda(cod) {
  if (!AYUDA_TAREAS[cod]?.versiones?.[_ayudaManual]) return;
  _ayudaTarea = cod;
  renderAyuda();
  document.querySelector('.main')?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

function _ayudaVolverIndice() {
  _ayudaTarea = null;
  renderAyuda();
  window.scrollTo(0, 0);
}

function _ayudaQuitarFiltro() {
  _ayudaPantalla = null;
  _ayudaTarea = null;
  renderAyuda();
}

function _ayudaCambiarManual(rol) {
  _ayudaManual = rol;
  _ayudaTarea = null;
  renderAyuda();
}

/** Entrada por el menú lateral: el manual propio, desde el principio. */
function _ayudaAlEntrarPorMenu() {
  _ayudaPantalla = null;
  _ayudaTarea = null;
  _ayudaManual = _ayudaRolPropio();
}

/** Botón «?» de la barra superior: tareas del manual propio que pasan por la pantalla
 *  actual. Si hay una sola, se abre directamente. */
function abrirAyudaPantalla() {
  const actual = document.querySelector('.page.active')?.id.replace(/^page-/, '');
  if (actual === 'ayuda') return;
  _ayudaManual = _ayudaRolPropio();
  _ayudaPantalla = actual || null;
  _ayudaPantallaTitulo = document.getElementById('page-title')?.textContent || '';
  const deEsta = _ayudaTareasDe(_ayudaManual).filter(c => AYUDA_TAREAS[c].pantallas.includes(actual));
  _ayudaTarea = deEsta.length === 1 ? deEsta[0] : null;
  showPage('ayuda', { desdeBotonAyuda: true });
}
