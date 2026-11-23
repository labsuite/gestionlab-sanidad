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
      { titulo: 'Cuando toca mantenimiento', tareas: ['MAN-2'] },
    ],
  },
  // EMP-6 es común a todos los roles (misma versión en todos los manuales).
  Profesor: { titulo: 'Manual del profesorado', intro: '', secciones: [{ titulo: 'Al llegar', tareas: ['EMP-6'] }] },
  Gestor: { titulo: 'Manual de gestión', intro: '', secciones: [{ titulo: 'Al llegar', tareas: ['EMP-6'] }] },
  Administrador: { titulo: 'Manual de administración', intro: '', secciones: [{ titulo: 'Al llegar', tareas: ['EMP-6'] }] },
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
          '**El material que piden los pasos**, reunido antes de empezar. Por ejemplo, el termómetro de referencia (TER-01 a TER-04) y el tacómetro (TAC-01), que están en la zona común (205-ZC).',
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
            texto: '**Hacer cada paso en el equipo y marcar su casilla al terminarlo**, no antes ni todos al final: el registro tiene que decir lo que se hizo, y marcar de memoria al final acaba marcando pasos que no se hicieron. Arriba a la derecha, el contador dice cuántos pasos van.',
          },
          {
            texto: '**En las comprobaciones** (los pasos que llevan «Criterio:» debajo): medir, comparar con el criterio y pulsar «✓ Cumple» o «✗ No cumple». Si el criterio lleva números, el paso trae 🧮 y pide lo que marca el equipo y lo que mide el instrumento de referencia: **anotar las dos lecturas completas, tal como salen (todos los decimales, sin redondear)**. En «Pantalla del equipo» va lo que marca la pantalla en ese momento (lo programado, solo si no tiene pantalla), y las dos lecturas se toman a la vez, con el equipo estable (el tiempo que diga el protocolo). La app hace la cuenta y decide sola si cumple; si no cumple, marca ella «✗ No cumple» y escribe las cifras en «¿Qué has visto?». Lo que no se mide con números aparece como «Comprueba tú: …»: mirarlo y pulsar «✓ Cumple» o «✗ No cumple». Si se pulsa el botón equivocado, pulsarlo otra vez lo desmarca.',
            img: 'MAN-2/04-comprobacion-con-calculadora.png',
            alt: 'Comprobación con calculadora: lectura del equipo y del termómetro de referencia, la app dice que cumple y se pulsa Cumple',
          },
          {
            texto: '**Si una comprobación no cumple**, «¿Qué has visto? *» es obligatorio: ver el bloque «Si una comprobación no cumple», más abajo.',
            img: 'MAN-2/05-no-cumple.png',
            alt: 'Comprobación marcada como No cumple con lo que se ha visto escrito',
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
            texto: '**Pulsar «Finalizar».** Si queda un paso sin marcar, la app pide confirmación («Quedan … paso(s) sin marcar»): confirmar solo si ese paso no aplica a este equipo y está explicado en Observaciones. Al terminar sale «Registrado. Queda a la espera del visto bueno del profesorado.»',
          },
          {
            texto: '**Si alguna comprobación no cumplía, se abre «Notificar aviso»** con la descripción ya rellenada. Elegir en «¿Se puede seguir usando el equipo?» si se puede seguir usando y pulsar «Enviar aviso». El aviso aparece en GestionLab al profesorado responsable del equipo y a quien abra el equipo; no se manda ningún correo.',
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
              '**En el aviso de avería, elegir con criterio si se puede seguir usando**: si los resultados del equipo dejan de ser fiables (una balanza que pesa mal, una estufa fuera de temperatura), elegir «No funciona». Un equipo que mide mal no sirve aunque encienda.',
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
          ['El mantenimiento no está en la lista', 'puede que todavía no toque (solo salen los que ya han vencido), que otro grupo ya lo haya finalizado (está esperando el visto bueno) o que el profesorado lo haya marcado como «no aplica» o lo haya aplazado.'],
          ['La tarjeta del equipo no enseña su plan de mantenimiento', 'el equipo no está en un laboratorio de tu grupo: cada grupo ve y registra los mantenimientos de los equipos de sus laboratorios y de la zona común. Los de los demás los hace otro grupo o el profesorado.'],
          ['La tarjeta del equipo enseña un aviso abierto («🚫 No funciona», por ejemplo)', 'léelo y pregunta al profesorado antes de empezar.'],
          ['Estaba empezado', '«Continuar n/m» y seguir desde donde se dejó.'],
          ['Se ha marcado un paso por error', 'desmarcarlo antes de finalizar. Si ya está finalizado, decírselo al profesorado, que puede devolverlo para corregirlo.'],
          ['Un paso no se puede hacer (falta material, el equipo no tiene esa pieza)', 'no marcarlo, explicarlo en Observaciones y avisar al profesorado. Si falta material, guardar el progreso y terminar otro día.'],
          ['Al guardar sale «Tu sesión ha caducado»', 'volver a entrar ([[EMP-2|La app no guarda lo que apuntas (sesión caducada)]]) y comprobar qué quedó guardado.'],
          ['En el móvil, «Registrar» queda fuera de la pantalla en «Pendientes»', 'desplazar la tabla hacia la izquierda, o entrar por la tarjeta del equipo.'],
        ],
        relacionado: [
          ['Antes', [['EQU-1', 'Encontrar un equipo'], ['MAN-1', 'Ver qué mantenimientos tocan'], ['EQU-2', 'Consultar cómo se usa un equipo']]],
          ['Después', [['INC-1', 'Avisar de una avería']]],
          ['Si falla la app', [['EMP-2', 'La app no guarda lo que apuntas (sesión caducada)']]],
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
            texto: '**Qué se ve al entrar.** Arriba del «Panel principal», cuatro cifras: «Preventivos pendientes» son los mantenimientos que tu grupo puede hacer ahora (los de los equipos de vuestros laboratorios y de la zona común); «Incidencias abiertas», «Items bajo mínimo» y «Residuos por clasificar» son de todo el centro. Debajo salen los avisos, por ejemplo los mantenimientos que tocan, y el botón «Registrar consumo de material».',
            img: 'EMP-1/02-panel-principal.png',
            alt: 'Panel principal de una cuenta de grupo con las cuatro cifras señaladas y la lista de mantenimientos pendientes',
          },
          {
            texto: '**Las secciones del grupo están en el menú** (en el móvil, se abre con «☰», arriba a la izquierda): «Panel principal»; «Equipos» (Inventario y Mantenimiento); «Material fungible» (Inventario); «Uso del laboratorio» (Reservas, Registros de uso y Muestras congeladas); «Residuos» (Guía de residuos y Contenedores); «Catálogo» (Ubicaciones); y «Mi cuenta» («Mi perfil» y «Ayuda»).',
            img: 'EMP-1/03-menu.png',
            alt: 'Menú lateral abierto en el móvil con las secciones de una cuenta de grupo',
          },
          {
            texto: '**Comprobar con qué cuenta se ha entrado** antes de registrar nada: al pie del menú salen el nombre del grupo y «Alumno» (también en «Mi cuenta › Mi perfil»). En un ordenador compartido puede seguir abierta la sesión del grupo anterior, y todo lo que se registre saldría a su nombre.',
            nota: 'En el móvil, el pie del menú queda debajo de «Ayuda»: hay que bajar dentro del menú para verlo.',
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
              '**Material**: [[STO-1|encontrarlo]], [[STO-2|apuntar lo que se gasta]] (de vuestros laboratorios y de la zona común) y [[STO-3|llevarlo de un sitio a otro]].',
              '**Residuos**: [[RES-1|consultar la Guía de residuos]] y [[RES-2|apuntar lo que se echa en cada contenedor]].',
              '**Mantenimiento**: [[MAN-2|hacer los mantenimientos internos]] que no están reservados al profesorado, de los equipos de vuestros laboratorios y de la zona común.',
              '**Averías**: [[INC-1|avisar de que un equipo falla]].',
              '**Inventario**, cuando lo pide el profesorado: [[INV-1|ubicar equipos]], [[INV-2|contar el stock de un sitio]] (si el grupo tiene permiso, y solo en vuestros laboratorios y la zona común) e [[INV-3|inventariar material que no está en la app]].',
            ],
          },
          {
            titulo: 'Qué necesita el visto bueno del profesorado',
            items: [
              'Los mantenimientos que finaliza el grupo.',
              'En el inventario: las ubicaciones de equipos que propone el grupo (salvo que otro grupo haya propuesto exactamente lo mismo para ese equipo: entonces se aplica sin esperar), los recuentos de stock y el material nuevo inventariado.',
              'Las reservas, solo si coinciden con otra: entonces las decide Gestión.',
            ],
            nota: 'Hasta que llega el visto bueno, lo registrado no cuenta como hecho, pero tampoco hay que repetirlo.',
          },
          {
            titulo: 'Lo que no hace el grupo (y a quién pedirlo)',
            items: [
              'Guardar muestras nuevas en el congelador, descartar tubos o cajas, cerrar un contenedor lleno, pedir material o compras: al profesorado.',
              'Apuntar en un contenedor un residuo que la comprobación de la app no admite, o cuando la app no puede comprobarlo: no se apunta; llamar al profesorado.',
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
          ['La app vuelve sola a la pantalla de entrada, o sale «Tu sesión ha caducado»', 'volver a entrar (→ [[EMP-2|La app no guarda lo que apuntas (sesión caducada)]]).'],
          ['No aparece una sección que esperabais', 'el grupo no la tiene; mirar «Qué puede hacer tu grupo» y «Lo que no hace el grupo».'],
        ],
        relacionado: [
          ['Después', [['EMP-6', 'Usar GestionLab en el móvil'], ['EQU-1', 'Encontrar un equipo']]],
          ['Si falla la app', [['EMP-2', 'La app no guarda lo que apuntas (sesión caducada)']]],
        ],
      },
    },
  },

  // ── EMP-6 · común a todos los roles (guion «EMP-6_movil-y-etiquetas.md», 23/11/2026) ──
  'EMP-6': {
    pantallas: ['registros-uso', 'congelados', 'material', 'residuos-contenedores', 'perfil'],
    versiones: {},   // la misma versión en los cuatro manuales: se rellena justo debajo
  },
};

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
          { img: 'EMP-6/02-autoclave-registro.png', alt: 'Ventana Registrar ciclo del autoclave con el equipo ya elegido', pie: 'Autoclave: «Registrar ciclo», con el autoclave ya elegido.' },
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
            ['Autoclave', 'El registro del ciclo, con el autoclave ya elegido', '[[USO-2|Apuntar un ciclo de autoclave]]'],
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
      ['Cabina o vitrina con la cuenta del grupo', 'la app distingue por cuenta, no por persona. Si otra persona del grupo lee la etiqueta mientras el grupo tiene una sesión abierta en ese equipo, se abre el formulario para **terminar** esa sesión (si no se quería, «Cancelar»). Que en cada grupo empiece y termine la sesión la misma persona. Si se ha empezado por error, «Deshacer» durante unos segundos.'],
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
      ${p.nota ? `<div class="ayuda-nota">${_ayudaTxt(p.nota)}</div>` : ''}
      ${p.img ? _ayudaImg(p.img, p.alt) : ''}
      ${(p.imgs || []).length ? `<div class="ayuda-galeria">${p.imgs.map(i => `<figure>${_ayudaImg(i.img, i.alt)}<figcaption>${_ayudaTxt(i.pie)}</figcaption></figure>`).join('')}</div>` : ''}
    </li>`).join('')}</ol>`;
  // Bloques extra del guion: una lista (items) o una tabla (tabla: { cabeceras, filas }),
  // con una nota opcional debajo.
  const tabla = t => `<div class="ayuda-tabla-wrap"><table class="ayuda-tabla"><thead><tr>${t.cabeceras.map(c => `<th>${_ayudaEsc(c)}</th>`).join('')}</tr></thead>
    <tbody>${t.filas.map(f => `<tr>${f.map(c => `<td>${_ayudaTxt(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const extras = (v.extras || []).map(x => bloque(_ayudaEsc(x.titulo),
    (x.intro ? `<p class="ayuda-p">${_ayudaTxt(x.intro)}</p>` : '') +
    (x.tabla ? tabla(x.tabla) : _ayudaLista(x.items, x.numerada)) +
    (x.nota ? `<p class="ayuda-p">${_ayudaTxt(x.nota)}</p>` : ''))).join('');
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
      ${bloque('Antes de empezar', _ayudaLista(v.antes))}
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
