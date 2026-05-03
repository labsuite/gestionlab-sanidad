// ============================================================
// SOLICITUDES — RENDER Y LÓGICA
// ============================================================
let _mostrarSolicitudesArchivadas = false;

// Badge de estados
const _estadoBadge = {
  'Pendiente':              'badge-orange',
  'Añadida a pedido':       'badge-blue',
  'En espera de recepción': 'badge-blue',
  'Recibido':               'badge-green',
  'Rechazado':              'badge-red'
};
const _urgenciaBadge = { 'Urgente': 'badge-red', 'Normal': 'badge-gray' };

// trExtra: atributos extra para el tag <tr> (data-sec, style, etc.)
function _renderFilaSolicitud(s, rol, trExtra) {
  const puedeGestionar = rol === 'Administrador' || rol === 'Gestor';
  const esProfesor = rol === 'Profesor' || rol === 'Alumno';
  const urgencia = s.Urgencia || ((s.Observaciones||'').includes('⚠️ URGENTE') ? 'Urgente' : 'Normal');
  const mejorProv = typeof getMejorProveedorPrecio === 'function' ? getMejorProveedorPrecio(s.Material) : null;
  const hintProv = mejorProv && puedeGestionar
    ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">💡 <strong style="color:var(--accent)">${mejorProv.proveedor}</strong> · ${(mejorProv.media * 1.21).toFixed(2)} € c/IVA</div>`
    : '';
  const mostrarVerPedido = !esProfesor && s.Lista_Pedido && !['Pendiente','Rechazado'].includes(s.Estado);
  const puedeEditar = esProfesor && s.Estado === 'Pendiente';
  const trOpen = trExtra ? ` ${trExtra}` : '';
  return `<tr${trOpen}>
    <td><strong>${s.ID_Solicitud}</strong></td>
    <td><div>${s.Material}</div>${hintProv}</td>
    <td>${s.Cantidad_Solicitada}</td>
    <td style="font-size:12px">${s.Solicitante}</td>
    <td style="font-size:12px">${formatDate(s.Fecha)}</td>
    <td><span class="badge ${_urgenciaBadge[urgencia] || 'badge-gray'}">${urgencia}</span></td>
    <td style="font-size:12px">${s.Proveedor_Requerido || '—'}</td>
    <td><span class="badge ${_estadoBadge[s.Estado] || 'badge-gray'}">${s.Estado || 'Pendiente'}</span></td>
    <td><div class="row-actions">
      ${puedeGestionar && s.Estado === 'Pendiente' ? `<button class="icon-btn" title="Añadir a pedido" onclick="solicitudAPedido('${s.ID_Solicitud}')">🛒</button>` : ''}
      ${mostrarVerPedido ? `<button class="icon-btn" title="Ver pedido" onclick="verDetallePedido('${s.Lista_Pedido}')">📋</button>` : ''}
      ${puedeGestionar && s.Estado === 'Pendiente' ? `<button class="icon-btn" title="Rechazar" onclick="rechazarSolicitud('${s.ID_Solicitud}')">✕</button>` : ''}
      ${puedeEditar ? `<button class="icon-btn" title="Editar solicitud" onclick="openModalEditarSolicitud('${s.ID_Solicitud}')">✏️</button>` : ''}
    </div></td>
  </tr>`;
}

const _seccionesColapsadas = new Set();

function toggleSeccionSolicitud(key) {
  const rows = document.querySelectorAll('[data-sec="' + key + '"]');
  const arrow = document.getElementById('sol-arrow-' + key);
  if (_seccionesColapsadas.has(key)) {
    _seccionesColapsadas.delete(key);
    rows.forEach(r => r.style.display = '');
    if (arrow) arrow.textContent = '▾';
  } else {
    _seccionesColapsadas.add(key);
    rows.forEach(r => r.style.display = 'none');
    if (arrow) arrow.textContent = '▸';
  }
}

function renderSolicitudes() {
  const tbody = document.getElementById('tabla-solicitudes');
  if (!tbody) return;
  const rol = getUserRole();
  const esProfesor = rol === 'Profesor' || rol === 'Alumno';
  let items = DATA.solicitudes;
  if (esProfesor) {
    const miNombre = currentUser?.name || '';
    items = items.filter(s => s.Solicitante === miNombre);
  }
  // Filtrar: solo año actual y anterior
  const _anioActual = new Date().getFullYear();
  items = items.filter(s => {
    const anio = s.Fecha ? new Date(s.Fecha).getFullYear() : _anioActual;
    return anio >= _anioActual - 1;
  });

  const toggleContainer = document.getElementById('solicitudes-toggle-container');
  if (toggleContainer) toggleContainer.innerHTML = '';

  const ORDEN  = ['Pendiente', 'Añadida a pedido', 'En espera de recepción', 'Recibido', 'Rechazado'];
  const ICONOS = { 'Pendiente': '⏳', 'Añadida a pedido': '🛒', 'En espera de recepción': '🔄', 'Recibido': '✅', 'Rechazado': '❌' };
  // key: solo alfanumérico y guión, sin tildes ni espacios
  const toKey = str => str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  let html = '';
  let hayAlgo = false;
  for (const estado of ORDEN) {
    const grupo = [...items.filter(s => s.Estado === estado)]
      .sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));
    if (!grupo.length) continue;
    hayAlgo = true;
    const key = toKey(estado);
    const collapsed = _seccionesColapsadas.has(key);
    html += `<tr class="sol-sec-header" onclick="toggleSeccionSolicitud('${key}')" style="cursor:pointer;user-select:none">
      <td colspan="9" style="background:var(--bg-soft,#f5f5f3);padding:7px 16px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border)">
        <span style="display:flex;align-items:center;justify-content:space-between">
          <span>${ICONOS[estado] || '📋'} ${estado} · ${grupo.length}</span>
          <span id="sol-arrow-${key}" style="font-size:13px">${collapsed ? '▸' : '▾'}</span>
        </span>
      </td>
    </tr>`;
    html += grupo.map(s => {
      const attrs = `data-sec="${key}"${collapsed ? ' style="display:none"' : ''}`;
      return _renderFilaSolicitud(s, rol, attrs);
    }).join('');
  }

  tbody.innerHTML = hayAlgo
    ? html
    : `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Sin solicitudes</div></div></td></tr>`;
  _actualizarBadgeSolicitudes();
}

function filtrarSolicitudesEstado() { renderSolicitudes(); }

function _actualizarBadgeSolicitudes() {
  const pendientes = DATA.solicitudes.filter(s => s.Estado === 'Pendiente').length;
  const badge = document.getElementById('badge-solicitudes');
  if (badge) { badge.textContent = pendientes; badge.style.display = pendientes > 0 ? '' : 'none'; }
}
// ============================================================
// PEDIDOS — RENDER
// ============================================================
const SECUENCIA_ESTADOS = ['Abierto','Presupuesto solicitado','Presupuesto aprobado','Recepción parcial','Recepción completa'];

function estadoPedidoClass(estado) {
  return {'Abierto':'estado-abierto','Presupuesto solicitado':'estado-presupuesto','Presupuesto aprobado':'estado-aprobado','Recepción parcial':'estado-recepcion','Recepción completa':'estado-completo'}[estado] || 'estado-abierto';
}

let _mostrarArchivados = false;
const _pedidosAnioColapsados = new Set();
function _togglePedidosAnio(key) {
  const el = document.getElementById(key);
  const arrow = document.getElementById('arr-' + key);
  if (_pedidosAnioColapsados.has(key)) {
    _pedidosAnioColapsados.delete(key);
    if (el) el.style.display = '';
    if (arrow) arrow.textContent = '▾';
  } else {
    _pedidosAnioColapsados.add(key);
    if (el) el.style.display = 'none';
    if (arrow) arrow.textContent = '▸';
  }
}

function renderPedidos(filtroEstado = '') {
  const cont = document.getElementById('pedidos-lista');
  if (!cont) return;
  const archivados = DATA.pedidos.filter(p => p.Estado === 'Archivado');
  const activos    = DATA.pedidos.filter(p => p.Estado !== 'Archivado');
  const base = _mostrarArchivados ? archivados : activos;
  let filtrados = filtroEstado ? base.filter(p => p.Estado === filtroEstado) : base;
  filtrados = [...filtrados].sort((a,b) => new Date(b.Fecha_Creacion) - new Date(a.Fecha_Creacion));
  const toggleHtml = archivados.length > 0 ? `<div style="margin-bottom:12px"><button class="btn btn-secondary" onclick="_mostrarArchivados=!_mostrarArchivados;renderPedidos()">${_mostrarArchivados ? '← Ver pedidos activos' : '📦 Ver archivo (' + archivados.length + ')'}</button></div>` : '';
  if (!filtrados.length) {
    cont.innerHTML = toggleHtml + `<div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-title">${_mostrarArchivados ? 'Sin pedidos archivados' : 'Sin listas de pedido'}</div><div class="empty-state-text">${_mostrarArchivados ? '' : 'Crea la primera lista con el botón superior'}</div></div>`;
    return;
  }
  // Helper card
  const _card = p => {
    const lineas    = DATA.lineasPedido.filter(l => l.Pedido === p.ID_Pedido);
    const recibidas = lineas.filter(l => l.Estado_Linea === 'Recibido').length;
    const docBadges = [p.Doc_Hoja_Generada==='TRUE'?'📄':'', p.Doc_Hoja_Completada==='TRUE'?'✅':'', p.Doc_Enviada_Jefatura==='TRUE'?'📬':''].filter(Boolean).join(' ');
    return `<div class="pedido-card" onclick="verDetallePedido('${p.ID_Pedido}')">
      <div class="pedido-card-header">
        <div><div class="pedido-card-title">${p.Nombre_Lista}</div><div class="pedido-card-meta">${p.Proveedor||'Sin proveedor asignado'} · Creado ${formatDate(p.Fecha_Creacion)}</div></div>
        <div style="display:flex;gap:8px;align-items:center" onclick="event.stopPropagation()">
          ${docBadges ? `<span style="font-size:14px" title="Documentación">${docBadges}</span>` : ''}
          <span class="estado-pedido ${estadoPedidoClass(p.Estado)}">${p.Estado}</span>
          ${!['Archivado','Recepción parcial','Recepción completa'].includes(p.Estado) ? `<button class="icon-btn" title="Cambiar estado" onclick="openModalEstadoPedido('${p.ID_Pedido}')">🔄</button>` : ''}
        </div>
      </div>
      <div class="pedido-card-stats">
        <div class="pedido-stat"><strong>${lineas.length}</strong> líneas</div>
        <div class="pedido-stat"><strong>${recibidas}</strong> recibidas</div>
        ${p.Numero_Factura ? `<div class="pedido-stat">Factura <strong>${p.Numero_Factura}</strong></div>` : ''}
        ${(() => { const coste = lineas.reduce((sum,l) => sum + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), 0); return coste > 0 ? `<div class="pedido-stat">Total <strong>${coste.toFixed(2)} €</strong></div>` : ''; })()}
      </div>
    </div>`;
  };

  if (_mostrarArchivados && !filtroEstado) {
    // Agrupar archivados por año
    const _porAnio = {};
    filtrados.forEach(p => {
      const anio = p.Fecha_Creacion ? new Date(p.Fecha_Creacion).getFullYear() : 'Sin fecha';
      if (!_porAnio[anio]) _porAnio[anio] = [];
      _porAnio[anio].push(p);
    });
    const aniosOrden = Object.keys(_porAnio).sort((a, b) => b - a);
    let archivoHtml = toggleHtml;
    for (const anio of aniosOrden) {
      const key = 'ped-anio-' + anio;
      const col = _pedidosAnioColapsados.has(key);
      archivoHtml += `<div style="margin-bottom:8px">
        <div onclick="_togglePedidosAnio('${key}')" style="cursor:pointer;padding:8px 14px;background:var(--bg-soft,#f5f5f3);border-radius:var(--radius,6px);display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;user-select:none">
          <span>📅 ${anio} · ${_porAnio[anio].length} pedido${_porAnio[anio].length > 1 ? 's' : ''}</span>
          <span id="arr-${key}" style="font-size:14px">${col ? '▸' : '▾'}</span>
        </div>
        <div id="${key}" style="${col ? 'display:none' : ''}">
          ${_porAnio[anio].map(_card).join('')}
        </div>
      </div>`;
    }
    cont.innerHTML = archivoHtml;
  } else {
    cont.innerHTML = toggleHtml + filtrados.map(_card).join('');
  }
}
function filtrarPedidosEstado(v) { renderPedidos(v); }

function verDetallePedido(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const puedeEditar  = getUserRole() === 'Administrador' || getUserRole() === 'Gestor';
  const puedeAddLinea = p.Estado === 'Abierto' && puedeEditar;
  const cont = document.getElementById('pedido-detalle-contenido');
  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div><div class="card-title">${p.Nombre_Lista}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${p.ID_Pedido}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="estado-pedido ${estadoPedidoClass(p.Estado)}">${p.Estado}</span>
          ${puedeEditar && !['Recepción parcial','Recepción completa','Archivado'].includes(p.Estado) ? `<button class="btn btn-secondary" onclick="openModalEstadoPedido('${p.ID_Pedido}')">🔄 Estado</button>` : ''}

        </div>
      </div>
      <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        <div class="detail-item"><div class="detail-label">Proveedor</div><div class="detail-value" style="display:flex;align-items:center;gap:8px">${p.Proveedor||'—'}${puedeEditar && !['Presupuesto aprobado','Recepción parcial','Recepción completa'].includes(p.Estado) ? `<button class="icon-btn" title="Cambiar proveedor" onclick="openModalEditarProveedor('${p.ID_Pedido}')" style="font-size:12px;padding:2px 6px">✏️</button>` : ''}</div></div>
        <div class="detail-item"><div class="detail-label">Creado</div><div class="detail-value">${formatDate(p.Fecha_Creacion)||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Presupuesto</div><div class="detail-value">${formatDate(p.Fecha_Presupuesto)||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Aprobado</div><div class="detail-value">${formatDate(p.Fecha_Aprobacion)||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Nº Factura</div><div class="detail-value">${p.Numero_Factura||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Coste total</div><div class="detail-value">${(() => { const coste = DATA.lineasPedido.filter(l => l.Pedido === pedidoId).reduce((sum,l) => sum + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), 0); return coste > 0 ? coste.toFixed(2) + ' €' : '—'; })()}</div></div>
      </div>
      ${puedeEditar ? `<div style="padding:0 20px 16px 20px;border-top:1px solid var(--border);margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-top:14px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Documentación</div>
          <div style="display:flex;gap:6px">
            ${lineas.length ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="abrirModalPrecios('${p.ID_Pedido}')">💶 Precios</button>` : ''}
            ${puedeEditar ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="abrirGeneradorHoja('${p.ID_Pedido}')">📄 Generar hoja</button>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer">
            <input type="checkbox" id="chk-hoja-generada" ${p.Doc_Hoja_Generada==='TRUE'?'checked':''} disabled style="width:16px;height:16px">
            <span style="${p.Doc_Hoja_Generada==='TRUE'?'color:var(--success);font-weight:500':'color:var(--text-soft)'}">📄 Hoja de pedido generada</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:${p.Doc_Hoja_Generada==='TRUE' ? 'pointer' : 'not-allowed'}">
            <input type="checkbox" id="chk-hoja-completada" ${p.Doc_Hoja_Completada==='TRUE'?'checked':''} ${p.Doc_Hoja_Generada!=='TRUE'?'disabled':''} onchange="toggleDocPedido('${p.ID_Pedido}','Doc_Hoja_Completada',this.checked)" style="width:16px;height:16px">
            <span style="${p.Doc_Hoja_Completada==='TRUE'?'color:var(--success);font-weight:500':(p.Doc_Hoja_Generada!=='TRUE'?'color:var(--text-muted)':'color:var(--text-soft)')}">✅ Hoja completada con factura</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:${p.Doc_Hoja_Completada==='TRUE' ? 'pointer' : 'not-allowed'}">
            <input type="checkbox" id="chk-enviada-jefatura" ${p.Doc_Enviada_Jefatura==='TRUE'?'checked':''} ${p.Doc_Hoja_Completada!=='TRUE'?'disabled':''} onchange="toggleDocPedido('${p.ID_Pedido}','Doc_Enviada_Jefatura',this.checked)" style="width:16px;height:16px">
            <span style="${p.Doc_Enviada_Jefatura==='TRUE'?'color:var(--success);font-weight:500':(p.Doc_Hoja_Completada!=='TRUE'?'color:var(--text-muted)':'color:var(--text-soft)')}">📬 Documentación enviada a jefatura</span>
          </label>
        </div>
        ${p.Estado==='Recepción completa'&&p.Doc_Hoja_Generada==='TRUE'&&p.Doc_Hoja_Completada==='TRUE'&&p.Doc_Enviada_Jefatura==='TRUE' ? `<div style="margin-top:14px"><button class="btn btn-secondary" onclick="archivarPedido('${p.ID_Pedido}')">📦 Archivar pedido</button></div>` : ''}
      </div>` : ''}
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Líneas del pedido (${lineas.length})</div>
        <div style="display:flex;gap:8px">${puedeAddLinea ? `<button class="btn btn-secondary" onclick="openModalNuevaLinea('${pedidoId}')">+ Añadir línea</button>` : ''}</div>
      </div>
      <div style="padding:12px 16px">
        ${!lineas.length ? `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📝</div><div class="empty-state-title">Sin líneas todavía</div></div>` :
          lineas.map(l => {
            const mat = DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
            let unidadLinea = mat?.Unidad || '';
            if (!unidadLinea) {
              // Material no catalogado: buscar unidad en observaciones de la solicitud vinculada
              const solIdM = (l.Observaciones || '').match(/Desde solicitud (SOL-\S+)/);
              if (solIdM) {
                const solVinc = DATA.solicitudes.find(s => s.ID_Solicitud === solIdM[1]);
                const uMatch = (solVinc?.Observaciones || '').match(/\[Unidad:\s*([^\]]+)\]/);
                if (uMatch) unidadLinea = uMatch[1].trim();
              }
            }
            unidadLinea = unidadLinea ? ' ' + unidadLinea : '';
            const estadoLinea = {'Pendiente':'badge-orange','Recibido parcialmente':'badge-blue','Recibido':'badge-green'}[l.Estado_Linea] || 'badge-gray';
            const puedeEliminar = puedeEditar && l.Estado_Linea === 'Pendiente';
            return `<div class="linea-row" style="grid-template-columns:1fr 80px 80px 110px auto">
              <div style="font-weight:500;font-size:13px">${l.Material}</div>
              <div style="text-align:center;font-size:12px;color:var(--text-soft)">Ped: ${l.Cantidad_Pedida}${unidadLinea}</div>
              <div style="text-align:center;font-size:12px">Rec: ${l.Cantidad_Recibida||'0'}${unidadLinea}</div>
              <div><span class="badge ${estadoLinea}" style="font-size:10px">${l.Estado_Linea||'Pendiente'}</span></div>
              <div style="display:flex;gap:4px">
                ${puedeEditar && l.Estado_Linea !== 'Recibido' && ['Presupuesto aprobado','Recepción parcial','Recepción completa'].includes(p.Estado) ? `<button class="icon-btn" title="Registrar recepción" onclick="openModalRecepcion('${l.ID_Linea}','${pedidoId}')">📥</button>` : ''}
                ${puedeEliminar ? `<button class="icon-btn danger" title="Eliminar línea" onclick="eliminarLineaPedido('${l.ID_Linea}','${pedidoId}')">🗑️</button>` : ''}
              </div>
            </div>`;
          }).join('')}
      </div>
    </div>`;
  showPage('pedido-detalle');
}

// ============================================================
// MODALES PEDIDOS / SOLICITUDES
// ============================================================
function setSourceSolicitud(source) {
  const esCatalogo = source === 'catalogo';
  document.getElementById('btn-source-catalogo').classList.toggle('active', esCatalogo);
  document.getElementById('btn-source-nuevo').classList.toggle('active', !esCatalogo);
  document.getElementById('sol-catalogo-group').style.display = esCatalogo ? '' : 'none';
  document.getElementById('sol-nuevo-group').style.display = esCatalogo ? 'none' : '';
  document.getElementById('sol-unidad-group').style.display = esCatalogo ? 'none' : '';
}
function setSourceLinea(source) {
  const esCatalogo = source === 'catalogo';
  document.getElementById('btn-lsource-catalogo').classList.toggle('active', esCatalogo);
  document.getElementById('btn-lsource-libre').classList.toggle('active', !esCatalogo);
  document.getElementById('linea-catalogo-group').style.display = esCatalogo ? '' : 'none';
  document.getElementById('linea-libre-group').style.display = esCatalogo ? 'none' : '';
  document.getElementById('linea-libre-unidad-group').style.display = esCatalogo ? 'none' : '';
}

function openModalSolicitud() {
  setSourceSolicitud('catalogo');
  document.getElementById('sol-material-id').value = '';
  document.getElementById('sol-material-selected').style.display = 'none';
  document.getElementById('sol-search').value = '';
  sv('sol-cantidad',''); sv('sol-urgencia','Normal'); sv('sol-fecha-necesidad','');
  sv('sol-motivo',''); sv('sol-obs',''); sv('sol-unidad','');
  const sel = document.getElementById('sol-proveedor');
  sel.innerHTML = '<option value="">Sin preferencia</option>' + DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">${p.Nombre_Proveedor}</option>`).join('');
  openModal('modal-solicitud');
}

function openModalNuevoPedido() {
  sv('ped-nombre',''); sv('ped-obs','');
  const sel = document.getElementById('ped-proveedor');
  sel.innerHTML = '<option value="">Sin asignar todavía</option>' + DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">${p.Nombre_Proveedor}</option>`).join('');
  openModal('modal-nuevo-pedido');
}

function openModalNuevaLinea(pedidoId) {
  sv('linea-pedido-id', pedidoId);
  setSourceLinea('catalogo');
  document.getElementById('linea-material-id').value = '';
  document.getElementById('linea-material-selected').style.display = 'none';
  document.getElementById('linea-search').value = '';
  sv('linea-cantidad',''); sv('linea-obs',''); sv('linea-material-libre','');
  openModal('modal-nueva-linea');
}

function openModalEstadoPedido(pedidoId) {
  sv('estado-pedido-id', pedidoId);
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (p) sv('estado-pedido-nuevo', p.Estado);
  sv('estado-num-presupuesto',''); sv('estado-num-factura','');
  const selEstado = document.getElementById('estado-pedido-nuevo');
  const actualizarCampos = () => {
    const est = selEstado.value;
    document.getElementById('grupo-num-presupuesto').style.display = est === 'Presupuesto solicitado' || est === 'Presupuesto aprobado' ? '' : 'none';
    document.getElementById('grupo-num-factura').style.display = 'none'; // El nº factura se rellena desde el generador de hoja
    document.getElementById('grupo-proveedor-estado').style.display = !p?.Proveedor ? '' : 'none';
  };
  selEstado.onchange = actualizarCampos; actualizarCampos();
  const selProv = document.getElementById('estado-proveedor');
  selProv.innerHTML = '<option value="">Sin cambios</option>' + DATA.proveedores.filter(x => x.Activo !== 'FALSE').map(x => `<option value="${x.Nombre_Proveedor}">${x.Nombre_Proveedor}</option>`).join('');
  openModal('modal-estado-pedido');
}

function openModalRecepcion(lineaId, pedidoId) {
  sv('rec-linea-id', lineaId); sv('rec-pedido-id', pedidoId); sv('rec-obs','');
  const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
  if (l) { document.getElementById('rec-material-nombre').textContent = l.Material; document.getElementById('rec-cantidad-pedida').textContent = l.Cantidad_Pedida; sv('rec-cantidad', l.Cantidad_Pedida); }
  openModal('modal-recepcion-linea');
}
