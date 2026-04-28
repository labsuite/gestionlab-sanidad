// ============================================================
// PROVEEDORES — RENDER
// ============================================================
function renderProveedores() {
  const tbody = document.getElementById('tabla-proveedores');
  if (!DATA.proveedores.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🏢</div><div class="empty-state-title">Sin proveedores registrados</div></div></td></tr>`; return; }
  const rol = getUserRole();
  const puedeEditar = rol === 'Administrador' || rol === 'Gestor';
  tbody.innerHTML = DATA.proveedores.map(p => {
    const tipos = (p.Tipo_Proveedor||'').split(',').map(t => t.trim()).filter(Boolean);
    const tiposBadges = tipos.map(t => `<span class="badge badge-gray" style="margin-right:3px">${t}</span>`).join('');
    const nPedidos = DATA.pedidos.filter(x => x.Proveedor === p.Nombre_Proveedor).length;
    return `<tr style="cursor:pointer" onclick="verDetalleProveedor('${p.Nombre_Proveedor.replace(/'/g,"\\'")}')">
      <td><strong>${p.Nombre_Proveedor||'—'}</strong></td>
      <td>${tiposBadges||'—'}</td>
      <td>${p.Persona_Contacto||'—'}</td>
      <td onclick="event.stopPropagation()">${p.Email_Contacto ? `<a href="mailto:${p.Email_Contacto}" style="color:var(--accent)">${p.Email_Contacto}</a>` : '—'}</td>
      <td>${p.Telefono||'—'}</td>
      <td>${p.Activo !== 'FALSE' ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
      <td><div class="row-actions" onclick="event.stopPropagation()">
        ${nPedidos > 0 ? `<span class="badge badge-blue" style="margin-right:4px" title="${nPedidos} pedido(s)">${nPedidos} 🛒</span>` : ''}
        ${puedeEditar ? `<button class="icon-btn" onclick="editProveedor(${DATA.proveedores.indexOf(p)})">✏️</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

// ============================================================
// UBICACIONES — RENDER
// ============================================================
function renderUbicaciones() {
  const cont = document.getElementById('ubicaciones-agrupadas');
  const rol = getUserRole();
  const puedeEditar = rol === 'Administrador' || rol === 'Gestor';
  const btnNuevaUbi = document.getElementById('btn-nueva-ubicacion');
  if (btnNuevaUbi) btnNuevaUbi.style.display = puedeEditar ? '' : 'none';
  if (!cont) return;
  if (!DATA.ubicaciones.length) { cont.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📍</div><div class="empty-state-title">Sin ubicaciones registradas</div></div>`; return; }

  const grupos = {};
  DATA.ubicaciones.forEach(u => { const lab = u.Laboratorio_Aula||'Sin asignar'; if (!grupos[lab]) grupos[lab] = []; grupos[lab].push(u); });

  cont.innerHTML = Object.entries(grupos).map(([lab, items], gi) => {
    const totalMat = items.reduce((s,u) => s + DATA.material.filter(m => m.Ubicacion === u.ID_Ubicacion).length, 0);
    const grupoId = 'ubg' + gi;
    const rows = items.map(u => {
      const matsAqui = DATA.material.filter(m => m.Ubicacion === u.ID_Ubicacion);
      const matCell = matsAqui.length ? `<span class="badge badge-blue" style="cursor:pointer" onclick="verMaterialUbicacion('${u.ID_Ubicacion}')">${matsAqui.length} ítem(s)</span>` : `<span style="font-size:12px;color:var(--text-muted)">—</span>`;
      return `<div class="ubi-row">
        <strong style="font-size:12px">${u.ID_Ubicacion}</strong>
        <span style="color:var(--text-soft);font-size:13px">${u.Zona||'—'}</span>
        <span style="font-size:12px;color:var(--text-muted)">${u.Subzona||u.Descripcion_Completa||'—'}</span>
        <div>${matCell}</div>
        <div>${u.Activa !== 'FALSE' ? '<span class="badge badge-green">Activa</span>' : '<span class="badge badge-gray">Inactiva</span>'}</div>
        <div class="row-actions">${puedeEditar ? `<button class="icon-btn" onclick="editUbicacion(${DATA.ubicaciones.indexOf(u)})">✏️</button>` : ''}</div>
      </div>`;
    }).join('');
    return `<div class="ubi-grupo">
      <div class="ubi-grupo-header" onclick="toggleUbiGrupo('${grupoId}')">
        <span class="ubi-grupo-toggle" id="tog-${grupoId}">▶</span>
        <span>🏛️ ${lab}</span>
        <span class="ubi-grupo-count"><span class="badge badge-gray">${items.length} zona(s)</span>${totalMat > 0 ? `<span class="badge badge-blue" style="margin-left:4px">${totalMat} ítem(s)</span>` : ''}</span>
      </div>
      <div class="ubi-grupo-rows" id="${grupoId}">
        <div style="display:grid;grid-template-columns:140px 1fr 1fr 80px 80px auto;gap:8px;padding:6px 20px;background:var(--surface2);font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border)">
          <span>ID</span><span>Zona</span><span>Subzona / Descripción</span><span>Material</span><span>Estado</span><span></span>
        </div>
        ${rows}
      </div>
    </div>`;
  }).join('');
}

function toggleUbiGrupo(id) {
  const rows = document.getElementById(id);
  const tog  = document.getElementById('tog-' + id);
  if (!rows) return;
  const isOpen = rows.classList.toggle('open');
  if (tog) tog.textContent = isOpen ? '▼' : '▶';
}

function verMaterialUbicacion(ubicacionId) {
  _filtroMaterial = ''; _filtroMaterialCat = ''; _filtroMaterialStock = ''; _filtroMaterialUbicacion = '';
  showPage('material');
  const ubiInput = document.querySelector('#page-material input[oninput*="filtrarMaterialUbicacion"]');
  if (ubiInput) { ubiInput.value = ubicacionId; filtrarMaterialUbicacion(ubicacionId); }
  else { const searchInput = document.getElementById('search-material'); if (searchInput) { searchInput.value = ubicacionId; filtrarMaterial(ubicacionId); } }
}

// ============================================================
// DETALLE PROVEEDOR
// ============================================================
function verDetalleProveedor(nombreProveedor) {
  const p = DATA.proveedores.find(x => x.Nombre_Proveedor === nombreProveedor);
  if (!p) return;
  renderDetalleProveedor(p);
  showPage('proveedor-detalle');
}

function renderDetalleProveedor(p) {
  const cont = document.getElementById('proveedor-detalle-contenido');
  if (!cont) return;
  const tipos = (p.Tipo_Proveedor||'').split(',').map(t => t.trim()).filter(Boolean);
  const tiposBadges = tipos.map(t => `<span class="badge badge-gray" style="margin-right:4px">${t}</span>`).join('') || '—';

  const pedidosProv = DATA.pedidos
    .filter(x => x.Proveedor === p.Nombre_Proveedor)
    .sort((a,b) => new Date(b.Fecha_Creacion) - new Date(a.Fecha_Creacion));

  const totalGastado = pedidosProv.reduce((sum, ped) => {
    return sum + DATA.lineasPedido
      .filter(l => l.Pedido === ped.ID_Pedido)
      .reduce((s,l) => s + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), 0);
  }, 0);

  const pedidosHTML = !pedidosProv.length
    ? `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">🛒</div><div class="empty-state-title">Sin pedidos registrados con este proveedor</div></div>`
    : pedidosProv.map(ped => {
        const lineas    = DATA.lineasPedido.filter(l => l.Pedido === ped.ID_Pedido);
        const recibidas = lineas.filter(l => l.Estado_Linea === 'Recibido').length;
        const coste     = lineas.reduce((s,l) => s + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), 0);
        return `<div class="pedido-card" onclick="verDetallePedido('${ped.ID_Pedido}')">
          <div class="pedido-card-header">
            <div>
              <div class="pedido-card-title">${ped.Nombre_Lista}</div>
              <div class="pedido-card-meta">${ped.ID_Pedido} · Creado ${formatDate(ped.Fecha_Creacion)}</div>
            </div>
            <span class="estado-pedido ${estadoPedidoClass(ped.Estado)}">${ped.Estado}</span>
          </div>
          <div class="pedido-card-stats">
            <div class="pedido-stat"><strong>${lineas.length}</strong> líneas</div>
            <div class="pedido-stat"><strong>${recibidas}</strong> recibidas</div>
            ${ped.Numero_Factura ? `<div class="pedido-stat">Factura <strong>${ped.Numero_Factura}</strong></div>` : ''}
            ${coste > 0 ? `<div class="pedido-stat">Total <strong>${coste.toFixed(2)} €</strong></div>` : ''}
          </div>
        </div>`;
      }).join('');

  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <div class="card-title">🏢 ${p.Nombre_Proveedor}</div>
          <div style="margin-top:4px">${tiposBadges}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${p.Email_Contacto ? `<a href="mailto:${p.Email_Contacto}" class="btn btn-secondary" style="text-decoration:none">✉️ Email</a>` : ''}
          ${p.Web ? `<a href="${p.Web}" target="_blank" rel="noopener" class="btn btn-secondary" style="text-decoration:none">🌐 Web</a>` : ''}
          ${(getUserRole()==='Administrador'||getUserRole()==='Gestor') ? `<button class="btn btn-secondary" onclick="editProveedor(${DATA.proveedores.indexOf(p)})">✏️ Editar proveedor</button>` : ''}
        </div>
      </div>
      <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px">
        <div class="detail-item"><div class="detail-label">Contacto</div><div class="detail-value">${p.Persona_Contacto||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${p.Email_Contacto||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Teléfono</div><div class="detail-value">${p.Telefono||'—'}</div></div>
        <div class="detail-item"><div class="detail-label">Pedidos totales</div><div class="detail-value">${pedidosProv.length}</div></div>
        ${totalGastado > 0 ? `<div class="detail-item"><div class="detail-label">Importe total</div><div class="detail-value"><strong>${totalGastado.toFixed(2)} €</strong></div></div>` : ''}
        ${p.Observaciones ? `<div class="detail-item" style="grid-column:1/-1"><div class="detail-label">Observaciones</div><div class="detail-value">${p.Observaciones}</div></div>` : ''}
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Historial de pedidos (${pedidosProv.length})</div>
      </div>
      <div style="padding:12px 16px">
        ${pedidosHTML}
      </div>
    </div>`;
}

// ============================================================
// USUARIOS — RENDER
// ============================================================
function renderUsuarios() {
  const tbody = document.getElementById('tabla-usuarios');
  if (!DATA.usuarios.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Sin usuarios registrados</div></div></td></tr>`; return; }
  const rolActual  = getUserRole();
  const rolBadge   = {'Administrador':'badge-red','Gestor':'badge-orange','Profesor':'badge-blue','Alumno':'badge-gray'};
  tbody.innerHTML = DATA.usuarios.map(u => {
    // Profesor: solo puede editar cuentas con rol Alumno
    const puedeEditarEsteUser = rolActual !== 'Profesor' || u.Rol === 'Alumno';
    return `<tr>
    <td><strong>${u.Nombre||'—'}</strong></td>
    <td>${u.Email||'—'}</td>
    <td><span class="badge ${rolBadge[u.Rol]||'badge-gray'}">${u.Rol||'—'}</span></td>
    <td>${u.Activo !== 'FALSE' ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
    <td><div class="row-actions">${puedeEditarEsteUser ? `<button class="icon-btn" onclick="editUsuario(${DATA.usuarios.indexOf(u)})">✏️</button>` : ''}</div></td>
  </tr>`; }).join('');
}

// ============================================================
// MODALES PROVEEDORES / UBICACIONES / USUARIOS
// ============================================================
function openModalProveedor() { editingRow = null; ['prov-nombre','prov-contacto','prov-email','prov-telefono','prov-web','prov-observaciones'].forEach(id => sv(id,'')); clearTiposProveedor(); openModal('modal-proveedor'); }
function openModalUbicacion() { editingRow = null; ['ubi-id','ubi-lab','ubi-zona','ubi-subzona','ubi-desc'].forEach(id => sv(id,'')); openModal('modal-ubicacion'); }
function openModalUsuario()   {
  editingRow = null;
  ['usr-nombre','usr-email','usr-ubicaciones-asignadas'].forEach(id => sv(id,''));
  sv('usr-rol','Profesor');
  toggleUbicacionesAsignadasField('Profesor');
  const selRol = document.getElementById('usr-rol');
  if (selRol) selRol.disabled = false;
  openModal('modal-usuario');
}

function toggleUbicacionesAsignadasField(rol) {
  const grp = document.getElementById('usr-ubicaciones-group');
  if (grp) grp.style.display = rol === 'Alumno' ? '' : 'none';
}

function editProveedor(idx) {
  const p = DATA.proveedores[idx];
  editingRow = { sheet: 'Proveedores', rowIndex: idx };
  sv('prov-nombre',p.Nombre_Proveedor); setTiposProveedor(p.Tipo_Proveedor);
  sv('prov-contacto',p.Persona_Contacto); sv('prov-email',p.Email_Contacto);
  sv('prov-telefono',p.Telefono); sv('prov-web',p.Web); sv('prov-observaciones',p.Observaciones);
  openModal('modal-proveedor');
}
function editUbicacion(idx) {
  const u = DATA.ubicaciones[idx];
  editingRow = { sheet: 'Ubicaciones', rowIndex: idx };
  sv('ubi-id',u.ID_Ubicacion); sv('ubi-lab',u.Laboratorio_Aula); sv('ubi-zona',u.Zona); sv('ubi-subzona',u.Subzona); sv('ubi-desc',u.Descripcion_Completa);
  openModal('modal-ubicacion');
}
function editUsuario(idx) {
  const u = DATA.usuarios[idx];
  if (getUserRole() === 'Profesor' && u.Rol !== 'Alumno') {
    showToast('Solo puedes modificar usuarios con rol Alumno', 'error');
    return;
  }
  editingRow = { sheet: 'Usuarios', rowIndex: idx };
  sv('usr-nombre', u.Nombre); sv('usr-email', u.Email); sv('usr-rol', u.Rol);
  sv('usr-ubicaciones-asignadas', u.Ubicaciones_Asignadas||'');
  toggleUbicacionesAsignadasField(u.Rol);
  // Profesor no puede cambiar el rol: bloqueamos el select
  const selRol = document.getElementById('usr-rol');
  if (selRol) selRol.disabled = (getUserRole() === 'Profesor');
  openModal('modal-usuario');
}

// ============================================================
// MULTI-SELECT TIPOS PROVEEDOR
// ============================================================
function getTiposProveedorSeleccionados() {
  return Array.from(document.querySelectorAll('#prov-tipos-group input[type="checkbox"]:checked')).map(c => c.value).join(', ');
}
function setTiposProveedor(tiposStr) {
  const tipos = (tiposStr||'').split(',').map(t => t.trim());
  document.querySelectorAll('#prov-tipos-group input[type="checkbox"]').forEach(cb => { cb.checked = tipos.includes(cb.value); });
}
function clearTiposProveedor() {
  document.querySelectorAll('#prov-tipos-group input[type="checkbox"]').forEach(cb => cb.checked = false);
}

// ============================================================
// GUARDAR PROVEEDORES / UBICACIONES / USUARIOS
// ============================================================
async function guardarProveedor() {
  const nombre = v('prov-nombre');
  if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  const tipos = getTiposProveedorSeleccionados();
  const id = genId('PRV-');
  const row = [id, nombre, tipos, v('prov-contacto'), v('prov-email'), v('prov-telefono'), v('prov-web'), v('prov-observaciones'), 'TRUE'];
  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Proveedores') {
      await sheetsUpdate(`Proveedores!A${editingRow.rowIndex+2}:I${editingRow.rowIndex+2}`, row);
      DATA.proveedores[editingRow.rowIndex] = rowToObj(row, 'proveedores');
      showToast('Proveedor actualizado', 'success');
    } else {
      await sheetsAppend('Proveedores', row);
      DATA.proveedores.push(rowToObj(row, 'proveedores'));
      showToast('Proveedor guardado', 'success');
    }
    closeModal('modal-proveedor'); renderAll();
  } catch(e) { showToast('Error guardando', 'error'); }
  hideLoading(); editingRow = null;
}

async function guardarUbicacion() {
  const id = v('ubi-id'), lab = v('ubi-lab');
  if (!id || !lab) { showToast('ID y laboratorio/aula son obligatorios', 'error'); return; }
  const row = [id, lab, v('ubi-zona'), v('ubi-subzona'), v('ubi-desc'), 'TRUE'];
  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Ubicaciones') {
      await sheetsUpdate(`Ubicaciones!A${editingRow.rowIndex+2}:F${editingRow.rowIndex+2}`, row);
      DATA.ubicaciones[editingRow.rowIndex] = rowToObj(row, 'ubicaciones');
      showToast('Ubicación actualizada', 'success');
    } else {
      await sheetsAppend('Ubicaciones', row);
      DATA.ubicaciones.push(rowToObj(row, 'ubicaciones'));
      showToast('Ubicación guardada', 'success');
    }
    closeModal('modal-ubicacion'); renderAll();
  } catch(e) { showToast('Error guardando', 'error'); }
  hideLoading(); editingRow = null;
}

async function guardarUsuario() {
  const nombre = v('usr-nombre'), email = v('usr-email');
  if (!nombre || !email) { showToast('Nombre y email son obligatorios', 'error'); return; }

  // Restricción para Profesor: solo puede editar Alumnos, y el rol queda fijo
  if (getUserRole() === 'Profesor') {
    if (editingRow) {
      const uExist = DATA.usuarios[editingRow.rowIndex];
      if (uExist?.Rol !== 'Alumno') { showToast('No tienes permiso para modificar este usuario', 'error'); return; }
    } else {
      showToast('No tienes permiso para crear nuevos usuarios', 'error'); return;
    }
    sv('usr-rol', 'Alumno'); // forzar rol aunque alguien manipule el select
  }

  const id = genId('USR-');
  const rol = v('usr-rol') || 'Alumno';
  const ubicAsignadas = rol === 'Alumno' ? v('usr-ubicaciones-asignadas') : '';
  const row = [id, nombre, email, rol, 'TRUE', ubicAsignadas];
  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Usuarios') {
      await sheetsUpdate(`Usuarios!A${editingRow.rowIndex+2}:F${editingRow.rowIndex+2}`, row);
      DATA.usuarios[editingRow.rowIndex] = rowToObj(row, 'usuarios');
      showToast('Usuario actualizado', 'success');
    } else {
      await sheetsAppend('Usuarios', row);
      DATA.usuarios.push(rowToObj(row, 'usuarios'));
      showToast('Usuario guardado', 'success');
    }
    closeModal('modal-usuario'); renderAll();
  } catch(e) { showToast('Error guardando', 'error'); }
  hideLoading(); editingRow = null;
}
