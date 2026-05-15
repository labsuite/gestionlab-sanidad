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
  el.innerHTML = `
    <div style="margin-bottom:20px">
      <input type="text" id="res-search" class="form-input"
        placeholder="Buscar residuo, riesgo o contenedor…"
        oninput="filtrarGuia()" style="max-width:340px">
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

  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px">
    ${lista.map(t => `
      <div class="card" style="padding:16px">
        <div style="font-weight:600;font-size:15px;margin-bottom:4px">${t.Nombre}</div>
        ${t.Descripcion ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;line-height:1.4">${t.Descripcion}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
          ${t.Riesgo ? `<span style="background:#fee2e220;color:#dc2626;border:1px solid #fca5a5;padding:2px 8px;border-radius:10px;font-size:12px">⚠️ ${t.Riesgo}</span>` : ''}
          ${t.Contenedor_Tipo ? `<span style="background:var(--bg-muted);border:1px solid var(--border);padding:2px 8px;border-radius:10px;font-size:12px">🗑️ ${t.Contenedor_Tipo}</span>` : ''}
          ${t.Lab ? `<span style="background:var(--bg-muted);border:1px solid var(--border);padding:2px 8px;border-radius:10px;font-size:12px">📍 Lab ${t.Lab}${t.Zona ? ' · ' + t.Zona : ''}</span>` : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function filtrarGuia() {
  const filtro = document.getElementById('res-search')?.value || '';
  document.getElementById('res-guia-lista').innerHTML = _renderGuia(DATA.tiposResiduo, filtro);
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
