// ============================================================
// REGISTROS DE USO (Cabina de bioseguridad / Autoclave / Vitrina de gases)
// ============================================================
//
// Cada pestaña se describe entera en `_regConfig`: de qué tipos de equipo del
// inventario se nutre, si admite sesión abierta y qué campos propios registra.
// Los campos se pintan, se leen y se validan de forma genérica a partir de
// `campos[]`, así que añadir un equipo nuevo no toca ninguna función de render.
//
// Sustituyen a las hojas en papel de la cabina, las vitrinas y los autoclaves (decisión de
// Paloma del 23/11/2026): recogen lo que pedía cada hoja (apartado 11 de sus protocolos).
// Un registro cerrado solo lo corrige Gestión (Gestor/Administrador), y queda constancia de
// quién, cuándo, por qué y qué ponía antes (`Correcciones`, ver gestionar-registro-uso).
//
//   campo      nombre de la propiedad en DATA (`Practica_Tecnica`)
//   api        nombre de la columna en Supabase (`practica_tecnica`)
//   label      cabecera en el historial y en el informe
//   labelForm  etiqueta dentro del modal (por defecto, `label`)
//   tipo       'text' | 'number' | 'select' | 'check'  ('check' guarda 'Sí' / 'No')
//   fase       'inicio': se pide ya al arrancar (ciclo de autoclave); el resto, al terminar
//   full       ocupa el ancho completo del form-grid-2
//   requerido  bloquea el guardado si viene vacío
//   permiteOtro  añade opción "Otro" + campo de texto libre (select)
//   mostrar    (r) => texto para el historial y el informe (por defecto, el valor)
//   soloHistorial + soloSiHay  columna antigua: no está en el formulario y solo sale en el
//              historial si algún registro la tiene rellena

// Programas habituales del apartado 7 del protocolo de los autoclaves (no tienen programas
// guardados: temperatura y minutos se ajustan en cada ciclo). Cualquier otro, con «Otro».
const PROGRAMAS_AUTOCLAVE = ['121 °C / 20 min', '121 °C / 30 min', '121 °C / 45 min', '121 °C / 60 min', '134 °C / 10 min', '134 °C / 3 min'];
const CARGAS_AUTOCLAVE    = ['Material', 'Medios', 'Residuos'];
const INDICADORES_QUIMICOS = ['Viró', 'No viró', 'No se puso'];
const _COMPROBACIONES_PREVIAS = 'Comprobaciones previas hechas (apartado 4 del protocolo)';

const _regConfig = {
  cabina: {
    key: 'registrosCabina', sheet: 'Registros_Cabina', lastCol: 'L',
    // «Cabina de seguridad biológica» es como figura CAB-03 desde la recarga del inventario de
    // 2026-10; sin él la pestaña decía «no hay ningún equipo» y no dejaba registrar (2026-11-23).
    tiposEquipo: ['Cabina de bioseguridad', 'Cabina de seguridad biológica'], prefix: 'RC',
    label: 'Cabina de bioseguridad', tabLabel: '🧫 Cabina de bioseguridad',
    // La cabina se usa con presencia continua → tiene sentido abrir sesión al entrar y cerrarla al salir.
    permiteSesionAbierta: true,
    // Trazabilidad del modelo de calidad: quién usó la cabina debe quedar ligado a su ciclo/módulo.
    mostrarCicloModulo: true,
    labelIncidencias: 'Alarmas e incidencias',
    placeholderIncidencias: 'Alarmas que hayan saltado, derrames u otras incidencias (opcional)',
    campos: [
      { campo: 'Practica_Tecnica', api: 'practica_tecnica', label: 'Práctica / técnica',
        tipo: 'text', full: true, requerido: true, placeholder: 'ej. Siembra en medio de cultivo' },
      // Laboratorios de nivel de contención 2: no se trabajan agentes del grupo 3.
      { campo: 'Grupo_Riesgo', api: 'grupo_riesgo', label: 'Grupo de riesgo',
        labelForm: 'Grupo de riesgo del agente', tipo: 'select', requerido: true,
        opciones: ['No aplica', '1', '2'] },
      { campo: 'Minutos_UV', api: 'minutos_uv', label: 'UV (min)',
        labelForm: 'Minutos de UV (si se ha usado)', tipo: 'number', entero: true, placeholder: 'ej. 15' },
      { campo: 'Verificacion_Previa', api: 'verificacion_previa', label: 'Comprobaciones previas',
        labelForm: _COMPROBACIONES_PREVIAS, tipo: 'check' },
      { campo: 'Desinfeccion_Inicial', api: 'desinfeccion_inicial', label: 'Desinfección inicial',
        labelForm: 'Desinfección inicial hecha', tipo: 'check' },
      { campo: 'Descontaminacion_Posterior', api: 'descontaminacion_posterior', label: 'Desinfección final',
        labelForm: 'Desinfección final hecha', tipo: 'check' },
      { campo: 'Nivel_Riesgo', api: 'nivel_riesgo', label: 'Nivel de riesgo (registros antiguos)',
        soloHistorial: true, soloSiHay: true },
    ]
  },
  autoclave: {
    key: 'registrosAutoclave', sheet: 'Registros_Autoclave', lastCol: 'K',
    tiposEquipo: ['Autoclave'], prefix: 'RA',
    label: 'Autoclave', tabLabel: '♨️ Autoclave',
    // El ciclo se apunta al arrancarlo (queda «en marcha», como una sesión abierta) y se completa
    // al terminar, antes de abrir. Lo completa cualquiera: el ciclo es del autoclave.
    permiteSesionAbierta: true, arranqueConDatos: true, cierraCualquiera: true,
    // Trazabilidad del modelo de calidad: quién usó el autoclave debe quedar ligado a su ciclo/módulo.
    mostrarCicloModulo: true,
    placeholderIncidencias: 'Mensajes de error del panel (el código tal como sale) u otras incidencias del ciclo (opcional)',
    campos: [
      { campo: 'Programa_Ciclo', api: 'programa_ciclo', label: 'Programa',
        labelForm: 'Programa (temperatura y minutos)', tipo: 'select', fase: 'inicio', requerido: true,
        opciones: PROGRAMAS_AUTOCLAVE, permiteOtro: true },
      { campo: 'Tipo_Carga', api: 'tipo_carga', label: 'Tipo de carga',
        tipo: 'select', fase: 'inicio', requerido: true, opciones: CARGAS_AUTOCLAVE, permiteOtro: true },
      { campo: 'Temperatura_Max', api: 'temperatura_max', label: 'T máx (°C)',
        labelForm: 'Temperatura máxima alcanzada (°C)', tipo: 'number', requerido: true, placeholder: 'ej. 121,5' },
      { campo: 'Presion_Max', api: 'presion_max', label: 'P máx (bar)',
        labelForm: 'Presión máxima alcanzada (bar)', tipo: 'number', requerido: true, placeholder: 'ej. 1,1' },
      { campo: 'Cinta_Indicadora', api: 'cinta_indicadora', label: 'Cinta indicadora',
        tipo: 'select', requerido: true, opciones: INDICADORES_QUIMICOS },
      { campo: 'Integrador_Quimico', api: 'integrador_quimico', label: 'Integrador químico',
        tipo: 'select', requerido: true, opciones: INDICADORES_QUIMICOS },
      // El resultado se apunta al leerlo, 24–48 h después (openModalBiologico).
      { campo: 'Indicador_Biologico', api: 'indicador_biologico', label: 'Indicador biológico',
        labelForm: 'Lleva indicador biológico (su resultado se apunta al leerlo, 24–48 h después)',
        tipo: 'check', fase: 'inicio',
        mostrar: r => r.Indicador_Biologico !== 'Sí' ? '—'
          : r.Resultado_Biologico ? `${r.Resultado_Biologico} (leído el ${_fmtFechaReg(r.Fecha_Lectura_Biologico)})`
          : '⏳ Pendiente de leer' },
      { campo: 'Resultado_Control', api: 'resultado_control', label: 'Indicadores (registros antiguos)',
        soloHistorial: true, soloSiHay: true },
    ]
  },
  vitrina: {
    key: 'registrosVitrina', sheet: 'Registros_Vitrina', lastCol: 'L',
    // El inventario arrastra tres nombres distintos para el mismo tipo de aparato
    // (los tres son Indelab Flow lan sv); la pestaña los recoge todos para no dejar
    // equipos fuera. "Campana de seguridadd" (CAB-04, con errata en el dato) es una
    // vitrina de gases de recirculación con filtro de carbono — confirmado por la usuaria.
    // CAB-02, «Vitrina de filtración (carbón activo, recirculación)», también se registra aquí
    // (confirmado por Paloma, 2026-11-23).
    tiposEquipo: ['Vitrina de extracción de gases', 'Cabina de extracción de gases', 'Campana de seguridadd',
                  'Vitrina de filtración (carbón activo, recirculación)'], prefix: 'RV',
    label: 'Vitrina de extracción de gases', tabLabel: '🌫️ Vitrina de gases',
    // Como la cabina: presencia continua mientras se trabaja dentro de la vitrina.
    permiteSesionAbierta: true,
    mostrarCicloModulo: true,
    campos: [
      { campo: 'Practica_Tecnica', api: 'practica_tecnica', label: 'Práctica / técnica',
        tipo: 'text', full: true, requerido: true, placeholder: 'ej. Digestión ácida de muestras' },
      { campo: 'Productos_Quimicos', api: 'productos_quimicos', label: 'Productos / reactivos',
        labelForm: 'Productos / reactivos manipulados', tipo: 'text', full: true, requerido: true,
        placeholder: 'ej. Ácido clorhídrico, xileno' },
      { campo: 'Verificacion_Previa', api: 'verificacion_previa', label: 'Comprobaciones previas',
        labelForm: _COMPROBACIONES_PREVIAS, tipo: 'check' },
      { campo: 'Limpieza_Posterior', api: 'limpieza_posterior', label: 'Limpieza posterior',
        labelForm: 'Limpieza y retirada de material al terminar', tipo: 'check' }
    ]
  }
};

// Textos que cambian entre una sesión (cabina, vitrina) y un ciclo (autoclave).
function _txtReg(cfg) {
  return cfg.arranqueConDatos
    ? { abiertas: 'Ciclos en marcha', cerrar: '■ Completar ciclo', registro: 'ciclo' }
    : { abiertas: 'Sesiones abiertas', cerrar: '■ Cerrar sesión', registro: 'sesión' };
}

/** Campos del formulario según el momento: 'inicio' (arrancar un ciclo) o el resto. */
function _camposFormReg(tipo, modo) {
  return _regConfig[tipo].campos.filter(c => !c.soloHistorial && (modo !== 'inicio' || c.fase === 'inicio'));
}

/** Columnas del historial / informe: las antiguas solo si alguna fila las tiene. */
function _camposHistorialReg(tipo, filas) {
  return _regConfig[tipo].campos.filter(c => !c.soloSiHay || filas.some(r => r[c.campo]));
}

function _valorReg(c, r) {
  if (c.mostrar) return c.mostrar(r);
  const v = r[c.campo];
  if (v === '' || v === null || v === undefined) return '—';
  return c.tipo === 'number' ? String(v).replace('.', ',') : v;
}

const _regTipos = Object.keys(_regConfig);

let _regTab          = 'cabina';
let _regEquipoSel    = Object.fromEntries(_regTipos.map(t => [t, '']));
let _regCtx          = null;   // {tipo, idx: number|null}
let _regAvisoMostrado = false;

// ── Helpers ──────────────────────────────────────────────────

function _puedeGestionarRegistros() { return ['Administrador', 'Gestor'].includes(getUserRole()); }
function _puedeVerNfcRegistros() { return ['Administrador', 'Gestor', 'Profesor'].includes(getUserRole()); }

function _equiposDeTipo(tipo) {
  const tipos = _regConfig[tipo].tiposEquipo;
  return DATA.equipos.filter(e => tipos.includes(e.Tipo_Equipo));
}

function _equipoRegDefault(tipo) {
  const equipos = _equiposDeTipo(tipo);
  if (_regEquipoSel[tipo] && equipos.some(e => e.ID_Activo === _regEquipoSel[tipo])) return _regEquipoSel[tipo];
  return equipos.length === 1 ? equipos[0].ID_Activo : (equipos[0]?.ID_Activo || '');
}

// Mapeo fila de Supabase → objeto de DATA, por pestaña (ver _xSbToObj en js/sheets.js).
function _regSbToObj(tipo, registro) {
  const mapa = {
    cabina: _registroCabinaSbToObj,
    autoclave: _registroAutoclaveSbToObj,
    vitrina: _registroVitrinaSbToObj,
  };
  return mapa[tipo](registro);
}

function _nombreEquipoReg(idEquipo) {
  const eq = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  return eq ? `${idEquipo} — ${[eq.Marca, eq.Modelo].filter(Boolean).join(' ')}`.trim() : idEquipo;
}

function _fmtFechaReg(f) {
  if (!f) return '—';
  try { return new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return f; }
}

function _duracionHorasReg(r) {
  if (!r.Fecha || !r.Hora_Inicio || !r.Hora_Fin) return 0;
  const h = (new Date(`${r.Fecha}T${r.Hora_Fin}`) - new Date(`${r.Fecha}T${r.Hora_Inicio}`)) / 3600000;
  return h > 0 ? h : 0;
}

/** Cómo figura quien hizo el registro: el nombre del grupo (cuentas de grupo) o nombre y
 *  primer apellido (profesorado), sacado del catálogo de usuarios. El registro guarda el
 *  email de la sesión; solo si no está en el catálogo se enseña la parte antes de la «@». */
function _nombreUsuarioReg(email) {
  const e = (email || '').toLowerCase().trim();
  if (!e) return '—';
  const u = DATA.usuarios.find(x => (x.Email || '').toLowerCase().trim() === e);
  if (!u?.Nombre) return e.split('@')[0];
  return _esCuentaDeGrupo(e) ? u.Nombre : _nombreCorto(u.Nombre);
}

function _cicloModuloUsuario(email) {
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === (email || '').toLowerCase().trim());
  if (!u) return '—';
  // Espacio tras cada coma: la lista de módulos viene pegada ("A,B,C") y sin punto
  // de corte el navegador la trata como una palabra larguísima que ensancha la tabla.
  const modulos = (u.Modulo || '').replace(/\s*,\s*/g, ', ');
  return [u.Ciclo_Principal, modulos].filter(Boolean).join(' · ') || '—';
}

function _horasAcumuladasReg(tipo, idEquipo) {
  const cfg = _regConfig[tipo];
  return DATA[cfg.key]
    .filter(r => r.Estado === 'Cerrada' && (!idEquipo || r.ID_Equipo === idEquipo))
    .reduce((sum, r) => sum + _duracionHorasReg(r), 0);
}

// ── Badge nav / aviso de sesiones olvidadas ─────────────────

function _updateBadgeRegistrosUso() {
  const el = document.getElementById('badge-registros-uso');
  if (!el) return;
  const email = getEffectiveUser().email;
  const n = _regTipos.reduce((sum, tipo) =>
    sum + DATA[_regConfig[tipo].key].filter(r => r.Estado === 'Abierta' && (r.Usuario || '').toLowerCase().trim() === email).length, 0);
  el.textContent = n;
  el.style.display = n > 0 ? '' : 'none';
}

function _avisarSesionesAbiertasAntiguas() {
  if (_regAvisoMostrado) return;
  _regAvisoMostrado = true;
  const email = getEffectiveUser().email;
  const hoy = new Date().toISOString().split('T')[0];
  const antiguas = _regTipos.flatMap(tipo =>
    DATA[_regConfig[tipo].key].filter(r => r.Estado === 'Abierta' && r.Fecha < hoy && (r.Usuario || '').toLowerCase().trim() === email)
  );
  if (antiguas.length) {
    showToast(`Tienes ${antiguas.length} sesión${antiguas.length > 1 ? 'es' : ''} de uso sin cerrar de días anteriores — revisa "Registros de uso"`, 'warning');
  }
}

// ── Render principal ─────────────────────────────────────────

function renderRegistrosUso() {
  const el = document.getElementById('page-registros-uso');
  if (!el) return;

  const tabBtn = (id, label) => {
    const base = 'padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;margin-bottom:-2px;';
    const style = base + (_regTab === id
      ? 'border-bottom:2px solid var(--accent);color:var(--accent)'
      : 'border-bottom:2px solid transparent;color:var(--text-muted)');
    return `<button onclick="_switchRegTab('${id}')" style="${style}">${label}</button>`;
  };

  el.innerHTML = `
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;flex-wrap:wrap">
      ${_regTipos.map(t => tabBtn(t, _regConfig[t].tabLabel)).join('')}
    </div>
    ${_regTipos.map(t => `<div id="reg-tab-${t}" style="display:none">${_renderRegTab(t)}</div>`).join('')}
  `;

  _switchRegTab(_regTab);
}

function _switchRegTab(tab) {
  _regTab = tab;
  _regTipos.forEach(t => {
    const p = document.getElementById(`reg-tab-${t}`);
    if (p) p.style.display = t === tab ? '' : 'none';
  });
}

function _renderRegTab(tipo) {
  const cfg = _regConfig[tipo];
  const equipos = _equiposDeTipo(tipo);

  if (!equipos.length) {
    return `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">No hay ningún equipo de tipo "${cfg.tiposEquipo.join('" / "')}" en el inventario</div></div>`;
  }

  const idEquipoSel = _equipoRegDefault(tipo);
  _regEquipoSel[tipo] = idEquipoSel;

  const selectorEquipo = equipos.length > 1
    ? `<select class="filter" id="reg-equipo-sel-${tipo}" onchange="_onRegEquipoCambio('${tipo}', this.value)">
        ${equipos.map(e => `<option value="${e.ID_Activo}" ${e.ID_Activo === idEquipoSel ? 'selected' : ''}>${_nombreEquipoReg(e.ID_Activo)}</option>`).join('')}
       </select>`
    : `<div style="font-size:13px;font-weight:600">${_nombreEquipoReg(equipos[0].ID_Activo)}</div>`;

  const horas = _horasAcumuladasReg(tipo, equipos.length > 1 ? idEquipoSel : '');
  const abiertasHtml = _renderSesionesAbiertasReg(tipo);

  let botonPrincipal = '';
  let notaManual = '';
  if (cfg.arranqueConDatos) {
    // Un ciclo en marcha en este autoclave lo completa cualquiera (el ciclo es del autoclave).
    const idxMarcha = DATA[cfg.key].findIndex(r => r.Estado === 'Abierta' && r.ID_Equipo === idEquipoSel);
    botonPrincipal = idxMarcha >= 0
      ? `<button class="btn btn-primary" onclick="openModalCerrarSesion('${tipo}', ${idxMarcha})">■ Completar ciclo</button>`
      : `<button class="btn btn-primary" onclick="openModalSesionRegistro('${tipo}','${idEquipoSel}',true)">▶ Arrancar ciclo</button>
         <button class="btn btn-secondary" onclick="openModalSesionRegistro('${tipo}','${idEquipoSel}')">📝 Registrar ciclo completo</button>`;
    notaManual = `<div style="font-size:11px;color:var(--text-muted);margin:0 0 20px">Apunta el ciclo al arrancarlo ("▶ Arrancar ciclo" o la etiqueta del autoclave) y complétalo al terminar, antes de abrir: hora de fin, temperatura y presión máximas e indicadores. Si lleva indicador biológico, su resultado se apunta al leerlo, 24–48 h después.</div>`;
  } else if (cfg.permiteSesionAbierta) {
    const email = getEffectiveUser().email;
    const idxAbierta = DATA[cfg.key].findIndex(r => r.Estado === 'Abierta' && r.ID_Equipo === idEquipoSel && (r.Usuario || '').toLowerCase().trim() === email);
    botonPrincipal = idxAbierta >= 0
      ? `<button class="btn btn-primary" onclick="openModalCerrarSesion('${tipo}', ${idxAbierta})">■ Terminar mi sesión</button>`
      : `<button class="btn btn-primary" onclick="_iniciarSesionRapida('${tipo}','${idEquipoSel}')">▶ Empezar sesión</button>
         <button class="btn btn-secondary" onclick="openModalSesionRegistro('${tipo}')">📝 Registrar sesión completa</button>`;
    notaManual = `<div style="font-size:11px;color:var(--text-muted);margin:0 0 20px">No hace falta NFC: usa "▶ Empezar sesión" al entrar y "■ Terminar mi sesión" al salir, o escanea/fotografía el QR de la etiqueta con la cámara.</div>`;
  }

  return `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:${notaManual ? '10px' : '16px'}">
      ${selectorEquipo}
      ${botonPrincipal}
      ${_puedeGestionarRegistros() ? `<button class="btn btn-secondary" onclick="generarInformeRegistro('${tipo}')">🖨️ Informe</button>` : ''}
      ${_puedeVerNfcRegistros() ? `<button class="btn btn-secondary" onclick="openModalNfcRegistro('${tipo}','${idEquipoSel}')" style="margin-left:auto">🔗 NFC</button>` : ''}
    </div>
    ${notaManual}
    ${htmlAvisoEquipo(idEquipoSel)}
    <div class="card" style="padding:10px 18px;margin-bottom:20px;display:inline-block">
      <div style="font-size:20px;font-weight:700;color:var(--accent)">${horas.toFixed(1)} h</div>
      <div style="font-size:11px;color:var(--text-muted)">Horas de uso registradas — apoyo al plan de mantenimiento</div>
    </div>
    ${abiertasHtml}
    ${_renderBiologicosPendientes(tipo)}
    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin:20px 0 8px">Historial</div>
    ${_renderHistorialReg(tipo)}
  `;
}

function _onRegEquipoCambio(tipo, idEquipo) {
  _regEquipoSel[tipo] = idEquipo;
  renderRegistrosUso();
}

function _renderSesionesAbiertasReg(tipo) {
  const cfg = _regConfig[tipo];
  if (!cfg.permiteSesionAbierta) return '';
  const email = getEffectiveUser().email;
  const esGestor = _puedeGestionarRegistros();
  const txt = _txtReg(cfg);
  const abiertas = DATA[cfg.key]
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => r.Estado === 'Abierta' && (esGestor || cfg.cierraCualquiera || (r.Usuario || '').toLowerCase().trim() === email));

  if (!abiertas.length) return '';

  const filas = abiertas.map(({ r, idx }) => {
    const esPropia = (r.Usuario || '').toLowerCase().trim() === email;
    const datosCiclo = cfg.arranqueConDatos ? [r.Programa_Ciclo, r.Tipo_Carga].filter(Boolean).map(x => ' · ' + x).join('') : '';
    return `<div class="card" style="padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:13px;font-weight:600">${_nombreEquipoReg(r.ID_Equipo)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${_fmtFechaReg(r.Fecha)} · desde las ${r.Hora_Inicio}${datosCiclo}${!esPropia ? ` · 👤 ${_nombreUsuarioReg(r.Usuario)}` : ''}</div>
      </div>
      <div style="display:flex;gap:6px">
        ${(esPropia || esGestor || cfg.cierraCualquiera) ? `<button class="btn btn-sm btn-primary" onclick="openModalCerrarSesion('${tipo}', ${idx})">${txt.cerrar}</button>` : ''}
        ${esGestor ? `<button class="btn btn-sm btn-secondary" onclick="descartarSesionAbierta('${tipo}', ${idx})">🗑️ Descartar</button>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${txt.abiertas}</div>${filas}`;
}

/** Ciclos de autoclave con indicador biológico cuyo resultado aún no se ha apuntado. */
function _renderBiologicosPendientes(tipo) {
  if (tipo !== 'autoclave') return '';
  const cfg = _regConfig[tipo];
  const pend = DATA[cfg.key]
    .filter(r => r.Estado === 'Cerrada' && r.Indicador_Biologico === 'Sí' && !r.Resultado_Biologico)
    .sort((a, b) => `${a.Fecha}T${a.Hora_Inicio}`.localeCompare(`${b.Fecha}T${b.Hora_Inicio}`));
  if (!pend.length) return '';
  const filas = pend.map(r => `<div class="card" style="padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:13px;font-weight:600">${_nombreEquipoReg(r.ID_Equipo)}</div>
        <div style="font-size:12px;color:var(--text-muted)">Ciclo del ${_fmtFechaReg(r.Fecha)} a las ${r.Hora_Inicio}${[r.Programa_Ciclo, r.Tipo_Carga].filter(Boolean).map(x => ' · ' + x).join('')}</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="openModalBiologico('${r.ID_Registro}')">🧫 Apuntar resultado</button>
    </div>`).join('');
  return `<div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin:20px 0 8px">Indicadores biológicos por leer</div>${filas}`;
}

function _renderHistorialReg(tipo) {
  const cfg = _regConfig[tipo];
  const idEquipoSel = _regEquipoSel[tipo];
  const equipos = _equiposDeTipo(tipo);
  const cerradas = DATA[cfg.key]
    .filter(r => r.Estado === 'Cerrada' && (equipos.length <= 1 || r.ID_Equipo === idEquipoSel))
    .slice()
    .sort((a, b) => `${b.Fecha}T${b.Hora_Inicio}`.localeCompare(`${a.Fecha}T${a.Hora_Inicio}`));

  if (!cerradas.length) return `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Sin ${cfg.arranqueConDatos ? 'ciclos' : 'sesiones'} registrados todavía</div></div>`;

  const campos = _camposHistorialReg(tipo, cerradas);
  const gestion = _puedeGestionarRegistros();
  // Valores cortos (selects, números, casillas) en una línea; los textos libres
  // (práctica, productos, incidencias) y el biológico, con su ancho acotado.
  const claseCampo = c => (c.tipo === 'text' || c.mostrar) ? 'reg-largo' : 'reg-corto';
  // El ciclo / módulo NO va en columna: es el perfil actual de la cuenta (no un dato del
  // registro) y con la lista entera de módulos hacía cada fila de 5–7 líneas. Sale al pasar
  // por encima del nombre, y entero en el 🖨️ Informe.
  const titleUsuario = r => {
    if (!cfg.mostrarCicloModulo) return '';
    const cm = _cicloModuloUsuario(r.Usuario);
    return cm === '—' ? '' : ` title="${_attrCampoSesion(cm)}"`;
  };
  // Sin overflow:hidden en línea: pisaba la regla .card:has(table) { overflow-x: auto }
  // de css/styles.css y la tabla se recortaba por la derecha (se perdía Incidencias).
  return `<div class="card" style="padding:0">
    <table class="tabla-registros-uso"><thead><tr>
      <th>Fecha</th><th>Horario</th><th>Usuario</th>
      ${campos.map(c => `<th>${c.label}</th>`).join('')}
      <th>${cfg.labelIncidencias || 'Incidencias'}</th>
      ${gestion ? '<th></th>' : ''}
    </tr></thead>
    <tbody>
      ${cerradas.map(r => `<tr>
        <td class="reg-corto">${_fmtFechaReg(r.Fecha)}${(r.Correcciones || []).length
          ? `<br><button class="badge badge-orange" style="border:none;cursor:pointer;font-size:10px;margin-top:3px" onclick="verCorreccionesReg('${tipo}','${r.ID_Registro}')" title="Ver qué se corrigió, quién y cuándo">✏️ Corregido</button>` : ''}</td>
        <td class="reg-corto">${r.Hora_Fin ? `${r.Hora_Inicio}–${r.Hora_Fin}` : r.Hora_Inicio}</td>
        <td class="reg-corto"${titleUsuario(r)}>${_nombreUsuarioReg(r.Usuario)}</td>
        ${campos.map(c => `<td class="${claseCampo(c)}">${_valorReg(c, r)}</td>`).join('')}
        <td class="reg-largo">${r.Incidencias || '—'}</td>
        ${gestion ? `<td class="reg-corto"><button class="btn btn-sm btn-secondary" onclick="openModalCorregirRegistro('${tipo}','${r.ID_Registro}')" title="Corregir este registro (queda constancia del cambio)">✏️ Corregir</button></td>` : ''}
      </tr>`).join('')}
    </tbody></table>
  </div>`;
}

// ── Campos dinámicos del modal (según tipo) ──────────────────
//
// Se pintan desde `cfg.campos` (ver _regConfig), sin ramas por tipo de equipo.
// Los checkboxes van todos juntos al final, en una sola columna a ancho completo.
// `_regCtx.modo`: 'inicio' (arrancar un ciclo: solo los campos de `fase: 'inicio'`),
// 'completo' (registro entero), 'cierre' (cerrar / completar) o 'correccion' (Gestión).

function _idCampoSesion(c) { return `reg-campo-${c.api}`; }

function _attrCampoSesion(valor) { return String(valor || '').replace(/"/g, '&quot;'); }

function _renderUnCampoSesion(c, valores) {
  const label = c.labelForm || c.label;
  const etiqueta = `<label>${label}${c.requerido ? ' *' : ''}</label>`;
  const clase = `form-group${c.full ? ' full' : ''}`;
  const id = _idCampoSesion(c);
  const valor = valores[c.campo] ?? '';

  if (c.tipo === 'select') {
    const opciones = c.permiteOtro ? [...c.opciones, 'Otro'] : c.opciones;
    const esPreset = c.opciones.includes(valor);
    const selValue = (c.permiteOtro && valor && !esPreset) ? 'Otro' : valor;
    const otro = c.permiteOtro
      ? `<input type="text" id="${id}-otro" placeholder="Especifica el valor" value="${esPreset ? '' : _attrCampoSesion(valor)}" style="margin-top:6px;${selValue === 'Otro' ? '' : 'display:none'}">`
      : '';
    // Un campo obligatorio empieza sin elegir: que nadie lo deje en la primera opción sin mirarlo.
    const vacia = c.requerido ? `<option value="" ${selValue ? '' : 'selected'}>— Elige —</option>` : '';
    return `<div class="${clase}">
      ${etiqueta}
      <select id="${id}" ${c.permiteOtro ? `onchange="_onCampoOtroChange('${c.api}')"` : ''}>
        ${vacia}${opciones.map(o => `<option value="${o}" ${selValue === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
      ${otro}
    </div>`;
  }

  // Números con coma o punto (el teclado del móvil pone la coma): el servidor los convierte.
  const valorTxt = c.tipo === 'number' ? String(valor).replace('.', ',') : valor;
  return `<div class="${clase}">
    ${etiqueta}
    <input type="text" id="${id}" value="${_attrCampoSesion(valorTxt)}" placeholder="${c.placeholder || ''}"${c.tipo === 'number' ? ` inputmode="${c.entero ? 'numeric' : 'decimal'}"` : ''}>
  </div>`;
}

function _renderCamposSesion(tipo, valores = {}, modo = 'completo') {
  const el = document.getElementById('reg-sesion-campos');
  if (!el) return;
  const campos = _camposFormReg(tipo, modo);
  const checks = campos.filter(c => c.tipo === 'check');
  const resto  = campos.filter(c => c.tipo !== 'check');

  const bloqueChecks = checks.length ? `<div class="form-group full" style="display:flex;flex-direction:column;gap:10px;margin-top:4px;min-width:0">
      ${checks.map(c => `<label style="display:flex;align-items:flex-start;gap:8px;font-weight:400;margin:0;cursor:pointer;min-width:0"><input type="checkbox" id="${_idCampoSesion(c)}" style="margin-top:3px;flex-shrink:0" ${valores[c.campo] === 'Sí' ? 'checked' : ''}> <span style="min-width:0">${c.labelForm || c.label}</span></label>`).join('')}
    </div>` : '';

  // Al corregir un ciclo con indicador biológico, también su resultado.
  const biologico = (modo === 'correccion' && tipo === 'autoclave' && (valores.Indicador_Biologico === 'Sí' || valores.Resultado_Biologico))
    ? `<div class="form-group">
        <label>Resultado del indicador biológico</label>
        <select id="reg-campo-resultado_biologico">
          ${['', 'Negativo', 'Positivo'].map(o => `<option value="${o}" ${valores.Resultado_Biologico === o ? 'selected' : ''}>${o || '— Sin leer —'}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Fecha de lectura</label>
        <input type="date" id="reg-campo-fecha_lectura_biologico" value="${valores.Fecha_Lectura_Biologico || ''}">
      </div>` : '';

  el.innerHTML = `
    <div class="form-grid-2" style="margin-top:12px">
      ${resto.map(c => _renderUnCampoSesion(c, valores)).join('')}
      ${bloqueChecks}
      ${biologico}
    </div>`;
}

function _onCampoOtroChange(api) {
  const sel  = document.getElementById(`reg-campo-${api}`);
  const otro = document.getElementById(`reg-campo-${api}-otro`);
  if (!sel || !otro) return;
  otro.style.display = sel.value === 'Otro' ? '' : 'none';
}

function _leerCamposSesion(tipo, modo = 'completo') {
  const out = {};
  for (const c of _camposFormReg(tipo, modo)) {
    const id = _idCampoSesion(c);
    if (c.tipo === 'check') {
      out[c.campo] = document.getElementById(id)?.checked ? 'Sí' : 'No';
    } else if (c.tipo === 'select' && c.permiteOtro && v(id) === 'Otro') {
      out[c.campo] = v(`${id}-otro`);
    } else {
      out[c.campo] = v(id);
    }
  }
  return out;
}

// ── Modal: nueva sesión completa / cerrar sesión ─────────────

/** Registro entero (sesión o ciclo de una vez) o, con `arrancar`, el arranque de un ciclo de
 *  autoclave: solo hora de inicio, programa, tipo de carga y si lleva indicador biológico. */
function openModalSesionRegistro(tipo, idEquipoPreset = '', arrancar = false) {
  const cfg = _regConfig[tipo];
  const modo = arrancar && cfg.arranqueConDatos ? 'inicio' : 'completo';
  _regCtx = { tipo, idx: null, modo };
  const equipos = _equiposDeTipo(tipo);

  const sel = document.getElementById('reg-sesion-equipo');
  sel.disabled = false;
  sel.innerHTML = equipos.map(e => `<option value="${e.ID_Activo}">${_nombreEquipoReg(e.ID_Activo)}</option>`).join('');
  sel.value = idEquipoPreset || _equipoRegDefault(tipo);

  const ahora = new Date();
  sv('reg-sesion-fecha', ahora.toISOString().split('T')[0]);
  sv('reg-sesion-hora-inicio', ahora.toTimeString().slice(0, 5));
  // Una sesión entera se apunta al terminar (fin = ahora); un ciclo entero, con sus horas reales.
  sv('reg-sesion-hora-fin', cfg.arranqueConDatos ? '' : ahora.toTimeString().slice(0, 5));
  sv('reg-sesion-incidencias', '');
  _renderCamposSesion(tipo, {}, modo);
  _prepararModalReg(cfg, modo);

  document.getElementById('modal-reg-sesion-title').textContent = modo === 'inicio'
    ? `Arrancar ciclo — ${cfg.label}`
    : cfg.arranqueConDatos ? `Registrar ciclo completo — ${cfg.label}` : `Registrar sesión completa — ${cfg.label}`;
  document.getElementById('reg-sesion-btn-guardar').textContent = modo === 'inicio'
    ? 'Arrancar ciclo' : cfg.arranqueConDatos ? 'Registrar ciclo' : 'Registrar sesión';
  openModal('modal-reg-sesion');
}

/** Lo que cambia del modal según el momento: hora de fin, avisos, incidencias y motivo. */
function _prepararModalReg(cfg, modo) {
  document.getElementById('reg-sesion-hora-fin-grupo').style.display = modo === 'inicio' ? 'none' : '';
  document.getElementById('reg-sesion-hora-fin-label').textContent = modo === 'correccion' ? 'Hora fin' : 'Hora fin *';
  document.getElementById('reg-sesion-incidencias-label').textContent = cfg.labelIncidencias || 'Incidencias';
  document.getElementById('reg-sesion-incidencias').placeholder = cfg.placeholderIncidencias || 'Cualquier incidencia durante la sesión (opcional)';
  document.getElementById('reg-sesion-motivo-grupo').style.display = modo === 'correccion' ? '' : 'none';
  sv('reg-sesion-motivo', '');
  const notas = {
    inicio: 'Apúntalo al arrancar el ciclo. Al terminar, antes de abrir, lo completas: hora de fin, temperatura y presión máximas e indicadores.',
    cierre: cfg.arranqueConDatos ? 'Antes de abrir, lee en el panel la temperatura y la presión máximas alcanzadas. Al abrir, comprueba la cinta y el integrador.' : '',
    completo: cfg.arranqueConDatos ? 'Para el ciclo que no se apuntó al arrancar: con sus horas reales.' : '',
    correccion: 'Queda constancia de quién lo corrige, cuándo, por qué y qué ponía antes.',
  };
  const nota = document.getElementById('reg-sesion-nota');
  nota.textContent = notas[modo] || '';
  nota.style.display = notas[modo] ? '' : 'none';
}

function _actualizarLabelHoraFin(cfg) {
  const label = document.getElementById('reg-sesion-hora-fin-label');
  if (label) label.textContent = 'Hora fin *';
}

function openModalCerrarSesion(tipo, idx) {
  const cfg = _regConfig[tipo];
  const r = DATA[cfg.key][idx];
  if (!r) return;
  _regCtx = { tipo, idx, modo: 'cierre' };

  const sel = document.getElementById('reg-sesion-equipo');
  sel.innerHTML = `<option value="${r.ID_Equipo}">${_nombreEquipoReg(r.ID_Equipo)}</option>`;
  sel.value = r.ID_Equipo;
  sel.disabled = true;

  sv('reg-sesion-fecha', r.Fecha);
  sv('reg-sesion-hora-inicio', r.Hora_Inicio);
  sv('reg-sesion-hora-fin', new Date().toTimeString().slice(0, 5));
  sv('reg-sesion-incidencias', r.Incidencias || '');
  _renderCamposSesion(tipo, r, 'cierre');
  _prepararModalReg(cfg, 'cierre');

  document.getElementById('modal-reg-sesion-title').textContent = cfg.arranqueConDatos ? `Completar ciclo — ${cfg.label}` : `Cerrar sesión — ${cfg.label}`;
  document.getElementById('reg-sesion-btn-guardar').textContent = cfg.arranqueConDatos ? 'Guardar y completar el ciclo' : 'Guardar y cerrar sesión';
  openModal('modal-reg-sesion');
}

/** Gestión corrige un registro cerrado: queda constancia de quién, cuándo, por qué y qué ponía antes. */
function openModalCorregirRegistro(tipo, idRegistro) {
  if (!_puedeGestionarRegistros()) return;
  const cfg = _regConfig[tipo];
  const idx = DATA[cfg.key].findIndex(r => r.ID_Registro === idRegistro);
  const r = DATA[cfg.key][idx];
  if (!r) return;
  _regCtx = { tipo, idx, modo: 'correccion' };

  const sel = document.getElementById('reg-sesion-equipo');
  sel.innerHTML = `<option value="${r.ID_Equipo}">${_nombreEquipoReg(r.ID_Equipo)}</option>`;
  sel.value = r.ID_Equipo;
  sel.disabled = true;
  sv('reg-sesion-fecha', r.Fecha);
  sv('reg-sesion-hora-inicio', r.Hora_Inicio);
  sv('reg-sesion-hora-fin', r.Hora_Fin || '');
  sv('reg-sesion-incidencias', r.Incidencias || '');
  _renderCamposSesion(tipo, r, 'correccion');
  _prepararModalReg(cfg, 'correccion');
  document.getElementById('modal-reg-sesion-title').textContent = `Corregir registro — ${cfg.label}`;
  document.getElementById('reg-sesion-btn-guardar').textContent = 'Guardar corrección';
  openModal('modal-reg-sesion');
}

async function guardarSesionRegistro() {
  if (!_regCtx) return;
  const { tipo, idx } = _regCtx;
  const modo = _regCtx.modo || 'completo';
  const cfg = _regConfig[tipo];

  const idEquipo = v('reg-sesion-equipo');
  const fecha    = v('reg-sesion-fecha');
  const horaIni  = v('reg-sesion-hora-inicio');
  const horaFin  = modo === 'inicio' ? '' : v('reg-sesion-hora-fin');
  if (!idEquipo || !fecha || !horaIni) { showToast('Completa fecha y hora de inicio', 'error'); return; }
  if (modo !== 'inicio' && modo !== 'correccion' && cfg.permiteSesionAbierta && !horaFin) { showToast('Indica la hora de fin', 'error'); return; }
  if (horaFin && horaFin <= horaIni) { showToast('La hora de fin debe ser posterior a la de inicio', 'error'); return; }

  const campos = _leerCamposSesion(tipo, modo);
  if (modo !== 'correccion') {
    const faltan = _camposFormReg(tipo, modo).filter(c => c.requerido && !String(campos[c.campo] || '').trim());
    if (faltan.length) {
      showToast(`Completa: ${faltan.map(c => (c.labelForm || c.label).toLowerCase()).join(', ')}`, 'error');
      return;
    }
  }
  const motivo = v('reg-sesion-motivo').trim();
  if (modo === 'correccion' && !motivo) { showToast('Escribe el motivo de la corrección', 'error'); return; }
  const incidencias = v('reg-sesion-incidencias');
  const idRegistro = idx != null ? DATA[cfg.key][idx].ID_Registro : null;
  const camposApi = Object.fromEntries(_camposFormReg(tipo, modo).map(c => [c.api, campos[c.campo]]));

  showLoading('Guardando…');
  try {
    const cuerpo = modo === 'correccion'
      ? { accion: 'corregir_registro', tipo, id_registro: idRegistro, fecha, hora_inicio: horaIni, hora_fin: horaFin,
          incidencias, campos: camposApi, motivo,
          resultado_biologico: document.getElementById('reg-campo-resultado_biologico')?.value,
          fecha_lectura_biologico: document.getElementById('reg-campo-fecha_lectura_biologico')?.value }
      : { accion: 'guardar_sesion', tipo, id_registro: idRegistro, id_equipo: idEquipo, abrir: modo === 'inicio',
          fecha, hora_inicio: horaIni, hora_fin: horaFin, incidencias, campos: camposApi };
    const { registro } = await callEdgeFunction('gestionar-registro-uso', cuerpo);
    const objLocal = _regSbToObj(tipo, registro);
    if (idx != null) DATA[cfg.key][idx] = objLocal;
    else DATA[cfg.key].push(objLocal);
    closeModal('modal-reg-sesion');
    renderRegistrosUso();
    _updateBadgeRegistrosUso();
    const fallo = cfg.arranqueConDatos && modo !== 'inicio' &&
      [objLocal.Cinta_Indicadora, objLocal.Integrador_Quimico].includes('No viró');
    if (fallo && modo !== 'correccion') {
      showToast('Un indicador no ha virado: la carga no se da por tratada. El material no se usa y los residuos no se sacan como tratados. Sigue el apartado 10 del protocolo y avisa al profesorado.', 'error', 12000);
    } else {
      showToast({
        inicio: 'Ciclo arrancado ✓ — al terminar, antes de abrir, complétalo',
        cierre: cfg.arranqueConDatos ? 'Ciclo completado ✓' : 'Sesión cerrada ✓',
        completo: cfg.arranqueConDatos ? 'Ciclo registrado ✓' : 'Sesión registrada ✓',
        correccion: 'Corrección guardada ✓ (queda constancia del cambio)',
      }[modo], 'success');
    }
  } catch (e) {
    showToast(e.message || 'Error al guardar el registro', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Correcciones de Gestión: qué se cambió, quién y cuándo ───

function _nombreColumnaReg(tipo, col) {
  const cfg = _regConfig[tipo];
  const c = cfg.campos.find(x => x.api === col);
  if (c) return c.labelForm || c.label;
  return {
    fecha: 'Fecha', hora_inicio: 'Hora inicio', hora_fin: 'Hora fin',
    incidencias: cfg.labelIncidencias || 'Incidencias',
    resultado_biologico: 'Resultado del indicador biológico', fecha_lectura_biologico: 'Fecha de lectura del biológico',
  }[col] || col;
}

function _textoCorreccionReg(tipo, corr) {
  const val = x => (x === null || x === undefined || x === '') ? '(vacío)' : String(x);
  return Object.entries(corr.cambios || {})
    .map(([col, { antes, despues }]) => `${_nombreColumnaReg(tipo, col)}: «${val(antes)}» → «${val(despues)}»`).join(' · ');
}

function verCorreccionesReg(tipo, idRegistro) {
  const cfg = _regConfig[tipo];
  const r = DATA[cfg.key].find(x => x.ID_Registro === idRegistro);
  if (!r) return;
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.getElementById('reg-corr-titulo').textContent = `${_nombreEquipoReg(r.ID_Equipo)} · ${_fmtFechaReg(r.Fecha)} ${r.Hora_Inicio}`;
  document.getElementById('reg-corr-cuerpo').innerHTML = (r.Correcciones || []).map(c => {
    const cuando = new Date(c.fecha_hora).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div style="padding:10px 0;border-top:1px solid var(--border);font-size:13px;line-height:1.55">
      <div style="font-weight:600">${esc(cuando)} · ${esc(c.corregido_por)}</div>
      <div style="color:var(--text-muted)">Motivo: ${esc(c.motivo)}</div>
      <div>${esc(_textoCorreccionReg(tipo, c))}</div>
    </div>`;
  }).join('');
  openModal('modal-reg-correcciones');
}

// ── Indicador biológico: el resultado se apunta al leerlo, 24–48 h después ───

let _regBioId = null;

function openModalBiologico(idRegistro) {
  const r = DATA.registrosAutoclave.find(x => x.ID_Registro === idRegistro);
  if (!r) return;
  _regBioId = idRegistro;
  document.getElementById('reg-bio-info').textContent =
    `${_nombreEquipoReg(r.ID_Equipo)} · ciclo del ${_fmtFechaReg(r.Fecha)} a las ${r.Hora_Inicio}${[r.Programa_Ciclo, r.Tipo_Carga].filter(Boolean).map(x => ' · ' + x).join('')}`;
  sv('reg-bio-resultado', '');
  openModal('modal-reg-biologico');
}

async function guardarResultadoBiologico() {
  const resultado = v('reg-bio-resultado');
  if (!resultado) { showToast('Elige el resultado', 'error'); return; }
  showLoading('Guardando…');
  try {
    const { registro } = await callEdgeFunction('gestionar-registro-uso', {
      accion: 'resultado_biologico', tipo: 'autoclave', id_registro: _regBioId, resultado,
    });
    const obj = _registroAutoclaveSbToObj(registro);
    const i = DATA.registrosAutoclave.findIndex(x => x.ID_Registro === obj.ID_Registro);
    if (i >= 0) DATA.registrosAutoclave[i] = obj;
    closeModal('modal-reg-biologico');
    renderRegistrosUso();
    if (resultado === 'Positivo') _avisoBiologicoPositivo(obj);
    else showToast('Resultado apuntado ✓', 'success');
  } catch (e) {
    showToast(e.message || 'No se pudo guardar el resultado', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// Biológico positivo = fallo de esterilización: el autoclave pasa a «NO USAR» y se abre el aviso
// de avería ya escrito (si el equipo tiene uno abierto, se añade a ese), como en un mantenimiento.
function _avisoBiologicoPositivo(r) {
  const texto = `Indicador biológico POSITIVO en el ciclo del ${_fmtFechaReg(r.Fecha)} a las ${r.Hora_Inicio}`
    + `${[r.Programa_Ciclo, r.Tipo_Carga].filter(Boolean).map(x => ', ' + x).join('')}: fallo de esterilización. `
    + `Autoclave en «NO USAR».`;
  showToast('Indicador biológico positivo: el autoclave pasa a «NO USAR». Avisa al profesorado y envía el aviso de avería.', 'error', 12000);
  setTimeout(() => {
    if (getUserRole() === 'Alumno') {
      abrirAvisoAlumno(r.ID_Equipo);
      document.querySelector('input[name="aviso-uso"][value="Equipo fuera de servicio"]').checked = true;
      sv('aviso-descripcion', texto);
    } else if (puedeHacer('crearIncidencias')) {
      openModalIncidenciaEquipo(r.ID_Equipo);
      setTimeout(() => sv('inc-descripcion', texto), 120);
    }
  }, 400);
}

async function descartarSesionAbierta(tipo, idx) {
  const cfg = _regConfig[tipo];
  const idRegistro = DATA[cfg.key][idx]?.ID_Registro;
  if (!idRegistro) return;
  if (!confirm('¿Descartar esta sesión abierta? No se puede deshacer.')) return;
  showLoading('Eliminando…');
  try {
    await callEdgeFunction('gestionar-registro-uso', { accion: 'descartar_sesion', tipo, id_registro: idRegistro });
    DATA[cfg.key].splice(idx, 1);
    renderRegistrosUso();
    _updateBadgeRegistrosUso();
    showToast('Sesión descartada', 'success');
  } catch (e) {
    showToast(e.message || 'Error al eliminar', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Inicio/cierre rápido — manual (botón) o vía NFC/QR ───────

function _abrirRegistroPorNfc(tipo, idEquipo) {
  const cfg = _regConfig[tipo];
  if (!cfg) return;
  _regTab = tipo;
  showPage('registros-uso');
  renderRegistrosUso();

  if (cfg.arranqueConDatos) {
    // Autoclave: si tiene un ciclo en marcha, completarlo; si no, arrancar uno.
    const idxMarcha = DATA[cfg.key].findIndex(r => r.Estado === 'Abierta' && r.ID_Equipo === idEquipo);
    if (idxMarcha >= 0) openModalCerrarSesion(tipo, idxMarcha);
    else openModalSesionRegistro(tipo, idEquipo, true);
    return;
  }

  const email = getEffectiveUser().email;
  const idx = DATA[cfg.key].findIndex(r => r.Estado === 'Abierta' && r.ID_Equipo === idEquipo && (r.Usuario || '').toLowerCase().trim() === email);
  if (idx >= 0) openModalCerrarSesion(tipo, idx);
  else _iniciarSesionRapida(tipo, idEquipo);
}

async function _iniciarSesionRapida(tipo, idEquipo) {
  const cfg = _regConfig[tipo];
  showLoading('Iniciando sesión…');
  try {
    const { registro } = await callEdgeFunction('gestionar-registro-uso', { accion: 'iniciar_rapido', tipo, id_equipo: idEquipo });
    const objLocal = _regSbToObj(tipo, registro);
    DATA[cfg.key].push(objLocal);
    renderRegistrosUso();
    _updateBadgeRegistrosUso();
    mostrarToastConAccion(`Sesión iniciada a las ${objLocal.Hora_Inicio} ✓ — vuelve aquí (o escanea de nuevo) para terminarla`, 'Deshacer', () => _deshacerInicioSesionReg(tipo, objLocal.ID_Registro), 6000);
  } catch (e) {
    showToast(e.message || 'Error al iniciar la sesión', 'error'); console.error(e);
  } finally { hideLoading(); }
}

async function _deshacerInicioSesionReg(tipo, id) {
  const cfg = _regConfig[tipo];
  const idx = DATA[cfg.key].findIndex(r => r.ID_Registro === id);
  if (idx === -1) return;
  showLoading('Deshaciendo…');
  try {
    await callEdgeFunction('gestionar-registro-uso', { accion: 'deshacer_inicio', tipo, id_registro: id });
    DATA[cfg.key].splice(idx, 1);
    renderRegistrosUso();
    _updateBadgeRegistrosUso();
    showToast('Inicio de sesión deshecho', 'success');
  } catch (e) {
    showToast(e.message || 'Error al deshacer', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Modal: etiqueta NFC / QR ──────────────────────────────────

function openModalNfcRegistro(tipo, idEquipo) {
  if (!idEquipo) { showToast('Selecciona un equipo primero', 'error'); return; }
  const cfg = _regConfig[tipo];
  const url = urlEtiqueta({ action: 'registro-uso', tipo: tipo, equipo: idEquipo });
  document.getElementById('reg-nfc-label').textContent = `${cfg.label} · ${_nombreEquipoReg(idEquipo)}`;
  document.getElementById('reg-nfc-url-text').textContent = url;
  document.getElementById('reg-nfc-desc').textContent = !cfg.arranqueConDatos
    ? 'La misma etiqueta sirve para empezar y para terminar la sesión: la app detecta automáticamente si ya tienes una abierta en este equipo. También se puede escanear con la cámara del móvil (código QR), sin necesidad de activar el NFC.'
    : 'Al escanear (o fotografiar el QR con la cámara) se abre «Arrancar ciclo»; si el autoclave tiene un ciclo en marcha, se abre «Completar ciclo».';
  const qrImg = document.getElementById('reg-nfc-qr');
  qrImg.src = '';
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`;
  openModal('modal-reg-nfc');
}

async function copiarUrlNfcRegistro() {
  const url = document.getElementById('reg-nfc-url-text').textContent;
  try {
    await navigator.clipboard.writeText(url);
    showToast('URL copiada ✓', 'success');
  } catch {
    const el = document.createElement('textarea');
    el.value = url; el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el); el.select(); document.execCommand('copy');
    document.body.removeChild(el);
    showToast('URL copiada ✓', 'success');
  }
}

// ── Informe imprimible ────────────────────────────────────────

function generarInformeRegistro(tipo) {
  const cfg = _regConfig[tipo];
  const idEquipoSel = _regEquipoSel[tipo];
  const equipos = _equiposDeTipo(tipo);
  const cerradas = DATA[cfg.key]
    .filter(r => r.Estado === 'Cerrada' && (equipos.length <= 1 || r.ID_Equipo === idEquipoSel))
    .slice()
    .sort((a, b) => `${a.Fecha}T${a.Hora_Inicio}`.localeCompare(`${b.Fecha}T${b.Hora_Inicio}`));

  if (!cerradas.length) { showToast('No hay sesiones registradas para generar el informe', 'error'); return; }

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nombreEquipo = equipos.length <= 1 ? _nombreEquipoReg(equipos[0].ID_Activo) : _nombreEquipoReg(idEquipoSel);

  const campos = _camposHistorialReg(tipo, cerradas);
  const hayCorrecciones = cerradas.some(r => (r.Correcciones || []).length);
  const correcciones = r => (r.Correcciones || []).map(c =>
    `${new Date(c.fecha_hora).toLocaleDateString('es-ES')} · ${c.corregido_por} (${c.motivo}): ${_textoCorreccionReg(tipo, c)}`).join('<br>') || '—';
  const filas = cerradas.map(r => `<tr>
    <td>${_fmtFechaReg(r.Fecha)}</td>
    <td>${r.Hora_Fin ? `${r.Hora_Inicio}–${r.Hora_Fin}` : r.Hora_Inicio}</td>
    <td>${_nombreUsuarioReg(r.Usuario)}</td>
    ${cfg.mostrarCicloModulo ? `<td>${_cicloModuloUsuario(r.Usuario)}</td>` : ''}
    ${campos.map(c => `<td>${_valorReg(c, r)}</td>`).join('')}
    <td>${r.Incidencias || '—'}</td>
    ${hayCorrecciones ? `<td>${correcciones(r)}</td>` : ''}
  </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Registro de uso — ${cfg.label} — ${hoy}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; max-width: 1000px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #1a1a1a; color: #fff; font-size: 11px; font-weight: 600; text-align: left; padding: 7px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; font-size: 11px; }
  tr:last-child td { border-bottom: none; }
  @media print { body { margin: 20px; } tr { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Registro de uso — ${cfg.label}</h1>
  <div class="meta">${NOMBRE_CENTRO ? NOMBRE_CENTRO + ' &nbsp;·&nbsp; ' : ''}${nombreEquipo} &nbsp;·&nbsp; Generado el ${hoy} &nbsp;·&nbsp; ${cerradas.length} sesión${cerradas.length > 1 ? 'es' : ''}</div>
  <table>
    <thead><tr><th>Fecha</th><th>Horario</th><th>Usuario</th>${cfg.mostrarCicloModulo ? '<th>Ciclo / Módulo</th>' : ''}${campos.map(c => `<th>${c.label}</th>`).join('')}<th>${cfg.labelIncidencias || 'Incidencias'}</th>${hayCorrecciones ? '<th>Correcciones</th>' : ''}</tr></thead>
    <tbody>${filas}</tbody>
  </table>
</body>
<script>window.onload = function() { window.print(); }<\/script>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else showToast('Activa las ventanas emergentes para generar el informe', 'error');
}
