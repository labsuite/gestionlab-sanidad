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
          <td style="white-space:nowrap">${t.Riesgo ? `<span style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:2px 8px;border-radius:10px;font-size:12px">⚠️ ${t.Riesgo}</span>` : '—'}</td>
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
  sv('tr-riesgo',      t?.Riesgo         || '');
  sv('tr-contenedor',  t?.Contenedor_Tipo || '');

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
  const row = [
    existing?.ID_Residuo || genId('RES'),
    nombre, v('tr-descripcion'), v('tr-riesgo'), v('tr-contenedor'),
    existing?.Lab || '', existing?.Zona || ''
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

  return `<div class="card"><table>
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

  // Solo mostrar residuos cuyo Contenedor_Tipo coincide con la categoría del contenedor
  const tiposFiltrados = DATA.tiposResiduo.filter(t => t.Contenedor_Tipo === c.Categoria);
  const opts = tiposFiltrados.length
    ? tiposFiltrados.map(t => `<option value="${t.ID_Residuo}">${t.Nombre}</option>`).join('')
    : DATA.tiposResiduo.map(t => `<option value="${t.ID_Residuo}">${t.Nombre}</option>`).join('');
  document.getElementById('adic-tipo-residuo').innerHTML = '<option value="">— Selecciona el residuo añadido —</option>' + opts;

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
  const fecha = new Date().toISOString().split('T')[0];
  const usuario = currentUser?.name || currentUser?.email || '';
  const idAdicion = genId('AD');

  showLoading('Guardando...');
  try {
    // Guardar adición
    const rowAdicion = [idAdicion, c.ID_Contenedor, idResiduo, fecha, usuario, obs];
    await sheetsAppend('Adiciones_Residuo', rowAdicion);
    DATA.adicionesResiduo.push(rowToObj(rowAdicion, 'adicionesResiduo'));

    // Actualizar nivel del contenedor (cols E=Nivel, I=Fecha_Actualizacion, J=Actualizado_Por)
    const fila = idx + 2;
    await sheetsUpdate(`Contenedores_Residuo!E${fila}`, [nuevoNivel]);
    await sheetsUpdate(`Contenedores_Residuo!I${fila}:J${fila}`, [fecha, usuario]);
    c.Nivel = nuevoNivel;
    c.Fecha_Actualizacion = fecha;
    c.Actualizado_Por = usuario;

    closeModal('modal-adicion-res');
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Residuo registrado', 'success');
  } catch(e) { showToast('Error al guardar', 'error'); }
  hideLoading();
}

// ── Cerrar contenedor (lleno → crear nuevo vacío) ────────────
async function cerrarContenedor(idx) {
  const c = DATA.contenedoresResiduo[idx];
  if (!confirm(`¿Cerrar el contenedor "${c.Categoria}" de Lab ${c.Lab}?\nSe creará uno nuevo vacío en la misma ubicación.`)) return;

  const fecha = new Date().toISOString().split('T')[0];
  const usuario = currentUser?.name || currentUser?.email || '';
  const fila = idx + 2;

  showLoading('Cerrando contenedor...');
  try {
    // Marcar como cerrado: cols F=Estado, H=Fecha_Cierre, I=Fecha_Actualizacion, J=Actualizado_Por
    await sheetsUpdate(`Contenedores_Residuo!F${fila}`, ['cerrado']);
    await sheetsUpdate(`Contenedores_Residuo!H${fila}:J${fila}`, [fecha, fecha, usuario]);
    Object.assign(c, { Estado: 'cerrado', Fecha_Cierre: fecha, Fecha_Actualizacion: fecha, Actualizado_Por: usuario });

    // Crear nuevo contenedor vacío del mismo tipo
    const idNuevo = genId('RC');
    const fechaApertura = fecha;
    const rowNuevo = [idNuevo, c.Categoria, c.Lab, c.Zona, 'vacío', 'activo', fechaApertura, '', fecha, usuario];
    await sheetsAppend('Contenedores_Residuo', rowNuevo);
    DATA.contenedoresResiduo.push(rowToObj(rowNuevo, 'contenedoresResiduo'));

    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor cerrado. Nuevo contenedor vacío creado.', 'success');
  } catch(e) { showToast('Error al cerrar', 'error'); }
  hideLoading();
}

// ── Registrar recogida ───────────────────────────────────────
async function registrarRecogida(idx) {
  const c = DATA.contenedoresResiduo[idx];
  if (!confirm(`¿Confirmar recogida del contenedor "${c.Categoria}" de Lab ${c.Lab}?`)) return;

  const fecha = new Date().toISOString().split('T')[0];
  const usuario = currentUser?.name || currentUser?.email || '';
  const fila = idx + 2;

  showLoading('Registrando recogida...');
  try {
    await sheetsUpdate(`Contenedores_Residuo!F${fila}`, ['recogido']);
    await sheetsUpdate(`Contenedores_Residuo!I${fila}:J${fila}`, [fecha, usuario]);
    // Eliminar físicamente para no acumular historial indefinido
    await sheetsDeleteRow('Contenedores_Residuo', idx);
    DATA.contenedoresResiduo.splice(idx, 1);

    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Recogida registrada. Contenedor archivado.', 'success');
  } catch(e) { showToast('Error al registrar', 'error'); }
  hideLoading();
}

// ── Modal: nuevo / editar contenedor ────────────────────────
function openModalContenedor(idx = null) {
  editingRow = idx;
  const c = idx !== null ? DATA.contenedoresResiduo[idx] : null;

  // Datalist de categorías desde Tipos_Residuo
  const dl = document.getElementById('cont-datalist-cat');
  if (dl) {
    const cats = [...new Set(DATA.tiposResiduo.map(t => t.Contenedor_Tipo).filter(Boolean))].sort();
    dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  }

  sv('cont-categoria', c?.Categoria || '');
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

  const fecha = new Date().toISOString().split('T')[0];
  const usuario = currentUser?.name || currentUser?.email || '';

  showLoading('Guardando...');
  try {
    const formato = v('cont-formato');
    if (editingRow !== null) {
      const c = DATA.contenedoresResiduo[editingRow];
      const fila = editingRow + 2;
      const row = [c.ID_Contenedor, categoria, lab, v('cont-zona'), c.Nivel || v('cont-nivel-ini'), c.Estado || 'activo', c.Fecha_Apertura || fecha, c.Fecha_Cierre || '', fecha, usuario, formato];
      await sheetsUpdate(`Contenedores_Residuo!A${fila}:K${fila}`, row);
      Object.assign(c, rowToObj(row, 'contenedoresResiduo'));
    } else {
      const id = genId('RC');
      const row = [id, categoria, lab, v('cont-zona'), v('cont-nivel-ini') || 'vacío', 'activo', fecha, '', fecha, usuario, formato];
      await sheetsAppend('Contenedores_Residuo', row);
      DATA.contenedoresResiduo.push(rowToObj(row, 'contenedoresResiduo'));
    }
    closeModal('modal-contenedor-res');
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor guardado', 'success');
  } catch(e) { showToast('Error al guardar', 'error'); }
  hideLoading(); editingRow = null;
}

async function eliminarContenedor(idx) {
  if (!confirm('¿Eliminar este contenedor del registro?')) return;
  showLoading('Eliminando...');
  try {
    await sheetsDeleteRow('Contenedores_Residuo', idx);
    DATA.contenedoresResiduo.splice(idx, 1);
    renderResiduosContenedores();
    _updateBadgeResiduos();
    showToast('Contenedor eliminado', 'success');
  } catch(e) { showToast('Error al eliminar', 'error'); }
  hideLoading();
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
