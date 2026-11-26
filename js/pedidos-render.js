// ============================================================
// SOLICITUDES — RENDER Y LÓGICA
// ============================================================
let _mostrarSolicitudesArchivadas = false;
let _mostrarSnoozed = false;

// Snooze de solicitudes (col K de Solicitudes — compartido entre dispositivos)
// Una solicitud Pendiente con fecha de necesidad lejana se oculta sola hasta
// _DIAS_AVISO_NECESARIO días antes de esa fecha, sin que nadie pulse 🕐: si se
// queda a la vista meses, se acaba ignorando y se olvida. Un Snooze_Hasta
// explícito manda siempre (por eso «Mostrar ya» guarda hoy, no lo vacía).
const _DIAS_AVISO_NECESARIO = 30;
function _fechaNecesariaSolicitud(s) {
  return (s.Motivo || '').match(/Necesario:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || '';
}
function _snoozeAutomatico(s) {
  if (s.Snooze_Hasta || s.Estado !== 'Pendiente') return '';
  const nec = _fechaNecesariaSolicitud(s);
  if (!nec) return '';
  const d = new Date(nec + 'T12:00:00');
  d.setDate(d.getDate() - _DIAS_AVISO_NECESARIO);
  return d.toISOString().split('T')[0];
}
function _getSnoozes() {
  const map = {};
  DATA.solicitudes.forEach(s => {
    const hasta = s.Snooze_Hasta || _snoozeAutomatico(s);
    if (hasta) map[s.ID_Solicitud] = hasta;
  });
  return map;
}
// Solicitudes Pendientes que no están ocultas (🕐 o por fecha de necesidad lejana).
// Una sola regla para el aviso del panel principal y los dos badges del menú: si
// se ocultó, no se avisa de ella hasta la fecha.
function solicitudesPendientesVisibles() {
  const hoy = new Date().toISOString().split('T')[0];
  const snoozes = _getSnoozes();
  return DATA.solicitudes.filter(s => s.Estado === 'Pendiente' && !(snoozes[s.ID_Solicitud] && snoozes[s.ID_Solicitud] > hoy));
}
// Tras cambiar una solicitud: el panel principal y los badges también cuentan.
function _refrescarAvisosSolicitudes() {
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof updateBadges === 'function') updateBadges();
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
    renderSolicitudes(); _refrescarAvisosSolicitudes();
  } catch(e) { sol.Snooze_Hasta = anterior; showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}
async function cancelarSnooze(solId) {
  const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!sol) return;
  const anterior = sol.Snooze_Hasta;
  // Se guarda la fecha de hoy en vez de vaciarla: vacía, el ocultado automático
  // por fecha de necesidad la volvería a esconder.
  const hoy = new Date().toISOString().split('T')[0];
  sol.Snooze_Hasta = hoy;
  showLoading('Guardando...');
  try {
    await callEdgeFunction('gestionar-solicitud', { accion: 'snooze', id_solicitud: solId, fecha: hoy });
    renderSolicitudes(); _refrescarAvisosSolicitudes();
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
  'Comprado aparte':        'badge-green',
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

  const fechaNecesariaRaw = _fechaNecesariaSolicitud(s);
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
        <span>😴 Oculta hasta ${formatDate(snoozeHasta)}${!s.Snooze_Hasta ? ` · un mes antes de la fecha prevista` : ''}</span>
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
        ${s.Tipo === 'Servicio' ? `<span class="badge badge-blue" style="font-size:10px">🔧 Servicio</span>` : s.Tipo === 'No fungible' ? `<span class="badge badge-purple" style="font-size:10px">🧰 No fungible</span>` : ''}
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
      ${s.Estado === 'Comprado aparte' ? _infoCompraAparte(s) : ''}
    </div>
    <div class="sol-card-right">
      <span class="badge ${_estadoBadge[s.Estado] || 'badge-gray'}">${s.Estado || 'Pendiente'}</span>
      <div class="row-actions">
        ${puedeGestionar && s.Estado === 'Pendiente' ? `<button class="icon-btn" title="Añadir a pedido" onclick="solicitudAPedido('${s.ID_Solicitud}')">🛒</button>` : ''}
        ${mostrarVerPedido ? `<button class="icon-btn" title="Ver pedido" onclick="verDetallePedido('${s.Lista_Pedido}')">📋</button>` : ''}
        ${puedeGestionar && s.Estado === 'Pendiente' ? `<button class="icon-btn" title="Comprado aparte (sin pedido)" onclick="openModalCompraAparte('${s.ID_Solicitud}')">🛍️</button>` : ''}
        ${puedeGestionar && s.Estado === 'Pendiente' ? `<button class="icon-btn" title="Rechazar" onclick="rechazarSolicitud('${s.ID_Solicitud}')">✕</button>` : ''}
        ${puedeEditar ? `<button class="icon-btn" title="Editar solicitud" onclick="openModalEditarSolicitud('${s.ID_Solicitud}')">✏️</button>` : ''}
        ${puedeEditarProfesor ? `<button class="icon-btn" title="Cancelar solicitud" onclick="cancelarSolicitud('${s.ID_Solicitud}')">🗑️</button>` : ''}
        ${btnSnooze}
      </div>
    </div>
    ${snoozePanel}
  </div>`;
}

// Línea de la tarjeta de una solicitud comprada por cuenta propia: cuándo,
// cuánto costó y la nota que se dejó (dónde, quién lo adelantó…).
function _infoCompraAparte(s) {
  const partes = [];
  if (s.Compra_Fecha) partes.push(formatDate(s.Compra_Fecha));
  if (s.Compra_Importe) partes.push((parseFloat(s.Compra_Importe) || 0).toFixed(2).replace('.', ',') + ' €');
  if (s.Compra_Nota) partes.push(_escAttr(s.Compra_Nota));
  return `<div class="sol-card-hint">🛍️ Comprado aparte${partes.length ? ' · ' + partes.join(' · ') : ''}</div>`;
}

const _seccionesColapsadas = new Set(['recibido', 'comprado-aparte', 'rechazado', 'cancelado']);

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

  const ORDEN  = ['Pendiente', 'Añadida a pedido', 'En espera de recepción', 'Recibido', 'Comprado aparte', 'Rechazado', 'Cancelado'];
  const ICONOS = { 'Pendiente': '⏳', 'Añadida a pedido': '🛒', 'En espera de recepción': '🔄', 'Recibido': '✅', 'Comprado aparte': '🛍️', 'Rechazado': '❌', 'Cancelado': '🚫' };
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
    const pendientes = solicitudesPendientesVisibles().length;
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

// Facturas que el proveedor ha subido por el link público y todavía nadie ha
// pasado por el lector de IA (`Extraido_En` vacío), en pedidos no archivados.
// Único sitio donde se define el criterio: lo usan el banner del dashboard
// (renderDashboard) y el badge del menú (updateBadges), que deben coincidir.
function facturasProveedorSinLeer() {
  return DATA.documentosProveedor.filter(d => !d.Extraido_En &&
    DATA.pedidos.some(p => p.ID_Pedido === d.Pedido && p.Estado !== 'Archivado'));
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
          ${lineas.some(l => l.Tipo_Linea !== 'Material') ? `<span class="badge badge-blue" style="font-size:10px" title="Lleva algún equipo o servicio">🔧 Equipo/servicio</span>` : ''}
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

// Material catalogado de una línea: por ID_Material si lo tiene, y solo si no,
// por nombre. Buscar solo por nombre fallaba en cuanto el texto de la línea se
// separaba del catálogo por una coma ("Puntas micropipeta 5000uL" frente a
// "Puntas micropipeta, 5000uL"), y con él se perdía la unidad del material.
function _materialDeLinea(l) {
  if (l.ID_Material) {
    const porId = DATA.material.find(m => m.ID_Material === l.ID_Material);
    if (porId) return porId;
  }
  return DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
}

// Unidad de una línea: la elegida al pedirla (si el material tenía varios
// tipos), si no la del catálogo de material, si no la solicitud vinculada
function _unidadLineaPedido(l) {
  if (l.Unidad) return l.Unidad;
  const mat = _materialDeLinea(l);
  if (mat?.Unidad) return mat.Unidad;
  const solIdM = (l.Observaciones || '').match(/Desde solicitud (SOL\S+)/);
  if (solIdM) {
    const solVinc = DATA.solicitudes.find(s => s.ID_Solicitud === solIdM[1]);
    const uMatch = (solVinc?.Observaciones || '').match(/\[Unidad:\s*([^\]]+)\]/);
    if (uMatch) return uMatch[1].trim();
  }
  return '';
}

// modo 'pendientes' = solo las líneas metidas después de pedir el presupuesto
// (esas hay que solicitarlas aparte); si no, las que ya iban en el presupuesto
// solicitado, que es el email de siempre.
function generarTextoEmailPedido(pedidoId, modo) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return '';
  const soloPendientes = modo === 'pendientes';
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId && (l.Presupuesto_Pendiente === 'Sí') === soloPendientes);
  const prov = DATA.proveedores.find(x => x.Nombre_Proveedor === p.Proveedor);
  // Nos tuteamos con las comerciales: solo el nombre de pila, sin apellido.
  // Y saludo a la española: coma vocativa y punto al final, no coma.
  const nombrePila = (prov?.Persona_Contacto || '').trim().split(/\s+/)[0];
  const saludo = nombrePila ? `Hola, ${nombrePila}.` : 'Buenos días.';
  const cuerpoLineas = lineas.map(l => {
    const unidad = _unidadLineaPedido(l);
    return `- ${l.Material}: ${l.Cantidad_Pedida}${unidad ? ' ' + unidad : ''}`;
  }).join('\n');
  const intro = soloPendientes
    ? 'Os escribo para ampliar el pedido que ya os había solicitado (CIFP Manuel Antonio, departamento de Sanidade) con estos artículos adicionales:'
    : 'Os escribo para solicitar el siguiente pedido para el CIFP Manuel Antonio (departamento de Sanidade):';
  const cierre = soloPendientes
    ? 'Quedo a la espera de presupuesto/confirmación de estos artículos, que podéis sumar al pedido anterior.'
    : 'Quedo a la espera de presupuesto/confirmación.';
  return `${saludo}\n\n${intro}\n\n${cuerpoLineas}\n\n${cierre}\n\nMuchas gracias.`;
}

function abrirModalEmailPedido(pedidoId, modo) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  sv('email-ped-id', pedidoId);
  const prov = DATA.proveedores.find(x => x.Nombre_Proveedor === p.Proveedor);
  const email = (prov?.Email_Contacto || '').trim();
  document.getElementById('email-ped-para').textContent = email || 'Sin correo — añádelo en la ficha de la casa comercial';
  document.getElementById('email-ped-para').style.color = email ? '' : 'var(--text-muted)';
  document.getElementById('email-ped-copiar-para').style.display = email ? '' : 'none';
  document.getElementById('email-ped-texto').value = generarTextoEmailPedido(pedidoId, modo);
  document.getElementById('email-ped-asunto').textContent =
    `${p.Nombre_Lista}${modo === 'pendientes' ? ' (ampliación)' : ''} — CIFP Manuel Antonio, departamento de Sanidade`;
  openModal('modal-email-pedido');
}

async function _copiarAlPortapapeles(texto, aviso) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast(aviso, 'success');
}

function copiarTextoEmailPedido() {
  _copiarAlPortapapeles(document.getElementById('email-ped-texto').value, 'Texto copiado al portapapeles');
}

function copiarCampoEmailPedido(id, aviso) {
  _copiarAlPortapapeles(document.getElementById(id).textContent, aviso);
}

async function abrirModalLinkProveedor(pedidoId) {
  showLoading('Generando link...');
  try {
    const { token } = await callEdgeFunction('gestionar-pedido', { accion: 'generar_link_publico', id_pedido: pedidoId });
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
// Escribe dos cosas: el texto de la factura de cada línea para la hoja de
// pedido (conceptos_factura, ver _celdaConceptoFactura y _bloqueSinMatchEnHoja) y precio_unitario, en lote, vía
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

// Cómo llama la factura a esta línea. Si no coincide con el nombre con que se
// pidió, se ofrece guardarlo para la hoja de pedido (lineas_pedido.conceptos_factura)
// — en el resto de la app la línea conserva su nombre. Siempre desmarcado: en
// las facturas reales casi todas las líneas difieren (referencia, envase…) y
// solo algunas hace falta cambiarlas. El texto es editable porque la IA a
// veces arrastra referencias o códigos de más.
function _normConcepto(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
// Artículos de la factura que no son ninguna línea porque la casa comercial
// ha facturado el pedido con OTROS artículos (caso real: una "Reparación" de
// 716 € facturada como cámaras Neubauer, guantes y disolventes). Se guardan en
// el pedido (pedidos.hoja_factura): en la hoja salen en lugar de todas las
// líneas; las líneas, el inventario y la contabilidad no cambian.
function _bloqueSinMatchEnHoja(sinMatch, pedidoId, excluir) {
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  // Los ya sumados a una línea no cuentan: no sustituyen al pedido.
  if (!lineas.length || !(sinMatch || []).some((_, idx) => !excluir?.has(idx))) return '';
  const importeLineas = lineas.reduce((s, l) => s + (parseFloat(l.Precio_Unitario) || 0) * (parseFloat(l.Cantidad_Pedida) || 0), 0);
  return `<div style="margin-top:12px;padding:10px 14px;background:var(--accent-light);border-radius:var(--radius-sm);font-size:13px">
    <div style="font-weight:600;margin-bottom:6px">🧾 ¿La factura sustituye a todo el pedido?</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
      ${sinMatch.map((i, idx) => excluir?.has(idx) ? '' : `<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" class="revext-sm-check" data-idx="${idx}" checked onchange="_sumaSinMatchHoja()" style="width:14px;height:14px;margin-top:2px;flex:none"><span>${_escAttr(i.material)}${i.cantidad != null ? ` — ${i.cantidad}` : ''}${i.precio_unitario != null ? ` × ${Number(i.precio_unitario).toFixed(2)} €` : ''}</span></label>`).join('')}
    </div>
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <span id="revext-sm-suma" data-lineas="${importeLineas}" style="font-size:12px"></span>
      <button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="asignarSinMatchAHoja()">Usar en la hoja en lugar de las líneas →</button>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Solo cambia la hoja de pedido. Las líneas siguen igual en la app y nada entra en el inventario. En el paso siguiente puedes enlazar cada artículo a su material del catálogo para que su precio cuente en el precio medio. Se puede revisar o quitar después en la ficha del pedido → Hoja de pedido → «Los de la factura».</div>
  </div>`;
}

function _sumaSinMatchHoja() {
  const el = document.getElementById('revext-sm-suma');
  if (!el || !_revExtraccionActual) return;
  const items = Array.from(document.querySelectorAll('#revision-extraccion-contenido .revext-sm-check'))
    .filter(c => c.checked).map(c => _revExtraccionActual.r.sin_match[Number(c.dataset.idx)]).filter(Boolean);
  const suma = items.reduce((s, i) => s + (Number(i.precio_unitario) || 0) * (i.cantidad != null ? Number(i.cantidad) : 1), 0);
  const imp = Number(el.dataset.lineas) || 0;
  el.innerHTML = `Suma: <strong>${suma.toFixed(2)} €</strong> sin IVA${imp ? (Math.abs(suma - imp) < 0.01 ? ' · ✓ cuadra con el pedido' : ` · ⚠ las líneas suman ${imp.toFixed(2)} €`) : ''}`;
}

function _celdaConceptoFactura(m) {
  const textoFactura = String(m.item_detectado?.material || '').trim();
  if (!textoFactura) return '';
  const linea = DATA.lineasPedido.find(l => l.ID_Linea === m.id_linea);
  const conc = linea?.Conceptos_Factura || [];
  const actual = conc.length === 1 ? conc[0].concepto : '';
  if (conc.length > 1) return `<div style="margin-top:4px;font-size:11px;color:var(--text-muted)">🧾 En la hoja ya figura como ${conc.length} artículos de la factura (cámbialo con 🧾 en la línea)</div>`;
  if (!actual && _normConcepto(textoFactura) === _normConcepto(m.material_linea)) return '';
  const valor = actual || textoFactura;
  // Solo la casilla; el texto (editable) aparece al marcarla, para no llenar
  // la revisión de cajas que casi nunca se tocan.
  return `<label style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;color:var(--text-muted)">
      <input type="checkbox" class="revext-concepto-check" data-id-linea="${m.id_linea}" style="width:14px;height:14px;flex:none" onchange="this.closest('td').querySelector('.revext-concepto').style.display=this.checked?'':'none'">
      🧾 En la hoja como en la factura
    </label>
    <input type="text" class="revext-concepto" data-id-linea="${m.id_linea}" value="${_escAttr(valor)}" style="display:none;width:100%;font-size:12px;margin-top:2px">`;
}

// Un artículo de la factura sin pareja que ya se sumó a mano a una línea
// (desplegable «¿asignar a una línea?» o 🧾 de la línea). La asignación en sí
// no se guarda —solo el precio y, si se quiso, el texto para la hoja—, así que
// se deduce: el artículo figura entre los textos de factura de la línea, o el
// precio guardado de la línea es el leído por la IA más el de este artículo.
// Sin esto la fila volvía a salir en rojo «Sin línea» cada vez y se reasignaba
// una y otra vez (2026-11-25, PEDLG75G9: sonda PT100 ya sumada al termómetro).
function _lineaQueYaIncluye(item, pedidoId, r) {
  const tokens = s => new Set(_normConcepto(s).split(' ').filter(Boolean));
  const parecido = (a, b) => {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return false;
    let comunes = 0; A.forEach(t => { if (B.has(t)) comunes++; });
    return comunes / (A.size + B.size - comunes) >= 0.8;
  };
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const porTexto = lineas.find(l => (l.Conceptos_Factura || []).some(c => parecido(c.concepto, item.material)));
  if (porTexto) return porTexto;
  const precioItem = Number(item.precio_unitario);
  if (!(precioItem > 0)) return null;
  return lineas.find(l => {
    const guardado = parseFloat(l.Precio_Unitario);
    const leido = (r.matches || []).find(m => m.id_linea === l.ID_Linea)?.item_detectado?.precio_unitario;
    return !isNaN(guardado) && leido != null && Math.abs(guardado - (Number(leido) + precioItem)) < 0.01;
  }) || null;
}

function abrirModalRevisionExtraccion(idDocumento, pedidoId) {
  const doc = DATA.documentosProveedor.find(d => d.ID_Documento === idDocumento);
  const r = doc?.Datos_Extraidos;
  sv('revext-pedido-id', pedidoId);
  _revExtraccionActual = { idDocumento, pedidoId, r };
  const cont = document.getElementById('revision-extraccion-contenido');
  if (!r) { cont.innerHTML = `<div class="empty-state" style="padding:24px">Todavía no se ha leído este documento.</div>`; openModal('modal-revision-extraccion'); return; }

  // Una fila por artículo de la FACTURA, en su mismo orden, para ir bajando a
  // la vez por el PDF (izquierda) y por aquí. Cada fila dice a qué línea del
  // pedido la asignó la IA; las que no tienen línea se tratan más abajo.
  const usados = new Set();
  const matchDe = (it) => (r.matches || []).find((m, i) => {
    if (usados.has(i) || m.item_detectado?.material !== it.material) return false;
    usados.add(i); return true;
  });
  const items = (r.items || []).length ? r.items : (r.matches || []).map(m => m.item_detectado || {});
  const filasMatch = items.map((itemFactura, n) => {
    const m = matchDe(itemFactura);
    const it = m?.item_detectado || itemFactura;
    const unidad = it.unidad ? ' ' + it.unidad : '';
    const precioFactura = it.precio_envase_original ?? it.precio_unitario;
    const factura = `<div style="font-weight:500">${_escAttr(itemFactura.material || '')}</div>
      <div class="revext-fila-factura">${itemFactura.cantidad ?? '—'}${unidad} × ${precioFactura != null ? Number(precioFactura).toFixed(2) + ' €' : '—'}</div>`;
    if (!m) {
      // La IA suma en UNA línea los renglones repetidos de la factura (p. ej.
      // bandejas 12 + 3): el segundo no es "sin línea", va en la fila de arriba.
      if ((r.matches || []).some(mm => mm.item_detectado?.material === itemFactura.material)) {
        return `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 8px;color:var(--text-muted);text-align:center;vertical-align:top;font-size:11px">${n + 1}</td>
          <td style="padding:6px 8px;vertical-align:top">${factura}</td>
          <td style="padding:6px 8px;color:var(--text-muted);font-size:12px" colspan="2">↑ La IA lo ha sumado a la misma línea que la fila de arriba con este artículo</td>
        </tr>`;
      }
      // Sin pareja: se puede asignar a mano a una línea para guardar su precio
      // (la IA falla a veces: la sonda del termómetro, un patrón McFarland…).
      const lineasPed = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
      const precioItem = itemFactura.precio_unitario;
      // Ni emparejado por texto ni en sin_match: la IA lo juntó con otro
      // artículo en una línea, sumando cantidades y PROMEDIANDO precios
      // (PEDLG75G9: dos patrones McFarland 50,90 y 129,70 → 90,30).
      const sumadoAOtra = !(r.sin_match || []).some(s => s.material === itemFactura.material);
      // Ya sumado antes a una línea: sale con esa línea elegida y sin rojo; la
      // casilla sigue bloqueada (su precio suelto pisaría la suma guardada)
      // hasta que se vuelva a elegir línea en el desplegable.
      const yaEn = _lineaQueYaIncluye(itemFactura, pedidoId, r);
      const notaInicial = yaEn
        ? `✓ Ya va con esta línea${yaEn.Precio_Unitario ? ` (guardado: ${Number(yaEn.Precio_Unitario).toFixed(2)} €)` : ''}. No hace falta volver a asignarlo.`
        : sumadoAOtra ? '⚠ La IA lo ha juntado con otro artículo en una línea, promediando el precio. Revisa esa fila o asígnalo aquí a su línea.' : '';
      return `<tr style="border-bottom:1px solid var(--border)${yaEn ? '' : ';background:var(--danger-light,#fdf0f0)'}">
        <td style="padding:6px 8px;text-align:center;vertical-align:top"><div style="font-size:11px;color:var(--text-muted)">${n + 1}</div><input type="checkbox" class="revext-asig-check" data-n="${n}" disabled style="width:16px;height:16px"></td>
        <td style="padding:6px 8px;vertical-align:top">${factura}</td>
        <td style="padding:6px 8px;vertical-align:top">
          <select class="revext-asig-linea" data-n="${n}" onchange="_revextAsignarLinea(${n})" style="width:100%;font-size:12px">
            <option value="">Sin línea — ¿asignar a una línea?</option>
            ${lineasPed.map(l => `<option value="${l.ID_Linea}"${yaEn?.ID_Linea === l.ID_Linea ? ' selected' : ''}>${_escAttr(String(l.Material || '').slice(0, 60))}${l.Precio_Unitario ? ` · ${Number(l.Precio_Unitario).toFixed(2)} €` : ' · sin precio'}</option>`).join('')}
          </select>
          <div class="revext-asig-nota" data-n="${n}" style="font-size:11px;color:var(--text-muted);margin-top:3px">${notaInicial}</div></td>
        <td style="padding:6px 8px;text-align:right;vertical-align:top"><input type="number" class="revext-asig-precio" data-n="${n}" data-precio-item="${precioItem ?? ''}" min="0" step="0.01" value="${precioItem ?? ''}" style="width:90px;text-align:right"></td>
      </tr>`;
    }
    const tienePrecio = it.precio_unitario != null;
    // Si la línea ya tiene precio guardado (otra revisión o una corrección a
    // mano, p. ej. termómetro + sonda), la fila sale DESMARCADA: volver a
    // guardar lo leído por la IA desharía esa corrección.
    const precioGuardado = parseFloat(DATA.lineasPedido.find(l => l.ID_Linea === m.id_linea)?.Precio_Unitario);
    const yaGuardado = !isNaN(precioGuardado) && precioGuardado > 0;
    const marcado = tienePrecio && !yaGuardado;
    const notaGuardado = yaGuardado
      ? `<div style="font-size:11px;color:var(--text-muted)">${Math.abs(precioGuardado - (it.precio_unitario ?? NaN)) < 0.005 ? '✓ ya guardado' : `guardado: ${precioGuardado.toFixed(2)} €`}</div>`
      : '';
    // Sin semáforo rojo/verde: no hay forma de saber desde la factura si esta
    // línea se cuenta por unidad suelta o por envase (eso es un criterio tuyo).
    // Si el servidor dividió el precio del envase entre sus unidades
    // (ajustarPrecioPorEnvase en leer-documento-proveedor) se explica aquí.
    const precioPorUnidad = it.precio_envase_original != null
      ? `<div style="font-size:11px;color:var(--success,#16a34a)">${it.precio_envase_original.toFixed(2)} € ÷ ${it.unidades_por_envase} = ${it.precio_unitario.toFixed(2)} €/ud</div>`
      : '';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 8px;text-align:center;vertical-align:top"><div style="font-size:11px;color:var(--text-muted)">${n + 1}</div><input type="checkbox" class="revext-check" data-id-linea="${m.id_linea}" ${marcado ? 'checked' : ''} ${tienePrecio ? '' : 'disabled'} style="width:16px;height:16px"></td>
      <td style="padding:6px 8px;vertical-align:top">${factura}</td>
      <td style="padding:6px 8px;vertical-align:top">→ ${_escAttr(m.material_linea)}
        <div class="revext-fila-factura">pedido ${m.cantidad_pedida ?? '—'} · recibido ${m.cantidad_recibida || 0}</div>${_celdaConceptoFactura(m)}</td>
      <td style="padding:6px 8px;text-align:right;vertical-align:top"><input type="number" class="revext-precio" data-id-linea="${m.id_linea}" min="0" step="0.01" value="${tienePrecio ? it.precio_unitario : ''}" style="width:90px;text-align:right">${precioPorUnidad}${notaGuardado}</td>
    </tr>`;
  }).join('');

  const tabla = items.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:2px solid var(--border)">
      <th style="padding:6px 8px"></th>
      <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">En la factura</th>
      <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-weight:600">Línea del pedido</th>
      <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-weight:600">€/ud sin IVA</th>
    </tr></thead>
    <tbody>${filasMatch}</tbody>
  </table>` : `<div class="empty-state" style="padding:16px">No se detectó ningún artículo en el documento.</div>`;

  const pedido = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const puedeAnadirDesdeFactura = true; // la línea nueva se añade como material; el tipo es de cada línea
  // Los ya sumados a mano a una línea dejan de contar como "sin línea".
  const yaIncluidos = new Set((r.sin_match || []).map((i, idx) => _lineaQueYaIncluye(i, pedidoId, r) ? idx : -1).filter(idx => idx !== -1));
  const sinMatch = (r.sin_match || []).length > yaIncluidos.size ? `<div style="margin-top:16px;padding:10px 14px;background:var(--danger-light,#fdf0f0);border-radius:var(--radius-sm);font-size:13px">
    <div style="font-weight:600;margin-bottom:6px">⚠️ Detectado en el documento pero sin línea de pedido coincidente:</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${r.sin_match.map((i, idx) => yaIncluidos.has(idx) ? '' : `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <span>${i.material}${i.cantidad != null ? ` — ${i.cantidad}${i.unidad ? ' ' + i.unidad : ''}` : ''}</span>
        ${puedeAnadirDesdeFactura ? `<button class="btn btn-secondary" style="font-size:11px;padding:3px 10px;white-space:nowrap" onclick="anadirLineaDesdeSinMatch(${idx})">+ Añadir línea nueva</button>` : ''}
      </div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Si en realidad es una de tus líneas y la IA no la ha reconocido, asígnala arriba en su fila («¿asignar a una línea?») y su precio se guardará con los demás. Usa "+ Añadir línea nueva" solo si de verdad llegó algo que no estaba en el pedido (p.ej. un reactivo no contemplado en el presupuesto). Esto funciona aunque el pedido ya no admita añadir líneas a mano.</div>
  </div>${_bloqueSinMatchEnHoja(r.sin_match, pedidoId, yaIncluidos)}` : '';

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

  // Si el modelo principal estaba saturado, la leyó el de respaldo (más ligero).
  const avisoRespaldo = /lite/i.test(r.modelo_ia || '')
    ? `<div style="margin-bottom:10px;padding:8px 12px;border-radius:var(--radius-sm);background:#fef3c7;color:#92400e;font-size:12px">⚠ La IA principal estaba saturada y esta factura la ha leído el modelo de respaldo (${_escAttr(r.modelo_ia)}), más ligero. Revisa los precios con un poco más de cuidado, o vuelve a leerla 🔄 más tarde.</div>`
    : '';
  cont.innerHTML = avisoRespaldo + tabla + sinMatch + cargoExtra + datosFactura;
  _sumaSinMatchHoja();
  openModal('modal-revision-extraccion');
  _cargarVisorFactura(doc);
}

// Un artículo sin pareja asignado a mano a una línea. Si esa línea ya tiene
// precio en una fila de arriba (termómetro «sin sonda» + sonda aparte), se
// propone la suma; si no, el precio del artículo. Se guarda con lo demás.
function _revextAsignarLinea(n) {
  const cont = document.getElementById('revision-extraccion-contenido');
  const sel = cont.querySelector(`.revext-asig-linea[data-n="${n}"]`);
  const chk = cont.querySelector(`.revext-asig-check[data-n="${n}"]`);
  const inp = cont.querySelector(`.revext-asig-precio[data-n="${n}"]`);
  const nota = cont.querySelector(`.revext-asig-nota[data-n="${n}"]`);
  const idLinea = sel.value;
  const base = parseFloat(inp.dataset.precioItem);
  chk.disabled = !idLinea;
  chk.checked = !!idLinea;
  nota.textContent = '';
  if (!idLinea) { inp.value = isNaN(base) ? '' : base; return; }
  const arriba = cont.querySelector(`.revext-precio[data-id-linea="${idLinea}"]`);
  const precioArriba = arriba ? parseFloat(arriba.value) : NaN;
  if (!isNaN(precioArriba) && !isNaN(base)) {
    inp.value = Math.round((precioArriba + base) * 100) / 100;
    nota.textContent = `Esa línea ya tiene ${precioArriba.toFixed(2)} € arriba: se guarda la suma (${precioArriba.toFixed(2)} + ${base.toFixed(2)}). Cambia la cifra si no es así.`;
    return;
  }
  inp.value = isNaN(base) ? '' : base;
  const linea = DATA.lineasPedido.find(l => l.ID_Linea === idLinea);
  if (linea?.Precio_Unitario) nota.textContent = `La línea tenía ${Number(linea.Precio_Unitario).toFixed(2)} €: se sustituye por este precio.`;
}

// Lado izquierdo de la revisión: la propia factura. PDF en <iframe> (visor del
// navegador), imagen en <img>. En móvil el visor se oculta por CSS y queda un
// botón para abrirla aparte.
async function _cargarVisorFactura(doc) {
  const visor = document.getElementById('revext-visor');
  const abrir = document.getElementById('revext-abrir-movil');
  if (!visor) return;
  visor.innerHTML = '<div class="empty-state" style="padding:24px">Cargando la factura…</div>';
  abrir.innerHTML = '';
  if (!doc?.Path) { visor.innerHTML = '<div class="empty-state" style="padding:24px">No se encuentra el archivo de la factura.</div>'; return; }
  try {
    const url = await urlDocumento(doc.Path);
    const esImagen = /\.(png|jpe?g|webp|gif)$/i.test(doc.Nombre_Archivo || doc.Path);
    visor.innerHTML = esImagen
      ? `<img src="${_escAttr(url)}" alt="Factura">`
      : `<iframe src="${_escAttr(url)}#view=FitH&navpanes=0" title="Factura"></iframe>`;
    abrir.innerHTML = `<button class="btn btn-secondary" style="width:100%" onclick="window.open('${_escAttr(url)}','_blank')">📄 Ver la factura</button>`;
  } catch (e) {
    visor.innerHTML = `<div class="empty-state" style="padding:24px">No se pudo cargar la factura: ${_escAttr(e.message || '')}</div>`;
  }
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
  setSourceLinea('libre', { reset: true });
  sv('linea-material-libre', it.material);
  _mostrarAvisoNoCat('linea', 'Se añadirá como material no catalogado.');
  sv('linea-material-unidades', it.unidad || '');
  sv('linea-cantidad', it.cantidad != null ? it.cantidad : '');
  sv('linea-precio', it.precio_unitario != null ? it.precio_unitario : '');
  sv('linea-obs', `No estaba en el pedido — detectada en ${doc?.Nombre_Archivo || 'el documento'} leído con IA`);
}

// Una fila de línea del detalle. Se usa tanto para las líneas normales como
// para las del apartado "Pendientes de pedir presupuesto" — son idénticas, lo
// único que cambia es dónde se pintan.
function _filaLineaPedido(l, p, puedeEditar) {
  const pedidoId = p.ID_Pedido;
  let unidadLinea = _unidadLineaPedido(l);
  unidadLinea = unidadLinea ? ' ' + unidadLinea : '';
  const estadoLinea = {'Pendiente':'badge-orange','Recibido parcialmente':'badge-blue','Recibido':'badge-green'}[l.Estado_Linea] || 'badge-gray';
  const puedeEliminar = puedeEditar && l.Estado_Linea === 'Pendiente';
  const equipoVinc = l.ID_Equipo ? DATA.equipos.find(e => e.ID_Activo === l.ID_Equipo) : null;
  // Material común: lo hereda de la ficha; el 🤝 de la línea lo cambia solo aquí.
  const esServicio = l.Tipo_Linea === 'Servicio';
  const esEquipo = l.Tipo_Linea === 'Equipo';
  const esComun = lineaEsComun(l); // false en equipo o servicio
  // Material recibido sin ficha en el catálogo: no entró en el inventario.
  const sinFichaRecibida = l.Tipo_Linea === 'Material' && !l.Sin_Inventario && !l.ID_Material
    && (parseFloat(l.Cantidad_Recibida) || 0) > 0 && !_materialDeLinea(l);
  // Servicio unido a su intervención: se da por realizado al cerrar la actuación.
  const interv = esServicio && l.ID_Intervencion ? DATA.intervenciones.find(i => i.ID_Intervencion === l.ID_Intervencion) : null;
  const intIdx = interv ? DATA.intervenciones.indexOf(interv) : -1;
  const infoServicio = !esServicio ? '' : interv
    ? `<div style="font-size:11px;margin-top:2px"><a href="#" onclick="openFichaIntervencion(${intIdx});return false">🔧 ${interv.ID_Intervencion} · ${_escAttr(interv.Tipo || '')} · ${_escAttr(interv.Estado || '')}</a> <span style="color:var(--text-muted)">— se da por realizado al cerrar la actuación</span></div>`
    : `<div style="font-size:11px;margin-top:2px;color:var(--warning,#b45309)">⚠ Sin intervención${puedeEditar ? ` · <a href="#" onclick="openModalUnirIntervencion('${l.ID_Linea}','${pedidoId}');return false">🔗 Unir</a>` : ''}</div>`;
  return `<div class="linea-row">
    <div class="linea-nombre">${l.Material}${(l.Conceptos_Factura || []).length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px" title="Solo en la hoja de pedido: así figura en la factura">🧾 En la hoja, como en la factura: ${l.Conceptos_Factura.map(c => _escAttr(c.concepto) + (c.cantidad != null ? ` ×${c.cantidad}` : '')).join(' · ')}</div>` : ''}${equipoVinc && !interv ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esEquipo ? '🖥️' : '🔧'} ${equipoVinc.ID_Activo} — ${[equipoVinc.Tipo_Equipo,equipoVinc.Marca,equipoVinc.Modelo].filter(Boolean).join(' ')}</div>` : ''}${infoServicio}</div>
    <div class="linea-meta">
      <span>Ped: ${l.Cantidad_Pedida}${unidadLinea}</span>
      <span style="color:var(--text)">Rec: ${l.Cantidad_Recibida||'0'}${unidadLinea}</span>${l.Albaranes ? `
      <span style="color:var(--text-muted);font-size:11px" title="Albarán en que llegó">🧾 ${_escAttr(l.Albaranes)}</span>` : ''}
      <span class="badge ${estadoLinea}" style="font-size:10px">${l.Estado_Linea||'Pendiente'}</span>
      ${esServicio ? `<span class="badge badge-blue" style="font-size:10px">🔧 Servicio</span>` : ''}
      ${esEquipo ? `<span class="badge badge-blue" style="font-size:10px" title="Compra de un equipo: no entra en el inventario de fungibles">🖥️ Equipo</span>` : ''}
      ${l.Sin_Inventario && !esServicio && !esEquipo ? `<span class="badge badge-gray" style="font-size:10px" title="Se registra como recibido, pero no entra en el inventario">🚫 Sin inventario</span>` : ''}
      ${esComun ? `<span class="badge badge-purple" style="font-size:10px" title="Va a la partida &quot;${CICLO_MATERIAL_COMUN}&quot; y, en Trebello, a su propia hoja">🤝 Común</span>` : ''}
    </div>
    <div class="linea-actions">
      ${puedeEditar && !esServicio && !esEquipo ? `<button class="icon-btn" title="${esComun ? 'Quitar de material común (solo esta línea)' : 'Marcar como material común (solo esta línea)'}" onclick="toggleLineaComun('${l.ID_Linea}','${pedidoId}')" style="${esComun ? '' : 'opacity:.45'}">🤝</button>` : ''}
      ${puedeEditar ? `<button class="icon-btn" title="Cómo se nombra en la hoja de pedido (otra forma de expresarlo, referencias…)" onclick="openModalConceptoFactura('${l.ID_Linea}','${pedidoId}')" style="${(l.Conceptos_Factura || []).length ? '' : 'opacity:.45'}">🧾</button>` : ''}
      ${puedeEditar && (l.Estado_Linea || 'Pendiente') === 'Pendiente' ? `<button class="icon-btn" title="Editar línea" onclick="openModalEditarLinea('${l.ID_Linea}','${pedidoId}')">✏️</button>` : ''}
      ${puedeEditar && !interv && l.Estado_Linea !== 'Recibido' && ['Presupuesto aprobado','Recepción parcial','Recepción completa'].includes(p.Estado) ? `<button class="icon-btn" title="Registrar recepción" onclick="openModalRecepcion('${l.ID_Linea}','${pedidoId}')">📥</button>` : ''}
      ${puedeEditar && sinFichaRecibida ? `<button class="icon-btn" title="Se recibió sin ficha en el catálogo, así que no entró en el inventario. Darle ficha y meter lo recibido" onclick="darFichaLineaRecibida('${l.ID_Linea}','${pedidoId}')">🏷️</button>` : ''}
      ${puedeEliminar ? `<button class="icon-btn danger" title="Eliminar línea" onclick="eliminarLineaPedido('${l.ID_Linea}','${pedidoId}')">🗑️</button>` : ''}
    </div>
  </div>`;
}

// "716.00 € · ✓ cuadra con las líneas" — para la franja de "Hoja de pedido".
function _resumenHojaFactura(p) {
  const suma = (p.Hoja_Factura || []).reduce((s, c) => s + (Number(c.precio_unitario) || 0) * (c.cantidad != null ? Number(c.cantidad) : 1), 0);
  const imp = DATA.lineasPedido.filter(l => l.Pedido === p.ID_Pedido)
    .reduce((s, l) => s + (parseFloat(l.Precio_Unitario) || 0) * (parseFloat(l.Cantidad_Pedida) || 0), 0);
  const conPrecio = (p.Hoja_Factura || []).filter(c => c.id_historico).length;
  const precios = conPrecio ? ` · 📦 ${conPrecio} con precio en el histórico` : '';
  return `${suma.toFixed(2)} € sin IVA${imp ? (Math.abs(suma - imp) < 0.01 ? ' · ✓ cuadra con las líneas' : ` · ⚠ las líneas suman ${imp.toFixed(2)} €`) : ''}${precios}`;
}

function verDetallePedido(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const docsProv = DATA.documentosProveedor.filter(d => d.Pedido === pedidoId);
  const puedeEditar  = getUserRole() === 'Administrador' || getUserRole() === 'Gestor';
  const puedeAddLinea = ['Abierto','Presupuesto solicitado'].includes(p.Estado) && puedeEditar;
  // Líneas metidas cuando el presupuesto ya estaba solicitado: van en su propio
  // apartado hasta que se les pide presupuesto aparte (ver el bloque
  // "Pendientes de pedir presupuesto" más abajo y marcarPresupuestoSolicitado).
  const lineasPendientes  = lineas.filter(l => l.Presupuesto_Pendiente === 'Sí');
  const lineasSolicitadas = lineas.filter(l => l.Presupuesto_Pendiente !== 'Sí');
  const cont = document.getElementById('pedido-detalle-contenido');
  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div><div class="card-title">${p.Nombre_Lista}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${p.ID_Pedido}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          ${DATA.lineasPedido.some(l => l.Pedido === p.ID_Pedido && l.Tipo_Linea !== 'Material') ? `<span class="badge badge-blue" style="font-size:10px" title="Lleva algún equipo o servicio">🔧 Equipo/servicio</span>` : ''}
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
      ${puedeEditar ? (() => {
        // Orden = orden real del trámite: primero llega la factura del proveedor,
        // luego se prepara la hoja. Las dos vías (Trebello / hoja a mano) son
        // alternativas. Ver "Ficha del pedido: documentación" en docs/modulo-pedidos.md.
        const enTrebello = !!(p.Trebello_Pedido_Id || p.Trebello_Pedido_Comun_Id);
        const hojaGenerada = p.Doc_Hoja_Generada === 'TRUE';
        const enviadaAMano = !enTrebello && p.Doc_Enviada_Jefatura === 'TRUE';
        const conHojaFactura = (p.Hoja_Factura || []).length > 0;
        const tit = t => `<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">${t}</div>`;
        const btn = 'class="btn btn-secondary" style="font-size:12px;padding:4px 12px"';
        // Con una vía hecha, la otra se atenúa (sigue usable).
        const tarjeta = (activa, atenuada, cuerpo) => `<div style="border:1.5px solid ${activa ? 'var(--success)' : 'var(--border)'};border-radius:var(--radius-sm);padding:12px 14px;display:flex;flex-direction:column;gap:8px;${atenuada ? 'opacity:.55' : ''}">${cuerpo}</div>`;
        return `<div style="padding:0 20px 16px 20px;border-top:1px solid var(--border);margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-top:14px;flex-wrap:wrap;gap:8px">
          ${tit('1 · Documentación del proveedor')}
          <button ${btn} onclick="abrirModalLinkProveedor('${pedidoId}')">🔗 Link para proveedor</button>
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
          </div>` : `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Pulsa "🔗 Link para proveedor" y compártelo con la casa comercial.</div>`}

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-top:14px;margin-top:16px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px">
          ${tit('2 · Hoja de pedido')}
          ${lineas.length ? `<button ${btn} onclick="abrirModalPrecios('${p.ID_Pedido}')">💶 Precios</button>` : ''}
        </div>
        ${lineas.length ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">¿Qué artículos salen en la hoja?</div>
        <div class="toggle-source" style="max-width:460px;margin-bottom:${conHojaFactura ? '8px' : '14px'}">
          <button class="${conHojaFactura ? '' : 'active'}" onclick="elegirArticulosHoja('${p.ID_Pedido}','lineas')">Las líneas del pedido</button>
          <button class="${conHojaFactura ? 'active' : ''}" onclick="elegirArticulosHoja('${p.ID_Pedido}','factura')" title="Cuando la casa comercial factura el pedido con otros artículos">Los de la factura</button>
        </div>
        ${conHojaFactura ? `<div style="font-size:13px;padding:8px 12px;margin-bottom:14px;background:var(--accent-light);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <span>🧾 <strong>${p.Hoja_Factura.length} artículos de la factura</strong> en lugar de las líneas · ${_resumenHojaFactura(p)}</span>
          <button class="btn btn-secondary" style="font-size:11px;padding:2px 10px" onclick="openModalHojaFactura('${p.ID_Pedido}')">✏️ Revisar</button>
        </div>` : ''}` : ''}

        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">¿Cómo se tramita? Una de las dos:</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">
          ${tarjeta(enTrebello, enviadaAMano, `
            <div style="font-weight:600;font-size:13px">📤 Por Trebello</div>
            <div style="font-size:12px;color:var(--text-muted)">Deposita el pedido y las facturas en Compras de Trebello. La hoja la genera y la firma allí la jefa: no hace falta generarla aquí. Al enviarlo, el pedido se da por terminado y se archiva.</div>
            ${enTrebello ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap">
                <span style="color:var(--success);font-weight:500">✓ Enviado${p.Trebello_Pedido_Id && p.Trebello_Pedido_Comun_Id ? ' (2 hojas)' : ''}${p.Fecha_Envio_Trebello ? ` · ${formatDate(p.Fecha_Envio_Trebello.slice(0,10))}` : ''}</span>
                <a href="${TREBELLO_URL}/gl/compras?tab=pedidos" target="_blank" rel="noopener" class="btn btn-secondary" style="font-size:11px;padding:2px 10px;text-decoration:none">↗ Ver en Trebello</a>
              </div>
              <button class="btn btn-secondary" style="font-size:11px;padding:2px 10px;align-self:flex-start" onclick="enviarPedidoATrebello('${p.ID_Pedido}')" title="Solo si has cambiado algo del pedido después de enviarlo">↻ Actualizar en Trebello</button>`
            : (lineas.length ? `<button class="btn btn-primary" style="font-size:12px;padding:4px 12px;align-self:flex-start" onclick="enviarPedidoATrebello('${p.ID_Pedido}')">📤 Enviar a Trebello</button>`
              : `<div style="font-size:12px;color:var(--text-muted)">Añade primero las líneas del pedido.</div>`)}`)}
          ${tarjeta(enviadaAMano, enTrebello, `
            <div style="font-weight:600;font-size:13px">📄 Hoja a mano</div>
            <div style="font-size:12px;color:var(--text-muted)">Generas tú la hoja de pedido y la mandas a secretaría.</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <button class="btn ${hojaGenerada || enTrebello ? 'btn-secondary' : 'btn-primary'}" style="font-size:12px;padding:4px 12px" onclick="abrirGeneradorHoja('${p.ID_Pedido}')">📄 ${hojaGenerada ? 'Volver a generar' : 'Generar hoja'}</button>
              ${p.Doc_Hoja_Path ? `<button class="btn btn-secondary" style="font-size:11px;padding:2px 10px" onclick="abrirDocumento('${p.Doc_Hoja_Path}')">📥 Abrir hoja</button>` : ''}
            </div>
            ${enTrebello ? '' : `<label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer" title="Al marcarla el pedido se da por terminado y se archiva">
              <input type="checkbox" id="chk-enviada-jefatura" ${p.Doc_Enviada_Jefatura==='TRUE'?'checked':''} onchange="toggleDocPedido('${p.ID_Pedido}','Doc_Enviada_Jefatura',this.checked)" style="width:16px;height:16px">
              <span style="${p.Doc_Enviada_Jefatura==='TRUE'?'color:var(--success);font-weight:500':'color:var(--text-soft)'}">📬 Ya la he enviado a secretaría</span>
            </label>
            <div style="font-size:11px;color:var(--text-muted)">Al marcarla, el pedido se da por terminado y se archiva.</div>`}`)}
        </div>

        ${p.Estado!=='Archivado' && (enTrebello || p.Doc_Enviada_Jefatura==='TRUE') ? `<div style="margin-top:14px"><button class="btn btn-secondary" onclick="_darPedidoPorTerminado('${p.ID_Pedido}')">📦 Archivar pedido</button></div>` : ''}
        ${p.Estado==='Archivado' ? `<div style="margin-top:18px;padding:10px 14px;border:1.5px dashed var(--danger,#dc2626);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--text-muted)">⚠️ <strong style="color:var(--danger,#dc2626)">Solo en casos muy excepcionales:</strong> el pedido está tramitado y terminado. Sácalo del archivo únicamente si se archivó por error.</span>
          <button class="btn btn-secondary" style="font-size:11px;padding:2px 10px;color:var(--danger,#dc2626);border-color:var(--danger,#dc2626)" onclick="desarchivarPedido('${p.ID_Pedido}')">↩︎ Desarchivar</button>
        </div>` : ''}
      </div>`;
      })() : ''}
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Líneas del pedido (${lineas.length})</div>
        <div style="display:flex;gap:8px">
          ${puedeEditar && lineasSolicitadas.length ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="abrirModalEmailPedido('${pedidoId}')">✉️ Email al proveedor</button>` : ''}
          ${puedeEditar && ['Presupuesto aprobado','Recepción parcial'].includes(p.Estado) && lineas.some(l => l.Estado_Linea !== 'Recibido') ? `<button class="btn btn-primary" style="font-size:12px;padding:4px 12px" onclick="openModalRecepcionMasiva('${pedidoId}')">📥 Recibir albarán</button>` : ''}
          ${puedeAddLinea ? `<button class="btn btn-secondary" onclick="openModalNuevaLinea('${pedidoId}')">+ Añadir línea</button>` : ''}
        </div>
      </div>
      <div style="padding:12px 16px">
        ${!lineas.length ? `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📝</div><div class="empty-state-title">Sin líneas todavía</div></div>` :
          lineasSolicitadas.map(l => _filaLineaPedido(l, p, puedeEditar)).join('')}
        ${lineasPendientes.length ? `<div style="margin-top:${lineasSolicitadas.length ? '18px' : '0'};border:1px solid var(--warning);border-radius:var(--radius-sm);overflow:hidden">
          <div style="padding:10px 14px;background:var(--warning-light);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--warning)">⏳ Pendientes de pedir presupuesto (${lineasPendientes.length})</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:3px;max-width:52ch">Se añadieron después de solicitar el presupuesto, así que no van en el que ya pediste: hay que solicitarlas aparte. Cuando lo hagas, márcalas y se juntan con el resto.</div>
            </div>
            ${puedeEditar ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-secondary" style="font-size:12px;padding:4px 12px;white-space:nowrap" onclick="abrirModalEmailPedido('${pedidoId}','pendientes')">✉️ Email de ampliación</button>
              <button class="btn btn-primary" style="font-size:12px;padding:4px 12px;white-space:nowrap" onclick="marcarPresupuestoSolicitado('${pedidoId}')">✅ Ya las he solicitado</button>
            </div>` : ''}
          </div>
          <div style="padding:6px 14px 10px 14px">
            ${lineasPendientes.map(l => _filaLineaPedido(l, p, puedeEditar)).join('')}
          </div>
        </div>` : ''}
      </div>
    </div>`;
  showPage('pedido-detalle');
}

// ============================================================
// MODALES PEDIDOS / SOLICITUDES
// ============================================================
// ── Servicio ↔ intervención (2026-11-19) ──────────────────────────────
// Un servicio de un pedido es la parte económica de una intervención sobre un
// equipo existente. Al elegir el equipo se ofrecen sus intervenciones (también
// las cerradas: la factura suele llegar después) o crear una nueva.
const _idEquipoDeIntervencion = i => (i.Equipo || '').split(' – ')[0].trim();

function _intervencionesDeEquipo(idEquipo) {
  return DATA.intervenciones
    .filter(i => _idEquipoDeIntervencion(i) === idEquipo)
    .sort((a, b) => String(b.Fecha_Realizacion || b.Fecha_Planificada || '').localeCompare(String(a.Fecha_Realizacion || a.Fecha_Planificada || '')))
    .slice(0, 10);
}

function _htmlOpcionesIntervencion(idEquipo, name, conNueva, onchange) {
  const lista = _intervencionesDeEquipo(idEquipo);
  const fila = (valor, html, marcada) => `<label style="display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;font-size:13px">
      <input type="radio" name="${name}" value="${valor}" ${marcada ? 'checked' : ''} onchange="${onchange || ''}" style="margin-top:3px;flex:none"><span>${html}</span></label>`;
  const opciones = lista.map(i => {
    const fecha = formatDate(i.Fecha_Realizacion || i.Fecha_Planificada) || 'sin fecha';
    const yaEnPedido = DATA.lineasPedido.some(l => l.ID_Intervencion === i.ID_Intervencion);
    return fila(i.ID_Intervencion, `<strong>${i.ID_Intervencion}</strong> · ${_escAttr(i.Tipo || '—')} · ${fecha} · ${_escAttr(i.Estado || '')}${i.Proveedor ? ' · ' + _escAttr(i.Proveedor) : ''}
      ${i.Descripcion_Actuacion ? `<div style="font-size:11px;color:var(--text-muted)">${_escAttr(i.Descripcion_Actuacion.slice(0, 90))}</div>` : ''}
      ${yaEnPedido ? '<div style="font-size:11px;color:var(--warning,#b45309)">Ya está en un pedido</div>' : ''}`, false);
  }).join('');
  const nueva = conNueva ? fila('nueva', '＋ <strong>Nueva intervención</strong> <span style="font-size:11px;color:var(--text-muted)">(queda planificada en el equipo)</span>', !lista.length) : '';
  return (opciones || '<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Este equipo no tiene intervenciones todavía.</div>') + nueva;
}

function _pintarIntervencionesLinea(idEquipo) {
  const grupo = document.getElementById('linea-interv-group');
  if (!idEquipo) { grupo.style.display = 'none'; document.getElementById('linea-interv-tipo-group').style.display = 'none'; return; }
  document.getElementById('linea-interv-lista').innerHTML = _htmlOpcionesIntervencion(idEquipo, 'linea-interv', true, '_onElegirIntervencionLinea()');
  grupo.style.display = '';
  _onElegirIntervencionLinea();
}

function _onElegirIntervencionLinea() {
  const elegida = document.querySelector('input[name="linea-interv"]:checked')?.value || '';
  document.getElementById('linea-interv-tipo-group').style.display = elegida === 'nueva' ? '' : 'none';
  // Descripción propuesta a partir de la intervención elegida (editable).
  const i = DATA.intervenciones.find(x => x.ID_Intervencion === elegida);
  if (i && !v('linea-servicio-desc')) {
    const eq = DATA.equipos.find(e => e.ID_Activo === _idEquipoDeIntervencion(i));
    sv('linea-servicio-desc', [i.Tipo, eq ? [eq.Tipo_Equipo, eq.Marca, eq.Modelo].filter(Boolean).join(' ') : _idEquipoDeIntervencion(i)].filter(Boolean).join(' — '));
  }
}

// Unir una línea de servicio ya existente a su intervención.
function openModalUnirIntervencion(lineaId, pedidoId) {
  const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
  if (!l) return;
  sv('unir-int-linea-id', lineaId);
  sv('unir-int-pedido-id', pedidoId);
  document.getElementById('unir-int-linea').textContent = l.Material;
  const sel = document.getElementById('unir-int-equipo');
  sel.innerHTML = '<option value="">— Elige el equipo —</option>' + [...DATA.equipos]
    .sort((a, b) => (a.ID_Activo || '').localeCompare(b.ID_Activo || ''))
    .map(e => `<option value="${_escAttr(e.ID_Activo)}">${_escAttr(e.ID_Activo)} — ${_escAttr([e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' '))}</option>`).join('');
  sel.value = l.ID_Equipo || '';
  _pintarIntervencionesUnir();
  openModal('modal-unir-intervencion');
}

function _pintarIntervencionesUnir() {
  const idEquipo = v('unir-int-equipo');
  document.getElementById('unir-int-lista').innerHTML = idEquipo
    ? _htmlOpcionesIntervencion(idEquipo, 'unir-int', false)
    : '<div style="font-size:12px;color:var(--text-muted)">Elige primero el equipo.</div>';
}

function buscarEquipoLinea(query) {
  const list = document.getElementById('linea-equipo-autocomplete');
  if (!list) return;
  if (!query || query.length < 1) { list.classList.remove('open'); return; }
  const resultados = DATA.equipos.filter(eq =>
    coincideBusqueda([eq.ID_Activo, eq.Tipo_Equipo, eq.Marca, eq.Modelo], query)
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
  _pintarIntervencionesLinea(id);
}

function clearEquipoLinea() {
  document.getElementById('linea-equipo-id').value = '';
  document.getElementById('linea-equipo-search').value = '';
  document.getElementById('linea-equipo-autocomplete').classList.remove('open');
  document.getElementById('linea-equipo-selected').style.display = 'none';
  _pintarIntervencionesLinea('');
}

// Material fungible (lo de siempre: catálogo o no catalogado), material no
// fungible o servicio. Lo no fungible y los servicios son siempre texto libre:
// no viven en el catálogo de material y al pedirlos la línea sale fuera del
// inventario (lineas_pedido.sin_inventario).
const _AYUDA_TIPO_SOLICITUD = {
  'Material': 'Lo que se gasta y se repone: reactivos, puntas, guantes… Entra en el inventario al recibirlo.',
  'No fungible': 'Lo que no se gasta: una micropipeta, una pieza, un pequeño aparato… No entra en el inventario de material.',
  'Servicio': 'Una reparación, una calibración, una revisión, un transporte…',
};
function setTipoSolicitud(tipo) {
  sv('sol-tipo', tipo);
  const ids = { 'Material': 'material', 'No fungible': 'nofungible', 'Servicio': 'servicio' };
  Object.entries(ids).forEach(([t, id]) => document.getElementById('btn-soltipo-' + id).classList.toggle('active', t === tipo));
  document.getElementById('sol-tipo-ayuda').textContent = _AYUDA_TIPO_SOLICITUD[tipo] || '';
  const esMaterial = tipo === 'Material';
  const lbl = document.getElementById('sol-material-libre-label');
  const inp = document.getElementById('sol-material-libre');
  if (tipo === 'Servicio') { lbl.textContent = 'Servicio que se necesita *'; inp.placeholder = 'Ej: reparación de la centrífuga, calibración de micropipetas…'; }
  else if (tipo === 'No fungible') { lbl.textContent = 'Qué se necesita *'; inp.placeholder = 'Ej: micropipeta 10-100 µl, filtro HEPA de la cabina…'; }
  else { lbl.textContent = 'Nombre del material *'; inp.placeholder = 'Describe el material que necesitas...'; }
  if (esMaterial) { setSourceSolicitud('catalogo', { reset: true }); }
  else {
    document.getElementById('sol-catalogo-group').style.display = 'none';
    document.getElementById('sol-nuevo-group').style.display = '';
    document.getElementById('sol-unidad-group').style.display = 'none';
  }
  if (tipo === 'Servicio' && !v('sol-cantidad')) sv('sol-cantidad', '1');
}

// Catálogo o no catalogado. Sin pestañas desde 2026-11-26: se escribe en el
// buscador y, si no está, el formulario pasa solo a «no catalogado» (abajo).
let _solFuente = 'catalogo', _lineaFuente = 'catalogo';
function setSourceSolicitud(source, opts = {}) {
  _solFuente = source;
  const esCatalogo = source === 'catalogo';
  document.getElementById('sol-catalogo-group').style.display = esCatalogo ? '' : 'none';
  document.getElementById('sol-nuevo-group').style.display = esCatalogo ? 'none' : '';
  document.getElementById('sol-unidad-group').style.display = esCatalogo ? 'none' : '';
  _ajustarNoCatalogado('sol', esCatalogo, opts);
}
function setSourceLinea(source, opts = {}) {
  _lineaFuente = source;
  const esCatalogo = source === 'catalogo';
  document.getElementById('linea-catalogo-group').style.display = esCatalogo ? '' : 'none';
  document.getElementById('linea-libre-group').style.display = esCatalogo ? 'none' : '';
  document.getElementById('linea-libre-unidad-group').style.display = esCatalogo ? 'none' : '';
  if (!esCatalogo) document.getElementById('linea-catalogo-unidad-group').style.display = 'none';
  _ajustarNoCatalogado('linea', esCatalogo, opts);
}

// ── Un solo campo: lo que no está en el catálogo pasa solo a «no catalogado» ──
// (2026-11-26) Antes había dos pestañas («Buscar en catálogo» / «Material no
// catalogado») y había que buscar, ver que no estaba y cambiar de pestaña. Ahora
// solo hay el buscador:
//  · si lo escrito (6+ letras) no da ningún resultado, el formulario pasa solo a
//    «no catalogado» con lo escrito como nombre y el cursor al final, para seguir
//    escribiendo sin cortar;
//  · la lista acaba siempre con «➕ Pedir … como material no catalogado», para
//    cuando hay resultados pero ninguno es, o con menos de 6 letras;
//  · en «no catalogado», «Buscar en el catálogo» devuelve el texto al buscador. A
//    partir de ahí ya no salta solo (rebotaría a cada tecla): queda solo el ➕.
const _NO_CAT = {
  sol:   { search: 'sol-search',   list: 'sol-autocomplete',   libre: 'sol-material-libre',   aviso: 'sol-aviso-no-catalogado',   fuente: 'nuevo', cambiar: (s, o) => setSourceSolicitud(s, o), buscar: v => buscarMaterialSolicitud(v) },
  linea: { search: 'linea-search', list: 'linea-autocomplete', libre: 'linea-material-libre', aviso: 'linea-aviso-no-catalogado', fuente: 'libre', cambiar: (s, o) => setSourceLinea(s, o),     buscar: v => buscarMaterialLinea(v) },
};
const _noCatSinSalto = { sol: false, linea: false };

// Letras mínimas para el salto automático: con menos, una búsqueda a medio
// escribir ya podría no dar nada. Por debajo no salta, pero la lista ofrece el ➕.
const _NO_CAT_MIN_LETRAS = 6;
// n = lo que devolvió buscarMaterialGenerico (-1: aún no ha buscado).
function _materialSinResultados(clave, query, n) {
  const c = _NO_CAT[clave];
  const texto = String(query || '').trim();
  if (!c || n < 0) return;
  if (n === 0 && !_noCatSinSalto[clave] && texto.replace(/\s/g, '').length >= _NO_CAT_MIN_LETRAS) { _pasarANoCatalogado(clave); return; }
  const list = document.getElementById(c.list);
  const opcion = `<div class="autocomplete-item" onclick="_pasarANoCatalogado('${clave}')">
    <div><div class="autocomplete-item-name">➕ Pedir «${_esc(texto)}» como material no catalogado</div>
    <div class="autocomplete-item-meta">${n === 0 ? 'No hay nada así en el catálogo' : '¿No es ninguno de estos?'}</div></div>
  </div>`;
  list.innerHTML = (n === 0 ? '' : list.innerHTML) + opcion;
  list.classList.add('open');
}

function _pasarANoCatalogado(clave) {
  const c = _NO_CAT[clave];
  const texto = document.getElementById(c.search).value.trim();
  c.cambiar(c.fuente, { desdeBusqueda: true });
  document.getElementById(c.list).classList.remove('open');
  const inp = document.getElementById(c.libre);
  inp.value = texto;
  _mostrarAvisoNoCat(clave, 'No está en el catálogo, así que se pedirá como material no catalogado.');
  inp.focus();
  try { inp.setSelectionRange(texto.length, texto.length); } catch (e) {}
}

function _mostrarAvisoNoCat(clave, texto) {
  const aviso = document.getElementById(_NO_CAT[clave].aviso);
  if (!aviso) return;
  aviso.innerHTML = texto + ` <a href="#" onclick="_volverACatalogo('${clave}');return false">Buscar en el catálogo</a>`;
  aviso.style.display = '';
}

function _volverACatalogo(clave) {
  const c = _NO_CAT[clave];
  c.cambiar('catalogo');            // _ajustarNoCatalogado devuelve el texto al buscador
  const search = document.getElementById(c.search);
  search.focus();
  c.buscar(search.value);
}

// Se llama en cada cambio. `reset`: al abrir el modal o cambiar de tipo;
// `desdeBusqueda`: el paso a «no catalogado», que pone él mismo el aviso.
function _ajustarNoCatalogado(clave, esCatalogo, opts) {
  const c = _NO_CAT[clave];
  const aviso = document.getElementById(c.aviso);
  if (!aviso || opts.desdeBusqueda) return;
  aviso.style.display = 'none';
  if (opts.reset) { _noCatSinSalto[clave] = false; return; }
  if (esCatalogo) {                 // vuelta al buscador desde «no catalogado»
    _noCatSinSalto[clave] = true;
    document.getElementById(c.search).value = document.getElementById(c.libre).value.trim();
  }
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
  document.getElementById('sol-tipo-group').style.display = '';
  sv('sol-cantidad', '');
  setTipoSolicitud('Material');
  document.getElementById('sol-material-id').value = '';
  document.getElementById('sol-material-selected').style.display = 'none';
  document.getElementById('sol-search').value = '';
  sv('sol-material-libre', '');
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

// El tipo (material fungible / servicio-equipo) se elige en cada línea, no en
// el pedido: un equipo y sus fungibles suelen venir juntos (2026-11-19).
function openModalNuevaLinea(pedidoId) {
  sv('linea-pedido-id', pedidoId);
  // Se dejan limpias las dos secciones, por si se cambia de tipo a medias.
  sv('linea-servicio-desc', '');
  clearEquipoLinea();
  sv('linea-nuevo-eq-tipo', '');
  sv('linea-nuevo-eq-marca', ''); sv('linea-nuevo-eq-modelo', '');
  setSourceLinea('catalogo', { reset: true });
  document.getElementById('linea-material-id').value = '';
  document.getElementById('linea-material-selected').style.display = 'none';
  document.getElementById('linea-search').value = '';
  sv('linea-material-libre',''); sv('linea-material-unidades','');
  document.getElementById('linea-catalogo-unidad-group').style.display = 'none';
  document.getElementById('linea-catalogo-unidad').innerHTML = '';
  sv('linea-cantidad', '');
  document.getElementById('linea-sin-inventario').checked = false;
  sv('linea-precio', '');
  sv('linea-obs','');
  setTipoLinea('Material');
  openModal('modal-nueva-linea');
}

// Material fungible / Equipo (compra, ficha nueva en Equipos) / Servicio
// (sobre un equipo existente, unido a una intervención).
function setTipoLinea(tipo) {
  tipo = ['Equipo', 'Servicio'].includes(tipo) ? tipo : 'Material';
  sv('linea-pedido-tipo', tipo);
  for (const t of ['Material', 'Equipo', 'Servicio'])
    document.getElementById('btn-ltipo-' + t.toLowerCase()).classList.toggle('active', t === tipo);
  const titulo = document.querySelector('#modal-nueva-linea .modal-title');
  if (titulo) titulo.textContent = { Material: 'Añadir línea al pedido', Equipo: 'Añadir equipo al pedido', Servicio: 'Añadir servicio al pedido' }[tipo];
  document.getElementById('linea-material-section').style.display = tipo === 'Material' ? '' : 'none';
  document.getElementById('linea-equipo-section').style.display = tipo === 'Equipo' ? '' : 'none';
  document.getElementById('linea-servicio-section').style.display = tipo === 'Servicio' ? '' : 'none';
  document.getElementById('linea-sin-inv-group').style.display = tipo === 'Material' ? '' : 'none';
  if (tipo !== 'Material' && !v('linea-cantidad')) sv('linea-cantidad', '1');
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

// Recibir albarán: salen todos los artículos pendientes SIN marcar y se van
// tocando de uno en uno los que figuran en el papel. Es una confirmación activa:
// nada se da por recibido porque sí (antes venían todos con la cantidad
// pendiente puesta y había que acordarse de poner 0 en lo que no venía).
function openModalRecepcionMasiva(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  // Los servicios unidos a una intervención se dan por realizados al cerrarla, y
  // un equipo sin ficha se recibe con 📥 en su línea (ahí se da de alta).
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId && l.Estado_Linea !== 'Recibido'
    && !(l.Tipo_Linea === 'Servicio' && l.ID_Intervencion)
    && !(l.Tipo_Linea === 'Equipo' && !DATA.equipos.some(e => e.ID_Activo === l.ID_Equipo)));
  sv('recmas-pedido-id', pedidoId);
  sv('recmas-albaran', '');
  const tituloEl = document.querySelector('#modal-recepcion-masiva .modal-title');
  if (tituloEl) tituloEl.textContent = `Recibir albarán — ${p?.Nombre_Lista || pedidoId}`;
  const cont = document.getElementById('recmas-tabla-contenedor');
  if (!lineas.length) {
    cont.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted)">No hay líneas pendientes de recepción</div>`;
    _recmasActualizarResumen();
    openModal('modal-recepcion-masiva');
    return;
  }
  cont.innerHTML = `<div class="recmas-resumen" id="recmas-resumen"></div>` + lineas.map(l => {
    const yaRec = parseFloat(l.Cantidad_Recibida) || 0;
    const pedida = parseFloat(l.Cantidad_Pedida) || 0;
    const pendiente = Math.max(0, pedida - yaRec);
    const unidad = _unidadLineaPedido(l);
    const mat = _materialDeLinea(l);
    const esServ = l.Tipo_Linea !== 'Material';
    const id = l.ID_Linea;
    let ubic = '';
    if (!esServ && mat) {
      const lotes = getMatUbics(mat.ID_Material);
      const ini = lotes.length === 1 ? lotes[0].ID_Ubicacion : (mat.Ubicacion || '');
      ubic = `<div id="recmas-ubicwrap-${id}" style="margin-top:4px"><div class="recmas-fila" style="margin-bottom:4px"><label>📍 ¿Dónde se guarda?</label></div>${repartoHTML('recmas-' + id, { totalId: 'recmas-cant-' + id, matId: mat.ID_Material, unidad, valor: ini })}</div>`;
    } else if (!esServ) {
      ubic = `<div style="font-size:11px;color:var(--text-muted)">⚠ No está en el catálogo: al confirmar se te pedirá su ficha para que entre en el inventario (o márcalo 🚫 Sin inventario).</div>`;
    }
    const cantTxt = esServ ? (l.Tipo_Linea === 'Equipo' ? '🖥️ equipo' : '🔧 servicio')
      : `Pedido ${pedida} ${unidad}${yaRec > 0 ? ` · ya llegaron ${yaRec} · faltan ${pendiente}` : ''}`;
    return `<div class="recmas-item" id="recmas-item-${id}" data-linea="${id}">
      <div class="recmas-item-cab" onclick="_recmasToggle('${id}')" role="checkbox" aria-checked="false" tabindex="0"
        onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();_recmasToggle('${id}')}">
        <span class="recmas-check">✓</span>
        <span class="recmas-item-nombre">${_escAttr(l.Material)}</span>
        <span class="recmas-item-cant">${_escAttr(cantTxt)}</span>
      </div>
      <div class="recmas-item-detalle">
        <div class="recmas-fila">
          ${esServ ? '' : `<label>Llegan en este albarán <input type="number" id="recmas-cant-${id}" min="0" step="0.01" value="${pendiente}" oninput="repartoActualizar('recmas-${id}')"> ${_escAttr(unidad || '')}</label>`}
          ${esServ ? '' : `<label title="Se registra como recibido pero no entra en el inventario"><input type="checkbox" id="recmas-sininv-${id}"${l.Sin_Inventario ? ' checked' : ''} onchange="_toggleRecmasSinInventario('${id}')"> 🚫 Sin inventario</label>`}
          <label>Obs. <input type="text" id="recmas-obs-${id}" placeholder="opcional"></label>
        </div>
        ${ubic}
      </div>
    </div>`;
  }).join('');
  lineas.forEach(l => _toggleRecmasSinInventario(l.ID_Linea));
  _recmasActualizarResumen();
  openModal('modal-recepcion-masiva');
}

function _recmasToggle(lineaId) {
  const item = document.getElementById('recmas-item-' + lineaId);
  if (!item) return;
  const marcado = item.classList.toggle('marcado');
  item.querySelector('.recmas-item-cab')?.setAttribute('aria-checked', marcado ? 'true' : 'false');
  _recmasActualizarResumen();
}

function _recmasMarcadas() {
  return [...document.querySelectorAll('#recmas-tabla-contenedor .recmas-item.marcado')].map(el => el.dataset.linea);
}

function _recmasActualizarResumen() {
  const total = document.querySelectorAll('#recmas-tabla-contenedor .recmas-item').length;
  const n = _recmasMarcadas().length;
  const res = document.getElementById('recmas-resumen');
  if (res) res.innerHTML = n
    ? `<b>${n}</b> de ${total} marcado${n === 1 ? '' : 's'} como llegado${n === 1 ? '' : 's'} en este albarán.`
    : `Toca cada artículo que figure en el albarán (${total} pendiente${total === 1 ? '' : 's'}).`;
  const btn = document.getElementById('btn-recmas-confirmar');
  if (btn) {
    btn.disabled = !n;
    btn.textContent = n ? `Confirmar ${n} artículo${n === 1 ? '' : 's'}` : 'Confirmar recepción';
  }
}

function openModalRecepcion(lineaId, pedidoId) {
  sv('rec-linea-id', lineaId); sv('rec-pedido-id', pedidoId); sv('rec-obs', ''); sv('rec-cantidad', '');
  const esServicio = (DATA.lineasPedido.find(x => x.ID_Linea === lineaId)?.Tipo_Linea || 'Material') !== 'Material'; // equipo o servicio: sin stock
  document.getElementById('rec-label-material').textContent = esServicio ? 'Servicio' : 'Material';
  document.getElementById('rec-grupo-cantidad-pedida').style.display = esServicio ? 'none' : '';
  document.getElementById('rec-grupo-cantidad').style.display = esServicio ? 'none' : '';
  document.getElementById('rec-ya-recibida-group').style.display = 'none';
  document.getElementById('btn-confirmar-recepcion').textContent = esServicio ? 'Confirmar realizado' : 'Confirmar recepción';
  const grupoUbic = document.getElementById('rec-ubicacion-group');
  const pickUbic = document.getElementById('rec-ubicacion-picker');
  grupoUbic.style.display = 'none';
  pickUbic.innerHTML = '';
  const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
  document.getElementById('rec-sin-inv-group').style.display = esServicio ? 'none' : '';
  document.getElementById('rec-sin-inventario').checked = !!l?.Sin_Inventario;
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
      const mat = DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
      if (mat) {
        const lotes = getMatUbics(mat.ID_Material);
        const ini = lotes.length === 1 ? lotes[0].ID_Ubicacion : (mat.Ubicacion || '');
        pickUbic.innerHTML = repartoHTML('rec', { totalId: 'rec-cantidad', matId: mat.ID_Material, unidad, valor: ini });
        grupoUbic.style.display = '';
      }
    }
  }
  // Equipo: su ficha se da de alta ahora, al recibirlo (se ve el nº de serie).
  // Si la línea ya tiene ficha (las de antes de 2026-11-19), solo se confirma.
  const esEquipo = l?.Tipo_Linea === 'Equipo';
  const fichaYa = esEquipo && l.ID_Equipo && DATA.equipos.some(e => e.ID_Activo === l.ID_Equipo);
  document.getElementById('rec-equipo-group').style.display = esEquipo && !fichaYa ? '' : 'none';
  if (esEquipo) {
    document.getElementById('rec-label-material').textContent = 'Equipo';
    document.getElementById('btn-confirmar-recepcion').textContent = fichaYa ? 'Confirmar recibido' : 'Dar de alta y confirmar recibido';
    const pend = (parseFloat(l.Cantidad_Pedida) || 1) - (parseFloat(l.Cantidad_Recibida) || 0);
    if (pend > 1) document.getElementById('rec-material-nombre').textContent = `${l.Material} · faltan ${pend}`;
    if (fichaYa) document.getElementById('rec-material-nombre').textContent += ` · ficha ${l.ID_Equipo}`;
    // «Tipo · Marca · Modelo» al añadir la línea; si no, todo el texto como tipo.
    const partes = (l.Material || '').split(' · ');
    sv('rec-eq-id', ''); sv('rec-eq-serie', '');
    sv('rec-eq-tipo', partes[0] || ''); sv('rec-eq-marca', partes[1] || ''); sv('rec-eq-modelo', partes.slice(2).join(' · '));
    document.getElementById('rec-eq-ubicacion-picker').innerHTML = ubicPickerHTML('rec-eq-ubicacion', { permitirVacio: true });
    _ubicPicker['rec-eq-ubicacion'].abierto = false; // "Sin ubicar todavía" hasta que se elija
    _ubpPintar('rec-eq-ubicacion');
  }
  _toggleRecSinInventario();
  openModal('modal-recepcion-linea');
}

// Con "No incluir en el inventario" no hay dónde guardarlo: fuera la ubicación.
function _toggleRecSinInventario() {
  const sinInv = document.getElementById('rec-sin-inventario').checked;
  const grupoUbic = document.getElementById('rec-ubicacion-group');
  if (document.getElementById('rep-rec')) grupoUbic.style.display = sinInv ? 'none' : '';
}

function _toggleRecmasSinInventario(lineaId) {
  const sinInv = document.getElementById('recmas-sininv-' + lineaId)?.checked;
  const wrap = document.getElementById('recmas-ubicwrap-' + lineaId);
  if (wrap) wrap.style.display = sinInv ? 'none' : '';
}
