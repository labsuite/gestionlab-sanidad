// ============================================================
// MATERIAL FUNGIBLE — RENDER
// ============================================================
let _filtroMaterial = '', _filtroMaterialCat = '', _filtroMaterialStock = '', _filtroMaterialUbicacion = '';

/**
 * Devuelve la etiqueta de precio medio con IVA para mostrar en la tabla.
 * Usa getHistoricoMaterial (definido en contabilidad.js, mismo scope global).
 * IVA estándar ES: 21 %.
 */
function _precioMedioLabel(m) {
  if (typeof getHistoricoMaterial !== 'function') return '—';
  const hist = getHistoricoMaterial(m.Nombre, '');  // sin filtro de proveedor → media global
  if (!hist.count) return '<span style="color:var(--text-muted)">Sin datos</span>';
  const conIVA = hist.media * 1.21;
  return `${conIVA.toFixed(2)} € <span style="font-size:10px;color:var(--text-muted)">(n=${hist.count})</span>`;
}

// ============================================================
// REVISIONES DE INVENTARIO
// ============================================================

function _puedeRevisarInventario() {
  if (getUserRole() !== 'Alumno') return false;
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  return u?.Puede_Revisar_Inventario === 'TRUE';
}

function renderPanelRevisiones() {
  const contenedor = document.getElementById('panel-revisiones-inventario');
  if (!contenedor) return;
  const rol = getUserRole();
  const puedeVer = rol === 'Administrador' || rol === 'Gestor' || rol === 'Profesor';
  if (!puedeVer || !DATA.revisionesInventario.length) {
    contenedor.style.display = 'none';
    return;
  }
  contenedor.style.display = '';
  contenedor.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:18px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        📋 Revisiones de inventario pendientes
        <span class="badge badge-orange" style="font-size:11px">${DATA.revisionesInventario.length}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="color:var(--text-muted);text-align:left">
            <th style="padding:4px 8px">Fecha</th>
            <th style="padding:4px 8px">Material</th>
            <th style="padding:4px 8px;text-align:center">App</th>
            <th style="padding:4px 8px;text-align:center">Real</th>
            <th style="padding:4px 8px;text-align:center">Dif.</th>
            <th style="padding:4px 8px">Alumno</th>
            <th style="padding:4px 8px">Obs.</th>
            <th style="padding:4px 8px"></th>
          </tr>
        </thead>
        <tbody>
          ${DATA.revisionesInventario.map(r => {
            const dif = parseFloat(r.Diferencia) || 0;
            const difColor = dif < 0 ? 'var(--danger)' : dif > 0 ? 'var(--warning)' : 'var(--success)';
            const mat = DATA.material.find(m => m.ID_Material === r.ID_Material);
            const unidad = mat?.Unidad || '';
            return `<tr style="border-top:1px solid var(--border)">
              <td style="padding:6px 8px;color:var(--text-muted)">${formatDate(r.Fecha)||r.Fecha||'—'}</td>
              <td style="padding:6px 8px;font-weight:500">${r.Nombre_Material||'—'}</td>
              <td style="padding:6px 8px;text-align:center">${r.Stock_App} ${unidad}</td>
              <td style="padding:6px 8px;text-align:center">${r.Stock_Real} ${unidad}</td>
              <td style="padding:6px 8px;text-align:center;font-weight:600;color:${difColor}">${dif > 0 ? '+' : ''}${dif}</td>
              <td style="padding:6px 8px;color:var(--text-soft)">${r.Usuario||'—'}</td>
              <td style="padding:6px 8px;color:var(--text-muted);font-style:italic">${r.Observaciones||'—'}</td>
              <td style="padding:6px 8px;white-space:nowrap">
                <button class="btn btn-primary" style="font-size:11px;padding:4px 10px" onclick="aplicarRevisionInventario('${r.ID_Revision}')">Aplicar</button>
                <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;margin-left:4px" onclick="descartarRevisionInventario('${r.ID_Revision}')">Descartar</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function openModalContarStock(matId) {
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) return;
  document.getElementById('contar-mat-id').value = matId;
  document.getElementById('contar-mat-nombre').textContent = mat.Nombre;
  const stock = getStockTotal(mat);
  document.getElementById('contar-stock-app').textContent = stock + ' ' + (mat.Unidad || '');
  document.getElementById('contar-stock-real').value = '';
  document.getElementById('contar-obs').value = '';
  openModal('modal-contar-stock');
}

async function guardarConteo() {
  const matId = document.getElementById('contar-mat-id').value;
  const realStr = document.getElementById('contar-stock-real').value;
  if (!matId) return;
  if (realStr === '' || isNaN(parseFloat(realStr)) || parseFloat(realStr) < 0) {
    showToast('Introduce la cantidad real que has contado', 'error'); return;
  }
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) return;
  const stockReal = parseFloat(realStr);
  const obs = document.getElementById('contar-obs').value;
  showLoading('Enviando revisión...');
  try {
    const { revision } = await callEdgeFunction('gestionar-material', {
      accion: 'revision_crear', id_material: matId, stock_real: stockReal, observaciones: obs, usuario: currentUser?.name || '',
    });
    DATA.revisionesInventario.push(_revisionInventarioSbToObj(revision));
    showToast('Revisión enviada. El profesor la revisará pronto.', 'success');
    closeModal('modal-contar-stock');
  } catch(e) { showToast('Error al enviar la revisión', 'error'); console.error(e); }
  hideLoading();
}

async function aplicarRevisionInventario(revId) {
  const revIdx = DATA.revisionesInventario.findIndex(r => r.ID_Revision === revId);
  if (revIdx === -1) return;
  showLoading('Aplicando ajuste...');
  try {
    await callEdgeFunction('gestionar-material', { accion: 'revision_aplicar', id_revision: revId, usuario: currentUser?.name || '' });
    await loadAllData(); // refresca material, lotes, movimientos y revisiones
    showToast('Ajuste aplicado correctamente', 'success');
    renderPanelRevisiones(); renderMaterial();
  } catch(e) { showToast('Error aplicando el ajuste', 'error'); console.error(e); }
  hideLoading();
}

async function descartarRevisionInventario(revId) {
  const revIdx = DATA.revisionesInventario.findIndex(r => r.ID_Revision === revId);
  if (revIdx === -1) return;
  showLoading('Descartando...');
  try {
    await callEdgeFunction('gestionar-material', { accion: 'revision_descartar', id_revision: revId });
    DATA.revisionesInventario.splice(revIdx, 1);
    showToast('Revisión descartada', 'success');
    renderPanelRevisiones();
  } catch(e) { showToast('Error descartando la revisión', 'error'); console.error(e); }
  hideLoading();
}

function renderMaterial(filtro, cat, stockFiltro, ubicacion) {
  if (filtro    !== undefined) _filtroMaterial         = filtro;
  if (cat       !== undefined) _filtroMaterialCat      = cat;
  if (stockFiltro !== undefined) _filtroMaterialStock  = stockFiltro;
  if (ubicacion !== undefined) _filtroMaterialUbicacion = ubicacion;

  renderPanelRevisiones();

  const dlUbi = document.getElementById('ubicaciones-datalist');
  if (dlUbi) {
    dlUbi.innerHTML = DATA.ubicaciones.filter(u => u.Activa !== 'FALSE').map(u => {
      const label = [u.ID_Ubicacion, u.Zona, u.Subzona].filter(Boolean).join(' · ');
      return `<option value="${u.ID_Ubicacion}">${label}</option>`;
    }).join('');
  }

  const cats = [...new Set(DATA.material.map(m => m.Categoria).filter(Boolean))].sort();
  const filterCat = document.getElementById('filter-material-cat');
  if (filterCat) {
    const current = filterCat.value;
    filterCat.innerHTML = '<option value="">Todas las categorías</option>' + cats.map(c => `<option value="${c}">${c.split(' — ')[0]}</option>`).join('');
    filterCat.value = current;
  }

  let items = DATA.material;

  if (_filtroMaterial) {
    const q = _filtroMaterial.toLowerCase();
    items = items.filter(m => (m.Nombre + m.Categoria + m.ID_Material + m.Proveedor + m.Referencia_Proveedor).toLowerCase().includes(q));
  }
  if (_filtroMaterialCat) items = items.filter(m => m.Categoria === _filtroMaterialCat);
  if (_filtroMaterialStock === 'bajo') items = items.filter(m => stockBajoMinimo(m));
  if (_filtroMaterialStock === 'ok')   items = items.filter(m => !stockBajoMinimo(m));

  if (_filtroMaterialUbicacion) {
    const q = _filtroMaterialUbicacion.toLowerCase();
    items = items.filter(m => {
      if ((m.Ubicacion||'').toLowerCase().includes(q)) return true;
      const ubi = DATA.ubicaciones.find(u => u.ID_Ubicacion === m.Ubicacion);
      if (ubi && ((ubi.Zona||'').toLowerCase().includes(q) || (ubi.Subzona||'').toLowerCase().includes(q) || (ubi.Laboratorio_Aula||'').toLowerCase().includes(q))) return true;
      return getMatUbics(m.ID_Material).some(l => (l.ID_Ubicacion||'').toLowerCase().includes(q) || getNombreUbicacion(l.ID_Ubicacion).toLowerCase().includes(q));
    });
  }

  const tbody = document.getElementById('tabla-material');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🧴</div><div class="empty-state-title">Sin material registrado</div><div class="empty-state-text">Añade el primer ítem con el botón superior</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(m => renderFilaMaterial(m)).join('');
}

function renderFilaMaterial(m) {
  const lotes  = getMatUbics(m.ID_Material);
  const stock  = getStockTotal(m);
  const minTot = getStockMinTotal(m);
  const opt    = parseFloat(m.Stock_Optimo) || 0;
  const pct    = opt > 0 ? Math.min(100, Math.round(stock / opt * 100)) : (minTot > 0 ? Math.min(100, Math.round(stock / minTot * 100)) : 100);
  const color  = stock === 0 ? 'var(--danger)' : (minTot > 0 && stock <= minTot ? 'var(--warning)' : 'var(--success)');
  const idx    = DATA.material.indexOf(m);
  const safeId = m.ID_Material.replace(/[^a-zA-Z0-9]/g, '-');

  const multiUbi = lotes.length > 0;
  const ubiCount = lotes.length > 0 ? lotes.length : (m.Ubicacion ? 1 : 0);
  const ubiLabel = ubiCount > 0
    ? `<span style="font-size:11px;color:var(--accent);font-weight:500">${ubiCount} ubicación${ubiCount > 1 ? 'es' : ''}</span>`
    : `<span style="font-size:12px;color:var(--text-muted)">—</span>`;

  const rowId = `mat-row-${safeId}`;

  // Fila principal: siempre expandable con el mismo estilo
  let html = `<tr class="equipo-row expandable" id="${rowId}" style="cursor:pointer" onclick="toggleMatUbics('${m.ID_Material}')">
    <td><strong>${m.ID_Material}</strong></td>
    <td>
      <span class="expand-icon" id="expand-mat-${safeId}">▶</span> ${m.Nombre}
    </td>
    <td><span class="badge badge-gray">${m.Categoria ? m.Categoria.split(' — ')[0] : '—'}</span></td>
    <td>${ubiLabel}</td>
    <td>
      <div class="stock-bar-wrap">
        <div class="stock-bar"><div class="stock-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="stock-val" style="color:${color}">${getStockLabel(m)}</span>
      </div>
    </td>
    <td style="font-size:12px;color:var(--text-muted)">${minTot || '—'} / ${opt || '—'}</td>
    <td style="font-size:12px;color:var(--text-soft);text-align:right;padding-right:4px">${_precioMedioLabel(m)}</td>
    <td onclick="event.stopPropagation()"><div class="row-actions">
      ${puedeHacer('crearSolicitudes') ? `<button class="icon-btn" onclick="openModalSolicitudMaterial('${m.ID_Material}')" title="Solicitar">📋</button>` : ''}
      ${puedeHacer('editarMaterial') ? `<button class="icon-btn" onclick="editMaterial(${idx})" title="Editar">✏️</button>` : ''}
      ${_puedeRevisarInventario() ? `<button class="icon-btn" onclick="openModalContarStock('${m.ID_Material}')" title="Contar stock">🔢</button>` : ''}
      <button class="icon-btn" onclick="openModalHistorialMaterial('${m.ID_Material}')" title="Ver historial">🕐</button>
    </div></td>
  </tr>`;

  // Sub-filas por ubicación — siempre se generan (al menos una), ANTES del detalle
  if (multiUbi) {
    html += lotes.map((l, li) => {
      const sLocal  = parseFloat(l.Stock_Local)  || 0;
      const mnLocal = parseFloat(l.Stock_Minimo_Local) || 0;
      const opLocal = parseFloat(l.Stock_Optimo_Local) || 0;
      const pctL  = opLocal > 0 ? Math.min(100, Math.round(sLocal / opLocal * 100)) : (mnLocal > 0 ? Math.min(100, Math.round(sLocal / mnLocal * 100)) : 100);
      const colL  = sLocal === 0 ? 'var(--danger)' : (mnLocal > 0 && sLocal <= mnLocal ? 'var(--warning)' : 'var(--success)');
      const esMadre = lotes.some(o => o.ID_Lote_Padre === l.ID);
      const lotePadre = l.ID_Lote_Padre ? lotes.find(o => o.ID === l.ID_Lote_Padre) : null;
      const etiquetaLinaje = lotePadre
        ? `<span title="Subdividido de: ${getNombreUbicacion(lotePadre.ID_Ubicacion)}" style="margin-right:4px">↳🧪</span>`
        : (esMadre ? `<span title="Bote madre — tiene subdivisiones" style="margin-right:4px">🫙</span>` : '');
      return `<tr class="mat-ubic-row" id="mat-ubic-${safeId}-${li}" style="display:none;background:var(--surface2)">
        <td></td>
        <td colspan="3" style="text-align:right;padding-right:16px;font-size:12px;color:var(--text-soft)">${etiquetaLinaje}📍 ${getNombreUbicacion(l.ID_Ubicacion)}</td>
        <td>
          <div class="stock-bar-wrap">
            <div class="stock-bar"><div class="stock-bar-fill" style="width:${pctL}%;background:${colL}"></div></div>
            <span class="stock-val" style="color:${colL}">${sLocal} ${l.Unidad_Lote || m.Unidad || ''}</span>
          </div>
        </td>
        <td colspan="2" style="font-size:12px;color:var(--text-muted)">${mnLocal || '—'} / ${opLocal || '—'}</td>
        <td onclick="event.stopPropagation()"><div class="row-actions">
          <button class="icon-btn" onclick="openModalConsumoLote('${l.ID}')" title="Consumo en esta ubicación">📦</button>
          ${puedeHacer('editarMaterial') ? `<button class="icon-btn" onclick="openModalEntradaLote('${l.ID}')" title="Entrada en esta ubicación">📥</button>` : ''}
          ${puedeHacer('editarMaterial') ? `<button class="icon-btn" onclick="openModalSubdividirLote('${l.ID}')" title="Subdividir en botes de uso">✂️</button>` : ''}
          ${puedeHacer('editarMaterial') ? `<button class="icon-btn" onclick="eliminarLoteDirecto('${l.ID}')" title="Eliminar este bote">🗑️</button>` : ''}
          <button class="icon-btn" onclick="openModalTrasladoLote('${l.ID}')" title="Trasladar a otra ubicación">🔀</button>
        </div></td>
      </tr>`;
    }).join('');
  } else {
    // Ítem legacy (sin lotes en Material_Ubicaciones): sub-fila sintética
    const sLeg  = parseFloat(m.Stock_Actual) || 0;
    const mnLeg = parseFloat(m.Stock_Minimo) || 0;
    const opLeg = parseFloat(m.Stock_Optimo) || 0;
    const pctLeg = opLeg > 0 ? Math.min(100, Math.round(sLeg / opLeg * 100)) : (mnLeg > 0 ? Math.min(100, Math.round(sLeg / mnLeg * 100)) : 100);
    const colLeg = sLeg === 0 ? 'var(--danger)' : (mnLeg > 0 && sLeg <= mnLeg ? 'var(--warning)' : 'var(--success)');
    html += `<tr class="mat-ubic-row" id="mat-ubic-${safeId}-0" style="display:none;background:var(--surface2)">
      <td></td>
      <td colspan="3" style="text-align:right;padding-right:16px;font-size:12px;color:var(--text-soft)">📍 ${m.Ubicacion ? getNombreUbicacion(m.Ubicacion) : '—'}</td>
      <td>
        <div class="stock-bar-wrap">
          <div class="stock-bar"><div class="stock-bar-fill" style="width:${pctLeg}%;background:${colLeg}"></div></div>
          <span class="stock-val" style="color:${colLeg}">${sLeg} ${m.Unidad || ''}</span>
        </div>
      </td>
      <td colspan="2" style="font-size:12px;color:var(--text-muted)">${mnLeg || '—'} / ${opLeg || '—'}</td>
      <td onclick="event.stopPropagation()"><div class="row-actions">
        <button class="icon-btn" onclick="openModalConsumoMaterial('${m.ID_Material}')" title="Registrar consumo">📦</button>
        ${puedeHacer('editarMaterial') ? `<button class="icon-btn" onclick="openModalEntradaMaterial('${m.ID_Material}')" title="Entrada">📥</button>` : ''}
        ${puedeHacer('editarMaterial') && m.Ubicacion ? `<button class="icon-btn" onclick="subdividirDesdeLegacy('${m.ID_Material}')" title="Subdividir en botes de uso">✂️</button>` : ''}
        ${m.Ubicacion ? `<button class="icon-btn" onclick="trasladarDesdeLegacy('${m.ID_Material}')" title="Trasladar a otra ubicación">🔀</button>` : ''}
      </div></td>
    </tr>`;
  }

  // Fila de detalle (solo visible en móvil): categoría/precio — la ubicación ya está en la sub-fila
  const labelStyle = 'display:block;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px';
  html += `<tr class="mat-detail-row" id="mat-detail-${safeId}">
    <td colspan="8" style="padding:4px 12px 10px;background:var(--surface2)">
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="font-size:11px"><span style="${labelStyle}">Categoría</span><strong>${m.Categoria ? m.Categoria.split(' — ')[0] : '—'}</strong></div>
        <div style="font-size:11px"><span style="${labelStyle}">Mín / Óptimo</span><strong>${minTot || '—'} / ${opt || '—'} ${m.Unidad || ''}</strong></div>
        <div style="font-size:11px"><span style="${labelStyle}">Precio medio</span><strong>${_precioMedioLabel(m)}</strong></div>
      </div>
    </td>
  </tr>`;

  return html;
}

// ============================================================
// TOGGLE EXPANSIÓN — ubicaciones y movimientos
// ============================================================
function toggleMatUbics(idMaterial) {
  const safeId    = idMaterial.replace(/[^a-zA-Z0-9]/g, '-');
  const expandIcon = document.getElementById(`expand-mat-${safeId}`);
  const lotes     = getMatUbics(idMaterial);
  const firstRow  = document.getElementById(`mat-ubic-${safeId}-0`);
  if (!firstRow) return;
  const isOpen = firstRow.style.display !== 'none';
  const numRows = Math.max(lotes.length, 1); // legacy items have 1 synthetic row
  for (let i = 0; i < numRows; i++) {
    const row = document.getElementById(`mat-ubic-${safeId}-${i}`);
    if (row) row.style.display = isOpen ? 'none' : '';
  }
  // Cerrar movimientos si estaban abiertos
  const movRow = document.getElementById(`mat-mov-${safeId}`);
  if (movRow && !isOpen === false) movRow.style.display = 'none';
  if (expandIcon) expandIcon.textContent = isOpen ? '▶' : '▼';
  toggleMatDetail(idMaterial, true); // sincronizar fila de detalle (skipIcon=true)
}

function toggleMatDetail(idMaterial, skipIcon = false) {
  const safeId = idMaterial.replace(/[^a-zA-Z0-9]/g, '-');
  const detail = document.getElementById(`mat-detail-${safeId}`);
  if (!detail) return;
  const isOpen = detail.classList.toggle('open');
  if (!skipIcon) {
    const icon = document.getElementById(`expand-mat-${safeId}`);
    if (icon) icon.textContent = isOpen ? '▼' : '▶';
  }
}

function openModalHistorialMaterial(idMaterial) {
  const mat = DATA.material.find(m => m.ID_Material === idMaterial);
  const nombre = mat?.Nombre || idMaterial;
  const movs = DATA.movimientos
    .filter(m => m.Material === nombre)
    .sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

  document.getElementById('historial-mat-titulo').textContent = `Historial — ${nombre}`;

  const contenido = document.getElementById('historial-mat-contenido');
  if (!movs.length) {
    contenido.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">Sin movimientos registrados para este ítem.</div>`;
  } else {
    contenido.innerHTML = movs.map(m => `
      <div style="display:grid;grid-template-columns:90px 110px 48px 1fr;gap:8px;align-items:center;font-size:12px;padding:7px 0;border-bottom:1px solid var(--border-light,#f0f0f0)">
        <span style="color:var(--text-muted)">${formatDate(m.Fecha)||'—'}</span>
        <span>${m.Tipo === 'Entrada' ? '<span class="badge badge-green" style="font-size:10px">📥 Entrada</span>' : '<span class="badge badge-orange" style="font-size:10px">📦 Salida</span>'}</span>
        <strong>${m.Cantidad||'—'}</strong>
        <span style="color:var(--text-soft)">${m.Motivo||'—'}</span>
      </div>`).join('');
  }
  openModal('modal-historial-material');
}

function filtrarMaterial(val)          { renderMaterial(val, undefined, undefined); }
function filtrarMaterialCategoria(val) { renderMaterial(undefined, val, undefined); }
function filtrarMaterialStock(val)     { renderMaterial(undefined, undefined, val); }
function filtrarMaterialUbicacion(val) { renderMaterial(undefined, undefined, undefined, val); }

// ============================================================
// RENDER MOVIMIENTOS (vista global)
// ============================================================
function renderMovimientos(filtroTipo = '') {
  const tbody = document.getElementById('tabla-movimientos');
  if (!tbody) return;
  let items = [...DATA.movimientos];
  if (filtroTipo) items = items.filter(m => m.Tipo === filtroTipo);
  items.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-title">Sin movimientos registrados</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(m => `<tr>
    <td style="font-size:12px;color:var(--text-muted)">${formatDate(m.Fecha) || '—'}</td>
    <td>${m.Material || '—'}</td>
    <td>${m.Tipo === 'Entrada' ? '<span class="badge badge-green">📥 Entrada</span>' : '<span class="badge badge-orange">📦 Salida</span>'}</td>
    <td><strong>${m.Cantidad || '—'}</strong></td>
    <td style="font-size:12px">${m.Usuario || '—'}</td>
    <td style="font-size:12px">${m.Motivo || '—'}</td>
    <td style="font-size:12px;color:var(--text-muted)">${m.Observaciones || '—'}</td>
  </tr>`).join('');
}
function filtrarMovimientosTipo(val) { renderMovimientos(val); }

// ============================================================
// AUTOCOMPLETE MATERIAL
// ============================================================
function buscarMaterialGenerico(query, listId, hiddenId, selectedId) {
  const list = document.getElementById(listId);
  if (!list) return;
  if (!query || query.length < 2) { list.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const resultados = DATA.material.filter(m =>
    m.Nombre.toLowerCase().includes(q) ||
    m.ID_Material.toLowerCase().includes(q) ||
    (m.Categoria || '').toLowerCase().includes(q)
  ).slice(0, 10);
  if (!resultados.length) { list.classList.remove('open'); return; }
  list.innerHTML = resultados.map(m => {
    const stock = getStockTotal(m);
    const min   = getStockMinTotal(m);
    const stockClass = stock === 0 || (min > 0 && stock <= min) ? 'low' : 'ok';
    return `<div class="autocomplete-item" onclick="seleccionarMaterial('${m.ID_Material}','${m.Nombre.replace(/'/g,"\\'")}','${listId}','${hiddenId}','${selectedId}')">
      <div><div class="autocomplete-item-name">${m.Nombre}</div><div class="autocomplete-item-meta">${m.Categoria || ''} · ${m.Ubicacion || ''}</div></div>
      <div class="autocomplete-item-stock ${stockClass}">${stock} ${m.Unidad || ''}</div>
    </div>`;
  }).join('');
  list.classList.add('open');
}

function seleccionarMaterial(id, nombre, listId, hiddenId, selectedId) {
  document.getElementById(hiddenId).value = id;
  const mat = DATA.material.find(m => m.ID_Material === id);
  const stock = mat ? getStockTotal(mat) : 0;
  const sel = document.getElementById(selectedId);
  sel.textContent = mat ? nombre + ' · ' + (mat.Unidad || '') + ' · Stock: ' + stock + ' ' + (mat.Unidad || '') : nombre;
  sel.style.display = 'block';
  document.getElementById(listId).classList.remove('open');
  const wrap = document.getElementById(listId).closest('.search-material-wrap');
  if (wrap) wrap.querySelector('input[type="text"]').value = '';
  const unidadesField = document.getElementById(selectedId.replace('selected', 'unidades'));
  if (unidadesField && mat) unidadesField.value = mat.Unidad || '';
  if (hiddenId === 'consumo-material-id') _mostrarSelectorUbicConsumo(id);
  if (hiddenId === 'entrada-material-id') _mostrarSelectorUbicEntrada(id);
}

function buscarMaterialSolicitud(val) { buscarMaterialGenerico(val, 'sol-autocomplete',    'sol-material-id',     'sol-material-selected'); }
function buscarMaterialLinea(val)     { buscarMaterialGenerico(val, 'linea-autocomplete',  'linea-material-id',   'linea-material-selected'); }
function buscarMaterialConsumo(val)   { buscarMaterialGenerico(val, 'consumo-autocomplete','consumo-material-id', 'consumo-material-selected'); }
function buscarMaterialEntrada(val)   { buscarMaterialGenerico(val, 'entrada-autocomplete','entrada-material-id', 'entrada-material-selected'); }

// ============================================================
// AUTOCOMPLETE UBICACIONES (modal material)
// ============================================================
function buscarUbicacionMat(query) {
  const list = document.getElementById('mat-ubicacion-autocomplete');
  if (!list) return;
  if (!query || query.length < 1) { list.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const resultados = DATA.ubicaciones.filter(u =>
    u.Activa !== 'FALSE' &&
    (u.ID_Ubicacion.toLowerCase().includes(q) ||
     (u.Laboratorio_Aula || '').toLowerCase().includes(q) ||
     (u.Zona || '').toLowerCase().includes(q))
  ).sort((a, b) => a.ID_Ubicacion.localeCompare(b.ID_Ubicacion, 'es', { numeric: true }))
   .slice(0, 15);
  if (!resultados.length) { list.classList.remove('open'); return; }
  list.innerHTML = resultados.map(u => `<div class="autocomplete-item" onclick="seleccionarUbicacionMatLote('${u.ID_Ubicacion}','${(u.Laboratorio_Aula + (u.Zona ? ' · ' + u.Zona : '')).replace(/'/g,"\\'")}')">
    <div><div class="autocomplete-item-name">${u.ID_Ubicacion}</div><div class="autocomplete-item-meta">${u.Laboratorio_Aula || ''}${u.Zona ? ' · ' + u.Zona : ''}</div></div>
  </div>`).join('');
  list.classList.add('open');
}

function seleccionarUbicacionMat(id, label) { seleccionarUbicacionMatLote(id, label); }

function clearUbicacionMat() {
  document.getElementById('mat-ubicacion').value = '';
  document.getElementById('mat-ubicacion-search').value = '';
  document.getElementById('mat-ubicacion-selected').style.display = 'none';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.search-material-wrap') &&
      !e.target.closest('#mat-lotes-container') &&
      !e.target.closest('#responsable-field-wrap')) {
    document.querySelectorAll('.autocomplete-list').forEach(l => l.classList.remove('open'));
  }
});

// ============================================================
// GESTIÓN DE LOTES POR UBICACIÓN EN EL MODAL
// ============================================================
let _lotesTemp = [];
let _loteEditandoIdx = null;

function renderLotesModal() {
  const container = document.getElementById('mat-lotes-container');
  if (!container) return;
  if (!_lotesTemp.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Sin ubicaciones asignadas. Usa el campo de abajo para añadir.</div>`;
    return;
  }
  container.innerHTML = _lotesTemp.map((l, i) => {
    const nombre   = getNombreUbicacion(l.ID_Ubicacion);
    const gestionOn = l.Gestion_Auto !== false && l.Gestion_Auto !== 'false';
    const checkId   = `lote-auto-${i}`;
    const camposId  = `lote-campos-${i}`;
    // Linaje madre/hija: se calcula dentro de los propios lotes que se están editando
    const esMadre   = l._loteId && _lotesTemp.some(o => o.ID_Lote_Padre === l._loteId);
    const lotePadre = l.ID_Lote_Padre ? _lotesTemp.find(o => o._loteId === l.ID_Lote_Padre) : null;
    const etiqueta  = lotePadre
      ? `<span title="Subdividido de: ${getNombreUbicacion(lotePadre.ID_Ubicacion)}" style="margin-right:4px">↳🧪</span>`
      : (esMadre ? `<span title="Bote madre — tiene subdivisiones" style="margin-right:4px">🫙</span>` : '');
    return `<div class="lote-row" style="background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:8px;overflow:hidden">
      <!-- Cabecera del lote -->
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;flex-wrap:wrap">
        <span style="flex:1;font-size:13px;font-weight:500;min-width:120px">${etiqueta}📍 ${nombre}</span>
        <label style="font-size:12px;color:var(--text-muted)">Stock actual</label>
        <input type="number" min="0" value="${l.Stock_Local||0}" style="width:70px"
          onchange="_lotesTemp[${i}].Stock_Local=this.value"
          oninput="_lotesTemp[${i}].Stock_Local=this.value">
        <label style="font-size:12px;color:var(--text-muted)">Unidad</label>
        <input type="text" placeholder="(la del material)" value="${l.Unidad_Lote||''}" style="width:110px"
          onchange="_lotesTemp[${i}].Unidad_Lote=this.value"
          oninput="_lotesTemp[${i}].Unidad_Lote=this.value">
        <!-- Checkbox gestión automática -->
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;margin-left:8px;white-space:nowrap">
          <input type="checkbox" id="${checkId}" ${gestionOn ? 'checked' : ''}
            onchange="_toggleLoteAuto(${i},this.checked)"
            style="width:14px;height:14px">
          Gestión automática
        </label>
        <button class="icon-btn" onclick="_eliminarLoteTemp(${i})"
          title="Quitar ubicación" style="color:var(--danger)">🗑</button>
      </div>
      <!-- Campos mín/ópt — visibles solo si gestión automática activa -->
      <div id="${camposId}" style="display:${gestionOn ? 'flex' : 'none'};align-items:center;gap:8px;padding:6px 12px 10px 32px;flex-wrap:wrap;border-top:1px solid var(--border)">
        <label style="font-size:11px;color:var(--text-muted)">Stock mínimo</label>
        <input type="number" min="0" value="${l.Stock_Minimo_Local||0}" style="width:70px"
          onchange="_lotesTemp[${i}].Stock_Minimo_Local=this.value"
          oninput="_lotesTemp[${i}].Stock_Minimo_Local=this.value">
        <label style="font-size:11px;color:var(--text-muted);margin-left:10px">Stock óptimo</label>
        <input type="number" min="0" value="${l.Stock_Optimo_Local||0}" style="width:70px"
          onchange="_lotesTemp[${i}].Stock_Optimo_Local=this.value"
          oninput="_lotesTemp[${i}].Stock_Optimo_Local=this.value">
      </div>
    </div>`;
  }).join('');
}

function _toggleLoteAuto(i, checked) {
  _lotesTemp[i].Gestion_Auto = checked;
  const camposEl = document.getElementById(`lote-campos-${i}`);
  if (camposEl) camposEl.style.display = checked ? 'flex' : 'none';
  // Limpiar mín/ópt si se desactiva
  if (!checked) {
    _lotesTemp[i].Stock_Minimo_Local = '0';
    _lotesTemp[i].Stock_Optimo_Local = '0';
  }
}

function _eliminarLoteTemp(i) { _lotesTemp.splice(i, 1); renderLotesModal(); }

function seleccionarUbicacionMatLote(id, label) {
  if (_lotesTemp.some(l => l.ID_Ubicacion === id)) {
    showToast('Esta ubicación ya está añadida', 'error');
    document.getElementById('mat-ubicacion-autocomplete').classList.remove('open');
    document.getElementById('mat-ubicacion-search').value = '';
    return;
  }
  _lotesTemp.push({ ID_Ubicacion: id, Stock_Local: '0', Stock_Minimo_Local: '0', Stock_Optimo_Local: '0', Gestion_Auto: true, _nuevo: true });
  document.getElementById('mat-ubicacion').value = id;
  document.getElementById('mat-ubicacion-search').value = '';
  document.getElementById('mat-ubicacion-autocomplete').classList.remove('open');
  renderLotesModal();
}

// ============================================================
// MODALES MATERIAL
// ============================================================
function openModalMaterial() {
  editingRow = null; _lotesTemp = [];
  document.getElementById('modal-material-title').textContent = 'Nuevo material';
  const matIdField = document.getElementById('mat-id'); if (matIdField) matIdField.readOnly = false;
  ['mat-id','mat-nombre','mat-unidad','mat-ubicacion','mat-referencia','mat-observaciones','mat-ubicacion-search'].forEach(id => sv(id, ''));
  sv('mat-categoria', ''); sv('mat-stock', '0'); sv('mat-minimo', '0'); sv('mat-optimo', '0'); sv('mat-proveedor', '');
  clearUbicacionMat();
  const sel = document.getElementById('mat-proveedor');
  if (sel) sel.innerHTML = '<option value="">Seleccionar...</option>' + DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">${p.Nombre_Proveedor}</option>`).join('');
  renderLotesModal();
  const btnElimMat = document.getElementById('btn-eliminar-material');
  if (btnElimMat) btnElimMat.style.display = 'none';
  openModal('modal-material');
}

function openModalMaterialCatalogacion(nombreSugerido, unidadSugerida) {
  openModalMaterial();
  if (nombreSugerido) {
    const nombreLimpio = nombreSugerido.replace(/\s*\[.*?\]\s*$/, '').trim();
    sv('mat-nombre', nombreLimpio);
    autoIdMaterial(nombreLimpio);
  }
  if (unidadSugerida) sv('mat-unidad', unidadSugerida);
}

function editMaterial(idx) {
  const m = DATA.material[idx];
  editingRow = { sheet: 'Material', rowIndex: idx };
  _lotesTemp = getMatUbics(m.ID_Material).map((l, li) => ({
    ID_Ubicacion: l.ID_Ubicacion,
    Stock_Local: l.Stock_Local,
    Stock_Minimo_Local: l.Stock_Minimo_Local,
    Stock_Optimo_Local: l.Stock_Optimo_Local,
    Unidad_Lote: l.Unidad_Lote || '',
    ID_Lote_Padre: l.ID_Lote_Padre || '',
    _loteId: l.ID,
    Gestion_Auto: (parseFloat(l.Stock_Minimo_Local) > 0 || parseFloat(l.Stock_Optimo_Local) > 0),
    _nuevo: false,
    _loteIdx: DATA.materialUbicaciones.indexOf(l)
  }));
  // Si no tiene lotes pero sí Ubicacion legacy, pre-poblar para no perderla al añadir una segunda.
  // Se marca _esPrepoblado para NO crear el lote si el usuario no añade una segunda ubicación.
  if (_lotesTemp.length === 0 && m.Ubicacion) {
    _lotesTemp.push({
      ID_Ubicacion: m.Ubicacion,
      Stock_Local: m.Stock_Actual || '0',
      Stock_Minimo_Local: m.Stock_Minimo || '0',
      Stock_Optimo_Local: m.Stock_Optimo || '0',
      Gestion_Auto: m.Gestion_Automatica !== 'FALSE',
      _nuevo: true,
      _esPrepoblado: true
    });
  }
  document.getElementById('modal-material-title').textContent = 'Editar material';
  sv('mat-id', m.ID_Material); sv('mat-nombre', m.Nombre); sv('mat-categoria', m.Categoria);
  const matIdField = document.getElementById('mat-id'); if (matIdField) matIdField.readOnly = true;
  sv('mat-referencia', m.Referencia_Proveedor); sv('mat-unidad', m.Unidad);
  sv('mat-ubicacion', m.Ubicacion);
  sv('mat-stock', m.Stock_Actual); sv('mat-minimo', m.Stock_Minimo); sv('mat-optimo', m.Stock_Optimo);
  sv('mat-observaciones', m.Observaciones);
  if (m.Ubicacion) {
    document.getElementById('mat-ubicacion').value = m.Ubicacion;
  }
  clearUbicacionMat();
  sv('mat-ubicacion-search', '');
  const sel = document.getElementById('mat-proveedor');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar...</option>' + DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">${p.Nombre_Proveedor}</option>`).join('');
    sel.value = m.Proveedor;
  }
  const gestionAutoChk = document.getElementById('mat-gestion-auto');
  if (gestionAutoChk) {
    const esAuto = m.Gestion_Automatica !== 'FALSE';
    gestionAutoChk.checked = esAuto;
    toggleGestionAutoStock(esAuto);
  }
  renderLotesModal();
  const btnElimEdit = document.getElementById('btn-eliminar-material');
  if (btnElimEdit) btnElimEdit.style.display = puedeHacer('eliminarItems') ? '' : 'none';
  openModal('modal-material');
}

async function eliminarMaterial() {
  const m = DATA.material[editingRow.rowIndex];
  if (!confirm(`¿Eliminar "${m.Nombre}" del inventario? Esta acción no se puede deshacer.`)) return;
  showLoading('Eliminando...');
  try {
    // Los lotes de Material_Ubicaciones caen en cascada (FK on delete cascade).
    await callEdgeFunction('gestionar-material', { accion: 'eliminar', id_material: m.ID_Material });
    DATA.materialUbicaciones = DATA.materialUbicaciones.filter(l => l.ID_Material !== m.ID_Material);
    DATA.material.splice(editingRow.rowIndex, 1);
    closeModal('modal-material');
    editingRow = null;
    renderMaterial(); renderDashboard(); updateBadges();
    showToast(`"${m.Nombre}" eliminado del inventario`, 'success');
  } catch(e) {
    showToast('Error al eliminar. Comprueba la consola.', 'error');
    console.error(e);
  }
  hideLoading();
}

// ============================================================
// ABRIR MODAL SOLICITUD CON MATERIAL PRE-CARGADO
// ============================================================
function openModalSolicitudMaterial(matId) {
  // Abrir modal de solicitud con el material ya fijado, sin mostrar el buscador
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) { openModalSolicitud(); return; }

  openModalSolicitud();
  setTimeout(() => {
    // Ocultar completamente ambas pestañas de fuente — el material ya está fijado
    const toggleSrc = document.querySelector('#modal-solicitud .toggle-source');
    if (toggleSrc) toggleSrc.style.display = 'none';
    const catGrp = document.getElementById('sol-catalogo-group');
    if (catGrp) catGrp.style.display = 'none';
    const nuevoGrp = document.getElementById('sol-nuevo-group');
    if (nuevoGrp) nuevoGrp.style.display = 'none';
    const unidadGrp = document.getElementById('sol-unidad-group');
    if (unidadGrp) unidadGrp.style.display = 'none';

    // Mostrar el material como seleccionado
    const hidden = document.getElementById('sol-material-id');
    if (hidden) hidden.value = matId;
    const sel = document.getElementById('sol-material-selected');
    if (sel) {
      sel.innerHTML = '<strong>' + mat.Nombre + '</strong> · Stock actual: ' + getStockTotal(mat) + ' ' + (mat.Unidad || '');
      sel.style.display = 'block';
    }
  }, 50);
}

// ============================================================
// MODALES CONSUMO / ENTRADA
// ============================================================
function openModalConsumo() {
  document.getElementById('consumo-material-id').value = '';
  document.getElementById('consumo-material-selected').style.display = 'none';
  document.getElementById('consumo-material-selected').textContent = '';
  document.getElementById('consumo-search').value = '';
  const grp = document.getElementById('consumo-search-group');
  if (grp) grp.style.display = '';
  sv('consumo-cantidad', ''); sv('consumo-motivo', ''); sv('consumo-obs', '');
  const ubiGrp = document.getElementById('consumo-ubicacion-group');
  if (ubiGrp) ubiGrp.style.display = 'none';
  // Limpiar bote fijo (puede venir de openModalConsumoLote anterior)
  const fixedInput = document.getElementById('consumo-lote-fixed');
  if (fixedInput) fixedInput.value = '';
  openModal('modal-consumo');
}

function openModalConsumoMaterial(matId) {
  openModalConsumo();
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) return;
  document.getElementById('consumo-material-id').value = matId;
  const grp = document.getElementById('consumo-search-group');
  if (grp) grp.style.display = 'none';
  const stock = getStockTotal(mat);
  const sel = document.getElementById('consumo-material-selected');
  sel.textContent = mat.Nombre + ' · Stock actual: ' + stock + ' ' + (mat.Unidad || '');
  sel.style.display = 'block';
  _mostrarSelectorUbicConsumo(matId);
}

function openModalConsumoLote(loteId) {
  const lote = DATA.materialUbicaciones.find(l => l.ID === loteId);
  if (!lote) return;
  openModalConsumoMaterial(lote.ID_Material);
  // Guardar el LOTE fijo en un input hidden dedicado (no la ubicación: puede
  // haber más de un bote en la misma ubicación, p.ej. madre + alícuotas)
  let fixedInput = document.getElementById('consumo-lote-fixed');
  if (!fixedInput) {
    fixedInput = document.createElement('input');
    fixedInput.type = 'hidden';
    fixedInput.id = 'consumo-lote-fixed';
    document.getElementById('modal-consumo').appendChild(fixedInput);
  }
  fixedInput.value = loteId;
  // Ocultar el selector — el bote ya está fijado
  const ubiGrp = document.getElementById('consumo-ubicacion-group');
  if (ubiGrp) ubiGrp.style.display = 'none';
}

function _mostrarSelectorUbicConsumo(matId) {
  const ubiGrp = document.getElementById('consumo-ubicacion-group');
  if (!ubiGrp) return;
  let lotes = getMatUbics(matId);

  // Alumno: filtrar a sus ubicaciones asignadas + zona común
  if (getUserRole() === 'Alumno') {
    const permitidas = getUbicacionesAlumno();
    lotes = lotes.filter(l => permitidas.includes(l.ID_Ubicacion));
    if (!lotes.length) {
      showToast('Este material no está disponible en tus ubicaciones asignadas', 'error');
      const sel = document.getElementById('consumo-ubicacion-sel');
      if (sel) sel.innerHTML = '<option value="">No disponible en tus ubicaciones</option>';
      ubiGrp.style.display = '';
      return;
    }
  }

  if (lotes.length <= 1) {
    // Pre-seleccionar silenciosamente si hay exactamente 1 lote
    const sel = document.getElementById('consumo-ubicacion-sel');
    if (sel && lotes.length === 1) {
      sel.innerHTML = `<option value="${lotes[0].ID}">${getNombreUbicacion(lotes[0].ID_Ubicacion)}</option>`;
    }
    ubiGrp.style.display = 'none';
    return;
  }
  const mat = DATA.material.find(m => m.ID_Material === matId);
  const sel = document.getElementById('consumo-ubicacion-sel');
  if (sel) {
    sel.innerHTML = lotes.map(l => {
      const s = parseFloat(l.Stock_Local) || 0;
      const u = l.Unidad_Lote || mat?.Unidad || '';
      return `<option value="${l.ID}">${getNombreUbicacion(l.ID_Ubicacion)} (stock: ${s} ${u})</option>`;
    }).join('');
  }
  ubiGrp.style.display = '';
}

function openModalEntrada() {
  document.getElementById('entrada-material-id').value = '';
  document.getElementById('entrada-material-selected').style.display = 'none';
  document.getElementById('entrada-material-selected').textContent = '';
  document.getElementById('entrada-search').value = '';
  sv('entrada-cantidad', ''); sv('entrada-obs', '');
  const ubiGrp = document.getElementById('entrada-ubicacion-group');
  if (ubiGrp) ubiGrp.style.display = 'none';
  // Limpiar bote fijo (puede venir de openModalEntradaLote anterior)
  const fixedInput = document.getElementById('entrada-lote-fixed');
  if (fixedInput) fixedInput.value = '';
  openModal('modal-entrada');
}

function openModalEntradaMaterial(matId) {
  openModalEntrada();
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) return;
  document.getElementById('entrada-material-id').value = matId;
  const sel = document.getElementById('entrada-material-selected');
  sel.textContent = mat.Nombre;
  sel.style.display = 'block';
  _mostrarSelectorUbicEntrada(matId);
}

function openModalEntradaLote(loteId) {
  const lote = DATA.materialUbicaciones.find(l => l.ID === loteId);
  if (!lote) return;
  openModalEntradaMaterial(lote.ID_Material);
  // Bote fijo (no ubicación: puede haber más de un bote en la misma ubicación)
  let fixedInput = document.getElementById('entrada-lote-fixed');
  if (!fixedInput) {
    fixedInput = document.createElement('input');
    fixedInput.type = 'hidden';
    fixedInput.id = 'entrada-lote-fixed';
    document.getElementById('modal-entrada').appendChild(fixedInput);
  }
  fixedInput.value = loteId;
  const ubiGrp = document.getElementById('entrada-ubicacion-group');
  if (ubiGrp) ubiGrp.style.display = 'none';
}

function _mostrarSelectorUbicEntrada(matId) {
  const ubiGrp = document.getElementById('entrada-ubicacion-group');
  if (!ubiGrp) return;
  const lotes = getMatUbics(matId);
  if (lotes.length <= 1) {
    const sel = document.getElementById('entrada-ubicacion-sel');
    if (sel && lotes.length === 1) {
      sel.innerHTML = `<option value="${lotes[0].ID}">${getNombreUbicacion(lotes[0].ID_Ubicacion)}</option>`;
    }
    ubiGrp.style.display = 'none';
    return;
  }
  const mat = DATA.material.find(m => m.ID_Material === matId);
  const sel = document.getElementById('entrada-ubicacion-sel');
  if (sel) {
    sel.innerHTML = lotes.map(l => {
      const s = parseFloat(l.Stock_Local) || 0;
      const u = l.Unidad_Lote || mat?.Unidad || '';
      return `<option value="${l.ID}">${getNombreUbicacion(l.ID_Ubicacion)} (stock: ${s} ${u})</option>`;
    }).join('');
  }
  ubiGrp.style.display = '';
}

// ============================================================
// GUARDAR MATERIAL (con lotes)
// ============================================================
function autoIdMaterial(nombre) {
  const idField = document.getElementById('mat-id'); if (!idField) return;
  const currentVal = idField.value;
  const autoPattern = /^[A-Z]{2,3}-\d{2,}$/;
  if (currentVal && !autoPattern.test(currentVal)) return;
  idField.value = generarIdMaterial(nombre);
}

function generarIdMaterial(nombre) {
  if (!nombre) return '';
  const stopWords = ['de','del','la','las','los','el','en','y','a','con','para','por'];
  const palabras = nombre.split(/\s+/).filter(p => p.length > 1 && !stopWords.includes(p.toLowerCase()));
  let prefix = '';
  if (palabras.length >= 2)       prefix = (palabras[0].slice(0, 2) + palabras[1].slice(0, 1)).toUpperCase();
  else if (palabras.length === 1) prefix = palabras[0].slice(0, 3).toUpperCase();
  else                            prefix = nombre.slice(0, 3).toUpperCase();
  const existing = DATA.material.map(m => m.ID_Material).filter(id => id.startsWith(prefix + '-')).map(id => parseInt(id.split('-')[1]) || 0);
  const nextNum  = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return prefix + '-' + String(nextNum).padStart(2, '0');
}

async function guardarMaterial() {
  const nombre = v('mat-nombre'), cat = v('mat-categoria'), unidad = v('mat-unidad');
  if (!nombre || !cat || !unidad) { showToast('Nombre, categoría y unidad son obligatorios', 'error'); return; }
  const id = (editingRow && editingRow.sheet === 'Material') ? v('mat-id') : generarIdMaterial(nombre);
  const gestionAuto = document.getElementById('mat-gestion-auto') ? document.getElementById('mat-gestion-auto').checked : true;

  const stockGlobal = _lotesTemp.length
    ? String(_lotesTemp.reduce((s, l) => s + (parseFloat(l.Stock_Local) || 0), 0))
    : (v('mat-stock') || '0');
  const minStock = _lotesTemp.length
    ? String(_lotesTemp.reduce((s, l) => s + (parseFloat(l.Stock_Minimo_Local) || 0), 0))
    : (gestionAuto ? (v('mat-minimo') || '0') : '0');
  const optStock = _lotesTemp.length
    ? String(_lotesTemp.reduce((s, l) => s + (parseFloat(l.Stock_Optimo_Local) || 0), 0))
    : (gestionAuto ? (v('mat-optimo') || '0') : '0');

  const ubicPrincipal = _lotesTemp.length ? _lotesTemp[0].ID_Ubicacion : v('mat-ubicacion');

  const lotesBody = _lotesTemp
    .filter(l => !(l._esPrepoblado && !_lotesTemp.some(x => x._nuevo && !x._esPrepoblado)))
    .map(l => ({
      id: l._nuevo ? undefined : l._loteId,
      id_ubicacion: l.ID_Ubicacion, stock_local: l.Stock_Local,
      stock_minimo_local: l.Stock_Minimo_Local, stock_optimo_local: l.Stock_Optimo_Local,
      unidad_lote: (l.Unidad_Lote || '').trim(),
    }));

  showLoading('Guardando...');
  try {
    const esEdicion = editingRow && editingRow.sheet === 'Material';
    if (!esEdicion && DATA.material.find(m => m.ID_Material === id)) { showToast('Ese ID ya existe', 'error'); hideLoading(); return; }

    const { material, lotes } = await callEdgeFunction('gestionar-material', {
      accion: esEdicion ? 'actualizar' : 'crear', id_material: id, nombre, categoria: cat,
      referencia_proveedor: v('mat-referencia'), proveedor: v('mat-proveedor'), unidad, ubicacion: ubicPrincipal,
      stock_actual: stockGlobal, stock_minimo: minStock, stock_optimo: optStock,
      observaciones: v('mat-observaciones'), gestion_automatica: gestionAuto, lotes: lotesBody,
    });

    if (esEdicion) DATA.material[editingRow.rowIndex] = _materialSbToObj(material);
    else DATA.material.push(_materialSbToObj(material));
    for (const l of lotes) {
      const idx = DATA.materialUbicaciones.findIndex(x => x.ID === l.id);
      if (idx !== -1) DATA.materialUbicaciones[idx] = _materialUbicacionSbToObj(l);
      else DATA.materialUbicaciones.push(_materialUbicacionSbToObj(l));
    }

    showToast(editingRow ? 'Material actualizado' : 'Material guardado', 'success');
    const aviso = document.getElementById('aviso-recepcion-pendiente');
    if (aviso) aviso.remove();
    closeModal('modal-material'); editingRow = null; _lotesTemp = [];

    if (_pendingRecepcion) {
      const { lineaId, pedidoId, cantRec, obs } = _pendingRecepcion;
      _pendingRecepcion = null;
      const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
      const mat = l && DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
      if (mat) { showToast('Material catalogado. Registrando recepción...', 'success'); await _completarRecepcionLinea(lineaId, pedidoId, cantRec, obs); }
    } else {
      renderAll();
    }
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// GUARDAR CONSUMO / ENTRADA
// ============================================================
async function guardarConsumo() {
  const matId   = document.getElementById('consumo-material-id').value;
  const cantStr = v('consumo-cantidad');
  if (!matId)  { showToast('Selecciona un material', 'error'); return; }
  if (!cantStr || parseFloat(cantStr) <= 0) { showToast('Introduce una cantidad válida', 'error'); return; }
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) { showToast('Material no encontrado', 'error'); return; }
  const cantidad = parseFloat(cantStr);
  const lotes    = getMatUbics(matId);
  // Primero: bote fijo (viene de openModalConsumoLote). Si no, el del selector. Ambos son ID de lote, no de ubicación.
  const loteFijo = document.getElementById('consumo-lote-fixed')?.value || '';
  const loteSel  = loteFijo || document.getElementById('consumo-ubicacion-sel')?.value || '';
  const loteElegido = loteSel ? DATA.materialUbicaciones.find(l => l.ID === loteSel) : null;

  // Alumno: validar que la ubicación del bote elegido sea de las permitidas
  if (getUserRole() === 'Alumno') {
    const permitidas = getUbicacionesAlumno();
    if (lotes.length > 0 && !loteElegido) {
      showToast('Selecciona una ubicación', 'error'); return;
    }
    if (loteElegido && !permitidas.includes(loteElegido.ID_Ubicacion)) {
      showToast('No tienes permiso para consumir de esa ubicación', 'error'); return;
    }
  }

  showLoading('Registrando...');
  try {
    await callEdgeFunction('gestionar-material', {
      accion: 'consumo', id_material: matId, cantidad, lote_id: loteElegido?.ID || undefined,
      motivo: v('consumo-motivo') || 'Consumo', observaciones: v('consumo-obs'), usuario: currentUser?.name || 'Usuario',
    });
    await loadAllData();
    const matFinal = DATA.material.find(m => m.ID_Material === matId);
    showToast(`Consumo registrado. Stock: ${getStockTotal(matFinal)} ${matFinal?.Unidad || ''}`, 'success');
    closeModal('modal-consumo'); renderAll();
  } catch(e) { showToast('Error registrando consumo', 'error'); console.error(e); }
  hideLoading();
}

async function guardarEntrada() {
  const matId   = document.getElementById('entrada-material-id').value;
  const cantStr = v('entrada-cantidad');
  if (!matId)  { showToast('Selecciona un material', 'error'); return; }
  if (!cantStr || parseFloat(cantStr) <= 0) { showToast('Introduce una cantidad válida', 'error'); return; }
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) { showToast('Material no encontrado', 'error'); return; }
  const cantidad = parseFloat(cantStr);
  // Bote fijo (viene de openModalEntradaLote). Si no, el del selector. Ambos son ID de lote, no de ubicación.
  const loteFijo = document.getElementById('entrada-lote-fixed')?.value || '';
  const loteSel  = loteFijo || document.getElementById('entrada-ubicacion-sel')?.value || '';

  showLoading('Registrando...');
  try {
    await callEdgeFunction('gestionar-material', {
      accion: 'entrada', id_material: matId, cantidad, lote_id: loteSel || undefined,
      motivo: v('entrada-motivo'), observaciones: v('entrada-obs'), usuario: currentUser?.name || 'Usuario',
    });
    await loadAllData();
    const matFinal = DATA.material.find(m => m.ID_Material === matId);
    showToast(`Entrada registrada. Stock: ${getStockTotal(matFinal)} ${matFinal?.Unidad || ''}`, 'success');
    closeModal('modal-entrada'); renderAll();
  } catch(e) { showToast('Error registrando entrada', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// GESTIÓN AUTOMÁTICA DE STOCK
// ============================================================
// toggleGestionAutoStock eliminado — gestión por lote

// ============================================================
// TRANSFERENCIA DESDE ARMARIO — modal NFC
// ============================================================
function openModalTransferenciaArmario(ubicacionId) {
  const ubi = DATA.ubicaciones.find(u => u.ID_Ubicacion === ubicacionId);
  if (!ubi) { showToast(`Armario "${ubicacionId}" no encontrado en la base de datos`, 'error'); return; }
  sv('nfc-transfer-origen-id', ubicacionId);
  document.getElementById('nfc-transfer-nombre-ubi').textContent = getNombreUbicacion(ubicacionId);
  const itemsLote = DATA.materialUbicaciones
    .filter(l => l.ID_Ubicacion === ubicacionId && (parseFloat(l.Stock_Local) || 0) > 0)
    .map(l => {
      const mat = DATA.material.find(m => m.ID_Material === l.ID_Material);
      return mat ? { mat, stockOrigen: parseFloat(l.Stock_Local) || 0, isLote: true } : null;
    }).filter(Boolean);
  const idsConLote = new Set(itemsLote.map(i => i.mat.ID_Material));
  const itemsSingle = DATA.material
    .filter(m => m.Ubicacion === ubicacionId && !idsConLote.has(m.ID_Material) &&
      getMatUbics(m.ID_Material).length === 0 && (parseFloat(m.Stock_Actual) || 0) > 0)
    .map(m => ({ mat: m, stockOrigen: parseFloat(m.Stock_Actual) || 0, isLote: false }));
  const todos = [...itemsLote, ...itemsSingle];
  const container = document.getElementById('nfc-transfer-items');
  if (!todos.length) {
    container.innerHTML = `<div style="text-align:center;padding:28px 16px;color:var(--text-muted);font-size:13px">
      🈳 Este armario no tiene material con stock disponible en este momento.</div>`;
  } else {
    container.innerHTML = todos.map(({ mat, stockOrigen, isLote }) => `
      <div class="nfc-item-row"
           data-mat-id="${mat.ID_Material}" data-is-lote="${isLote}" data-stock-origen="${stockOrigen}"
           style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div style="flex:1;min-width:130px">
          <div style="font-size:13px;font-weight:500;line-height:1.3">${mat.Nombre}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
            <span class="badge badge-gray" style="font-size:10px">${mat.Categoria || '—'}</span>&nbsp;
            Disponible: <strong>${stockOrigen}</strong> ${mat.Unidad || ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <input type="number" class="nfc-item-cant"
                 min="0" max="${stockOrigen}" step="1" value="0"
                 style="width:72px;font-size:15px;padding:6px 8px;text-align:center;border-radius:var(--radius-sm);border:1px solid var(--border)"
                 oninput="_validarCantNfc(this,${stockOrigen})">
          <span style="font-size:12px;color:var(--text-muted);min-width:32px">${mat.Unidad || ''}</span>
        </div>
      </div>`).join('');
  }
  const selDest = document.getElementById('nfc-transfer-destino');
  selDest.innerHTML = '<option value="">Seleccionar destino...</option>' +
    DATA.ubicaciones
      .filter(u => u.Activa !== 'FALSE' && u.ID_Ubicacion !== ubicacionId)
      .map(u => `<option value="${u.ID_Ubicacion}">${getNombreUbicacion(u.ID_Ubicacion)}</option>`)
      .join('');
  openModal('modal-nfc-transfer');
}

function _validarCantNfc(input, max) {
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) { input.value = 0; return; }
  if (val > max) input.value = max;
}

async function confirmarTransferenciaArmario() {
  const destino = v('nfc-transfer-destino');
  if (!destino) { showToast('Selecciona el destino', 'error'); return; }
  const origen = document.getElementById('nfc-transfer-origen-id').value;
  const items = [];
  document.querySelectorAll('#nfc-transfer-items .nfc-item-row').forEach(row => {
    const cant = parseFloat(row.querySelector('.nfc-item-cant').value) || 0;
    if (cant <= 0) return;
    const stockOrigen = parseFloat(row.dataset.stockOrigen) || 0;
    if (cant > stockOrigen) return;
    items.push({ matId: row.dataset.matId, cant, isLote: row.dataset.isLote === 'true', stockOrigen });
  });
  if (!items.length) { showToast('Introduce la cantidad de al menos un material', 'error'); return; }
  showLoading('Trasladando...');
  try {
    const { procesados } = await callEdgeFunction('gestionar-material', {
      accion: 'transferencia_masiva', id_origen_ubicacion: origen, id_destino_ubicacion: destino,
      usuario: currentUser?.name || 'Usuario',
      items: items.map(item => ({ id_material: item.matId, cantidad: item.cant, es_lote: item.isLote })),
    });
    await loadAllData();
    showToast(`${procesados} ítem${procesados>1?'s':''} trasladado${procesados>1?'s':''} → ${getNombreUbicacion(destino)}`, 'success');
    closeModal('modal-nfc-transfer');
    renderMaterial(); renderDashboard(); updateBadges();
  } catch(e) { showToast('Error en el traslado. Revisa la consola.', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// TRASLADO entre ubicaciones (zona común → laboratorio y viceversa)
// ============================================================
function openModalTrasladoLote(loteId) {
  const loteOrigen = DATA.materialUbicaciones.find(l => l.ID === loteId);
  if (!loteOrigen) return;
  const matId = loteOrigen.ID_Material;
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) return;
  sv('traslado-mat-id', matId);
  sv('traslado-lote-origen-id', loteId);
  sv('traslado-origen', loteOrigen.ID_Ubicacion);
  sv('traslado-cantidad', '');
  document.getElementById('traslado-mat-nombre').textContent = mat.Nombre;
  document.getElementById('traslado-stock-origen').textContent =
    (parseFloat(loteOrigen.Stock_Local) || 0) + ' ' + (loteOrigen.Unidad_Lote || mat.Unidad || '');
  document.getElementById('traslado-origen-label').textContent = getNombreUbicacion(loteOrigen.ID_Ubicacion);

  const selDest  = document.getElementById('traslado-destino');
  const destGrp  = document.getElementById('traslado-destino-group');
  const fijoGrp  = document.getElementById('traslado-destino-fijo-group');
  const fijoLbl  = document.getElementById('traslado-destino-fijo-label');
  const madre    = loteOrigen.ID_Lote_Padre ? DATA.materialUbicaciones.find(l => l.ID === loteOrigen.ID_Lote_Padre) : null;

  if (madre) {
    // Bote hija: el destino siempre es el bote madre — se apunta por su ID
    // (no por ubicación: si hija y madre viven en el mismo sitio, buscar por
    // ubicación sería ambiguo entre las dos).
    sv('traslado-destino-lote-id', madre.ID);
    selDest.innerHTML = `<option value="${madre.ID_Ubicacion}" selected>${getNombreUbicacion(madre.ID_Ubicacion)}</option>`;
    fijoLbl.textContent = getNombreUbicacion(madre.ID_Ubicacion);
    if (destGrp) destGrp.style.display = 'none';
    if (fijoGrp) fijoGrp.style.display = '';
  } else {
    // Bote madre o ítem sin subdividir: destino libre, como hasta ahora
    sv('traslado-destino-lote-id', '');
    selDest.innerHTML = '<option value="">Seleccionar destino...</option>' +
      DATA.ubicaciones
        .filter(u => u.Activa !== 'FALSE' && u.ID_Ubicacion !== loteOrigen.ID_Ubicacion)
        .map(u => `<option value="${u.ID_Ubicacion}">${getNombreUbicacion(u.ID_Ubicacion)}</option>`)
        .join('');
    if (destGrp) destGrp.style.display = '';
    if (fijoGrp) fijoGrp.style.display = 'none';
  }
  openModal('modal-traslado');
}

async function guardarTraslado() {
  const matId          = v('traslado-mat-id');
  const loteOrigenId   = v('traslado-lote-origen-id');
  const idDestino      = v('traslado-destino');
  const cant           = parseFloat(v('traslado-cantidad'));
  if (!idDestino) { showToast('Selecciona el destino', 'error'); return; }
  if (!cant || cant <= 0) { showToast('Indica una cantidad válida', 'error'); return; }
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) return;
  const loteOrigenIdx  = DATA.materialUbicaciones.findIndex(l => l.ID === loteOrigenId);
  if (loteOrigenIdx === -1) { showToast('Error: bote de origen no encontrado', 'error'); return; }
  const idOrigen = DATA.materialUbicaciones[loteOrigenIdx].ID_Ubicacion;
  const unidadOrigen = DATA.materialUbicaciones[loteOrigenIdx].Unidad_Lote || mat.Unidad || '';
  const stockOrigen = parseFloat(DATA.materialUbicaciones[loteOrigenIdx].Stock_Local) || 0;
  if (cant > stockOrigen) { showToast(`Stock insuficiente en origen (${stockOrigen} ${unidadOrigen})`, 'error'); return; }
  showLoading('Trasladando...');
  try {
    // Si el destino es un bote concreto (vuelta a la madre), se apunta por ID — sin ambigüedad
    // aunque comparta ubicación con el origen. Si no, se busca/crea por ubicación server-side.
    const destinoLoteId = v('traslado-destino-lote-id');
    await callEdgeFunction('gestionar-material', {
      accion: 'traslado', id_material: matId, lote_origen_id: loteOrigenId, cantidad: cant,
      lote_destino_id: destinoLoteId || undefined, id_destino_ubicacion: destinoLoteId ? undefined : idDestino,
      motivo: `De: ${getNombreUbicacion(idOrigen)} → ${getNombreUbicacion(idDestino)}`, usuario: currentUser?.name || 'Usuario',
    });
    await loadAllData();
    showToast(`Traslado registrado: ${cant} ${unidadOrigen} → ${getNombreUbicacion(idDestino)}`, 'success');
    closeModal('modal-traslado'); renderMaterial();
    renderDashboard();
    updateBadges();
  } catch(e) { showToast('Error en el traslado', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// MIGRAR ÍTEM LEGACY A LOTE (bajo demanda, desde 🔀/✂️ en la sub-fila legacy)
// ============================================================
// Un ítem "legacy" (sin filas en Material_Ubicaciones, solo la col Ubicacion de Material)
// no tiene ningún lote sobre el que trasladar/subdividir. Al usar esas acciones se crea
// el lote reflejando exactamente lo que ya había (misma ubicación, mismo stock/mín/óptimo),
// y a partir de ahí el ítem pasa a funcionar en modo lote como cualquier otro.
async function _asegurarLoteLegacy(matId) {
  const lotesExistentes = getMatUbics(matId);
  if (lotesExistentes.length > 0) return lotesExistentes[0].ID;
  showLoading('Preparando...');
  let lote;
  try {
    const { lote: loteCreado } = await callEdgeFunction('gestionar-material', { accion: 'asegurar_lote_legacy', id_material: matId });
    lote = _materialUbicacionSbToObj(loteCreado);
    if (!DATA.materialUbicaciones.some(l => l.ID === lote.ID)) DATA.materialUbicaciones.push(lote);
  } catch(e) { hideLoading(); showToast(e.message || 'Error al preparar el ítem', 'error'); console.error(e); return null; }
  hideLoading();
  return lote.ID;
}

async function subdividirDesdeLegacy(matId) {
  const loteId = await _asegurarLoteLegacy(matId);
  if (loteId) openModalSubdividirLote(loteId);
}

async function trasladarDesdeLegacy(matId) {
  const loteId = await _asegurarLoteLegacy(matId);
  if (loteId) openModalTrasladoLote(loteId);
}

// ============================================================
// SUBDIVIDIR LOTE — bote madre repartido en botes de uso
// ============================================================
let _subdivTemp = [];

function openModalSubdividirLote(loteId) {
  const loteOrigen = DATA.materialUbicaciones.find(l => l.ID === loteId);
  if (!loteOrigen) return;
  const matId = loteOrigen.ID_Material;
  const mat = DATA.material.find(m => m.ID_Material === matId);
  if (!mat) return;
  sv('subdiv-mat-id', matId);
  sv('subdiv-origen-ubicacion', loteOrigen.ID_Ubicacion);
  sv('subdiv-lote-origen-id', loteOrigen.ID);
  document.getElementById('subdiv-mat-nombre').textContent = mat.Nombre;
  document.getElementById('subdiv-origen-label').textContent = getNombreUbicacion(loteOrigen.ID_Ubicacion);
  document.getElementById('subdiv-stock-origen').textContent = (parseFloat(loteOrigen.Stock_Local) || 0) + ' ' + (loteOrigen.Unidad_Lote || mat.Unidad || '');
  _subdivTemp = [{ idUbicacion: '', cantidad: '', unidad: '', stockMin: '', stockOpt: '' }];
  renderSubdivModal();
  openModal('modal-subdividir-lote');
}

function renderSubdivModal() {
  const cont = document.getElementById('subdiv-filas');
  cont.innerHTML = _subdivTemp.map((f, i) => `
    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px">
      <div style="margin-bottom:8px">
        ${f.idUbicacion ? `
          <div style="padding:6px 10px;background:var(--accent-light);border-radius:var(--radius-sm);font-size:12px;color:var(--accent);display:flex;align-items:center;justify-content:space-between">
            <span>📍 ${getNombreUbicacion(f.idUbicacion)}</span>
            <span style="cursor:pointer;color:var(--text-muted)" onclick="limpiarDestinoSubdiv(${i})">✕</span>
          </div>` : `
          <div class="search-material-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Buscar ubicación..." autocomplete="off" oninput="buscarDestinoSubdiv(${i}, this.value)">
            <div class="autocomplete-list" id="subdiv-destino-autocomplete-${i}"></div>
          </div>`}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="number" min="0" step="0.01" placeholder="Cantidad" value="${f.cantidad}"
          style="width:90px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          oninput="_subdivTemp[${i}].cantidad=this.value">
        <input type="text" placeholder="Unidad (goteros...)" value="${f.unidad}"
          style="width:120px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          oninput="_subdivTemp[${i}].unidad=this.value">
        <input type="number" min="0" step="0.01" placeholder="Mínimo" value="${f.stockMin}"
          style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          oninput="_subdivTemp[${i}].stockMin=this.value">
        <input type="number" min="0" step="0.01" placeholder="Óptimo" value="${f.stockOpt}"
          style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          oninput="_subdivTemp[${i}].stockOpt=this.value">
        <button class="icon-btn" onclick="_subdivTemp.splice(${i},1);renderSubdivModal()" title="Quitar destino" style="margin-left:auto">🗑️</button>
      </div>
    </div>`).join('');
}

function buscarDestinoSubdiv(i, query) {
  const list = document.getElementById('subdiv-destino-autocomplete-' + i);
  if (!list) return;
  if (!query || query.length < 1) { list.classList.remove('open'); return; }
  // Sin excluir la ubicación de origen: el bote de uso puede guardarse en el mismo sitio
  // que la madre (caso habitual — alícuotas guardadas junto al bote grande).
  const q = query.toLowerCase();
  const resultados = DATA.ubicaciones.filter(u =>
    u.Activa !== 'FALSE' &&
    (u.ID_Ubicacion.toLowerCase().includes(q) ||
     (u.Laboratorio_Aula || '').toLowerCase().includes(q) ||
     (u.Zona || '').toLowerCase().includes(q) ||
     (u.Subzona || '').toLowerCase().includes(q))
  ).slice(0, 8);
  if (!resultados.length) { list.classList.remove('open'); return; }
  list.innerHTML = resultados.map(u => {
    const label = [u.Laboratorio_Aula, u.Zona, u.Subzona].filter(Boolean).join(' · ');
    return `<div class="autocomplete-item" onclick="seleccionarDestinoSubdiv(${i},'${u.ID_Ubicacion}')">
      <div><div class="autocomplete-item-name">${u.ID_Ubicacion}</div><div class="autocomplete-item-meta">${label}</div></div>
    </div>`;
  }).join('');
  list.classList.add('open');
}

function seleccionarDestinoSubdiv(i, id) {
  if (!_subdivTemp[i]) return;
  _subdivTemp[i].idUbicacion = id;
  renderSubdivModal();
}

function limpiarDestinoSubdiv(i) {
  if (!_subdivTemp[i]) return;
  _subdivTemp[i].idUbicacion = '';
  renderSubdivModal();
}

function _subdivAddFila() { _subdivTemp.push({ idUbicacion: '', cantidad: '', unidad: '', stockMin: '', stockOpt: '' }); renderSubdivModal(); }

async function guardarSubdivision() {
  const matId = v('subdiv-mat-id');
  const loteOrigenId = v('subdiv-lote-origen-id');
  const mat = DATA.material.find(m => m.ID_Material === matId);
  const loteOrigenIdx = DATA.materialUbicaciones.findIndex(l => l.ID === loteOrigenId);
  if (!mat || loteOrigenIdx === -1) return;
  const filas = _subdivTemp.filter(f => f.idUbicacion && parseFloat(f.cantidad) > 0);
  if (!filas.length) { showToast('Añade al menos un destino con cantidad', 'error'); return; }
  const loteOrigen = DATA.materialUbicaciones[loteOrigenIdx];
  const idOrigen = loteOrigen.ID_Ubicacion;
  const unidadOrigen = loteOrigen.Unidad_Lote || mat.Unidad || '';
  const stockOrigen = parseFloat(loteOrigen.Stock_Local) || 0;
  const totalRepartido = filas.reduce((s, f) => s + (parseFloat(f.cantidad) || 0), 0);
  if (totalRepartido > stockOrigen) { showToast(`Stock insuficiente en el bote madre (${stockOrigen} ${unidadOrigen})`, 'error'); return; }
  showLoading('Subdividiendo...');
  try {
    // Siempre se crea un bote nuevo por destino (nunca se fusiona con uno existente): evita
    // elegir a ciegas entre varios botes que pudiera haber ya en esa misma ubicación.
    await callEdgeFunction('gestionar-material', {
      accion: 'subdivision', id_material: matId, lote_origen_id: loteOrigenId, usuario: currentUser?.name || 'Usuario',
      destinos: filas.map(f => ({ id_ubicacion: f.idUbicacion, cantidad: f.cantidad, unidad: f.unidad.trim(), stock_min: f.stockMin, stock_opt: f.stockOpt })),
    });
    await loadAllData();
    showToast(`Repartido en ${filas.length} ubicación${filas.length > 1 ? 'es' : ''}`, 'success');
    closeModal('modal-subdividir-lote');
    renderMaterial(); renderDashboard(); updateBadges();
  } catch(e) { showToast('Error al subdividir', 'error'); console.error(e); }
  hideLoading();
}

async function eliminarLoteDirecto(loteId) {
  const lote = DATA.materialUbicaciones.find(l => l.ID === loteId);
  if (!lote) return;
  const mat = DATA.material.find(m => m.ID_Material === lote.ID_Material);
  const lotes = getMatUbics(lote.ID_Material);
  if (!mat) return;
  const stock = parseFloat(lote.Stock_Local) || 0;
  const unidad = lote.Unidad_Lote || mat.Unidad || '';
  const esMadre = lotes.some(o => o.ID_Lote_Padre === lote.ID);
  let msg = `¿Eliminar el bote de "${getNombreUbicacion(lote.ID_Ubicacion)}"?`;
  if (stock > 0) msg += ` Tiene ${stock} ${unidad} registrado — se perderá del stock total.`;
  if (esMadre) msg += ' Tiene botes de uso subdivididos a partir de él; seguirán existiendo pero perderán la referencia a este bote madre.';
  if (!confirm(msg)) return;
  showLoading('Eliminando...');
  try {
    await callEdgeFunction('gestionar-material', { accion: 'eliminar_lote', lote_id: loteId });
    const idx = DATA.materialUbicaciones.indexOf(lote);
    if (idx !== -1) DATA.materialUbicaciones.splice(idx, 1);
    showToast('Bote eliminado', 'success');
    renderMaterial(); renderDashboard(); updateBadges();
  } catch(e) { showToast('Error al eliminar', 'error'); console.error(e); }
  hideLoading();
}

