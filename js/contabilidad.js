// ============================================================
// CONTABILIDAD — MODAL DE PRECIOS POR LÍNEA
// ============================================================

let _preciosPedidoId  = null;
let _anioContabilidad = new Date().getFullYear();

function abrirModalPrecios(pedidoId) {
  _preciosPedidoId = pedidoId;
  const p      = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  if (!p || !lineas.length) return;

  document.getElementById('modal-precios-titulo').textContent = p.Nombre_Lista;

  const tbody = document.getElementById('precios-tabla-body');
  tbody.innerHTML = lineas.map((l, i) => {
    const hist       = getHistoricoMaterial(l.Material, p.Proveedor);
    const precioAct  = parseFloat(l.Precio_Unitario) || 0;
    const cantNum    = parseFloat(l.Cantidad_Pedida)  || 0;
    const hint = hist.count > 0
      ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">Último: ${hist.ultimoPrecio.toFixed(2)} € · Media: ${hist.media.toFixed(2)} € (${hist.count} registros)</div>`
      : '';
    const warnId = `warn-precio-${i}`;
    return `<tr>
      <td style="font-size:13px;font-weight:500;padding:8px 6px">${l.Material}</td>
      <td style="text-align:center;font-size:13px;padding:8px 6px">${l.Cantidad_Pedida}</td>
      <td style="padding:8px 6px">
        <input type="number" min="0" step="0.01" class="precio-input"
          data-linea-id="${l.ID_Linea}" data-cant="${cantNum}" data-media="${hist.media.toFixed(4)}"
          value="${precioAct > 0 ? precioAct.toFixed(2) : ''}"
          placeholder="${hist.count > 0 ? hist.ultimoPrecio.toFixed(2) : '0.00'}"
          oninput="calcTotalesPrecios(this, ${i})"
          style="width:90px;text-align:right;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px">
        ${hint}
        <div id="${warnId}" style="display:none;font-size:11px;color:var(--warning);font-weight:600;margin-top:2px">⚠️ Precio >10% sobre la media</div>
      </td>
      <td style="text-align:right;font-size:13px;font-weight:500;padding:8px 6px;min-width:80px" id="total-linea-${i}">
        ${precioAct > 0 ? (precioAct * cantNum * 1.21).toFixed(2) + ' \u20AC' : '\u2014'}
      </td>
    </tr>`;
  }).join('');

  calcTotalesPrecios();
  openModal('modal-precios');
}

function calcTotalesPrecios(inputEl, idx) {
  const inputs = document.querySelectorAll('.precio-input');
  let subtotal = 0;
  inputs.forEach((inp, i) => {
    const precio = parseFloat(inp.value) || 0;
    const cant   = parseFloat(inp.dataset.cant) || 0;
    const totalConIVA = precio * cant * 1.21;
    subtotal += precio * cant;
    const el = document.getElementById('total-linea-' + i);
    if (el) el.textContent = totalConIVA > 0 ? totalConIVA.toFixed(2) + ' \u20AC' : '\u2014';
    // Aviso 10% sobre la media
    const warn  = document.getElementById('warn-precio-' + i);
    const media = parseFloat(inp.dataset.media) || 0;
    if (warn) warn.style.display = (media > 0 && precio > media * 1.10) ? '' : 'none';
  });
  const fmt = n => n.toFixed(2).replace('.', ',') + ' \u20AC';
  const el  = id => document.getElementById(id);
  if (el('precios-total')) el('precios-total').textContent = fmt(subtotal * 1.21);
}

async function guardarPrecios() {
  const pedidoId = _preciosPedidoId;
  const p      = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const inputs = Array.from(document.querySelectorAll('.precio-input'));
  if (!p || !lineas.length) return;

  const fecha = new Date().toISOString().split('T')[0];
  showLoading('Guardando precios...');
  try {
    for (let i = 0; i < inputs.length; i++) {
      const precioStr = inputs[i].value.trim();
      if (!precioStr) continue;
      const linea = lineas[i];
      if (!linea) continue;
      const idx = DATA.lineasPedido.findIndex(x => x.ID_Linea === linea.ID_Linea);
      if (idx === -1) continue;

      // Guardar Precio_Unitario en col H de Lineas_Pedido
      await sheetsUpdate(`Lineas_Pedido!H${idx + 2}`, [precioStr]);
      DATA.lineasPedido[idx].Precio_Unitario = precioStr;

      // Añadir entrada al histórico
      const histRow = [genId('HP-'), linea.Material, pedidoId, p.Proveedor || '', fecha, precioStr];
      await sheetsAppend('Historico_Precios', histRow);
      DATA.historicoPrecio.push(rowToObj(histRow, 'historicoPrecio'));
    }
    showToast('Precios guardados', 'success');
    closeModal('modal-precios');
    renderPedidos();
    if (document.getElementById('page-pedido-detalle').classList.contains('active')) {
      verDetallePedido(pedidoId);
    }
    renderContabilidad();
    renderMaterial(); // actualizar columna precio medio
  } catch(e) {
    showToast('Error guardando precios', 'error');
    console.error(e);
  }
  hideLoading();
}

// ============================================================
// HISTÓRICO DE PRECIOS POR MATERIAL
// ============================================================

/**
 * Devuelve {count, ultimoPrecio, media, ultimaFecha} para un material.
 * Si se pasa proveedor, filtra por él (con fallback a todos).
 */
function getHistoricoMaterial(nombre, proveedor) {
  const norm = s => (s || '').normalize('NFC').trim().toLowerCase();
  let hist = (DATA.historicoPrecio || []).filter(h => norm(h.Nombre_Material) === norm(nombre));
  // Preferir entradas del mismo proveedor, pero si no hay usar todas
  const histProv = proveedor ? hist.filter(h => norm(h.Proveedor) === norm(proveedor)) : [];
  if (histProv.length) hist = histProv;

  const precios = hist
    .map(h => ({ precio: parseFloat(h.Precio_Unitario) || 0, fecha: h.Fecha }))
    .filter(h => h.precio > 0)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (!precios.length) return { count: 0, ultimoPrecio: 0, media: 0, ultimaFecha: '' };
  const media = precios.reduce((s, h) => s + h.precio, 0) / precios.length;
  return { count: precios.length, ultimoPrecio: precios[0].precio, media, ultimaFecha: precios[0].fecha };
}

/**
 * Busca en el histórico qué proveedor ha ofrecido el precio medio más bajo
 * para un material dado. Devuelve { proveedor, media, count } o null.
 */
function getMejorProveedorPrecio(nombreMaterial) {
  const norm = s => (s || '').normalize('NFC').trim().toLowerCase();
  const hist = (DATA.historicoPrecio || []).filter(h =>
    norm(h.Nombre_Material) === norm(nombreMaterial) &&
    h.Proveedor &&
    parseFloat(h.Precio_Unitario) > 0
  );
  if (!hist.length) return null;
  // Agrupar por proveedor y calcular precio medio
  const porProv = {};
  hist.forEach(h => {
    const p = h.Proveedor;
    if (!porProv[p]) porProv[p] = { sum: 0, count: 0 };
    porProv[p].sum   += parseFloat(h.Precio_Unitario);
    porProv[p].count += 1;
  });
  let mejorProv = null, mejorMedia = Infinity;
  Object.entries(porProv).forEach(([prov, { sum, count }]) => {
    const media = sum / count;
    if (media < mejorMedia) { mejorMedia = media; mejorProv = prov; }
  });
  if (!mejorProv) return null;
  return { proveedor: mejorProv, media: mejorMedia, count: porProv[mejorProv].count };
}

// ============================================================
// CONTABILIDAD — RESUMEN ANUAL
// ============================================================

function renderContabilidad() {
  _renderContabilidadConAnio(_anioContabilidad);
}

function _renderContabilidadConAnio(anio) {
  _anioContabilidad = anio;
  const cont = document.getElementById('contabilidad-contenido');
  if (!cont) return;

  // Pedidos del año (por Fecha_Factura > Fecha_Recepcion_Completa > Fecha_Creacion)
  const pedidosAnio = DATA.pedidos.filter(p => {
    const fecha = p.Fecha_Factura || p.Fecha_Recepcion_Completa || p.Fecha_Creacion;
    if (!fecha) return false;
    try { return new Date(fecha).getFullYear() === anio; } catch { return false; }
  });

  // Agregar por ciclo → módulo
  const resumen = {};
  for (const p of pedidosAnio) {
    const ciclo  = (p.Ciclo  || '').trim() || '(Sin ciclo asignado)';
    const modulo = (p.Modulo || '').trim() || '(Sin módulo)';
    if (!resumen[ciclo]) resumen[ciclo] = {};
    if (!resumen[ciclo][modulo]) resumen[ciclo][modulo] = { subtotal: 0, pedidos: [] };
    const lineasP  = DATA.lineasPedido.filter(l => l.Pedido === p.ID_Pedido);
    const subtotal = lineasP.reduce((sum, l) =>
      sum + (parseFloat(l.Precio_Unitario) || 0) * (parseFloat(l.Cantidad_Pedida) || 0), 0);
    resumen[ciclo][modulo].subtotal += subtotal;
    resumen[ciclo][modulo].pedidos.push({ id: p.ID_Pedido, nombre: p.Nombre_Lista, subtotal });
  }

  const totalBase = Object.values(resumen)
    .flatMap(mods => Object.values(mods))
    .reduce((s, m) => s + m.subtotal, 0);

  const fmt  = n => n.toFixed(2).replace('.', ',') + ' \u20AC';
  const anos = [anio + 1, anio, anio - 1, anio - 2];

  let html = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <label style="font-size:13px;color:var(--text-soft);font-weight:500">Año:</label>
      <select style="padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:14px"
        onchange="_renderContabilidadConAnio(parseInt(this.value))">
        ${anos.map(a => `<option value="${a}"${a === anio ? ' selected' : ''}>${a}</option>`).join('')}
      </select>
    </div>

    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-body">
          <div class="stat-value">${fmt(totalBase)}</div>
          <div class="stat-label">Base impoñible ${anio}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-body">
          <div class="stat-value">${fmt(totalBase * 0.21)}</div>
          <div class="stat-label">IVA (21%)</div>
        </div>
      </div>
      <div class="stat-card" style="border:2px solid var(--accent)">
        <div class="stat-body">
          <div class="stat-value" style="color:var(--accent)">${fmt(totalBase * 1.21)}</div>
          <div class="stat-label">Total con IVA ${anio}</div>
        </div>
      </div>
    </div>`;

  if (!pedidosAnio.length || totalBase === 0) {
    html += `<div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">Sin datos para ${anio}</div>
      <div class="empty-state-text">Genera hojas de pedido, introduce precios con el botón 💶 y asigna ciclos para ver el resumen.</div>
    </div>`;
  } else {
    for (const ciclo of Object.keys(resumen).sort()) {
      const mods          = resumen[ciclo];
      const subtotalCiclo = Object.values(mods).reduce((s, m) => s + m.subtotal, 0);
      html += `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title">${ciclo}</div>
            <div style="font-size:14px;font-weight:600;color:var(--accent)">${fmt(subtotalCiclo * 1.21)}</div>
          </div>
          <div style="padding:0 20px 16px">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:8px 4px;color:var(--text-muted);font-weight:600">Módulo</th>
                <th style="text-align:right;padding:8px 4px;color:var(--text-muted);font-weight:600">Base</th>
                <th style="text-align:right;padding:8px 4px;color:var(--text-muted);font-weight:600">IVA</th>
                <th style="text-align:right;padding:8px 4px;color:var(--text-muted);font-weight:600">Total</th>
              </tr></thead>
              <tbody>`;
      for (const mod of Object.keys(mods).sort()) {
        const d = mods[mod];
        html += `<tr style="border-bottom:1px solid #f5f5f5">
          <td style="padding:8px 4px">
            <div>${mod}</div>
            <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
              ${d.pedidos.map(p => `
                <button onclick="verDetallePedido('${p.id}')"
                  style="font-size:11px;padding:2px 8px;border-radius:20px;border:1px solid var(--accent);
                         background:transparent;color:var(--accent);cursor:pointer;white-space:nowrap"
                  title="${p.nombre}">📋 ${p.id}</button>
                <button onclick="abrirReasignacion('${p.id}')"
                  style="font-size:11px;padding:2px 5px;border-radius:20px;border:1px solid var(--border);
                         background:transparent;color:var(--text-muted);cursor:pointer"
                  title="Reasignar ciclo/módulo">🔀</button>`).join('')}
            </div>
          </td>
          <td style="text-align:right;padding:8px 4px;color:var(--text-soft)">${fmt(d.subtotal)}</td>
          <td style="text-align:right;padding:8px 4px;color:var(--text-muted)">${fmt(d.subtotal * 0.21)}</td>
          <td style="text-align:right;padding:8px 4px;font-weight:600">${fmt(d.subtotal * 1.21)}</td>
        </tr>`;
      }
      html += `</tbody></table>
          </div>
        </div>`;
    }
  }

  cont.innerHTML = html;
}

// ============================================================
// REASIGNACIÓN DE CICLO/MÓDULO DESDE CONTABILIDAD
// ============================================================

function abrirReasignacion(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  sv('reas-pedido-id', pedidoId);
  document.getElementById('reas-pedido-nombre').textContent = p.Nombre_Lista + '  ·  ' + pedidoId;

  const selCiclo = document.getElementById('reas-ciclo');
  const ciclos = [...new Set(DATA.ciclosModulos.map(cm => (cm.Ciclo||'').normalize('NFC').trim()).filter(Boolean))].sort();
  selCiclo.innerHTML = '<option value="">Seleccionar...</option>' +
    ciclos.map(c => `<option value="${c}">${c}</option>`).join('') +
    '<option value="Laboratorios">Laboratorios</option>';
  selCiclo.value = (p.Ciclo||'').normalize('NFC').trim();

  actualizarModulosReasignar();
  setTimeout(() => { sv('reas-modulo', (p.Modulo||'').normalize('NFC').trim()); }, 50);
  openModal('modal-reasignar-ciclo');
}

function actualizarModulosReasignar() {
  const ciclo = v('reas-ciclo');
  const sel = document.getElementById('reas-modulo');
  const norm = s => (s||'').normalize('NFC').trim();
  const modulos = DATA.ciclosModulos.filter(cm => norm(cm.Ciclo) === norm(ciclo)).map(cm => cm.Modulo).filter(Boolean);
  sel.innerHTML = '<option value="">— (dejar vacío si es para varios) —</option>' +
    modulos.map(m => `<option value="${m}">${m}</option>`).join('');
}

async function guardarReasignacion() {
  const pedidoId = v('reas-pedido-id');
  const ciclo = v('reas-ciclo');
  const modulo = v('reas-modulo');
  if (!ciclo) { showToast('Selecciona un ciclo', 'error'); return; }
  const pedIdx = DATA.pedidos.findIndex(x => x.ID_Pedido === pedidoId);
  if (pedIdx === -1) return;
  showLoading('Guardando...');
  try {
    await sheetsUpdate(`Pedidos!Q${pedIdx+2}:R${pedIdx+2}`, [ciclo, modulo]);
    DATA.pedidos[pedIdx].Ciclo = ciclo;
    DATA.pedidos[pedIdx].Modulo = modulo;
    showToast('Reasignado correctamente', 'success');
    closeModal('modal-reasignar-ciclo');
    renderContabilidad();
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}
