// ============================================================
// RESIDUOS
// ============================================================

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

function _contadoBadge(cantidad) {
  const n = parseInt(cantidad) || 0;
  const color = n === 0 ? '#94a3b8' : n < 5 ? '#22c55e' : n < 10 ? '#f97316' : '#ef4444';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${color}20;color:${color};border:1px solid ${color}40">${n} garrafa${n !== 1 ? 's' : ''}</span>`;
}

// ── Página: Guía de residuos ─────────────────────────────────
function renderResiduosGuia() {
  const el = document.getElementById('page-residuos-guia');
  if (!el) return;
  const canEdit = ['Administrador', 'Gestor', 'Profesor'].includes(getUserRole());
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px">
      <input type="text" id="res-search" class="form-input"
        placeholder="Buscar residuo, descripción o contenedor…"
        oninput="filtrarGuia()" style="flex:1;min-width:200px;max-width:360px">
      ${canEdit ? `<button class="btn btn-primary" onclick="openModalTipoResiduo()">+ Nuevo tipo de residuo</button>` : ''}
    </div>
    <div id="res-guia-lista">${_renderGuia(DATA.tiposResiduo, '')}</div>
  `;
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
  if (!lista.length) return `<div style="color:var(--text-muted);padding:32px;text-align:center">No se encontraron residuos</div>`;

  const canEdit = ['Administrador', 'Gestor', 'Profesor'].includes(getUserRole());

  // Agrupar por Riesgo
  const grupos = {};
  lista.forEach(t => {
    const g = t.Riesgo || 'Sin clasificar';
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(t);
  });

  return Object.entries(grupos)
    .sort(([a],[b]) => a.localeCompare(b,'es'))
    .map(([riesgo, items]) => {
      const filas = items.map(t => {
        const idx = DATA.tiposResiduo.indexOf(t);
        return `<tr>
          <td><strong>${t.Nombre}</strong></td>
          <td style="font-size:13px;color:var(--text-soft)">${t.Descripcion || '—'}</td>
          <td>${t.Contenedor_Tipo ? `<span style="background:var(--bg-muted);border:1px solid var(--border);padding:2px 8px;border-radius:10px;font-size:12px">🗑️ ${t.Contenedor_Tipo}</span>` : '—'}</td>
          <td style="font-size:13px">${t.Lab ? `Lab ${t.Lab}${t.Zona ? ' · ' + t.Zona : ''}` : '—'}</td>
          ${canEdit ? `<td><div class="row-actions">
            <button class="icon-btn" onclick="openModalTipoResiduo(${idx})">✏️</button>
            <button class="icon-btn" onclick="eliminarTipoResiduo(${idx})">🗑️</button>
          </div></td>` : '<td></td>'}
        </tr>`;
      }).join('');
      return `<div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <div class="card-title" style="display:flex;align-items:center;gap:8px">
            <span style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:2px 10px;border-radius:10px;font-size:13px">⚠️ ${riesgo}</span>
            <span style="font-weight:400;font-size:13px;color:var(--text-muted)">${items.length} tipo${items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <table>
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Contenedor</th><th>Ubicación habitual</th><th></th></tr></thead>
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
  sv('tr-nombre',    t?.Nombre        || '');
  sv('tr-descripcion', t?.Descripcion || '');
  sv('tr-riesgo',    t?.Riesgo        || '');
  sv('tr-contenedor', t?.Contenedor_Tipo || '');
  sv('tr-lab',       t?.Lab           || '');
  sv('tr-zona',      t?.Zona          || '');
  document.getElementById('modal-tipo-residuo-title').textContent = idx !== null ? 'Editar tipo de residuo' : 'Nuevo tipo de residuo';
  openModal('modal-tipo-residuo');
}

async function guardarTipoResiduo() {
  const nombre = v('tr-nombre');
  if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  const row = [
    editingRow ? DATA.tiposResiduo[editingRow.rowIndex].ID_Residuo : genId('RES'),
    nombre, v('tr-descripcion'), v('tr-riesgo'), v('tr-contenedor'), v('tr-lab'), v('tr-zona')
  ];
  showLoading('Guardando...');
  try {
    if (editingRow) {
      await sheetsUpdate(`Tipos_Residuo!A${editingRow.rowIndex+2}:G${editingRow.rowIndex+2}`, row);
      DATA.tiposResiduo[editingRow.rowIndex] = rowToObj(row, 'tiposResiduo');
      showToast('Tipo de residuo actualizado', 'success');
    } else {
      await sheetsAppend('Tipos_Residuo', row);
      DATA.tiposResiduo.push(rowToObj(row, 'tiposResiduo'));
      showToast('Tipo de residuo guardado', 'success');
    }
    closeModal('modal-tipo-residuo');
    renderResiduosGuia();
  } catch(e) { showToast('Error al guardar', 'error'); }
  hideLoading(); editingRow = null;
}

async function eliminarTipoResiduo(idx) {
  const t = DATA.tiposResiduo[idx];
  const enUso = DATA.contenedoresResiduo.some(c => c.ID_Residuo === t.ID_Residuo);
  if (enUso) { showToast('No se puede eliminar: hay contenedores asociados a este tipo', 'error'); return; }
  if (!confirm(`¿Eliminar el tipo de residuo "${t.Nombre}"?`)) return;
  try {
    await sheetsDeleteRow('Tipos_Residuo', idx);
    DATA.tiposResiduo.splice(idx, 1);
    renderResiduosGuia();
    showToast('Tipo de residuo eliminado', 'success');
  } catch(e) { showToast('Error al eliminar', 'error'); }
}

// ── Página: Contenedores ─────────────────────────────────────
function renderResiduosContenedores() {
  const el = document.getElementById('page-residuos-contenedores');
  if (!el) return;

  const canEdit = ['Administrador', 'Gestor'].includes(getUserRole());
  const alertasFijo = DATA.contenedoresResiduo.filter(c => c.Tipo_Contenedor !== 'rotativo' && (c.Nivel === '75%' || c.Nivel === 'lleno')).length;
  const alertasRotativo = DATA.contenedoresResiduo.filter(c => c.Tipo_Contenedor === 'rotativo' && (parseInt(c.Nivel) || 0) >= 5).length;
  const alertas = alertasFijo + alertasRotativo;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div style="font-size:13px;color:var(--text-muted)">
        ${alertas > 0
          ? `<span style="color:#f97316;font-weight:600">${alertas} contenedor${alertas > 1 ? 'es' : ''} requiere${alertas > 1 ? 'n' : ''} atención</span>`
          : 'Todos los contenedores en niveles normales'}
      </div>
      ${canEdit ? `<button class="btn btn-primary" onclick="openModalContenedor()">+ Añadir contenedor</button>` : ''}
    </div>
    ${_renderContenedores(DATA.contenedoresResiduo, canEdit)}
  `;
}

function _renderContenedores(contenedores, canEdit) {
  if (!contenedores.length) {
    return `<div style="color:var(--text-muted);padding:32px;text-align:center">No hay contenedores registrados</div>`;
  }

  const rows = contenedores.map((c, i) => {
    const tipo = DATA.tiposResiduo.find(t => t.ID_Residuo === c.ID_Residuo);
    const esRotativo = c.Tipo_Contenedor === 'rotativo';
    const badgeCol = esRotativo ? _contadoBadge(c.Nivel) : _nivelBadge(c.Nivel);
    const accionBtn = esRotativo
      ? `<button class="btn btn-sm btn-secondary" onclick="anadirGarrafa(${i})">+1 sellada</button>
         <button class="btn btn-sm" onclick="registrarRecogida(${i})" style="margin-left:4px" title="Registrar recogida">♻️</button>`
      : `<button class="btn btn-sm btn-secondary" onclick="openModalNivel(${i})">Actualizar nivel</button>`;
    return `<tr>
      <td><strong>${tipo?.Nombre || c.ID_Residuo}</strong></td>
      <td>Lab ${c.Lab}${c.Zona ? ' · ' + c.Zona : ''}</td>
      <td>${badgeCol}</td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(c.Fecha_Actualizacion) || '—'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${c.Actualizado_Por || '—'}</td>
      <td style="white-space:nowrap">
        ${accionBtn}
        ${canEdit ? `
          <button class="btn btn-sm" onclick="openModalContenedor(${i})" style="margin-left:4px">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarContenedor(${i})" style="margin-left:4px">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  return `<div style="overflow-x:auto">
    <table class="table">
      <thead>
        <tr>
          <th>Residuo</th>
          <th>Ubicación</th>
          <th>Nivel</th>
          <th>Actualizado</th>
          <th>Por</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── Modal: actualizar nivel ──────────────────────────────────
function openModalNivel(idx) {
  editingRow = idx;
  const c = DATA.contenedoresResiduo[idx];
  const tipo = DATA.tiposResiduo.find(t => t.ID_Residuo === c.ID_Residuo);
  document.getElementById('modal-nivel-titulo').textContent = tipo?.Nombre || c.ID_Residuo;
  sv('res-nivel', c.Nivel || 'vacío');
  openModal('modal-res-nivel');
}

async function guardarNivel() {
  const idx = editingRow;
  const nuevoNivel = v('res-nivel');
  if (!nuevoNivel) return;

  const c = DATA.contenedoresResiduo[idx];
  const fila = idx + 2;
  const usuario = currentUser?.name || currentUser?.email || '';
  const fecha = new Date().toISOString().split('T')[0];

  try {
    await sheetsUpdate(`Contenedores_Residuo!E${fila}:G${fila}`, [nuevoNivel, fecha, usuario]);
    c.Nivel = nuevoNivel;
    c.Fecha_Actualizacion = fecha;
    c.Actualizado_Por = usuario;
    closeModal('modal-res-nivel');
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Nivel actualizado', 'success');
  } catch(e) {
    showToast('Error al guardar', 'error');
  }
}

// ── Modal: añadir / editar contenedor ───────────────────────
function _toggleContTipo() {
  const esRotativo = v('cont-tipo-cont') === 'rotativo';
  document.getElementById('cont-nivel-wrap').style.display = esRotativo ? 'none' : '';
}

function openModalContenedor(idx = null) {
  editingRow = idx;
  const opts = DATA.tiposResiduo.map(t =>
    `<option value="${t.ID_Residuo}">${t.Nombre}</option>`
  ).join('');
  document.getElementById('cont-tipo').innerHTML = '<option value="">— Selecciona —</option>' + opts;

  if (idx !== null) {
    const c = DATA.contenedoresResiduo[idx];
    sv('cont-tipo', c.ID_Residuo);
    sv('cont-lab', c.Lab);
    sv('cont-zona', c.Zona);
    sv('cont-tipo-cont', c.Tipo_Contenedor || 'fijo');
    sv('cont-nivel-ini', c.Nivel || 'vacío');
  } else {
    sv('cont-tipo', '');
    sv('cont-lab', '');
    sv('cont-zona', '');
    sv('cont-tipo-cont', 'fijo');
    sv('cont-nivel-ini', 'vacío');
  }
  _toggleContTipo();
  openModal('modal-contenedor-res');
}

async function guardarContenedor() {
  const idResiduo = v('cont-tipo');
  const lab = v('cont-lab');
  const zona = v('cont-zona');
  const tipoCont = v('cont-tipo-cont') || 'fijo';
  const nivel = tipoCont === 'rotativo' ? '0' : (v('cont-nivel-ini') || 'vacío');
  if (!idResiduo || !lab) {
    showToast('Tipo de residuo y laboratorio son obligatorios', 'error');
    return;
  }

  const fecha = new Date().toISOString().split('T')[0];
  const usuario = currentUser?.name || currentUser?.email || '';

  try {
    if (editingRow !== null) {
      const c = DATA.contenedoresResiduo[editingRow];
      const fila = editingRow + 2;
      await sheetsUpdate(`Contenedores_Residuo!A${fila}:H${fila}`,
        [c.ID_Contenedor, idResiduo, lab, zona, nivel, fecha, usuario, tipoCont]);
      Object.assign(c, { ID_Residuo: idResiduo, Lab: lab, Zona: zona, Nivel: nivel, Fecha_Actualizacion: fecha, Actualizado_Por: usuario, Tipo_Contenedor: tipoCont });
    } else {
      const id = genId('RC');
      const row = [id, idResiduo, lab, zona, nivel, fecha, usuario, tipoCont];
      await sheetsAppend('Contenedores_Residuo', row);
      DATA.contenedoresResiduo.push(rowToObj(row, 'contenedoresResiduo'));
    }
    closeModal('modal-contenedor-res');
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor guardado', 'success');
  } catch(e) {
    showToast('Error al guardar', 'error');
  }
}

// ── Contenedores rotativos (garrafas 5L) ────────────────────
async function anadirGarrafa(idx) {
  const c = DATA.contenedoresResiduo[idx];
  const nuevo = String((parseInt(c.Nivel) || 0) + 1);
  const fila = idx + 2;
  const usuario = currentUser?.name || currentUser?.email || '';
  const fecha = new Date().toISOString().split('T')[0];
  try {
    await sheetsUpdate(`Contenedores_Residuo!E${fila}:G${fila}`, [nuevo, fecha, usuario]);
    c.Nivel = nuevo; c.Fecha_Actualizacion = fecha; c.Actualizado_Por = usuario;
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast(`Garrafa sellada registrada (${nuevo} en total)`, 'success');
  } catch(e) { showToast('Error al guardar', 'error'); }
}

async function registrarRecogida(idx) {
  const c = DATA.contenedoresResiduo[idx];
  const n = parseInt(c.Nivel) || 0;
  if (!n) { showToast('No hay garrafas pendientes de recogida', 'error'); return; }
  const tipo = DATA.tiposResiduo.find(t => t.ID_Residuo === c.ID_Residuo);
  if (!confirm(`¿Confirmar recogida de ${n} garrafa${n !== 1 ? 's' : ''} de "${tipo?.Nombre || c.ID_Residuo}"?`)) return;
  const fila = idx + 2;
  const usuario = currentUser?.name || currentUser?.email || '';
  const fecha = new Date().toISOString().split('T')[0];
  try {
    await sheetsUpdate(`Contenedores_Residuo!E${fila}:G${fila}`, ['0', fecha, usuario]);
    c.Nivel = '0'; c.Fecha_Actualizacion = fecha; c.Actualizado_Por = usuario;
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Recogida registrada. Contador a cero.', 'success');
  } catch(e) { showToast('Error al guardar', 'error'); }
}

async function eliminarContenedor(idx) {
  if (!confirm('¿Eliminar este contenedor del registro?')) return;
  try {
    await sheetsDeleteRow('Contenedores_Residuo', idx);
    DATA.contenedoresResiduo.splice(idx, 1);
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor eliminado', 'success');
  } catch(e) {
    showToast('Error al eliminar', 'error');
  }
}
