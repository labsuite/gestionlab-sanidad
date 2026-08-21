// ============================================================
// RESIDUOS
// ============================================================

// Avisos específicos por formato físico de contenedor (matching parcial, minúsculas)
const _WARNINGS_FORMATO = [
  {
    match: 'bidón azul',
    texto: '⚠️ Los líquidos se pueden añadir, pero deben ir en su propio bote bien cerrado y rotulado dentro del bidón. No verter directamente.',
  },
  {
    match: 'cubo con tapa',
    texto: '⚠️ NO cerrar la tapa hasta que el contenedor esté lleno y listo para la recogida de Consenur. Mantener la tapa simplemente apoyada.',
  },
  {
    match: 'contenedor rígido',
    texto: '⚠️ NO cerrar la tapa hasta que el contenedor esté lleno y listo para la recogida de Consenur. Mantener la tapa simplemente apoyada.',
  },
  {
    match: 'bolsa plástica',
    texto: '⚠️ Solo envases vacíos de plástico o aluminio que hayan contenido sustancias peligrosas. No introducir residuos a granel ni envases con restos líquidos.',
  },
  {
    match: 'garrafa',
    texto: '⚠️ Mantener bien cerrada entre adiciones. Conservar en zona ventilada, alejada de focos de calor e ignición.',
  },
];

function _getWarningFormato(formato) {
  if (!formato) return null;
  const f = formato.toLowerCase();
  const found = _WARNINGS_FORMATO.find(w => f.includes(w.match));
  return found ? found.texto : null;
}

const NIVEL_COLOR = {
  'vacío': '#94a3b8',
  '25%':   '#22c55e',
  '50%':   '#f59e0b',
  '75%':   '#f97316',
  'lleno': '#ef4444',
};

function _nivelBadge(nivel) {
  const color = NIVEL_COLOR[nivel] || '#94a3b8';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${color}20;color:${color};border:1px solid ${color}40">${nivel || '—'}</span>`;
}


// ── Peligrosidad GHS ─────────────────────────────────────────
const _GHS = {
  'Tóxico':                           { icon:'☠️', bg:'#fee2e2', color:'#991b1b' },
  'Nocivo / Irritante':               { icon:'⚠️', bg:'#fff7ed', color:'#c2410c' },
  'Inflamable':                       { icon:'🔥', bg:'#fff7ed', color:'#c2410c' },
  'Comburente':                       { icon:'🟠', bg:'#fff7ed', color:'#ea580c' },
  'Corrosivo':                        { icon:'⚗️', bg:'#f5f3ff', color:'#6d28d9' },
  'Cancerígeno / CMR':                { icon:'🫁', bg:'#fdf2f8', color:'#9d174d' },
  'Peligroso para el medio ambiente': { icon:'🌿', bg:'#f0fdf4', color:'#15803d' },
  'Explosivo':                        { icon:'💥', bg:'#fee2e2', color:'#991b1b' },
  'Gas comprimido':                   { icon:'💨', bg:'#eff6ff', color:'#1d4ed8' },
  'Citotóxico':                       { icon:'💊', bg:'#faf5ff', color:'#7e22ce' },
};

function _riesgoBadges(riesgo) {
  if (!riesgo) return '—';
  return riesgo.split(/,\s*/).map(r => {
    const h = _GHS[r.trim()];
    const icon  = h ? h.icon  : '⚠️';
    const bg    = h ? h.bg    : '#fee2e2';
    const color = h ? h.color : '#dc2626';
    return `<span style="display:inline-flex;align-items:center;gap:3px;background:${bg};color:${color};border:1px solid ${color}33;padding:2px 8px;border-radius:10px;font-size:12px;white-space:nowrap">${icon} ${r.trim()}</span>`;
  }).join(' ');
}

// ── Página: Guía de residuos ─────────────────────────────────
function renderResiduosGuia() {
  const el = document.getElementById('page-residuos-guia');
  if (!el) return;
  const canEdit = ['Administrador', 'Gestor'].includes(getUserRole());
  el.innerHTML = `
    <div id="panel-consultas-residuo"></div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">🤖 ¿No sabes qué es o dónde tirarlo?</div>
      </div>
      <div style="padding:14px 18px">
        <button class="btn btn-primary" onclick="abrirChatResiduo()">💬 Abrir consultorio de residuos</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px">
      <input type="text" id="res-search" class="form-input"
        placeholder="Buscar residuo, descripción o contenedor…"
        oninput="filtrarGuia()" style="flex:1;min-width:200px;max-width:360px">
      ${canEdit ? `<button class="btn btn-primary" onclick="openModalTipoResiduo()">+ Nuevo tipo de residuo</button>` : ''}
    </div>
    <div id="res-guia-lista">${_renderGuia(DATA.tiposResiduo, '')}</div>
  `;
  renderPanelConsultasResiduo();
}

function _renderGuia(tipos, filtro) {
  const f = filtro.toLowerCase();
  const lista = tipos.filter(t =>
    !f ||
    (t.Nombre || '').toLowerCase().includes(f) ||
    (t.Descripcion || '').toLowerCase().includes(f) ||
    (t.Riesgo || '').toLowerCase().includes(f) ||
    (t.Contenedor_Tipo || '').toLowerCase().includes(f)
  );
  if (!lista.length) {
    if (!f) return `<div style="color:var(--text-muted);padding:32px;text-align:center">No hay tipos de residuo registrados aún.</div>`;
    return `<div style="text-align:center;padding:36px 24px">
      <div style="font-size:32px;margin-bottom:12px">♻️</div>
      <div style="font-weight:600;font-size:15px;margin-bottom:8px">No hemos encontrado ese residuo</div>
      <div style="font-size:13px;color:var(--text-muted);max-width:380px;margin:0 auto;line-height:1.6">
        ¿No sabes dónde tirar esto? <strong style="color:var(--text)">No lo tires todavía.</strong><br>
        Déjalo en un lugar seguro e informa a la gestora: dile qué es y dónde lo has dejado para que ella lo gestione y lo añada al catálogo.
      </div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="openModalConsultaResiduo()">Avisar a la gestora</button>
    </div>`;
  }

  const canEdit = ['Administrador', 'Gestor'].includes(getUserRole());

  // Agrupar por Contenedor_Tipo
  const grupos = {};
  lista.forEach(t => {
    const g = t.Contenedor_Tipo || 'Sin contenedor asignado';
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(t);
  });

  return Object.entries(grupos)
    .sort(([a],[b]) => {
      if (a === 'Sin contenedor asignado') return 1;
      if (b === 'Sin contenedor asignado') return -1;
      return a.localeCompare(b,'es');
    })
    .map(([contenedor, items]) => {
      const filas = items.map(t => {
        const idx = DATA.tiposResiduo.indexOf(t);
        return `<tr>
          <td><strong>${t.Nombre}</strong></td>
          <td style="font-size:13px;color:var(--text-soft)">${t.Descripcion || '—'}</td>
          <td style="white-space:nowrap">${_riesgoBadges(t.Riesgo)}</td>
          ${canEdit ? `<td><div class="row-actions">
            <button class="icon-btn" onclick="openModalTipoResiduo(${idx})">✏️</button>
            <button class="icon-btn" onclick="eliminarTipoResiduo(${idx})">🗑️</button>
          </div></td>` : '<td></td>'}
        </tr>`;
      }).join('');
      return `<div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            🗑️ ${contenedor}
            <span style="font-weight:400;font-size:13px;color:var(--text-muted)">${items.length} tipo${items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <table>
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Peligrosidad</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
    }).join('');
}

function filtrarGuia() {
  const filtro = document.getElementById('res-search')?.value || '';
  document.getElementById('res-guia-lista').innerHTML = _renderGuia(DATA.tiposResiduo, filtro);
}

// ── CRUD tipos de residuo ────────────────────────────────────
function openModalTipoResiduo(idx = null) {
  editingRow = idx !== null ? { sheet: 'Tipos_Residuo', rowIndex: idx } : null;
  const t = idx !== null ? DATA.tiposResiduo[idx] : null;
  sv('tr-nombre',      t?.Nombre         || '');
  sv('tr-descripcion', t?.Descripcion    || '');
  sv('tr-contenedor',  t?.Contenedor_Tipo || '');
  const riesgoActual = (t?.Riesgo || '').split(/,\s*/).map(s => s.trim()).filter(Boolean);
  document.querySelectorAll('#tr-riesgo-checks input[type=checkbox]').forEach(cb => {
    cb.checked = riesgoActual.includes(cb.value);
  });

  // Poblar datalist con tipos de contenedor ya existentes
  const dl = document.getElementById('datalist-contenedor-tipos');
  if (dl) {
    const unicos = [...new Set(
      DATA.tiposResiduo.map(x => x.Contenedor_Tipo).filter(Boolean)
    )].sort((a,b) => a.localeCompare(b,'es'));
    dl.innerHTML = unicos.map(c => `<option value="${c}">`).join('');
  }

  document.getElementById('modal-tipo-residuo-title').textContent = idx !== null ? 'Editar tipo de residuo' : 'Nuevo tipo de residuo';
  openModal('modal-tipo-residuo');
}

async function guardarTipoResiduo() {
  const nombre = v('tr-nombre');
  if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  const existing = editingRow ? DATA.tiposResiduo[editingRow.rowIndex] : null;
  const riesgo = [...document.querySelectorAll('#tr-riesgo-checks input[type=checkbox]:checked')]
    .map(cb => cb.value).join(', ');
  const body = {
    nombre, descripcion: v('tr-descripcion'), riesgo, contenedor_tipo: v('tr-contenedor'),
  };
  showLoading('Guardando...');
  try {
    if (editingRow) {
      const { tipo } = await callEdgeFunction('gestionar-residuo', { accion: 'actualizar_tipo', id_residuo: existing.ID_Residuo, ...body });
      DATA.tiposResiduo[editingRow.rowIndex] = _tipoResiduoSbToObj(tipo);
      showToast('Tipo de residuo actualizado', 'success');
    } else {
      const { tipo } = await callEdgeFunction('gestionar-residuo', { accion: 'crear_tipo', ...body });
      DATA.tiposResiduo.push(_tipoResiduoSbToObj(tipo));
      showToast('Tipo de residuo guardado', 'success');
    }
    closeModal('modal-tipo-residuo');
    renderResiduosGuia();
  } catch(e) { showToast(e.message || 'Error al guardar', 'error'); }
  hideLoading(); editingRow = null;
}

async function eliminarTipoResiduo(idx) {
  const t = DATA.tiposResiduo[idx];
  if (!confirm(`¿Eliminar el tipo de residuo "${t.Nombre}"?`)) return;
  try {
    await callEdgeFunction('gestionar-residuo', { accion: 'eliminar_tipo', id_residuo: t.ID_Residuo });
    DATA.tiposResiduo.splice(idx, 1);
    renderResiduosGuia();
    showToast('Tipo de residuo eliminado', 'success');
  } catch(e) { showToast(e.message || 'Error al eliminar', 'error'); }
}

// ── Página: Contenedores ─────────────────────────────────────
let _tabContenedor = 'activos';

function renderResiduosContenedores() {
  const el = document.getElementById('page-residuos-contenedores');
  if (!el) return;

  const canEdit = ['Administrador', 'Gestor', 'Profesor'].includes(getUserRole());
  const activos  = DATA.contenedoresResiduo.filter(c => (c.Estado || 'activo') === 'activo');
  const cerrados = DATA.contenedoresResiduo.filter(c => c.Estado === 'cerrado');

  const tabBtn = (id, label, count, badge) => {
    const isActive = _tabContenedor === id;
    const base = 'padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;margin-bottom:-2px;';
    const style = base + (isActive
      ? 'border-bottom:2px solid var(--primary);color:var(--primary)'
      : 'border-bottom:2px solid transparent;color:var(--text-muted)');
    const badgeHtml = badge
      ? `<span style="font-size:11px;background:#f97316;color:#fff;border-radius:99px;padding:1px 7px;margin-left:4px">${badge}</span>`
      : `<span style="font-size:11px;background:var(--border);color:var(--text-muted);border-radius:99px;padding:1px 7px;margin-left:4px">${count}</span>`;
    return `<button onclick="_switchTabContenedor('${id}')" style="${style}">${label}${badgeHtml}</button>`;
  };

  const alertasNivel = activos.filter(c => c.Nivel === '75%' || c.Nivel === 'lleno').length;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <div style="font-size:13px;color:var(--text-muted)">
        ${alertasNivel > 0
          ? `<span style="color:#f97316;font-weight:600">${alertasNivel} contenedor${alertasNivel > 1 ? 'es' : ''} cerca del límite</span>`
          : cerrados.length > 0
            ? `<span style="color:#ef4444;font-weight:600">${cerrados.length} contenedor${cerrados.length > 1 ? 'es' : ''} pendiente${cerrados.length > 1 ? 's' : ''} de recogida</span>`
            : '<span style="color:var(--text-muted)">Todo en orden</span>'}
      </div>
      ${canEdit ? `<button class="btn btn-primary" onclick="openModalContenedor()">+ Nuevo contenedor</button>` : ''}
    </div>
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px">
      ${tabBtn('activos', 'Activos', activos.length, alertasNivel || null)}
      ${tabBtn('recogida', 'Pendientes de recogida', cerrados.length, cerrados.length || null)}
    </div>
    <div id="cont-tab-activos">${_renderContenedoresActivos(activos, canEdit)}</div>
    <div id="cont-tab-recogida" style="display:none">${_renderContenedoresCerrados(cerrados, canEdit)}</div>
  `;
  _switchTabContenedor(_tabContenedor);
}

function _switchTabContenedor(tab) {
  _tabContenedor = tab;
  ['activos','recogida'].forEach(t => {
    const p = document.getElementById(`cont-tab-${t}`);
    if (p) p.style.display = t === tab ? '' : 'none';
  });
}

function _renderContenedoresActivos(lista, canEdit) {
  if (!lista.length) return `<div style="color:var(--text-muted);padding:32px;text-align:center">No hay contenedores activos registrados</div>`;

  return lista.map(c => {
    const idx = DATA.contenedoresResiduo.indexOf(c);
    const adiciones = DATA.adicionesResiduo.filter(a => a.ID_Contenedor === c.ID_Contenedor);
    const ultimaAdicion = adiciones.length
      ? adiciones.sort((a,b) => b.Fecha.localeCompare(a.Fecha))[0]
      : null;

    const historialRows = adiciones
      .sort((a,b) => b.Fecha.localeCompare(a.Fecha))
      .slice(0, 5)
      .map(a => {
        const tr = DATA.tiposResiduo.find(t => t.ID_Residuo === a.ID_Residuo);
        return `<div style="display:flex;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border-light,#f0f0f0)">
          <span style="color:var(--text-muted);min-width:80px">${formatDate(a.Fecha) || a.Fecha}</span>
          <span style="color:var(--text-muted);min-width:90px">${a.Usuario || '—'}</span>
          <span><strong>${tr?.Nombre || a.ID_Residuo}</strong>${a.Observaciones ? ` · <span style="color:var(--text-muted)">${a.Observaciones}</span>` : ''}</span>
        </div>`;
      }).join('');

    const alertStyle = (c.Nivel === 'lleno' || c.Nivel === '75%')
      ? 'border-left:3px solid #f97316'
      : 'border-left:3px solid var(--border)';

    const warning = _getWarningFormato(c.Formato);
    const warningBanner = warning
      ? `<div style="margin:0 18px 12px;padding:8px 12px;background:#fef9c3;border:1px solid #fde047;border-radius:6px;font-size:12px;color:#713f12;line-height:1.5">${warning}</div>`
      : '';

    return `<div class="card" style="margin-bottom:12px;${alertStyle}">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px">
        <div style="flex:1;min-width:160px">
          <div style="font-weight:600;font-size:15px">${c.Categoria || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
            Lab ${c.Lab}${c.Zona ? ' · ' + c.Zona : ''}${c.Formato ? ' · ' + c.Formato : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${_nivelBadge(c.Nivel || 'vacío')}
          ${ultimaAdicion ? `<span style="font-size:11px;color:var(--text-muted)">Último: ${formatDate(ultimaAdicion.Fecha)}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary" onclick="openModalAdicion(${idx})">+ Añadir residuo</button>
          ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="cerrarContenedor(${idx})" title="Marcar como lleno y crear uno nuevo">Cerrar</button>` : ''}
          ${getUserRole() === 'Administrador' ? `<button class="btn btn-sm" onclick="mostrarUrlNfcContenedor(${idx})" title="Generar URL / etiqueta NFC">🔗</button>` : ''}
          ${canEdit ? `<button class="btn btn-sm" onclick="openModalContenedor(${idx})">✏️</button>` : ''}
          ${canEdit ? `<button class="btn btn-sm btn-danger" onclick="eliminarContenedor(${idx})">✕</button>` : ''}
        </div>
      </div>
      ${warningBanner}
      ${adiciones.length ? `
        <details style="padding:0 18px 12px">
          <summary style="font-size:12px;color:var(--text-muted);cursor:pointer;user-select:none">
            Historial de adiciones (${adiciones.length})
          </summary>
          <div style="margin-top:8px">${historialRows}${adiciones.length > 5 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">… y ${adiciones.length - 5} más</div>` : ''}</div>
        </details>` : ''}
    </div>`;
  }).join('');
}

function _renderContenedoresCerrados(lista, canEdit) {
  if (!lista.length) return `<div style="color:var(--text-muted);padding:32px;text-align:center">No hay contenedores pendientes de recogida</div>`;

  const rows = lista.map(c => {
    const idx = DATA.contenedoresResiduo.indexOf(c);
    return `<tr>
      <td><strong>${c.Categoria || '—'}</strong>${c.Formato ? `<div style="font-size:11px;color:var(--text-muted)">${c.Formato}</div>` : ''}</td>
      <td style="font-size:13px">Lab ${c.Lab}${c.Zona ? ' · ' + c.Zona : ''}</td>
      <td>${_nivelBadge(c.Nivel || 'lleno')}</td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(c.Fecha_Cierre) || '—'}</td>
      <td style="white-space:nowrap">
        ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="registrarRecogida(${idx})">♻️ Registrar recogida</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm btn-danger" onclick="eliminarContenedor(${idx})" style="margin-left:4px">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-secondary" onclick="exportarInformeConsenur()">📄 Generar informe para Consenur</button>
    </div>
    <div class="card"><table>
      <thead><tr><th>Categoría</th><th>Ubicación</th><th>Nivel al cerrar</th><th>Fecha cierre</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ── Modal: añadir residuo a contenedor ───────────────────────
function openModalAdicion(idx) {
  editingRow = idx;
  const c = DATA.contenedoresResiduo[idx];
  document.getElementById('adic-contenedor-titulo').textContent = `${c.Categoria || '—'} · Lab ${c.Lab}${c.Zona ? ' · ' + c.Zona : ''}`;
  sv('adic-observaciones', '');
  sv('adic-nivel', c.Nivel || 'vacío');

  // Buscador: datalist + mapa nombre→ID
  const tiposFiltrados = DATA.tiposResiduo.filter(t => t.Contenedor_Tipo === c.Categoria);
  const tipos = tiposFiltrados.length ? tiposFiltrados : DATA.tiposResiduo;
  window._adic_tipo_map = {};
  tipos.forEach(t => { window._adic_tipo_map[t.Nombre] = t.ID_Residuo; });
  const dl = document.getElementById('adic-tipo-residuo-list');
  if (dl) dl.innerHTML = tipos.map(t => `<option value="${t.Nombre}">`).join('');
  const textoEl = document.getElementById('adic-tipo-residuo-texto');
  const hiddenEl = document.getElementById('adic-tipo-residuo');
  if (textoEl) { textoEl.value = ''; textoEl.oninput = () => { hiddenEl.value = window._adic_tipo_map[textoEl.value] || ''; }; }
  if (hiddenEl) hiddenEl.value = '';

  // Warning por formato
  const warnEl = document.getElementById('adic-warning-formato');
  const warnTxt = _getWarningFormato(c.Formato);
  if (warnEl) {
    warnEl.textContent = warnTxt || '';
    warnEl.style.display = warnTxt ? 'block' : 'none';
  }

  openModal('modal-adicion-res');
}

async function guardarAdicion() {
  const idx = editingRow;
  const idResiduo = v('adic-tipo-residuo');
  const nuevoNivel = v('adic-nivel');
  const obs = v('adic-observaciones');
  if (!idResiduo) { showToast('Selecciona el tipo de residuo', 'error'); return; }

  const c = DATA.contenedoresResiduo[idx];
  const usuario = currentUser?.name || currentUser?.email || '';

  showLoading('Guardando...');
  try {
    const { adicion, contenedor } = await callEdgeFunction('gestionar-residuo', {
      accion: 'añadir_adicion', id_contenedor: c.ID_Contenedor, id_residuo: idResiduo,
      nivel: nuevoNivel, usuario, observaciones: obs,
    });
    DATA.adicionesResiduo.push(_adicionResiduoSbToObj(adicion));
    Object.assign(c, _contenedorResiduoSbToObj(contenedor));

    closeModal('modal-adicion-res');
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Residuo registrado', 'success');
  } catch(e) { showToast(e.message || 'Error al guardar', 'error'); }
  hideLoading();
}

// ── Cerrar contenedor (lleno → crear nuevo vacío) ────────────
async function cerrarContenedor(idx) {
  const c = DATA.contenedoresResiduo[idx];
  if (!confirm(`¿Cerrar el contenedor "${c.Categoria}" de Lab ${c.Lab}?\nSe creará uno nuevo vacío en la misma ubicación.`)) return;

  const usuario = currentUser?.name || currentUser?.email || '';

  showLoading('Cerrando contenedor...');
  try {
    const { cerrado, nuevo } = await callEdgeFunction('gestionar-residuo', {
      accion: 'cerrar_contenedor', id_contenedor: c.ID_Contenedor, usuario,
    });
    Object.assign(c, _contenedorResiduoSbToObj(cerrado));
    DATA.contenedoresResiduo.push(_contenedorResiduoSbToObj(nuevo));

    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor cerrado. Nuevo contenedor vacío creado.', 'success');
  } catch(e) { showToast(e.message || 'Error al cerrar', 'error'); }
  hideLoading();
}

// ── Registrar recogida ───────────────────────────────────────
async function registrarRecogida(idx) {
  const c = DATA.contenedoresResiduo[idx];
  if (!confirm(`¿Confirmar recogida del contenedor "${c.Categoria}" de Lab ${c.Lab}?`)) return;

  const usuario = currentUser?.name || currentUser?.email || '';

  showLoading('Registrando recogida...');
  try {
    // Se elimina físicamente para no acumular historial indefinido (mismo comportamiento que antes)
    await callEdgeFunction('gestionar-residuo', { accion: 'registrar_recogida', id_contenedor: c.ID_Contenedor, usuario });
    DATA.contenedoresResiduo.splice(idx, 1);

    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Recogida registrada. Contenedor archivado.', 'success');
  } catch(e) { showToast(e.message || 'Error al registrar', 'error'); }
  hideLoading();
}

// ── Modal: nuevo / editar contenedor ────────────────────────
function openModalContenedor(idx = null) {
  editingRow = idx;
  const c = idx !== null ? DATA.contenedoresResiduo[idx] : null;

  // Select cerrado de categorías desde Tipos_Residuo
  const catSel = document.getElementById('cont-categoria');
  if (catSel) {
    const cats = [...new Set(DATA.tiposResiduo.map(t => t.Contenedor_Tipo).filter(Boolean))].sort();
    catSel.innerHTML = '<option value="">— Seleccionar categoría —</option>' +
      cats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    catSel.value = c?.Categoria || '';
  }
  sv('cont-lab',       c?.Lab       || '');
  sv('cont-zona',      c?.Zona      || '');
  sv('cont-formato',   c?.Formato   || '');
  sv('cont-nivel-ini', c?.Nivel     || 'vacío');
  document.getElementById('modal-contenedor-res-title').textContent = idx !== null ? 'Editar contenedor' : 'Nuevo contenedor';
  openModal('modal-contenedor-res');
}

async function guardarContenedor() {
  const categoria = v('cont-categoria');
  const lab = v('cont-lab');
  if (!categoria || !lab) { showToast('Categoría y laboratorio son obligatorios', 'error'); return; }

  const usuario = currentUser?.name || currentUser?.email || '';

  showLoading('Guardando...');
  try {
    const formato = v('cont-formato');
    const zona = v('cont-zona');
    if (editingRow !== null) {
      const c = DATA.contenedoresResiduo[editingRow];
      const { contenedor } = await callEdgeFunction('gestionar-residuo', {
        accion: 'actualizar_contenedor', id_contenedor: c.ID_Contenedor,
        categoria, lab, zona, formato, usuario,
      });
      Object.assign(c, _contenedorResiduoSbToObj(contenedor));
    } else {
      const { contenedor } = await callEdgeFunction('gestionar-residuo', {
        accion: 'crear_contenedor', categoria, lab, zona, formato,
        nivel: v('cont-nivel-ini') || 'vacío', usuario,
      });
      DATA.contenedoresResiduo.push(_contenedorResiduoSbToObj(contenedor));
    }
    closeModal('modal-contenedor-res');
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor guardado', 'success');
  } catch(e) { showToast(e.message || 'Error al guardar', 'error'); }
  hideLoading(); editingRow = null;
}

async function eliminarContenedor(idx) {
  if (!confirm('¿Eliminar este contenedor del registro?')) return;
  const c = DATA.contenedoresResiduo[idx];
  showLoading('Eliminando...');
  try {
    await callEdgeFunction('gestionar-residuo', { accion: 'eliminar_contenedor', id_contenedor: c.ID_Contenedor });
    DATA.contenedoresResiduo.splice(idx, 1);
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor eliminado', 'success');
  } catch(e) { showToast(e.message || 'Error al eliminar', 'error'); }
  hideLoading();
}

// ── Consultas de residuo desconocido ────────────────────────

function openModalConsultaResiduo() {
  sv('consulta-descripcion', '');
  sv('consulta-ubicacion', '');
  openModal('modal-consulta-residuo');
}

async function guardarConsultaResiduo() {
  const desc = v('consulta-descripcion');
  const ubi  = v('consulta-ubicacion');
  if (!desc) { showToast('Describe el residuo antes de enviar', 'error'); return; }
  if (!ubi)  { showToast('Indica dónde lo has dejado', 'error'); return; }
  showLoading('Enviando aviso...');
  try {
    const { consulta } = await callEdgeFunction('gestionar-residuo', {
      accion: 'crear_consulta', descripcion: desc, ubicacion_dejado: ubi, usuario: currentUser?.name || '',
    });
    DATA.consultasResiduo.push(_consultaResiduoSbToObj(consulta));
    _updateBadgeResiduos();
    renderPanelConsultasResiduo();
    renderDashboard();
    showToast('Aviso enviado. La gestora lo revisará pronto.', 'success');
    closeModal('modal-consulta-residuo');
  } catch(e) { showToast(e.message || 'Error al enviar el aviso', 'error'); console.error(e); }
  hideLoading();
}

function renderPanelConsultasResiduo() {
  const contenedor = document.getElementById('panel-consultas-residuo');
  if (!contenedor) return;
  const rol = getUserRole();
  const pendientes = DATA.consultasResiduo.filter(c => c.Estado === 'Pendiente')
    .sort((a, b) => (b.Prioridad === 'Alta') - (a.Prioridad === 'Alta'));
  if ((rol !== 'Administrador' && rol !== 'Gestor') || !pendientes.length) {
    contenedor.style.display = 'none';
    return;
  }
  contenedor.style.display = '';
  contenedor.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:18px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        ♻️ Consultas de residuo pendientes de clasificar
        <span class="badge badge-orange" style="font-size:11px">${pendientes.length}</span>
      </div>
      ${pendientes.map(c => {
        const idx = DATA.consultasResiduo.indexOf(c);
        const esAlta = c.Prioridad === 'Alta';
        return `<div style="border-top:1px solid var(--border);${esAlta ? 'background:#fef2f2;' : ''}padding:10px 8px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start">
          <div>
            <div style="font-size:13px;font-weight:500;margin-bottom:3px">
              ${esAlta ? '<span style="background:#dc2626;color:#fff;border-radius:8px;padding:1px 7px;font-size:11px;margin-right:6px">PRIORIDAD ALTA</span>' : ''}
              ${c.Categoria_IA ? `<span style="background:#e0e7ff;color:#3730a3;border-radius:8px;padding:1px 7px;font-size:11px;margin-right:6px">IA: ${c.Categoria_IA}</span>` : ''}
              ${c.Descripcion}
            </div>
            ${c.Guia_Provisional ? `<div style="font-size:12px;color:var(--text-muted);font-style:italic;margin-bottom:3px">Guía provisional ya dada: "${c.Guia_Provisional.slice(0,140)}${c.Guia_Provisional.length>140?'…':''}"</div>` : ''}
            <div style="font-size:12px;color:var(--text-muted)">
              📍 ${c.Ubicacion_Dejado || '—'} &nbsp;·&nbsp; 👤 ${c.Usuario || '—'} &nbsp;·&nbsp; 📅 ${formatDate(c.Fecha)||c.Fecha||'—'}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <button class="btn btn-primary" style="font-size:11px;padding:4px 12px;white-space:nowrap"
              onclick="abrirModalTipoDesdeConsulta(${idx})">＋ Añadir a guía</button>
            <button class="btn btn-secondary" style="font-size:11px;padding:4px 12px;white-space:nowrap"
              onclick="resolverConsultaResiduo(${idx})">✓ Resuelta</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function abrirModalTipoDesdeConsulta(idxConsulta) {
  const c = DATA.consultasResiduo[idxConsulta];
  if (!c) return;
  openModalTipoResiduo();
  sv('tr-descripcion', c.Descripcion || '');
  if (c.Categoria_IA && _GHS[c.Categoria_IA]) {
    document.querySelectorAll('#tr-riesgo-checks input[type=checkbox]').forEach(cb => {
      cb.checked = (cb.value === c.Categoria_IA);
    });
  }
}

async function resolverConsultaResiduo(idx) {
  const c = DATA.consultasResiduo[idx];
  if (!c) return;
  showLoading('Marcando como resuelta...');
  try {
    await callEdgeFunction('gestionar-residuo', { accion: 'resolver_consulta', id_consulta: c.ID_Consulta });
    DATA.consultasResiduo[idx].Estado = 'Resuelta';
    _updateBadgeResiduos();
    renderPanelConsultasResiduo();
    renderDashboard();
    showToast('Consulta marcada como resuelta', 'success');
  } catch(e) { showToast(e.message || 'Error al actualizar', 'error'); console.error(e); }
  hideLoading();
}

// ── Consultorio de residuos (chat IA) ────────────────────────
let _chatResLab = '';
let _chatResHistory = [];   // [{role:'user'|'model', parts:[{text}]}] — turno 0 es el system prompt disfrazado

function abrirChatResiduo() {
  _chatResLab = '';
  _chatResHistory = [];
  document.getElementById('chat-res-mensajes').style.display = 'none';
  document.getElementById('chat-res-mensajes').innerHTML = '';
  document.getElementById('chat-res-input-row').style.display = 'none';

  const labsConContenedor = [...new Set(
    DATA.contenedoresResiduo.filter(c => (c.Estado || 'activo') === 'activo').map(c => c.Lab).filter(Boolean)
  )].sort();
  const sel = document.getElementById('chat-res-lab');
  sel.innerHTML = '<option value="">— Selecciona tu laboratorio —</option>' +
    labsConContenedor.map(l => `<option value="${l}">Lab ${l}</option>`).join('');

  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const usuarioFila = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  const misLabs = _getLabsDeUbics(usuarioFila?.Ubicaciones_Asignadas || '');
  const preferido = misLabs.find(l => labsConContenedor.includes(l));
  if (preferido) sel.value = preferido;

  openModal('modal-chat-residuo');
  if (preferido) _chatResSeleccionarLab();
}

function cerrarChatResiduo() {
  closeModal('modal-chat-residuo');
  _chatResHistory = [];
}

function _chatResSeleccionarLab() {
  _chatResLab = v('chat-res-lab');
  if (!_chatResLab) return;
  document.getElementById('chat-res-mensajes').style.display = 'block';
  document.getElementById('chat-res-input-row').style.display = 'flex';
  document.getElementById('chat-res-mensajes').innerHTML = '';
  _chatResHistory = [_construirSystemPromptResiduo(_chatResLab)];
  _chatResPintarMensaje('model', 'Cuéntame qué residuo tienes y te digo dónde tirarlo o cómo manejarlo mientras tanto.');
}

function _chatResPintarMensaje(role, texto) {
  const cont = document.getElementById('chat-res-mensajes');
  const alineado = role === 'user' ? 'flex-end' : 'flex-start';
  const bg = role === 'user' ? 'var(--primary)' : 'var(--surface)';
  const color = role === 'user' ? '#fff' : 'var(--text)';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;justify-content:${alineado};margin-bottom:8px`;
  div.innerHTML = `<div style="max-width:80%;background:${bg};color:${color};padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.5;white-space:pre-wrap"></div>`;
  div.firstElementChild.textContent = texto;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
}

function _construirSystemPromptResiduo(lab) {
  const catalogo = DATA.tiposResiduo.map(t =>
    `- ${t.Nombre} | Riesgo: ${t.Riesgo || 'ninguno'} | Contenedor: ${t.Contenedor_Tipo || 'sin asignar'}`
  ).join('\n');
  const contenedoresLab = DATA.contenedoresResiduo
    .filter(c => (c.Estado || 'activo') === 'activo' && c.Lab === lab)
    .map(c => `- Categoria: ${c.Categoria} | Formato: ${c.Formato || 'sin especificar'}`)
    .join('\n') || '(No hay contenedores activos registrados en este laboratorio)';
  const avisos = _WARNINGS_FORMATO.map(w => `- Si el contenedor es "${w.match}": ${w.texto}`).join('\n');

  const systemText = `Eres el consultorio de residuos de un laboratorio de un instituto de FP sanitaria (CIFP Manuel Antonio). Un alumno, profesor o gestor te va a describir un residuo que quiere tirar. Tu trabajo es decirle en qué contenedor de este laboratorio concreto va, o si no hay un contenedor adecuado, darle instrucciones de manejo provisional seguras.

CATÁLOGO DE TIPOS DE RESIDUO CONOCIDOS:
${catalogo}

CONTENEDORES ACTIVOS EN EL LABORATORIO ${lab}:
${contenedoresLab}

AVISOS POR FORMATO DE CONTENEDOR (inclúyelos si aplica):
${avisos}

REGLAS QUE NUNCA PUEDES SALTARTE (tanto si el caso está resuelto como si no):
- Nunca digas que se puede verter por el desagüe ni tirar a la basura general.
- Nunca sugieras mezclar con el contenido de otro contenedor ni con otro residuo pendiente.
- Siempre indica que debe quedarse en su propio envase cerrado y rotulado (qué es, quién, fecha) en la zona de residuos pendientes del laboratorio, alejado de calor, luz directa y otros reactivos.
- Si el usuario describe derrame, olor fuerte, exposición o cualquier riesgo agudo inmediato: corta ahí mismo, di literalmente "Avisa ya a tu profesor/a presente, esto no se resuelve por chat" y no des más pasos.
- Si es un químico con pictograma GHS conocido (inflamable, corrosivo, tóxico, comburente, explosivo, gas comprimido): nunca digas que abra el envase para identificarlo ni que lo trasvase; si hay burbujeo o presión, dile que avise sin esperar.
- Si es biológico o cortopunzante (sangre, cultivos, agujas, bisturís): nunca digas que se manipule con la mano aunque lleve guantes, nunca reencapuchar una aguja, indicar usar pinzas.
- Si es cancerígeno/CMR o citotóxico: nunca manipular sin doble guante, y este caso siempre es prioridad Alta.
- Si el envase no tiene etiqueta o es de origen desconocido: trátalo siempre como el peor caso plausible, nunca decir que se huela o pruebe.
- Si es una mezcla accidental de dos residuos incompatibles: nunca intentes que se separen, y esto siempre es prioridad Alta.

FORMATO DE RESPUESTA — MUY IMPORTANTE, sigue esto exactamente:
Si encuentras un contenedor adecuado en el catálogo/lista de arriba para este laboratorio, tu respuesta debe EMPEZAR literalmente con la etiqueta:
[RESUELTO]
seguida de la categoría de contenedor y el formato, y el aviso de formato si aplica.

Si NO hay ningún tipo o contenedor compatible en este laboratorio, tu respuesta debe EMPEZAR literalmente con la etiqueta:
[NO_RESUELTO|categoria=<una de: Tóxico, Nocivo / Irritante, Inflamable, Comburente, Corrosivo, Cancerígeno / CMR, Peligroso para el medio ambiente, Explosivo, Gas comprimido, Citotóxico, o "Desconocido">|prioridad=<Alta o Normal>]
seguida de las instrucciones de manejo provisional en texto libre, respetando siempre las reglas de arriba.

Nunca omitas la etiqueta inicial. Nunca uses ninguna otra etiqueta.`;

  return [
    { role: 'user', parts: [{ text: systemText }] },
    { role: 'model', parts: [{ text: 'Entendido.' }] },
  ];
}

async function _chatResEnviar() {
  const texto = v('chat-res-texto');
  if (!texto) return;
  sv('chat-res-texto', '');
  _chatResPintarMensaje('user', texto);
  _chatResHistory.push({ role: 'user', parts: [{ text: texto }] });

  _chatResPintarMensaje('model', '…');
  try {
    const respuesta = await _llamarGemini(_chatResHistory);
    document.getElementById('chat-res-mensajes').lastElementChild.remove();
    _chatResHistory.push({ role: 'model', parts: [{ text: respuesta }] });
    await _chatResProcesarRespuesta(respuesta);
  } catch (e) {
    document.getElementById('chat-res-mensajes').lastElementChild.remove();
    _chatResPintarMensaje('model', 'No he podido conectar con el asistente. Si es urgente, avisa directamente a tu profesor/a. También puedes usar el aviso manual a la gestora.');
    console.error(e);
  }
}

async function _llamarGemini(history) {
  if (!GEMINI_API_KEY) throw new Error('Consultorio de IA no configurado todavía (falta GEMINI_API_KEY)');
  const GEMINI_MODEL = 'gemini-flash-latest'; // ⚠️ Verificar contra GET /v1beta/models antes de fijar en producción
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(GEMINI_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: history, generationConfig: { maxOutputTokens: 1024, temperature: 0.2 } }),
  });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Respuesta vacía de Gemini');
  return text;
}

// Función pura: interpreta la respuesta de la IA. Mecanismo robusto y no ambiguo —
// la etiqueta va anclada al principio de la respuesta, no se infiere del lenguaje natural.
// Si la IA no respeta el formato, se trata como no resuelto (fail-safe: mejor escalar
// de más que perder un caso real sin avisar a Gestión).
function _parseRespuestaChatResiduo(texto) {
  const resuelto = /^\[RESUELTO\]/.exec(texto);
  if (resuelto) {
    return { resuelto: true, cuerpo: texto.replace(/^\[RESUELTO\]\s*/, '') };
  }
  const noResuelto = /^\[NO_RESUELTO\|categoria=([^|]+)\|prioridad=(Alta|Normal)\]/.exec(texto);
  if (noResuelto) {
    return {
      resuelto: false,
      categoria: noResuelto[1].trim(),
      prioridad: noResuelto[2],
      cuerpo: texto.replace(/^\[NO_RESUELTO\|[^\]]+\]\s*/, ''),
    };
  }
  return { resuelto: false, categoria: 'Desconocido', prioridad: 'Normal', cuerpo: texto };
}

async function _chatResProcesarRespuesta(texto) {
  const parsed = _parseRespuestaChatResiduo(texto);
  _chatResPintarMensaje('model', parsed.cuerpo);
  if (!parsed.resuelto) {
    await _chatResEscalarAConsulta(parsed.cuerpo, parsed.categoria, parsed.prioridad);
  }
}

async function _chatResEscalarAConsulta(guiaProvisional, categoriaIa, prioridad) {
  try {
    const ultimoMensajeUsuario = [..._chatResHistory].reverse().find(m => m.role === 'user' && !m.parts[0].text.startsWith('Eres el consultorio'));
    const { consulta } = await callEdgeFunction('gestionar-residuo', {
      accion: 'crear_consulta',
      descripcion: `[Consultorio IA] ${ultimoMensajeUsuario?.parts[0].text || '(sin descripción)'} (Lab ${_chatResLab})`,
      ubicacion_dejado: `Lab ${_chatResLab} (zona de residuos pendientes)`,
      usuario: currentUser?.name || currentUser?.email || '',
      categoria_ia: categoriaIa, guia_provisional: guiaProvisional, prioridad,
    });
    DATA.consultasResiduo.push(_consultaResiduoSbToObj(consulta));
    _updateBadgeResiduos();
    renderPanelConsultasResiduo();
    if (typeof renderDashboard === 'function') renderDashboard();
    _chatResPintarMensaje('model', '✅ Se ha avisado a Gestión con esta información.');
  } catch (e) {
    console.error('No se pudo crear la consulta automática', e);
  }
}

// ── NFC: generar URL para etiqueta de contenedor ─────────────
function mostrarUrlNfcContenedor(idx) {
  const c = DATA.contenedoresResiduo[idx];
  const base = window.location.origin + window.location.pathname;
  const url = `${base}?cont-cat=${encodeURIComponent(c.Categoria)}&cont-lab=${encodeURIComponent(c.Lab)}&action=adicion`;
  document.getElementById('nfc-cont-label').textContent =
    `${c.Categoria} · Lab ${c.Lab}${c.Zona ? ' · ' + c.Zona : ''}${c.Formato ? ' · ' + c.Formato : ''}`;
  document.getElementById('nfc-cont-url-text').textContent = url;
  const qrImg = document.getElementById('nfc-cont-qr');
  qrImg.src = '';
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`;
  openModal('modal-nfc-contenedor');
}

async function copiarUrlNfcContenedor() {
  const url = document.getElementById('nfc-cont-url-text').textContent;
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

// ── Informe para Consenur ─────────────────────────────────────
function exportarInformeConsenur() {
  const cerrados = DATA.contenedoresResiduo.filter(c => c.Estado === 'cerrado');
  if (!cerrados.length) { showToast('No hay contenedores pendientes de recogida', 'info'); return; }

  const hoy = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const fechaArchivo = new Date().toISOString().slice(0, 10);

  // Agrupar por lab
  const porLab = {};
  cerrados.forEach(c => {
    const lab = c.Lab || 'Sin lab';
    if (!porLab[lab]) porLab[lab] = [];
    porLab[lab].push(c);
  });

  function tiposDeContenedor(c) {
    const ids = [...new Set(
      DATA.adicionesResiduo
        .filter(a => a.ID_Contenedor === c.ID_Contenedor)
        .map(a => a.ID_Residuo)
    )];
    return ids.map(id => {
      const t = DATA.tiposResiduo.find(t => t.ID_Residuo === id);
      return t ? { nombre: t.Nombre, riesgo: t.Riesgo || '' } : null;
    }).filter(Boolean);
  }

  const seccionesHtml = Object.keys(porLab).sort().map(lab => {
    const filas = porLab[lab].map(c => {
      const tipos = tiposDeContenedor(c);
      const tiposHtml = tipos.length
        ? tipos.map(t => `<li>${t.nombre}${t.riesgo ? ` ${_riesgoBadges(t.riesgo)}` : ''}</li>`).join('')
        : '<li style="color:#999;font-style:italic">Sin adiciones registradas</li>';
      return `<tr>
        <td><strong>${c.Categoria || '—'}</strong>${c.Formato ? `<br><span class="sub">${c.Formato}</span>` : ''}</td>
        <td>${c.Zona || '—'}</td>
        <td>${c.Nivel || '—'}</td>
        <td>${formatDate(c.Fecha_Cierre) || '—'}</td>
        <td><ul class="tipos">${tiposHtml}</ul></td>
      </tr>`;
    }).join('');
    return `<h2>Laboratorio ${lab}</h2>
      <table>
        <thead><tr><th>Contenedor</th><th>Zona</th><th>Nivel</th><th>Fecha cierre</th><th>Residuos depositados</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Consenur ${fechaArchivo}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; max-width: 900px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #666; margin-bottom: 32px; }
  h2 { font-size: 14px; font-weight: 700; background: #f0f0f0; padding: 6px 12px; border-radius: 4px; margin: 28px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #1a1a1a; color: #fff; font-size: 12px; font-weight: 600; text-align: left; padding: 7px 10px; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; font-size: 12px; }
  tr:last-child td { border-bottom: none; }
  .sub { color: #888; font-size: 11px; }
  ul.tipos { margin: 0; padding-left: 16px; }
  ul.tipos li { margin-bottom: 2px; }
  .riesgo { background: #fef3c7; color: #92400e; border-radius: 3px; padding: 1px 5px; font-size: 10px; margin-left: 4px; }
  @media print {
    body { margin: 20px; }
    h2 { break-before: auto; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Listado de contenedores de residuos para recogida</h1>
  <div class="meta">CIFP Manuel Antonio &nbsp;·&nbsp; ${hoy} &nbsp;·&nbsp; ${cerrados.length} contenedor${cerrados.length > 1 ? 'es' : ''} pendiente${cerrados.length > 1 ? 's' : ''} de recogida</div>
  ${seccionesHtml}
</body>
<script>window.onload = function() { window.print(); }<\/script>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else showToast('Activa las ventanas emergentes para generar el informe', 'error');
}

// Llamado desde ui.js tras login cuando llega ?cont-cat=X&cont-lab=Y&action=adicion
function _abrirAdicionPorNfc(categoria, lab) {
  showPage('residuos-contenedores');
  setTimeout(() => {
    const c = DATA.contenedoresResiduo.find(x =>
      x.Categoria === categoria && x.Lab === lab && (x.Estado || 'activo') === 'activo'
    );
    if (!c) {
      showToast(`No se encontró un contenedor activo de "${categoria}" en Lab ${lab}`, 'error');
      return;
    }
    openModalAdicion(DATA.contenedoresResiduo.indexOf(c));
  }, 300);
}
