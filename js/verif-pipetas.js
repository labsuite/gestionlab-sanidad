// ═══════════════════════════════════════════════════════════════════════════════
// Verificación anual de las micropipetas (2026-11-24)
// Encargo del laboratorio: ENCARGO_calculos_verificacion_micropipetas.md. Ver
// docs/modulo-verificacion-pipetas.md.
//
// - Página «Verificación de micropipetas»: preparación del curso, sesiones (con la validación
//   del método), datos de cada pipeta y la página HTML para recoger datos sin conexión.
// - Formulario de la verificación dentro de «Ejecutar mantenimiento» (revisión anual y bianual
//   de cada pipeta): réplicas por volumen y canal, cálculo, decisión y pasos marcados por la app.
//
// El cálculo NO está aquí: es window.VP (supabase/functions/_shared/verif_pipetas.js, el mismo
// módulo que usa el servidor; index.html lo carga como módulo). El servidor vuelve a calcular
// todo al guardar: lo de esta pantalla es para ver el resultado mientras se escribe.
// ═══════════════════════════════════════════════════════════════════════════════

const _vpEsc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _vpEsStaff = () => ['Profesor', 'Gestor', 'Administrador'].includes(getUserRole());
const _vpCurso = () => _vpCursoElegido || getCursoAcademico();
let _vpCursoElegido = null;

/** El módulo de cálculo se carga como módulo (diferido): esperar a que esté. */
function _vpListo() {
  if (window.VP) return true;
  showToast('Cargando el cálculo de la verificación… vuelve a intentarlo en un momento', '');
  return false;
}

// ── Estado editable (preparación, sesión, verificación) ──────────────────────
const _vpEstado = { prep: null, ses: null, ver: null };

function _vpGet(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function _vpPut(obj, path, valor) {
  const ks = path.split('.');
  let o = obj;
  ks.slice(0, -1).forEach((k, i) => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[k];
  });
  o[ks[ks.length - 1]] = valor;
}

/**
 * Campo numérico ligado al estado: comprueba el dato al escribirlo (mismas reglas que la
 * página HTML y que el servidor, VP.comprobarDato) y avisa al lado.
 */
function _vpIn(root, path, tipo, opts = {}) {
  const v = _vpGet(_vpEstado[root], path) ?? '';
  const ctx = opts.ctx ? ` data-ctx='${_vpEsc(JSON.stringify(opts.ctx))}'` : '';
  return `<span class="vp-campo"><input class="vp-in" inputmode="decimal" autocomplete="off" data-root="${root}" data-path="${_vpEsc(path)}"
    data-tipo="${tipo}"${ctx} value="${_vpEsc(v)}" placeholder="${_vpEsc(opts.ph || '')}" style="${opts.ancho ? 'width:' + opts.ancho : ''}"
    oninput="_vpSet(this)" onblur="_vpComprobarCampo(this)"><span class="vp-msg"></span></span>`;
}
function _vpTxt(root, path, opts = {}) {
  const v = _vpGet(_vpEstado[root], path) ?? '';
  return `<input class="vp-in" data-root="${root}" data-path="${_vpEsc(path)}" data-tipo="texto" value="${_vpEsc(v)}"
    placeholder="${_vpEsc(opts.ph || '')}" oninput="_vpSet(this)" style="width:100%">`;
}

function _vpSet(el) {
  _vpPut(_vpEstado[el.dataset.root], el.dataset.path, el.value);
  if (el.dataset.tipo !== 'texto') _vpComprobarCampo(el, true);
  _vpRefrescar(el.dataset.root);
}

/** Comprueba un campo y pinta el mensaje (error en rojo, aviso en ámbar). */
function _vpComprobarCampo(el, mientrasEscribe) {
  if (!window.VP || el.dataset.tipo === 'texto') return;
  const msg = el.parentElement.querySelector('.vp-msg');
  const ctx = el.dataset.ctx ? JSON.parse(el.dataset.ctx) : {};
  const tipo = el.dataset.tipo;
  const r = el.value.trim() === '' ? {} : VP.comprobarDato(tipo === 'numero' ? 'masa' : tipo, el.value, { ...ctx, opcional: true });
  // Mientras se escribe, el aviso de «tres decimales» molesta: se enseña al salir del campo.
  const aviso = r.aviso && !(mientrasEscribe && /tres decimales/.test(r.aviso)) ? r.aviso : '';
  el.classList.toggle('vp-mal', !!r.error);
  el.classList.toggle('vp-dudoso', !r.error && !!aviso);
  if (msg) { msg.textContent = r.error || aviso || ''; msg.className = 'vp-msg ' + (r.error ? 'vp-err' : aviso ? 'vp-aviso' : ''); }
}

function _vpRefrescar(root) {
  if (root === 'prep') _vpPintarResultadosPrep();
  if (root === 'ses') _vpPintarResultadosSesion();
  if (root === 'ver') _vpPintarResultadosVer();
}

const _vpBadge = (ok, siTxt = 'Cumple', noTxt = 'No cumple') => ok === null || ok === undefined
  ? '<span class="badge badge-gray">Falta</span>'
  : ok ? `<span class="badge badge-green">✓ ${siTxt}</span>` : `<span class="badge badge-red">✗ ${noTxt}</span>`;
const _vpF = (x, d = 2, s = false) => window.VP ? VP.fmt(x, d, s) : String(x ?? '—');

// ── Datos de la base ─────────────────────────────────────────────────────────
const _vpParDe = idEquipo => (DATA.verifParametros || []).find(p => p.id_activo === idEquipo) || null;
const _vpPrepDe = curso => (DATA.verifPreparaciones || []).find(p => p.curso_academico === curso) || null;
const _vpSesionesDe = curso => (DATA.verifSesiones || []).filter(s => s.curso_academico === curso)
  .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.creado).localeCompare(String(b.creado)));

/** Contexto de cálculo de una sesión con lo que hay en DATA (espejo de recalcularSesionesCurso). */
function _vpCtxSesion(ses) {
  const curso = ses.curso_academico;
  const prepRow = _vpPrepDe(curso);
  const prep = VP.calcularPreparacion(prepRow?.datos || {});
  const anteriores = {}, validaciones = [];
  let cursoValidado = false;
  for (const s of _vpSesionesDe(curso)) {
    if (s.id === ses.id) break;
    if (ses.id == null && String(s.fecha) > String(ses.fecha)) break;
    for (const [idT, t] of Object.entries(s.datos?.tubos || {})) {
      const c = VP.leerNumero(t?.m_cierre).valor ?? VP.leerNumero(t?.m_ahora).valor;
      if (c !== undefined && c !== null) anteriores[idT] = c;
    }
    if (s.resultados?.validacion) validaciones.push(s.resultados.validacion);
    if (s.resultados?.validacion?.ok) cursoValidado = true;
  }
  const propia = ses.datos?.validacion ? [VP.calcularValidacion(ses.datos.validacion, {})] : [];
  return { prep, tubosPrep: prepRow?.tubos || [], anteriores, repBalanzas: VP.repetibilidadBalanzas(validaciones.concat(propia)), cursoValidado };
}

/** Resultados de las sesiones para calcular una verificación (los del servidor). */
function _vpResultadosSesiones() {
  const m = {};
  for (const s of DATA.verifSesiones || []) m[s.id] = s.resultados || {};
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA «VERIFICACIÓN DE MICROPIPETAS»
// ═══════════════════════════════════════════════════════════════════════════════
let _vpFiltroPipetas = '';

function renderVerifPipetas() {
  const cont = document.getElementById('page-verif-pipetas');
  if (!cont) return;
  if (!window.VP) { cont.innerHTML = '<div class="card" style="padding:20px">Cargando…</div>'; setTimeout(renderVerifPipetas, 300); return; }
  const curso = _vpCurso();
  const staff = _vpEsStaff();
  const prepRow = _vpPrepDe(curso);
  const prep = VP.calcularPreparacion(prepRow?.datos || {});
  const sesiones = _vpSesionesDe(curso);
  const cursos = [...new Set([getCursoAcademico(), ...(DATA.verifPreparaciones || []).map(p => p.curso_academico), ...(DATA.verifSesiones || []).map(s => s.curso_academico)])].sort().reverse();
  const usos = _vpPipetasPorSesion();
  const validado = sesiones.some(s => s.resultados?.validacion?.ok);

  const filaSesion = s => {
    const r = s.resultados || {};
    const pip = usos[s.id] || [];
    return `<tr>
      <td><strong>${formatDate(s.fecha)}</strong>${s.bloque ? `<div style="font-size:11px;color:var(--text-muted)">Bloque ${_vpEsc(s.bloque)}</div>` : ''}</td>
      <td>${r.valida_fot ? '<span class="badge badge-green">Fotométrica ✓</span>' : '<span class="badge badge-orange">Fotométrica ✗</span>'}
          ${r.valida_grav ? '<span class="badge badge-green">Gravimétrica ✓</span>' : '<span class="badge badge-orange">Gravimétrica ✗</span>'}
          ${r.validacion ? (r.validacion.ok ? ' <span class="badge badge-blue">Validación ✓</span>' : ' <span class="badge badge-red">Validación ✗</span>') : ''}
          ${!r.valida_fot && (r.motivos_fot || []).length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">${_vpEsc(r.motivos_fot.slice(0, 3).join(' · '))}</div>` : ''}</td>
      <td style="font-size:12px">${pip.length ? pip.map(_vpEsc).join(', ') : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><div class="row-actions">
        <button class="icon-btn" title="${staff ? 'Editar' : 'Ver'}" onclick="openModalVerifSesion('${s.id}')">${staff ? '✏️' : '👁'}</button>
        ${staff && !pip.length ? `<button class="icon-btn" title="Borrar" onclick="eliminarVerifSesion('${s.id}')">🗑️</button>` : ''}
      </div></td></tr>`;
  };

  cont.innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn btn-secondary btn-sm" onclick="showPage('mantenimiento')">← Volver a Mantenimiento</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Verificación anual de las micropipetas</div>
        <div class="card-actions">
          <select class="filter" onchange="_vpCursoElegido=this.value;renderVerifPipetas()">
            ${cursos.map(c => `<option value="${c}" ${c === curso ? 'selected' : ''}>Curso ${c}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" onclick="descargarPaginaRecogidaVerif()">⬇️ Página para recoger datos sin conexión</button>
        </div>
      </div>
      <div style="padding:0 16px 14px;font-size:13px;color:var(--text-soft);line-height:1.55">
        La verificación de cada pipeta se hace en su <strong>revisión anual</strong> (Mantenimiento): allí se meten las pesadas y las
        lecturas, y GestionLab calcula y decide (OK, completar, ajustar o retirar). Aquí van la <strong>preparación del curso</strong>
        (disoluciones de colorante y puntos de la recta) y las <strong>sesiones</strong> de cada día, comunes a todas las pipetas
        que se verifican ese día. ${validado ? '' : '<br><strong>⚠ Este curso aún no hay una sesión con la validación del método (anexo A, 8):</strong> hasta entonces no se puede dar por buena ninguna verificación fotométrica.'}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Preparación del curso ${curso}</div>
        <div class="card-actions">${staff ? `<button class="btn ${prepRow ? 'btn-secondary' : 'btn-primary'}" onclick="openModalVerifPrep()">${prepRow ? '✏️ Editar la preparación' : '+ Registrar la preparación'}</button>` : ''}</div>
      </div>
      <div style="padding:0 16px 14px;font-size:13px;line-height:1.6">
        ${prepRow ? `
          <div>Factores: <strong>F_B</strong> ${_vpF(prep.F_B, 5)} · <strong>F_C</strong> ${_vpF(prep.F_C, 5)}${prep.F_C2 ? ` · <strong>F_C (2.º lote)</strong> ${_vpF(prep.F_C2, 5)}` : ''}
            · <strong>f_D1</strong> ${_vpF(prep.f_D1, 6)} · <strong>f_D2</strong> ${_vpF(prep.f_D2, 7)}</div>
          <div>Puntos de la recta: ${prep.P.map((f, i) => `P${i + 1} ${f === null ? '—' : _vpF(f, 8)}`).join(' · ')}</div>
          <div style="color:var(--text-muted);font-size:12px">${(prepRow.tubos || []).length} tubos congelados · registrada por ${_vpEsc(prepRow.registrado_por || '—')}</div>`
        : '<span style="color:var(--text-muted)">Sin registrar. Hace falta para el método fotométrico (las pipetas que solo van por la balanza no la necesitan).</span>'}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Sesiones de verificación</div>
        <div class="card-actions">${staff ? `<button class="btn btn-primary" onclick="openModalVerifSesion()">+ Nueva sesión</button>` : ''}</div>
      </div>
      ${sesiones.length ? `<table><thead><tr><th>Fecha</th><th>Validez</th><th>Pipetas verificadas</th><th></th></tr></thead>
        <tbody>${sesiones.slice().reverse().map(filaSesion).join('')}</tbody></table>`
      : '<div style="padding:0 16px 16px;color:var(--text-muted);font-size:13px">Todavía no hay sesiones este curso.</div>'}
    </div>

    ${_vpHtmlExtraordinarias(staff)}

    <div class="card">
      <div class="card-header">
        <div class="card-title">Micropipetas (${(DATA.verifParametros || []).length})</div>
        <div class="card-actions"><div class="search-input"><span>🔍</span>
          <input type="text" placeholder="Código, marca o rango…" value="${_vpEsc(_vpFiltroPipetas)}" oninput="_vpFiltroPipetas=this.value;_vpPintarPipetas()"></div></div>
      </div>
      <div id="vp-lista-pipetas"></div>
    </div>`;
  _vpPintarPipetas();
}

/** Pipetas medidas en cada sesión (por los registros que la citan). */
function _vpPipetasPorSesion() {
  const m = {};
  const extras = (DATA.verifExtraordinarias || []).map(x => ({ ID_Equipo: x.id_equipo, Verificacion: x.verificacion }));
  for (const r of (DATA.registroMantenimientos || []).concat(extras)) {
    for (const f of r.Verificacion?.fases || []) {
      for (const v of Object.values(f.volumenes || {})) {
        if (!v?.id_sesion) continue;
        (m[v.id_sesion] = m[v.id_sesion] || []);
        if (!m[v.id_sesion].includes(r.ID_Equipo)) m[v.id_sesion].push(r.ID_Equipo);
      }
    }
  }
  return m;
}

/** Última verificación con resultado de una pipeta (finalizada o a la espera de visto bueno),
 *  de su revisión anual o extraordinaria tras una reparación (`extra: true`). */
function ultimaVerificacionPipeta(idEquipo) {
  const extras = (DATA.verifExtraordinarias || [])
    .filter(x => x.id_equipo === idEquipo && x.estado === 'finalizada' && x.verificacion?.calculo?.final)
    .map(x => ({ ID_Equipo: x.id_equipo, Fecha_Realizacion: x.fecha, Estado: 'finalizado', Verificacion: x.verificacion, extra: true, id: x.id }));
  return (DATA.registroMantenimientos || [])
    .filter(r => r.ID_Equipo === idEquipo && r.Verificacion?.calculo?.final && (r.Estado === 'finalizado' || r.Estado === 'pendiente_vb'))
    .concat(extras)
    .sort((a, b) => String(b.Fecha_Realizacion).localeCompare(String(a.Fecha_Realizacion)))[0] || null;
}

/** Resumen de una verificación para la ficha y el visto bueno: «200 µl: es +0,17 %, CV 0 % · …». */
function resumenVerificacion(calculo) {
  if (!calculo || !window.VP) return '';
  const ultima = calculo.fases?.[calculo.fases.length - 1];
  return Object.entries(ultima?.volumenes || {}).map(([clave, v]) => {
    const lim = (calculo.limites || []).find(l => l.clave === clave) || {};
    return v.canales.map((c, i) => `${VP.fmt(lim.v, lim.v < 10 ? 1 : 0)} µl${v.canales.length > 1 ? ` c${i + 1}` : ''}: es ${VP.fmt(c.es, 2, true)} %, CV ${VP.fmt(c.cvCorr, 2)} %`).join(' · ');
  }).join(' · ');
}

function _vpPintarPipetas() {
  const cont = document.getElementById('vp-lista-pipetas');
  if (!cont) return;
  const q = _vpFiltroPipetas.toLowerCase().trim();
  const staff = _vpEsStaff();
  const lista = (DATA.verifParametros || []).slice()
    .filter(p => !q || [p.id_activo, p.marca_modelo, p.rango].join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.id_activo.localeCompare(b.id_activo, 'es', { numeric: true }));
  cont.innerHTML = `<table><thead><tr><th>Pipeta</th><th>Volúmenes de prueba</th><th>Última verificación</th></tr></thead><tbody>${lista.map(p => {
    const ult = ultimaVerificacionPipeta(p.id_activo);
    const calc = ult?.Verificacion?.calculo;
    const porComprobar = /^por comprobar/i.test(p.ajuste_usuario || '');
    const vols = p.v_nominal ? [`${VP.fmt(+p.v_nominal, p.v_nominal < 10 ? 1 : 0)} µl (${p.metodo_nominal})`]
      .concat(p.v_bajo ? [`${VP.fmt(+(p.v_bajo_elegido || p.v_bajo), p.v_bajo < 10 ? 1 : 0)} µl (${p.metodo_bajo})`] : []).join(' · ')
      : '<span class="badge badge-orange">Sin rango</span> <span style="font-size:11px;color:var(--text-muted)">tarea «c-pip-rangos» de la página de pendientes</span>';
    return `<tr>
      <td><strong>${_vpEsc(p.id_activo)}</strong>${p.multicanal ? ' <span class="badge badge-gray">8 canales</span>' : ''}
        <div style="font-size:11px;color:var(--text-muted)">${_vpEsc(p.marca_modelo || '')} · ${_vpEsc(p.rango || '')}</div>
        ${porComprobar ? `<div style="font-size:11px;margin-top:3px">Tornillo de ajuste: ${p.ajuste_respuesta ? `<strong>${p.ajuste_respuesta === 'si' ? 'sí tiene' : 'no tiene'}</strong> (${_vpEsc(p.ajuste_respuesta_por || '')})` : 'por comprobar'}
          ${staff ? ` <button class="btn-link vp-link" onclick="responderAjustePipeta('${p.id_activo}','si')">Tiene</button> · <button class="btn-link vp-link" onclick="responderAjustePipeta('${p.id_activo}','no')">No tiene</button>` : ''}</div>` : ''}
        ${p.v_bajo_elegido ? `<div style="font-size:11px;margin-top:3px">Volumen bajo elegido: <strong>${VP.fmt(+p.v_bajo_elegido, 0)} µl</strong> (${_vpEsc(p.v_bajo_elegido_por || '')})</div>` : ''}</td>
      <td style="font-size:12px">${vols}</td>
      <td style="font-size:12px">${calc ? `<strong>${formatDate(ult.Fecha_Realizacion)}</strong> · ${_vpBadgeResultado(calc.resultado)}${ult.extra ? ' <span class="badge badge-blue">extraordinaria</span>' : ''}${ult.Estado === 'pendiente_vb' ? ' <span class="badge badge-orange">⏳ visto bueno</span>' : ''}
        <div style="color:var(--text-muted)">${_vpEsc(resumenVerificacion(calc))}</div>` : '<span style="color:var(--text-muted)">—</span>'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function _vpBadgeResultado(res) {
  if (!res || !window.VP) return '';
  const t = VP.RESULTADO[res] || res;
  const cls = /^OK/.test(res) ? 'badge-green' : /^RETIRAR/.test(res) ? 'badge-red' : /AJUSTAR/.test(res) ? 'badge-orange' : 'badge-gray';
  return `<span class="badge ${cls}">${_vpEsc(/^OK_FUERA/.test(res) ? 'OK (con un volumen < 5 µl fuera, orientativo)' : t.split(':')[0])}</span>`;
}

async function responderAjustePipeta(idActivo, respuesta) {
  const txt = respuesta === 'si' ? 'TIENE tornillo de ajuste bajo la tapa del émbolo' : 'NO tiene tornillo de ajuste (si sale AJUSTAR, se retira)';
  if (!confirm(`${idActivo}: ¿confirmas que ${txt}?`)) return false;
  showLoading('Guardando…');
  try {
    const { parametros } = await callEdgeFunction('gestionar-verif-pipetas', { accion: 'responder_ajuste', id_activo: idActivo, respuesta });
    const i = DATA.verifParametros.findIndex(p => p.id_activo === idActivo);
    if (i >= 0) DATA.verifParametros[i] = parametros;
    showToast('Guardado. Queda anotado para corregir los datos de la pipeta.', 'success');
    if (document.getElementById('page-verif-pipetas')?.classList.contains('active')) _vpPintarPipetas();
    if (_vpEstado.ver) _vpPintarVerif();
    hideLoading();
    return true;
  } catch (e) { showToast(e.message || 'No se pudo guardar', 'error'); }
  hideLoading();
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREPARACIÓN DEL CURSO
// ═══════════════════════════════════════════════════════════════════════════════
const _VP_GUIA_P = [['D2', '3', '27'], ['D2', '7,5', '22,5'], ['D2', '15', '15'], ['D1', '2,25', '27,75'], ['D1', '3', '27']];
const _VP_DISOLUCIONES_TUBO = ['S-A', 'S-B', 'S-C', 'S-C2', 'P1', 'P2', 'P3', 'P4', 'P5'];

function openModalVerifPrep() {
  if (!_vpListo()) return;
  const curso = _vpCurso();
  const prepRow = _vpPrepDe(curso);
  const datos = JSON.parse(JSON.stringify(prepRow?.datos || {}));
  datos.P = (datos.P || []).concat([]).slice(0, 5);
  for (let i = 0; i < 5; i++) datos.P[i] = { parte: _VP_GUIA_P[i][0], ...(datos.P[i] || {}) };
  _vpEstado.prep = { curso_academico: curso, datos, tubos: JSON.parse(JSON.stringify(prepRow?.tubos || [])) };
  document.getElementById('vp-prep-titulo').textContent = `Preparación del curso ${curso}`;
  _vpPintarPrep();
  openModal('modal-verif-prep');
}

function _vpPintarPrep() {
  const P = 'prep', m = (path, ph) => _vpIn(P, path, 'masa', { ph, ancho: '96px' });
  const fila = (titulo, a, b, res) => `<tr><td><strong>${titulo}</strong></td><td>${a}</td><td>${b}</td><td class="vp-res" data-res="${res}"></td></tr>`;
  const tubos = _vpEstado.prep.tubos;
  document.getElementById('vp-prep-cuerpo').innerHTML = `
    <p class="vp-ayuda">Todas las masas en gramos, con tres decimales (BTC-223). Se hace una vez por curso; cada disolución se reparte en un juego de tubos por bloque y se congela.</p>
    <div class="vp-tabla-wrap"><table class="vp-tabla">
      <thead><tr><th>Disolución</th><th>Masa de partida (g)</th><th>Masa de agua (g)</th><th>Se calcula</th></tr></thead>
      <tbody>
        ${fila('S-A', m('datos.SA.m_tartrazina', 'tartrazina ≈ 0,1'), m('datos.SA.m_agua', '≈ 50'), 'conc')}
        ${fila('S-B', m('datos.SB.m_sa', 'S-A ≈ 10'), m('datos.SB.m_agua', '≈ 40'), 'F_B')}
        ${fila('S-C', m('datos.SC.m_sa', 'S-A ≈ 7,5'), m('datos.SC.m_agua', '≈ 142,5'), 'F_C')}
        ${fila('S-C, 2.º lote', m('datos.SC2.m_sa', 'solo si se acaba'), m('datos.SC2.m_agua', ''), 'F_C2')}
        ${fila('D1', m('datos.D1.m_sa', 'S-A ≈ 1'), m('datos.D1.m_agua', '≈ 9'), 'f_D1')}
        ${fila('D2', m('datos.D2.m_d1', 'D1 ≈ 3'), m('datos.D2.m_agua', '≈ 27'), 'f_D2')}
      </tbody></table></div>
    <div class="form-group" style="margin-top:8px;max-width:220px"><label>Fecha del 2.º lote de S-C</label><input type="date" class="vp-in" data-root="prep" data-path="datos.SC2.fecha" data-tipo="texto" value="${_vpEsc(_vpEstado.prep.datos.SC2?.fecha || '')}" oninput="_vpSet(this)"></div>
    <h4 class="vp-h4">Puntos de la recta</h4>
    <div class="vp-tabla-wrap"><table class="vp-tabla">
      <thead><tr><th>Punto</th><th>Parte de</th><th>Masa de partida (g)</th><th>Masa de agua (g)</th><th>f</th></tr></thead>
      <tbody>${[0, 1, 2, 3, 4].map(i => `<tr><td><strong>P${i + 1}</strong><div class="vp-guia">${_VP_GUIA_P[i][1]} g de ${_VP_GUIA_P[i][0]} + ${_VP_GUIA_P[i][2]} g</div></td>
        <td><select class="vp-in" data-root="prep" data-path="datos.P.${i}.parte" data-tipo="texto" onchange="_vpSet(this)">
          ${['D1', 'D2'].map(x => `<option ${_vpEstado.prep.datos.P[i].parte === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
        <td>${m(`datos.P.${i}.m_partida`)}</td><td>${m(`datos.P.${i}.m_agua`)}</td><td class="vp-res" data-res="P${i}"></td></tr>`).join('')}</tbody>
    </table></div>
    <h4 class="vp-h4">Tubos congelados</h4>
    <p class="vp-ayuda">Un juego por bloque de verificación (un bloque por cada evaluación en cuyo inicio arrancan pipetas). La masa del tubo lleno y cerrado se anota al prepararlo: con ella se controla la pérdida de agua en cada sesión (≤ 0,1 %).</p>
    <div class="vp-tabla-wrap"><table class="vp-tabla">
      <thead><tr><th>Disolución</th><th>Bloque</th><th>Tubo vacío (g)</th><th>Lleno y cerrado (g)</th><th></th></tr></thead>
      <tbody>${tubos.map((t, i) => `<tr>
        <td><select class="vp-in" data-root="prep" data-path="tubos.${i}.disolucion" data-tipo="texto" onchange="_vpSet(this)">
          ${_VP_DISOLUCIONES_TUBO.map(x => `<option ${t.disolucion === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
        <td><input class="vp-in" style="width:60px" data-root="prep" data-path="tubos.${i}.bloque" data-tipo="texto" value="${_vpEsc(t.bloque || '')}" oninput="_vpSet(this)"></td>
        <td>${m(`tubos.${i}.m_vacio`)}</td><td>${m(`tubos.${i}.m_lleno`)}</td>
        <td><button class="icon-btn" title="Quitar" onclick="_vpEstado.prep.tubos.splice(${i},1);_vpPintarPrep()">✕</button></td></tr>`).join('')}</tbody>
    </table></div>
    <button class="btn btn-secondary" style="margin-top:6px" onclick="_vpAnadirTubos()">+ Tubos de un bloque</button>`;
  document.querySelectorAll('#vp-prep-cuerpo .vp-in').forEach(el => { if (el.value) _vpComprobarCampo(el); });
  _vpPintarResultadosPrep();
}

/** Añade un juego de tubos (S-A, S-B, S-C y P1–P5) para el bloque siguiente. */
function _vpAnadirTubos() {
  const tubos = _vpEstado.prep.tubos;
  const bloque = String(Math.max(0, ...tubos.map(t => parseInt(t.bloque, 10) || 0)) + 1);
  ['S-A', 'S-B', 'S-C', 'P1', 'P2', 'P3', 'P4', 'P5'].forEach(d =>
    tubos.push({ id: 'T' + bloque + '-' + d + '-' + Math.random().toString(36).slice(2, 6), disolucion: d, bloque, m_vacio: '', m_lleno: '' }));
  _vpPintarPrep();
}

function _vpPintarResultadosPrep() {
  if (!_vpEstado.prep) return;
  const r = VP.calcularPreparacion(_vpEstado.prep.datos);
  const put = (k, html) => { const el = document.querySelector(`#vp-prep-cuerpo [data-res="${k}"]`); if (el) el.innerHTML = html; };
  put('conc', r.conc_SA === null ? '—' : `≈ ${_vpF(r.conc_SA, 2)} g/l <span class="vp-guia">(informativo)</span>`);
  put('F_B', r.F_B === null ? '—' : `F_B = ${_vpF(r.F_B, 5)}`);
  put('F_C', r.F_C === null ? '—' : `F_C = ${_vpF(r.F_C, 5)}`);
  put('F_C2', r.F_C2 === null ? '—' : `F_C2 = ${_vpF(r.F_C2, 5)}`);
  put('f_D1', r.f_D1 === null ? '—' : `f_D1 = ${_vpF(r.f_D1, 6)}`);
  put('f_D2', r.f_D2 === null ? '—' : `f_D2 = ${_vpF(r.f_D2, 7)}`);
  r.P.forEach((f, i) => put('P' + i, f === null ? '—' : _vpF(f, 8)));
}

async function guardarVerifPrep() {
  const e = _vpEstado.prep;
  if (document.querySelector('#vp-prep-cuerpo .vp-mal')) { showToast('Hay datos que no cumplen (en rojo): corrígelos antes de guardar', 'error'); return; }
  showLoading('Guardando la preparación…');
  try {
    const { preparacion, sesiones } = await callEdgeFunction('gestionar-verif-pipetas', {
      accion: 'guardar_preparacion', curso_academico: e.curso_academico, datos: e.datos,
      tubos: e.tubos.filter(t => t.disolucion),
    });
    DATA.verifPreparaciones = DATA.verifPreparaciones.filter(p => p.curso_academico !== preparacion.curso_academico).concat(preparacion);
    _vpActualizarSesiones(sesiones);
    closeModal('modal-verif-prep');
    showToast('Preparación guardada', 'success');
    renderVerifPipetas();
  } catch (err) { showToast(err.message || 'No se pudo guardar la preparación', 'error'); }
  hideLoading();
}

function _vpActualizarSesiones(sesiones) {
  if (!Array.isArray(sesiones)) return;
  const ids = new Set(sesiones.map(s => s.id));
  DATA.verifSesiones = DATA.verifSesiones.filter(s => !ids.has(s.id)).concat(sesiones);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESIÓN DE VERIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════
function openModalVerifSesion(id) {
  if (!_vpListo()) return;
  const curso = _vpCurso();
  const s = id ? DATA.verifSesiones.find(x => x.id === id) : null;
  const datos = JSON.parse(JSON.stringify(s?.datos || {}));
  datos.abs_P = (datos.abs_P || []).slice(0, 5); while (datos.abs_P.length < 5) datos.abs_P.push('');
  datos.lecturas_cv = (datos.lecturas_cv || []).slice(0, 10); while (datos.lecturas_cv.length < 10) datos.lecturas_cv.push('');
  datos.balanzas = datos.balanzas || ['BAL-003'];
  datos.comprobaciones = datos.comprobaciones || {};
  datos.tubos = datos.tubos || {};
  const sesionesCurso = _vpSesionesDe(curso);
  const validado = sesionesCurso.some(x => x.id !== id && x.resultados?.validacion?.ok);
  if (!datos.validacion && !validado) datos.validacion = {};
  _vpEstado.ses = { id: s?.id || null, curso_academico: s?.curso_academico || curso, fecha: s?.fecha || new Date().toISOString().slice(0, 10),
    bloque: s?.bloque || '', personas: s?.personas || '', datos, creado: s?.creado || null };
  document.getElementById('vp-ses-titulo').textContent = s ? `Sesión del ${formatDate(s.fecha)}` : 'Nueva sesión de verificación';
  const editable = _vpEsStaff();
  document.getElementById('vp-ses-guardar').style.display = editable ? '' : 'none';
  _vpPintarSesion();
  if (!editable) document.querySelectorAll('#vp-ses-cuerpo input, #vp-ses-cuerpo select, #vp-ses-cuerpo button.vp-solo-edicion').forEach(el => { el.disabled = true; });
  openModal('modal-verif-sesion');
}

function _vpPintarSesion() {
  const S = 'ses', e = _vpEstado.ses, d = e.datos;
  const prepRow = _vpPrepDe(e.curso_academico);
  const tubos = (prepRow?.tubos || []).filter(t => !e.bloque || String(t.bloque) === String(e.bloque));
  const bloques = [...new Set((prepRow?.tubos || []).map(t => String(t.bloque)).filter(Boolean))];
  const repBal = _vpCtxSesion({ ...e }).repBalanzas;
  const m = (p, ph) => _vpIn(S, p, 'masa', { ph, ancho: '90px' });
  const a = p => _vpIn(S, p, 'absorbancia', { ph: '0,000', ancho: '80px' });
  const comp = (tipo, campos) => `<tr><td><strong>${tipo === 'S-C2' ? 'S-C (2.º lote)' : tipo}</strong></td><td>${campos}</td><td>${a(`datos.comprobaciones.${tipo}.A`)}</td><td class="vp-res" data-res="comp-${tipo}"></td></tr>`;
  const prep = VP.calcularPreparacion(prepRow?.datos || {});
  document.getElementById('vp-ses-cuerpo').innerHTML = `
    <div class="form-grid">
      <div class="form-group"><label>Fecha *</label><input type="date" class="vp-in" data-root="ses" data-path="fecha" data-tipo="texto" value="${_vpEsc(e.fecha)}" oninput="_vpSet(this)"></div>
      <div class="form-group"><label>Bloque</label><select class="vp-in" data-root="ses" data-path="bloque" data-tipo="texto" onchange="_vpSet(this);_vpPintarSesion()">
        <option value="">—</option>${bloques.map(b => `<option ${String(e.bloque) === b ? 'selected' : ''}>${_vpEsc(b)}</option>`).join('')}</select></div>
      <div class="form-group full"><label>Quién dirige y grupos</label>${_vpTxt(S, 'personas', { ph: 'Docente que dirige y grupos (sin nombres del alumnado)' })}</div>
      <div class="form-group"><label>Temperatura del agua (°C, entera) *</label>${_vpIn(S, 'datos.temperatura', 'temperatura', { ph: '22', ancho: '70px' })}<span class="vp-res" data-res="z"></span></div>
      <div class="form-group"><label>Balanzas de los tubos y de las pesadas</label>
        <div class="vp-checks">${Object.entries(VP.BALANZAS_TUBOS).map(([id, b]) => {
          const rep = repBal[id];
          return `<label title="${rep ? '' : 'Sin repetibilidad medida este curso: no se puede elegir'}"><input type="checkbox" ${d.balanzas.includes(id) ? 'checked' : ''} ${rep ? '' : 'disabled'}
            onchange="_vpToggleBalanza('${id}', this.checked)"> ${id} (${b.nombre})${rep ? ` · ${_vpF(rep.s, 4)} g` : ' · sin medir'}</label>`;
        }).join('')}</div></div>
    </div>
    <div id="vp-ses-validez" class="vp-validez"></div>

    <h4 class="vp-h4">Tubos de disoluciones (5.2) — pesarlos cerrados antes de abrirlos</h4>
    ${tubos.length ? `<div class="vp-tabla-wrap"><table class="vp-tabla"><thead><tr><th>Tubo</th><th>Masa ahora (g)</th><th>Al cerrarlo al final (g)</th><th>Pérdida</th></tr></thead><tbody>
      ${tubos.map(t => `<tr><td><strong>${_vpEsc(t.disolucion)}</strong><div class="vp-guia">bloque ${_vpEsc(t.bloque || '—')}</div></td>
        <td>${m(`datos.tubos.${t.id}.m_ahora`)}</td><td>${m(`datos.tubos.${t.id}.m_cierre`)}</td><td class="vp-res" data-res="tubo-${t.id}"></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="vp-ayuda">No hay tubos registrados en la preparación del curso (o en ese bloque).</p>'}

    <h4 class="vp-h4">Blanco y recta del día (5.3–5.4)</h4>
    <div class="form-grid"><div class="form-group"><label>Blanco al empezar (cubeta de muestras con agua, tras el cero)</label>${_vpIn(S, 'datos.blanco_inicio', 'blanco', { ph: '0,000', ancho: '80px' })}</div></div>
    <div class="vp-tabla-wrap"><table class="vp-tabla"><thead><tr><th>Punto</th><th>f</th><th>A leída</th></tr></thead><tbody>
      ${[0, 1, 2, 3, 4].map(i => `<tr><td><strong>P${i + 1}</strong></td><td>${prep.P[i] === null ? '<span class="vp-guia">falta la preparación</span>' : _vpF(prep.P[i], 8)}</td><td>${a(`datos.abs_P.${i}`)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="vp-res vp-bloque-res" data-res="recta"></div>

    <h4 class="vp-h4">Diluciones de comprobación (5.5) — una por cada disolución que se vaya a pipetear hoy</h4>
    <div class="vp-tabla-wrap"><table class="vp-tabla"><thead><tr><th>Disolución</th><th>Masas (g)</th><th>A</th><th>Resultado</th></tr></thead><tbody>
      ${comp('S-A', `${m('datos.comprobaciones.S-A.m1', 'S-A ≈ 1')} + ${m('datos.comprobaciones.S-A.m2', 'agua ≈ 9')}<br>${m('datos.comprobaciones.S-A.m3', 'de esa ≈ 1')} + ${m('datos.comprobaciones.S-A.m4', 'agua ≈ 9')}`)}
      ${comp('S-B', `${m('datos.comprobaciones.S-B.m', 'S-B ≈ 1')} + ${m('datos.comprobaciones.S-B.m_agua', 'agua ≈ 24')}`)}
      ${comp('S-C', `${m('datos.comprobaciones.S-C.m', 'S-C ≈ 2')} + ${m('datos.comprobaciones.S-C.m_agua', 'agua ≈ 10,5')}`)}
      ${prep.F_C2 ? comp('S-C2', `${m('datos.comprobaciones.S-C2.m', 'S-C ≈ 2')} + ${m('datos.comprobaciones.S-C2.m_agua', 'agua ≈ 10,5')}`) : ''}
    </tbody></table></div>
    <div class="vp-res" data-res="sentido"></div>

    <h4 class="vp-h4">CV de lectura (5.6) — diez lecturas de la dilución de S-C (o de S-B), vaciando y rellenando la cubeta</h4>
    <div class="vp-lecturas">${d.lecturas_cv.map((_, i) => a(`datos.lecturas_cv.${i}`)).join('')}</div>
    <div class="vp-res vp-bloque-res" data-res="cv"></div>

    <h4 class="vp-h4">Blanco al final (5.7)</h4>
    <div class="form-grid"><div class="form-group">${_vpIn(S, 'datos.blanco_final', 'blanco', { ph: '0,000', ancho: '80px' })}</div></div>

    ${d.validacion ? _vpHtmlValidacion() : `<p class="vp-ayuda">El método ya está validado este curso. <button class="btn-link vp-link vp-solo-edicion" onclick="_vpEstado.ses.datos.validacion={};_vpPintarSesion()">Añadir otra validación en esta sesión</button></p>`}`;
  document.querySelectorAll('#vp-ses-cuerpo .vp-in').forEach(el => { if (el.value) _vpComprobarCampo(el); });
  _vpPintarResultadosSesion();
}

function _vpHtmlValidacion() {
  const S = 'ses';
  const m = p => _vpIn(S, p, 'masa', { ancho: '76px' });
  const a = p => _vpIn(S, p, 'absorbancia', { ancho: '76px' });
  const v = _vpEstado.ses.datos.validacion;
  v.grav200 = (v.grav200 || []).slice(0, 10); while (v.grav200.length < 10) v.grav200.push({ m: '' });
  v.fot200 = (v.fot200 || []).slice(0, 10); while (v.fot200.length < 10) v.fot200.push({ m: '', A: '' });
  v.llenado = (v.llenado || []).slice(0, 3); while (v.llenado.length < 3) v.llenado.push('');
  v.balanzas = v.balanzas || {};
  return `<h4 class="vp-h4">Validación del método (anexo A, 8) — la primera sesión del curso</h4>
    <p class="vp-ayuda">La linealidad es la recta del día y la repetibilidad del espectrofotómetro, el CV de lectura de arriba. Faltan estas tres pruebas.</p>
    <div class="vp-sub">Comparación con la gravimetría a 200 µl (pipeta de 1 000 µl recién verificada, ajustada a 200 µl)</div>
    <div class="vp-tabla-wrap"><table class="vp-tabla"><thead><tr><th>Réplica</th><th>Balanza: masa (g)</th><th>Fotométrico: agua del tubo (g)</th><th>A (S-C)</th></tr></thead><tbody>
      ${v.grav200.map((_, i) => `<tr><td>${i + 1}</td><td>${m(`datos.validacion.grav200.${i}.m`)}</td><td>${m(`datos.validacion.fot200.${i}.m`)}</td><td>${a(`datos.validacion.fot200.${i}.A`)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="vp-sub">Efecto del llenado de la cubeta: P3 leído con 0,7, 1,0 y 1,2 ml</div>
    <div class="vp-lecturas">${[0, 1, 2].map(i => a(`datos.validacion.llenado.${i}`)).join('')}</div>
    <div class="vp-sub">Repetibilidad de las balanzas de los tubos (solo BAL-001 y BAL-005; la BTC-223 vale por especificación): 10 pesadas del mismo microtubo con 1 g de agua</div>
    ${['BAL-001', 'BAL-005'].map(id => {
      const p = (v.balanzas[id] = (v.balanzas[id] || []).slice(0, 10)); while (p.length < 10) p.push('');
      return `<div style="margin:6px 0"><strong style="font-size:12px">${id}</strong><div class="vp-lecturas">${p.map((_, i) => m(`datos.validacion.balanzas.${id}.${i}`)).join('')}</div></div>`;
    }).join('')}
    <div class="vp-res vp-bloque-res" data-res="validacion"></div>`;
}

function _vpToggleBalanza(id, on) {
  const b = _vpEstado.ses.datos.balanzas;
  if (on && !b.includes(id)) b.push(id);
  if (!on) b.splice(b.indexOf(id), 1);
  _vpPintarResultadosSesion();
}

function _vpPintarResultadosSesion() {
  const e = _vpEstado.ses;
  if (!e) return;
  const r = VP.calcularSesion(e, _vpCtxSesion(e));
  const put = (k, html) => { const el = document.querySelector(`#vp-ses-cuerpo [data-res="${k}"]`); if (el) el.innerHTML = html; };
  put('z', r.z ? ` <span class="vp-guia">Z = ${_vpF(r.z, 4)} µl/mg</span>` : '');
  for (const [id, t] of Object.entries(r.tubos)) put('tubo-' + id, t.pct === undefined ? '—' : `${_vpF(t.pct, 3)} % ${t.ok ? '<span class="badge badge-green">OK</span>' : '<span class="badge badge-red">DESECHAR (evaporación)</span>'}`);
  put('recta', r.recta ? `Recta: k = ${_vpF(r.recta.k, 4)} · a = ${_vpF(r.recta.a, 7)} · r² = ${_vpF(r.recta.r2, 6)} · residuo máximo ${_vpF(r.recta.residuoMax, 4)} ${_vpBadge(r.recta.valida, 'Válida', 'No válida')}${r.recta.fallos.length ? `<div class="vp-err">${_vpEsc(r.recta.fallos.join(' · '))}</div>` : ''}` : '<span class="vp-guia">Faltan las cinco absorbancias (y la preparación del curso)</span>');
  for (const tipo of ['S-A', 'S-B', 'S-C', 'S-C2']) {
    const c = r.comprobaciones[tipo];
    put('comp-' + tipo, !c || !c.completa ? '—' : `f esperada ${_vpF(c.fEsperada, 7)} · leída ${_vpF(c.fLeida, 7)} · <strong>${_vpF(c.dif, 2, true)} %</strong> ${_vpBadge(c.ok, 'OK', 'No vale hoy')}`);
  }
  put('sentido', r.todas_mismo_sentido ? '<div class="vp-err">Fallan todas en el mismo sentido: lo que ha cambiado es, probablemente, la recta (preparación de los puntos, cubeta, lámpara).</div>' : '');
  put('cv', r.cv_lectura ? `CV de lectura: <strong>${_vpF(r.cv_lectura.cv, 3)} %</strong> (${r.cv_lectura.n} lecturas) ${_vpBadge(r.cv_lectura.ok, 'OK', r.cv_lectura.n < 10 ? 'Faltan lecturas' : 'No cumple (> 0,3 %)')}` : '');
  if (r.validacion) {
    put('validacion', `<table class="vp-tabla"><tbody>${r.validacion.pruebas.map(p => `<tr><td>${_vpEsc(p.titulo)}<div class="vp-guia">${_vpEsc(p.criterio)}</div></td><td style="font-size:12px">${_vpEsc(p.valor || '—')}</td><td>${_vpBadge(p.ok)}</td></tr>`).join('')}</tbody></table>
      <div style="margin-top:6px">${r.validacion.ok ? '<span class="badge badge-green">✓ Método validado este curso</span>' : '<span class="badge badge-orange">Validación sin terminar o con pruebas que no cumplen: no se verifica ninguna pipeta por fotometría hasta repetirla con éxito</span>'}</div>`);
  }
  const val = document.getElementById('vp-ses-validez');
  if (val) val.innerHTML = `<div><strong>Parte gravimétrica:</strong> ${r.valida_grav ? '<span class="badge badge-green">✓ válida</span>' : `<span class="badge badge-orange">no válida</span> <span class="vp-guia">${_vpEsc(r.motivos_grav.join(' · '))}</span>`}</div>
    <div><strong>Parte fotométrica:</strong> ${r.valida_fot ? '<span class="badge badge-green">✓ válida</span>' : `<span class="badge badge-orange">no válida todavía</span> <span class="vp-guia">${_vpEsc(r.motivos_fot.join(' · '))}</span>`}</div>
    <div class="vp-guia">Disoluciones que se pueden pipetear hoy: ${Object.entries(r.disoluciones).filter(([k]) => k !== 'S-C2' || VP.calcularPreparacion(_vpPrepDe(e.curso_academico)?.datos || {}).F_C2).map(([k, x]) => `${k === 'S-C2' ? 'S-C (2.º lote)' : k} ${x.ok ? '✓' : '✗'}`).join(' · ')}</div>`;
}

async function guardarVerifSesion() {
  const e = _vpEstado.ses;
  if (!e.fecha) { showToast('Falta la fecha', 'error'); return; }
  if (document.querySelector('#vp-ses-cuerpo .vp-mal')) { showToast('Hay datos que no cumplen (en rojo): corrígelos antes de guardar', 'error'); return; }
  showLoading('Guardando la sesión…');
  try {
    const { sesiones } = await callEdgeFunction('gestionar-verif-pipetas', {
      accion: 'guardar_sesion', id: e.id || undefined, curso_academico: e.curso_academico, fecha: e.fecha,
      bloque: e.bloque, personas: e.personas, datos: e.datos,
    });
    _vpActualizarSesiones(sesiones);
    closeModal('modal-verif-sesion');
    showToast('Sesión guardada', 'success');
    renderVerifPipetas();
  } catch (err) { showToast(err.message || 'No se pudo guardar la sesión', 'error'); }
  hideLoading();
}

async function eliminarVerifSesion(id) {
  if (!confirm('¿Borrar esta sesión? Solo se puede si ninguna pipeta se ha medido en ella.')) return;
  showLoading('Borrando…');
  try {
    const { sesiones } = await callEdgeFunction('gestionar-verif-pipetas', { accion: 'eliminar_sesion', id });
    DATA.verifSesiones = DATA.verifSesiones.filter(s => s.id !== id);
    _vpActualizarSesiones(sesiones);
    showToast('Sesión borrada', 'success');
    renderVerifPipetas();
  } catch (err) { showToast(err.message || 'No se pudo borrar', 'error'); }
  hideLoading();
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN DE UNA PIPETA (dentro de «Ejecutar mantenimiento»)
// ═══════════════════════════════════════════════════════════════════════════════
// _vpRev: la revisión abierta (pipeta, plan, curso, datos del CSV). _vpEstado.ver: lo que se
// mete (fases → volúmenes → canales → réplicas). El servidor recalcula todo al guardar.
let _vpRev = null;
const _vpCanalVisible = {};   // `${fase}-${clave}` → canal que se ve (multicanal)

/** ¿Este plan lleva la verificación calculada? Revisión anual o bianual de una pipeta con datos. */
function vpRevisionAplica(plan) {
  if (!window.VP || !plan) return false;
  if (!['Pretemporada', 'Bianual'].includes(plan.Periodicidad)) return false;
  if (!_vpParDe(plan.ID_Equipo)) return false;
  return String(plan.Instrucciones || '').split(/\r?\n/).some(l => VP.pasoVerificacion(l.trim()));
}

/** ¿Es un paso que marca la app (solo en una revisión con verificación)? */
function vpPasoAuto(texto) {
  return !!(_vpRev && window.VP && VP.pasoVerificacion(texto));
}

/** Al abrir «Ejecutar mantenimiento»: prepara la verificación (o la quita si no aplica). */
function vpPrepararRevision(plan, enCurso, curso) {
  const cont = document.getElementById('mant-verif');
  _vpRev = null; _vpEstado.ver = null;
  if (!vpRevisionAplica(plan)) { if (cont) { cont.innerHTML = ''; cont.style.display = 'none'; } return false; }
  const guardada = enCurso?.Verificacion || null;
  const ver = guardada ? { fases: guardada.fases, v_bajo_elegido: guardada.v_bajo_elegido || null, puntas: guardada.puntas || '', observaciones: guardada.observaciones || '' } : null;
  _vpEstado.ver = JSON.parse(JSON.stringify(ver || { fases: [{ tipo: 'inicial', volumenes: {} }], v_bajo_elegido: null, puntas: '', observaciones: '' }));
  _vpRev = { idEquipo: plan.ID_Equipo, idPlan: plan.ID_Plan, curso, periodicidad: plan.Periodicidad,
    sinCribado: plan.Periodicidad === 'Bianual', opcionesBajo: VP.opcionesVolumenBajo(plan.Instrucciones) };
  if (cont) cont.style.display = '';
  _vpPintarResumenRevision();
  return true;
}

function _vpCalcVer() {
  if (!_vpRev || !_vpEstado.ver) return null;
  const par = _vpParDe(_vpRev.idEquipo);
  const prepRow = _vpPrepDe(_vpRev.curso);
  return VP.calcularVerificacion({ ..._vpEstado.ver, sin_cribado: _vpRev.sinCribado }, {
    par, sesiones: _vpResultadosSesiones(), prep: VP.calcularPreparacion(prepRow?.datos || {}), ajuste_respuesta: par?.ajuste_respuesta,
  });
}

/** Marca los pasos de verificación del checklist de la revisión con el cálculo. */
function vpMarcarPasosRevision() {
  if (!_vpRev || _vpRev.extra || typeof _leerChecklist !== 'function') return;
  const calc = _vpCalcVer();
  _renderMantChecklist(VP.marcarPasosVerificacion(_leerChecklist(), calc));
}

/** Lo que se manda al guardar la revisión (el servidor recalcula). */
function vpVerificacionParaGuardar() {
  return _vpRev ? JSON.parse(JSON.stringify(_vpEstado.ver)) : undefined;
}

/** Antes de finalizar: sin resultado OK o RETIRAR no se puede (también lo exige el servidor). */
function vpPuedeFinalizar() {
  if (!_vpRev) return true;
  const calc = _vpCalcVer();
  if (calc?.final) return true;
  showToast('La verificación de la pipeta no tiene resultado todavía: ' + VP.resumenPendiente(calc) + '. Guarda el progreso y termínala antes de finalizar.', 'error');
  return false;
}

function _vpPintarResumenRevision() {
  const cont = document.getElementById('mant-verif');
  if (!cont || !_vpRev) return;
  const calc = _vpCalcVer();
  const par = _vpParDe(_vpRev.idEquipo);
  const pend = calc && !calc.final ? VP.resumenPendiente(calc) : '';
  cont.innerHTML = `<div class="vp-resumen-rev">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div><strong>🧪 Verificación de la pipeta</strong> <span class="vp-guia">(la calcula GestionLab)</span><br>
        ${calc ? _vpBadgeResultado(calc.resultado) : ''} ${pend ? `<span class="vp-guia">${_vpEsc(pend)}</span>` : ''}
        ${calc?.final && resumenVerificacion(calc) ? `<div class="vp-guia">${_vpEsc(resumenVerificacion(calc))}</div>` : ''}</div>
      <button type="button" class="btn btn-primary" onclick="openModalVerifPipeta()">${par?.v_nominal ? 'Abrir la verificación' : 'Ver por qué no se puede verificar'}</button>
    </div>
    <div class="vp-guia" style="margin-top:6px">Las pesadas y las lecturas se meten en la verificación; los pasos con 🧪 los marca la app con el resultado.</div>
  </div>`;
}

function openModalVerifPipeta() {
  if (!_vpRev || !_vpListo()) return;
  _vpPintarVerif();
  openModal('modal-verif-pipeta');
}

function cerrarVerifPipeta() {
  closeModal('modal-verif-pipeta');
  if (_vpRev?.extra) { _vpRev = null; _vpEstado.ver = null; _vpModoPieVerif(false); return; }
  vpMarcarPasosRevision();
  _vpPintarResumenRevision();
}

function _vpOpcionesSesion(metodo, disolucion, seleccion) {
  const lista = _vpSesionesDe(_vpRev.curso);
  return `<option value="">Elige la sesión…</option>` + lista.map(s => {
    const r = s.resultados || {};
    const ok = metodo === 'fotométrico' ? r.valida_fot && r.disoluciones?.[disolucion]?.ok : r.valida_grav;
    return `<option value="${s.id}" ${s.id === seleccion ? 'selected' : ''}>${formatDate(s.fecha)}${s.bloque ? ' · bloque ' + _vpEsc(s.bloque) : ''} ${ok ? '✓' : '✗ (no vale para este volumen)'}</option>`;
  }).join('');
}

function _vpPintarVerif() {
  const par = _vpParDe(_vpRev.idEquipo);
  const ver = _vpEstado.ver;
  const eq = DATA.equipos.find(e => e.ID_Activo === _vpRev.idEquipo);
  const cuerpo = document.getElementById('vp-ver-cuerpo');
  document.getElementById('vp-ver-titulo').textContent = `Verificación de ${_vpRev.idEquipo}`;
  const cabecera = `<div class="vp-cabecera">
    <div><strong>${_vpEsc(_vpRev.idEquipo)}</strong> · ${_vpEsc(par.marca_modelo || eq?.Marca || '')} · rango ${_vpEsc(par.rango || '—')}${par.multicanal ? ' · <strong>8 canales</strong> (cada canal se verifica como una pipeta)' : ''}</div>
    <div class="vp-guia">Límites: ${_vpEsc(par.fuente_limites || '—')}${par.notas ? ' · ' + _vpEsc(par.notas) : ''} · Ajuste en el laboratorio: ${_vpEsc(par.ajuste_usuario || '—')}${par.ajuste_respuesta ? ` (tornillo: ${par.ajuste_respuesta === 'si' ? 'sí' : 'no'})` : ''}</div>
    ${par.confirmar ? `<div class="vp-aviso-caja">⚠ ${_vpEsc(par.confirmar)}</div>` : ''}
    ${_vpRev.extra ? `<div class="vp-aviso-caja"><strong>Verificación extraordinaria</strong> tras la reparación de la incidencia <strong>${_vpEsc(_vpRev.extra.id_incidencia)}</strong>${_vpRev.extra.finalizada ? ' · finalizada: solo lectura' : ''}. La pipeta solo vuelve a estar operativa si sale OK.</div>` : ''}
    ${_vpRev.sinCribado ? '<div class="vp-aviso-caja">Tras un cambio de junta o una reparación no hay cribado: 10 réplicas a cada volumen; con menos no se da OK.</div>' : ''}
  </div>`;
  if (!par.v_nominal) {
    cuerpo.innerHTML = cabecera + `<div class="vp-aviso-caja vp-grave">Esta pipeta no tiene rango en el inventario, así que no se sabe a qué volúmenes ni con qué límites verificarla.
      Anotad el rango grabado en la pipeta en la tarea <strong>«c-pip-rangos»</strong> de la página de pendientes del laboratorio; cuando se cargue, aquí saldrán sus volúmenes.</div>`;
    return;
  }
  const vols = VP.volumenesDe(par, ver.v_bajo_elegido);
  const nCan = VP.canalesDe(par);
  const prep = VP.calcularPreparacion(_vpPrepDe(_vpRev.curso)?.datos || {});
  const calc = _vpCalcVer();
  let html = cabecera;
  if (_vpRev.opcionesBajo) {
    html += `<div class="form-group"><label>Volumen bajo según lo grabado en la pipeta *</label><div class="vp-checks">${_vpRev.opcionesBajo.map(v =>
      `<label><input type="radio" name="vp-vbajo" ${Number(ver.v_bajo_elegido) === v ? 'checked' : ''} onchange="_vpEstado.ver.v_bajo_elegido=${v};_vpPintarVerif()"> ${v} µl</label>`).join('')}</div>
      <div class="vp-guia">Queda anotado para corregir los datos de la pipeta. ${ver.v_bajo_elegido ? '' : 'Mientras no se elija, se usa el de la tabla 6.4.'}</div></div>`;
  }
  ver.fases.forEach((fase, fi) => {
    const tras = fase.tipo === 'tras_ajuste';
    html += `<h4 class="vp-h4">${tras ? `🔧 Repetición tras el ajuste (10 réplicas a cada volumen)${fase.ajustada_por ? ` · ajustada por ${_vpEsc(fase.ajustada_por)}` : ''}` : 'Réplicas'}</h4>`;
    for (const v of vols) {
      const dv = (fase.volumenes[v.clave] = fase.volumenes[v.clave] || { id_sesion: '', lote_sc: '1', canales: [] });
      while (dv.canales.length < nCan) dv.canales.push({ replicas: [] });
      const fot = v.metodo === 'fotométrico';
      const ses = DATA.verifSesiones.find(s => s.id === dv.id_sesion);
      const z = ses?.resultados?.z || null;
      const key = `${fi}-${v.clave}`;
      const canal = Math.min(_vpCanalVisible[key] || 0, nCan - 1);
      const reps = dv.canales[canal].replicas;
      const filas = Math.max(tras || _vpRev.sinCribado ? 10 : 4, reps.length);
      while (reps.length < filas) reps.push({ m: '', A: '' });
      const base = `fases.${fi}.volumenes.${v.clave}.canales.${canal}.replicas`;
      const ctxM = fot ? { masa_tabla: v.masa_tabla } : { v_ajustado: v.v, z };
      const disolSel = v.disolucion === 'S-C' && dv.lote_sc === '2' ? 'S-C2' : v.disolucion;
      html += `<div class="vp-volumen">
        <div class="vp-vol-cab"><strong>${VP.fmt(v.v, v.v < 10 ? 1 : 0)} µl</strong> (${v.clave === 'nominal' ? 'nominal' : 'volumen bajo'}) · ${v.metodo}${fot ? ` · disolución ${v.disolucion} · tubos con ${VP.fmt(v.masa_tabla, 3)} g de agua` : ' · balanza'}
          <div class="vp-guia">Límites: error sistemático ±${VP.fmt(v.LE, 1)} % · CV ${VP.fmt(v.LC, 1)} %${v.v < 5 ? ' · resultado orientativo (< 5 µl)' : ''}</div></div>
        <div class="form-grid">
          <div class="form-group"><label>Sesión en que se mide *</label><select onchange="_vpEstado.ver.fases[${fi}].volumenes['${v.clave}'].id_sesion=this.value;_vpPintarVerif()">${_vpOpcionesSesion(v.metodo, disolSel, dv.id_sesion)}</select>
            <div class="vp-guia">Todas las réplicas de un volumen, en la misma sesión: si hay que completar otro día, se repite el volumen entero.</div></div>
          ${fot && v.disolucion === 'S-C' && prep.F_C2 ? `<div class="form-group"><label>Lote de S-C</label><select onchange="_vpEstado.ver.fases[${fi}].volumenes['${v.clave}'].lote_sc=this.value;_vpPintarVerif()">
            <option value="1" ${dv.lote_sc !== '2' ? 'selected' : ''}>1.er lote</option><option value="2" ${dv.lote_sc === '2' ? 'selected' : ''}>2.º lote</option></select></div>` : ''}
        </div>
        ${nCan > 1 ? `<div class="vp-canales">${Array.from({ length: nCan }, (_, c) => {
          const dc = calc?.fases?.[fi]?.volumenes?.[v.clave]?.canales?.[c]?.decision;
          return `<button type="button" class="vp-canal ${c === canal ? 'activo' : ''} vp-dec-${(dc || '').toLowerCase()}" onclick="_vpCanalVisible['${key}']=${c};_vpPintarVerif()">${c + 1}</button>`;
        }).join('')}</div>` : ''}
        <div class="vp-tabla-wrap"><table class="vp-tabla"><thead><tr><th>Réplica</th><th>${fot ? 'Agua del tubo (g)' : 'Masa entregada (g)'}</th>${fot ? '<th>A del tubo</th>' : ''}<th>V (µl)</th></tr></thead><tbody>
          ${reps.map((_, i) => `<tr><td>${i + 1}${i === 4 && !tras && !_vpRev.sinCribado ? '<div class="vp-guia">punta nueva</div>' : ''}</td>
            <td>${_vpIn('ver', `${base}.${i}.m`, fot ? 'masa_tubo' : 'masa_entregada', { ctx: ctxM, ancho: '84px' })}</td>
            ${fot ? `<td>${_vpIn('ver', `${base}.${i}.A`, 'absorbancia', { ancho: '74px' })}</td>` : ''}
            <td class="vp-res" data-res="rv-${fi}-${v.clave}-${canal}-${i}"></td></tr>`).join('')}
        </tbody></table></div>
        ${reps.length < VP.CRITERIOS.max_replicas ? `<button type="button" class="btn-link vp-link" onclick="_vpMasReplicas(${fi},'${v.clave}',${canal})">+ Hasta 10 réplicas</button>` : ''}
        <div class="vp-res vp-bloque-res" data-res="v-${fi}-${v.clave}-${canal}"></div>
      </div>`;
    }
  });
  html += `<div class="form-grid" style="margin-top:12px">
      <div class="form-group"><label>Puntas usadas</label>${_vpTxt('ver', 'puntas', { ph: 'Marca y referencia' })}</div>
      <div class="form-group"><label>Observaciones de la verificación</label>${_vpTxt('ver', 'observaciones')}</div>
    </div>
    <div id="vp-ver-resultado" class="vp-validez"></div>`;
  cuerpo.innerHTML = html;
  cuerpo.querySelectorAll('.vp-in').forEach(el => { if (el.value) _vpComprobarCampo(el); });
  _vpPintarResultadosVer();
}

function _vpMasReplicas(fi, clave, canal) {
  const reps = _vpEstado.ver.fases[fi].volumenes[clave].canales[canal].replicas;
  while (reps.length < VP.CRITERIOS.max_replicas) reps.push({ m: '', A: '' });
  _vpPintarVerif();
}

function _vpPintarResultadosVer() {
  if (!_vpRev || !document.getElementById('vp-ver-cuerpo')) return;
  const calc = _vpCalcVer();
  if (!calc) return;
  const put = (k, html) => { const el = document.querySelector(`#vp-ver-cuerpo [data-res="${k}"]`); if (el) el.innerHTML = html; };
  calc.fases.forEach((f, fi) => {
    for (const [clave, v] of Object.entries(f.volumenes)) {
      const lim = calc.limites.find(l => l.clave === clave) || {};
      v.canales.forEach((c, ci) => {
        (c.V || []).forEach((x, i) => put(`rv-${fi}-${clave}-${ci}-${i}`, VP.fmt(x, lim.v < 10 ? 4 : 3)));
        const dec = VP.DECISION[c.decision] || c.decision;
        const cls = c.decision === 'OK' || c.decision === 'FUERA' ? 'badge-green' : c.decision === 'RETIRAR' ? 'badge-red'
          : ['AJUSTAR', 'COMPLETAR', 'TRAMO', 'DATOS', 'SESION'].includes(c.decision) ? 'badge-orange' : 'badge-gray';
        put(`v-${fi}-${clave}-${ci}`, `${c.Vmedio !== undefined ? `<div>n = ${c.n} · V medio <strong>${VP.fmt(c.Vmedio, 3)} µl</strong> · error sistemático <strong>${VP.fmt(c.es, 2, true)} %</strong> · CV observado ${VP.fmt(c.cvObs, 2)} % · CV del método ${VP.fmt(c.cvMet, 2)} % · CV corregido <strong>${VP.fmt(c.cvCorr, 2)} %</strong></div>` : ''}
          <div style="margin-top:4px"><span class="badge ${cls}">${_vpEsc(dec)}</span>${c.motivo ? ` <span class="vp-guia">${_vpEsc(c.motivo)}</span>` : ''}</div>
          ${(c.avisos || []).length ? `<div class="vp-aviso">${c.avisos.map(_vpEsc).join(' · ')}</div>` : ''}
          ${(c.errores || []).length ? `<div class="vp-err">${c.errores.map(_vpEsc).join(' · ')}</div>` : ''}`);
      });
    }
  });
  const res = document.getElementById('vp-ver-resultado');
  if (!res) return;
  const staff = _vpEsStaff();
  const par = _vpParDe(_vpRev.idEquipo);
  const ultima = _vpEstado.ver.fases[_vpEstado.ver.fases.length - 1];
  let acciones = '';
  if (calc.resultado === 'PREGUNTAR_AJUSTE') {
    acciones = staff ? `<div style="margin-top:8px">¿Tiene tornillo de ajuste bajo la tapa del émbolo?
        <button class="btn btn-secondary" onclick="responderAjustePipeta('${par.id_activo}','si')">Sí, tiene</button>
        <button class="btn btn-secondary" onclick="responderAjustePipeta('${par.id_activo}','no')">No tiene</button></div>`
      : '<div class="vp-guia" style="margin-top:6px">Pide al profesorado que mire si tiene tornillo de ajuste bajo la tapa del émbolo: si lo tiene, se ajusta; si no, se retira.</div>';
  } else if (calc.resultado === 'AJUSTAR' && ultima.tipo !== 'tras_ajuste') {
    acciones = staff ? `<div style="margin-top:8px"><button class="btn btn-primary" onclick="_vpHeAjustado()">🔧 He ajustado la pipeta (6.3): repetir con 10 réplicas</button>
        <div class="vp-guia">Se conservan los datos de antes del ajuste. Si después sigue sin cumplir, se retira.</div></div>`
      : '<div class="vp-guia" style="margin-top:6px">El ajuste lo hace el profesorado (apartado 6.3 del protocolo). Guarda el progreso y avísale.</div>';
  }
  res.innerHTML = `<div><strong>Resultado de la pipeta:</strong> ${_vpBadgeResultado(calc.resultado)}</div>
    <div class="vp-guia">${_vpEsc(VP.RESULTADO[calc.resultado] || '')}${calc.final ? '' : ' · ' + _vpEsc(VP.resumenPendiente(calc))}</div>
    ${(calc.avisos || []).length ? `<div class="vp-aviso">${calc.avisos.map(_vpEsc).join(' · ')}</div>` : ''}
    ${_vpRev.extra
      ? (calc.final ? `<div class="vp-aviso-caja${/^OK/.test(calc.resultado) ? '' : ' vp-grave'}">${/^OK/.test(calc.resultado)
          ? 'Al finalizar, el resultado queda en la incidencia y ya se podrá cerrar desde su hilo dejando la pipeta operativa.'
          : 'Al finalizar, el resultado queda en la incidencia y la pipeta sigue fuera de servicio, con la incidencia abierta. Mantén la etiqueta «NO USAR».'}</div>` : '')
      : (/^RETIRAR/.test(calc.resultado) ? '<div class="vp-aviso-caja vp-grave">Al finalizar la revisión, GestionLab abre la incidencia de la pipeta con lo que ha fallado y la deja fuera de servicio. Ponle la etiqueta «NO USAR».</div>' : '')}
    ${acciones}`;
}

function _vpHeAjustado() {
  if (!confirm('¿Has ajustado la pipeta según el apartado 6.3 de su protocolo? Después se repiten los dos volúmenes con 10 réplicas.')) return;
  _vpEstado.ver.fases.push({ tipo: 'tras_ajuste', volumenes: {} });
  _vpPintarVerif();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA HTML DE RECOGIDA (sin conexión) E IMPORTACIÓN DE SU ARCHIVO
// ═══════════════════════════════════════════════════════════════════════════════
// La página se genera aquí para que lleve las pipetas, volúmenes, límites y formato de ESTA
// versión. Lleva solo el bloque «COMPROBAR DATOS» del módulo de cálculo: recoge y comprueba,
// no calcula ni decide (encargo, apartado 10).

/** Genera la página de recogida del curso elegido: { html, nombre }. */
async function vpGenerarPaginaRecogida() {
    const [plantilla, modulo] = await Promise.all([
      fetch('assets/verif-pipetas-recogida.html', { cache: 'no-store' }).then(r => r.text()),
      fetch('supabase/functions/_shared/verif_pipetas.js', { cache: 'no-store' }).then(r => r.text()),
    ]);
    const ini = modulo.indexOf('/* >>> COMPROBAR DATOS'), fin = modulo.indexOf('/* <<< COMPROBAR DATOS */');
    if (ini < 0 || fin < 0) throw new Error('No se encontró el bloque de comprobación de datos');
    const validacion = modulo.slice(ini, fin).replace(/^export\s+/gm, '');
    const curso = _vpCurso();
    const prepRow = _vpPrepDe(curso);
    const prep = VP.calcularPreparacion(prepRow?.datos || {});
    const repBal = VP.repetibilidadBalanzas(_vpSesionesDe(curso).map(s => s.resultados?.validacion).filter(Boolean));
    const plan = id => DATA.planesMantenimiento.find(p => p.ID_Equipo === id && p.Activo !== 'FALSE' && p.Periodicidad === 'Pretemporada');
    const datos = {
      curso, generada: new Date().toISOString(), formato: VP.FORMATO_ARCHIVO,
      hay_lote2: !!prep.F_C2,
      balanzas: Object.entries(VP.BALANZAS_TUBOS).map(([id, b]) => ({ id, nombre: b.nombre, s: repBal[id]?.s || null })),
      tubos: (prepRow?.tubos || []).map(t => ({ id: t.id, disolucion: t.disolucion, bloque: t.bloque })),
      sesiones: _vpSesionesDe(curso).map(s => ({ id: s.id, fecha: formatDate(s.fecha) })),
      pipetas: (DATA.verifParametros || []).filter(p => p.v_nominal)
        .sort((a, b) => a.id_activo.localeCompare(b.id_activo, 'es', { numeric: true }))
        .map(p => ({ id: p.id_activo, marca: p.marca_modelo || '', rango: p.rango || '', confirmar: p.confirmar || '',
          canales: VP.canalesDe(p), opciones_bajo: VP.opcionesVolumenBajo(plan(p.id_activo)?.Instrucciones),
          volumenes: VP.volumenesDe(p).map(v => ({ clave: v.clave, v: v.v, metodo: v.metodo, disolucion: v.disolucion, masa_tabla: v.masa_tabla })) })),
    };
    const json = JSON.stringify(datos).replace(/</g, '\\u003c');
    // Reemplazo con función: con un texto, «$'» o «$&» dentro del código se interpretarían.
    const html = plantilla
      .replace('/*__DATOS__*/', () => 'const DATOS = ' + json + ';')
      .replace('/*__VALIDACION__*/', () => validacion.replace(/<\/script/gi, '<\\/script'));
    return { html, nombre: `recogida-verificacion-pipetas-${curso}.html` };
}

async function descargarPaginaRecogidaVerif() {
  if (!_vpListo()) return;
  showLoading('Preparando la página…');
  try {
    const { html, nombre } = await vpGenerarPaginaRecogida();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    showToast('Página descargada: ábrela en el navegador del móvil, la tableta o el ordenador (funciona sin conexión)', 'success');
  } catch (e) { showToast(e.message || 'No se pudo preparar la página', 'error'); console.error(e); }
  hideLoading();
}

let _vpImportDestino = null;
function vpElegirArchivo(destino) {
  _vpImportDestino = destino;
  const inp = document.getElementById('vp-archivo');
  inp.value = '';
  inp.click();
}

async function vpLeerArchivo(input) {
  const f = input.files?.[0];
  if (!f) return;
  let a;
  try { a = JSON.parse(await f.text()); } catch { showToast('El archivo no es de la página de recogida', 'error'); return; }
  if (a?.tipo !== 'gestionlab-verif-pipetas') { showToast('El archivo no es de la página de recogida de la verificación', 'error'); return; }
  if (a.formato !== VP.FORMATO_ARCHIVO) { showToast('El archivo es de otra versión de la página: descárgala de nuevo desde la app y vuelve a pasar los datos', 'error'); return; }
  if (_vpImportDestino === 'sesion') return _vpImportarSesion(a);
  if (_vpImportDestino === 'pipeta') return _vpImportarPipeta(a);
}

/** Rellena el formulario de la sesión con lo del archivo; la persona lo revisa antes de guardar. */
function _vpImportarSesion(a) {
  if (!a.sesion) { showToast('El archivo no lleva datos de la sesión', 'error'); return; }
  if (!_vpEsStaff()) { showToast('Las sesiones las registra el profesorado', 'error'); return; }
  const e = _vpEstado.ses;
  if (a.curso && a.curso !== e.curso_academico) { showToast(`El archivo es del curso ${a.curso}`, 'error'); return; }
  const d = JSON.parse(JSON.stringify(a.sesion.datos || {}));
  e.fecha = a.sesion.fecha || e.fecha; e.bloque = a.sesion.bloque || ''; e.personas = a.sesion.personas || '';
  e.datos = { ...e.datos, ...d };
  e.datos.abs_P = (e.datos.abs_P || []).slice(0, 5); while (e.datos.abs_P.length < 5) e.datos.abs_P.push('');
  e.datos.lecturas_cv = (e.datos.lecturas_cv || []).slice(0, 10); while (e.datos.lecturas_cv.length < 10) e.datos.lecturas_cv.push('');
  _vpPintarSesion();
  _vpAvisoImportado('vp-ses-cuerpo');
}

/** Rellena la verificación de la pipeta abierta con lo del archivo. */
function _vpImportarPipeta(a) {
  const p = (a.pipetas || []).find(x => x.id_activo === _vpRev?.idEquipo);
  if (!p) { showToast(`El archivo no lleva datos de ${_vpRev?.idEquipo}`, 'error'); return; }
  const ver = _vpEstado.ver;
  const fase = ver.fases[ver.fases.length - 1];
  // «La de este archivo» → la sesión de GestionLab con la fecha de la sesión del archivo
  const fechaArchivo = a.sesion?.fecha || null;
  const sesApp = fechaArchivo ? _vpSesionesDe(_vpRev.curso).find(s => String(s.fecha) === fechaArchivo) : null;
  const sinSesion = [];
  for (const [clave, dv] of Object.entries(p.volumenes || {})) {
    let id = dv.sesion === 'archivo' ? (sesApp?.id || '') : (DATA.verifSesiones.some(s => s.id === dv.sesion) ? dv.sesion : '');
    if (!id) sinSesion.push(clave === 'nominal' ? 'nominal' : 'volumen bajo');
    fase.volumenes[clave] = { id_sesion: id, lote_sc: dv.lote_sc === '2' ? '2' : '1',
      canales: (dv.canales || []).map(c => ({ replicas: (c.replicas || []).slice(0, 12).map(r => ({ m: String(r.m ?? ''), A: String(r.A ?? '') })) })) };
  }
  if (p.v_bajo_elegido && _vpRev.opcionesBajo?.includes(Number(p.v_bajo_elegido))) ver.v_bajo_elegido = Number(p.v_bajo_elegido);
  if (p.puntas) ver.puntas = p.puntas;
  if (p.observaciones) ver.observaciones = p.observaciones;
  _vpPintarVerif();
  _vpAvisoImportado('vp-ver-cuerpo', sinSesion.length ? `Falta la sesión de: ${sinSesion.join(', ')}${fechaArchivo ? ` (la del archivo, ${fechaArchivo}, no está en GestionLab: impórtala antes en «Verificación de pipetas» → la sesión)` : ''}.` : '');
}

function _vpAvisoImportado(idCuerpo, extra) {
  const nErr = document.querySelectorAll(`#${idCuerpo} .vp-mal`).length;
  const nAv = document.querySelectorAll(`#${idCuerpo} .vp-dudoso`).length;
  showToast(`Datos importados: revísalos antes de guardar.${nErr ? ` ${nErr} ${nErr === 1 ? 'no cumple' : 'no cumplen'} (en rojo) y hay que corregir${nErr === 1 ? 'lo' : 'los'}.` : ''}${nAv ? ` ${nAv} con aviso.` : ''}${extra ? ' ' + extra : ''}`, nErr ? 'error' : 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN EXTRAORDINARIA TRAS UNA REPARACIÓN (2026-11-25)
// ═══════════════════════════════════════════════════════════════════════════════
// Fuera de calendario, enlazada a la incidencia de la pipeta, sin cribado (10 réplicas a cada
// volumen) y con el mismo formulario y cálculo que la revisión anual. La guarda
// gestionar-verif-pipetas (_shared/verif_extra.ts). La pipeta solo vuelve a «Operativo» si sale
// OK: lo comprueba el servidor al cerrar la incidencia desde su hilo. Solo profesorado.

const _vpIncAbierta = i => i.Estado === 'Abierta' || i.Estado === 'En gestión';
const _vpEquipoDeInc = i => i.ID_Equipo || String(i.Equipo || '').split(' – ')[0].trim();

/** Última verificación extraordinaria de una incidencia (en curso o finalizada), o null. */
function vpExtraordinariaDeIncidencia(idIncidencia) {
  return (DATA.verifExtraordinarias || []).filter(x => x.id_incidencia === idIncidencia)
    .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)))[0] || null;
}

function _vpModoPieVerif(extra, finalizada) {
  const ver = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  ver('vp-ver-volver', !extra);
  ver('vp-ver-importar', !extra || !finalizada);
  ver('vp-ver-x-cerrar', extra);
  ver('vp-ver-x-progreso', extra && !finalizada);
  ver('vp-ver-x-finalizar', extra && !finalizada);
}

/** Abre la verificación extraordinaria de una incidencia (la que está en curso, una concreta, o una nueva). */
function vpAbrirExtraordinaria(idEquipo, idIncidencia, idExtra) {
  if (!_vpListo()) return;
  if (!_vpEsStaff()) { showToast('La verificación extraordinaria la hace el profesorado', 'error'); return; }
  const par = _vpParDe(idEquipo);
  if (!par) { showToast(`${idEquipo} no tiene datos de verificación (tabla 6.4)`, 'error'); return; }
  const x = idExtra ? (DATA.verifExtraordinarias || []).find(e => e.id === idExtra)
    : (DATA.verifExtraordinarias || []).find(e => e.id_incidencia === idIncidencia && e.estado === 'en_curso');
  const g = x?.verificacion;
  _vpEstado.ver = JSON.parse(JSON.stringify(g ? { fases: g.fases, v_bajo_elegido: g.v_bajo_elegido || null, puntas: g.puntas || '', observaciones: g.observaciones || '' }
    : { fases: [{ tipo: 'inicial', volumenes: {} }], v_bajo_elegido: null, puntas: '', observaciones: '' }));
  const plan = DATA.planesMantenimiento.find(p => p.ID_Equipo === idEquipo && p.Activo !== 'FALSE' && p.Periodicidad === 'Pretemporada');
  _vpRev = { idEquipo, curso: x?.curso_academico || getCursoAcademico(), sinCribado: true,
    opcionesBajo: VP.opcionesVolumenBajo(plan?.Instrucciones),
    extra: { id: x?.id || null, id_incidencia: x?.id_incidencia || idIncidencia, finalizada: x?.estado === 'finalizada' } };
  _vpModoPieVerif(true, _vpRev.extra.finalizada);
  _vpPintarVerif();
  openModal('modal-verif-pipeta');
}

async function guardarVerifExtraordinaria(finalizar) {
  if (!_vpRev?.extra) return;
  if (finalizar) {
    const calc = _vpCalcVer();
    if (!calc?.final) { showToast('La verificación no tiene resultado todavía: ' + VP.resumenPendiente(calc), 'error'); return; }
    const ok = /^OK/.test(calc.resultado);
    if (!confirm(`Resultado: ${VP.RESULTADO[calc.resultado] || calc.resultado}.\n\n` + (ok
      ? 'Queda anotado en la incidencia. Después podrás cerrarla desde su hilo dejando la pipeta operativa.'
      : 'Queda anotado en la incidencia y la pipeta sigue fuera de servicio.') + '\n\n¿Finalizar la verificación?')) return;
  }
  showLoading(finalizar ? 'Finalizando…' : 'Guardando…');
  try {
    const r = await callEdgeFunction('gestionar-verif-pipetas', {
      accion: 'extraordinaria_guardar', id: _vpRev.extra.id, id_equipo: _vpRev.idEquipo,
      id_incidencia: _vpRev.extra.id_incidencia, curso_academico: _vpRev.curso,
      verificacion: JSON.parse(JSON.stringify(_vpEstado.ver)), finalizar,
      fecha: new Date().toISOString().slice(0, 10),
    });
    DATA.verifExtraordinarias = DATA.verifExtraordinarias || [];
    const i = DATA.verifExtraordinarias.findIndex(x => x.id === r.extra.id);
    if (i >= 0) DATA.verifExtraordinarias[i] = r.extra; else DATA.verifExtraordinarias.push(r.extra);
    _vpRev.extra.id = r.extra.id;
    const idEq = _vpRev.idEquipo;
    if (r.incidencia) {
      const inc = _incidenciaSbToObj(r.incidencia);
      const k = DATA.incidencias.findIndex(x => x.ID_Incidencia === inc.ID_Incidencia);
      if (k >= 0) DATA.incidencias[k] = inc;
    }
    if (r.equipo_estado) { const eq = DATA.equipos.find(e => e.ID_Activo === idEq); if (eq) eq.Estado_Operativo = r.equipo_estado; }
    if (finalizar) {
      const ok = /^OK/.test(r.extra.resultado);
      cerrarVerifPipeta();
      showToast(ok ? 'Verificación extraordinaria OK. Ya puedes cerrar la incidencia desde su hilo, con la pipeta operativa.'
        : 'Verificación extraordinaria finalizada: la pipeta sigue fuera de servicio.', ok ? 'success' : 'error');
    } else showToast('Progreso guardado', 'success');
    if (document.getElementById('page-verif-pipetas')?.classList.contains('active')) renderVerifPipetas();
  } catch (e) { showToast(e.message || 'No se pudo guardar', 'error'); console.error(e); }
  hideLoading();
}

async function eliminarVerifExtraordinaria(id) {
  if (!confirm('¿Borrar esta verificación extraordinaria sin finalizar? Se pierden los datos metidos.')) return;
  showLoading('Borrando…');
  try {
    await callEdgeFunction('gestionar-verif-pipetas', { accion: 'extraordinaria_eliminar', id });
    DATA.verifExtraordinarias = (DATA.verifExtraordinarias || []).filter(x => x.id !== id);
    showToast('Borrada', 'success');
    renderVerifPipetas();
  } catch (e) { showToast(e.message || 'No se pudo borrar', 'error'); }
  hideLoading();
}

/** Incidencias abiertas de pipetas con datos de verificación: las que pueden necesitar una extraordinaria. */
function _vpIncidenciasDePipetas() {
  const conDatos = new Set((DATA.verifParametros || []).map(p => p.id_activo));
  return (DATA.incidencias || []).filter(i => _vpIncAbierta(i) && conDatos.has(_vpEquipoDeInc(i)))
    .sort((a, b) => _vpEquipoDeInc(a).localeCompare(_vpEquipoDeInc(b), 'es', { numeric: true }));
}

function openModalVerifExtraNueva() {
  const lista = _vpIncidenciasDePipetas();
  document.getElementById('vp-extra-nueva-cuerpo').innerHTML = lista.length ? `
    <div class="form-group"><label>Pipeta e incidencia *</label>
      <select id="vp-extra-inc">${lista.map(i => `<option value="${_vpEsc(i.ID_Incidencia)}">${_vpEsc(_vpEquipoDeInc(i))} · ${_vpEsc(i.ID_Incidencia)} — ${_vpEsc(String(i.Descripcion_Problema || '').slice(0, 70))}</option>`).join('')}</select>
      <div class="vp-guia">Solo salen las pipetas con una incidencia abierta: la verificación extraordinaria es la que se hace tras repararlas o cambiarles la junta.</div></div>`
    : '<div class="vp-guia">Ninguna micropipeta tiene una incidencia abierta. La verificación extraordinaria se hace tras una reparación: primero tiene que estar abierta su incidencia.</div>';
  openModal('modal-verif-extra-nueva');
}

function vpEmpezarExtraordinariaElegida() {
  const idInc = document.getElementById('vp-extra-inc')?.value;
  closeModal('modal-verif-extra-nueva');
  if (!idInc) return;
  const inc = DATA.incidencias.find(i => i.ID_Incidencia === idInc);
  vpAbrirExtraordinaria(_vpEquipoDeInc(inc), idInc);
}

function _vpHtmlExtraordinarias(staff) {
  const lista = (DATA.verifExtraordinarias || []).slice()
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'en_curso' ? -1 : 1) || String(b.actualizado).localeCompare(String(a.actualizado)));
  const fila = x => {
    const inc = DATA.incidencias.find(i => i.ID_Incidencia === x.id_incidencia);
    const calc = x.verificacion?.calculo;
    return `<tr>
      <td><strong>${_vpEsc(x.id_equipo)}</strong></td>
      <td style="font-size:12px">${_vpEsc(x.id_incidencia)}${inc ? ` <span class="badge badge-gray">${_vpEsc(inc.Estado)}</span>` : ''}</td>
      <td style="font-size:12px">${x.estado === 'finalizada' ? `${formatDate(x.fecha)} · ${_vpBadgeResultado(x.resultado)}` : `<span class="badge badge-orange">▶ En curso</span>${calc ? ' ' + _vpBadgeResultado(calc.resultado) : ''}`}</td>
      <td><div class="row-actions">
        ${staff ? `<button class="icon-btn" title="${x.estado === 'finalizada' ? 'Ver' : 'Continuar'}" onclick="vpAbrirExtraordinaria('${x.id_equipo}','${x.id_incidencia}','${x.id}')">${x.estado === 'finalizada' ? '👁' : '✏️'}</button>` : ''}
        ${staff && x.estado === 'en_curso' ? `<button class="icon-btn" title="Borrar" onclick="eliminarVerifExtraordinaria('${x.id}')">🗑️</button>` : ''}
      </div></td></tr>`;
  };
  return `<div class="card">
      <div class="card-header">
        <div class="card-title">🔧 Verificaciones extraordinarias (tras una reparación)</div>
        <div class="card-actions">${staff ? '<button class="btn btn-primary" onclick="openModalVerifExtraNueva()">+ Nueva</button>' : ''}</div>
      </div>
      <div style="padding:0 16px 10px;font-size:13px;color:var(--text-soft);line-height:1.55">
        Tras reparar una pipeta o cambiarle la junta, fuera de calendario: se enlaza a su incidencia y se hacen <strong>10 réplicas
        a cada volumen</strong>, sin cribado, con los mismos cálculos. La pipeta solo vuelve a estar operativa si sale <strong>OK</strong>.
      </div>
      ${lista.length ? `<table><thead><tr><th>Pipeta</th><th>Incidencia</th><th>Resultado</th><th></th></tr></thead><tbody>${lista.map(fila).join('')}</tbody></table>`
        : '<div style="padding:0 16px 16px;color:var(--text-muted);font-size:13px">Todavía no hay ninguna.</div>'}
    </div>`;
}

/** Bloque del hilo de la incidencia de una pipeta: estado de su verificación extraordinaria. */
function vpHtmlExtraordinariaHilo(inc) {
  if (!window.VP || !inc) return '';
  const idEq = _vpEquipoDeInc(inc);
  if (!_vpParDe(idEq) || !_vpIncAbierta(inc)) return '';
  const x = vpExtraordinariaDeIncidencia(inc.ID_Incidencia);
  const fin = x?.estado === 'finalizada';
  const ok = fin && /^OK/.test(x.resultado || '');
  const btn = _vpEsStaff() ? `<div><button class="btn btn-primary" style="font-size:12px;padding:5px 10px;margin-top:6px"
      onclick="closeModal('modal-hilo-incidencia');vpAbrirExtraordinaria('${idEq}','${inc.ID_Incidencia}'${x && !fin ? `,'${x.id}'` : ''})">🧪 ${x && !fin ? 'Continuar la' : fin ? 'Hacer otra' : 'Hacer la'} verificación extraordinaria</button></div>` : '';
  return `<div style="padding:10px 12px;margin-top:8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px;background:var(--bg)">
    <strong>🧪 Verificación extraordinaria</strong> (tras la reparación, 10 réplicas):
    ${!x ? 'sin hacer. La pipeta solo vuelve a estar operativa si sale OK.'
      : !fin ? 'empezada, sin finalizar.'
      : `${formatDate(x.fecha)} · ${_vpBadgeResultado(x.resultado)} ${ok ? '— ya se puede cerrar la incidencia dejando la pipeta operativa.' : '— la pipeta sigue fuera de servicio.'}`}
    ${!ok ? btn : ''}
  </div>`;
}

/** ¿La pipeta de esta incidencia necesita aún una extraordinaria OK para volver a «Operativo»? */
function vpFaltaExtraordinariaOK(inc) {
  if (!window.VP || !inc) return false;
  const idEq = _vpEquipoDeInc(inc);
  if (!_vpParDe(idEq)) return false;
  const eq = DATA.equipos.find(e => e.ID_Activo === idEq);
  if (/^Operativo/i.test(eq?.Estado_Operativo || '')) return false;
  const x = vpExtraordinariaDeIncidencia(inc.ID_Incidencia);
  return !(x?.estado === 'finalizada' && /^OK/.test(x.resultado || ''));
}
