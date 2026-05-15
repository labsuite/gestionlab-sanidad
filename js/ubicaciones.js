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
          ${puedeEditar ? `<button class="icon-btn" onclick="mostrarUrlNfc('${u.ID_Ubicacion.replace(/'/g,"\\'")}')" title="URL para etiqueta NFC">🔗</button>` : ''}
          ${puedeEditar ? `<button class="icon-btn" onclick="editUbicacion(${DATA.ubicaciones.indexOf(u)})">✏️</button>` : ''}
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
// Visible solo para Gestor y Administrador (botón 🔗 en cada fila)
// ============================================================
function mostrarUrlNfc(ubicacionId) {
  const base = window.location.origin + window.location.pathname;
  const url  = `${base}?armario=${encodeURIComponent(ubicacionId)}&action=transfer`;
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
      ? base + 'border-bottom:2px solid var(--primary);color:var(--primary)'
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
      <div style="margin-left:auto">
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
      btn.style.borderBottom = active ? '2px solid var(--primary)' : '2px solid transparent';
      btn.style.color        = active ? 'var(--primary)' : 'var(--text-muted)';
    }
  });
}

function _renderTablaUsuarios(lista, rolActual) {
  const rolBadge = {'Administrador':'badge-red','Gestor':'badge-orange','Profesor':'badge-blue','Alumno':'badge-gray'};
  const puedeEditar = rolActual === 'Administrador' || rolActual === 'Gestor';
  if (!lista.length) return `<div class="empty-state" style="padding:40px 0"><div class="empty-state-icon">👤</div><div class="empty-state-title">Sin usuarios en esta categoría</div></div>`;
  return `<div class="card">
    <table>
      <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Activo</th><th></th></tr></thead>
      <tbody>
        ${lista.map(u => {
          const idx = DATA.usuarios.indexOf(u);
          return `<tr>
            <td><strong>${u.Nombre||'—'}</strong></td>
            <td>${u.Email||'—'}</td>
            <td><span class="badge ${rolBadge[u.Rol]||'badge-gray'}">${u.Rol||'—'}</span></td>
            <td>${u.Activo !== 'FALSE' ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
            <td><div class="row-actions">${puedeEditar ? `<button class="icon-btn" onclick="editUsuario(${idx})">✏️</button>` : ''}</div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// "Ciclo|Módulo" helpers — el separador | evita ambigüedad cuando varios ciclos comparten nombre de módulo
function _moduloCiclo(m) { const i = m.indexOf('|'); return i > -1 ? m.slice(0, i) : null; }
function _moduloNombre(m) { const i = m.indexOf('|'); return i > -1 ? m.slice(i + 1) : m; }

function _renderSeccionAlumnos(lista, rolActual) {
  const puedeEditar = rolActual === 'Administrador' || rolActual === 'Gestor' || rolActual === 'Profesor';
  if (!lista.length) return `<div class="empty-state" style="padding:40px 0"><div class="empty-state-icon">🎓</div><div class="empty-state-title">Sin alumnos registrados</div></div>`;

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

  const gruposHtml = ciclosOrdenados.map(ciclo => {
    const usrs = grupos[ciclo];
    const filas = usrs.map(u => {
      const idx = DATA.usuarios.indexOf(u);
      const mods = (u.Modulo||'').split(',').map(m => m.trim()).filter(Boolean);
      const modNombres = mods.map(_moduloNombre);
      const modBadges = modNombres.map(n => `<span class="badge badge-blue" style="margin-right:2px">${n}</span>`).join('') || '<span style="color:var(--text-muted)">—</span>';
      const labs = _getLabsDeUbics(u.Ubicaciones_Asignadas||'');
      const labBadges = labs.map(l => `<span class="badge badge-gray" style="margin-right:2px">Lab ${l}</span>`).join('') || '<span style="color:var(--text-muted)">—</span>';
      return `<tr data-modulos="${modNombres.join(',')}">
        <td><strong>${u.Nombre||'—'}</strong></td>
        <td>${u.Email||'—'}</td>
        <td>${modBadges}</td>
        <td>${labBadges}</td>
        <td>${u.Activo !== 'FALSE' ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">Inactivo</span>'}</td>
        <td><div class="row-actions">${puedeEditar ? `<button class="icon-btn" onclick="editUsuario(${idx})">✏️</button>` : ''}</div></td>
      </tr>`;
    }).join('');
    return `<div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">${ciclo} <span style="font-weight:400;color:var(--text-muted)">(${usrs.length})</span></div>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Módulo(s)</th><th>Labs</th><th>Activo</th><th></th></tr></thead>
        <tbody class="tabla-alumnos-grupo">${filas}</tbody>
      </table>
    </div>`;
  }).join('');

  return `
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
    } else {
      const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === val);
      if (u) ['201','203','205','207'].forEach(n => { if ((u.Laboratorio_Aula||'').includes(n)) labs.add(n); });
    }
  });
  return [...labs].sort();
}

function _getUbicacionesDeLabs(labsList) {
  return labsList.join(',');
}

function _populateModalUsuarioAlumno(modulosStr, ubicStr, cicloPrincipal) {
  _refreshModuloCheckboxes(modulosStr);
  const labs = _getLabsDeUbics(ubicStr);
  document.querySelectorAll('.usr-lab-check').forEach(cb => { cb.checked = labs.includes(cb.value); });
  const cicloSel = document.getElementById('usr-ciclo-principal');
  if (cicloSel && cicloPrincipal) cicloSel.value = cicloPrincipal;
}

function _refreshModuloCheckboxes(preselectedStr) {
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
  }

  // Flat deduped module list — no grouping by ciclo to avoid duplicate confusion
  const todosModulos = [...new Set(
    DATA.ciclosModulos.filter(cm => cm.Modulo).map(cm => cm.Modulo)
  )].sort((a,b) => a.localeCompare(b,'es'));

  const cont = document.getElementById('usr-modulos-checks');
  if (!cont) return;
  if (!todosModulos.length) {
    cont.innerHTML = `<span style="font-size:12px;color:var(--text-muted)">Sin módulos registrados en Ciclos_Modulos</span>`;
    return;
  }

  cont.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px">` +
    todosModulos.map(m => {
      const checked = _selectedModulosArray.includes(m) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px;background:var(--bg-soft,#f5f5f5);border-radius:6px;font-size:12px">
        <input type="checkbox" class="usr-modulo-check" value="${m}" ${checked} onchange="_onModuloChange(this)"> ${m}
      </label>`;
    }).join('') + `</div>`;
  _syncChipsModulos();
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
  toggleUbicacionesAsignadasField('Profesor');
  const selRol = document.getElementById('usr-rol');
  if (selRol) selRol.disabled = false;
  openModal('modal-usuario');
}

function toggleUbicacionesAsignadasField(rol) {
  const grp = document.getElementById('usr-alumno-fields');
  if (!grp) return;
  if (rol === 'Alumno') {
    grp.style.display = '';
    _populateModalUsuarioAlumno('', '');
  } else {
    grp.style.display = 'none';
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
  editingRow = { sheet: 'Usuarios', rowIndex: idx };
  sv('usr-nombre', u.Nombre); sv('usr-email', u.Email); sv('usr-rol', u.Rol);
  const grp = document.getElementById('usr-alumno-fields');
  if (grp) grp.style.display = u.Rol === 'Alumno' ? '' : 'none';
  if (u.Rol === 'Alumno') _populateModalUsuarioAlumno(u.Modulo||'', u.Ubicaciones_Asignadas||'', u.Ciclo_Principal||'');
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
  const id = existingU ? existingU.ID_Usuario : genId('USR-');
  const activo = existingU ? existingU.Activo : 'TRUE';
  const rol = v('usr-rol') || 'Alumno';
  let ubicAsignadas = '', modulo = '', cicloPrincipal = '';
  if (rol === 'Alumno') {
    ubicAsignadas = _getUbicacionesDeLabs(_getLabsSeleccionados());
    modulo = _getModulosSeleccionados().join(',');  // plain module names
    cicloPrincipal = (document.getElementById('usr-ciclo-principal')?.value || '').trim();
    if (!cicloPrincipal) { showToast('Selecciona el ciclo formativo del alumno', 'error'); hideLoading(); return; }
  }
  const row = [id, nombre, email, rol, activo, ubicAsignadas, modulo, cicloPrincipal];
  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Usuarios') {
      await sheetsUpdate(`Usuarios!A${editingRow.rowIndex+2}:H${editingRow.rowIndex+2}`, row);
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
