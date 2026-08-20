// ============================================================
// SOLICITUDES — RENDER Y LÓGICA
// ============================================================
let _mostrarSolicitudesArchivadas = false;
let _mostrarSnoozed = false;

// Snooze de solicitudes (col K de Solicitudes — compartido entre dispositivos)
function _getSnoozes() {
  const map = {};
  DATA.solicitudes.forEach(s => { if (s.Snooze_Hasta) map[s.ID_Solicitud] = s.Snooze_Hasta; });
  return map;
}
async function aplicarSnooze(solId) {
  const input = document.getElementById('snooze-date-' + solId);
  const fecha = input?.value;
  if (!fecha) { showToast('Indica una fecha', 'error'); return; }
  const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!sol) return;
  const anterior = sol.Snooze_Hasta;
  sol.Snooze_Hasta = fecha;
  showLoading('Guardando...');
  try {
    await callEdgeFunction('gestionar-solicitud', { accion: 'snooze', id_solicitud: solId, fecha });
    renderSolicitudes();
  } catch(e) { sol.Snooze_Hasta = anterior; showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}
async function cancelarSnooze(solId) {
  const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!sol) return;
  const anterior = sol.Snooze_Hasta;
  sol.Snooze_Hasta = '';
  showLoading('Guardando...');
  try {
    await callEdgeFunction('gestionar-solicitud', { accion: 'unsnooze', id_solicitud: solId });
    renderSolicitudes();
  } catch(e) { sol.Snooze_Hasta = anterior; showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}
function toggleSnoozeInput(solId) {
  const el = document.getElementById('snooze-panel-' + solId);
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}
function toggleMostrarSnoozed() {
  _mostrarSnoozed = !_mostrarSnoozed;
  renderSolicitudes();
}

// Badge de estados
const _estadoBadge = {
  'Pendiente':              'badge-orange',
  'Añadida a pedido':       'badge-blue',
  'En espera de recepción': 'badge-blue',
  'Recibido':               'badge-green',
  'Rechazado':              'badge-red',
  'Cancelado':              'badge-gray'
};
const _urgenciaBadge = { 'Urgente': 'badge-red', 'Normal': 'badge-gray' };

// extraAttrs: atributos extra para el tag <div> (data-sec, style, etc.)
// snoozeHasta: ISO date string si está en snooze activo, null si no
function _renderFilaSolicitud(s, rol, extraAttrs, snoozeHasta) {
  const puedeGestionar = rol === 'Administrador' || rol === 'Gestor';
  const esProfesor = rol === 'Profesor' || rol === 'Alumno';
  const urgencia = s.Urgencia || ((s.Observaciones||'').includes('⚠️ URGENTE') ? 'Urgente' : 'Normal');
  const mejorProv = typeof getMejorProveedorPrecio === 'function' ? getMejorProveedorPrecio(s.Material) : null;
  const hintProv = mejorProv && puedeGestionar
    ? `<div class="sol-card-hint">💡 <strong style="color:var(--accent)">${mejorProv.proveedor}</strong> · ${(mejorProv.media * 1.21).toFixed(2)} € c/IVA</div>`
    : '';
  const mostrarVerPedido = !esProfesor && s.Lista_Pedido && !['Pendiente','Rechazado'].includes(s.Estado);
  const puedeEditarProfesor = esProfesor && s.Estado === 'Pendiente';
  const puedeEditarGestor   = puedeGestionar && s.Estado === 'Pendiente';
  const puedeEditar = puedeEditarProfesor || puedeEditarGestor;

  const fechaNecesariaRaw = (s.Motivo || '').match(/Necesario:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  const fechaNecesaria = fechaNecesariaRaw
    ? `<span class="sol-card-necesario"> · 📅 ${formatDate(fechaNecesariaRaw)}</span>`
    : '';
  const prov = s.Proveedor_Requerido ? ` · ${s.Proveedor_Requerido}` : '';

  const estadosActivos = ['Pendiente', 'Añadida a pedido', 'En espera de recepción'];
  const puedeSnooze = estadosActivos.includes(s.Estado);
  const hoy = new Date().toISOString().split('T')[0];

  const btnSnooze = puedeSnooze
    ? `<button class="icon-btn" style="${snoozeHasta ? 'color:var(--accent2)' : ''}" title="${snoozeHasta ? 'Oculta hasta ' + formatDate(snoozeHasta) : 'Ocultar hasta una fecha'}" onclick="toggleSnoozeInput('${s.ID_Solicitud}')">🕐</button>`
    : '';

  let snoozePanel = '';
  if (puedeSnooze) {
    if (snoozeHasta) {
      snoozePanel = `<div class="sol-card-snooze" id="snooze-panel-${s.ID_Solicitud}" style="display:flex">
        <span>😴 Oculta hasta ${formatDate(snoozeHasta)}</span>
        <input type="date" id="snooze-date-${s.ID_Solicitud}" min="${hoy}" value="${snoozeHasta}">
        <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="aplicarSnooze('${s.ID_Solicitud}')">Cambiar</button>
        <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="cancelarSnooze('${s.ID_Solicitud}')">Mostrar ya</button>
      </div>`;
    } else {
      snoozePanel = `<div class="sol-card-snooze" id="snooze-panel-${s.ID_Solicitud}" style="display:none">
        <span style="white-space:nowrap">Ocultar hasta:</span>
        <input type="date" id="snooze-date-${s.ID_Solicitud}" min="${hoy}" value="${fechaNecesariaRaw || ''}">
        <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="aplicarSnooze('${s.ID_Solicitud}')">Confirmar</button>
        <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="toggleSnoozeInput('${s.ID_Solicitud}')">Cancelar</button>
      </div>`;
    }
  }

  const cardClass = `sol-card${snoozeHasta ? ' sol-card-snoozed' : ''}`;
  const open = extraAttrs ? ` ${extraAttrs}` : '';
  return `<div class="${cardClass}"${open}>
    <div class="sol-card-left">
      <div class="sol-card-material">
        ${s.Material}
        <span class="sol-card-qty">${s.Cantidad_Solicitada}</span>
        ${urgencia === 'Urgente' ? `<span class="badge badge-red" style="font-size:10px">⚠️ Urgente</span>` : ''}
      </div>
      <div class="sol-card-meta">
        <span style="color:var(--text-muted);font-size:10px">${s.ID_Solicitud}</span>
        <span>·</span>
        <span>${s.Solicitante}</span>
        <span>·</span>
        <span>${formatDate(s.Fecha)}</span>
        ${prov ? `<span>${prov}</span>` : ''}
        ${fechaNecesaria}
      </div>
      ${hintProv}
    </div>
    <div class="sol-card-right">
      <span class="badge ${_estadoBadge[s.Estado] || 'badge-gray'}">${s.Estado || 'Pendiente'}</span>
      <div class="row-actions">
        ${puedeGestionar && s.Estado === 'Pendiente' ? `<button class="icon-btn" title="Añadir a pedido" onclick="solicitudAPedido('${s.ID_Solicitud}')">🛒</button>` : ''}
        ${mostrarVerPedido ? `<button class="icon-btn" title="Ver pedido" onclick="verDetallePedido('${s.Lista_Pedido}')">📋</button>` : ''}
        ${puedeGestionar && s.Estado === 'Pendiente' ? `<button class="icon-btn" title="Rechazar" onclick="rechazarSolicitud('${s.ID_Solicitud}')">✕</button>` : ''}
        ${puedeEditar ? `<button class="icon-btn" title="Editar solicitud" onclick="openModalEditarSolicitud('${s.ID_Solicitud}')">✏️</button>` : ''}
        ${puedeEditarProfesor ? `<button class="icon-btn" title="Cancelar solicitud" onclick="cancelarSolicitud('${s.ID_Solicitud}')">🗑️</button>` : ''}
        ${btnSnooze}
      </div>
    </div>
    ${snoozePanel}
  </div>`;
}

const _seccionesColapsadas = new Set(['recibido', 'rechazado', 'cancelado']);

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

function renderSolicitudes(filtroEstado = '') {
  const tbody = document.getElementById('tabla-solicitudes');
  if (!tbody) return;
  const rol = getUserRole();
  const esProfesor = rol === 'Profesor' || rol === 'Alumno';
  let items = DATA.solicitudes;
  if (esProfesor) {
    const miNombre = getEffectiveUser().name || '';
    items = items.filter(s => s.Solicitante === miNombre);
  }
  // Filtrar: solo año actual y anterior
  const _anioActual = new Date().getFullYear();
  items = items.filter(s => {
    const anio = s.Fecha ? new Date(s.Fecha).getFullYear() : _anioActual;
    return anio >= _anioActual - 1;
  });

  if (filtroEstado) items = items.filter(s => s.Estado === filtroEstado);

  const snoozes = _getSnoozes();
  const hoy = new Date().toISOString().split('T')[0];
  const snoozedItems = items.filter(s => snoozes[s.ID_Solicitud] && snoozes[s.ID_Solicitud] > hoy);
  if (!_mostrarSnoozed) items = items.filter(s => !snoozes[s.ID_Solicitud] || snoozes[s.ID_Solicitud] <= hoy);

  const toggleContainer = document.getElementById('solicitudes-toggle-container');
  if (toggleContainer) {
    toggleContainer.innerHTML = '';
    if (snoozedItems.length) {
      const earliest = snoozedItems.map(s => snoozes[s.ID_Solicitud]).sort()[0];
      toggleContainer.innerHTML = `<div style="display:flex;justify-content:flex-end;padding-bottom:4px">
        <button class="btn btn-secondary" style="padding:1px 8px;font-size:11px;opacity:0.55;border-color:var(--border)" onclick="toggleMostrarSnoozed()" title="${snoozedItems.length} solicitud${snoozedItems.length > 1 ? 'es' : ''} pospuesta${snoozedItems.length > 1 ? 's' : ''} · próxima: ${formatDate(earliest)}">💤 ${snoozedItems.length}${_mostrarSnoozed ? ' · ocultar' : ''}</button>
      </div>`;
    }
  }

  const ORDEN  = ['Pendiente', 'Añadida a pedido', 'En espera de recepción', 'Recibido', 'Rechazado', 'Cancelado'];
  const ICONOS = { 'Pendiente': '⏳', 'Añadida a pedido': '🛒', 'En espera de recepción': '🔄', 'Recibido': '✅', 'Rechazado': '❌', 'Cancelado': '🚫' };
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
    html += `<div class="sol-sec-header" onclick="toggleSeccionSolicitud('${key}')">
      <span>${ICONOS[estado] || '📋'} ${estado} · ${grupo.length}</span>
      <span id="sol-arrow-${key}">${collapsed ? '▸' : '▾'}</span>
    </div>`;
    html += grupo.map(s => {
      const attrs = `data-sec="${key}"${collapsed ? ' style="display:none"' : ''}`;
      const snoozeHasta = snoozes[s.ID_Solicitud] && snoozes[s.ID_Solicitud] > hoy ? snoozes[s.ID_Solicitud] : null;
      return _renderFilaSolicitud(s, rol, attrs, snoozeHasta);
    }).join('');
  }

  tbody.innerHTML = hayAlgo
    ? html
    : `<div style="padding:32px 16px"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Sin solicitudes</div></div></div>`;
  _actualizarBadgeSolicitudes();
  _notificarCambiosSolicitudes();
}

function filtrarSolicitudesEstado(val) { renderSolicitudes(val || ''); }

function _nCambiosSolicitudProfesor() {
  const usuario = getEffectiveUser().email || getEffectiveUser().name || '';
  if (!usuario) return 0;
  const guardados = JSON.parse(localStorage.getItem('glab_sol_estados_' + usuario) || 'null');
  if (!guardados) return 0;
  const miNombre = getEffectiveUser().name || '';
  return DATA.solicitudes.filter(s =>
    s.Solicitante === miNombre &&
    guardados[s.ID_Solicitud] !== undefined &&
    guardados[s.ID_Solicitud] !== s.Estado
  ).length;
}

function _actualizarBadgeSolicitudes() {
  const badge = document.getElementById('badge-solicitudes');
  if (!badge) return;
  const rol = getUserRole();
  if (rol === 'Profesor' || rol === 'Alumno') {
    const n = _nCambiosSolicitudProfesor();
    badge.textContent = n;
    badge.style.display = n > 0 ? '' : 'none';
  } else {
    const _hoy = new Date().toISOString().split('T')[0];
    const _snz = _getSnoozes();
    const pendientes = DATA.solicitudes.filter(s => s.Estado === 'Pendiente' && !(_snz[s.ID_Solicitud] && _snz[s.ID_Solicitud] > _hoy)).length;
    badge.textContent = pendientes;
    badge.style.display = pendientes > 0 ? '' : 'none';
  }
}

function _notificarCambiosSolicitudes() {
  const rol = getUserRole();
  if (rol !== 'Profesor' && rol !== 'Alumno') return;
  const usuario = getEffectiveUser().email || getEffectiveUser().name || '';
  if (!usuario) return;
  const storageKey = 'glab_sol_estados_' + usuario;
  const guardados = JSON.parse(localStorage.getItem(storageKey) || 'null');
  const miNombre = getEffectiveUser().name || '';
  const misSols = DATA.solicitudes.filter(s => s.Solicitante === miNombre);
  if (!guardados) {
    const estado = {};
    misSols.forEach(s => { estado[s.ID_Solicitud] = s.Estado; });
    localStorage.setItem(storageKey, JSON.stringify(estado));
    return;
  }
  const cambios = misSols.filter(s =>
    guardados[s.ID_Solicitud] !== undefined && guardados[s.ID_Solicitud] !== s.Estado
  );
  const tbody = document.getElementById('tabla-solicitudes');
  const bannerExistente = document.getElementById('banner-cambios-solicitudes');
  if (bannerExistente) bannerExistente.remove();
  if (!cambios.length || !tbody) return;
  const detalles = cambios.slice(0, 4).map(s =>
    `<strong>${s.Material}</strong>: ${guardados[s.ID_Solicitud]} → ${s.Estado}`
  ).join(' · ');
  const masTexto = cambios.length > 4 ? ` · y ${cambios.length - 4} más` : '';
  const banner = document.createElement('div');
  banner.id = 'banner-cambios-solicitudes';
  banner.style.cssText = 'margin-bottom:12px;padding:12px 16px;background:var(--accent-light,#e8f0fe);border-radius:var(--radius,6px);border-left:3px solid var(--accent,#4f46e5);font-size:13px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap';
  banner.innerHTML = `<div style="flex:1"><strong style="color:var(--accent,#4f46e5)">${cambios.length} solicitud${cambios.length > 1 ? 'es' : ''} actualizada${cambios.length > 1 ? 's' : ''}:</strong><span style="color:var(--text-soft);margin-left:6px">${detalles}${masTexto}</span></div><button class="btn btn-sm btn-secondary" onclick="_marcarCambiosSolicitudesVisto()">Entendido</button>`;
  if (tbody) tbody.parentElement.insertBefore(banner, tbody);
}

function _marcarCambiosSolicitudesVisto() {
  const usuario = getEffectiveUser().email || getEffectiveUser().name || '';
  if (!usuario) return;
  const miNombre = getEffectiveUser().name || '';
  const estado = {};
  DATA.solicitudes.filter(s => s.Solicitante === miNombre).forEach(s => { estado[s.ID_Solicitud] = s.Estado; });
  localStorage.setItem('glab_sol_estados_' + usuario, JSON.stringify(estado));
  const banner = document.getElementById('banner-cambios-solicitudes');
  if (banner) banner.remove();
  _actualizarBadgeSolicitudes();
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
    const facturaSubida = DATA.documentosProveedor.some(d => d.Pedido === p.ID_Pedido);
    const docTitulos = [p.Doc_Hoja_Generada==='TRUE'?'📄 Hoja de pedido generada':'', p.Doc_Enviada_Jefatura==='TRUE'?'📬 Enviada a jefatura':'', facturaSubida?'📎 Factura subida':''].filter(Boolean);
    const docBadges = docTitulos.length ? `<span style="font-size:14px" title="${docTitulos.join(' · ')}">${docTitulos.map(t => t.slice(0, t.indexOf(' '))).join(' ')}</span>` : '';
    return `<div class="pedido-card" onclick="verDetallePedido('${p.ID_Pedido}')">
      <div class="pedido-card-header">
        <div><div class="pedido-card-title">${p.Nombre_Lista}</div><div class="pedido-card-meta">${p.Proveedor||'Sin proveedor asignado'} · Creado ${formatDate(p.Fecha_Creacion)}</div></div>
        <div style="display:flex;gap:8px;align-items:center" onclick="event.stopPropagation()">
          ${p.Tipo === 'Servicio' ? `<span class="badge badge-blue" style="font-size:10px">🔧 Servicio/equipo</span>` : ''}
          ${docBadges}
          <span class="estado-pedido ${estadoPedidoClass(p.Estado)}">${p.Estado}</span>
          ${!['Archivado','Recepción parcial','Recepción completa'].includes(p.Estado) ? `<button class="icon-btn" title="Cambiar estado" onclick="openModalEstadoPedido('${p.ID_Pedido}')">🔄</button>` : ''}
        </div>
      </div>
      <div class="pedido-card-stats">
        <div class="pedido-stat"><strong>${lineas.length}</strong> líneas</div>
        <div class="pedido-stat"><strong>${recibidas}</strong> recibidas</div>
        ${p.Numero_Factura ? `<div class="pedido-stat">Factura <strong>${p.Numero_Factura}</strong></div>` : ''}
        ${(() => { const coste = lineas.reduce((sum,l) => sum + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), parseFloat(p.Gasto_Extra_Importe)||0); return coste > 0 ? `<div class="pedido-stat">Total <strong>${coste.toFixed(2)} €</strong></div>` : ''; })()}
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

// Unidad de una línea: la elegida al pedirla (si el material tenía varios
// tipos), si no la del catálogo de material, si no la solicitud vinculada
function _unidadLineaPedido(l) {
  if (l.Unidad) return l.Unidad;
  const mat = DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
  if (mat?.Unidad) return mat.Unidad;
  const solIdM = (l.Observaciones || '').match(/Desde solicitud (SOL-\S+)/);
  if (solIdM) {
    const solVinc = DATA.solicitudes.find(s => s.ID_Solicitud === solIdM[1]);
    const uMatch = (solVinc?.Observaciones || '').match(/\[Unidad:\s*([^\]]+)\]/);
    if (uMatch) return uMatch[1].trim();
  }
  return '';
}

function generarTextoEmailPedido(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return '';
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const prov = DATA.proveedores.find(x => x.Nombre_Proveedor === p.Proveedor);
  const saludo = prov?.Persona_Contacto ? `Hola ${prov.Persona_Contacto},` : 'Buenos días,';
  const cuerpoLineas = lineas.map(l => {
    const unidad = _unidadLineaPedido(l);
    return `- ${l.Material}: ${l.Cantidad_Pedida}${unidad ? ' ' + unidad : ''}`;
  }).join('\n');
  return `${saludo}\n\nOs escribo para solicitar el siguiente pedido para el CIFP Manuel Antonio (departamento de Sanidade):\n\n${cuerpoLineas}\n\nQuedo a la espera de presupuesto/confirmación.`;
}

function abrirModalEmailPedido(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  sv('email-ped-id', pedidoId);
  document.getElementById('email-ped-texto').value = generarTextoEmailPedido(pedidoId);
  document.getElementById('email-ped-asunto').textContent = `Pedido — ${p.Nombre_Lista}`;
  openModal('modal-email-pedido');
}

async function copiarTextoEmailPedido() {
  const ta = document.getElementById('email-ped-texto');
  try {
    await navigator.clipboard.writeText(ta.value);
  } catch (e) {
    ta.select();
    document.execCommand('copy');
  }
  showToast('Texto copiado al portapapeles', 'success');
}

async function abrirModalLinkProveedor(pedidoId) {
  showLoading('Generando link...');
  try {
    const { token } = await callEdgeFunction('gestionar-pedido', { accion: 'generar_link_publico', id_pedido: pedidoId });
    const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
    if (p) p.Token_Publico = token;
    const url = new URL('subir-factura.html', location.href);
    url.search = `?pedido=${encodeURIComponent(pedidoId)}&token=${encodeURIComponent(token)}`;
    document.getElementById('link-prov-url').value = url.href;
    openModal('modal-link-proveedor');
  } catch(e) { showToast('Error generando el link: ' + e.message, 'error'); console.error(e); }
  hideLoading();
}

async function copiarLinkProveedor() {
  const input = document.getElementById('link-prov-url');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (e) {
    input.select();
    document.execCommand('copy');
  }
  showToast('Link copiado al portapapeles', 'success');
}

// ── Revisión de lo leído por la IA en un documento del proveedor ──────
// Lo único que esta pantalla puede escribir es precio_unitario, en lote, vía
// la misma acción actualizar_precio que ya usa el botón 💶 Precios
// (js/contabilidad.js) — nunca cantidad_recibida (eso exige comprobar
// físicamente lo que ha llegado, no lo que diga una factura) ni
// cantidad_pedida (eso es lo que se decidió pedir, no lo que facture el
// proveedor). Cada línea tiene un checkbox (desmarcado y deshabilitado si
// no se detectó precio) y el precio en un campo editable por si la lectura
// viene casi bien pero hay que corregir un dígito — lo que no esté bien
// simplemente se desmarca y no se aplica. Nunca crea líneas de pedido
// nuevas: lo que no encaja con ninguna línea existente se muestra aparte,
// solo a título informativo.
let _revExtraccionActual = null;

function abrirModalRevisionExtraccion(idDocumento, pedidoId) {
  const doc = DATA.documentosProveedor.find(d => d.ID_Documento === idDocumento);
  const r = doc?.Datos_Extraidos;
  sv('revext-pedido-id', pedidoId);
  _revExtraccionActual = { idDocumento, pedidoId, r };
  const cont = document.getElementById('revision-extraccion-contenido');
  if (!r) { cont.innerHTML = `<div class="empty-state" style="padding:24px">Todavía no se ha leído este documento.</div>`; openModal('modal-revision-extraccion'); return; }

  const filasMatch = (r.matches || []).map(m => {
    const it = m.item_detectado || {};
    const unidad = it.unidad ? ' ' + it.unidad : '';
    const tienePrecio = it.precio_unitario != null;
    // Sin semáforo rojo/verde: no hay forma de saber desde la factura si esta
    // línea se cuenta por unidad suelta o por envase (eso es un criterio tuyo,
    // no algo deducible del documento) — solo se muestra el envase tal cual lo
    // dice la factura, sin comparar ni juzgar si "coincide" con lo pedido.
    const envase = it.unidades_por_envase != null ? `<div style="font-size:11px;color:var(--text-muted)">envase de ${it.unidades_por_envase}${unidad}</div>` : '';
    const cantidadDetectada = it.cantidad != null ? `${it.cantidad}${unidad}${envase}` : '—';
    // El precio detectado es el que factura el proveedor por SU unidad de
    // venta (aquí, "envase") — que no tiene por qué ser la misma unidad en
    // la que se pidió la línea (Cantidad pedida). Aplicar el precio del
    // envase directo sobre una Cantidad_Pedida en unidades sueltas infla el
    // coste tantas veces como unidades tenga el envase (caso real: "Pinzas
    // estériles, pack 10 uds" a 10,50 €/pack aplicado sobre
    // Cantidad_Pedida=10 unidades sueltas → coste 10× el real). Es un aviso,
    // no una corrección automática — solo tú sabes en qué unidad se pidió.
    const precioPorUnidad = (tienePrecio && it.unidades_por_envase > 1)
      ? `<div style="font-size:11px;color:var(--text-muted)">= ${(it.precio_unitario / it.unidades_por_envase).toFixed(2)} €/ud si se pidió suelta</div>` : '';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 8px;text-align:center"><input type="checkbox" class="revext-check" data-id-linea="${m.id_linea}" ${tienePrecio ? 'checked' : 'disabled'} style="width:16px;height:16px"></td>
      <td style="padding:6px 8px">${m.material_linea}</td>
      <td style="padding:6px 8px;text-align:center">${m.cantidad_pedida ?? '—'}</td>
      <td style="padding:6px 8px;text-align:center">${m.cantidad_recibida || '0'}</td>
      <td style="padding:6px 8px;text-align:center">${cantidadDetectada}</td>
      <td style="padding:6px 8px;text-align:right"><input type="number" class="revext-precio" data-id-linea="${m.id_linea}" min="0" step="0.01" value="${tienePrecio ? it.precio_unitario : ''}" style="width:90px;text-align:right">${precioPorUnidad}</td>
    </tr>`;
  }).join('');

  const tabla = (r.matches || []).length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:2px solid var(--border)">
      <th style="padding:6px 8px"></th>
      <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">Línea del pedido</th>
      <th style="text-align:center;padding:6px 8px;color:var(--text-muted);font-weight:600">Pedido</th>
      <th style="text-align:center;padding:6px 8px;color:var(--text-muted);font-weight:600">Ya recibido</th>
      <th style="text-align:center;padding:6px 8px;color:var(--text-muted);font-weight:600">Detectado</th>
      <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-weight:600">Precio (€)</th>
    </tr></thead>
    <tbody>${filasMatch}</tbody>
  </table></div>` : `<div class="empty-state" style="padding:16px">No se detectó ninguna línea que coincida con las líneas de este pedido.</div>`;

  const pedido = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const puedeAnadirDesdeFactura = pedido?.Tipo !== 'Servicio'; // el caso "reactivo sorpresa" es de material, no de servicio/equipo
  const sinMatch = (r.sin_match || []).length ? `<div style="margin-top:16px;padding:10px 14px;background:var(--danger-light,#fdf0f0);border-radius:var(--radius-sm);font-size:13px">
    <div style="font-weight:600;margin-bottom:6px">⚠️ Detectado en el documento pero sin línea de pedido coincidente:</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${r.sin_match.map((i, idx) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <span>${i.material}${i.cantidad != null ? ` — ${i.cantidad}${i.unidad ? ' ' + i.unidad : ''}` : ''}</span>
        ${puedeAnadirDesdeFactura ? `<button class="btn btn-secondary" style="font-size:11px;padding:3px 10px;white-space:nowrap" onclick="anadirLineaDesdeSinMatch(${idx})">+ Añadir línea nueva</button>` : ''}
      </div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Por defecto no se toca nada — usa "+ Añadir línea nueva" solo si de verdad llegó algo que no estaba en el pedido (p.ej. un reactivo no contemplado en el presupuesto). Esto funciona aunque el pedido ya no admita añadir líneas a mano.</div>
  </div>` : '';

  const cargoExtra = r.cargo_extra ? `<div style="margin-top:16px;padding:10px 14px;background:var(--accent-light);border-radius:var(--radius-sm);font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px">
    <div>🚚 Cargo extra detectado: <strong>${r.cargo_extra.concepto}</strong> — ${Number(r.cargo_extra.importe).toFixed(2)} €</div>
    <button class="btn btn-secondary" style="font-size:12px;padding:4px 12px;white-space:nowrap" onclick="closeModal('modal-revision-extraccion');openModalGastoExtra('${pedidoId}','${(r.cargo_extra.concepto||'').replace(/'/g,"\\'")}',${r.cargo_extra.importe})">Precargar en Gasto extra</button>
  </div>` : '';

  // El número/fecha de factura detectados ya se guardaron directamente en
  // el pedido al leer el documento (leerDocumentoConIA, pedidos-acciones.js)
  // — la fecha que figura ahí es la de la factura, no la de subida del
  // documento ni la de creación del pedido. Este aviso es solo informativo,
  // no requiere ninguna acción.
  const datosFactura = (r.numero_factura || r.fecha_factura) ? `<div style="margin-top:16px;padding:10px 14px;background:var(--accent-light);border-radius:var(--radius-sm);font-size:13px">
    🧾 Factura detectada y guardada en el pedido: ${r.numero_factura ? `<strong>${r.numero_factura}</strong>` : '(sin número)'}${r.fecha_factura ? ` · ${formatDate(r.fecha_factura)}` : ''}
  </div>` : '';

  cont.innerHTML = tabla + sinMatch + cargoExtra + datosFactura;
  openModal('modal-revision-extraccion');
}

// Excepción puntual y deliberada a "no se pueden añadir líneas tras
// Presupuesto aprobado" (puedeAddLinea en verDetallePedido): a veces el
// proveedor factura un reactivo que no estaba en el presupuesto original.
// gestionar-linea-pedido/crear no tiene restricción de estado server-side
// (solo la acción 'editar' la tiene) — aquí simplemente se abre el modal de
// siempre, precargado, para que quede a criterio de quien lo confirma.
function anadirLineaDesdeSinMatch(idx) {
  if (!_revExtraccionActual) return;
  const { idDocumento, pedidoId, r } = _revExtraccionActual;
  const it = r.sin_match?.[idx];
  if (!it) return;
  const doc = DATA.documentosProveedor.find(d => d.ID_Documento === idDocumento);
  closeModal('modal-revision-extraccion');
  openModalNuevaLinea(pedidoId);
  setSourceLinea('libre');
  sv('linea-material-libre', it.material);
  sv('linea-material-unidades', it.unidad || '');
  sv('linea-cantidad', it.cantidad != null ? it.cantidad : '');
  sv('linea-precio', it.precio_unitario != null ? it.precio_unitario : '');
  sv('linea-obs', `No estaba en el pedido — detectada en ${doc?.Nombre_Archivo || 'el documento'} leído con IA`);
}

function verDetallePedido(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const docsProv = DATA.documentosProveedor.filter(d => d.Pedido === pedidoId);
  const puedeEditar  = getUserRole() === 'Administrador' || getUserRole() === 'Gestor';
  const puedeAddLinea = ['Abierto','Presupuesto solicitado'].includes(p.Estado) && puedeEditar;
  const cont = document.getElementById('pedido-detalle-contenido');
  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div><div class="card-title">${p.Nombre_Lista}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${p.ID_Pedido}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          ${p.Tipo === 'Servicio' ? `<span class="badge badge-blue" style="font-size:10px">🔧 Servicio/equipo</span>` : ''}
          <span class="estado-pedido ${estadoPedidoClass(p.Estado)}">${p.Estado}</span>
          ${puedeEditar && !['Recepción parcial','Recepción completa','Archivado'].includes(p.Estado) ? `<button class="btn btn-secondary" onclick="openModalEstadoPedido('${p.ID_Pedido}')">🔄 Estado</button>` : ''}
          ${puedeHacer('eliminarItems') ? `<button class="icon-btn" title="Eliminar pedido" onclick="eliminarPedido('${p.ID_Pedido}')" style="color:var(--danger,#dc2626)">🗑️</button>` : ''}
        </div>
      </div>
      <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        <div class="detail-item"><div class="detail-label">Proveedor</div><div class="detail-value" style="display:flex;align-items:center;gap:8px">${p.Proveedor||'—'}${puedeEditar && !['Presupuesto aprobado','Recepción parcial','Recepción completa'].includes(p.Estado) ? `<button class="icon-btn" title="Cambiar proveedor" onclick="openModalEditarProveedor('${p.ID_Pedido}')" style="font-size:12px;padding:2px 6px">✏️</button>` : ''}</div></div>
        <div class="detail-item"><div class="detail-label">Creado</div><div class="detail-value">${formatDate(p.Fecha_Creacion)||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Presupuesto</div><div class="detail-value">${formatDate(p.Fecha_Presupuesto)||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Aprobado</div><div class="detail-value">${formatDate(p.Fecha_Aprobacion)||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Nº Factura</div><div class="detail-value">${p.Numero_Factura||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Fecha factura</div><div class="detail-value">${formatDate(p.Fecha_Factura)||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Coste total (IVA 21%)</div><div class="detail-value">${(() => { const gastoExtra = parseFloat(p.Gasto_Extra_Importe)||0; const coste = DATA.lineasPedido.filter(l => l.Pedido === pedidoId).reduce((sum,l) => sum + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), gastoExtra); return coste > 0 ? (coste * 1.21).toFixed(2) + ' €' : '—'; })()}</div></div>
        <div class="detail-item"><div class="detail-label">Gasto extra</div><div class="detail-value" style="display:flex;align-items:center;gap:8px">${parseFloat(p.Gasto_Extra_Importe)>0 ? `${p.Gasto_Extra_Concepto||'Gasto extra'} · ${parseFloat(p.Gasto_Extra_Importe).toFixed(2)} €` : '—'}${puedeEditar ? `<button class="icon-btn" title="Añadir/editar gasto extra" onclick="openModalGastoExtra('${p.ID_Pedido}')" style="font-size:12px;padding:2px 6px">✏️</button>` : ''}</div></div>
      </div>
      ${puedeEditar ? `<div style="padding:0 20px 16px 20px;border-top:1px solid var(--border);margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-top:14px;flex-wrap:wrap;gap:8px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Documentación interna</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${lineas.length ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="abrirModalPrecios('${p.ID_Pedido}')">💶 Precios</button>` : ''}
            <button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="abrirGeneradorHoja('${p.ID_Pedido}')">📄 Generar hoja</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer">
            <input type="checkbox" id="chk-hoja-generada" ${p.Doc_Hoja_Generada==='TRUE'?'checked':''} disabled style="width:16px;height:16px">
            <span style="${p.Doc_Hoja_Generada==='TRUE'?'color:var(--success);font-weight:500':'color:var(--text-soft)'}">📄 Hoja de pedido generada</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:${p.Doc_Hoja_Generada==='TRUE' ? 'pointer' : 'not-allowed'}">
            <input type="checkbox" id="chk-enviada-jefatura" ${p.Doc_Enviada_Jefatura==='TRUE'?'checked':''} ${p.Doc_Hoja_Generada!=='TRUE'?'disabled':''} onchange="toggleDocPedido('${p.ID_Pedido}','Doc_Enviada_Jefatura',this.checked)" style="width:16px;height:16px">
            <span style="${p.Doc_Enviada_Jefatura==='TRUE'?'color:var(--success);font-weight:500':(p.Doc_Hoja_Generada!=='TRUE'?'color:var(--text-muted)':'color:var(--text-soft)')}">📬 Documentación enviada a jefatura</span>
          </label>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-top:14px;margin-top:16px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Documentación del proveedor</div>
          <button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="abrirModalLinkProveedor('${pedidoId}')">🔗 Link para proveedor</button>
        </div>
        <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:default">
          <input type="checkbox" ${docsProv.length?'checked':''} disabled style="width:16px;height:16px">
          <span style="${docsProv.length?'color:var(--success);font-weight:500':'color:var(--text-soft)'}">📎 Factura subida${docsProv.length ? ` (${docsProv.length})` : ''}</span>
        </label>
        ${docsProv.length ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
            ${docsProv.map(d => `<div class="linea-row">
              <div class="linea-nombre">${d.Nombre_Archivo}<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${formatDate(d.Fecha_Subida)||''}</div></div>
              <div class="linea-actions">
                ${d.Datos_Extraidos
                  ? `<button class="icon-btn" title="Ver datos leídos con IA" onclick="abrirModalRevisionExtraccion('${d.ID_Documento}','${pedidoId}')">📋</button>
                     <button class="icon-btn" title="Releer con IA" onclick="leerDocumentoConIA('${d.ID_Documento}','${pedidoId}')">🔄</button>`
                  : `<button class="icon-btn" title="Leer con IA" onclick="leerDocumentoConIA('${d.ID_Documento}','${pedidoId}')">🤖</button>`}
                <button class="icon-btn" title="Abrir" onclick="abrirDocumento('${d.Path}')">📄</button>
                <button class="icon-btn danger" title="Eliminar documento" onclick="eliminarDocumentoProveedor('${d.ID_Documento}','${pedidoId}')">🗑️</button>
              </div>
            </div>`).join('')}
          </div>` : `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Pulsa "🔗 Link para proveedor" arriba y compártelo con la casa comercial.</div>`}

        ${p.Estado==='Recepción completa'&&p.Doc_Hoja_Generada==='TRUE'&&p.Doc_Enviada_Jefatura==='TRUE' ? `<div style="margin-top:14px"><button class="btn btn-secondary" onclick="archivarPedido('${p.ID_Pedido}')">📦 Archivar pedido</button></div>` : ''}
      </div>` : ''}
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">${p.Tipo === 'Servicio' ? 'Servicios / equipos' : 'Líneas del pedido'} (${lineas.length})</div>
        <div style="display:flex;gap:8px">
          ${puedeEditar && lineas.length ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="abrirModalEmailPedido('${pedidoId}')">✉️ Email al proveedor</button>` : ''}
          ${puedeEditar && ['Presupuesto aprobado','Recepción parcial'].includes(p.Estado) && lineas.some(l => l.Estado_Linea !== 'Recibido') ? `<button class="btn btn-primary" style="font-size:12px;padding:4px 12px" onclick="openModalRecepcionMasiva('${pedidoId}')">📥 Recibir albarán</button>` : ''}
          ${puedeAddLinea ? `<button class="btn btn-secondary" onclick="openModalNuevaLinea('${pedidoId}')">+ Añadir línea</button>` : ''}
        </div>
      </div>
      <div style="padding:12px 16px">
        ${!lineas.length ? `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📝</div><div class="empty-state-title">Sin líneas todavía</div></div>` :
          lineas.map(l => {
            let unidadLinea = _unidadLineaPedido(l);
            unidadLinea = unidadLinea ? ' ' + unidadLinea : '';
            const estadoLinea = {'Pendiente':'badge-orange','Recibido parcialmente':'badge-blue','Recibido':'badge-green'}[l.Estado_Linea] || 'badge-gray';
            const puedeEliminar = puedeEditar && l.Estado_Linea === 'Pendiente';
            const equipoVinc = l.ID_Equipo ? DATA.equipos.find(e => e.ID_Activo === l.ID_Equipo) : null;
            return `<div class="linea-row">
              <div class="linea-nombre">${l.Material}${equipoVinc ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">🔧 ${equipoVinc.ID_Activo} — ${[equipoVinc.Tipo_Equipo,equipoVinc.Marca,equipoVinc.Modelo].filter(Boolean).join(' ')}</div>` : ''}</div>
              <div class="linea-meta">
                <span>Ped: ${l.Cantidad_Pedida}${unidadLinea}</span>
                <span style="color:var(--text)">Rec: ${l.Cantidad_Recibida||'0'}${unidadLinea}</span>
                <span class="badge ${estadoLinea}" style="font-size:10px">${l.Estado_Linea||'Pendiente'}</span>
              </div>
              <div class="linea-actions">
                ${puedeEditar && ['Abierto','Presupuesto solicitado'].includes(p.Estado) ? `<button class="icon-btn" title="Editar línea" onclick="openModalEditarLinea('${l.ID_Linea}','${pedidoId}')">✏️</button>` : ''}
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
function setLineaServicioTipo(tipo) {
  document.getElementById('btn-seq-existente').classList.toggle('active', tipo === 'existente');
  document.getElementById('btn-seq-nuevo').classList.toggle('active', tipo === 'nuevo');
  document.getElementById('linea-seq-existente-group').style.display = tipo === 'existente' ? '' : 'none';
  document.getElementById('linea-seq-nuevo-group').style.display = tipo === 'nuevo' ? '' : 'none';
}

function buscarEquipoLinea(query) {
  const list = document.getElementById('linea-equipo-autocomplete');
  if (!list) return;
  if (!query || query.length < 1) { list.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const resultados = DATA.equipos.filter(eq =>
    (eq.ID_Activo || '').toLowerCase().includes(q) ||
    (eq.Tipo_Equipo || '').toLowerCase().includes(q) ||
    (eq.Marca || '').toLowerCase().includes(q) ||
    (eq.Modelo || '').toLowerCase().includes(q)
  ).slice(0, 8);
  if (!resultados.length) { list.classList.remove('open'); return; }
  list.innerHTML = resultados.map(eq => {
    const desc = [eq.Tipo_Equipo, eq.Marca, eq.Modelo].filter(Boolean).join(' ');
    const ubi  = eq.Ubicacion ? getNombreUbicacion(eq.Ubicacion) : '';
    const meta = [desc, ubi].filter(Boolean).join(' · ');
    const label = (eq.ID_Activo + ' — ' + desc).replace(/'/g,"\\'");
    return `<div class="autocomplete-item" onclick="seleccionarEquipoLinea('${eq.ID_Activo}','${label}')">
      <div><div class="autocomplete-item-name">${eq.ID_Activo}</div><div class="autocomplete-item-meta">${meta}</div></div>
    </div>`;
  }).join('');
  list.classList.add('open');
}

function seleccionarEquipoLinea(id, label) {
  document.getElementById('linea-equipo-id').value = id;
  document.getElementById('linea-equipo-search').value = '';
  document.getElementById('linea-equipo-autocomplete').classList.remove('open');
  document.getElementById('linea-equipo-selected-text').textContent = label;
  document.getElementById('linea-equipo-selected').style.display = 'flex';
}

function clearEquipoLinea() {
  document.getElementById('linea-equipo-id').value = '';
  document.getElementById('linea-equipo-search').value = '';
  document.getElementById('linea-equipo-autocomplete').classList.remove('open');
  document.getElementById('linea-equipo-selected').style.display = 'none';
}

function setPedidoTipo(tipo) {
  sv('ped-tipo', tipo);
  document.getElementById('btn-ped-tipo-material').classList.toggle('active', tipo === 'Material');
  document.getElementById('btn-ped-tipo-servicio').classList.toggle('active', tipo === 'Servicio');
  document.getElementById('ped-nombre').placeholder = tipo === 'Servicio'
    ? 'Ej: Revisión SAT mayo, Compra microscopio...'
    : 'Ej: Consumibles mayo, Sigma junio...';
}

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
  if (!esCatalogo) document.getElementById('linea-catalogo-unidad-group').style.display = 'none';
}

// Selector de unidad al añadir una línea de pedido: solo se muestra si el
// material tiene más de un tipo de unidad (Unidad + Unidades_Extra), como el
// azul de lactofenol en botella o gotero. Con un único tipo no se muestra —
// la línea usa la Unidad del material como hasta ahora.
function _mostrarSelectorUnidadLinea(mat) {
  const grupo = document.getElementById('linea-catalogo-unidad-group');
  const sel = document.getElementById('linea-catalogo-unidad');
  if (!grupo || !sel) return;
  const extra = (mat?.Unidades_Extra || '').split(',').map(u => u.trim()).filter(Boolean);
  const opciones = [mat?.Unidad || '', ...extra].filter(Boolean);
  if (opciones.length <= 1) { grupo.style.display = 'none'; sel.innerHTML = ''; return; }
  sel.innerHTML = opciones.map(u => `<option value="${u}">${u}</option>`).join('');
  grupo.style.display = '';
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
  setPedidoTipo('Material');
  const sel = document.getElementById('ped-proveedor');
  sel.innerHTML = '<option value="">Sin asignar todavía</option>' + DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">${p.Nombre_Proveedor}</option>`).join('');
  openModal('modal-nuevo-pedido');
}

function openModalNuevaLinea(pedidoId) {
  const pedido = DATA.pedidos.find(p => p.ID_Pedido === pedidoId);
  const esServicio = pedido?.Tipo === 'Servicio';
  sv('linea-pedido-id', pedidoId);
  sv('linea-pedido-tipo', pedido?.Tipo || 'Material');
  const titulo = document.querySelector('#modal-nueva-linea .modal-title');
  if (titulo) titulo.textContent = esServicio ? 'Añadir servicio / equipo' : 'Añadir línea al pedido';
  document.getElementById('linea-material-section').style.display = esServicio ? 'none' : '';
  document.getElementById('linea-servicio-section').style.display = esServicio ? '' : 'none';
  if (esServicio) {
    setLineaServicioTipo('existente');
    sv('linea-servicio-desc', '');
    clearEquipoLinea();
    sv('linea-nuevo-eq-id', ''); sv('linea-nuevo-eq-tipo', '');
    sv('linea-nuevo-eq-marca', ''); sv('linea-nuevo-eq-modelo', '');
  } else {
    setSourceLinea('catalogo');
    document.getElementById('linea-material-id').value = '';
    document.getElementById('linea-material-selected').style.display = 'none';
    document.getElementById('linea-search').value = '';
    sv('linea-material-libre',''); sv('linea-material-unidades','');
    document.getElementById('linea-catalogo-unidad-group').style.display = 'none';
    document.getElementById('linea-catalogo-unidad').innerHTML = '';
  }
  sv('linea-cantidad', esServicio ? '1' : '');
  sv('linea-precio', '');
  sv('linea-obs','');
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

function openModalRecepcionMasiva(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId && l.Estado_Linea !== 'Recibido');
  sv('recmas-pedido-id', pedidoId);
  const tituloEl = document.querySelector('#modal-recepcion-masiva .modal-title');
  if (tituloEl) tituloEl.textContent = `Recibir albarán — ${p?.Nombre_Lista || pedidoId}`;
  const cont = document.getElementById('recmas-tabla-contenedor');
  if (!lineas.length) {
    cont.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted)">No hay líneas pendientes de recepción</div>`;
    openModal('modal-recepcion-masiva');
    return;
  }
  cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="border-bottom:2px solid var(--border)">
        <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">Material</th>
        <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">Unidad</th>
        <th style="text-align:center;padding:6px 8px;color:var(--text-muted);font-weight:600">Pedido</th>
        <th style="text-align:center;padding:6px 8px;color:var(--text-muted);font-weight:600">Ya recibido</th>
        <th style="text-align:center;padding:6px 8px;color:var(--text-muted);font-weight:600">En este albarán *</th>
        <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">Obs.</th>
      </tr>
    </thead>
    <tbody>
      ${lineas.map(l => {
        const yaRec = parseFloat(l.Cantidad_Recibida) || 0;
        const pendiente = Math.max(0, (parseFloat(l.Cantidad_Pedida) || 0) - yaRec);
        const unidad = _unidadLineaPedido(l);
        return `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 6px;font-weight:500">${l.Material}</td>
          <td style="padding:8px 6px;color:var(--text-soft)">${unidad || '—'}</td>
          <td style="padding:8px 6px;text-align:center;color:var(--text-soft)">${l.Cantidad_Pedida}</td>
          <td style="padding:8px 6px;text-align:center;color:var(--text-soft)">${yaRec > 0 ? yaRec : '—'}</td>
          <td style="padding:8px 6px;text-align:center"><input type="number" id="recmas-cant-${l.ID_Linea}" min="0" step="0.01" value="${pendiente}" style="width:80px;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:var(--radius-sm,4px);font-size:13px"></td>
          <td style="padding:8px 6px"><input type="text" id="recmas-obs-${l.ID_Linea}" placeholder="opcional" style="width:130px;padding:4px 6px;border:1px solid var(--border);border-radius:var(--radius-sm,4px);font-size:13px"></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div style="font-size:11px;color:var(--text-muted);margin-top:8px">* Pon 0 si el artículo no viene en este albarán</div>`;
  openModal('modal-recepcion-masiva');
}

function openModalRecepcion(lineaId, pedidoId) {
  sv('rec-linea-id', lineaId); sv('rec-pedido-id', pedidoId); sv('rec-obs', ''); sv('rec-cantidad', '');
  const pedido = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const esServicio = pedido?.Tipo === 'Servicio';
  document.getElementById('rec-label-material').textContent = esServicio ? 'Servicio' : 'Material';
  document.getElementById('rec-grupo-cantidad-pedida').style.display = esServicio ? 'none' : '';
  document.getElementById('rec-grupo-cantidad').style.display = esServicio ? 'none' : '';
  document.getElementById('rec-ya-recibida-group').style.display = 'none';
  document.getElementById('btn-confirmar-recepcion').textContent = esServicio ? 'Confirmar realizado' : 'Confirmar recepción';
  const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
  if (l) {
    const unidad = esServicio ? '' : _unidadLineaPedido(l);
    document.getElementById('rec-material-nombre').textContent = l.Material + (unidad ? ' · ' + unidad : '');
    if (!esServicio) {
      document.getElementById('rec-cantidad-pedida').textContent = l.Cantidad_Pedida + (unidad ? ' ' + unidad : '');
      document.getElementById('rec-cantidad').placeholder = unidad ? '0 ' + unidad : '0';
      const yaRec = parseFloat(l.Cantidad_Recibida) || 0;
      if (yaRec > 0) {
        document.getElementById('rec-cantidad-ya-recibida').textContent = yaRec + (unidad ? ' ' + unidad : '');
        document.getElementById('rec-ya-recibida-group').style.display = '';
      }
    }
  }
  openModal('modal-recepcion-linea');
}
