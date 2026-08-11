// ============================================================
// REGISTROS DE USO (Cabina de bioseguridad / Autoclave)
// ============================================================

const _regConfig = {
  cabina: {
    key: 'registrosCabina', sheet: 'Registros_Cabina', lastCol: 'L',
    tipoEquipo: 'Cabina de bioseguridad', prefix: 'RC', label: 'Cabina de bioseguridad',
    // La cabina se usa con presencia continua → tiene sentido abrir sesión al entrar y cerrarla al salir.
    permiteSesionAbierta: true,
    // Trazabilidad del modelo de calidad: quién usó la cabina debe quedar ligado a su ciclo/módulo.
    mostrarCicloModulo: true,
    camposLabels: {
      Practica_Tecnica: 'Práctica / técnica', Nivel_Riesgo: 'Nivel de riesgo',
      Verificacion_Previa: 'Verificación previa', Descontaminacion_Posterior: 'Descontaminación posterior'
    }
  },
  autoclave: {
    key: 'registrosAutoclave', sheet: 'Registros_Autoclave', lastCol: 'K',
    tipoEquipo: 'Autoclave', prefix: 'RA', label: 'Autoclave',
    // El autoclave es un ciclo automático: se registra al ponerlo en marcha, no hay presencia que "cerrar" después.
    permiteSesionAbierta: false,
    // Trazabilidad del modelo de calidad: quién usó el autoclave debe quedar ligado a su ciclo/módulo.
    mostrarCicloModulo: true,
    camposLabels: { Programa_Ciclo: 'Programa / ciclo', Tipo_Carga: 'Tipo de carga', Resultado_Control: 'Resultado del control' }
  }
};

const PROGRAMAS_AUTOCLAVE = ['121°C / 15 min', '121°C / 20 min'];
const CARGAS_AUTOCLAVE    = ['Descontaminación', 'Líquidos', 'Sólidos'];

let _regTab          = 'cabina';
let _regEquipoSel    = { cabina: '', autoclave: '' };
let _regCtx          = null;   // {tipo, idx: number|null}
let _regAvisoMostrado = false;

// ── Helpers ──────────────────────────────────────────────────

function _puedeGestionarRegistros() { return ['Administrador', 'Gestor'].includes(getUserRole()); }
function _puedeVerNfcRegistros() { return ['Administrador', 'Gestor', 'Profesor'].includes(getUserRole()); }

function _equiposDeTipo(tipo) {
  return DATA.equipos.filter(e => e.Tipo_Equipo === _regConfig[tipo].tipoEquipo);
}

function _equipoRegDefault(tipo) {
  const equipos = _equiposDeTipo(tipo);
  if (_regEquipoSel[tipo] && equipos.some(e => e.ID_Activo === _regEquipoSel[tipo])) return _regEquipoSel[tipo];
  return equipos.length === 1 ? equipos[0].ID_Activo : (equipos[0]?.ID_Activo || '');
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

function _cicloModuloUsuario(email) {
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === (email || '').toLowerCase().trim());
  if (!u) return '—';
  return [u.Ciclo_Principal, u.Modulo].filter(Boolean).join(' · ') || '—';
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
  const n = ['cabina', 'autoclave'].reduce((sum, tipo) =>
    sum + DATA[_regConfig[tipo].key].filter(r => r.Estado === 'Abierta' && (r.Usuario || '').toLowerCase().trim() === email).length, 0);
  el.textContent = n;
  el.style.display = n > 0 ? '' : 'none';
}

function _avisarSesionesAbiertasAntiguas() {
  if (_regAvisoMostrado) return;
  _regAvisoMostrado = true;
  const email = getEffectiveUser().email;
  const hoy = new Date().toISOString().split('T')[0];
  const antiguas = ['cabina', 'autoclave'].flatMap(tipo =>
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
      ? 'border-bottom:2px solid var(--primary);color:var(--primary)'
      : 'border-bottom:2px solid transparent;color:var(--text-muted)');
    return `<button onclick="_switchRegTab('${id}')" style="${style}">${label}</button>`;
  };

  el.innerHTML = `
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;flex-wrap:wrap">
      ${tabBtn('cabina', '🧫 Cabina de bioseguridad')}
      ${tabBtn('autoclave', '♨️ Autoclave')}
    </div>
    <div id="reg-tab-cabina">${_renderRegTab('cabina')}</div>
    <div id="reg-tab-autoclave" style="display:none">${_renderRegTab('autoclave')}</div>
  `;

  _switchRegTab(_regTab);
}

function _switchRegTab(tab) {
  _regTab = tab;
  ['cabina', 'autoclave'].forEach(t => {
    const p = document.getElementById(`reg-tab-${t}`);
    if (p) p.style.display = t === tab ? '' : 'none';
  });
}

function _renderRegTab(tipo) {
  const cfg = _regConfig[tipo];
  const equipos = _equiposDeTipo(tipo);

  if (!equipos.length) {
    return `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">No hay ningún equipo de tipo "${cfg.tipoEquipo}" en el inventario</div></div>`;
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

  let botonPrincipal = `<button class="btn btn-primary" onclick="openModalSesionRegistro('${tipo}')">+ Registrar ciclo</button>`;
  let notaManual = '';
  if (cfg.permiteSesionAbierta) {
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
    <div class="card" style="padding:10px 18px;margin-bottom:20px;display:inline-block">
      <div style="font-size:20px;font-weight:700;color:var(--primary)">${horas.toFixed(1)} h</div>
      <div style="font-size:11px;color:var(--text-muted)">Horas de uso registradas — apoyo al plan de mantenimiento</div>
    </div>
    ${abiertasHtml}
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
  const abiertas = DATA[cfg.key]
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => r.Estado === 'Abierta' && (esGestor || (r.Usuario || '').toLowerCase().trim() === email));

  if (!abiertas.length) return '';

  const filas = abiertas.map(({ r, idx }) => {
    const esPropia = (r.Usuario || '').toLowerCase().trim() === email;
    return `<div class="card" style="padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:13px;font-weight:600">${_nombreEquipoReg(r.ID_Equipo)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${_fmtFechaReg(r.Fecha)} · desde las ${r.Hora_Inicio}${!esPropia ? ` · 👤 ${r.Usuario}` : ''}</div>
      </div>
      <div style="display:flex;gap:6px">
        ${(esPropia || esGestor) ? `<button class="btn btn-sm btn-primary" onclick="openModalCerrarSesion('${tipo}', ${idx})">■ Cerrar sesión</button>` : ''}
        ${esGestor ? `<button class="btn btn-sm btn-secondary" onclick="descartarSesionAbierta('${tipo}', ${idx})">🗑️ Descartar</button>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Sesiones abiertas</div>${filas}`;
}

function _renderHistorialReg(tipo) {
  const cfg = _regConfig[tipo];
  const idEquipoSel = _regEquipoSel[tipo];
  const equipos = _equiposDeTipo(tipo);
  const cerradas = DATA[cfg.key]
    .filter(r => r.Estado === 'Cerrada' && (equipos.length <= 1 || r.ID_Equipo === idEquipoSel))
    .slice()
    .sort((a, b) => `${b.Fecha}T${b.Hora_Inicio}`.localeCompare(`${a.Fecha}T${a.Hora_Inicio}`));

  if (!cerradas.length) return `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Sin sesiones registradas todavía</div></div>`;

  const campos = Object.keys(cfg.camposLabels);

  return `<div class="card" style="padding:0;overflow:hidden">
    <table><thead><tr>
      <th>Fecha</th><th>Horario</th><th>Usuario</th>
      ${cfg.mostrarCicloModulo ? '<th>Ciclo / Módulo</th>' : ''}
      ${campos.map(c => `<th>${cfg.camposLabels[c]}</th>`).join('')}
      <th>Incidencias</th>
    </tr></thead>
    <tbody>
      ${cerradas.map(r => `<tr>
        <td>${_fmtFechaReg(r.Fecha)}</td>
        <td style="white-space:nowrap">${r.Hora_Fin ? `${r.Hora_Inicio}–${r.Hora_Fin}` : r.Hora_Inicio}</td>
        <td style="font-size:12px">${(r.Usuario || '').split('@')[0]}</td>
        ${cfg.mostrarCicloModulo ? `<td style="font-size:12px">${_cicloModuloUsuario(r.Usuario)}</td>` : ''}
        ${campos.map(c => `<td style="font-size:12px">${r[c] || '—'}</td>`).join('')}
        <td style="font-size:12px">${r.Incidencias || '—'}</td>
      </tr>`).join('')}
    </tbody></table>
  </div>`;
}

// ── Campos dinámicos del modal (según tipo) ──────────────────

function _renderCamposSesion(tipo, valores = {}) {
  const el = document.getElementById('reg-sesion-campos');
  if (!el) return;
  if (tipo === 'cabina') {
    el.innerHTML = `
      <div class="form-grid-2" style="margin-top:12px">
        <div class="form-group full">
          <label>Práctica / técnica *</label>
          <input type="text" id="reg-campo-practica" value="${valores.Practica_Tecnica || ''}" placeholder="ej. Siembra en medio de cultivo">
        </div>
        <div class="form-group">
          <label>Nivel de riesgo del agente manipulado *</label>
          <select id="reg-campo-riesgo">
            ${['No aplica', 'BSL-1', 'BSL-2', 'BSL-3'].map(n => `<option value="${n}" ${valores.Nivel_Riesgo === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full" style="display:flex;flex-direction:column;gap:10px;margin-top:4px;min-width:0">
          <label style="display:flex;align-items:flex-start;gap:8px;font-weight:400;margin:0;cursor:pointer;min-width:0"><input type="checkbox" id="reg-campo-verif" style="margin-top:3px;flex-shrink:0" ${valores.Verificacion_Previa === 'Sí' ? 'checked' : ''}> <span style="min-width:0">Verificación previa del flujo</span></label>
          <label style="display:flex;align-items:flex-start;gap:8px;font-weight:400;margin:0;cursor:pointer;min-width:0"><input type="checkbox" id="reg-campo-descon" style="margin-top:3px;flex-shrink:0" ${valores.Descontaminacion_Posterior === 'Sí' ? 'checked' : ''}> <span style="min-width:0">Descontaminación posterior realizada</span></label>
        </div>
      </div>`;
  } else {
    const progActual   = valores.Programa_Ciclo || '';
    const progEsPreset = PROGRAMAS_AUTOCLAVE.includes(progActual);
    const progSelValue = progActual && !progEsPreset ? 'Otro' : progActual;

    el.innerHTML = `
      <div class="form-grid-2" style="margin-top:12px">
        <div class="form-group">
          <label>Programa / ciclo</label>
          <select id="reg-campo-programa" onchange="_onProgramaCicloChange()">
            ${[...PROGRAMAS_AUTOCLAVE, 'Otro'].map(p => `<option value="${p}" ${progSelValue === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <input type="text" id="reg-campo-programa-otro" placeholder="Especifica el programa" value="${progEsPreset ? '' : progActual}" style="margin-top:6px;${progSelValue === 'Otro' ? '' : 'display:none'}">
        </div>
        <div class="form-group">
          <label>Tipo de carga</label>
          <select id="reg-campo-carga">
            ${CARGAS_AUTOCLAVE.map(n => `<option value="${n}" ${valores.Tipo_Carga === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full">
          <label>Resultado del control biológico/químico</label>
          <select id="reg-campo-resultado">
            ${['No aplica', 'Correcto', 'No correcto'].map(n => `<option value="${n}" ${valores.Resultado_Control === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
      </div>`;
  }
}

function _onProgramaCicloChange() {
  const sel  = document.getElementById('reg-campo-programa');
  const otro = document.getElementById('reg-campo-programa-otro');
  if (!sel || !otro) return;
  otro.style.display = sel.value === 'Otro' ? '' : 'none';
}

function _leerCamposSesion(tipo) {
  if (tipo === 'cabina') {
    return {
      Practica_Tecnica: v('reg-campo-practica'),
      Nivel_Riesgo: v('reg-campo-riesgo'),
      Verificacion_Previa: document.getElementById('reg-campo-verif')?.checked ? 'Sí' : 'No',
      Descontaminacion_Posterior: document.getElementById('reg-campo-descon')?.checked ? 'Sí' : 'No'
    };
  }
  const progSel = v('reg-campo-programa');
  return {
    Programa_Ciclo: progSel === 'Otro' ? v('reg-campo-programa-otro') : progSel,
    Tipo_Carga: v('reg-campo-carga'),
    Resultado_Control: v('reg-campo-resultado')
  };
}

// ── Modal: nueva sesión completa / cerrar sesión ─────────────

function openModalSesionRegistro(tipo, idEquipoPreset = '') {
  _regCtx = { tipo, idx: null };
  const cfg = _regConfig[tipo];
  const equipos = _equiposDeTipo(tipo);

  const sel = document.getElementById('reg-sesion-equipo');
  sel.disabled = false;
  sel.innerHTML = equipos.map(e => `<option value="${e.ID_Activo}">${_nombreEquipoReg(e.ID_Activo)}</option>`).join('');
  sel.value = idEquipoPreset || _equipoRegDefault(tipo);

  const ahora = new Date();
  sv('reg-sesion-fecha', ahora.toISOString().split('T')[0]);
  sv('reg-sesion-hora-inicio', ahora.toTimeString().slice(0, 5));
  sv('reg-sesion-hora-fin', cfg.permiteSesionAbierta ? ahora.toTimeString().slice(0, 5) : '');
  sv('reg-sesion-incidencias', '');
  _renderCamposSesion(tipo);
  _actualizarLabelHoraFin(cfg);

  document.getElementById('modal-reg-sesion-title').textContent = cfg.permiteSesionAbierta
    ? `Registrar sesión completa — ${cfg.label}`
    : `Registrar ciclo — ${cfg.label}`;
  document.getElementById('reg-sesion-btn-guardar').textContent = cfg.permiteSesionAbierta ? 'Registrar sesión' : 'Registrar ciclo';
  openModal('modal-reg-sesion');
}

function _actualizarLabelHoraFin(cfg) {
  const label = document.getElementById('reg-sesion-hora-fin-label');
  if (label) label.textContent = cfg.permiteSesionAbierta ? 'Hora fin *' : 'Hora fin (si la conoces)';
}

function openModalCerrarSesion(tipo, idx) {
  const cfg = _regConfig[tipo];
  const r = DATA[cfg.key][idx];
  if (!r) return;
  _regCtx = { tipo, idx };

  const sel = document.getElementById('reg-sesion-equipo');
  sel.innerHTML = `<option value="${r.ID_Equipo}">${_nombreEquipoReg(r.ID_Equipo)}</option>`;
  sel.value = r.ID_Equipo;
  sel.disabled = true;

  sv('reg-sesion-fecha', r.Fecha);
  sv('reg-sesion-hora-inicio', r.Hora_Inicio);
  sv('reg-sesion-hora-fin', new Date().toTimeString().slice(0, 5));
  sv('reg-sesion-incidencias', r.Incidencias || '');
  _renderCamposSesion(tipo, r);
  _actualizarLabelHoraFin(cfg);

  document.getElementById('modal-reg-sesion-title').textContent = `Cerrar sesión — ${cfg.label}`;
  document.getElementById('reg-sesion-btn-guardar').textContent = 'Guardar y cerrar sesión';
  openModal('modal-reg-sesion');
}

async function guardarSesionRegistro() {
  if (!_regCtx) return;
  const { tipo, idx } = _regCtx;
  const cfg = _regConfig[tipo];

  const idEquipo = v('reg-sesion-equipo');
  const fecha    = v('reg-sesion-fecha');
  const horaIni  = v('reg-sesion-hora-inicio');
  const horaFin  = v('reg-sesion-hora-fin');
  if (!idEquipo || !fecha || !horaIni) { showToast('Completa fecha y hora de inicio', 'error'); return; }
  if (cfg.permiteSesionAbierta && !horaFin) { showToast('Indica la hora de fin', 'error'); return; }
  if (horaFin && horaFin <= horaIni) { showToast('La hora de fin debe ser posterior a la de inicio', 'error'); return; }

  const campos = _leerCamposSesion(tipo);
  if (tipo === 'cabina' && (!campos.Practica_Tecnica.trim() || !campos.Nivel_Riesgo)) {
    showToast('Indica la práctica/técnica y el nivel de riesgo', 'error');
    return;
  }
  const incidencias = v('reg-sesion-incidencias');
  const idRegistro = idx != null ? DATA[cfg.key][idx].ID_Registro : null;
  const camposApi = tipo === 'cabina'
    ? { practica_tecnica: campos.Practica_Tecnica, nivel_riesgo: campos.Nivel_Riesgo, verificacion_previa: campos.Verificacion_Previa, descontaminacion_posterior: campos.Descontaminacion_Posterior }
    : { programa_ciclo: campos.Programa_Ciclo, tipo_carga: campos.Tipo_Carga, resultado_control: campos.Resultado_Control };

  showLoading('Guardando…');
  try {
    const { registro } = await callEdgeFunction('gestionar-registro-uso', {
      accion: 'guardar_sesion', tipo, id_registro: idRegistro, id_equipo: idEquipo,
      fecha, hora_inicio: horaIni, hora_fin: horaFin, incidencias, campos: camposApi,
    });
    const objLocal = tipo === 'cabina' ? _registroCabinaSbToObj(registro) : _registroAutoclaveSbToObj(registro);
    if (idx != null) {
      DATA[cfg.key][idx] = objLocal;
      showToast('Sesión cerrada ✓', 'success');
    } else {
      DATA[cfg.key].push(objLocal);
      showToast(cfg.permiteSesionAbierta ? 'Sesión registrada ✓' : 'Ciclo registrado ✓', 'success');
    }
    closeModal('modal-reg-sesion');
    renderRegistrosUso();
    _updateBadgeRegistrosUso();
  } catch (e) {
    showToast('Error al guardar la sesión', 'error'); console.error(e);
  } finally { hideLoading(); }
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
    showToast('Error al eliminar', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Inicio/cierre rápido — manual (botón) o vía NFC/QR ───────

function _abrirRegistroPorNfc(tipo, idEquipo) {
  const cfg = _regConfig[tipo];
  if (!cfg) return;
  _regTab = tipo;
  showPage('registros-uso');
  renderRegistrosUso();

  if (!cfg.permiteSesionAbierta) {
    // El autoclave no tiene concepto de sesión abierta: la etiqueta abre directamente el registro del ciclo.
    openModalSesionRegistro(tipo, idEquipo);
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
    const objLocal = _registroCabinaSbToObj(registro);
    DATA[cfg.key].push(objLocal);
    renderRegistrosUso();
    _updateBadgeRegistrosUso();
    mostrarToastConAccion(`Sesión iniciada a las ${objLocal.Hora_Inicio} ✓ — vuelve aquí (o escanea de nuevo) para terminarla`, 'Deshacer', () => _deshacerInicioSesionReg(tipo, objLocal.ID_Registro), 6000);
  } catch (e) {
    showToast('Error al iniciar la sesión', 'error'); console.error(e);
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
    showToast('Error al deshacer', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Modal: etiqueta NFC / QR ──────────────────────────────────

function openModalNfcRegistro(tipo, idEquipo) {
  if (!idEquipo) { showToast('Selecciona un equipo primero', 'error'); return; }
  const cfg = _regConfig[tipo];
  const base = window.location.origin + window.location.pathname;
  const url = `${base}?action=registro-uso&tipo=${encodeURIComponent(tipo)}&equipo=${encodeURIComponent(idEquipo)}`;
  document.getElementById('reg-nfc-label').textContent = `${cfg.label} · ${_nombreEquipoReg(idEquipo)}`;
  document.getElementById('reg-nfc-url-text').textContent = url;
  document.getElementById('reg-nfc-desc').textContent = cfg.permiteSesionAbierta
    ? 'La misma etiqueta sirve para empezar y para terminar la sesión: la app detecta automáticamente si ya tienes una abierta en este equipo. También se puede escanear con la cámara del móvil (código QR), sin necesidad de activar el NFC.'
    : 'Al escanear (o fotografiar el QR con la cámara) se abre directamente el formulario para registrar el ciclo — no hace falta cerrar nada después.';
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

  const campos = Object.keys(cfg.camposLabels);
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nombreEquipo = equipos.length <= 1 ? _nombreEquipoReg(equipos[0].ID_Activo) : _nombreEquipoReg(idEquipoSel);

  const filas = cerradas.map(r => `<tr>
    <td>${_fmtFechaReg(r.Fecha)}</td>
    <td>${r.Hora_Fin ? `${r.Hora_Inicio}–${r.Hora_Fin}` : r.Hora_Inicio}</td>
    <td>${(r.Usuario || '').split('@')[0]}</td>
    ${cfg.mostrarCicloModulo ? `<td>${_cicloModuloUsuario(r.Usuario)}</td>` : ''}
    ${campos.map(c => `<td>${r[c] || '—'}</td>`).join('')}
    <td>${r.Incidencias || '—'}</td>
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
  <div class="meta">CIFP Manuel Antonio &nbsp;·&nbsp; ${nombreEquipo} &nbsp;·&nbsp; Generado el ${hoy} &nbsp;·&nbsp; ${cerradas.length} sesión${cerradas.length > 1 ? 'es' : ''}</div>
  <table>
    <thead><tr><th>Fecha</th><th>Horario</th><th>Usuario</th>${cfg.mostrarCicloModulo ? '<th>Ciclo / Módulo</th>' : ''}${campos.map(c => `<th>${cfg.camposLabels[c]}</th>`).join('')}<th>Incidencias</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
</body>
<script>window.onload = function() { window.print(); }<\/script>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else showToast('Activa las ventanas emergentes para generar el informe', 'error');
}
