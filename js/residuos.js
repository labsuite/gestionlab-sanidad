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

function renderResiduos() {
  const canEdit = ['Administrador', 'Gestor'].includes(getUserRole());
  const alertas = DATA.contenedoresResiduo.filter(c => c.Nivel === '75%' || c.Nivel === 'lleno').length;

  document.getElementById('page-residuos').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div>
        <h2 style="margin:0;font-size:20px">Gestión de residuos</h2>
        <div style="color:var(--text-muted);font-size:13px;margin-top:2px">
          ${alertas > 0
            ? `<span style="color:#f97316;font-weight:600">${alertas} contenedor${alertas > 1 ? 'es' : ''} requiere${alertas > 1 ? 'n' : ''} atención</span>`
            : 'Todos los contenedores en niveles normales'}
        </div>
      </div>
      ${canEdit ? `<button class="btn btn-primary" onclick="openModalContenedor()">+ Añadir contenedor</button>` : ''}
    </div>

    <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border)">
      <button id="tab-res-guia" onclick="switchResTab('guia')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;color:var(--primary);border-bottom:2px solid var(--primary);margin-bottom:-2px">
        Guía de residuos
      </button>
      <button id="tab-res-cont" onclick="switchResTab('contenedores')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:500;color:var(--text-muted);border-bottom:2px solid transparent;margin-bottom:-2px">
        Contenedores
      </button>
    </div>

    <div id="restab-guia">
      <div style="margin-bottom:16px">
        <input type="text" id="res-search" class="form-input" placeholder="Buscar residuo, riesgo o contenedor…" oninput="filtrarGuia()" style="max-width:340px">
      </div>
      <div id="res-guia-lista">${_renderGuia(DATA.tiposResiduo, '')}</div>
    </div>

    <div id="restab-cont" style="display:none">
      <div id="res-cont-tabla">${_renderContenedores(DATA.contenedoresResiduo, canEdit)}</div>
    </div>
  `;
}

function switchResTab(tab) {
  const isGuia = tab === 'guia';
  document.getElementById('restab-guia').style.display = isGuia ? '' : 'none';
  document.getElementById('restab-cont').style.display  = isGuia ? 'none' : '';

  const tGuia = document.getElementById('tab-res-guia');
  const tCont = document.getElementById('tab-res-cont');
  if (!tGuia || !tCont) return;

  tGuia.style.color        = isGuia ? 'var(--primary)' : 'var(--text-muted)';
  tGuia.style.borderBottom = isGuia ? '2px solid var(--primary)' : '2px solid transparent';
  tGuia.style.fontWeight   = isGuia ? '600' : '500';

  tCont.style.color        = isGuia ? 'var(--text-muted)' : 'var(--primary)';
  tCont.style.borderBottom = isGuia ? '2px solid transparent' : '2px solid var(--primary)';
  tCont.style.fontWeight   = isGuia ? '500' : '600';
}

// ── Guía ────────────────────────────────────────────────────
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

// ── Contenedores ────────────────────────────────────────────
function _renderContenedores(contenedores, canEdit) {
  if (!contenedores.length) {
    return `<div style="color:var(--text-muted);padding:32px;text-align:center">No hay contenedores registrados</div>`;
  }

  const rows = contenedores.map((c, i) => {
    const tipo = DATA.tiposResiduo.find(t => t.ID_Residuo === c.ID_Residuo);
    return `<tr>
      <td><strong>${tipo?.Nombre || c.ID_Residuo}</strong></td>
      <td>Lab ${c.Lab}${c.Zona ? ' · ' + c.Zona : ''}</td>
      <td>${_nivelBadge(c.Nivel)}</td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(c.Fecha_Actualizacion) || '—'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${c.Actualizado_Por || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-secondary" onclick="openModalNivel(${i})">Actualizar nivel</button>
        ${canEdit ? `<button class="btn btn-sm" onclick="openModalContenedor(${i})" style="margin-left:4px">✏️</button>
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
    renderResiduos();
    _updateBadgeResiduos();
    showToast('Nivel actualizado', 'success');
  } catch(e) {
    showToast('Error al guardar', 'error');
  }
}

// ── Modal: añadir / editar contenedor ───────────────────────
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
    sv('cont-nivel-ini', c.Nivel || 'vacío');
  } else {
    sv('cont-tipo', '');
    sv('cont-lab', '');
    sv('cont-zona', '');
    sv('cont-nivel-ini', 'vacío');
  }
  openModal('modal-contenedor-res');
}

async function guardarContenedor() {
  const idResiduo = v('cont-tipo');
  const lab = v('cont-lab');
  const zona = v('cont-zona');
  const nivel = v('cont-nivel-ini') || 'vacío';
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
      await sheetsUpdate(`Contenedores_Residuo!A${fila}:G${fila}`,
        [c.ID_Contenedor, idResiduo, lab, zona, nivel, fecha, usuario]);
      Object.assign(c, { ID_Residuo: idResiduo, Lab: lab, Zona: zona, Nivel: nivel, Fecha_Actualizacion: fecha, Actualizado_Por: usuario });
    } else {
      const id = genId('RC');
      const row = [id, idResiduo, lab, zona, nivel, fecha, usuario];
      await sheetsAppend('Contenedores_Residuo', row);
      DATA.contenedoresResiduo.push(rowToObj(row, 'contenedoresResiduo'));
    }
    closeModal('modal-contenedor-res');
    renderResiduos();
    _updateBadgeResiduos();
    showToast('Contenedor guardado', 'success');
  } catch(e) {
    showToast('Error al guardar', 'error');
  }
}

async function eliminarContenedor(idx) {
  if (!confirm('¿Eliminar este contenedor del registro?')) return;
  try {
    await sheetsDeleteRow('Contenedores_Residuo', idx);
    DATA.contenedoresResiduo.splice(idx, 1);
    renderResiduos();
    _updateBadgeResiduos();
    showToast('Contenedor eliminado', 'success');
  } catch(e) {
    showToast('Error al eliminar', 'error');
  }
}
