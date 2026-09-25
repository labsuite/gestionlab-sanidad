// ============================================================
// HELPERS COMPARTIDOS
// ============================================================
// Escapa un valor para meterlo dentro de un atributo HTML. Vive aquí arriba, y no
// dentro de la sección que lo introdujo, porque lo usan equipos-render.js,
// material.js, inventariar-material.js y ubicar-equipos.js además de este archivo.
function _escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
        ${puedeEditar && nPedidos === 0 ? `<button class="icon-btn" title="Eliminar proveedor" onclick="borrarProveedor(${DATA.proveedores.indexOf(p)})">🗑️</button>` : ''}
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
  [...DATA.ubicaciones].sort((a,b) => (a.ID_Ubicacion||'').localeCompare(b.ID_Ubicacion||'', 'es', {numeric:true}))
    .forEach(u => { const lab = u.Laboratorio_Aula||'Sin asignar'; if (!grupos[lab]) grupos[lab] = []; grupos[lab].push(u); });

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
        <div class="row-actions">
          ${rol === 'Administrador' ? `<button class="icon-btn" onclick="mostrarUrlNfc('${u.ID_Ubicacion.replace(/'/g,"\\'")}')" title="URL para etiqueta NFC">🔗</button>` : ''}
          ${puedeEditar ? `<button class="icon-btn" onclick="editUbicacion(${DATA.ubicaciones.indexOf(u)})" title="Editar">✏️</button>` : ''}
          ${puedeEditar && u.Activa === 'FALSE' ? `<button class="icon-btn" onclick="cambiarEstadoUbicacion(${DATA.ubicaciones.indexOf(u)}, true)" title="Reactivar">♻️</button>` : ''}
          ${puedeEditar ? `<button class="icon-btn danger" onclick="borrarUbicacion(${DATA.ubicaciones.indexOf(u)})" title="Eliminar">🗑️</button>` : ''}
        </div>
      </div>`;
    }).join('');
    return `<div class="ubi-grupo">
      <div class="ubi-grupo-header" onclick="toggleUbiGrupo('${grupoId}')">
        <span class="ubi-grupo-toggle" id="tog-${grupoId}">▶</span>
        <span>🏛️ ${lab}</span>
        <span class="ubi-grupo-count"><span class="badge badge-gray">${items.length} zona(s)</span>${totalMat > 0 ? `<span class="badge badge-blue" style="margin-left:4px">${totalMat} ítem(s)</span>` : ''}</span>
      </div>
      <div class="ubi-grupo-rows" id="${grupoId}">
        <div class="ubi-table-header">
          <span>ID</span><span>Zona</span><span>Subzona / Descripción</span><span>Material</span><span>Estado</span><span></span>
        </div>
        ${rows}
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// NFC — Generador de URL para etiquetas
// Visible solo para Administrador (botón 🔗 en cada fila)
// ============================================================
function mostrarUrlNfc(ubicacionId) {
  const url  = urlEtiqueta({ armario: ubicacionId, action: 'transfer' });
  document.getElementById('nfc-url-ubi-label').textContent = getNombreUbicacion(ubicacionId);
  document.getElementById('nfc-url-text').textContent      = url;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`;
  const qrImg = document.getElementById('nfc-url-qr');
  qrImg.src = '';
  qrImg.src = qrSrc;
  openModal('modal-nfc-url');
}

async function copiarUrlNfc() {
  const url = document.getElementById('nfc-url-text').textContent;
  try {
    await navigator.clipboard.writeText(url);
    showToast('URL copiada al portapapeles ✓', 'success');
  } catch {
    const el = document.createElement('textarea');
    el.value = url; el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el);
    el.select(); document.execCommand('copy');
    document.body.removeChild(el);
    showToast('URL copiada al portapapeles ✓', 'success');
  }
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
      .reduce((s,l) => s + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), parseFloat(ped.Gasto_Extra_Importe) || 0);
  }, 0);

  const pedidosHTML = !pedidosProv.length
    ? `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">🛒</div><div class="empty-state-title">Sin pedidos registrados con este proveedor</div></div>`
    : pedidosProv.map(ped => {
        const lineas    = DATA.lineasPedido.filter(l => l.Pedido === ped.ID_Pedido);
        const recibidas = lineas.filter(l => l.Estado_Linea === 'Recibido').length;
        const coste     = lineas.reduce((s,l) => s + (parseFloat(l.Precio_Unitario)||0)*(parseFloat(l.Cantidad_Pedida)||0), parseFloat(ped.Gasto_Extra_Importe) || 0);
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
          ${(getUserRole()==='Administrador'||getUserRole()==='Gestor') && !pedidosProv.length ? `<button class="btn btn-danger" onclick="borrarProveedor(${DATA.proveedores.indexOf(p)})">🗑️ Eliminar proveedor</button>` : ''}
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
// USUARIOS — RENDER con pestañas (staff | profesores | alumnos)
// ============================================================
function renderUsuarios() {
  const cont = document.getElementById('usuarios-contenido');
  if (!cont) return;

  // Preserve active tab across re-renders
  const tabActiva = ['staff','profes','alumnos'].find(t => {
    const p = document.getElementById(`usr-tab-${t}`);
    return p && p.style.display !== 'none';
  }) || 'staff';

  const rolActual = getUserRole();
  const puedeCrear = rolActual === 'Administrador' || rolActual === 'Gestor';

  const admins  = DATA.usuarios.filter(u => u.Rol === 'Administrador' || u.Rol === 'Gestor');
  const profes  = DATA.usuarios.filter(u => u.Rol === 'Profesor');
  const alumnos = DATA.usuarios.filter(u => u.Rol === 'Alumno');

  const tabBtn = (id, label, count, active) => {
    const base = 'padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;margin-bottom:-2px;';
    const style = active
      ? base + 'border-bottom:2px solid var(--accent);color:var(--accent)'
      : base + 'border-bottom:2px solid transparent;color:var(--text-muted)';
    return `<button id="usr-tab-btn-${id}" onclick="switchUsuariosTab('${id}')" style="${style}">
      ${label} <span style="font-size:11px;background:var(--border);color:var(--text-muted);border-radius:99px;padding:1px 7px;margin-left:4px">${count}</span>
    </button>`;
  };

  cont.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <input id="search-usuarios" type="search" placeholder="Buscar por nombre o email..."
        oninput="buscarUsuario(this.value)"
        style="flex:1;min-width:200px;max-width:360px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:13px">
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        ${puedeCrear ? `<button class="btn btn-secondary" onclick="abrirModalImportarProfesores()">📥 Importar profesorado</button>` : ''}
        ${puedeCrear ? `<button class="btn btn-primary" onclick="openModalUsuario()">+ Nuevo usuario</button>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px">
      ${tabBtn('staff',   'Admins y gestores', admins.length,  true)}
      ${tabBtn('profes',  'Profesores',        profes.length,  false)}
      ${tabBtn('alumnos', 'Alumnos',           alumnos.length, false)}
    </div>
    <div id="usr-tab-staff">${_renderTablaUsuarios(admins, rolActual)}</div>
    <div id="usr-tab-profes"  style="display:none">${_renderTablaUsuarios(profes, rolActual)}</div>
    <div id="usr-tab-alumnos" style="display:none">${_renderSeccionAlumnos(alumnos, rolActual)}</div>
  `;
  switchUsuariosTab(tabActiva);
}

function switchUsuariosTab(tab) {
  ['staff','profes','alumnos'].forEach(t => {
    const panel = document.getElementById(`usr-tab-${t}`);
    const btn   = document.getElementById(`usr-tab-btn-${t}`);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn) {
      const active = t === tab;
      btn.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
      btn.style.color        = active ? 'var(--accent)' : 'var(--text-muted)';
    }
  });
}

function _renderTablaUsuarios(lista, rolActual) {
  const rolBadge = {'Administrador':'badge-red','Gestor':'badge-orange','Profesor':'badge-blue','Alumno':'badge-gray'};
  const puedeEditar = rolActual === 'Administrador' || rolActual === 'Gestor';
  const puedeBorrar = rolActual === 'Administrador';  // igual que eliminarItems en PERMISOS
  if (!lista.length) return `<div class="empty-state" style="padding:40px 0"><div class="empty-state-icon">👤</div><div class="empty-state-title">Sin usuarios en esta categoría</div></div>`;
  return `<div class="card">
    <table>
      <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Módulo(s)</th><th>Labs</th><th>Activo</th><th></th></tr></thead>
      <tbody>
        ${lista.map(u => {
          const idx = DATA.usuarios.indexOf(u);
          return `<tr>
            <td><strong>${u.Nombre||'—'}</strong></td>
            <td>${u.Email||'—'}</td>
            <td><span class="badge ${rolBadge[u.Rol]||'badge-gray'}">${u.Rol||'—'}</span></td>
            <td>${_badgesModulos(u.Modulo)}</td>
            <td>${_badgesLabs(u.Ubicaciones_Asignadas)}</td>
            <td>${u.Activo !== 'FALSE' ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
            <td><div class="row-actions">${puedeEditar && (!u._sbOnly || u.Rol === 'Profesor') ? `<button class="icon-btn" onclick="editUsuario(${idx})">✏️</button>` : ''}${_botonBorrarUsuario(u, idx, puedeBorrar)}</div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

const _SIN_DATO = '<span style="color:var(--text-muted)">—</span>';

// Los usuarios _sbOnly no tienen fila en el catálogo `usuarios` (vienen de la otra
// app), así que no hay nada que borrar aquí.
function _botonBorrarUsuario(u, idx, puedeBorrar) {
  if (!puedeBorrar || u._sbOnly) return '';
  return `<button class="icon-btn" title="Eliminar usuario" onclick="borrarUsuario(${idx})">🗑️</button>`;
}

/** Nº de equipos de los que esta persona figura como responsable (campo de texto). */
function _equiposDeResponsable(nombre) {
  const n = (nombre || '').trim();
  if (!n) return [];
  return (DATA.equipos || []).filter(e =>
    (e.Responsable || '').split(',').map(x => x.trim()).includes(n));
}

// Eliminar a una persona la quita de los tres sitios donde vive: catálogo,
// permisos y cuenta de acceso (lo hace la Edge Function). Aquí solo se avisa y
// se comprueba lo mismo antes, para no hacer un viaje al servidor en balde.
async function borrarUsuario(idx) {
  const u = DATA.usuarios[idx];
  if (!u) return;
  if (getUserRole() !== 'Administrador') {
    showToast('Solo un Administrador puede eliminar usuarios', 'error'); return;
  }
  if (u._sbOnly) {
    showToast('Este usuario se gestiona desde la otra app', 'error'); return;
  }
  const miEmail = (currentUser?.email || '').toLowerCase().trim();
  if ((u.Email || '').toLowerCase().trim() === miEmail) {
    showToast('No puedes eliminar tu propia cuenta', 'error'); return;
  }

  // Mismo criterio que borrarProveedor con pedidos: equipos.responsable guarda el
  // NOMBRE, así que borrar a quien tiene equipos dejaría esos equipos sin dueño real.
  const suyos = _equiposDeResponsable(u.Nombre);
  if (suyos.length) {
    showToast(`No se puede eliminar: es responsable de ${suyos.length} equipo(s). Reasígnalos a otra persona primero.`, 'error');
    return;
  }

  if (!confirm(
    `¿Eliminar a ${u.Nombre} (${u.Email})?\n\n` +
    `Se borran su ficha, sus permisos y su cuenta de acceso: dejará de poder entrar en la app.\n\n` +
    `Esta acción no se puede deshacer.`
  )) return;

  showLoading('Eliminando...');
  try {
    const r = await callEdgeFunction('gestionar-usuario', { accion: 'eliminar', id_usuario: u.ID_Usuario });
    DATA.usuarios.splice(idx, 1);
    if (r?.aviso) showToast(`Usuario eliminado, pero ${r.aviso}`, 'error');
    else showToast('Usuario eliminado', 'success');
    renderAll();
  } catch (e) {
    showToast('Error eliminando: ' + e.message, 'error');
    console.error(e);
  }
  hideLoading();
}

function _badgesModulos(modulosStr) {
  const nombres = (modulosStr || '').split(',').map(m => _moduloNombre(m.trim())).filter(Boolean);
  if (!nombres.length) return _SIN_DATO;
  return nombres.map(n => `<span class="badge badge-blue" style="margin-right:2px">${n}</span>`).join('');
}

function _badgesLabs(ubicStr) {
  const labs = _getLabsDeUbics(ubicStr || '');
  if (!labs.length) return _SIN_DATO;
  return labs.map(l => `<span class="badge badge-gray" style="margin-right:2px">Lab ${l}</span>`).join('');
}

// "Ciclo|Módulo" helpers — el separador | evita ambigüedad cuando varios ciclos comparten nombre de módulo
function _moduloCiclo(m) { const i = m.indexOf('|'); return i > -1 ? m.slice(0, i) : null; }
function _moduloNombre(m) { const i = m.indexOf('|'); return i > -1 ? m.slice(i + 1) : m; }

// ── "Mis grupos": la cuenta y la contraseña de los grupos que lleva cada docente ──
// Un profe entra aquí a por lo mismo casi siempre: dictarle a su grupo el correo y
// la contraseña con los que se conecta. Sin esto tenía que buscarlos entre los nueve
// grupos y abrir el modal 🔑 uno a uno. Los grupos salen de Grupos_Asignados (se
// asignan en la ficha del docente), y la contraseña la sigue sirviendo el servidor
// descifrada solo cuando se pide — aquí no se precarga ninguna.
//
// Respeta la vista previa de rol (getEffectiveUser): al simular ser otra profesora se
// ven sus grupos, no los de quien simula.
let _pwInline = {};

function _misGruposDelUsuario() {
  const emailNorm = getEffectiveUser().email;
  const yo = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  const ids = _parseGrupos(yo?.Grupos_Asignados);
  if (!ids.length) return [];
  return ids.map(id => DATA.usuarios.find(u => u.ID_Usuario === id)).filter(Boolean);
}

function _renderMisGrupos() {
  const mios = _misGruposDelUsuario();
  if (!mios.length) {
    // Un docente sin grupos no puede ver ninguna contraseña: decírselo, que si no
    // parece que la app no lo hace.
    if (getUserRole() !== 'Profesor') return '';
    return `<div class="card" style="margin-bottom:20px">
      <div class="card-header"><div class="card-title">🎓 Mis grupos</div></div>
      <div style="font-size:13px;color:var(--text-muted);line-height:1.5">
        No tienes ningún grupo asignado, así que no puedes consultar contraseñas.
        Pídele a un administrador que te asigne los tuyos en tu ficha de usuario.
      </div>
    </div>`;
  }
  _pwInline = {};
  const filas = mios.map(g => {
    const idx = DATA.usuarios.indexOf(g);
    return `<div class="mis-grupos-fila" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--border)">
      <strong style="min-width:110px">${g.Nombre || '—'}</strong>
      <code style="background:var(--bg-alt,#f1f3f5);border-radius:6px;padding:4px 8px;font-size:13px">${g.Email || '—'}</code>
      <div id="pwi-${_escAttr(g.ID_Usuario)}" class="mis-grupos-acciones" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary" style="padding:4px 12px;font-size:12px"
          onclick="verPasswordGrupoInline('${_escAttr(g.ID_Usuario)}')">👁️ Ver contraseña</button>
        <button class="icon-btn" title="Cambiar la contraseña" onclick="abrirPasswordGrupo(${idx})">🔑</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="card" style="margin-bottom:20px">
    <div class="card-header"><div class="card-title">🎓 Mis grupos</div></div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">
      La cuenta con la que entra cada grupo. La contraseña es compartida a propósito: se puede dictar en clase.
    </div>
    ${filas}
  </div>`;
}

async function verPasswordGrupoInline(idUsuario) {
  showLoading('Consultando...');
  try {
    const r = await callEdgeFunction('gestionar-usuario', { accion: 'ver_password_grupo', id_usuario: idUsuario });
    if (r?.sin_guardar) {
      showToast('Esta cuenta no tiene copia guardada: genera una nueva con 🔑', 'error');
    } else {
      _pwInline[idUsuario] = r.password;
      _pintarPasswordInline(idUsuario);
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
  hideLoading();
}

function _pintarPasswordInline(idUsuario) {
  const cont = document.getElementById(`pwi-${idUsuario}`);
  const pw = _pwInline[idUsuario];
  if (!cont || !pw) return;
  cont.innerHTML = `
    <code style="font-size:15px;letter-spacing:1px;background:var(--bg-alt,#f1f3f5);border-radius:6px;padding:4px 10px">${_escAttr(pw)}</code>
    <button class="icon-btn" title="Copiar" onclick="copiarPasswordInline('${_escAttr(idUsuario)}')">📋</button>
    <button class="icon-btn" title="Ocultar" onclick="ocultarPasswordInline('${_escAttr(idUsuario)}')">🙈</button>`;
}

async function copiarPasswordInline(idUsuario) {
  const pw = _pwInline[idUsuario];
  if (!pw) return;
  try {
    await navigator.clipboard.writeText(pw);
    showToast('Contraseña copiada ✓', 'success');
  } catch {
    showToast('El navegador no dejó copiar. Selecciónala a mano.', 'error');
  }
}

function ocultarPasswordInline(idUsuario) {
  delete _pwInline[idUsuario];
  const cont = document.getElementById(`pwi-${idUsuario}`);
  const g = DATA.usuarios.find(u => u.ID_Usuario === idUsuario);
  if (!cont || !g) return;
  cont.innerHTML = `
    <button class="btn btn-secondary" style="padding:4px 12px;font-size:12px"
      onclick="verPasswordGrupoInline('${_escAttr(idUsuario)}')">👁️ Ver contraseña</button>
    <button class="icon-btn" title="Cambiar la contraseña" onclick="abrirPasswordGrupo(${DATA.usuarios.indexOf(g)})">🔑</button>`;
}

function _renderSeccionAlumnos(lista, rolActual) {
  const puedeEditar = rolActual === 'Administrador' || rolActual === 'Gestor' || rolActual === 'Profesor';
  const puedeBorrar = rolActual === 'Administrador';  // igual que eliminarItems en PERMISOS
  if (!lista.length) return `<div class="empty-state" style="padding:40px 0"><div class="empty-state-icon">🎓</div><div class="empty-state-title">Sin alumnos registrados</div></div>`;
  const misGrupos = _renderMisGrupos();

  // Agrupar por Ciclo_Principal (columna H). Fallback: prefijo embebido "Ciclo|Módulo" o lookup.
  const grupos = {};
  lista.forEach(u => {
    let ciclo = (u.Ciclo_Principal || '').trim();
    if (!ciclo) {
      // Fallback para registros anteriores: leer el prefijo embebido en Modulo
      const mods = (u.Modulo||'').split(',').map(m => m.trim()).filter(Boolean);
      const ciclosU = new Set();
      mods.forEach(m => {
        const c = _moduloCiclo(m);
        if (c) { ciclosU.add(c); }
        else {
          const cm = DATA.ciclosModulos.find(x => x.Modulo === m);
          if (cm?.Ciclo) ciclosU.add(cm.Ciclo);
        }
      });
      ciclo = ciclosU.size ? [...ciclosU][0] : 'Sin ciclo asignado';
    }
    if (!grupos[ciclo]) grupos[ciclo] = [];
    grupos[ciclo].push(u);
  });

  const ciclosOrdenados = Object.keys(grupos).sort((a, b) =>
    a === 'Sin ciclo asignado' ? 1 : b === 'Sin ciclo asignado' ? -1 : a.localeCompare(b, 'es')
  );

  // Para el filtro y data-modulos usar solo el nombre (sin prefijo de ciclo)
  const todosModulos = [...new Set(
    lista.flatMap(u => (u.Modulo||'').split(',').map(m => _moduloNombre(m.trim())).filter(Boolean))
  )].sort((a,b) => a.localeCompare(b,'es'));

  const filtroOpts = todosModulos.map(m => `<option value="${m}">${m}</option>`).join('');

  const gruposHtml = ciclosOrdenados.map((ciclo, gi) => {
    const usrs = grupos[ciclo];
    const filas = usrs.map(u => {
      const idx = DATA.usuarios.indexOf(u);
      const modNombres = (u.Modulo||'').split(',').map(m => _moduloNombre(m.trim())).filter(Boolean);
      const modBadges = _badgesModulos(u.Modulo);
      const labBadges = _badgesLabs(u.Ubicaciones_Asignadas);
      // Los _sbOnly no tienen fila en el catálogo: ni el permiso ni la contraseña se tocan aquí
      const gestionable = puedeEditar && !u._sbOnly && !!u.ID_Usuario;
      const revisa = u.Puede_Revisar_Inventario === 'TRUE';
      return `<tr data-modulos="${modNombres.join(',')}" data-idusuario="${_escAttr(gestionable ? u.ID_Usuario : '')}">
        <td><strong>${u.Nombre||'—'}</strong></td>
        <td>${u.Email||'—'}</td>
        <td>${modBadges}</td>
        <td>${labBadges}</td>
        <td style="text-align:center">
          <input type="checkbox" class="alumno-revisa-check" data-id="${_escAttr(u.ID_Usuario||'')}"
            ${revisa ? 'checked' : ''} ${gestionable ? '' : 'disabled'}
            onchange="toggleRevisarInventario(this)"
            title="Puede revisar inventario de material fungible" style="cursor:pointer">
        </td>
        <td>${u.Activo !== 'FALSE' ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
        <td><div class="row-actions">${gestionable ? `<button class="icon-btn" onclick="editUsuario(${idx})">✏️</button>${_botonPasswordAlumnado(u, idx)}` : ''}${_botonBorrarUsuario(u, idx, puedeBorrar)}</div></td>
      </tr>`;
    }).join('');
    // Acciones de grupo: aplican a las filas visibles del grupo (o sea, respetan el
    // buscador y el filtro por módulo), para no tener que abrir alumno por alumno.
    const accionesGrupo = puedeEditar ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--text-muted)">Revisar inventario:</span>
      <button class="btn btn-secondary" style="padding:3px 10px;font-size:11px" onclick="setRevisarInventarioGrupo(${gi}, true)">✅ Todos</button>
      <button class="btn btn-secondary" style="padding:3px 10px;font-size:11px" onclick="setRevisarInventarioGrupo(${gi}, false)">⬜ Ninguno</button>
    </div>` : '';
    return `<div class="card" id="usr-grupo-alumnos-${gi}" style="margin-bottom:16px">
      <div class="card-header" style="flex-wrap:wrap">
        <div class="card-title">${ciclo} <span style="font-weight:400;color:var(--text-muted)">(${usrs.length})</span></div>
        ${accionesGrupo}
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Módulo(s)</th><th>Labs</th><th style="text-align:center" title="Puede revisar inventario de material fungible">Inventario</th><th>Activo</th><th></th></tr></thead>
        <tbody class="tabla-alumnos-grupo">${filas}</tbody>
      </table>
    </div>`;
  }).join('');

  return `
    ${misGrupos}
    ${todosModulos.length > 0 ? `<div style="margin-bottom:16px">
      <select id="filtro-alumno-modulo" onchange="filtrarAlumnos(this.value)"
        style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);font-size:13px">
        <option value="">— Todos los módulos —</option>
        ${filtroOpts}
      </select>
    </div>` : ''}
    ${gruposHtml}
  `;
}

// ── Permiso de revisar inventario y contraseñas, desde la propia tabla ──────────
// La casilla individual del modal de usuario sigue estando; esto es el mismo dato sin
// abrir el modal, más botones para aplicarlo a un grupo entero de una vez.

function _aplicarRevisarInventarioLocal(ids, valor) {
  const set = new Set(ids);
  DATA.usuarios.forEach(u => {
    if (set.has(u.ID_Usuario)) u.Puede_Revisar_Inventario = valor ? 'TRUE' : '';
  });
}

// Filas del grupo que están a la vista (el buscador y el filtro por módulo ocultan con
// display:none), que es lo que se considera "el grupo" al actuar en bloque.
function _filasVisiblesGrupoAlumnos(gi) {
  return Array.from(document.querySelectorAll(`#usr-grupo-alumnos-${gi} tbody tr`))
    .filter(tr => tr.style.display !== 'none' && tr.dataset.idusuario);
}

async function toggleRevisarInventario(cb) {
  const id = cb.dataset.id;
  const valor = cb.checked;
  if (!id) return;
  cb.disabled = true;
  try {
    await callEdgeFunction('gestionar-usuario', { accion: 'revisar_inventario', ids: [id], valor });
    _aplicarRevisarInventarioLocal([id], valor);
    showToast(valor ? 'Ya puede revisar inventario' : 'Permiso de revisión retirado', 'success');
  } catch (e) {
    cb.checked = !valor;
    showToast('Error: ' + e.message, 'error');
  }
  cb.disabled = false;
}

async function setRevisarInventarioGrupo(gi, valor) {
  const checks = _filasVisiblesGrupoAlumnos(gi)
    .map(tr => tr.querySelector('.alumno-revisa-check'))
    .filter(cb => cb && !cb.disabled && cb.checked !== valor);
  if (!checks.length) { showToast('No hay cambios que aplicar en este grupo', 'success'); return; }

  const ids = checks.map(cb => cb.dataset.id);
  if (!confirm(
    `${valor ? '¿Dar' : '¿Quitar'} el permiso de revisar inventario a ${ids.length} alumno(s) de este grupo?\n\n` +
    `Se aplica solo a los que se ven ahora mismo (el buscador y el filtro por módulo cuentan).`
  )) return;

  showLoading('Aplicando...');
  try {
    await callEdgeFunction('gestionar-usuario', { accion: 'revisar_inventario', ids, valor });
    _aplicarRevisarInventarioLocal(ids, valor);
    checks.forEach(cb => { cb.checked = valor; });
    showToast(`Permiso ${valor ? 'concedido' : 'retirado'} a ${ids.length} alumno(s)`, 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
  hideLoading();
}

// ── Contraseñas del alumnado ───────────────────────────────────────────────
// El alumnado entra por cuentas de GRUPO, y la contraseña de un grupo es
// compartida a propósito (como la clave del wifi del aula): el profesorado tiene
// que poder consultarla para dictarla en clase y cambiarla cuando haga falta. Eso
// es el modal 🔑, que la pide al servidor (se guarda cifrada, ver
// supabase/functions/_shared/secretos.ts).
//
// La contraseña de una PERSONA no se guarda en ningún sitio, así que no se puede
// consultar: si quedase alguna cuenta personal antigua de alumnado, su botón 🔑
// sigue siendo el de restablecer de siempre.
function _botonPasswordAlumnado(u, idx) {
  if (!_esCuentaDeGrupo(u.Email)) {
    return `<button class="icon-btn" title="Restablecer contraseña" onclick="resetearPasswordUsuario(${idx})">🔑</button>`;
  }
  // Un Profesor solo lleva sus grupos: el servidor rechaza los demás
  // (`requiereGrupoPropio`), así que aquí no se ofrece el botón siquiera.
  // Admin y Gestor administran las cuentas y llegan a todas.
  if (getUserRole() === 'Profesor' && !_esGrupoPropio(u.ID_Usuario)) return '';
  return `<button class="icon-btn" title="Contraseña del grupo" onclick="abrirPasswordGrupo(${idx})">🔑</button>`;
}

/** ¿Este grupo está asignado a quien mira? Respeta la vista previa de rol. */
function _esGrupoPropio(idGrupo) {
  return _misGruposDelUsuario().some(g => g.ID_Usuario === idGrupo);
}

// Estado del modal de contraseña de grupo. La contraseña vive aquí solo mientras
// el modal está abierto; al cerrarlo se olvida.
let _pwGrupo = null;

function abrirPasswordGrupo(idx) {
  const u = DATA.usuarios[idx];
  if (!u) return;
  _pwGrupo = { idUsuario: u.ID_Usuario, nombre: u.Nombre, email: u.Email, password: null, sinGuardar: false, editando: false, info: '' };
  setText('pwg-titulo', `🔑 Contraseña de ${u.Nombre}`);
  setText('pwg-email', u.Email);
  _pwgRender();
  openModal('modal-password-grupo');
}

function cerrarPasswordGrupo() {
  _pwGrupo = null;
  const c = document.getElementById('pwg-cuerpo');
  if (c) c.innerHTML = '';
  closeModal('modal-password-grupo');
}

function _pwgRender() {
  const c = document.getElementById('pwg-cuerpo');
  if (!c || !_pwGrupo) return;
  const st = _pwGrupo;

  const botonesCambio = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
    <button class="btn btn-secondary" onclick="generarPasswordGrupo()">🔄 Generar una nueva</button>
    ${st.editando ? '' : '<button class="btn btn-secondary" onclick="editarPasswordGrupo()">✏️ Escribirla yo</button>'}
  </div>`;

  if (st.editando) {
    c.innerHTML = `
      <div class="form-group">
        <label>Contraseña nueva</label>
        <input id="pwg-nueva" placeholder="Mínimo 6 caracteres" autocomplete="off"
          style="font-family:monospace" onkeydown="if(event.key==='Enter')guardarPasswordGrupo()">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="guardarPasswordGrupo()">Guardar contraseña</button>
        <button class="btn btn-secondary" onclick="cancelarEdicionPasswordGrupo()">Cancelar</button>
      </div>`;
    document.getElementById('pwg-nueva')?.focus();
    return;
  }

  if (st.password) {
    c.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <code style="font-size:18px;letter-spacing:1px;background:var(--bg-alt,#f1f3f5);border-radius:8px;padding:8px 14px">${_escAttr(st.password)}</code>
        <button class="btn btn-secondary" onclick="copiarPasswordGrupo()">📋 Copiar</button>
        <button class="btn btn-secondary" onclick="ocultarPasswordGrupo()">🙈 Ocultar</button>
      </div>
      ${st.info ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px">${st.info}</div>` : ''}
      ${botonesCambio}`;
    return;
  }

  if (st.sinGuardar) {
    c.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);line-height:1.5">
        Esta cuenta se creó antes de que la app guardase la contraseña, así que no se
        puede consultar (Supabase solo conserva un hash). Genera una nueva y dásela al grupo.
      </div>
      ${botonesCambio}`;
    return;
  }

  c.innerHTML = `
    <div style="font-size:13px;color:var(--text-muted);line-height:1.5;margin-bottom:12px">
      La cuenta es de todo el grupo, así que su contraseña se puede consultar y dictar en clase.
    </div>
    <button class="btn btn-secondary" onclick="mostrarPasswordGrupo()">👁️ Mostrar contraseña</button>`;
}

async function mostrarPasswordGrupo() {
  if (!_pwGrupo) return;
  showLoading('Consultando...');
  try {
    const r = await callEdgeFunction('gestionar-usuario', { accion: 'ver_password_grupo', id_usuario: _pwGrupo.idUsuario });
    if (r?.sin_guardar) { _pwGrupo.sinGuardar = true; _pwGrupo.password = null; }
    else {
      _pwGrupo.password = r.password;
      _pwGrupo.sinGuardar = false;
      _pwGrupo.info = _pwgInfoCambio(r.actualizado_en, r.actualizado_por);
    }
    _pwgRender();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
  hideLoading();
}

function _pwgInfoCambio(iso, autor) {
  if (!iso) return '';
  const f = new Date(iso);
  const fecha = isNaN(f) ? '' : f.toLocaleDateString('es-ES');
  return `Cambiada${autor ? ` por ${autor}` : ''}${fecha ? ` el ${fecha}` : ''}`;
}

function ocultarPasswordGrupo() {
  if (!_pwGrupo) return;
  _pwGrupo.password = null;
  _pwGrupo.sinGuardar = false;
  _pwgRender();
}

function editarPasswordGrupo() {
  if (!_pwGrupo) return;
  _pwGrupo.editando = true;
  _pwgRender();
}

function cancelarEdicionPasswordGrupo() {
  if (!_pwGrupo) return;
  _pwGrupo.editando = false;
  _pwgRender();
}

async function copiarPasswordGrupo() {
  if (!_pwGrupo?.password) return;
  try {
    await navigator.clipboard.writeText(_pwGrupo.password);
    showToast('Contraseña copiada ✓', 'success');
  } catch {
    showToast('El navegador no dejó copiar. Selecciónala a mano.', 'error');
  }
}

function generarPasswordGrupo() {
  if (!_pwGrupo) return;
  if (!confirm(
    `¿Generar una contraseña nueva para ${_pwGrupo.nombre}?\n\n` +
    `La que tenga dejará de funcionar: habrá que darle la nueva al grupo.`
  )) return;
  _cambiarPasswordGrupo(null, 'Contraseña nueva generada. Dásela al grupo.');
}

function guardarPasswordGrupo() {
  if (!_pwGrupo) return;
  const nueva = v('pwg-nueva');
  if (nueva.length < 6) { showToast('La contraseña necesita al menos 6 caracteres', 'error'); return; }
  _cambiarPasswordGrupo(nueva, 'Contraseña cambiada.');
}

async function _cambiarPasswordGrupo(password, mensajeOk) {
  showLoading('Cambiando contraseña...');
  try {
    const r = await callEdgeFunction('gestionar-usuario', {
      accion: 'cambiar_password_grupo', id_usuario: _pwGrupo.idUsuario, password: password || '',
    });
    _pwGrupo.password = r.password;
    _pwGrupo.sinGuardar = false;
    _pwGrupo.editando = false;
    _pwGrupo.info = _pwgInfoCambio(new Date().toISOString(), _nombreCorto(currentUser?.name || ''));
    _pwgRender();
    // El cambio en Auth sí se hizo; lo que puede fallar es la copia consultable.
    if (r.aviso) showToast(`Contraseña cambiada, pero no se guardó la copia para consultarla: ${r.aviso}`, 'error');
    else showToast(mensajeOk, 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
  hideLoading();
}

// La contraseña de una cuenta PERSONAL no se guarda: solo se puede restablecer a la
// parte del email anterior a "@" (igual que en TRebello). No se manda ningún correo,
// se dicta en clase — por eso se enseña en un alert y no en un toast, que desaparece
// a los 3 segundos.
async function resetearPasswordUsuario(idx) {
  const u = DATA.usuarios[idx];
  if (!u) return;
  if (!confirm(
    `¿Restablecer la contraseña de ${u.Nombre}?\n\n` +
    `Volverá a ser la parte de su email anterior a «@». La que tuviera dejará de valer.`
  )) return;

  showLoading('Restableciendo...');
  let resultados;
  try {
    ({ resultados } = await callEdgeFunction('gestionar-usuario', { accion: 'resetear_password', ids: [u.ID_Usuario] }));
  } catch (e) {
    hideLoading(); showToast('Error: ' + e.message, 'error'); return;
  }
  hideLoading();
  const r = (resultados || [])[0];
  if (r?.ok) alert(`Contraseña de ${u.Nombre} restablecida:\n\n${r.password}`);
  else showToast(`No se pudo restablecer: ${r?.motivo || 'error desconocido'}`, 'error');
}

function filtrarAlumnos(modulo) {
  const q = (document.getElementById('search-usuarios')?.value || '').toLowerCase().trim();
  document.querySelectorAll('.tabla-alumnos-grupo tr').forEach(tr => {
    const textoFila = tr.textContent.toLowerCase();
    const pasaBusqueda = !q || textoFila.includes(q);
    const pasFiltro = !modulo || (tr.getAttribute('data-modulos') || '').split(',').map(m => m.trim()).includes(modulo);
    tr.style.display = pasaBusqueda && pasFiltro ? '' : 'none';
  });
}

function buscarUsuario(q) {
  q = (q || '').toLowerCase().trim();
  document.querySelectorAll('#usuarios-contenido tbody tr').forEach(tr => {
    tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function _getLabsDeUbics(ubicStr) {
  // Ubicaciones_Asignadas now stores lab numbers directly ("201","203",...)
  // Backwards compat: also detect lab numbers from old zone-ID format via Laboratorio_Aula
  if (!ubicStr) return [];
  const vals = ubicStr.split(',').map(s => s.trim()).filter(Boolean);
  const labs = new Set();
  vals.forEach(val => {
    if (/^\d{3}$/.test(val)) {
      labs.add(val);
      return;
    }
    const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === val);
    if (u) {
      const n = _extraerLabDeUbicacion(u.Laboratorio_Aula);
      if (n) labs.add(n);
      return;
    }
    // Texto libre tipo "Lab 209" (lo que devuelve Sanidad CMA al importar profesorado)
    const suelto = _extraerLabDeUbicacion(val);
    if (suelto) labs.add(suelto);
  });
  return [...labs].sort();
}

function _getUbicacionesDeLabs(labsList) {
  return labsList.join(',');
}

// Labs que existen de verdad: los de Ubicaciones + los de equipos. Antes estaban
// escritos a mano (201/203/205/207) y el profesorado importado de Sanidad CMA puede
// tener labs fuera de esa lista (p.ej. 209), que quedaban invisibles en el modal.
function _labsConocidos(extra) {
  const labs = new Set((extra || []).filter(Boolean));
  (DATA.ubicaciones || []).forEach(u => {
    const n = _extraerLabDeUbicacion(u.Laboratorio_Aula);
    if (n) labs.add(n);
  });
  (DATA.equipos || []).forEach(e => {
    const n = _extraerLabDeUbicacion(e.Ubicacion);
    if (n) labs.add(n);
  });
  return [...labs].sort();
}

function _renderLabsChecks(labsSeleccionados) {
  const cont = document.getElementById('usr-labs-checks');
  if (!cont) return;
  const sel = labsSeleccionados || [];
  const todos = _labsConocidos(sel);
  if (!todos.length) {
    cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted);font-style:italic">Sin laboratorios registrados.</span>';
    return;
  }
  cont.innerHTML = todos.map(l => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer">
    <input type="checkbox" class="usr-lab-check" value="${l}" ${sel.includes(l) ? 'checked' : ''}> Lab ${l}
  </label>`).join('');
}

// Roles a los que se les pueden asignar modulos y labs desde el modal.
// Administrador queda fuera a proposito: ve toda la app, no se acota por lab.
const ROLES_CON_ASIGNACION = ['Alumno', 'Profesor', 'Gestor'];
const _esRolDocente = rol => rol === 'Profesor' || rol === 'Gestor';

function _populateModalUsuarioAsignacion(rol, modulosStr, ubicStr, cicloPrincipal, gruposStr) {
  _refreshModuloCheckboxes(modulosStr, cicloPrincipal, rol);
  _renderLabsChecks(_getLabsDeUbics(ubicStr));
  _renderGruposChecks(gruposStr);
}

// ── Grupos de alumnado que lleva un docente ─────────────────────────────────
// Se asigna a mano, no se deduce de los módulos: el mismo módulo lo imparten
// grupos de ciclos distintos, y un profe puede dar clase fuera de su ciclo
// principal, así que cruzarlo por módulo daba grupos de más y de menos. De esta
// asignación sale el bloque "Mis grupos" de la pestaña Alumnos.
function _cuentasDeGrupo() {
  return DATA.usuarios
    .filter(u => u.Rol === 'Alumno' && _esCuentaDeGrupo(u.Email) && u.ID_Usuario && !u._sbOnly)
    .sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || '', 'es'));
}

function _parseGrupos(gruposStr) {
  return String(gruposStr || '').split(',').map(g => g.trim()).filter(Boolean);
}

function _renderGruposChecks(gruposStr) {
  const cont = document.getElementById('usr-grupos-checks');
  if (!cont) return;
  const marcados = _parseGrupos(gruposStr);
  const grupos = _cuentasDeGrupo();
  if (!grupos.length) {
    cont.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No hay cuentas de grupo dadas de alta.</div>';
    return;
  }
  cont.innerHTML = grupos.map(g => `
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
      <input type="checkbox" class="usr-grupo-check" value="${_escAttr(g.ID_Usuario)}"
        ${marcados.includes(g.ID_Usuario) ? 'checked' : ''} style="width:15px;height:15px">
      <span>${g.Nombre || g.Email}</span>
    </label>`).join('');
}

function _getGruposSeleccionados() {
  return Array.from(document.querySelectorAll('#usr-grupos-checks .usr-grupo-check:checked')).map(cb => cb.value);
}

function _normCiclo(s) {
  return (s || '').normalize('NFC').trim().toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    .replace(/ñ/g,'n').replace(/\s+/g,' ');
}

// Módulos transversales / no técnicos (FOL, EIE, FCT, Proxecto, idiomas, itinerario de
// empregabilidade, sostenibilidade, dixitalización...): no se dan en laboratorio ni tocan
// equipamiento, así que no pintan nada en GestionLab — ni se ofrecen en el checklist de
// módulos del modal de usuario ni se importan como matrícula desde Sanidad CMA. Comparación
// por subcadena normalizada (_normCiclo): "Proxecto" cubre "Proxecto integrado de ...", etc.
// Los nombres van como los devuelve Sanidad CMA (en gallego) — ver docs/modulo-usuarios.md.
const MODULOS_AJENOS_A_GESTIONLAB = [
  'Afondamento nas Competencias Profesionais',
  'Formación en Centros de Traballo',
  'Proxecto',
  'Formación e Orientación Laboral',
  'Empresa e Iniciativa Emprendedora',
  'Itinerario Persoal para a Empregabilidade',
  'Dixitalización Aplicada aos Sectores Produtivos',
  'Sostenibilidade Aplicada ao Sistema Produtivo',
  'Inglés Profesional',
  'Habilidades Comunicativas en Lingua Estranxeira',
];

function _moduloInteresaEnGestionLab(modulo) {
  const m = _normCiclo(modulo || '');
  return !!m && !MODULOS_AJENOS_A_GESTIONLAB.some(x => m.includes(_normCiclo(x)));
}

function _refreshModuloCheckboxes(preselectedStr, cicloPrincipal, rol) {
  // Source of truth: plain module names (no ciclo prefix)
  _selectedModulosArray = (preselectedStr || '').split(',')
    .map(m => _moduloNombre(m.trim()))  // strip "Ciclo|" prefix from old format
    .filter(Boolean);

  // Populate ciclo dropdown
  const cicloSel = document.getElementById('usr-ciclo-principal');
  if (cicloSel) {
    const ciclosUnicos = [...new Set(
      DATA.ciclosModulos.filter(cm => cm.Ciclo && cm.Modulo).map(cm => cm.Ciclo)
    )].sort((a,b) => a.localeCompare(b,'es'));
    const optsHtml = ciclosUnicos.map(c => `<option value="${c}">${c}</option>`).join('');
    cicloSel.innerHTML = `<option value="">— Seleccionar ciclo —</option>${optsHtml}`;
    if (cicloPrincipal) {
      // Exact match first; fall back to accent/case-normalized match
      const exactMatch = ciclosUnicos.find(c => c === cicloPrincipal);
      const fuzzyMatch = exactMatch || ciclosUnicos.find(c => _normCiclo(c) === _normCiclo(cicloPrincipal));
      if (fuzzyMatch) cicloSel.value = fuzzyMatch;
    }
  }

  // Un docente puede impartir en varios ciclos, asi que ve el catalogo completo de
  // modulos en vez de solo los del ciclo seleccionado (que para el es informativo).
  if (_esRolDocente(rol)) {
    _renderModuloCheckboxesDocente();
    return;
  }

  // Resolve canonical ciclo name from DATA for the module lookup
  const cicloCanon = cicloPrincipal
    ? (DATA.ciclosModulos.find(cm => cm.Ciclo && _normCiclo(cm.Ciclo) === _normCiclo(cicloPrincipal))?.Ciclo || cicloPrincipal)
    : '';
  _renderModuloCheckboxesPorCiclo(cicloCanon);
}

// Checklist de modulos para Profesor/Gestor: todos los ciclos a la vez.
// Los nombres de modulo se guardan planos (sin prefijo de ciclo), asi que un modulo
// que se repite en varios ciclos aparece una sola vez indicando en cuales esta.
function _renderModuloCheckboxesDocente() {
  const cont = document.getElementById('usr-modulos-checks');
  if (!cont) return;

  const porModulo = new Map();
  (DATA.ciclosModulos || []).forEach(cm => {
    if (!cm.Modulo || !cm.Ciclo) return;
    if (!porModulo.has(cm.Modulo)) porModulo.set(cm.Modulo, new Set());
    porModulo.get(cm.Modulo).add(cm.Ciclo);
  });
  // Modulos ya guardados que no esten en el catalogo: no se pierden de vista
  _selectedModulosArray.forEach(m => { if (!porModulo.has(m)) porModulo.set(m, new Set()); });

  // Los transversales (FOL, idiomas, itinerario...) no se ofrecen: no hay nada que
  // gestionar en GestionLab por impartirlos. Si alguien ya los tenia guardados siguen
  // visibles para poder quitarlos.
  const modulos = [...porModulo.keys()]
    .filter(m => _moduloInteresaEnGestionLab(m) || _selectedModulosArray.includes(m))
    .sort((a, b) => a.localeCompare(b, 'es'));
  if (!modulos.length) {
    cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Sin modulos registrados.</span>';
    _syncChipsModulos();
    return;
  }

  cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:4px">' +
    modulos.map(m => {
      const checked = _selectedModulosArray.includes(m) ? 'checked' : '';
      const ciclos = [...porModulo.get(m)].sort((a, b) => a.localeCompare(b, 'es')).join(' \u00b7 ');
      return `<label class="usr-modulo-row" data-buscar="${_escAttr((m + ' ' + ciclos).toLowerCase())}"
        style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:5px 10px;background:var(--bg-soft,#f5f5f5);border-radius:6px;font-size:12px">
        <input type="checkbox" class="usr-modulo-check" value="${_escAttr(m)}" ${checked} onchange="_onModuloChange(this)" style="margin-top:2px">
        <span><span style="font-weight:500">${m}</span>${ciclos ? `<br><span style="color:var(--text-muted);font-size:11px">${ciclos}</span>` : ''}</span>
      </label>`;
    }).join('') + '</div>';
  _syncChipsModulos();
}

function _filtrarModulosChecks(q) {
  const t = (q || '').toLowerCase().trim();
  document.querySelectorAll('#usr-modulos-checks .usr-modulo-row').forEach(row => {
    row.style.display = !t || (row.getAttribute('data-buscar') || '').includes(t) ? '' : 'none';
  });
}

function _renderModuloCheckboxesPorCiclo(ciclo) {
  const cont = document.getElementById('usr-modulos-checks');
  if (!cont) return;

  if (!ciclo) {
    cont.innerHTML = `<span style="font-size:12px;color:var(--text-muted);font-style:italic">Selecciona primero el ciclo formativo.</span>`;
    _syncChipsModulos();
    return;
  }

  // Mismo criterio que en el checklist docente: fuera los transversales, salvo que la
  // persona ya los tuviera marcados de antes.
  const modulos = DATA.ciclosModulos
    .filter(cm => cm.Ciclo === ciclo && cm.Modulo)
    .map(cm => cm.Modulo)
    .filter(m => _moduloInteresaEnGestionLab(m) || _selectedModulosArray.includes(m))
    .sort((a,b) => a.localeCompare(b,'es'));

  if (!modulos.length) {
    cont.innerHTML = `<span style="font-size:12px;color:var(--text-muted)">Sin módulos registrados para este ciclo.</span>`;
    return;
  }

  cont.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px">` +
    modulos.map(m => {
      const checked = _selectedModulosArray.includes(m) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px;background:var(--bg-soft,#f5f5f5);border-radius:6px;font-size:12px">
        <input type="checkbox" class="usr-modulo-check" value="${m}" ${checked} onchange="_onModuloChange(this)"> ${m}
      </label>`;
    }).join('') + `</div>`;
  _syncChipsModulos();
}

function _onCicloPrincipalChange(ciclo) {
  // En modo docente el ciclo es solo informativo: los modulos no se filtran por el
  if (_esRolDocente(v('usr-rol'))) return;
  // Remove selected modules that don't belong to the new ciclo
  const modsDelCiclo = new Set(
    DATA.ciclosModulos.filter(cm => cm.Ciclo === ciclo && cm.Modulo).map(cm => cm.Modulo)
  );
  _selectedModulosArray = _selectedModulosArray.filter(m => modsDelCiclo.has(m));
  _renderModuloCheckboxesPorCiclo(ciclo);
}

function _onModuloChange(cb) {
  // cb.value is now a plain module name (no ciclo prefix)
  if (cb.checked) {
    if (!_selectedModulosArray.includes(cb.value)) _selectedModulosArray.push(cb.value);
  } else {
    _selectedModulosArray = _selectedModulosArray.filter(m => m !== cb.value);
  }
  _syncChipsModulos();
}

function _syncChipsModulos() {
  const cont = document.getElementById('usr-modulos-seleccionados');
  if (!cont) return;
  const selected = _getModulosSeleccionados();
  if (!selected.length) {
    cont.innerHTML = `<span style="font-size:11px;color:var(--text-muted);font-style:italic">Ningún módulo seleccionado</span>`;
    return;
  }
  cont.innerHTML = selected.map(m => {
    // m is a plain module name now
    const safe = m.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--primary,#4f46e5);color:#fff;border-radius:99px;font-size:11px;font-weight:500">
      ${m}
      <button type="button" onclick="_desmarcarModulo('${safe}')" style="background:none;border:none;color:#fff;cursor:pointer;padding:0;font-size:14px;line-height:1;opacity:0.8">×</button>
    </span>`;
  }).join('');
}

function _desmarcarModulo(nombre) {
  _selectedModulosArray = _selectedModulosArray.filter(m => m !== nombre);
  document.querySelectorAll('.usr-modulo-check').forEach(cb => {
    if (cb.value === nombre) cb.checked = false;
  });
  _syncChipsModulos();
}

let _selectedModulosArray = [];

function _getModulosSeleccionados() {
  return [..._selectedModulosArray];
}

function _getLabsSeleccionados() {
  return Array.from(document.querySelectorAll('.usr-lab-check:checked')).map(cb => cb.value);
}

// ============================================================
// MODALES PROVEEDORES / UBICACIONES / USUARIOS
// ============================================================
function openModalProveedor() { editingRow = null; ['prov-nombre','prov-contacto','prov-email','prov-telefono','prov-web','prov-observaciones'].forEach(id => sv(id,'')); clearTiposProveedor(); openModal('modal-proveedor'); }
function openModalUbicacion() { editingRow = null; ['ubi-id','ubi-lab','ubi-zona','ubi-subzona','ubi-desc'].forEach(id => sv(id,'')); openModal('modal-ubicacion'); }
function openModalUsuario() {
  editingRow = null;
  ['usr-nombre','usr-email'].forEach(id => sv(id,''));
  sv('usr-rol','Profesor');
  const cicloSel = document.getElementById('usr-ciclo-principal');
  if (cicloSel) cicloSel.value = '';
  _selectedModulosArray = [];
  _renderGruposChecks('');
  toggleUbicacionesAsignadasField('Profesor');
  const selRol = document.getElementById('usr-rol');
  if (selRol) selRol.disabled = false;
  openModal('modal-usuario');
}

// Muestra u oculta el bloque de ciclo / modulos / labs segun el rol, y lo adapta:
// el alumno tiene un ciclo obligatorio que filtra sus modulos; el docente (Profesor o
// Gestor) puede impartir en varios ciclos y solo el alumno tiene revision de inventario.
function _ajustarBloqueAsignacion(rol) {
  const docente = _esRolDocente(rol);
  const labelCiclo = document.getElementById('usr-ciclo-label');
  if (labelCiclo) labelCiclo.textContent = docente ? 'Ciclo principal (opcional)' : 'Ciclo formativo *';
  const grpRev = document.getElementById('usr-revisar-group');
  if (grpRev) grpRev.style.display = rol === 'Alumno' ? '' : 'none';
  const grpGrupos = document.getElementById('usr-grupos-group');
  if (grpGrupos) grpGrupos.style.display = docente ? '' : 'none';
  const buscar = document.getElementById('usr-modulos-buscar');
  if (buscar) {
    buscar.style.display = docente ? '' : 'none';
    buscar.value = '';
  }
}

function toggleUbicacionesAsignadasField(rol) {
  const grp = document.getElementById('usr-asignacion-fields');
  if (!grp) return;
  if (!ROLES_CON_ASIGNACION.includes(rol)) {
    grp.style.display = 'none';
    return;
  }
  grp.style.display = '';
  _ajustarBloqueAsignacion(rol);
  // Cambiar de rol conserva lo ya marcado: solo cambia como se presenta
  _populateModalUsuarioAsignacion(rol, _selectedModulosArray.join(','),
    _getUbicacionesDeLabs(_getLabsSeleccionados()),
    document.getElementById('usr-ciclo-principal')?.value || '',
    _getGruposSeleccionados().join(','));
  if (rol !== 'Alumno') {
    const cbRev = document.getElementById('usr-puede-revisar');
    if (cbRev) cbRev.checked = false;
  }
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
  // _sbOnly: usuario de Supabase sin fila en Sheets → insertar nuevo al guardar
  editingRow = u._sbOnly ? null : { sheet: 'Usuarios', rowIndex: idx };
  sv('usr-nombre', u.Nombre); sv('usr-email', u.Email); sv('usr-rol', u.Rol);
  const grp = document.getElementById('usr-asignacion-fields');
  const conAsignacion = ROLES_CON_ASIGNACION.includes(u.Rol);
  if (grp) grp.style.display = conAsignacion ? '' : 'none';
  _selectedModulosArray = [];
  if (conAsignacion) {
    _ajustarBloqueAsignacion(u.Rol);
    _populateModalUsuarioAsignacion(u.Rol, u.Modulo||'', u.Ubicaciones_Asignadas||'', u.Ciclo_Principal||'', u.Grupos_Asignados||'');
    const cbRev = document.getElementById('usr-puede-revisar');
    if (cbRev) cbRev.checked = u.Rol === 'Alumno' && u.Puede_Revisar_Inventario === 'TRUE';
  }
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
  const datos = {
    nombre_proveedor: nombre,
    tipo_proveedor: getTiposProveedorSeleccionados(),
    persona_contacto: v('prov-contacto'),
    email_contacto: v('prov-email'),
    telefono: v('prov-telefono'),
    web: v('prov-web'),
    observaciones: v('prov-observaciones'),
  };
  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Proveedores') {
      const idProveedor = DATA.proveedores[editingRow.rowIndex].ID_Proveedor;
      const { proveedor } = await callEdgeFunction('gestionar-proveedor', { accion: 'actualizar', id_proveedor: idProveedor, ...datos });
      DATA.proveedores[editingRow.rowIndex] = _proveedorSbToObj(proveedor);
      showToast('Proveedor actualizado', 'success');
    } else {
      const { proveedor } = await callEdgeFunction('gestionar-proveedor', { accion: 'crear', ...datos });
      DATA.proveedores.push(_proveedorSbToObj(proveedor));
      showToast('Proveedor guardado', 'success');
    }
    closeModal('modal-proveedor'); renderAll();
  } catch(e) { showToast('Error guardando: ' + e.message, 'error'); }
  hideLoading(); editingRow = null;
}

async function borrarProveedor(idx) {
  const p = DATA.proveedores[idx];
  const nPedidos = DATA.pedidos.filter(x => x.Proveedor === p.Nombre_Proveedor).length;
  if (nPedidos > 0) { showToast('No se puede eliminar: tiene pedidos asociados', 'error'); return; }
  if (!confirm(`¿Eliminar el proveedor "${p.Nombre_Proveedor}"? Esta acción no se puede deshacer.`)) return;
  showLoading('Eliminando...');
  try {
    await callEdgeFunction('gestionar-proveedor', { accion: 'eliminar', id_proveedor: p.ID_Proveedor });
    DATA.proveedores.splice(idx, 1);
    showToast('Proveedor eliminado', 'success');
    if (document.getElementById('proveedor-detalle')?.style.display !== 'none') showPage('proveedores');
    renderAll();
  } catch(e) { showToast('Error eliminando: ' + e.message, 'error'); console.error(e); }
  hideLoading();
}

async function guardarUbicacion() {
  const id = v('ubi-id'), lab = v('ubi-lab');
  if (!id || !lab) { showToast('ID y laboratorio/aula son obligatorios', 'error'); return; }
  const datos = {
    id_ubicacion: id,
    laboratorio_aula: lab,
    zona: v('ubi-zona'),
    subzona: v('ubi-subzona'),
    descripcion_completa: v('ubi-desc'),
  };
  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Ubicaciones') {
      const idOriginal = DATA.ubicaciones[editingRow.rowIndex].ID_Ubicacion;
      const { ubicacion } = await callEdgeFunction('gestionar-ubicacion', { accion: 'actualizar', id_original: idOriginal, ...datos });
      DATA.ubicaciones[editingRow.rowIndex] = _ubicacionSbToObj(ubicacion);
      showToast('Ubicación actualizada', 'success');
    } else {
      const { ubicacion } = await callEdgeFunction('gestionar-ubicacion', { accion: 'crear', ...datos });
      DATA.ubicaciones.push(_ubicacionSbToObj(ubicacion));
      showToast('Ubicación guardada', 'success');
    }
    closeModal('modal-ubicacion'); renderAll();
  } catch(e) { showToast('Error guardando: ' + e.message, 'error'); }
  hideLoading(); editingRow = null;
}

/**
 * Borrar una ubicación no es como borrar un proveedor: la nombran los equipos,
 * los lotes de `material_ubicaciones` (que además la exige NOT NULL) y la
 * columna legacy `material.ubicacion`. El servidor cuenta primero y, si hay
 * algo colgando, responde 200 con el detalle en vez de reventar con un error
 * de clave ajena — aquí eso se traduce a "no puedo borrarla, ¿la desactivo?",
 * que es lo que se quiere casi siempre: la zona ya no existe físicamente pero
 * el histórico que la menciona tiene que seguir en pie.
 */
async function borrarUbicacion(idx) {
  const u = DATA.ubicaciones[idx];
  if (!u) return;
  if (!confirm(`¿Eliminar la ubicación "${u.ID_Ubicacion}"? Esta acción no se puede deshacer.`)) return;

  showLoading('Eliminando...');
  let res;
  try {
    res = await callEdgeFunction('gestionar-ubicacion', { accion: 'eliminar', id_ubicacion: u.ID_Ubicacion });
  } catch (e) {
    hideLoading();
    showToast(e.message || 'No se pudo eliminar la ubicación', 'error');
    console.error(e);
    return;
  }
  hideLoading();

  if (res.eliminada) {
    DATA.ubicaciones.splice(idx, 1);
    showToast('Ubicación eliminada', 'success');
    renderAll();
    return;
  }

  const n = res.en_uso || {};
  const partes = [];
  if (n.equipos)  partes.push(`${n.equipos} equipo(s)`);
  if (n.lotes)    partes.push(`${n.lotes} lote(s) de material`);
  if (n.material) partes.push(`${n.material} ítem(s) del catálogo`);
  if (n.otros)    partes.push('otros registros');
  const detalle = partes.join(', ') || 'otros registros';

  if (u.Activa === 'FALSE') {
    showToast(`No se puede eliminar: la usan ${detalle}. Ya está desactivada.`, 'error');
    return;
  }
  if (!confirm(
    `No se puede eliminar "${u.ID_Ubicacion}": la usan ${detalle}.\n\n` +
    `¿La desactivo? Dejará de aparecer al elegir ubicación, pero no se pierde ` +
    `nada de lo que ya apunta a ella.`)) return;
  await cambiarEstadoUbicacion(idx, false);
}

async function cambiarEstadoUbicacion(idx, activa) {
  const u = DATA.ubicaciones[idx];
  if (!u) return;
  showLoading(activa ? 'Reactivando...' : 'Desactivando...');
  try {
    const { ubicacion } = await callEdgeFunction('gestionar-ubicacion',
      { accion: 'cambiar_estado', id_ubicacion: u.ID_Ubicacion, activa });
    DATA.ubicaciones[idx] = _ubicacionSbToObj(ubicacion);
    showToast(activa ? 'Ubicación reactivada' : 'Ubicación desactivada', 'success');
    renderAll();
  } catch (e) {
    showToast(e.message || 'No se pudo cambiar el estado', 'error');
    console.error(e);
  }
  hideLoading();
}

async function guardarUsuario() {
  const nombre = v('usr-nombre'), email = v('usr-email');
  if (!nombre || !email) { showToast('Nombre y email son obligatorios', 'error'); return; }

  if (getUserRole() === 'Profesor') {
    if (editingRow) {
      const uExist = DATA.usuarios[editingRow.rowIndex];
      if (uExist?.Rol !== 'Alumno') { showToast('No tienes permiso para modificar este usuario', 'error'); return; }
    } else {
      showToast('No tienes permiso para crear nuevos usuarios', 'error'); return;
    }
    sv('usr-rol', 'Alumno');
  }

  const existingU = editingRow ? DATA.usuarios[editingRow.rowIndex] : null;
  const rol = v('usr-rol') || 'Alumno';
  let ubicAsignadas = '', modulo = '', cicloPrincipal = '', puedeRevisarInventario = false, gruposAsignados = '';
  if (ROLES_CON_ASIGNACION.includes(rol)) {
    ubicAsignadas = _getUbicacionesDeLabs(_getLabsSeleccionados());
    modulo = _getModulosSeleccionados().join(',');  // plain module names
    cicloPrincipal = (document.getElementById('usr-ciclo-principal')?.value || '').trim();
    if (_esRolDocente(rol)) gruposAsignados = _getGruposSeleccionados().join(',');
    // El ciclo solo es obligatorio para alumnado: un docente puede impartir en varios
    if (rol === 'Alumno') {
      if (!cicloPrincipal) { showToast('Selecciona el ciclo formativo del alumno', 'error'); return; }
      puedeRevisarInventario = !!document.getElementById('usr-puede-revisar')?.checked;
    }
  }
  const datos = {
    nombre, email, rol, ubicaciones_asignadas: ubicAsignadas, modulo,
    ciclo_principal: cicloPrincipal, puede_revisar_inventario: puedeRevisarInventario,
    grupos_asignados: gruposAsignados,
  };
  showLoading('Guardando...');
  try {
    if (existingU) {
      const { usuario } = await callEdgeFunction('gestionar-usuario', { accion: 'actualizar', id_usuario: existingU.ID_Usuario, ...datos });
      DATA.usuarios[editingRow.rowIndex] = _usuarioSbToObj(usuario);
      showToast('Usuario actualizado', 'success');
    } else {
      const { usuario } = await callEdgeFunction('gestionar-usuario', { accion: 'crear', ...datos });
      DATA.usuarios.push(_usuarioSbToObj(usuario));
      showToast('Usuario guardado', 'success');
    }
    closeModal('modal-usuario'); renderAll();
  } catch(e) { showToast('Error guardando: ' + e.message, 'error'); console.error(e); }
  hideLoading(); editingRow = null;
}

// ============================================================
// IMPORTAR ALUMNOS DESDE SANIDAD CMA — RETIRADO (2026-09-19)
// ============================================================
// El alumnado ya no tiene cuenta personal: cada grupo comparte una cuenta
// (`1cslcb@gestionlab.cma` = "1º CS LCB"), y esas cuentas se crean una sola vez
// con scripts/crear_grupos_alumnado.py — no hay nada que importar cada curso.
// Se quitaron el botón, el modal `modal-importar-alumnos` y las funciones
// `abrirModalImportarAlumnos` / `_cargarPreviewImportarAlumnos` /
// `_renderPreviewImportarAlumnos` / `confirmarImportarAlumnos`. La Edge Function
// `importar-alumnos` responde 410 por si alguien la llama a mano.
// Ver docs/modulo-usuarios.md y docs/proteccion-datos.md.
// El import de PROFESORADO sigue vivo, aquí debajo.

// ============================================================
// IMPORTAR PROFESORADO DESDE SANIDAD CMA (2 pasos: módulos → equipos)
// ============================================================
let _previewProfesoresCMA = [];
let _profesoresSinLabDescartados = 0;
let _profesoresAImportar = [];

// Para el import de PROFESORADO la lista es la de módulos ajenos a GestionLab más
// Necropsias: es un módulo de laboratorio de verdad (y su alumnado sí se importa), pero no
// usa equipamiento inventariado, así que no conlleva responsabilidad de equipos (confirmado
// por la usuaria, 2026-09-14). Ampliar aquí o en MODULOS_AJENOS_A_GESTIONLAB según el caso.
const MODULOS_SIN_RESPONSABILIDAD_EQUIPOS = [
  ...MODULOS_AJENOS_A_GESTIONLAB,
  'Necropsias',
];
function _moduloDaResponsabilidadEquipos(modulo) {
  const m = _normCiclo(modulo || '');
  return !!m && !MODULOS_SIN_RESPONSABILIDAD_EQUIPOS.some(x => m.includes(_normCiclo(x)));
}

function abrirModalImportarProfesores() {
  _previewProfesoresCMA = [];
  _profesoresAImportar = [];
  document.getElementById('importar-profesores-contenido').innerHTML = `
    <div class="empty-state" style="padding:40px 0">
      <div class="empty-state-icon">⏳</div>
      <div class="empty-state-title">Consultando Sanidad CMA...</div>
    </div>`;
  ['btn-atras-importar-profesores', 'btn-siguiente-importar-profesores', 'btn-confirmar-importar-profesores']
    .forEach(id => document.getElementById(id).style.display = 'none');
  openModal('modal-importar-profesores');
  _cargarPreviewImportarProfesores();
}

async function _cargarPreviewImportarProfesores() {
  const cont = document.getElementById('importar-profesores-contenido');
  try {
    const { profesores } = await callEdgeFunction('importar-profesores', { accion: 'preview' });
    const todas = profesores || [];
    // Solo se importan asignaciones profesor×módulo cuyo laboratorio (viene de Sanidad CMA,
    // que a su vez lo saca del horario real) tenga equipos en GestionLab: sin equipos no hay
    // responsabilidad que asignar y suele ser un aula teórica. `laboratorio` puede traer
    // varias aulas ("Lab 209, Lab 205"); nos quedamos con los nº de lab con equipos.
    const labsConEquipos = new Set(
      (DATA.equipos || []).map(e => _extraerLabDeUbicacion(e.Ubicacion)).filter(Boolean)
    );
    todas.forEach(p => {
      // Solo cuenta el patrón "Lab NNN": un \d{3} suelto confundía las aulas de otros
      // departamentos con los laboratorios de Sanidade — "Aula 207 (Dpto. Química)"
      // se leía como el Lab 207 (Anatomía Patolóxica) y ofrecía sus 61 equipos al
      // profesorado de Química. Las aulas propias siempre llegan como "Lab 205".
      const nums = [...String(p.laboratorio || '').matchAll(/\bLab\.?\s*(\d{3})\b/gi)].map(m => m[1]);
      p.labsValidos = _moduloDaResponsabilidadEquipos(p.modulo)
        ? [...new Set(nums)].filter(n => labsConEquipos.has(n))
        : [];
    });
    _previewProfesoresCMA = todas.filter(p => p.labsValidos.length);
    _profesoresSinLabDescartados = todas.length - _previewProfesoresCMA.length;
    _pasoUnoImportarProfesores();
  } catch (e) {
    cont.innerHTML = `<div class="empty-state" style="padding:40px 0">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">No se pudo consultar Sanidad CMA</div>
      <div style="color:var(--text-muted);font-size:13px;margin-top:6px">${e.message}</div>
    </div>`;
  }
}

// Paso 1: checklist agrupado Ciclo → Módulo (mismo patrón que alumnos) para elegir qué
// asignaciones profesor×módulo se van a importar.
function _pasoUnoImportarProfesores() {
  const cont = document.getElementById('importar-profesores-contenido');
  const nuevos = _previewProfesoresCMA.filter(p => !p.existe);

  document.getElementById('btn-atras-importar-profesores').style.display = 'none';
  document.getElementById('btn-confirmar-importar-profesores').style.display = 'none';
  const btnSiguiente = document.getElementById('btn-siguiente-importar-profesores');

  const avisoSinLab = _profesoresSinLabDescartados
    ? `<div style="margin-bottom:10px;font-size:12px;color:var(--warning, #b45309)">
        ⚠️ ${_profesoresSinLabDescartados} asignación(es) no se muestran: su aula en el horario no es un laboratorio con equipos en GestionLab, o el módulo es transversal (FCT, Proxecto, Afondamento, FOL…).
      </div>`
    : '';

  if (!_previewProfesoresCMA.length) {
    cont.innerHTML = `${avisoSinLab}<div class="empty-state" style="padding:40px 0">
      <div class="empty-state-icon">🧑‍🏫</div>
      <div class="empty-state-title">No hay asignaciones de profesorado en un laboratorio con equipos para importar</div>
    </div>`;
    btnSiguiente.style.display = 'none';
    return;
  }

  const grupos = {};
  _previewProfesoresCMA.forEach((p, i) => {
    const ciclo = p.ciclo || 'Sin ciclo';
    const modulo = p.modulo || 'Sin módulo';
    (grupos[ciclo] ??= {});
    (grupos[ciclo][modulo] ??= []).push(i);
  });

  const ciclosHtml = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es')).map(ciclo => {
    const modulos = grupos[ciclo];
    const idsCiclo = Object.values(modulos).flat();
    const habilesCiclo = idsCiclo.some(i => !_previewProfesoresCMA[i].existe);

    const modulosHtml = Object.keys(modulos).sort((a, b) => a.localeCompare(b, 'es')).map(modulo => {
      const ids = modulos[modulo];
      const habilesModulo = ids.some(i => !_previewProfesoresCMA[i].existe);
      const filas = ids.map(i => {
        const p = _previewProfesoresCMA[i];
        return `<label style="display:flex;align-items:center;gap:10px;padding:7px 0;flex-wrap:wrap;${p.existe ? 'opacity:0.5' : 'cursor:pointer'}">
          <input type="checkbox" class="importar-profesor-check" data-ciclo="${_escAttr(ciclo)}" data-modulo="${_escAttr(modulo)}" value="${i}" ${p.existe ? 'disabled' : 'checked'}>
          <span style="flex:1 1 160px;min-width:0">
            <span style="font-weight:500">${p.nombre || '—'}</span>
            <span style="display:block;font-size:12px;color:var(--text-muted);word-break:break-all">${p.email || '—'}</span>
          </span>
          <span style="font-size:12px;color:var(--text-soft);white-space:nowrap">${p.labsValidos.map(l => 'Lab ' + l).join(', ')}</span>
          <span class="badge ${p.existe ? 'badge-gray' : 'badge-green'}">${p.existe ? 'Ya existe' : 'Nuevo'}</span>
        </label>`;
      }).join('');
      return `<div style="margin:8px 0;padding-left:2px;border-left:2px solid var(--border)">
        <label style="display:flex;align-items:center;gap:8px;padding-left:8px;font-size:13px;font-weight:600;cursor:${habilesModulo ? 'pointer' : 'default'}">
          <input type="checkbox" ${habilesModulo ? 'checked' : 'disabled'} onchange="_toggleGrupoImportarProfesores('modulo','${_escAttr(ciclo)}','${_escAttr(modulo)}',this.checked)">
          <span>${modulo} <span style="font-weight:400;color:var(--text-muted)">(${ids.length})</span></span>
        </label>
        <div style="padding-left:10px">${filas}</div>
      </div>`;
    }).join('');

    return `<div class="card" style="margin-bottom:12px">
      <div class="card-header">
        <label style="display:flex;align-items:center;gap:8px;cursor:${habilesCiclo ? 'pointer' : 'default'}">
          <input type="checkbox" ${habilesCiclo ? 'checked' : 'disabled'} onchange="_toggleGrupoImportarProfesores('ciclo','${_escAttr(ciclo)}',null,this.checked)">
          <span class="card-title" style="margin:0">${ciclo} <span style="font-weight:400;color:var(--text-muted)">(${idsCiclo.length})</span></span>
        </label>
      </div>
      <div style="padding:4px 16px 12px">${modulosHtml}</div>
    </div>`;
  }).join('');

  cont.innerHTML = `
    ${avisoSinLab}
    <div style="margin-bottom:10px;font-size:13px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <span>${nuevos.length} asignación(es) nueva(s) con laboratorio. Marca ciclo y/o módulo para seleccionar en bloque.</span>
      <span style="white-space:nowrap">
        <button type="button" onclick="_toggleSeleccionarTodosImportarProfesores(true)" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;padding:0">Todo</button> ·
        <button type="button" onclick="_toggleSeleccionarTodosImportarProfesores(false)" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;padding:0">Nada</button>
      </span>
    </div>
    ${ciclosHtml}`;
  btnSiguiente.style.display = nuevos.length ? '' : 'none';
}

function _toggleGrupoImportarProfesores(nivel, ciclo, modulo, checked) {
  document.querySelectorAll('.importar-profesor-check:not(:disabled)').forEach(cb => {
    const coincideCiclo = cb.dataset.ciclo === ciclo;
    const coincide = nivel === 'ciclo' ? coincideCiclo : (coincideCiclo && cb.dataset.modulo === modulo);
    if (coincide) cb.checked = checked;
  });
}

function _toggleSeleccionarTodosImportarProfesores(checked) {
  document.querySelectorAll('.importar-profesor-check:not(:disabled)').forEach(cb => { cb.checked = checked; });
  document.querySelectorAll('#importar-profesores-contenido input[type=checkbox]:not(.importar-profesor-check):not(:disabled)').forEach(cb => { cb.checked = checked; });
}

function _extraerLabDeUbicacion(ubicacion) {
  const m = (ubicacion || '').match(/\b(\d{3})\b/);
  return m ? m[1] : null;
}

// Paso 2: a partir de los labs de los módulos marcados, sugiere los equipos de esos labs
// (checklist revisable) que pasarán a tener a este profesor como responsable.
function _pasoDosImportarProfesores() {
  const seleccionadas = Array.from(document.querySelectorAll('.importar-profesor-check:checked'))
    .map(cb => _previewProfesoresCMA[Number(cb.value)]);
  if (!seleccionadas.length) { showToast('Selecciona al menos un profesor', 'error'); return; }

  const porEmail = {};
  seleccionadas.forEach(p => {
    const email = (p.email || '').toLowerCase().trim();
    if (!email) return;
    (porEmail[email] ??= { nombre: p.nombre, email, ciclo: p.ciclo, modulos: new Set(), labs: new Set() });
    if (p.modulo) porEmail[email].modulos.add(p.modulo);
    (p.labsValidos || []).forEach(l => porEmail[email].labs.add(l));
  });
  const todosLosSeleccionados = Object.values(porEmail).map(p => ({
    nombre: p.nombre, email: p.email, ciclo: p.ciclo,
    modulo: [...p.modulos].join(','), modulos: [...p.modulos], laboratorio: [...p.labs].join(','), labs: [...p.labs],
  }));
  // Defensa: si ninguno acaba con un lab con equipos, no hay nada que asignar. En la práctica
  // ya se filtró en el paso 1 (labsValidos), este guard no debería dispararse.
  const sinLab = todosLosSeleccionados.filter(p => !p.labs.length);
  _profesoresAImportar = todosLosSeleccionados.filter(p => p.labs.length);

  if (!_profesoresAImportar.length) {
    showToast('Ninguno de los seleccionados está en un laboratorio con equipos — no se importa ninguno', 'error');
    return;
  }

  const cont = document.getElementById('importar-profesores-contenido');
  const linkBtn = 'background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;padding:0';
  const tarjetasHtml = _profesoresAImportar.map(p => {
    const _coincideModulo = e => (e.Modulos_Responsables || '').split(',').map(s => s.trim()).filter(Boolean)
      .some(me => p.modulos.some(m => _normCiclo(m) === _normCiclo(me)));
    // Equipos de sus laboratorios MÁS los etiquetados con alguno de sus módulos aunque estén
    // guardados en otro lab: el equipo de un módulo no siempre vive en el aula donde se imparte
    // (el lector y el lavador de microplacas de Técnicas de Inmunodiagnóstico están en el Lab
    // 205 y el módulo se da en el 201; los autoanalizadores de Análise Bioquímica están en el
    // 203 y el módulo se da en el 201). Filtrando solo por laboratorio esos equipos no llegaban
    // siquiera a aparecer en la lista, así que no había forma de premarcarlos ni de marcarlos
    // a mano.
    const equiposDeSusLabs = DATA.equipos.filter(e =>
      p.labs.includes(_extraerLabDeUbicacion(e.Ubicacion)) || _coincideModulo(e));

    // Premarcado: SOLO los equipos cuyo Módulo(s) responsable(s) etiquetado coincide con un
    // módulo del profesor. Los equipos sin etiqueta (o con etiqueta que no casa) quedan sin
    // marcar — con varios profesores a la vez, premarcar el lab entero era inrevisable y
    // sobreasignaba. Botones "Todos / Ninguno / Solo por módulo" para ajustar en bloque.
    let nMarcados = 0;
    const filasEquipos = equiposDeSusLabs.map(e => {
      const modulosEquipo = (e.Modulos_Responsables || '').split(',').map(s => s.trim()).filter(Boolean);
      const coincideModulo = _coincideModulo(e);
      if (coincideModulo) nMarcados++;
      const buscar = `${e.Tipo_Equipo || ''} ${e.Marca || ''} ${e.Modelo || ''} ${e.ID_Activo || ''} ${e.Ubicacion || ''}`.toLowerCase();
      return `
      <tr data-buscar="${_escAttr(buscar)}">
        <td><input type="checkbox" class="importar-equipo-check" data-email="${_escAttr(p.email)}" data-modmatch="${coincideModulo ? '1' : '0'}" value="${_escAttr(e.ID_Activo)}" ${coincideModulo ? 'checked' : ''} onchange="_actualizarContadorEquiposImportar('${_escAttr(p.email)}')"></td>
        <td>${e.Tipo_Equipo || '—'} ${e.Marca || ''} ${e.Modelo || ''} <span style="color:var(--text-muted)">(${e.ID_Activo})</span></td>
        <td>${e.Ubicacion || '—'}</td>
        <td style="color:var(--text-muted);font-size:12px">${modulosEquipo.join(', ') || '—'}</td>
        <td style="color:var(--text-muted);font-size:12px">${e.Responsable || '—'}</td>
      </tr>`;
    }).join('');

    const cuerpo = !equiposDeSusLabs.length
      ? `<div style="font-size:12px;color:var(--text-muted)">No se han encontrado equipos en el lab ${p.labs.join(', ')}.</div>`
      : `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 8px">
           <input type="text" placeholder="Filtrar equipos…" oninput="_filtrarEquiposImportar('${_escAttr(p.email)}',this.value)" style="flex:1 1 140px;font-size:12px;padding:5px 8px">
           <button type="button" style="${linkBtn}" onclick="_bulkEquiposImportar('${_escAttr(p.email)}','todos')">Todos</button> ·
           <button type="button" style="${linkBtn}" onclick="_bulkEquiposImportar('${_escAttr(p.email)}','ninguno')">Ninguno</button> ·
           <button type="button" style="${linkBtn}" onclick="_bulkEquiposImportar('${_escAttr(p.email)}','modulo')">Solo por módulo</button>
         </div>
         <table>
           <thead><tr><th></th><th>Equipo</th><th>Ubicación</th><th>Módulo(s)</th><th>Responsable(s) actual(es)</th></tr></thead>
           <tbody>${filasEquipos}</tbody>
         </table>`;

    return `<details class="card importar-prof-details" style="margin-bottom:12px">
      <summary>
        <span class="caret">▸</span>
        <span style="font-weight:600">${p.nombre}</span>
        <span style="color:var(--text-muted);font-size:12px">${p.email}</span>
        <span style="margin-left:auto;font-size:12px;color:var(--text-soft);white-space:nowrap">
          ${p.labs.map(l => 'Lab ' + l).join(', ')} · ${equiposDeSusLabs.length} equipos ·
          <b data-cnt-email="${_escAttr(p.email)}">${nMarcados} marcado${nMarcados === 1 ? '' : 's'}</b>
        </span>
      </summary>
      <div style="padding:0 16px 14px">${cuerpo}</div>
    </details>`;
  }).join('');

  const avisoSinLab = sinLab.length
    ? `<div style="margin-bottom:10px;font-size:13px;color:var(--warning, #b45309)">
        ⚠️ No se importa${sinLab.length > 1 ? 'n' : ''}: ${sinLab.map(p => `${p.nombre} (${p.email})`).join(', ')} — ningún módulo suyo está en un laboratorio con equipos.
      </div>`
    : '';

  cont.innerHTML = `
    ${avisoSinLab}
    <div style="margin-bottom:10px;font-size:13px;color:var(--text-muted)">
      Cada profesor sale plegado. Se premarcan solo los equipos cuyo "Módulo(s) responsable(s)" coincide con los suyos; usa <b>Todos</b> para marcar el lab entero o <b>Solo por módulo</b> para volver a la sugerencia. Se añadirá el profesor a "Responsable" de los marcados, sin quitar a quien ya estuviera.
    </div>
    ${tarjetasHtml}`;

  document.getElementById('btn-siguiente-importar-profesores').style.display = 'none';
  document.getElementById('btn-atras-importar-profesores').style.display = '';
  document.getElementById('btn-confirmar-importar-profesores').style.display = '';
}

function _equiposImportarChecks(email) {
  return Array.from(document.querySelectorAll(`.importar-equipo-check[data-email="${CSS.escape(email)}"]`));
}

function _actualizarContadorEquiposImportar(email) {
  const n = _equiposImportarChecks(email).filter(cb => cb.checked).length;
  const badge = document.querySelector(`[data-cnt-email="${CSS.escape(email)}"]`);
  if (badge) badge.textContent = `${n} marcado${n === 1 ? '' : 's'}`;
}

function _bulkEquiposImportar(email, modo) {
  _equiposImportarChecks(email).forEach(cb => {
    if (modo === 'todos') cb.checked = true;
    else if (modo === 'ninguno') cb.checked = false;
    else if (modo === 'modulo') cb.checked = cb.dataset.modmatch === '1';
  });
  _actualizarContadorEquiposImportar(email);
}

function _filtrarEquiposImportar(email, texto) {
  const q = (texto || '').toLowerCase().trim();
  _equiposImportarChecks(email).forEach(cb => {
    const tr = cb.closest('tr');
    if (tr) tr.style.display = (!q || (tr.dataset.buscar || '').includes(q)) ? '' : 'none';
  });
}

async function confirmarImportarProfesores() {
  const profesores = _profesoresAImportar.map(p => ({
    nombre: p.nombre, email: p.email, ciclo: p.ciclo, modulo: p.modulo, laboratorio: p.laboratorio,
    equipos_responsable: Array.from(document.querySelectorAll(`.importar-equipo-check[data-email="${CSS.escape(p.email)}"]:checked`))
      .map(cb => cb.value),
  }));
  if (!profesores.length) { showToast('No hay profesorado seleccionado', 'error'); return; }

  showLoading('Importando profesorado...');
  try {
    const { resultados } = await callEdgeFunction('importar-profesores', { accion: 'importar', profesores });
    _renderResultadosImportarProfesores(resultados);
    await loadAllData();
  } catch (e) {
    showToast('Error importando: ' + e.message, 'error');
  }
  hideLoading();
}

function _renderResultadosImportarProfesores(resultados) {
  const cont = document.getElementById('importar-profesores-contenido');
  ['btn-atras-importar-profesores', 'btn-siguiente-importar-profesores', 'btn-confirmar-importar-profesores']
    .forEach(id => document.getElementById(id).style.display = 'none');
  const ok = resultados.filter(r => r.ok);
  const fallidos = resultados.filter(r => !r.ok);

  const filasOk = ok.map(r => `
    <tr>
      <td>${r.email}</td>
      <td><code style="font-size:12px">${r.password_temporal}</code></td>
      <td>${r.equipos_actualizados || 0}</td>
    </tr>`).join('');

  const filasError = fallidos.map(r => `<li>${r.email}: ${r.motivo || 'error desconocido'}</li>`).join('');

  cont.innerHTML = `
    ${ok.length ? `
      <div class="empty-state-title" style="text-align:left;margin-bottom:8px">✅ ${ok.length} profesor(es) importado(s)</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Contraseñas temporales — reparte y no guardes este listado.</div>
      <div class="card" style="margin-bottom:16px">
        <table>
          <thead><tr><th>Email</th><th>Contraseña temporal</th><th>Equipos asignados</th></tr></thead>
          <tbody>${filasOk}</tbody>
        </table>
      </div>` : ''}
    ${fallidos.length ? `
      <div class="empty-state-title" style="text-align:left;margin-bottom:8px">⚠️ ${fallidos.length} omitido(s)</div>
      <ul style="font-size:13px;color:var(--text-muted)">${filasError}</ul>` : ''}
  `;
}
