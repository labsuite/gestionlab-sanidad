// ============================================================
// MANTENIMIENTO PREVENTIVO
// ============================================================

// --- Curso académico ---
function getCursoAcademico(date = new Date()) {
  const mes = date.getMonth() + 1;
  const año = date.getFullYear();
  return mes >= 9 ? `${año}-${año + 1}` : `${año - 1}-${año}`;
}

function getMesesCurso(cursoAcademico) {
  const [añoInicio, añoFin] = cursoAcademico.split('-').map(Number);
  const meses = [];
  for (let m = 9; m <= 12; m++)
    meses.push({ año: añoInicio, mes: m, str: `${añoInicio}-${String(m).padStart(2, '0')}` });
  for (let m = 1; m <= 6; m++)
    meses.push({ año: añoFin, mes: m, str: `${añoFin}-${String(m).padStart(2, '0')}` });
  return meses; // 10 meses: Sep–Jun
}

// --- Evaluaciones: la temporada de un equipo (desde 2026-10-26) ---
// Cada equipo marca en qué evaluaciones se usa (Evaluaciones_Uso: "1,3"; vacío =
// todo el curso) y cada curso guarda las fechas de sus tres evaluaciones
// (DATA.evaluacionesCurso). De ahí salen los vencimientos:
//   Pretemporada (revisión de arranque) → inicio de la primera evaluación en que se usa
//   Posttemporada (revisión de cierre)  → fin de la última; se pide desde
//                                          _DIAS_AVISO_CIERRE días antes
//   Trimestral                          → inicio de cada evaluación en que se usa
// Mes_Inicio/Fin_Temporada ya no cuentan. Si el curso no tiene fechas guardadas se
// usan unas aproximadas (sep–dic, ene–mar, abr–jun) y el panel lo avisa.
const _DIAS_AVISO_CIERRE = 14;

function _fechaLocal(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function evaluacionesDelCurso(curso) {
  const guardadas = (DATA.evaluacionesCurso || []).filter(e => e.Curso_Academico === curso);
  if (guardadas.length === 3) {
    return guardadas.slice().sort((a, b) => a.Numero - b.Numero).map(e => ({
      numero: e.Numero, inicio: _fechaLocal(e.Fecha_Inicio), fin: _fechaLocal(e.Fecha_Fin), configurada: true,
    }));
  }
  const [añoInicio, añoFin] = curso.split('-').map(Number);
  return [
    { numero: 1, inicio: new Date(añoInicio, 8, 1), fin: new Date(añoInicio, 11, 31), configurada: false },
    { numero: 2, inicio: new Date(añoFin, 0, 1),    fin: new Date(añoFin, 2, 31),     configurada: false },
    { numero: 3, inicio: new Date(añoFin, 3, 1),    fin: new Date(añoFin, 5, 30),     configurada: false },
  ];
}

// Evaluaciones en que se usa el equipo: [1, 2, 3] si no tiene ninguna marcada.
function evaluacionesUsoEquipo(equipo) {
  const n = String(equipo?.Evaluaciones_Uso || '').split(',')
    .map(x => parseInt(x, 10)).filter(x => [1, 2, 3].includes(x));
  return n.length ? [...new Set(n)].sort() : [1, 2, 3];
}

function textoEvaluacionesUso(equipo) {
  const usadas = evaluacionesUsoEquipo(equipo);
  if (usadas.length === 3) return 'Todo el curso';
  return usadas.map(n => `${n}ª`).join(', ').replace(/, ([^,]*)$/, ' y $1') + (usadas.length > 1 ? ' evaluaciones' : ' evaluación');
}

// Periodos de un plan que depende de las evaluaciones (Pretemporada, Posttemporada,
// Trimestral), con su fecha prevista y desde cuándo se pide. [] para el resto.
function periodosPorEvaluacion(plan, equipo, curso) {
  const usadas = evaluacionesUsoEquipo(equipo);
  const evals = evaluacionesDelCurso(curso).filter(e => usadas.includes(e.numero));
  if (!evals.length) return [];
  switch (plan.Periodicidad) {
    case 'Pretemporada':
      return [{ periodo: `pretemporada-${curso}`, fecha: evals[0].inicio, desde: evals[0].inicio }];
    case 'Posttemporada': {
      const ultima = evals[evals.length - 1];
      const desde = new Date(ultima.fin);
      desde.setDate(desde.getDate() - _DIAS_AVISO_CIERRE);
      return [{ periodo: `posttemporada-${curso}`, fecha: ultima.fin, desde }];
    }
    case 'Trimestral':
      return evals.map(e => ({ periodo: `evaluacion${e.numero}-${curso}`, fecha: e.inicio, desde: e.inicio }));
    default:
      return [];
  }
}
const _PERIODICIDADES_POR_EVALUACION = ['Pretemporada', 'Posttemporada', 'Trimestral'];

// Normaliza Solo_Profesorado: acepta 'Sí', '1', '1.0', 'TRUE', 'Yes'
function _esSoloProfesorado(plan) {
  const v = (plan.Solo_Profesorado || '').toString().trim();
  return v === 'Sí' || v === '1' || v === '1.0' || v === 'TRUE' || v === 'Yes';
}

// Quién puede ejecutar un plan: los mantenimientos INTERNOS los hace el alumnado
// (el profesorado supervisa y firma), salvo los marcados "solo profesorado". Los
// EXTERNOS son siempre del profesorado: los hace una empresa y los registra un docente.
function planAbiertoAlumnado(plan) {
  return plan.Tipo_Intervencion !== 'Externo' && !_esSoloProfesorado(plan);
}

/** Planes que ve y registra una cuenta de grupo: los abiertos al alumnado de los equipos de
 *  sus laboratorios y de la zona común (equipoAlAlcanceDelAlumno, js/config.js). */
function planDelAlumnado(plan) {
  if (!planAbiertoAlumnado(plan)) return false;
  return equipoAlAlcanceDelAlumno(DATA.equipos.find(e => e.ID_Activo === plan.ID_Equipo));
}

// Devuelve true si la operación es de limpieza/conservación (→ fin de periodo)
// y false si es calibración/verificación/puesta en marcha (→ inicio de periodo)
function _esMomentoFin(plan) {
  const op = (plan.Operacion || '').toLowerCase().trim();
  return op.startsWith('limpieza') ||
         op.startsWith('vaciado') ||
         op.startsWith('descongelaci') ||
         op.startsWith('cambio de agua') ||
         op.startsWith('inspecci') && op.includes('limpieza');
}

// Curso académico ("2025-2026") → año de inicio numérico, para comparar ciclos multianuales
function _añoInicioCurso(cursoAcademico) {
  return parseInt(cursoAcademico.split('-')[0], 10);
}

// Nº de cursos que debe esperar cada periodicidad multianual antes de volver a pedirse
// Quinquenal (2026-11-25): calibraciones externas cada 5 años (p. ej. las micropipetas).
const _CICLO_ANIOS = { 'Bianual': 2, 'Cada 2 años': 2, 'Trianual': 3, 'Quinquenal': 5 };

// Para Bianual/Trianual: solo "debido" cuando han pasado N cursos desde el último
// registro real de este plan. Si nunca se ha realizado, se sigue pidiendo cada curso
// (para no perder el aviso a la espera de que alguien lo confirme la primera vez).
function _esCursoDebidoMultianual(plan, cursoAcademico) {
  const n = _CICLO_ANIOS[plan.Periodicidad];
  if (!n) return true; // Anual u otra: sin restricción de ciclo
  const cursosRealizados = DATA.registroMantenimientos
    .filter(r => r.ID_Plan === plan.ID_Plan && r.Estado === 'finalizado')
    .map(r => _añoInicioCurso(r.Curso_Academico));
  if (!cursosRealizados.length) return true;
  const ultimoAño = Math.max(...cursosRealizados);
  return _añoInicioCurso(cursoAcademico) - ultimoAño >= n;
}

function getPeriodosEsperados(plan, equipo, cursoAcademico) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const mesesBase = getMesesCurso(cursoAcademico);
  const mesesPasados = mesesBase.filter(({ año, mes }) => new Date(año, mes - 1, 1) <= hoy);

  switch (plan.Periodicidad) {
    case 'Mensual':
      return mesesPasados.map(m => m.str);
    // Arranque, cierre y trimestrales siguen las evaluaciones en que se usa el equipo.
    case 'Trimestral':
    case 'Pretemporada':
    case 'Posttemporada':
      return periodosPorEvaluacion(plan, equipo, cursoAcademico)
        .filter(p => hoy >= p.desde).map(p => p.periodo);
    case 'Semestral': {
      const idx = _esMomentoFin(plan) ? [4, 9] : [0, 5];
      return mesesPasados.filter((_, i) => idx.includes(i)).map(m => m.str);
    }
    case 'Anual':
    case 'Bianual':
    case 'Trianual':
    case 'Quinquenal':
    case 'Cada 2 años': {
      if (!_esCursoDebidoMultianual(plan, cursoAcademico)) return [];
      const mes = _esMomentoFin(plan) ? mesesBase[mesesBase.length - 1] : mesesBase[0];
      return mesesPasados.some(m => m.str === mes.str) ? [mes.str] : [];
    }
    default:
      return [];
  }
}

// Registro FINALIZADO (mantenimiento dado por hecho). Las ejecuciones a medias
// (estado 'en_curso') y los marcadores 'no_aplica'/'aplazado' NO cuentan aquí.
function getRegistroMant(idPlan, cursoAcademico, periodo) {
  return DATA.registroMantenimientos.find(r =>
    r.ID_Plan === idPlan && r.Curso_Academico === cursoAcademico &&
    r.Periodo === periodo && r.Estado === 'finalizado'
  );
}

// Ejecución a medias (checklist guardado sin finalizar) de este mantenimiento, si la hay.
function getEjecucionMant(idPlan, cursoAcademico, periodo) {
  return DATA.registroMantenimientos.find(r =>
    r.ID_Plan === idPlan && r.Curso_Academico === cursoAcademico &&
    r.Periodo === periodo && r.Estado === 'en_curso'
  );
}

// Registrado por alumnado y a la espera de que un docente lo firme. Ya está HECHO
// (nadie tiene que repetirlo), pero no cuenta como finalizado: el Excel del modelo de
// calidad solo vuelca 'finalizado', porque ahí la firma del supervisor es lo que vale.
function getRegistroPendienteVb(idPlan, cursoAcademico, periodo) {
  return DATA.registroMantenimientos.find(r =>
    r.ID_Plan === idPlan && r.Curso_Academico === cursoAcademico &&
    r.Periodo === periodo && r.Estado === 'pendiente_vb'
  );
}

// Marcador "no aplica" / "aplazado" de un periodo concreto (no es un registro
// realizado: solo deja constancia con motivo de por qué no se hizo o se pospuso).
function getMarcadorMant(idPlan, cursoAcademico, periodo) {
  return DATA.registroMantenimientos.find(r =>
    r.ID_Plan === idPlan && r.Curso_Academico === cursoAcademico &&
    r.Periodo === periodo && (r.Estado === 'no_aplica' || r.Estado === 'aplazado')
  );
}

// Un aplazamiento "vence" cuando llega el mes destino: el periodo vuelve a pendiente.
function _aplazamientoVencido(marcador) {
  if (!marcador || marcador.Estado !== 'aplazado') return true;
  if (!marcador.Aplazado_A) return true;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return new Date(marcador.Aplazado_A) <= hoy;
}

// Estado consolidado de un periodo programado:
//  'finalizado' | 'pendiente_vb' | 'en_curso' | 'no_aplica'
//  | 'aplazado_futuro'  (oculto hasta que llegue su mes destino)
//  | 'aplazado_vencido' (el mes destino ya llegó → vuelve a pendiente)
//  | 'pendiente'
function estadoPeriodoMant(idPlan, curso, periodo) {
  const reg = getRegistroMant(idPlan, curso, periodo);
  if (reg) return { tipo: 'finalizado', registro: reg };
  const regVb = getRegistroPendienteVb(idPlan, curso, periodo);
  if (regVb) return { tipo: 'pendiente_vb', registro: regVb };
  const marc = getMarcadorMant(idPlan, curso, periodo);
  if (marc) {
    if (marc.Estado === 'no_aplica') return { tipo: 'no_aplica', marcador: marc };
    return _aplazamientoVencido(marc)
      ? { tipo: 'aplazado_vencido', marcador: marc }
      : { tipo: 'aplazado_futuro', marcador: marc };
  }
  const eje = getEjecucionMant(idPlan, curso, periodo);
  if (eje) return { tipo: 'en_curso', ejecucion: eje };
  return { tipo: 'pendiente' };
}

// "Marzo de 2026" a partir de una fecha YYYY-MM-DD (para etiquetas de aplazamiento).
function labelMesAnyo(fechaIso) {
  if (!fechaIso) return '—';
  try {
    return new Date(fechaIso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  } catch { return fechaIso; }
}

// Convierte el texto de "Instrucciones" del plan (una línea = un paso) en items de
// checklist. Si el plan no tiene instrucciones, un único paso con el texto de la operación.
function _pasosDesdePlan(plan) {
  const lineas = (plan.Instrucciones || '').split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean);
  const textos = lineas.length ? lineas : [(plan.Operacion || 'Mantenimiento').trim()];
  return textos.map(t => _normPasoMant({ texto: t, hecho: false }, true));
}

// Un paso que acaba en "(criterio: …)" —así vienen de los protocolos— es una COMPROBACIÓN:
// no se marca como hecha, se resuelve con «Cumple» / «No cumple» (y en ese caso, qué se vio).
const _RE_CRITERIO = /\s*\(\s*criterio\s*:\s*(.*)\)\s*$/i;   // el criterio puede llevar paréntesis dentro

// ── Tipos de paso (2026-11-25) ─────────────────────────────────────────────
// El preventivo VERIFICA (decisión de Paloma): cada paso es
//   'comprobar' → ✓ / ⚠ / No aplica, y si sale mal, qué se hizo (ver _mantAccionPaso);
//   'hacer'     → casilla (limpiar, etiquetar, guardar…);
//   'sustituir' → sustitución PROGRAMADA de una pieza (vida útil fija): casilla + pieza puesta,
//                 y queda también como intervención del equipo.
// Los planes no traen el tipo: sale del texto. Un cambio condicional («Cambio de junta si
// procede», «Engrasar si procede») no es una orden: es una comprobación de si hacía falta.
const _RE_PASO_CONDICIONAL = /\bsi procede\b|\bsi (?:est[aá]n?|hay|no|falla|lo|la|se|es|tiene|pendiente)\b|\bsi [<>≤≥]|\bseg[uú]n uso\b|\bo antes\b/i;
const _RE_PASO_ACCION_COND = /^(?:sustitu|cambi|reemplaz|renov|engras|lubric|descalcific|ajust|recalibr)/i;
const _RE_PASO_SUSTITUIR = /^(?:sustitu|cambi(?:ar|o)\b|reemplaz|renovar)/i;
// Cambiar el agua o la parafina es una tarea del mantenimiento, no una pieza.
const _RE_PASO_FLUIDO = /\b(?:agua|parafina|aceite|medio|soluci[oó]n|disoluci[oó]n|gel|tamp[oó]n|alcohol|lej[ií]a|desecante)\b/i;
const _RE_PASO_COMPROBAR = /^(?:revis|comprob|verific|inspecc|control|observ|examin|mirar|vigil|contrast)/i;

function _tipoPasoDesdeTexto(texto, criterio) {
  const t = String(texto || '').trim();
  // Los pasos de la verificación de una pipeta los marca la app (js/verif-pipetas.js).
  if (typeof vpPasoAuto === 'function' && vpPasoAuto(t)) return criterio ? 'comprobar' : 'hacer';
  if (_RE_PASO_CONDICIONAL.test(t) && _RE_PASO_ACCION_COND.test(t)) return 'comprobar';
  if (_RE_PASO_SUSTITUIR.test(t) && !_RE_PASO_FLUIDO.test(t)) return 'sustituir';
  if (criterio) return 'comprobar';
  if (_RE_PASO_COMPROBAR.test(t)) return 'comprobar';
  return 'hacer';
}

/** Una comprobación escrita como acción condicional («Engrasar si procede»): se contesta
 *  «No hacía falta» / «Hacía falta» en vez de «Correcto» / «Hay que actuar». */
function _pasoEsCondicional(p) {
  return p.tipo === 'comprobar' && !p.criterio && _RE_PASO_CONDICIONAL.test(p.texto) && _RE_PASO_ACCION_COND.test(p.texto);
}

const _TIPOS_INT_PASO = ['Sustitución de pieza', 'Calibración', 'Cambio de consumibles', 'Correctivo'];

/** Normaliza un paso guardado o recién leído del plan (`delPlan`). Los pasos guardados antes
 *  de existir los tipos no lo traen: comprobación si llevan criterio, casilla si no (así se
 *  hicieron). Los guardados antes de existir los criterios llevan el criterio en el texto. */
function _normPasoMant(p, delPlan) {
  let texto = String(p?.texto || '').trim();
  let criterio = p?.criterio ? String(p.criterio).trim() : '';
  if (!criterio) {
    const m = texto.match(_RE_CRITERIO);
    if (m) { criterio = m[1].trim(); texto = texto.replace(_RE_CRITERIO, '').trim(); }
  }
  const tipo = ['comprobar', 'hacer', 'sustituir'].includes(p?.tipo) ? p.tipo
    : delPlan ? _tipoPasoDesdeTexto(texto, criterio)
    : (criterio ? 'comprobar' : 'hacer');
  const base = { texto, tipo, criterio: criterio || null, id_intervencion: p?.id_intervencion || null, auto: !!p?.auto };
  if (tipo === 'hacer') return { ...base, hecho: p?.hecho === true, resultado: null, nota: '', medidas: [] };
  if (tipo === 'sustituir') {
    return { ...base, hecho: p?.hecho === true, resultado: null, nota: '', medidas: [],
      actuacion: String(p?.actuacion || ''),
      // Filtros y tubos de bomba son consumibles; lo demás (tapas, juntas, tubo UV…), piezas.
      tipo_intervencion: _TIPOS_INT_PASO.includes(p?.tipo_intervencion) ? p.tipo_intervencion
        : /\bfiltro|\btubos?\b(?!\s*UV)/i.test(texto) ? 'Cambio de consumibles' : 'Sustitución de pieza' };
  }
  const resultado = ['cumple', 'no_cumple', 'no_aplica'].includes(p?.resultado) ? p.resultado : null;
  const nc = resultado === 'no_cumple';
  return {
    ...base,
    hecho: !!resultado, resultado,
    nota: nc ? String(p?.nota || '') : '',
    accion: nc && ['corregido', 'intervencion', 'reparacion'].includes(p?.accion) ? p.accion : null,
    actuacion: nc ? String(p?.actuacion || '') : '',
    tipo_intervencion: _TIPOS_INT_PASO.includes(p?.tipo_intervencion) ? p.tipo_intervencion : 'Sustitución de pieza',
    // Datos tecleados en la calculadora de criterios (js/criterios-calc.js), uno por regla.
    medidas: criterio && Array.isArray(p?.medidas) ? p.medidas : [],
  };
}

/** Pasos de comprobación que no cumplen su criterio. */
function _pasosNoCumple(pasos) {
  return (Array.isArray(pasos) ? pasos : []).map(p => _normPasoMant(p)).filter(p => p.resultado === 'no_cumple');
}

/** ¿Es un paso de la verificación de una pipeta (lo marca la app)? */
function _pasoAutoMant(p) {
  return !!p?.auto || (typeof vpPasoAuto === 'function' && vpPasoAuto(p?.texto || ''));
}

// Resultado del mantenimiento (columna `resultado`): lo marca quien lo realiza; la app sugiere.
const _RESULTADO_MANT = {
  apto:                    { txt: 'Apto',                    icono: '✓', badge: 'badge-green' },
  apto_tras_intervencion:  { txt: 'Apto tras intervención',  icono: '🔩', badge: 'badge-orange' },
  no_apto:                 { txt: 'No apto',                 icono: '✗', badge: 'badge-red' },
};
function _badgeResultadoMant(res) {
  const r = _RESULTADO_MANT[res];
  return r ? `<span class="badge ${r.badge}" style="font-size:10px;white-space:nowrap">${r.icono} ${r.txt}</span>` : '';
}

// ============================================================
// QUIÉN PUEDE EJECUTAR UN MANTENIMIENTO
// ============================================================
// Los mantenimientos internos los ejecuta el alumnado en cualquier mes del curso;
// el profesorado supervisa (visto bueno) en vez de registrarlos. Solo quedan fuera
// los externos y los planes marcados "solo profesorado". El servidor lo revalida —
// esto es solo la UI.

/** ¿Puede el usuario actual abrir el modal de ejecución de este plan? */
function puedeEjecutarPlanMant(plan) {
  if (getUserRole() === 'Alumno') return planDelAlumnado(plan);
  return puedeHacer('registrarMantenimiento');
}

/** Marcar "no aplica" / aplazar / revertir es decisión de gestión: nunca del alumnado. */
function puedeMarcarPeriodoMant() {
  return puedeHacer('crearIntervenciones');
}

function _upsertRegistroMant(obj) {
  const i = DATA.registroMantenimientos.findIndex(r => r.ID_Registro === obj.ID_Registro);
  if (i >= 0) DATA.registroMantenimientos[i] = obj;
  else DATA.registroMantenimientos.push(obj);
}

function getPlanStatusParaEquipo(equipoId) {
  const equipo = DATA.equipos.find(e => e.ID_Activo === equipoId);
  if (!equipo) return [];
  const curso = getCursoAcademico();
  const planes = DATA.planesMantenimiento.filter(
    p => p.ID_Equipo === equipoId && p.Activo !== 'FALSE'
  );
  const resultado = [];
  for (const plan of planes) {
    const periodos = getPeriodosEsperados(plan, equipo, curso);
    for (const periodo of periodos) {
      const est = estadoPeriodoMant(plan.ID_Plan, curso, periodo);
      // 'no aplica' y aplazamientos aún no vencidos no cuentan como pendientes.
      if (est.tipo === 'no_aplica' || est.tipo === 'aplazado_futuro') continue;
      resultado.push({
        plan, periodo, curso,
        // Lo registrado por alumnado a la espera de firma ya está hecho: no vuelve a
        // pedirse ni cuenta como pendiente (ver estadoPeriodoMant).
        hecho: est.tipo === 'finalizado' || est.tipo === 'pendiente_vb',
        esperaVb: est.tipo === 'pendiente_vb',
        registro: est.registro || null,
        marcador: est.marcador || null,
        aplazadoVencido: est.tipo === 'aplazado_vencido',
      });
    }
  }
  return resultado;
}

function labelPeriodo(periodo) {
  if (!periodo) return '—';
  if (periodo.startsWith('pretemporada')) return 'Revisión de arranque';
  if (periodo.startsWith('posttemporada')) return 'Revisión de cierre';
  const ev = /^evaluacion(\d)-/.exec(periodo);
  if (ev) return `${ev[1]}ª evaluación`;
  const [y, m] = periodo.split('-');
  // Ojo: con una fecha inválida toLocaleDateString NO lanza, devuelve la cadena
  // "Invalid Date" — el try/catch no basta, hay que comprobar el valor.
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  if (isNaN(d.getTime())) return periodo;
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

// ============================================================
// SECCIÓN DE MANTENIMIENTO EN LA TARJETA DEL EQUIPO
// ============================================================
/** Rellena los huecos de protocolo (.proto-pendiente) dentro de `root`: llamar al desplegar. */
function cargarProtocolosPendientes(root) {
  if (!root) return;
  root.querySelectorAll('.proto-pendiente:not([data-pedido])').forEach(el => {
    el.dataset.pedido = '1';
    cargarProtocoloEquipo(decodeURIComponent(el.dataset.protoEquipo))
      .then(md => { el.outerHTML = buildProtocoloUso(md); })
      .catch(err => { delete el.dataset.pedido; el.textContent = '⚠️ ' + (err.message || 'No se pudo cargar el protocolo de uso'); });
  });
}

function buildMantenimientoEquipo(equipoId) {
  const equipo = DATA.equipos.find(e => e.ID_Activo === equipoId);
  if (!equipo) return '';

  // La configuración de planes (alta/edición/borrado) vive ahora solo en la
  // sección Mantenimiento; aquí la tarjeta es informativa + ejecutar.
  // canMarcar: no aplica / aplazar / revertir — gestión, nunca alumnado.
  // canEjecutar se decide por plan más abajo (el alumnado, solo en los que le tocan).
  const canMarcar = puedeHacer('crearIntervenciones') ||
    (getUserRole() === 'Profesor' && esResponsableDeEquipo(equipo));
  const canLog = canMarcar;

  const secciones = [];

  // Protocolo de uso (Markdown → visor plegable con índice y buscador, js/protocolo.js)
  // No llega en la carga general (pesa mucho): si aún no está, se deja un hueco que rellena
  // cargarProtocolosPendientes() al DESPLEGAR la tarjeta. Ojo: renderEquipos construye de
  // antemano la tarjeta de todos los equipos, así que aquí no se puede pedir nada.
  if (equipo.Protocolo_Uso !== undefined) {
    if (equipo.Protocolo_Uso) secciones.push(buildProtocoloUso(equipo.Protocolo_Uso));
  } else if (equipo.Tiene_Protocolo) {
    secciones.push(`<div class="proto-pendiente" data-proto-equipo="${encodeURIComponent(equipoId)}" style="font-size:12px;color:var(--text-muted);padding:8px 0">📖 Cargando el protocolo de uso…</div>`);
  }

  // Micropipetas: fecha y resultado de la última verificación, con el error sistemático y el CV
  // de cada volumen (lo que dice la etiqueta de la pipeta).
  if (typeof ultimaVerificacionPipeta === 'function' && (DATA.verifParametros || []).some(p => p.id_activo === equipoId)) {
    const ult = ultimaVerificacionPipeta(equipoId);
    const c = ult?.Verificacion?.calculo;
    const parV = DATA.verifParametros.find(p => p.id_activo === equipoId);
    const tornillo = parV?.ajuste_respuesta
      ? `<div class="vp-guia">Tornillo de ajuste bajo la tapa del émbolo: <strong>${parV.ajuste_respuesta === 'si' ? 'sí tiene' : 'no tiene'}</strong> (${_vpEsc(parV.ajuste_respuesta_por || '')})</div>` : '';
    secciones.push(`<div class="vp-ficha">🧪 <strong>Última verificación:</strong> ${c
      ? `${formatDate(ult.Fecha_Realizacion)} · ${_vpBadgeResultado(c.resultado)}${ult.Estado === 'pendiente_vb' ? ' <span class="badge badge-orange">⏳ visto bueno</span>' : ''}<div class="vp-guia">${_vpEsc(resumenVerificacion(c))}</div>`
      : '<span style="color:var(--text-muted)">ninguna registrada en GestionLab</span>'}${tornillo}</div>`);
  }

  // Planes de mantenimiento. Una cuenta de grupo solo ve los de los equipos de sus
  // laboratorios y de la zona común (equipoAlAlcanceDelAlumno).
  if (!equipoAlAlcanceDelAlumno(equipo)) return secciones.join('');
  const planes = DATA.planesMantenimiento.filter(p => p.ID_Equipo === equipoId && p.Activo !== 'FALSE');
  if (!planes.length) {
    if (canLog) {
      secciones.push(`
        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Plan de mantenimiento</div>
          <div style="font-size:12px;color:var(--text-muted);padding:8px 0">Sin planes configurados. Se dan de alta en la sección <strong>Mantenimiento → Planes configurados</strong>.</div>
        </div>`);
    }
  } else {
    const curso = getCursoAcademico();
    const statusList = getPlanStatusParaEquipo(equipoId);
    const pendientes = statusList.filter(s => !s.hecho);
    const hechos     = statusList.filter(s => s.hecho);

    secciones.push(`
      <div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">
            Plan de mantenimiento · Curso ${curso}
            <span style="font-weight:400;text-transform:none;margin-left:6px">
              ${hechos.length}/${statusList.length} completados
            </span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${planes.map(plan => {
            const periodos = getPeriodosEsperados(plan, equipo, curso);
            if (!periodos.length) {
              return `<div class="mant-plan-row" style="opacity:.6">
                <span class="badge badge-gray" style="font-size:10px;min-width:80px">${plan.Tipo_Intervencion||'—'}</span>
                <span style="font-size:11px;font-weight:500;flex:1;min-width:0">${plan.Periodicidad}</span>
                <span style="font-size:11px;color:var(--text-muted);flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</span>
                <span class="badge badge-gray" style="font-size:10px">No aplica aún</span>
              </div>`;
            }
            return periodos.map(periodo => {
              const est = estadoPeriodoMant(plan.ID_Plan, curso, periodo);
              const reg = est.registro || null;
              const hecho = est.tipo === 'finalizado';
              const esperaVb = est.tipo === 'pendiente_vb';
              const canEjecutar = canMarcar || puedeEjecutarPlanMant(plan);
              const marc = est.marcador || null;
              const eje = est.ejecucion || null;
              const ejeN = eje && Array.isArray(eje.Pasos) ? eje.Pasos.filter(p => p.hecho).length : 0;
              const ejeTot = eje && Array.isArray(eje.Pasos) ? eje.Pasos.length : 0;
              const argsMarc = `'${plan.ID_Plan}','${equipoId.replace(/'/g,"\\'")}','${periodo}','${curso}'`;
              const abrirEjec = `event.stopPropagation();openModalRegistrarMant(${argsMarc})`;
              const abrirMarc = `event.stopPropagation();openModalMarcarMant(${argsMarc})`;
              const btnMarc = canMarcar
                ? `<button class="btn btn-secondary" style="padding:2px 6px;font-size:11px;white-space:nowrap" title="Opciones: alumnado, no aplica, aplazar" onclick="${abrirMarc}">⋯</button>`
                : '';
              const btnRevert = canMarcar && marc
                ? `<button class="btn btn-secondary" style="padding:2px 6px;font-size:11px;white-space:nowrap" title="Revertir: volver a pendiente" onclick="event.stopPropagation();revertirMarcadorMant('${marc.ID_Registro}')">↩</button>`
                : '';
              let badge;
              if (hecho) {
                badge = `<span class="badge badge-green" style="font-size:10px">✓ ${formatDate(reg.Fecha_Realizacion)||'Hecho'}</span>`;
              } else if (esperaVb) {
                badge = `<span class="badge badge-orange" style="font-size:10px" title="Hecho por ${reg.Realizado_Por||'alumnado'} — falta el visto bueno del profesorado">⏳ Espera visto bueno</span>`
                  + (canMarcar ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;white-space:nowrap" onclick="event.stopPropagation();darVistoBuenoMant('${reg.ID_Registro}')">✓ Firmar</button>` : '');
              } else if (est.tipo === 'no_aplica') {
                badge = `<span class="badge badge-gray" style="font-size:10px" title="${marc.Observaciones||''}">🚫 No aplica</span>${btnRevert}`;
              } else if (est.tipo === 'aplazado_futuro') {
                badge = `<span class="badge badge-gray" style="font-size:10px" title="${marc.Observaciones||''}">📅 Aplazado a ${labelMesAnyo(marc.Aplazado_A)}</span>${btnRevert}`;
              } else if (eje) {
                badge = canEjecutar
                  ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;white-space:nowrap" onclick="${abrirEjec}">Continuar <span style="opacity:.65">${ejeN}/${ejeTot}</span></button>${btnMarc}`
                  : `<span class="badge badge-orange" style="font-size:10px">En curso ${ejeN}/${ejeTot}</span>`;
              } else if (est.tipo === 'aplazado_vencido') {
                badge = canEjecutar
                  ? `<span class="badge badge-orange" style="font-size:10px" title="${marc.Observaciones||''}">📅 Aplazado (previsto ${labelMesAnyo(marc.Aplazado_A)})</span><button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;white-space:nowrap" onclick="${abrirEjec}">Registrar</button>${btnMarc}`
                  : `<span class="badge badge-orange" style="font-size:10px">Pendiente (aplazado)</span>`;
              } else {
                badge = canEjecutar
                  ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;white-space:nowrap" onclick="${abrirEjec}">Registrar</button>${btnMarc}`
                  : `<span class="badge badge-orange" style="font-size:10px">Pendiente</span>`;
              }
              const tipoBadge = plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
              const instrKey = `${plan.ID_Plan}-${periodo}`.replace(/[^a-z0-9]/gi,'_');
              // Si el plan no tiene instrucciones paso a paso, el propio texto de la
              // operación hace de "cómo" — así toda fila pendiente tiene el botón.
              const comoTexto = plan.Instrucciones || plan.Operacion || '';
              const instrBtn = comoTexto
                ? `<button class="btn btn-secondary" style="padding:2px 6px;font-size:11px;white-space:nowrap" title="Ver instrucciones"
                    onclick="event.stopPropagation();toggleMantInstr('${instrKey}')">▸ Cómo</button>`
                : '';
              const instrDiv = comoTexto
                ? `<div id="mant-instr-${instrKey}" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;font-size:12px;white-space:pre-line;line-height:1.6;color:var(--text);margin-top:2px;overflow-wrap:break-word">${comoTexto}</div>`
                : '';
              return `<div class="mant-plan-row">
                <span class="badge ${tipoBadge}" style="font-size:10px;min-width:60px">${plan.Tipo_Intervencion||'—'}</span>
                <span style="font-size:11px;font-weight:500;min-width:90px">${plan.Periodicidad} · ${labelPeriodo(periodo)}</span>
                <span style="font-size:11px;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</span>
                ${instrBtn}
                ${badge}
              </div>${instrDiv}`;
            }).join('');
          }).join('')}
        </div>
      </div>`);
  }

  return secciones.join('');
}

// ============================================================
// MODAL EJECUTAR MANTENIMIENTO (checklist de pasos + guardar a medias)
// ============================================================
let _mantEjecActual = null;   // { idPlan, idEquipo, periodo, curso }
let _mantPasosActual = [];     // [{ texto, hecho, criterio, resultado, nota }] — estado del checklist
let _mantEditRegistroId = null; // si no es null, el modal está editando un registro ya finalizado

// Deja el modal en modo "ejecutar" (checklist + guardar progreso + finalizar).
function _resetModalMantUI() {
  _mantEditRegistroId = null;
  _mantResultado = null;
  if (typeof vpPrepararRevision === 'function') vpPrepararRevision(null);
  const t = document.getElementById('mant-modal-title');
  if (t) t.textContent = 'Ejecutar mantenimiento';
  const bp = document.getElementById('mant-btn-progreso');
  if (bp) bp.style.display = '';
  const ay = document.getElementById('mant-checklist-ayuda');
  if (ay) ay.style.display = '';
  const bpr = document.getElementById('mant-btn-principal');
  if (bpr) bpr.textContent = 'Finalizar';
  const rpHint = document.getElementById('mant-realizado-hint');
  if (rpHint) rpHint.textContent = '';
}

// El botón primario del modal: finaliza una ejecución o guarda la edición de un
// registro ya finalizado, según el modo en que se abrió.
function _mantGuardarPrincipal() {
  return _mantEditRegistroId ? guardarEdicionMant() : finalizarMant();
}

function openModalRegistrarMant(idPlan, idEquipo, periodo, curso) {
  const plan   = DATA.planesMantenimiento.find(p => p.ID_Plan === idPlan);
  const equipo = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  if (!plan || !equipo) return;

  _resetModalMantUI();

  const enCurso = getEjecucionMant(idPlan, curso, periodo);
  const pasos = enCurso && Array.isArray(enCurso.Pasos) && enCurso.Pasos.length
    ? enCurso.Pasos
    : _pasosDesdePlan(plan);

  _mantEjecActual = { idPlan, idEquipo, periodo, curso };

  const nombreEquipo = `${equipo.ID_Activo} – ${equipo.Tipo_Equipo || ''} ${equipo.Marca || ''}`.trim();
  document.getElementById('mant-info-plan').innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:12px;line-height:1.6">
      <div><strong>Equipo:</strong> ${nombreEquipo}</div>
      <div><strong>Operación:</strong> ${plan.Operacion || '—'}</div>
      <div><strong>Tipo:</strong> ${plan.Tipo_Intervencion} · ${plan.Periodicidad} · ${labelPeriodo(periodo)}</div>
      ${enCurso ? `<div style="margin-top:6px;color:var(--accent)"><strong>▶ Ejecución empezada</strong> el ${formatDate(enCurso.Fecha_Inicio) || '—'}${enCurso.Iniciado_Por ? ' por ' + enCurso.Iniciado_Por : ''} — continúa donde se dejó.
        ${getUserRole() !== 'Alumno' ? `<button class="btn-link" style="margin-left:8px;background:none;border:none;color:var(--danger);cursor:pointer;font-size:11px;text-decoration:underline;padding:0" onclick="descartarEjecucionMant('${enCurso.ID_Registro}')">Descartar y empezar de cero</button>` : ''}</div>` : ''}
    </div>`;

  // Si el equipo tiene un aviso de avería abierto, que se vea antes de empezar.
  document.getElementById('mant-info-plan').insertAdjacentHTML('beforeend', htmlAvisoEquipo(idEquipo, 'mantenimiento'));

  // Micropipetas: la verificación la calcula la app y marca ella sus pasos (js/verif-pipetas.js).
  const conVerif = typeof vpPrepararRevision === 'function' && vpPrepararRevision(plan, enCurso, curso);
  _mantResultado = enCurso?.Resultado || null;
  _renderMantChecklist(pasos);
  if (conVerif) vpMarcarPasosRevision();

  document.getElementById('mant-id-plan').value    = idPlan;
  document.getElementById('mant-id-equipo').value  = idEquipo;
  document.getElementById('mant-periodo').value     = periodo;
  document.getElementById('mant-curso').value       = curso;

  document.getElementById('mant-fecha').value = new Date().toISOString().split('T')[0];

  // En mantenimientos externos "Realizado por" es la empresa que lo hizo:
  // se precarga con el Proveedor SAT del equipo (editable). En los internos,
  // el nombre de quien está registrando.
  const rp = document.getElementById('mant-realizado-por');
  const esExterno = plan.Tipo_Intervencion === 'Externo';
  if (esExterno) {
    rp.value = enCurso?.Realizado_Por || equipo.Proveedor_Servicio_Tecnico || '';
    rp.placeholder = 'Empresa que realizó el mantenimiento';
    rp.readOnly = false;
  } else {
    rp.value = _nombreUsuarioActual();
    rp.placeholder = 'Nombre del responsable';
    // El alumnado no puede firmar con su nombre: queda como "Alumnado".
    rp.readOnly = getUserRole() === 'Alumno';
  }
  const rpHint = document.getElementById('mant-realizado-hint');
  if (rpHint) {
    rpHint.textContent = esExterno ? '(empresa)'
      : (getUserRole() === 'Alumno' ? '(no se guarda tu nombre)' : '');
  }
  // El alumnado no firma la supervisión: la pone el docente al dar el visto bueno.
  const supEl = document.getElementById('mant-supervisado-por');
  supEl.value = '';
  const supGrupo = supEl.closest('.form-group');
  const esAlumnoMant = getUserRole() === 'Alumno';
  if (supGrupo) supGrupo.style.display = esAlumnoMant ? 'none' : '';
  const avisoVb = document.getElementById('mant-aviso-vb');
  if (avisoVb) avisoVb.style.display = esAlumnoMant ? '' : 'none';
  document.getElementById('mant-observaciones').value   = enCurso?.Observaciones || '';

  openModal('modal-registrar-mant');
}

function _renderMantChecklist(pasos) {
  _mantPasosActual = (pasos || []).map(p => _normPasoMant(p));
  const cont = document.getElementById('mant-checklist');
  if (!cont) return;
  const opcionesTipo = (sel, lista) => lista.map(t => `<option${t === sel ? ' selected' : ''}>${t}</option>`).join('');
  const esAlumno = getUserRole() === 'Alumno';
  // Los textos van con textContent (vienen de los planes, no se interpolan como HTML).
  cont.innerHTML = _mantPasosActual.map((p, i) => _pasoAutoMant(p) ? `
    <div class="mant-check-item mant-check-auto ${p.resultado ? 'is-' + p.resultado : p.hecho ? 'is-cumple' : ''}" data-idx="${i}">
      <span class="mant-check-auto-icono">${p.resultado === 'no_cumple' ? '❌' : (p.resultado === 'cumple' || p.hecho) ? '✅' : '⏳'}</span>
      <div class="mant-check-cuerpo">
        <span class="mant-check-texto"></span>
        ${p.criterio ? '<div class="mant-check-crit"><strong>Criterio:</strong> <span></span></div>' : ''}
        <div class="mant-check-auto-nota">🧪 Lo marca la app con el resultado de la verificación</div>
      </div>
    </div>` : p.tipo === 'comprobar' ? (() => {
      // Tres maneras de preguntar lo mismo, según cómo esté escrito el paso.
      const [si, no] = p.criterio ? ['✓ Cumple', '✗ No cumple']
        : _pasoEsCondicional(p) ? ['✓ No hacía falta', '⚠ Hacía falta'] : ['✓ Correcto', '⚠ Hay que actuar'];
      return `
    <div class="mant-check-item mant-check-criterio ${p.resultado ? 'is-' + p.resultado : ''}" data-idx="${i}">
      <div class="mant-check-cuerpo">
        <span class="mant-check-texto"></span>
        ${p.criterio ? '<div class="mant-check-crit"><strong>Criterio:</strong> <span></span></div>' : ''}
        ${p.criterio ? _mantCalcHtml(p, i) : ''}
        <div class="mant-check-botones">
          <button type="button" class="mant-btn-cumple" onclick="_mantMarcarCriterio(${i}, 'cumple')">${si}</button>
          <button type="button" class="mant-btn-nocumple" onclick="_mantMarcarCriterio(${i}, 'no_cumple')">${no}</button>
          <button type="button" class="mant-btn-noaplica" title="Este paso no aplica a este equipo o esta vez" onclick="_mantMarcarCriterio(${i}, 'no_aplica')">No aplica</button>
        </div>
        <div class="mant-check-nota" style="${p.resultado === 'no_cumple' ? '' : 'display:none'}">
          <label>¿Qué has visto? *</label>
          <textarea rows="2" data-campo="nota" placeholder="Valor medido, lo que está gastado, lo que no funciona…" oninput="_mantCampoPaso(${i}, 'nota', this.value)"></textarea>
          <div class="mant-check-accion-tit">¿Qué has hecho? *</div>
          <div class="mant-check-acciones">
            <button type="button" data-accion="corregido" onclick="_mantAccionPaso(${i}, 'corregido')">🔧 Lo he corregido en el momento</button>
            <button type="button" data-accion="intervencion" onclick="_mantAccionPaso(${i}, 'intervencion')">🔩 He cambiado una pieza o ajustado el equipo</button>
            <button type="button" data-accion="reparacion" onclick="_mantAccionPaso(${i}, 'reparacion')">🚨 Necesita reparación</button>
          </div>
          <div class="mant-check-actuacion">
            <select class="mant-check-tipoint" onchange="_mantCampoPaso(${i}, 'tipo_intervencion', this.value)">${opcionesTipo(p.tipo_intervencion, _TIPOS_INT_PASO)}</select>
            <input type="text" data-campo="actuacion" oninput="_mantCampoPaso(${i}, 'actuacion', this.value)">
          </div>
          <div class="mant-check-nota-ayuda"></div>
        </div>
      </div>
    </div>`; })() : p.tipo === 'sustituir' ? `
    <div class="mant-check-item mant-check-sustituir ${p.hecho ? 'is-hecho' : ''}" data-idx="${i}">
      <input type="checkbox" ${p.hecho ? 'checked' : ''} onchange="_mantPasoHecho(${i}, this.checked)">
      <div class="mant-check-cuerpo">
        <span class="mant-check-texto"></span>
        ${p.criterio ? '<div class="mant-check-crit"><strong>Criterio:</strong> <span></span></div>' : ''}
        <div class="mant-check-pieza" style="${p.hecho ? '' : 'display:none'}">
          <select class="mant-check-tipoint" onchange="_mantCampoPaso(${i}, 'tipo_intervencion', this.value)">${opcionesTipo(p.tipo_intervencion, ['Sustitución de pieza', 'Cambio de consumibles'])}</select>
          <input type="text" data-campo="actuacion" placeholder="Pieza puesta: referencia, lote… (opcional)" oninput="_mantCampoPaso(${i}, 'actuacion', this.value)">
          <div class="mant-check-nota-ayuda">${p.id_intervencion
            ? `🔩 Registrada como intervención ${p.id_intervencion} del equipo.`
            : `🔩 Quedará también como intervención en el historial del equipo${esAlumno ? ' cuando el profesorado firme el visto bueno' : ''}.`}</div>
        </div>
      </div>
    </div>` : `
    <label class="mant-check-item" data-idx="${i}">
      <input type="checkbox" ${p.hecho ? 'checked' : ''} onchange="_mantPasoHecho(${i}, this.checked)">
      <span class="mant-check-texto"></span>
    </label>`).join('');
  cont.querySelectorAll('.mant-check-item').forEach(el => {
    const i = Number(el.dataset.idx);
    const p = _mantPasosActual[i];
    el.querySelector('.mant-check-texto').textContent = p.texto;
    const crit = el.querySelector('.mant-check-crit span');
    if (crit) crit.textContent = p.criterio;
    const ta = el.querySelector('textarea[data-campo="nota"]');
    if (ta) ta.value = p.nota || '';
    const act = el.querySelector('input[data-campo="actuacion"]');
    if (act) act.value = p.actuacion || '';
    if (p.tipo === 'comprobar' && !_pasoAutoMant(p)) _mantPintarAccion(i);
    // Calculadora: rellena lo ya guardado y pinta el resultado de cada regla.
    if (p._calc) p._calc.reglas.forEach((r, j) => {
      el.querySelectorAll(`.mant-calc-regla[data-r="${j}"] input`).forEach(inp => {
        inp.value = p._calc.datos[j][inp.dataset.k] ?? '';
      });
      _mantCalcPintarRegla(Number(el.dataset.idx), j);
    });
    if (p._calc) _mantCalcPintarResto(Number(el.dataset.idx));
  });
  _mantChecklistChanged();
}

// ── Calculadora de criterios ────────────────────────────────────────────────
// Si el criterio lleva tolerancias numéricas (analizarCriterio, js/criterios-calc.js),
// el paso pide los datos —lo que marca el equipo y lo que mide el instrumento— y
// decide él «Cumple» / «No cumple». Lo que el criterio tenga de cualitativo («junta
// estanca») lo sigue juzgando la persona: con eso pendiente, un «todo cumple» de la
// calculadora no marca el paso; un «no cumple» sí, porque ya basta para suspenderlo.
function _mantCalcHtml(p, i) {
  if (typeof analizarCriterio !== 'function') return '';
  const a = analizarCriterio(p.criterio);
  if (!a.reglas.length) { p._calc = null; return ''; }
  // Datos guardados: se casan por el texto de la regla, por si el criterio cambió.
  const datos = a.reglas.map(r => {
    const g = (p.medidas || []).find(m => m && m.regla === r.texto);
    if (g) return { equipo: g.equipo ?? '', referencia: g.referencia ?? '', valor: g.valor ?? '', lecturas: g.lecturas ?? '' };
    // Nominal: el valor nominal ya escrito en la casilla del equipo (se puede cambiar).
    return { equipo: r.tipo === 'nominal' ? String(r.nominal).replace('.', ',') : '', referencia: '', valor: '', lecturas: '' };
  });
  p._calc = { reglas: a.reglas, resto: a.resto, datos, auto: false, notaAuto: '' };
  // Al reabrir un registro: si la nota empieza por el texto que escribió la calculadora,
  // se sigue tratando como suyo (se actualiza al cambiar los datos).
  const autoGuardado = _mantCalcResultados(p)
    .map((r, j) => r && !r.cumple ? `${a.reglas[j].magnitud}: ${r.detalle}` : null).filter(Boolean).join(' · ');
  if (autoGuardado && (p.nota || '').startsWith(autoGuardado)) { p._calc.notaAuto = autoGuardado; p._calc.auto = true; }
  return `<div class="mant-calc">
    ${a.reglas.map((r, j) => `
      <div class="mant-calc-regla" data-r="${j}">
        <div class="mant-calc-tit">🧮 <strong>${_ccEsc(r.magnitud)}</strong> <span class="mant-calc-desc">${_ccEsc(describirRegla(r))}</span></div>
        <div class="mant-calc-campos">
          ${camposRegla(r).map(c => `
            <label class="mant-calc-campo${c.ancho ? ' ancho' : ''}">
              <span>${_ccEsc(c.label)}${r.unidad && c.k !== 'lecturas' ? ` (${_ccEsc(r.unidad)})` : ''}</span>
              <input type="text" inputmode="${c.k === 'lecturas' ? 'text' : 'decimal'}" autocomplete="off" data-k="${c.k}"
                     oninput="_mantCalcInput(${i}, ${j}, '${c.k}', this.value)">
            </label>`).join('')}
        </div>
        <div class="mant-calc-res"></div>
      </div>`).join('')}
    ${a.resto.length ? `<div class="mant-calc-resto"></div>` : ''}
  </div>`;
}

function _mantCalcInput(i, j, k, valor) {
  const p = _mantPasosActual[i];
  if (!p?._calc) return;
  p._calc.datos[j][k] = valor;
  _mantCalcPintarRegla(i, j);
  _mantCalcVeredicto(i);
}

function _mantCalcResultados(p) {
  return p._calc.reglas.map((r, j) => calcularRegla(r, p._calc.datos[j]));
}

function _mantCalcPintarRegla(i, j) {
  const p = _mantPasosActual[i];
  const el = document.querySelector(`#mant-checklist .mant-check-item[data-idx="${i}"] .mant-calc-regla[data-r="${j}"]`);
  if (!p?._calc || !el) return;
  const res = calcularRegla(p._calc.reglas[j], p._calc.datos[j]);
  const div = el.querySelector('.mant-calc-res');
  el.classList.toggle('ok', !!res && res.cumple);
  el.classList.toggle('ko', !!res && !res.cumple);
  div.textContent = res ? `${res.cumple ? '✓ Cumple' : '✗ No cumple'} — ${res.detalle}` : '';
}

function _mantCalcPintarResto(i) {
  const p = _mantPasosActual[i];
  const div = document.querySelector(`#mant-checklist .mant-check-item[data-idx="${i}"] .mant-calc-resto`);
  if (!p?._calc || !div) return;
  const res = _mantCalcResultados(p);
  const todasOk = res.every(r => r && r.cumple);
  div.textContent = (todasOk ? 'Las medidas cumplen. ' : '') +
    `Comprueba tú: ${p._calc.resto.join(' · ')} — y marca «Cumple» o «No cumple».`;
  div.classList.toggle('destacado', todasOk);
}

/** Decide el resultado del paso a partir de la calculadora (ver comentario de arriba). */
function _mantCalcVeredicto(i) {
  const p = _mantPasosActual[i];
  if (!p?._calc) return;
  const res = _mantCalcResultados(p);
  const fallos = res.map((r, j) => r && !r.cumple ? `${p._calc.reglas[j].magnitud}: ${r.detalle}` : null).filter(Boolean);
  const completo = res.every(Boolean);
  let nuevo;
  if (fallos.length) nuevo = 'no_cumple';
  else if (completo && !p._calc.resto.length) nuevo = 'cumple';
  else nuevo = p._calc.auto ? null : p.resultado;   // lo que puso la persona, se respeta

  // La nota de un «no cumple» calculado se escribe sola con las medidas; si la persona
  // ya había escrito algo suyo, se le añade delante en vez de pisarlo.
  if (nuevo === 'no_cumple') {
    const auto = fallos.join(' · ');
    const nota = (p.nota || '').trim();
    if (!nota || nota === p._calc.notaAuto) p.nota = auto;
    else if (p._calc.notaAuto && nota.startsWith(p._calc.notaAuto)) p.nota = auto + nota.slice(p._calc.notaAuto.length);
    else if (!nota.includes(auto)) p.nota = auto + ' · ' + nota;
    p._calc.notaAuto = auto;
  } else if (p._calc.notaAuto) {
    // Ya no falla: fuera las cifras viejas de la nota; lo que escribió la persona se queda.
    const nota = (p.nota || '').trim();
    if (nota.startsWith(p._calc.notaAuto)) p.nota = nota.slice(p._calc.notaAuto.length).replace(/^\s*·\s*/, '');
    p._calc.notaAuto = '';
  }
  p._calc.auto = nuevo !== p.resultado ? nuevo != null : p._calc.auto;
  if (nuevo !== p.resultado || nuevo === 'no_cumple') _mantAplicarCriterio(i, nuevo, false);
  _mantCalcPintarResto(i);
}

function _mantPasoHecho(i, hecho) {
  const p = _mantPasosActual[i];
  if (!p) return;
  p.hecho = !!hecho;
  if (p.tipo === 'sustituir') {
    const el = document.querySelector(`#mant-checklist .mant-check-item[data-idx="${i}"]`);
    el?.classList.toggle('is-hecho', p.hecho);
    const pieza = el?.querySelector('.mant-check-pieza');
    if (pieza) pieza.style.display = p.hecho ? '' : 'none';
  }
  _mantChecklistChanged();
}

/** Campo de texto de un paso (nota, actuacion, tipo_intervencion). */
function _mantCampoPaso(i, campo, valor) {
  const p = _mantPasosActual[i];
  if (!p) return;
  p[campo] = valor;
  if (campo === 'tipo_intervencion' || campo === 'actuacion') _mantPintarResultado();
}
// Nombre antiguo (por si alguna pantalla cacheada lo llama).
function _mantNotaCriterio(i, texto) { _mantCampoPaso(i, 'nota', texto); }

/** Qué se hizo cuando una comprobación sale mal: 'corregido' (en el momento, sin pieza),
 *  'intervencion' (pieza cambiada o ajuste: queda también como intervención del equipo) o
 *  'reparacion' (aviso de avería al finalizar). Pulsar otra vez la misma, la quita. */
function _mantAccionPaso(i, accion) {
  const p = _mantPasosActual[i];
  if (!p) return;
  p.accion = p.accion === accion ? null : accion;
  _mantPintarAccion(i);
  _mantChecklistChanged();
  if (p.accion === 'corregido' || p.accion === 'intervencion') {
    document.querySelector(`#mant-checklist .mant-check-item[data-idx="${i}"] input[data-campo="actuacion"]`)?.focus();
  }
}

function _mantPintarAccion(i) {
  const p = _mantPasosActual[i];
  const el = document.querySelector(`#mant-checklist .mant-check-item[data-idx="${i}"]`);
  if (!p || !el) return;
  el.querySelectorAll('.mant-check-acciones button').forEach(b => b.classList.toggle('sel', b.dataset.accion === p.accion));
  const act = el.querySelector('.mant-check-actuacion');
  const conTexto = p.accion === 'corregido' || p.accion === 'intervencion';
  if (act) {
    act.style.display = conTexto ? '' : 'none';
    const sel = act.querySelector('select');
    if (sel) sel.style.display = p.accion === 'intervencion' ? '' : 'none';
    const inp = act.querySelector('input');
    if (inp) inp.placeholder = p.accion === 'intervencion'
      ? '¿Qué has cambiado o ajustado? (p. ej. junta tórica nueva) *'
      : '¿Qué has hecho? (p. ej. engrasado el pistón) *';
  }
  const ayuda = el.querySelector('.mant-check-nota-ayuda');
  if (ayuda) {
    const esAlumno = getUserRole() === 'Alumno';
    ayuda.textContent = {
      corregido: 'Queda anotado en este paso. Si has cambiado una pieza, elige «He cambiado una pieza».',
      intervencion: p.id_intervencion
        ? `Registrada como intervención ${p.id_intervencion} del equipo.`
        : `Queda en este paso y, además, como intervención en el historial del equipo${esAlumno ? ', cuando el profesorado firme el visto bueno' : ''}.`,
      reparacion: 'Al finalizar se abrirá el aviso de avería del equipo con esto ya escrito.',
    }[p.accion] || 'Elige qué has hecho: corregirlo en el momento, cambiar una pieza o avisar de que necesita reparación.';
  }
}

function _mantMarcarCriterio(i, resultado) {
  const p = _mantPasosActual[i];
  if (!p) return;
  if (p._calc) p._calc.auto = false;   // lo decide la persona
  _mantAplicarCriterio(i, p.resultado === resultado ? null : resultado, true);   // pulsar otra vez lo desmarca
}

function _mantAplicarCriterio(i, resultado, enfocar) {
  const p = _mantPasosActual[i];
  if (!p) return;
  p.resultado = resultado;
  p.hecho = !!p.resultado;
  const el = document.querySelector(`#mant-checklist .mant-check-item[data-idx="${i}"]`);
  if (el) {
    el.classList.toggle('is-cumple', p.resultado === 'cumple');
    el.classList.toggle('is-no_cumple', p.resultado === 'no_cumple');
    el.classList.toggle('is-no_aplica', p.resultado === 'no_aplica');
    const nota = el.querySelector('.mant-check-nota');
    if (nota) nota.style.display = p.resultado === 'no_cumple' ? '' : 'none';
    const ta = el.querySelector('textarea[data-campo="nota"]');
    if (ta && ta.value !== (p.nota || '')) ta.value = p.nota || '';
    if (enfocar && p.resultado === 'no_cumple') ta?.focus();
  }
  _mantChecklistChanged();
}

function _mantChecklistChanged() {
  const total = _mantPasosActual.length;
  const done = _mantPasosActual.filter(p => p.hecho).length;
  const noCumple = _mantPasosActual.filter(p => p.resultado === 'no_cumple').length;
  const lbl = document.getElementById('mant-checklist-progreso');
  if (lbl) lbl.textContent = total
    ? `${done}/${total} pasos${noCumple ? ` · ⚠ ${noCumple} con algo que revisar` : ''}`
    : '';
  _mantPintarResultado();
}

function _leerChecklist() {
  return _mantPasosActual.map(p => {
    const base = { texto: p.texto, tipo: p.tipo,
      ...(p.id_intervencion ? { id_intervencion: p.id_intervencion } : {}), ...(p.auto ? { auto: true } : {}) };
    if (p.tipo === 'hacer') return { ...base, hecho: p.hecho === true };
    if (p.tipo === 'sustituir') {
      return { ...base, criterio: p.criterio, hecho: p.hecho === true,
        actuacion: p.hecho ? (p.actuacion || '').trim() : null,
        tipo_intervencion: p.hecho ? (p.tipo_intervencion || 'Sustitución de pieza') : null };
    }
    const nc = p.resultado === 'no_cumple';
    const conTexto = nc && (p.accion === 'corregido' || p.accion === 'intervencion');
    return { ...base, criterio: p.criterio, hecho: !!p.resultado, resultado: p.resultado,
      nota: nc ? (p.nota || '').trim() : null,
      accion: nc ? (p.accion || null) : null,
      actuacion: conTexto ? (p.actuacion || '').trim() : null,
      tipo_intervencion: nc && p.accion === 'intervencion' ? (p.tipo_intervencion || 'Sustitución de pieza') : null,
      ...(p._calc ? { medidas: _mantCalcMedidas(p) } : {}) };
  });
}

/** Lo que falta en un paso para poder finalizar (mensaje), o null. Espejo de faltaEnPaso()
 *  en gestionar-mantenimiento. */
function _mantFaltaEnPasos(pasos) {
  for (const p of pasos) {
    if (p.resultado !== 'no_cumple' || _pasoAutoMant(p)) continue;
    if (!p.nota) return `Anota qué has visto en «${p.texto}»`;
    if (!p.accion) return `Elige qué has hecho en «${p.texto}»: corregirlo, cambiar una pieza o avisar de que necesita reparación`;
    if ((p.accion === 'corregido' || p.accion === 'intervencion') && !p.actuacion) return `Escribe qué has hecho en «${p.texto}»`;
  }
  return null;
}

// ── Resultado del mantenimiento ─────────────────────────────────────────────
// Lo marca la persona (un «está bien» nunca lo pone la app sola); la app resalta el que
// le sale de los pasos y explica por qué.
let _mantResultado = null;

/** { res, porque } sugerido a partir de los pasos (y de la verificación de una pipeta), o null
 *  si aún faltan comprobaciones por contestar. */
function _mantResultadoSugerido() {
  const ps = _mantPasosActual;
  const vc = (typeof _vpRev !== 'undefined' && _vpRev && typeof _vpCalcVer === 'function') ? _vpCalcVer() : null;
  const manuales = ps.filter(p => p.tipo === 'comprobar' && !_pasoAutoMant(p));
  if (manuales.some(p => p.resultado === 'no_cumple' && p.accion === 'reparacion')) return { res: 'no_apto', porque: 'hay algo que necesita reparación' };
  if (vc?.final && /^RETIRAR/.test(vc.resultado || '')) return { res: 'no_apto', porque: 'la verificación dice RETIRAR' };
  if (manuales.some(p => !p.resultado || (p.resultado === 'no_cumple' && !p.accion))) return null;
  if (vc && !vc.final) return null;
  if (manuales.some(p => p.accion === 'intervencion')) return { res: 'apto_tras_intervencion', porque: 'se ha cambiado una pieza o ajustado el equipo' };
  if (vc?.final && (vc.fases?.length || 0) > 1) return { res: 'apto_tras_intervencion', porque: 'la pipeta se ha ajustado' };
  return { res: 'apto', porque: 'las comprobaciones están bien' };
}

function _mantElegirResultado(res) {
  _mantResultado = _mantResultado === res ? null : res;
  _mantPintarResultado();
}

function _mantPintarResultado() {
  const bloque = document.getElementById('mant-resultado-bloque');
  if (!bloque) return;
  const sug = _mantResultadoSugerido();
  bloque.querySelectorAll('button[data-res]').forEach(b => {
    b.classList.toggle('sel', b.dataset.res === _mantResultado);
    b.classList.toggle('sugerido', !!sug && b.dataset.res === sug.res && _mantResultado !== sug.res);
  });
  const hint = document.getElementById('mant-resultado-hint');
  if (!hint) return;
  if (!sug) hint.textContent = 'Contesta las comprobaciones y marca el resultado.';
  else if (_mantResultado && _mantResultado !== sug.res) hint.textContent = `Por los pasos saldría «${_RESULTADO_MANT[sug.res].txt}» (${sug.porque}); has marcado otro: explícalo en Observaciones.`;
  else if (_mantResultado) hint.textContent = '';
  else hint.textContent = `Por los pasos saldría «${_RESULTADO_MANT[sug.res].txt}»: ${sug.porque}. Márcalo tú.`;
}

/** Lo tecleado en la calculadora, para el registro: una entrada por regla con algún dato. */
function _mantCalcMedidas(p) {
  return p._calc.reglas.map((r, j) => {
    const d = p._calc.datos[j];
    const res = calcularRegla(r, d);
    const medida = { regla: r.texto, magnitud: r.magnitud, unidad: r.unidad || '' };
    camposRegla(r).forEach(c => { medida[c.k] = String(d[c.k] ?? '').trim(); });
    // El nominal ya viene escrito: si es lo único que hay, no es una medida.
    const tecleado = camposRegla(r).some(c => medida[c.k] !== '' && !(r.tipo === 'nominal' && c.k === 'equipo'));
    if (!tecleado) return null;
    medida.cumple = res ? res.cumple : null;
    medida.detalle = res ? res.detalle : '';
    return medida;
  }).filter(Boolean);
}

/** Tras finalizar con alguna comprobación que no cumple: abre el aviso de avería del
 *  equipo con lo anotado ya escrito. Lo envía la persona (puede ajustar el impacto). */
function _ofrecerAvisoNoCumple(idEquipo, idPlan, periodo, noCumple) {
  if (!noCumple.length) return;
  const plan = DATA.planesMantenimiento.find(p => p.ID_Plan === idPlan);
  const texto = `Mantenimiento «${plan?.Operacion || 'preventivo'}» (${labelPeriodo(periodo)}): ` +
    noCumple.map(p => `${p.criterio ? `no cumple «${p.texto}» (criterio: ${p.criterio})` : `«${p.texto}»: necesita reparación`}. Visto: ${p.nota}`).join(' · ');
  // Si el equipo ya tiene un aviso abierto, lo visto se añade a ese aviso: no se abre otro
  // por lo mismo (decisión de Paloma, 2026-11-23).
  const abierto = typeof avisosAbiertosEquipo === 'function' ? avisosAbiertosEquipo(idEquipo)[0] : null;
  if (abierto) {
    setTimeout(() => {
      openModalAnadirAviso(idEquipo, abierto, texto);
      showToast('Una comprobación no cumple y el equipo ya tiene un aviso abierto: añade lo visto a ese aviso', '');
    }, 400);
    return;
  }
  setTimeout(() => {
    if (puedeHacer('crearIncidencias')) {
      openModalIncidenciaEquipo(idEquipo);
      setTimeout(() => sv('inc-descripcion', texto), 120);
    } else {
      openModalAvisoAlumno(idEquipo);
      sv('aviso-descripcion', texto);
    }
    showToast('Una comprobación no cumple: revisa el aviso de avería y envíalo', '');
  }, 400);
}

// Quién firma el registro. El alumnado firma con el nombre de su grupo, que se
// deja entero. El servidor lo impone igualmente (gestionar-mantenimiento), pero
// lo ponemos aquí para que en pantalla se vea lo que se va a guardar de verdad.
// Ver docs/proteccion-datos.md.
function _nombreUsuarioActual() {
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const u = DATA.usuarios.find(x => (x.Email || '').toLowerCase().trim() === emailNorm);
  const nombre = u?.Nombre || currentUser?.name || '';
  if (getUserRole() === 'Alumno') return nombre || 'Alumnado';
  return _nombreCorto(nombre);
}

/** Intervenciones creadas por el servidor a partir de los pasos (piezas cambiadas, ajustes):
 *  se suman a DATA sin recargar todo. Si alguna no se pudo crear, se avisa. */
function _mantIncorporarIntervenciones(resp) {
  (resp?.intervenciones || []).forEach(i => {
    const o = _intervencionSbToObj(i);
    const k = DATA.intervenciones.findIndex(x => x.ID_Intervencion === o.ID_Intervencion);
    if (k >= 0) DATA.intervenciones[k] = o; else DATA.intervenciones.push(o);
  });
  (resp?.tareas || []).forEach(t => {
    const o = _tareaSbToObj(t);
    const k = DATA.tareasIntervencion.findIndex(x => x.ID_Tarea === o.ID_Tarea);
    if (k >= 0) DATA.tareasIntervencion[k] = o; else DATA.tareasIntervencion.push(o);
  });
  if (resp?.aviso) setTimeout(() => showToast(resp.aviso, 'error'), 700);
}

function _refrescarTrasMant() {
  renderEquipos();
  if (document.getElementById('page-mantenimiento')?.classList.contains('active')) renderMantenimiento();
  if (typeof _updateBadgeMantenimiento === 'function') _updateBadgeMantenimiento();
}

async function guardarProgresoMant() {
  if (!_mantEjecActual) return;
  const { idPlan, idEquipo, periodo, curso } = _mantEjecActual;
  showLoading('Guardando progreso...');
  try {
    const { registro } = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'guardar_progreso',
      id_plan: idPlan, id_equipo: idEquipo, curso_academico: curso, periodo,
      pasos: _leerChecklist(), iniciado_por: _nombreUsuarioActual(), resultado: _mantResultado,
      observaciones: document.getElementById('mant-observaciones').value.trim(),
      verificacion: typeof vpVerificacionParaGuardar === 'function' ? vpVerificacionParaGuardar() : undefined,
    });
    DATA.registroMantenimientos = DATA.registroMantenimientos.filter(r =>
      !(r.ID_Plan === idPlan && r.Curso_Academico === curso && r.Periodo === periodo &&
        (r.Estado === 'no_aplica' || r.Estado === 'aplazado')));
    _upsertRegistroMant(_registroMantSbToObj(registro));
    closeModal('modal-registrar-mant');
    showToast('Progreso guardado — puedes retomarlo más adelante', 'success');
    _refrescarTrasMant();
  } catch (e) {
    showToast(e.message || 'Error guardando el progreso', 'error');
    console.error(e);
  }
  hideLoading();
}

async function descartarEjecucionMant(idRegistro) {
  if (!idRegistro || !_mantEjecActual) return;
  if (!confirm('¿Descartar el progreso guardado de este mantenimiento y empezar de cero?')) return;
  const { idPlan, idEquipo, periodo, curso } = _mantEjecActual;
  showLoading('Descartando...');
  try {
    await callEdgeFunction('gestionar-mantenimiento', { accion: 'descartar_ejecucion', id_registro: idRegistro });
    const i = DATA.registroMantenimientos.findIndex(r => r.ID_Registro === idRegistro);
    if (i >= 0) DATA.registroMantenimientos.splice(i, 1);
    closeModal('modal-registrar-mant');
    showToast('Progreso descartado', 'success');
    _refrescarTrasMant();
    openModalRegistrarMant(idPlan, idEquipo, periodo, curso);
  } catch (e) {
    showToast('Error al descartar el progreso', 'error');
    console.error(e);
  }
  hideLoading();
}

async function finalizarMant() {
  if (!_mantEjecActual) return;
  const { idPlan, idEquipo, periodo, curso } = _mantEjecActual;
  const fecha = document.getElementById('mant-fecha').value;
  const quien = document.getElementById('mant-realizado-por').value.trim();
  if (!fecha) { showToast('Indica la fecha de realización', 'error'); return; }
  if (!quien) { showToast('Indica quién realizó el mantenimiento', 'error'); return; }
  // Micropipetas: sin resultado de la verificación (OK o RETIRAR) no se finaliza.
  if (typeof vpPuedeFinalizar === 'function' && !vpPuedeFinalizar()) return;

  const pasos = _leerChecklist();
  const falta = _mantFaltaEnPasos(pasos);
  if (falta) { showToast(falta, 'error'); return; }
  if (!_mantResultado) {
    showToast('Marca el resultado del mantenimiento: apto, apto tras intervención o no apto', 'error');
    document.getElementById('mant-resultado-bloque')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const faltan = pasos.filter(p => !p.hecho).length;
  if (faltan && !confirm(`Quedan ${faltan} paso(s) sin marcar. ¿Dar el mantenimiento por finalizado de todas formas?`)) return;
  // Solo lo que «necesita reparación» abre el aviso de avería (lo corregido o la pieza cambiada,
  // no). Los pasos de la verificación de una pipeta tampoco: si sale RETIRAR, la incidencia la
  // abre el servidor con los valores.
  const noCumple = pasos.filter(p => p.resultado === 'no_cumple' && p.accion === 'reparacion' && !_pasoAutoMant(p));

  showLoading('Finalizando...');
  try {
    const resp = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'finalizar',
      id_plan: idPlan, id_equipo: idEquipo, curso_academico: curso, periodo,
      pasos, fecha_realizacion: fecha, realizado_por: quien, resultado: _mantResultado,
      supervisado_por: document.getElementById('mant-supervisado-por').value.trim(),
      observaciones: document.getElementById('mant-observaciones').value.trim(),
      verificacion: typeof vpVerificacionParaGuardar === 'function' ? vpVerificacionParaGuardar() : undefined,
    });
    const { registro, incidencia } = resp;
    _mantIncorporarIntervenciones(resp);
    if (incidencia) {
      // Pipeta retirada: incidencia abierta (o añadida a la que había) y equipo fuera de servicio.
      const inc = _incidenciaSbToObj(incidencia);
      const ii = DATA.incidencias.findIndex(x => x.ID_Incidencia === inc.ID_Incidencia);
      if (ii >= 0) DATA.incidencias[ii] = inc; else DATA.incidencias.push(inc);
      const eq = DATA.equipos.find(e => e.ID_Activo === idEquipo);
      if (eq) eq.Estado_Operativo = 'Fuera de servicio';
      setTimeout(() => showToast(`Pipeta RETIRADA: incidencia ${inc.ID_Incidencia} abierta y ${idEquipo} fuera de servicio. Ponle la etiqueta «NO USAR».`, 'error'), 600);
    }
    // El servidor borra cualquier marcador no_aplica/aplazado del mismo periodo.
    DATA.registroMantenimientos = DATA.registroMantenimientos.filter(r =>
      !(r.ID_Plan === idPlan && r.Curso_Academico === curso && r.Periodo === periodo &&
        (r.Estado === 'no_aplica' || r.Estado === 'aplazado')));
    _upsertRegistroMant(_registroMantSbToObj(registro));
    closeModal('modal-registrar-mant');
    const nInt = (resp.intervenciones || []).length;
    showToast(registro.estado === 'pendiente_vb'
      ? 'Registrado. Queda a la espera del visto bueno del profesorado.'
      : `Mantenimiento finalizado${nInt ? ` · ${nInt} intervención(es) en el historial del equipo` : ''}`, 'success');
    _refrescarTrasMant();
    _ofrecerAvisoNoCumple(idEquipo, idPlan, periodo, noCumple);
  } catch (e) {
    showToast(e.message || 'Error al finalizar el registro', 'error');
    console.error(e);
  }
  hideLoading();
}

// ── Editar un mantenimiento YA finalizado (solo desde Mantenimiento → Realizados) ──
function openModalEditarRegistroMant(idRegistro) {
  const reg = DATA.registroMantenimientos.find(r => r.ID_Registro === idRegistro && r.Estado !== 'en_curso');
  if (!reg) { showToast('No se encontró el registro', 'error'); return; }
  const plan   = DATA.planesMantenimiento.find(p => p.ID_Plan === reg.ID_Plan);
  const equipo = DATA.equipos.find(e => e.ID_Activo === reg.ID_Equipo);

  _resetModalMantUI();
  _mantEditRegistroId = idRegistro;
  _mantEjecActual = { idPlan: reg.ID_Plan, idEquipo: reg.ID_Equipo, periodo: reg.Periodo, curso: reg.Curso_Academico };

  const nombreEquipo = equipo
    ? `${equipo.ID_Activo} – ${equipo.Tipo_Equipo || ''} ${equipo.Marca || ''}`.trim()
    : reg.ID_Equipo;
  document.getElementById('mant-info-plan').innerHTML = `
    <div style="background:var(--warning-light,#fff3cd);border:1px solid var(--warning,#e0a800);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:12px;line-height:1.6;color:var(--warning-dark,#8a6d00)">
      <div><strong>✏️ Editando un mantenimiento ya finalizado.</strong> Corrige lo que haga falta; no se crea un registro nuevo.</div>
      <div style="margin-top:4px"><strong>Equipo:</strong> ${nombreEquipo}</div>
      <div><strong>Operación:</strong> ${plan?.Operacion || '—'}</div>
      <div><strong>Tipo:</strong> ${plan?.Tipo_Intervencion || '—'} · ${plan?.Periodicidad || '—'} · ${labelPeriodo(reg.Periodo)}</div>
    </div>`;

  const pasos = Array.isArray(reg.Pasos) && reg.Pasos.length
    ? reg.Pasos
    : (plan ? _pasosDesdePlan(plan) : []);
  _mantResultado = reg.Resultado || null;
  _renderMantChecklist(pasos);

  document.getElementById('mant-id-plan').value   = reg.ID_Plan;
  document.getElementById('mant-id-equipo').value = reg.ID_Equipo;
  document.getElementById('mant-periodo').value   = reg.Periodo;
  document.getElementById('mant-curso').value     = reg.Curso_Academico;
  document.getElementById('mant-fecha').value          = reg.Fecha_Realizacion || '';
  document.getElementById('mant-realizado-por').value  = reg.Realizado_Por || '';
  document.getElementById('mant-supervisado-por').value= reg.Supervisado_Por || '';
  document.getElementById('mant-observaciones').value  = reg.Observaciones || '';

  document.getElementById('mant-modal-title').textContent = '✏️ Editar mantenimiento';
  const bp = document.getElementById('mant-btn-progreso'); if (bp) bp.style.display = 'none';
  const ay = document.getElementById('mant-checklist-ayuda'); if (ay) ay.style.display = 'none';
  document.getElementById('mant-btn-principal').textContent = 'Guardar cambios';

  openModal('modal-registrar-mant');
}

async function guardarEdicionMant() {
  if (!_mantEditRegistroId) return;
  const fecha = document.getElementById('mant-fecha').value;
  const quien = document.getElementById('mant-realizado-por').value.trim();
  if (!fecha) { showToast('Indica la fecha de realización', 'error'); return; }
  if (!quien) { showToast('Indica quién realizó el mantenimiento', 'error'); return; }
  const pasosEd = _leerChecklist();
  const falta = _mantFaltaEnPasos(pasosEd);
  if (falta) { showToast(falta, 'error'); return; }

  showLoading('Guardando cambios...');
  try {
    const resp = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'editar_registro',
      id_registro: _mantEditRegistroId,
      fecha_realizacion: fecha, realizado_por: quien,
      supervisado_por: document.getElementById('mant-supervisado-por').value.trim(),
      observaciones: document.getElementById('mant-observaciones').value.trim(),
      pasos: pasosEd, resultado: _mantResultado,
    });
    _mantIncorporarIntervenciones(resp);
    _upsertRegistroMant(_registroMantSbToObj(resp.registro));
    closeModal('modal-registrar-mant');
    showToast('Mantenimiento actualizado', 'success');
    _refrescarTrasMant();
  } catch (e) {
    showToast(e.message || 'Error al guardar los cambios', 'error');
    console.error(e);
  }
  hideLoading();
}

// ============================================================
// MODAL DE OPCIONES DE UN MANTENIMIENTO (botón "⋯")
// Dos cosas distintas en el mismo sitio: si lo puede realizar el alumnado
// (propiedad del PLAN, se guarda sola) y marcar este periodo como
// "no aplica"/aplazado (propiedad del PERIODO, va con el botón Guardar).
// ============================================================
let _marcarMantActual = null; // { idPlan, idEquipo, periodo, curso }

function _toggleMarcarMant() {
  const tipo = document.querySelector('input[name="marcar-tipo"]:checked')?.value;
  const wrap = document.getElementById('marcar-mes-wrap');
  if (wrap) wrap.style.display = tipo === 'aplazado' ? '' : 'none';
  const btn = document.getElementById('marcar-btn-guardar');
  if (btn) btn.textContent = tipo === 'aplazado' ? 'Guardar aplazamiento' : 'Guardar «no aplica»';
}

function openModalMarcarMant(idPlan, idEquipo, periodo, curso) {
  const plan   = DATA.planesMantenimiento.find(p => p.ID_Plan === idPlan);
  const equipo = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  if (!plan || !equipo) return;

  _marcarMantActual = { idPlan, idEquipo, periodo, curso };
  const marc = getMarcadorMant(idPlan, curso, periodo);

  const nombreEquipo = `${equipo.ID_Activo} – ${equipo.Tipo_Equipo || ''} ${equipo.Marca || ''}`.trim();
  document.getElementById('marcar-mant-info').innerHTML = `
    <div><strong>Equipo:</strong> ${nombreEquipo}</div>
    <div><strong>Operación:</strong> ${plan.Operacion || '—'}</div>
    <div><strong>Periodo:</strong> ${plan.Tipo_Intervencion || '—'} · ${plan.Periodicidad || '—'} · ${labelPeriodo(periodo)}</div>`;

  document.getElementById('marcar-id-plan').value   = idPlan;
  document.getElementById('marcar-id-equipo').value = idEquipo;
  document.getElementById('marcar-periodo').value   = periodo;
  document.getElementById('marcar-curso').value     = curso;

  // ¿Se reserva al profesorado? Es editar el plan: Admin/Gestor en cualquier
  // equipo, Profesor solo en los suyos (lo revalida la Edge Function). En los
  // externos no se pregunta: el alumnado nunca los registra.
  const puedeAlumnado = (puedeHacer('editarEquipos') ||
    (getUserRole() === 'Profesor' && esResponsableDeEquipo(equipo))) &&
    plan.Tipo_Intervencion !== 'Externo';
  const wrapAlum = document.getElementById('marcar-alumnado-wrap');
  if (wrapAlum) wrapAlum.style.display = puedeAlumnado ? '' : 'none';
  const chkAlum = document.getElementById('marcar-solo-profesorado');
  if (chkAlum) { chkAlum.checked = _esSoloProfesorado(plan); chkAlum.disabled = false; }

  const tipo = marc?.Estado === 'aplazado' ? 'aplazado' : 'no_aplica';
  document.querySelectorAll('input[name="marcar-tipo"]').forEach(r => { r.checked = r.value === tipo; });
  document.getElementById('marcar-mes').value = marc?.Aplazado_A ? String(marc.Aplazado_A).slice(0, 7) : '';
  document.getElementById('marcar-motivo').value = marc?.Observaciones || '';
  _toggleMarcarMant();

  openModal('modal-marcar-mant');
}

// El interruptor "solo profesorado" no espera al botón Guardar: es del plan (no de
// este periodo) y confundir las dos cosas haría que marcar quién lo realiza
// exigiera además un motivo de "no aplica".
async function guardarAlumnadoMarcarMant() {
  const chk = document.getElementById('marcar-solo-profesorado');
  if (!_marcarMantActual || !chk) return;
  const { idPlan } = _marcarMantActual;
  const valor = chk.checked;
  chk.disabled = true;
  try {
    const { plan } = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'alumnado_plan', id_plan: idPlan, solo_profesorado: valor ? 'Sí' : 'No',
    });
    const idx = DATA.planesMantenimiento.findIndex(p => p.ID_Plan === idPlan);
    if (idx !== -1) DATA.planesMantenimiento[idx] = _planMantenimientoSbToObj(plan);
    showToast(valor
      ? 'Este mantenimiento queda reservado al profesorado'
      : 'El alumnado ya puede realizar este mantenimiento', 'success');
    _refrescarTrasMant();
  } catch (e) {
    chk.checked = !valor;   // deja el interruptor como estaba
    showToast('No se pudo guardar quién puede realizarlo', 'error');
    console.error(e);
  }
  chk.disabled = false;
}

async function guardarMarcarMant() {
  if (!_marcarMantActual) return;
  const { idPlan, idEquipo, periodo, curso } = _marcarMantActual;
  const tipo = document.querySelector('input[name="marcar-tipo"]:checked')?.value || 'no_aplica';
  const motivo = document.getElementById('marcar-motivo').value.trim();
  if (!motivo) { showToast('Explica el motivo', 'error'); return; }
  let aplazadoA = null;
  if (tipo === 'aplazado') {
    const mes = document.getElementById('marcar-mes').value; // "YYYY-MM"
    if (!/^\d{4}-\d{2}$/.test(mes)) { showToast('Elige el mes al que se aplaza', 'error'); return; }
    aplazadoA = `${mes}-01`;
  }

  showLoading('Guardando...');
  try {
    const { registro } = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'marcar_periodo',
      id_plan: idPlan, id_equipo: idEquipo, curso_academico: curso, periodo,
      tipo, motivo, aplazado_a: aplazadoA, marcado_por: _nombreUsuarioActual(),
    });
    // El servidor pudo borrar una ejecución a medias del mismo periodo.
    DATA.registroMantenimientos = DATA.registroMantenimientos.filter(r =>
      !(r.ID_Plan === idPlan && r.Curso_Academico === curso && r.Periodo === periodo &&
        (r.Estado === 'en_curso' || r.Estado === 'no_aplica' || r.Estado === 'aplazado')));
    _upsertRegistroMant(_registroMantSbToObj(registro));
    closeModal('modal-marcar-mant');
    showToast(tipo === 'aplazado' ? 'Mantenimiento aplazado' : 'Marcado como "no aplica"', 'success');
    _refrescarTrasMant();
  } catch (e) {
    showToast('Error al guardar', 'error');
    console.error(e);
  }
  hideLoading();
}

async function revertirMarcadorMant(idRegistro) {
  if (!idRegistro) return;
  if (!confirm('¿Quitar la marca y volver a dejar este mantenimiento como pendiente?')) return;
  showLoading('Revirtiendo...');
  try {
    await callEdgeFunction('gestionar-mantenimiento', { accion: 'revertir_periodo', id_registro: idRegistro });
    const i = DATA.registroMantenimientos.findIndex(r => r.ID_Registro === idRegistro);
    if (i >= 0) DATA.registroMantenimientos.splice(i, 1);
    showToast('Vuelve a estar pendiente', 'success');
    _refrescarTrasMant();
  } catch (e) {
    showToast('Error al revertir', 'error');
    console.error(e);
  }
  hideLoading();
}

// ============================================================
// EVALUACIONES — en cuáles se usa cada equipo y fechas de cada curso
// ============================================================
// El profesorado responsable las marca en sus equipos; Admin/Gestor, en todos
// (el servidor lo revalida). Las fechas del curso, solo Admin/Gestor.
function puedeMarcarEvaluacionesEquipo(equipo) {
  if (!equipo) return false;
  if (puedeHacer('editarEquipos')) return true;
  return getUserRole() === 'Profesor' && esResponsableDeEquipo(equipo);
}

let _evalEquipoId = null;

function openModalEvaluacionesEquipo(idEquipo) {
  const eq = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  if (!puedeMarcarEvaluacionesEquipo(eq)) { showToast('Solo el profesorado responsable del equipo puede cambiarlo', 'error'); return; }
  _evalEquipoId = idEquipo;
  document.getElementById('evaleq-nombre').textContent = `${eq.ID_Activo} – ${[eq.Tipo_Equipo, eq.Marca, eq.Modelo].filter(Boolean).join(' ')}`;
  const marcadas = String(eq.Evaluaciones_Uso || '').split(',').map(x => parseInt(x, 10));
  [1, 2, 3].forEach(n => { document.getElementById(`evaleq-${n}`).checked = marcadas.includes(n); });
  const evals = evaluacionesDelCurso(getCursoAcademico());
  document.getElementById('evaleq-fechas').innerHTML = evals.map(e =>
    `${e.numero}ª: ${_fmtFechaCorta(e.inicio)} – ${_fmtFechaCorta(e.fin)}`).join('<br>') +
    (evals[0].configurada ? '' : '<br><span style="color:var(--warning)">⚠ Fechas aproximadas: aún no se han fijado las de este curso.</span>');
  openModal('modal-evaluaciones-equipo');
}

async function guardarEvaluacionesEquipo() {
  const evaluaciones = [1, 2, 3].filter(n => document.getElementById(`evaleq-${n}`).checked);
  showLoading('Guardando...');
  try {
    const { equipo } = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'evaluaciones_equipo', id_equipo: _evalEquipoId, evaluaciones,
    });
    const eq = DATA.equipos.find(e => e.ID_Activo === _evalEquipoId);
    if (eq) eq.Evaluaciones_Uso = equipo?.evaluaciones_uso || '';
    closeModal('modal-evaluaciones-equipo');
    showToast('Evaluaciones guardadas', 'success');
    renderEquipos();
    if (document.getElementById('page-mantenimiento').classList.contains('active')) renderMantenimiento();
    if (document.getElementById('modal-gestionar-plan')?.classList.contains('open')) _togglePlanTemporada();
  } catch (e) {
    showToast(e.message || 'No se pudieron guardar las evaluaciones', 'error');
  } finally {
    hideLoading();
  }
}

function _isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let _evalCurso = null;

function openModalEvaluacionesCurso(curso = getCursoAcademico()) {
  _evalCurso = curso;
  document.getElementById('evalcurso-curso').textContent = curso;
  const evals = evaluacionesDelCurso(curso);
  document.getElementById('evalcurso-filas').innerHTML = evals.map(e => `
    <div class="form-group"><label>${e.numero}ª evaluación — inicio</label>
      <input type="date" id="evalcurso-${e.numero}-ini" value="${e.configurada ? _isoLocal(e.inicio) : ''}"></div>
    <div class="form-group"><label>${e.numero}ª evaluación — fin</label>
      <input type="date" id="evalcurso-${e.numero}-fin" value="${e.configurada ? _isoLocal(e.fin) : ''}"></div>`).join('');
  openModal('modal-evaluaciones-curso');
}

async function guardarEvaluacionesCurso() {
  const evaluaciones = [1, 2, 3].map(n => ({
    numero: n,
    fecha_inicio: document.getElementById(`evalcurso-${n}-ini`).value,
    fecha_fin: document.getElementById(`evalcurso-${n}-fin`).value,
  }));
  if (evaluaciones.some(e => !e.fecha_inicio || !e.fecha_fin)) {
    showToast('Faltan fechas: hacen falta el inicio y el fin de las tres evaluaciones', 'error'); return;
  }
  showLoading('Guardando...');
  try {
    const res = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'evaluaciones_curso', curso_academico: _evalCurso, evaluaciones,
    });
    DATA.evaluacionesCurso = (DATA.evaluacionesCurso || []).filter(e => e.Curso_Academico !== _evalCurso)
      .concat((res.evaluaciones || []).map(_evaluacionCursoSbToObj));
    closeModal('modal-evaluaciones-curso');
    showToast('Fechas de evaluación guardadas', 'success');
    renderMantenimiento();
  } catch (e) {
    showToast(e.message || 'No se pudieron guardar las fechas', 'error');
  } finally {
    hideLoading();
  }
}

// ============================================================
// MODAL GESTIONAR PLANES — alta/edición/borrado solo desde la
// sección Mantenimiento. Admin/Gestor: cualquier equipo.
// Profesor: solo equipos de los que es responsable.
// ============================================================
let _planEditingId = null;
let _planEditingEquipoId = null;

// Equipos sobre los que el usuario actual puede gestionar planes.
function _equiposGestionablesPlan() {
  if (puedeHacer('editarEquipos')) return DATA.equipos;
  if (getUserRole() === 'Profesor') return DATA.equipos.filter(e => esResponsableDeEquipo(e));
  return [];
}

// Muestra, en los planes que dependen de las evaluaciones (arranque, cierre,
// trimestral), en qué evaluaciones se usa el equipo y cuándo vence el plan.
function _togglePlanTemporada() {
  const period = document.getElementById('plan-periodicidad').value;
  const wrap = document.getElementById('plan-temporada-wrap');
  const porEval = _PERIODICIDADES_POR_EVALUACION.includes(period);
  if (wrap) wrap.style.display = porEval ? '' : 'none';
  if (porEval) _pintarVencimientoPlan(period);
}

function _equipoActualPlan() {
  const id = _planEditingEquipoId ||
    (document.getElementById('plan-equipo-select')?.value || '');
  return DATA.equipos.find(e => e.ID_Activo === id) || null;
}

function _fmtFechaCorta(d) {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _pintarVencimientoPlan(periodicidad) {
  const caja = document.getElementById('plan-temporada-texto');
  if (!caja) return;
  const eq = _equipoActualPlan();
  if (!eq) { caja.textContent = 'Elige primero el equipo.'; return; }
  const curso = getCursoAcademico();
  const periodos = periodosPorEvaluacion({ Periodicidad: periodicidad }, eq, curso);
  const fechas = periodos.map(p => `${labelPeriodo(p.periodo)}: ${_fmtFechaCorta(p.fecha)}`).join(' · ');
  const aviso = evaluacionesDelCurso(curso)[0].configurada ? '' :
    `<div style="color:var(--warning);font-size:12px">⚠ Las fechas de evaluación de ${curso} aún no están fijadas: son aproximadas.</div>`;
  const btn = puedeMarcarEvaluacionesEquipo(eq)
    ? ` <button type="button" class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModalEvaluacionesEquipo('${eq.ID_Activo}')">📅 Cambiar</button>` : '';
  caja.innerHTML = `Se usa en: <strong>${textoEvaluacionesUso(eq)}</strong>${btn}<br>${fechas || '—'}${aviso}`;
}

// El interruptor "solo profesorado" solo tiene sentido en los planes internos:
// un externo lo registra siempre el profesorado, lo marque quien lo marque.
function _togglePlanAlumnado() {
  const wrap = document.getElementById('plan-alumnado-wrap');
  if (!wrap) return;
  wrap.style.display = document.getElementById('plan-tipo-int').value === 'Externo' ? 'none' : '';
}

// Al cambiar el equipo en el selector (solo en alta), recargar los meses.
function _onCambioEquipoPlan() {
  _planEditingEquipoId = document.getElementById('plan-equipo-select')?.value || null;
  _togglePlanTemporada();
}

function openModalPlan(equipoId = null, idPlan = null) {
  _planEditingId = idPlan;

  const plan = idPlan ? DATA.planesMantenimiento.find(p => p.ID_Plan === idPlan) : null;
  // En edición, el equipo lo fija el plan; en alta, el argumento o el selector.
  _planEditingEquipoId = plan ? plan.ID_Equipo : (equipoId || null);

  const selWrap  = document.getElementById('plan-equipo-selector-wrap');
  const nomWrap  = document.getElementById('plan-equipo-nombre-wrap');
  const select   = document.getElementById('plan-equipo-select');
  const usarSelector = !plan && !equipoId;

  if (usarSelector) {
    const opts = _equiposGestionablesPlan()
      .slice()
      .sort((a, b) => (a.ID_Activo || '').localeCompare(b.ID_Activo || '', 'es'))
      .map(e => `<option value="${e.ID_Activo}">${e.ID_Activo} – ${[e.Tipo_Equipo, e.Marca].filter(Boolean).join(' ')}</option>`)
      .join('');
    select.innerHTML = `<option value="">Seleccionar equipo…</option>${opts}`;
    select.value = '';
    select.onchange = _onCambioEquipoPlan;
    if (selWrap) selWrap.style.display = '';
    if (nomWrap) nomWrap.style.display = 'none';
  } else {
    const equipo = DATA.equipos.find(e => e.ID_Activo === _planEditingEquipoId);
    const titulo = equipo
      ? `${equipo.ID_Activo} – ${equipo.Tipo_Equipo || ''} ${equipo.Marca || ''}`.trim()
      : (_planEditingEquipoId || '');
    document.getElementById('modal-plan-equipo-nombre').textContent = titulo;
    if (selWrap) selWrap.style.display = 'none';
    if (nomWrap) nomWrap.style.display = '';
  }

  if (plan) {
    document.getElementById('plan-tipo-int').value      = plan.Tipo_Intervencion;
    document.getElementById('plan-periodicidad').value  = plan.Periodicidad;
    document.getElementById('plan-operacion').value     = plan.Operacion;
    document.getElementById('plan-instrucciones').value = plan.Instrucciones || '';
    document.getElementById('plan-solo-profesorado').checked = _esSoloProfesorado(plan);
  } else {
    document.getElementById('plan-tipo-int').value      = 'Interno';
    document.getElementById('plan-periodicidad').value  = 'Anual';
    document.getElementById('plan-operacion').value     = '';
    document.getElementById('plan-instrucciones').value = '';
    document.getElementById('plan-solo-profesorado').checked = false;
  }

  _togglePlanTemporada();
  _togglePlanAlumnado();
  openModal('modal-gestionar-plan');
}

async function guardarPlan() {
  const tipo         = document.getElementById('plan-tipo-int').value;
  const period       = document.getElementById('plan-periodicidad').value;
  const operacion    = document.getElementById('plan-operacion').value.trim();
  const instrucciones= document.getElementById('plan-instrucciones').value.trim();
  // El alumnado no registra externos nunca: en un plan externo el interruptor no cuenta.
  const soloProf     = tipo === 'Externo' ? 'No'
    : (document.getElementById('plan-solo-profesorado').checked ? 'Sí' : 'No');

  const idEquipo = _planEditingEquipoId ||
    (document.getElementById('plan-equipo-select')?.value || '');
  if (!idEquipo) { showToast('Elige el equipo del plan', 'error'); return; }
  if (!operacion) { showToast('Escribe el título de la operación', 'error'); return; }

  const payload = {
    id_equipo: idEquipo,
    tipo_intervencion: tipo, periodicidad: period, operacion, instrucciones, solo_profesorado: soloProf,
  };

  showLoading('Guardando...');
  try {
    if (_planEditingId) {
      const idx = DATA.planesMantenimiento.findIndex(p => p.ID_Plan === _planEditingId);
      const { plan } = await callEdgeFunction('gestionar-mantenimiento', {
        accion: 'actualizar_plan', id_plan: _planEditingId, ...payload,
      });
      if (idx !== -1) DATA.planesMantenimiento[idx] = _planMantenimientoSbToObj(plan);
    } else {
      const { plan } = await callEdgeFunction('gestionar-mantenimiento', {
        accion: 'crear_plan', ...payload,
      });
      DATA.planesMantenimiento.push(_planMantenimientoSbToObj(plan));
    }
    closeModal('modal-gestionar-plan');
    showToast('Plan guardado', 'success');
    renderEquipos();
    if (document.getElementById('page-mantenimiento').classList.contains('active')) {
      renderMantenimiento();
    }
  } catch (e) {
    showToast('Error guardando el plan', 'error');
    console.error(e);
  }
  hideLoading();
}

async function eliminarPlan(idPlan) {
  if (!confirm('¿Eliminar este plan de mantenimiento?')) return;
  const idx = DATA.planesMantenimiento.findIndex(p => p.ID_Plan === idPlan);
  if (idx === -1) return;
  showLoading('Eliminando...');
  try {
    await callEdgeFunction('gestionar-mantenimiento', { accion: 'eliminar_plan', id_plan: idPlan });
    DATA.planesMantenimiento.splice(idx, 1);
    showToast('Plan eliminado', 'success');
    renderMantenimiento();
  } catch (e) {
    showToast('Error eliminando el plan', 'error');
    console.error(e);
  }
  hideLoading();
}

// ============================================================
// PÁGINA DE MANTENIMIENTO
// ============================================================
let _pendientesCache = []; // para que filtrarPendientes() pueda acceder sin re-calcular
let _realizadosCache = []; // ídem para filtrarRealizados()
let _vistoBuenoCache = []; // registros del alumnado a la espera de firma

function _detectarLabEquipo(eq) {
  const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === eq.Ubicacion);
  if (u && u.Laboratorio_Aula) return u.Laboratorio_Aula; // "201", "205", "205 - Zona común"…
  // Fallback: buscar el número de lab en cualquier parte del campo Ubicacion
  // (cubre "Laboratorio 205", "Lab-207", "205 - Zona común", "207", etc.)
  const id = String(eq.Ubicacion || '').toLowerCase();
  if (id.includes('209')) return '209';
  if (id.includes('207')) return '207';
  if (id.includes('205')) return '205';
  if (id.includes('203')) return '203';
  if (id.includes('201')) return '201';
  return 'Otros';
}

// Mapea el valor real de Laboratorio_Aula a la hoja Excel correspondiente
function _labAHoja(labAula) {
  const s = String(labAula || '');
  if (s.includes('209')) return 'LAB 209';
  if (s.includes('207')) return 'LAB 207';
  if (s.includes('205')) return 'LAB 205'; // incluye "205 - Zona común"
  if (s.includes('203')) return 'LAB 203';
  if (s.includes('201')) return 'LAB 201';
  return null;
}

function renderMantenimiento() {
  const container = document.getElementById('mantenimiento-contenido');
  if (!container) return;

  const curso = getCursoAcademico();
  const esGestorAdmin = puedeHacer('editarEquipos');   // Admin/Gestor
  const esProfesor    = getUserRole() === 'Profesor';
  const esAlumno      = getUserRole() === 'Alumno';
  // canLog: abrir la ejecución. El alumnado también, porque su lista ya viene filtrada
  // a los planes que le tocan. canMarcar (no aplica / aplazar) sigue siendo gestión.
  const canLog  = puedeHacer('registrarMantenimiento');
  const canMarcar = puedeMarcarPeriodoMant();
  const puedeExportar   = esGestorAdmin;
  const puedePlanes     = esGestorAdmin || esProfesor;   // Profesor: acotado a sus equipos
  const puedeRealizados = esGestorAdmin;                 // editar finalizados: solo Admin/Gestor
  const puedeFirmar     = esGestorAdmin || esProfesor;   // visto bueno a lo del alumnado

  // El Profesor solo ve/gestiona lo de los equipos de los que es responsable.
  const equiposScope = esProfesor
    ? DATA.equipos.filter(e => esResponsableDeEquipo(e))
    : DATA.equipos;

  // Calcular todos los status del curso actual
  // El alumnado solo ve los internos que no estén reservados al profesorado.
  const todoStatus = [];
  equiposScope.forEach(eq => {
    const planes = DATA.planesMantenimiento.filter(p => {
      if (p.ID_Equipo !== eq.ID_Activo || p.Activo === 'FALSE') return false;
      if (esAlumno && !planDelAlumnado(p)) return false;
      return true;
    });
    planes.forEach(plan => {
      const periodos = getPeriodosEsperados(plan, eq, curso);
      periodos.forEach(periodo => {
        const est = estadoPeriodoMant(plan.ID_Plan, curso, periodo);
        // 'no aplica' y aplazamientos no vencidos no cuentan como esperados.
        if (est.tipo === 'no_aplica' || est.tipo === 'aplazado_futuro') return;
        todoStatus.push({
          equipo: eq, plan, periodo, curso,
          // 'pendiente_vb' ya está hecho: sale de la lista de pendientes para que
          // nadie lo repita, pero se cuenta aparte hasta que lo firme un docente.
          hecho: est.tipo === 'finalizado' || est.tipo === 'pendiente_vb',
          esperaVb: est.tipo === 'pendiente_vb',
          registro: est.registro || null,
          ejecucion: est.ejecucion || null,
          marcador: est.marcador || null,
        });
      });
    });
  });

  // Marcadores del curso (no aplica / aplazados) — para el bloque de revisión.
  const esScopeCompleto = equiposScope === DATA.equipos;
  const marcadoresList = DATA.registroMantenimientos
    .filter(r => r.Curso_Academico === curso && (r.Estado === 'no_aplica' || r.Estado === 'aplazado'))
    .filter(r => esScopeCompleto || equiposScope.some(e => e.ID_Activo === r.ID_Equipo))
    .map(r => ({
      reg: r,
      equipo: DATA.equipos.find(e => e.ID_Activo === r.ID_Equipo) || null,
      plan:   DATA.planesMantenimiento.find(p => p.ID_Plan === r.ID_Plan) || null,
    }))
    .sort((a, b) => (a.reg.Periodo || '').localeCompare(b.reg.Periodo || ''));

  // Registros del curso a la espera de firma, dentro del alcance visible.
  _vistoBuenoCache = puedeFirmar
    ? DATA.registroMantenimientos
        .filter(r => r.Curso_Academico === curso && r.Estado === 'pendiente_vb')
        .filter(r => esScopeCompleto || equiposScope.some(e => e.ID_Activo === r.ID_Equipo))
        .map(r => ({
          reg: r,
          equipo: DATA.equipos.find(e => e.ID_Activo === r.ID_Equipo) || null,
          plan:   DATA.planesMantenimiento.find(p => p.ID_Plan === r.ID_Plan) || null,
        }))
        .sort((a, b) => (a.reg.Fecha_Realizacion || '').localeCompare(b.reg.Fecha_Realizacion || ''))
    : [];
  const vistoBuenoList = _vistoBuenoCache;

  const total     = todoStatus.length;
  const hechos    = todoStatus.filter(s => s.hecho).length;
  const pendientes= total - hechos;
  const enCurso   = todoStatus.filter(s => s.ejecucion).length;
  const pct       = total > 0 ? Math.round(hechos / total * 100) : 0;

  _pendientesCache = todoStatus.filter(s => !s.hecho).map(s => ({
    ...s, lab: _detectarLabEquipo(s.equipo)
  }));
  const pendientesList = _pendientesCache;

  // Realizados del curso (finalizados) — solo Admin/Gestor los ve/edita.
  _realizadosCache = puedeRealizados
    ? DATA.registroMantenimientos
        .filter(r => r.Curso_Academico === curso && r.Estado === 'finalizado')
        .map(r => {
          const equipo = DATA.equipos.find(e => e.ID_Activo === r.ID_Equipo) || null;
          const plan   = DATA.planesMantenimiento.find(p => p.ID_Plan === r.ID_Plan) || null;
          return { reg: r, equipo, plan, lab: equipo ? _detectarLabEquipo(equipo) : 'Otros' };
        })
        .sort((a, b) => (b.reg.Fecha_Realizacion || '').localeCompare(a.reg.Fecha_Realizacion || ''))
    : [];
  const realizadosList = _realizadosCache;
  const nPlanes = equiposScope === DATA.equipos
    ? DATA.planesMantenimiento.length
    : DATA.planesMantenimiento.filter(p => equiposScope.some(e => e.ID_Activo === p.ID_Equipo)).length;

  // Fechas de evaluación del curso: de ellas dependen arranque, cierre y trimestrales.
  const evalsCurso = evaluacionesDelCurso(curso);
  const puedeFechasEval = puedeHacer('editarEquipos');
  const btnFechasEval = puedeFechasEval
    ? `<button class="btn btn-secondary" style="padding:3px 10px;font-size:12px" onclick="openModalEvaluacionesCurso('${curso}')">📅 ${evalsCurso[0].configurada ? 'Cambiar fechas' : 'Fijar fechas'}</button>` : '';
  const bloqueEvaluaciones = evalsCurso[0].configurada
    ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);margin-bottom:12px">
         <span>📅 Evaluaciones ${curso}: ${evalsCurso.map(e => `<strong>${e.numero}ª</strong> ${e.inicio.toLocaleDateString('es-ES')}–${e.fin.toLocaleDateString('es-ES')}`).join(' · ')}</span>${btnFechasEval}</div>`
    : `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--warning);border-radius:var(--radius-sm);font-size:12px;margin-bottom:12px">
         <span>⚠ <strong>Faltan las fechas de las evaluaciones de ${curso}.</strong> Las revisiones de arranque y cierre y las lecturas trimestrales usan, mientras tanto, fechas aproximadas (sep–dic, ene–mar, abr–jun).</span>${btnFechasEval}</div>`;

  container.innerHTML = bloqueEvaluaciones + `
    <!-- Resumen -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-value">${pct}%</div><div class="stat-label">Completado curso ${curso}</div></div>
      <div class="stat-card"><div class="stat-value">${hechos}</div><div class="stat-label">Realizados</div></div>
      <div class="stat-card"><div class="stat-value" style="color:${pendientes>0?'var(--danger)':'var(--success)'}">${pendientes}</div><div class="stat-label">Pendientes${enCurso>0?` <span style="color:var(--accent);font-weight:600">(${enCurso} en curso)</span>`:''}</div></div>
      ${vistoBuenoList.length ? `
      <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${vistoBuenoList.length}</div><div class="stat-label">Esperan tu visto bueno</div></div>` : ''}
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total esperados</div></div>
    </div>

    ${puedeExportar ? `
    <!-- Acciones -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <button class="btn btn-secondary" onclick="exportarModeloCalidad('${curso}')">📄 Exportar plan de mantenimiento</button>
      <button class="btn btn-secondary" onclick="exportarInventario('${curso}')">📋 Exportar inventario</button>
    </div>` : ''}

    <!-- Pestañas -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;flex-wrap:wrap">
      <button id="tab-btn-pendientes" onclick="switchMantTab('pendientes')"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid var(--accent);margin-bottom:-2px;color:var(--accent)">
        Pendientes <span style="font-size:11px;background:var(--danger);color:#fff;border-radius:99px;padding:1px 7px;margin-left:4px">${pendientes}</span>
      </button>
      ${vistoBuenoList.length ? `<button id="tab-btn-vistobueno" onclick="switchMantTab('vistobueno')"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted)">
        Visto bueno <span style="font-size:11px;background:var(--warning);color:#fff;border-radius:99px;padding:1px 7px;margin-left:4px">${vistoBuenoList.length}</span>
      </button>` : ''}
      ${puedeRealizados ? `<button id="tab-btn-realizados" onclick="switchMantTab('realizados')"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted)">
        Realizados <span style="font-size:11px;background:var(--border);color:var(--text-muted);border-radius:99px;padding:1px 7px;margin-left:4px">${realizadosList.length}</span>
      </button>` : ''}
      ${puedePlanes ? `<button id="tab-btn-planes" onclick="switchMantTab('planes')"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted)">
        Planes configurados <span style="font-size:11px;background:var(--border);color:var(--text-muted);border-radius:99px;padding:1px 7px;margin-left:4px">${nPlanes}</span>
      </button>` : ''}
      <!-- Subsección: la verificación de micropipetas tiene su propia página (js/verif-pipetas.js) -->
      <button id="tab-btn-verifpipetas" onclick="showPage('verif-pipetas')"
        style="padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted)">
        🧪 Verificación de pipetas
      </button>
    </div>

    <!-- Tab: Pendientes -->
    <div id="tab-pendientes">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Mantenimientos pendientes — Curso ${curso}</div>
          <div class="card-actions">
            <div class="search-input">
              <span>🔍</span>
              <input type="search" placeholder="Buscar equipo..." oninput="filtrarPendientes()" id="filter-pend-equipo">
            </div>
            <select id="filter-pend-lab" onchange="filtrarPendientes()" style="font-size:12px">
              <option value="">Todos los labs</option>
              ${[...new Set(pendientesList.map(s => s.lab))]
                .filter(l => l && l !== 'Otros').sort()
                .map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
            <select id="filter-pend-periodo" onchange="filtrarPendientes()" style="font-size:12px">
              <option value="">Todos los períodos</option>
              ${[...new Set(pendientesList.map(s => s.periodo))].sort()
                .map(p => `<option value="${p}">${labelPeriodo(p)}</option>`).join('')}
            </select>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>Equipo</th><th>Tipo</th><th>Periodicidad</th><th>Período</th><th>Operación</th><th></th>
          </tr></thead>
          <tbody id="tbody-pendientes">${_renderFilasPendientes(pendientesList, canLog, canMarcar)}</tbody>
        </table>
        <div id="pend-empty" style="display:none;padding:20px;text-align:center;color:var(--text-muted)">✅ Sin mantenimientos pendientes con estos filtros.</div>
      </div>
      ${canMarcar && marcadoresList.length ? `
      <details class="card" style="margin-top:16px">
        <summary style="cursor:pointer;font-weight:600;font-size:13px">
          No aplica / aplazados — Curso ${curso}
          <span style="font-size:11px;background:var(--border);color:var(--text-muted);border-radius:99px;padding:1px 7px;margin-left:4px">${marcadoresList.length}</span>
        </summary>
        <table style="margin-top:12px">
          <thead><tr><th>Equipo</th><th>Operación</th><th>Período</th><th>Estado</th><th>Motivo</th><th></th></tr></thead>
          <tbody>${_renderFilasMarcadores(marcadoresList)}</tbody>
        </table>
      </details>` : ''}
    </div>

    <!-- Tab: Visto bueno — lo que ha registrado el alumnado y falta firmar -->
    ${vistoBuenoList.length ? `
    <div id="tab-vistobueno" style="display:none">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Registrados por alumnado — pendientes de tu visto bueno</div>
          <div class="card-actions">
            <button class="btn btn-primary" style="font-size:12px;padding:5px 12px"
                    onclick="darVistoBuenoTodos()">✓ Firmar los ${vistoBuenoList.length}</button>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>Equipo</th><th>Operación</th><th>Período</th><th>Fecha</th><th>Realizado por</th><th>Pasos</th><th></th>
          </tr></thead>
          <tbody>${_renderFilasVistoBueno(vistoBuenoList)}</tbody>
        </table>
        <div style="padding:12px 20px;font-size:11px;color:var(--text-muted);line-height:1.6;border-top:1px solid var(--border)">
          Al firmar, tu nombre entra automáticamente como <strong>Supervisado por</strong> y el
          mantenimiento pasa a contar en el documento de calidad. Hasta entonces no se exporta.
        </div>
      </div>
    </div>` : ''}

    <!-- Tab: Realizados (solo Admin/Gestor) -->
    ${puedeRealizados ? `
    <div id="tab-realizados" style="display:none">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Mantenimientos realizados — Curso ${curso}</div>
          <div class="card-actions">
            <div class="search-input">
              <span>🔍</span>
              <input type="search" placeholder="Buscar equipo..." oninput="filtrarRealizados()" id="filter-real-equipo">
            </div>
            <select id="filter-real-lab" onchange="filtrarRealizados()" style="font-size:12px">
              <option value="">Todos los labs</option>
              ${[...new Set(realizadosList.map(s => s.lab))]
                .filter(l => l && l !== 'Otros').sort()
                .map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
            <select id="filter-real-periodo" onchange="filtrarRealizados()" style="font-size:12px">
              <option value="">Todos los períodos</option>
              ${[...new Set(realizadosList.map(s => s.reg.Periodo))].sort()
                .map(p => `<option value="${p}">${labelPeriodo(p)}</option>`).join('')}
            </select>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>Equipo</th><th>Operación</th><th>Período</th><th>Fecha</th><th>Realizado por</th><th>Supervisado por</th><th></th>
          </tr></thead>
          <tbody id="tbody-realizados">${_renderFilasRealizados(realizadosList)}</tbody>
        </table>
        <div id="real-empty" style="display:none;padding:20px;text-align:center;color:var(--text-muted)">Sin mantenimientos realizados con estos filtros.</div>
      </div>
    </div>` : ''}

    <!-- Tab: Planes -->
    ${puedePlanes ? `
    <div id="tab-planes" style="display:none">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Planes de mantenimiento configurados</div>
          <div class="card-actions">
            <div class="search-input">
              <span>🔍</span>
              <input type="text" placeholder="Buscar equipo u operación..." oninput="filtrarPlanesTabla(this.value)" id="filter-planes">
            </div>
            <button class="btn btn-primary" style="font-size:12px;white-space:nowrap" onclick="openModalPlan()">+ Plan</button>
          </div>
        </div>
        <table id="tabla-planes-mant">
          <thead><tr>
            <th>Equipo</th><th>Tipo</th><th>Periodicidad</th><th>Operación</th><th></th>
          </tr></thead>
          <tbody>${_renderFilasPlanesTabla()}</tbody>
        </table>
      </div>
    </div>` : ''}`;
}

function _renderFilasPlanesTabla(filtro = '') {
  const esGestorAdmin = puedeHacer('editarEquipos');
  const esProfesor    = getUserRole() === 'Profesor';
  // Profesor: solo planes de equipos de los que es responsable.
  const scope = esProfesor
    ? new Set(DATA.equipos.filter(e => esResponsableDeEquipo(e)).map(e => e.ID_Activo))
    : null;
  return DATA.planesMantenimiento.map(plan => {
    if (scope && !scope.has(plan.ID_Equipo)) return '';
    const eq = DATA.equipos.find(e => e.ID_Activo === plan.ID_Equipo);
    const label = eq
      ? `${eq.ID_Activo} – ${eq.Tipo_Equipo || ''} ${eq.Marca || ''}`.trim()
      : `${plan.ID_Equipo} ⚠️ ID no encontrado en inventario`;
    if (filtro && !label.toLowerCase().includes(filtro.toLowerCase()) &&
        !plan.Operacion.toLowerCase().includes(filtro.toLowerCase())) return '';
    const tipoBadge = plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
    const rowStyle = eq ? '' : 'background:#fff5f5';
    const idStyle  = eq ? '' : 'color:#dc2626';
    const puedeEditar = esGestorAdmin || (scope && scope.has(plan.ID_Equipo));
    return `<tr style="${rowStyle}">
      <td><strong style="${idStyle}">${label}</strong></td>
      <td><span class="badge ${tipoBadge}" style="font-size:10px">${plan.Tipo_Intervencion}</span></td>
      <td>${plan.Periodicidad}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</td>
      <td style="white-space:nowrap">
        ${puedeEditar ? `<button class="icon-btn" onclick="openModalPlan(null,'${plan.ID_Plan}')" title="Editar">✏️</button>
          <button class="icon-btn" onclick="eliminarPlan('${plan.ID_Plan}')" title="Eliminar">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function _renderFilasRealizados(lista) {
  if (!lista.length) return '';
  return lista.map(({ reg, equipo, plan }) => {
    const tipoBadge = plan && plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
    const eqTxt = equipo
      ? `<strong>${equipo.ID_Activo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${equipo.Tipo_Equipo||''} ${equipo.Marca||''}</span>`
      : `<strong>${reg.ID_Equipo}</strong>`;
    const oper = (plan && plan.Operacion) || '—';
    return `<tr>
      <td>${eqTxt}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${oper}"><span class="badge ${tipoBadge}" style="font-size:10px">${plan?.Tipo_Intervencion||'—'}</span> ${oper}</td>
      <td>${labelPeriodo(reg.Periodo)}</td>
      <td style="white-space:nowrap">${formatDate(reg.Fecha_Realizacion)||'—'}${reg.Resultado ? '<br>' + _badgeResultadoMant(reg.Resultado) : ''}</td>
      <td>${reg.Realizado_Por||'—'}</td>
      <td>${reg.Supervisado_Por||'—'}</td>
      <td style="white-space:nowrap"><button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModalEditarRegistroMant('${reg.ID_Registro}')">✏️ Editar</button></td>
    </tr>`;
  }).join('');
}

function _renderFilasPendientes(lista, canLog, canMarcar) {
  if (!lista.length) return '';
  return lista.map(s => {
    const tipoBadge = s.plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
    const instrKey = `pend-${s.plan.ID_Plan}-${s.periodo}`.replace(/[^a-z0-9]/gi,'_');
    const comoTexto = s.plan.Instrucciones || s.plan.Operacion || '';
    const instrRow = comoTexto
      ? `<tr id="mant-instr-${instrKey}" style="display:none"><td colspan="6" style="background:var(--bg);padding:10px 14px;font-size:12px;white-space:pre-line;line-height:1.7;border-bottom:2px solid var(--border)">${comoTexto}</td></tr>`
      : '';
    const alumBadge = _esSoloProfesorado(s.plan)
      ? `<span title="Reservado al profesorado: el alumnado no lo ve" style="display:inline-block;margin-left:4px;font-size:11px;padding:1px 6px;border-radius:10px;background:var(--bg);color:var(--text-muted);border:1px solid var(--border)">🔒 solo profesorado</span>`
      : '';
    const eje = s.ejecucion;
    const ejeN = eje && Array.isArray(eje.Pasos) ? eje.Pasos.filter(p => p.hecho).length : 0;
    const ejeTot = eje && Array.isArray(eje.Pasos) ? eje.Pasos.length : 0;
    const ejeBadge = eje
      ? `<span class="badge badge-orange" style="font-size:10px;margin-left:4px">▶ En curso ${ejeN}/${ejeTot}</span>`
      : '';
    const aplazado = s.marcador && s.marcador.Estado === 'aplazado' ? s.marcador : null;
    const aplBadge = aplazado
      ? `<span class="badge badge-orange" style="font-size:10px;margin-left:4px" title="${aplazado.Observaciones||''}">📅 Aplazado (previsto ${labelMesAnyo(aplazado.Aplazado_A)})</span>`
      : '';
    const args = `'${s.plan.ID_Plan}','${s.equipo.ID_Activo}','${s.periodo}','${s.curso}'`;
    return `<tr>
      <td><strong>${s.equipo.ID_Activo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${s.equipo.Tipo_Equipo||''} ${s.equipo.Marca||''}</span></td>
      <td><span class="badge ${tipoBadge}" style="font-size:10px">${s.plan.Tipo_Intervencion}</span>${alumBadge}${ejeBadge}${aplBadge}</td>
      <td>${s.plan.Periodicidad}</td>
      <td>${labelPeriodo(s.periodo)}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.plan.Operacion}">${s.plan.Operacion}</td>
      <td style="white-space:nowrap">
        ${comoTexto ? `<button class="btn btn-secondary" style="padding:2px 6px;font-size:11px" onclick="toggleMantInstr('${instrKey}')">▸ Cómo</button>` : ''}
        ${canLog ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px"
            onclick="openModalRegistrarMant(${args})">${eje ? `Continuar ${ejeN}/${ejeTot}` : 'Registrar'}</button>` : ''}
        ${canMarcar ? `<button class="btn btn-secondary" style="padding:2px 6px;font-size:11px" title="Opciones: alumnado, no aplica, aplazar" onclick="openModalMarcarMant(${args})">⋯</button>` : ''}
      </td>
    </tr>${instrRow}`;
  }).join('');
}

function _renderFilasVistoBueno(lista) {
  if (!lista.length) return '';
  return lista.map(({ reg, equipo, plan }) => {
    const eqTxt = equipo
      ? `<strong>${equipo.ID_Activo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${equipo.Tipo_Equipo||''} ${equipo.Marca||''}</span>`
      : `<strong>${reg.ID_Equipo}</strong>`;
    const pasos = Array.isArray(reg.Pasos) ? reg.Pasos : [];
    const hechos = pasos.filter(p => p.hecho).length;
    const noCumple = _pasosNoCumple(pasos);
    const pasosTxt = pasos.length
      ? `<span class="badge ${hechos === pasos.length && !noCumple.length ? 'badge-green' : 'badge-orange'}" style="font-size:10px">${hechos}/${pasos.length}</span>` +
        (noCumple.length ? `<br><span class="badge badge-red" style="font-size:10px;margin-top:3px;white-space:nowrap">⚠ ${noCumple.length} no cumple${noCumple.length > 1 ? 'n' : ''}</span>` : '')
      : '<span style="color:var(--text-muted)">—</span>';
    // Lo que no cumplió, a la vista de quien firma (texto del alumnado: escapado).
    const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // Qué se hizo con cada cosa que salió mal, y qué piezas se cambiaron: al firmar, lo que
    // lleva 🔩 pasa al historial del equipo como intervención.
    const ACC = { corregido: '🔧 corregido', intervencion: '🔩 pieza/ajuste', reparacion: '🚨 necesita reparación' };
    const noCumpleTxt = noCumple.map(p =>
      `<div style="font-size:11px;color:var(--danger);margin-top:2px">⚠ ${esc(p.texto)}${p.criterio ? ` — no cumple (${esc(p.criterio)})` : ''}: ${esc(p.nota || '—')}` +
      `${p.accion ? ` → ${ACC[p.accion]}${p.actuacion ? ': ' + esc(p.actuacion) : ''}` : ''}</div>`).join('') +
      pasos.map(p => _normPasoMant(p)).filter(p => p.tipo === 'sustituir' && p.hecho).map(p =>
      `<div style="font-size:11px;margin-top:2px">🔩 ${esc(p.texto)}${p.actuacion ? ': ' + esc(p.actuacion) : ''}</div>`).join('');
    const nIntVb = pasos.map(p => _normPasoMant(p)).filter(p => !p.id_intervencion &&
      ((p.tipo === 'sustituir' && p.hecho) || (p.resultado === 'no_cumple' && p.accion === 'intervencion'))).length;
    const intVbTxt = nIntVb ? `<div style="font-size:11px;margin-top:2px;color:var(--text-muted)">Al firmar, ${nIntVb} intervención(es) pasarán al historial del equipo.</div>` : '';
    // Medidas de la calculadora que cumplen (las que no, ya salen en la nota de arriba):
    // quien firma ve los números, no solo el veredicto.
    const medidasTxt = pasos.flatMap(p => Array.isArray(p.medidas) ? p.medidas : [])
      .filter(m => m && m.cumple === true && m.detalle)
      .map(m => `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">🧮 ${esc(m.magnitud)}: ${esc(m.detalle)}</div>`).join('');
    const obs = reg.Observaciones
      ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:2px;white-space:pre-line">${reg.Observaciones}</div>`
      : '';
    const vc = reg.Verificacion?.calculo;
    const verTxt = vc && typeof resumenVerificacion === 'function'
      ? `<div style="font-size:11px;margin-top:3px">🧪 Verificación: ${_vpBadgeResultado(vc.resultado)} <span style="color:var(--text-muted)">${esc(resumenVerificacion(vc))}</span></div>` : '';
    return `<tr>
      <td>${eqTxt}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(plan&&plan.Operacion)||''}">${(plan&&plan.Operacion)||'—'}</td>
      <td>${labelPeriodo(reg.Periodo)}</td>
      <td style="white-space:nowrap">${formatDate(reg.Fecha_Realizacion)||'—'}</td>
      <td>👨‍🎓 ${reg.Realizado_Por||'—'} ${_badgeResultadoMant(reg.Resultado)}${verTxt}${noCumpleTxt}${intVbTxt}${medidasTxt}${obs}</td>
      <td style="text-align:center">${pasosTxt}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-primary" style="padding:2px 10px;font-size:11px" onclick="darVistoBuenoMant('${reg.ID_Registro}')">✓ Firmar</button>
        <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" title="Devolver para rehacer" onclick="devolverMant('${reg.ID_Registro}')">↩ Devolver</button>
      </td>
    </tr>`;
  }).join('');
}

/** Firma un mantenimiento registrado por alumnado. El nombre del supervisor lo pone
 *  el servidor con el del docente que valida — nunca se teclea. */
async function darVistoBuenoMant(idRegistro) {
  showLoading('Firmando...');
  try {
    const { supervisado_por, intervenciones, aviso } = await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'visto_bueno', id_registro: idRegistro, aceptar: true,
    });
    await loadAllData();
    const nInt = (intervenciones || []).length;
    showToast(`Visto bueno dado — supervisa: ${supervisado_por}${nInt ? ` · ${nInt} intervención(es) en el historial del equipo` : ''}`, 'success');
    if (aviso) setTimeout(() => showToast(aviso, 'error'), 700);
    _refrescarTrasMant();
  } catch (e) {
    showToast(e.message || 'No se pudo firmar', 'error');
    console.error(e);
  }
  hideLoading();
}

/** Devuelve el mantenimiento al alumnado: vuelve a quedar en curso, con el motivo. */
async function devolverMant(idRegistro) {
  const motivo = prompt('¿Qué hay que corregir? (lo verá quien lo registró)', '');
  if (motivo === null) return;
  showLoading('Devolviendo...');
  try {
    await callEdgeFunction('gestionar-mantenimiento', {
      accion: 'visto_bueno', id_registro: idRegistro, aceptar: false, motivo,
    });
    await loadAllData();
    showToast('Devuelto: vuelve a quedar pendiente', 'success');
    _refrescarTrasMant();
  } catch (e) {
    showToast(e.message || 'No se pudo devolver', 'error');
    console.error(e);
  }
  hideLoading();
}

/** Firma de una tacada todo lo que espera visto bueno en pantalla. */
async function darVistoBuenoTodos() {
  const ids = _vistoBuenoCache.map(v => v.reg.ID_Registro);
  if (!ids.length) return;
  if (!confirm(`Vas a firmar ${ids.length} mantenimiento(s) como supervisora. Entrarán en el documento de calidad con tu nombre. ¿Seguir?`)) return;
  showLoading(`Firmando ${ids.length}...`);
  let fallos = 0;
  for (const id of ids) {
    try {
      await callEdgeFunction('gestionar-mantenimiento', { accion: 'visto_bueno', id_registro: id, aceptar: true });
    } catch (e) { fallos++; console.error(id, e); }
  }
  await loadAllData();
  hideLoading();
  showToast(fallos ? `${fallos} no se pudieron firmar` : `${ids.length} mantenimiento(s) firmados`, fallos ? 'error' : 'success');
  _refrescarTrasMant();
}

function _renderFilasMarcadores(lista) {
  if (!lista.length) return '';
  return lista.map(({ reg, equipo, plan }) => {
    const eqTxt = equipo
      ? `<strong>${equipo.ID_Activo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${equipo.Tipo_Equipo||''} ${equipo.Marca||''}</span>`
      : `<strong>${reg.ID_Equipo}</strong>`;
    const oper = (plan && plan.Operacion) || '—';
    const estadoTxt = reg.Estado === 'aplazado'
      ? `<span class="badge badge-orange" style="font-size:10px">📅 Aplazado a ${labelMesAnyo(reg.Aplazado_A)}</span>`
      : `<span class="badge badge-gray" style="font-size:10px">🚫 No aplica</span>`;
    return `<tr>
      <td>${eqTxt}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${oper}">${oper}</td>
      <td>${labelPeriodo(reg.Periodo)}</td>
      <td style="white-space:nowrap">${estadoTxt}</td>
      <td style="max-width:260px;white-space:pre-line">${reg.Observaciones||'—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secondary" style="padding:2px 6px;font-size:11px" title="Editar" onclick="openModalMarcarMant('${reg.ID_Plan}','${reg.ID_Equipo}','${reg.Periodo}','${reg.Curso_Academico}')">✏️</button>
        <button class="btn btn-secondary" style="padding:2px 6px;font-size:11px" title="Revertir a pendiente" onclick="revertirMarcadorMant('${reg.ID_Registro}')">↩</button>
      </td>
    </tr>`;
  }).join('');
}

// Buscador de equipo de las pestañas Pendientes y Realizados: casa con el ID, el
// tipo, la marca, el modelo y la ubicación, sin distinguir mayúsculas ni tildes.
function _mantSinTildes(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function _mantEquipoCoincide(equipo, idEquipo, texto) {
  const q = _mantSinTildes(texto).trim();
  if (!q) return true;
  const campos = equipo
    ? [equipo.ID_Activo, equipo.Tipo_Equipo, equipo.Marca, equipo.Modelo, equipo.Ubicacion]
    : [idEquipo];
  const hay = _mantSinTildes(campos.filter(Boolean).join(' '));
  // Cada palabra tecleada tiene que aparecer (en cualquier orden): «centrífuga 205».
  return q.split(/\s+/).every(p => hay.includes(p));
}

function filtrarPendientes() {
  const lab    = document.getElementById('filter-pend-lab')?.value || '';
  const periodo= document.getElementById('filter-pend-periodo')?.value || '';
  const texto  = document.getElementById('filter-pend-equipo')?.value || '';
  const canLog = puedeHacer('registrarMantenimiento');
  const canMarcar = puedeMarcarPeriodoMant();

  let lista = _pendientesCache;
  if (lab)     lista = lista.filter(s => s.lab === lab);
  if (periodo) lista = lista.filter(s => s.periodo === periodo);
  if (texto)   lista = lista.filter(s => _mantEquipoCoincide(s.equipo, s.equipo?.ID_Activo, texto));

  const tbody = document.getElementById('tbody-pendientes');
  const empty = document.getElementById('pend-empty');
  if (tbody) tbody.innerHTML = _renderFilasPendientes(lista, canLog, canMarcar);
  if (empty) empty.style.display = lista.length ? 'none' : '';
}

function filtrarPlanesTabla(val) {
  const tbody = document.querySelector('#tabla-planes-mant tbody');
  if (tbody) tbody.innerHTML = _renderFilasPlanesTabla(val);
}

function filtrarRealizados() {
  const lab     = document.getElementById('filter-real-lab')?.value || '';
  const periodo = document.getElementById('filter-real-periodo')?.value || '';
  const texto   = document.getElementById('filter-real-equipo')?.value || '';
  let lista = _realizadosCache;
  if (lab)     lista = lista.filter(s => s.lab === lab);
  if (periodo) lista = lista.filter(s => s.reg.Periodo === periodo);
  if (texto)   lista = lista.filter(s => _mantEquipoCoincide(s.equipo, s.reg.ID_Equipo, texto));
  const tbody = document.getElementById('tbody-realizados');
  const empty = document.getElementById('real-empty');
  if (tbody) tbody.innerHTML = _renderFilasRealizados(lista);
  if (empty) empty.style.display = lista.length ? 'none' : '';
}

function switchMantTab(tab) {
  const tabs = ['pendientes', 'vistobueno', 'realizados', 'planes'];
  tabs.forEach(t => {
    const panel = document.getElementById(`tab-${t}`);
    const btn   = document.getElementById(`tab-btn-${t}`);
    if (!panel) return;
    const active = t === tab;
    panel.style.display = active ? '' : 'none';
    if (btn) {
      btn.style.borderBottomColor = active ? 'var(--accent)' : 'transparent';
      btn.style.color = active ? 'var(--accent)' : 'var(--text-muted)';
    }
  });
}

function toggleMantInstr(key) {
  const el = document.getElementById(`mant-instr-${key}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ============================================================
// EXPORTAR MODELO DE CALIDAD
// ============================================================
async function exportarModeloCalidad(cursoAcademico) {
  const curso = cursoAcademico || getCursoAcademico();
  const registros = DATA.registroMantenimientos.filter(r => r.Curso_Academico === curso && r.Estado === 'finalizado');

  // "01/2026" para la fecha destino de un aplazamiento (YYYY-MM-DD → MM/YYYY).
  function _mesAnyoCorto(fechaIso) {
    if (!fechaIso) return '';
    const [y, m] = String(fechaIso).split('-');
    return m && y ? `${m}/${y}` : fechaIso;
  }
  const planesActivos = DATA.planesMantenimiento.filter(p => p.Activo !== 'FALSE');

  // Devuelve TODOS los periodos del curso (incluidos futuros), para el documento anual
  function getPeriodosCursoCompleto(plan, equipo) {
    const [añoInicio, añoFin] = curso.split('-').map(Number);
    const meses = getMesesCurso(curso);
    switch (plan.Periodicidad) {
      case 'Mensual':    return meses.map(m => m.str);
      // Por evaluaciones: ya vienen en orden cronológico (ver periodosPorEvaluacion).
      case 'Trimestral': case 'Pretemporada': case 'Posttemporada':
        return periodosPorEvaluacion(plan, equipo, curso).map(p => p.periodo);
      case 'Semestral': {
        const idx = _esMomentoFin(plan) ? [4, 9] : [0, 5];
        return meses.filter((_, i) => idx.includes(i)).map(m => m.str);
      }
      case 'Anual': case 'Bianual': case 'Trianual': case 'Quinquenal': case 'Cada 2 años': {
        if (!_esCursoDebidoMultianual(plan, curso)) return [];
        const mes = _esMomentoFin(plan) ? meses[meses.length - 1] : meses[0];
        return [mes.str];
      }
      default: return [];
    }
  }

  function denominacion(eq) {
    return [eq.Tipo_Equipo, eq.Marca, eq.Modelo, eq.ID_Activo ? `(${eq.ID_Activo})` : ''].filter(Boolean).join(' ');
  }

  function ubicacionTexto(idUbicacion) {
    const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === idUbicacion);
    if (!u) return idUbicacion || '';
    return [u.Laboratorio_Aula, u.Zona, u.Subzona].filter(Boolean).join(', ');
  }

  const VALID_PERIODICIDADES = new Set(['Diaria','Semanal','Quincenal','Mensual','Bimensual','Trimestral','Semestral','Anual','Bianual','Trianual','Quinquenal','Decenal']);
  function normalizePeriodicidad(p) {
    return VALID_PERIODICIDADES.has(p) ? p : 'Anual';
  }

  // Arranque, cierre y trimestrales: la fecha exacta de la evaluación (inicio, o fin
  // en la revisión de cierre). El resto, el día 1 de su mes.
  function periodoAFecha(periodo, plan, equipo) {
    const porEval = periodosPorEvaluacion(plan, equipo, curso).find(p => p.periodo === periodo);
    if (porEval) {
      const f = porEval.fecha;
      return `${String(f.getDate()).padStart(2,'0')}/${String(f.getMonth() + 1).padStart(2,'0')}/${f.getFullYear()}`;
    }
    const [y, m] = periodo.split('-');
    return `01/${m}/${y}`;
  }

  // Una fila por plan (cada plan tiene su propia fila con su ID_Plan en la denominación)
  const porLab = { 'LAB 201': [], 'LAB 203': [], 'LAB 205': [], 'LAB 207': [], 'LAB 209': [] };

  DATA.equipos.forEach(eq => {
    const hoja = _labAHoja(_detectarLabEquipo(eq));
    if (!hoja) return;
    const planesEq = planesActivos.filter(p => p.ID_Equipo === eq.ID_Activo);
    if (!planesEq.length) return;

    planesEq.forEach(plan => {
      const tipo = plan.Tipo_Intervencion;
      if (!tipo) return;

      // Sin .sort(): las claves por evaluación ("evaluacion1-…") no ordenan bien como
      // texto, y getPeriodosCursoCompleto ya las devuelve en orden.
      const periodosUnicos = [...new Set(getPeriodosCursoCompleto(plan, eq))];
      if (!periodosUnicos.length) return;

      const previstas  = periodosUnicos.map(p => periodoAFecha(p, plan, eq)).join(', ');
      // Nota "no aplica"/"aplazado" por periodo, para volcarla a observaciones (col. J).
      const notasMarcador = [];
      const realizadas = periodosUnicos
        .map(p => {
          const reg = getRegistroMant(plan.ID_Plan, curso, p);
          // Micropipetas: el resultado de la verificación (OK / AJUSTADA / RETIRADA) junto a la revisión.
          if (reg) {
            // Resultado del mantenimiento (desde 2026-11-25) en H; en J, por qué no fue «apto»:
            // las intervenciones que salieron de sus pasos y lo que necesita reparación.
            const res = _RESULTADO_MANT[reg.Resultado];
            if (res && reg.Resultado !== 'apto') {
              const ps = (reg.Pasos || []).map(x => _normPasoMant(x));
              const det = [
                ...ps.filter(x => x.resultado === 'no_cumple' && x.accion === 'intervencion')
                  .map(x => `${x.actuacion || x.texto}${x.id_intervencion ? ` (${x.id_intervencion})` : ''}`),
                ...ps.filter(x => x.resultado === 'no_cumple' && x.accion === 'reparacion').map(x => `${x.texto}: ${x.nota}`),
              ];
              notasMarcador.push(`${labelPeriodo(p)}: ${res.txt.toLowerCase()}${det.length ? ' — ' + det.join('; ') : ''}`);
            }
            return formatDate(reg.Fecha_Realizacion) + (res ? ` (${res.txt.toLowerCase()})` : '') +
              (reg.Verificacion?.calculo?.calidad ? ` (verificación: ${reg.Verificacion.calculo.calidad})` : '');
          }
          const m = getMarcadorMant(plan.ID_Plan, curso, p);
          if (!m) return '';
          if (m.Estado === 'aplazado') {
            notasMarcador.push(`${labelPeriodo(p)}: aplazado a ${_mesAnyoCorto(m.Aplazado_A)}${m.Observaciones ? ' — ' + m.Observaciones : ''}`);
            return `Aplazado a ${_mesAnyoCorto(m.Aplazado_A)}`;
          }
          notasMarcador.push(`${labelPeriodo(p)}: no aplica${m.Observaciones ? ' — ' + m.Observaciones : ''}`);
          return 'No aplica';
        })
        .filter(Boolean)
        .join(', ');

      const incAbierta = DATA.incidencias.find(inc =>
        (inc.Estado === 'Abierta' || inc.Estado === 'En gestión') &&
        inc.Equipo && (inc.Equipo === eq.ID_Activo || inc.Equipo.startsWith(eq.ID_Activo + ' '))
      );
      const observaciones = [
        incAbierta ? (incAbierta.Descripcion_Problema || '') + ' (' + incAbierta.ID_Incidencia + ')' : '',
        ...notasMarcador,
      ].filter(Boolean).join(' · ');

      porLab[hoja].push({
        eq, plan, tipo,
        operacion:    plan.Operacion || '',
        periodicidad: normalizePeriodicidad(plan.Periodicidad),
        previstas, realizadas, observaciones,
      });
    });
  });

  const totalFilas = Object.keys(porLab).reduce((n, l) => n + porLab[l].length, 0);
  if (totalFilas === 0) {
    if (planesActivos.length === 0) {
      showToast('No se cargaron planes desde la hoja Planes_Mantenimiento. Recarga la página.', 'error');
    } else {
      const labs = [...new Set(DATA.equipos.map(eq => _detectarLabEquipo(eq)).filter(Boolean))];
      showToast(`${planesActivos.length} planes activos cargados, pero ningún equipo está en labs reconocidos. Labs detectados: ${labs.join(', ') || 'ninguno'}`, 'error');
    }
    console.warn('[exportar] planesActivos:', planesActivos.length, '| porLab:', JSON.stringify(Object.fromEntries(Object.entries(porLab).map(([k,v])=>[k,v.length]))));
    return;
  }

  // Cargar plantilla con JSZip para editar el XML interno directamente
  // (preserva 100% del formato original: estilos, gráficas, colores, merges)
  showToast('Generando documento…', 'info');
  let zip;
  try {
    const resp = await fetch('./assets/templates/MD84MAN01_Plan_mantemento_Sanidade.xlsx');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    zip = await JSZip.loadAsync(await resp.arrayBuffer());
  } catch (e) {
    showToast('No se pudo cargar la plantilla: ' + e.message, 'error');
    return;
  }

  // Portada=sheet1, LAB201=sheet2, LAB203=sheet3, LAB205=sheet4, LAB207=sheet5,
  // LAB209=sheet6 (hoja añadida a la plantilla el 26/10/2026 como copia de LAB 207)
  const SHEET_FILES = {
    'LAB 201': 'xl/worksheets/sheet2.xml',
    'LAB 203': 'xl/worksheets/sheet3.xml',
    'LAB 205': 'xl/worksheets/sheet4.xml',
    'LAB 207': 'xl/worksheets/sheet5.xml',
    'LAB 209': 'xl/worksheets/sheet6.xml',
  };

  function xmlEsc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Rellena una celda preservando su estilo s="X". Usa inline strings para no
  // tocar sharedStrings.xml. Celdas vacías se dejan sin modificar.
  function fillCell(xml, cellRef, value) {
    if (!value) return xml;
    const v = xmlEsc(value);
    return xml.replace(
      new RegExp(`<c r="${cellRef}"([^>]*?)(?:\\s*/>|>[\\s\\S]*?<\\/c>)`),
      (match) => {
        const s = (match.match(/\bs="([^"]*)"/) || [])[1];
        const styleAttr = s ? ` s="${s}"` : '';
        return `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t>${v}</t></is></c>`;
      }
    );
  }

  const DATA_ROW = 11; // fila 10 = cabecera, 11 = primer dato

  const supervisores = DATA.usuarios
    .filter(u => (u.Rol === 'Administrador' || u.Rol === 'Gestor') && u.Activo !== 'FALSE')
    .map(u => u.Nombre).filter(Boolean).join(', ');

  // ── Correcciones de fuente en styles.xml ──────────────────────────────
  // El template tiene 3 zonas: ~filas 11-32 (color correcto), ~33-65 (theme="1"=negro),
  // ~66+ (Arial 8pt negro). Normalizamos todas las fuentes de una vez.
  let stylesXml = await zip.file('xl/styles.xml').async('string');

  // 1. Arial (cualquier variante) → Xunta Sans
  stylesXml = stylesXml.replace(/<name val="Arial[^"]*"\/>/g, '<name val="Xunta Sans"/>');

  // 2. color theme="1" = dk1 = #000000 en este tema → azul corporativo
  stylesXml = stylesXml.replace(/<color theme="1"\/>/g, '<color rgb="FF002B4A"/>');

  // 3. Fuentes sin <color> explícito → añadir azul corporativo
  stylesXml = stylesXml.replace(/<font>([\s\S]*?)<\/font>/g, (m, inner) =>
    inner.includes('<color') ? m : m.replace('</font>', '<color rgb="FF002B4A"/></font>')
  );

  // 4. Tamaño 8pt → 10pt (encabezados y filas de zonas tardías del template)
  stylesXml = stylesXml.replace(/<sz val="8"\/>/g, '<sz val="10"/>');

  zip.file('xl/styles.xml', stylesXml);
  // ──────────────────────────────────────────────────────────────────────

  for (const [labKey, sheetFile] of Object.entries(SHEET_FILES)) {
    const items = porLab[labKey] || [];
    let xml = await zip.file(sheetFile).async('string');

    items.forEach(({ eq, plan, tipo, operacion, periodicidad, previstas, realizadas, observaciones }, i) => {
      const r = DATA_ROW + i;
      const labNum = ((eq.Ubicacion || '').match(/\b(\d{3})\b/) || [])[1] || eq.Ubicacion || '';
      const responsable = (eq.Responsable || '').trim() || supervisores;
      const denom = plan.ID_Plan ? `${denominacion(eq)} · ${plan.ID_Plan}` : denominacion(eq);
      xml = fillCell(xml, `A${r}`, denom);
      xml = fillCell(xml, `B${r}`, labNum);
      xml = fillCell(xml, `C${r}`, responsable);
      xml = fillCell(xml, `D${r}`, tipo);
      xml = fillCell(xml, `E${r}`, periodicidad);
      xml = fillCell(xml, `F${r}`, operacion);
      xml = fillCell(xml, `G${r}`, previstas);
      xml = fillCell(xml, `H${r}`, realizadas);
      xml = fillCell(xml, `I${r}`, supervisores);
      xml = fillCell(xml, `J${r}`, observaciones);
    });

    zip.file(sheetFile, xml);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MD84MAN01_Plan_mantemento_${curso}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('Documento generado correctamente', 'success');
}

async function exportarInventario(cursoAcademico) {
  const curso = cursoAcademico || getCursoAcademico();

  // Los equipos dados de baja se conservan en la app (incidencias e historial),
  // pero ya no forman parte del inventario del curso.
  const equipos = DATA.equipos.filter(e => e.Estado_Operativo !== 'Dado de baja').sort((a, b) => {
    const ua = a.Ubicacion || '', ub = b.Ubicacion || '';
    if (ua !== ub) return ua.localeCompare(ub, 'es');
    return (a.Tipo_Equipo || '').localeCompare(b.Tipo_Equipo || '', 'es');
  });

  if (!equipos.length) {
    showToast('No hay equipos cargados.', 'error');
    return;
  }

  showToast('Generando inventario…', 'info');

  let zip;
  try {
    const resp = await fetch('./assets/templates/CIFP Manuel Antonio_Inventarios_Curso 2025-26.xlsx');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    zip = await JSZip.loadAsync(await resp.arrayBuffer());
  } catch (e) {
    showToast('No se pudo cargar la plantilla: ' + e.message, 'error');
    return;
  }

  const SHEET = 'xl/worksheets/sheet2.xml';
  let xml = await zip.file(SHEET).async('string');

  function xmlEsc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function makeRow(r, denom, ubicacion, marcaModelo, serie, desc) {
    const cel = (ref, s, val) => val
      ? `<c r="${ref}" s="${s}" t="inlineStr"><is><t>${xmlEsc(val)}</t></is></c>`
      : `<c r="${ref}" s="${s}"/>`;
    return `<row r="${r}" spans="1:6">` +
      cel(`A${r}`, '14', denom) +
      cel(`B${r}`, '15', ubicacion) +
      cel(`C${r}`, '15', marcaModelo) +
      cel(`D${r}`, '15', serie) +
      `<c r="E${r}" s="15"><v>1</v></c>` +
      cel(`F${r}`, '14', desc) +
      `</row>`;
  }

  // Eliminar filas vacías del template (9-21) y añadir todas las reales
  for (let r = 9; r <= 21; r++) {
    xml = xml.replace(new RegExp(`<row r="${r}"[^>]*>[\\s\\S]*?<\\/row>`), '');
  }

  function labDesdeUbicacion(ubicacion) {
    const m = (ubicacion || '').match(/\b(\d{3})\b/);
    return m ? m[1] : (ubicacion || '');
  }

  const rows = equipos.map((eq, i) => {
    const marcaModelo = [eq.Marca, eq.Modelo].filter(Boolean).join(' ');
    const serie       = eq.Numero_Serie ? String(eq.Numero_Serie).replace(/\.0+$/, '') : '';
    const incAbierta  = DATA.incidencias.find(inc =>
      (inc.Estado === 'Abierta' || inc.Estado === 'En gestión') &&
      inc.Equipo && (inc.Equipo === eq.ID_Activo || inc.Equipo.startsWith(eq.ID_Activo + ' '))
    );
    let desc = incAbierta
      ? 'Incidencia abierta. ' + incAbierta.Impacto + ' (' + incAbierta.ID_Incidencia + ')'
      : (eq.Estado_Operativo || '');
    // Si el SAT se lo llevó y aún no ha vuelto, el equipo no está en el laboratorio:
    // conviene que el inventario lo diga, no solo el estado operativo.
    const intFuera = typeof intervencionEquipoFuera === 'function' ? intervencionEquipoFuera(eq.ID_Activo) : null;
    if (intFuera) {
      desc = (desc ? desc + '. ' : '') + 'Equipo retirado por el servicio técnico' +
        (intFuera.Fecha_Retirada ? ' el ' + formatDate(intFuera.Fecha_Retirada) : '') + ' (no está en el centro)';
    }
    const denom = [eq.Tipo_Equipo, eq.ID_Activo ? `(${eq.ID_Activo})` : ''].filter(Boolean).join(' ');
    return makeRow(9 + i, denom, labDesdeUbicacion(eq.Ubicacion), marcaModelo, serie, desc);
  }).join('');

  xml = xml.replace('</sheetData>', rows + '</sheetData>');
  zip.file(SHEET, xml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `Inventario_Sanidade_${curso}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('Inventario generado correctamente', 'success');
}
