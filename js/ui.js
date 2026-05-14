// ============================================================
// CARGA DINÁMICA DE MODALES
// ============================================================
async function loadModales() {
  const archivos = [
    'html/modales-equipos.html',
    'html/modales-catalogo.html',
    'html/modales-material.html',
    'html/modales-pedidos.html',
    'html/modales-mantenimiento.html'
  ];
  try {
    const htmls = await Promise.all(archivos.map(f => fetch(f).then(r => {
      if (!r.ok) throw new Error(`No se pudo cargar ${f}: ${r.status}`);
      return r.text();
    })));
    document.getElementById('modales-container').innerHTML = htmls.join('\n');
  } catch(e) {
    console.error('Error cargando modales:', e);
    throw e;  // Relanzar para que initAuth no arranque con DOM incompleto
  }
}

// ============================================================
// UI HELPERS
// ============================================================
function v(id)        { return document.getElementById(id)?.value?.trim() || ''; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function sv(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); editingRow = null; }

function showLoading(msg = 'Cargando...') {
  document.getElementById('loading-text').textContent = msg;
  document.getElementById('loading').classList.add('show');
}
function hideLoading() { document.getElementById('loading').classList.remove('show'); }

function showToast(msg, type = '') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function mostrarToastConAccion(msg, labelBtn, callback, duracion = 5000) {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast success';
  t.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px';
  t.innerHTML = `<span>${msg}</span><button onclick="this.closest('.toast').remove();(${callback})()" style="background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.4);color:inherit;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap">${labelBtn}</button>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), duracion);
}

function formatDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
}

function updateBadges() {
  const abiertas = DATA.incidencias.filter(i => i.Estado === 'Abierta' || i.Estado === 'En gestión').length;
  const badgeInc = document.getElementById('badge-incidencias');
  if (badgeInc) { badgeInc.textContent = abiertas; badgeInc.style.display = abiertas > 0 ? '' : 'none'; }

  const pendientes = DATA.solicitudes.filter(s => s.Estado === 'Pendiente').length;
  const badgeSol = document.getElementById('badge-solicitudes');
  if (badgeSol) { badgeSol.textContent = pendientes; badgeSol.style.display = pendientes > 0 ? '' : 'none'; }
}

function _updateBadgeMantenimiento() {
  const badgeMant = document.getElementById('badge-mantenimiento');
  if (!badgeMant) return;
  const curso = getCursoAcademico();
  let pendientes = 0;
  DATA.equipos.forEach(eq => {
    DATA.planesMantenimiento
      .filter(p => p.ID_Equipo === eq.ID_Activo && p.Activo !== 'FALSE')
      .forEach(plan => {
        getPeriodosEsperados(plan, eq, curso).forEach(periodo => {
          if (!getRegistroMant(plan.ID_Plan, curso, periodo)) pendientes++;
        });
      });
  });
  badgeMant.textContent = pendientes;
  badgeMant.style.display = pendientes > 0 ? '' : 'none';
}

// ============================================================
// PERMISOS POR ROL
// ============================================================
const PERMISOS = {
  Alumno: {
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'material', 'ubicaciones'],
    verIntervenciones: false, editarEquipos: false, crearIntervenciones: false,
    crearIncidencias: false,
    gestionarIncidencias: false, configuracion: false, usuarios: false, dashboard: true,
    verProveedores: false, verUbicaciones: true, crearProveedores: false,
    verMaterial: true, editarMaterial: false, registrarConsumo: true,
    verPedidos: false, gestionarPedidos: false, crearSolicitudes: false, verTareas: false,
  },
  Profesor: {
    // Páginas visibles
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'intervenciones', 'incidencias',
          'material', 'solicitudes', 'proveedores', 'proveedor-detalle',
          'ubicaciones', 'usuarios'],
    // Equipos: ve todos, pero solo edita e interviene en los suyos (comprobado en render)
    editarEquipos: false,       // controla el botón "Nuevo equipo"
    crearIntervenciones: true,  // permitido, pero filtrado por esResponsableDeEquipo()
    crearIncidencias: true,
    verIntervenciones: true,
    // Incidencias: solo ve y crea las suyas (filtrado en renderIncidencias)
    gestionarIncidencias: false,
    // Material: ve todo, consume/traslada, no edita catálogo ni crea pedidos
    verMaterial: true, editarMaterial: false, registrarConsumo: true,
    verPedidos: false, gestionarPedidos: false, crearSolicitudes: true,
    // Proveedores: igual que Gestor
    verProveedores: true, verUbicaciones: true, crearProveedores: true,
    // Usuarios: ve todos; edita/borra solo Alumnos (comprobado en ubicaciones.js)
    usuarios: true, crearUsuarios: false,
    configuracion: false, dashboard: true, verTareas: true,
  },
  Gestor: {
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'intervenciones', 'incidencias', 'material', 'solicitudes', 'pedidos', 'pedido-detalle', 'proveedores', 'proveedor-detalle', 'ubicaciones', 'usuarios', 'contabilidad', 'mantenimiento'],
    verIntervenciones: true, editarEquipos: true, crearIntervenciones: true, crearIncidencias: true,
    gestionarIncidencias: true, configuracion: true, usuarios: true, dashboard: true,
    verProveedores: true, verUbicaciones: true, crearProveedores: true,
    verMaterial: true, editarMaterial: true, registrarConsumo: true,
    verPedidos: true, gestionarPedidos: true, crearSolicitudes: true, verTareas: true,
    usuarios: true, crearUsuarios: true,
  },
  Administrador: {
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'intervenciones', 'incidencias', 'material', 'solicitudes', 'pedidos', 'pedido-detalle', 'proveedores', 'proveedor-detalle', 'ubicaciones', 'usuarios', 'contabilidad', 'mantenimiento'],
    verIntervenciones: true, editarEquipos: true, crearIntervenciones: true, crearIncidencias: true,
    gestionarIncidencias: true, configuracion: true, usuarios: true, dashboard: true,
    verProveedores: true, verUbicaciones: true, crearProveedores: true,
    verMaterial: true, editarMaterial: true, registrarConsumo: true,
    verPedidos: true, gestionarPedidos: true, crearSolicitudes: true, verTareas: true,
    usuarios: true, crearUsuarios: true,
  }
};

function getPermisos() { return PERMISOS[getUserRole()] || PERMISOS.Alumno; }
function puedeHacer(accion) { return getPermisos()[accion] === true; }

function getUserRole() {
  if (!currentUser?.email) return 'Alumno';
  const emailNorm = currentUser.email.toLowerCase().trim();
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  return u?.Rol || 'Alumno';
}

function showPage(page) {
  const p = getPermisos();
  if (!p.nav.includes(page)) { showToast('No tienes permiso para acceder a esta sección', 'error'); return; }
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[onclick="showPage('${page}')"]`)?.classList.add('active');
  const titles = {
    dashboard: 'Panel principal', equipos: 'Inventario de equipos', 'equipo-detalle': 'Ficha de equipo', intervenciones: 'Intervenciones',
    incidencias: 'Incidencias', material: 'Material fungible', movimientos: 'Movimientos de material',
    solicitudes: 'Solicitudes de material', pedidos: 'Pedidos', 'pedido-detalle': 'Detalle del pedido',
    proveedores: 'Proveedores', 'proveedor-detalle': 'Ficha de proveedor', ubicaciones: 'Ubicaciones', usuarios: 'Usuarios',
    contabilidad: 'Contabilidad', mantenimiento: 'Mantenimiento preventivo'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
}

function showApp() {
  // ── Bloqueo estricto: email no registrado → pantalla no autorizado ──────
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const userInDb  = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  if (!userInDb) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    let noAuthEl = document.getElementById('no-auth-screen');
    if (!noAuthEl) {
      noAuthEl = document.createElement('div');
      noAuthEl.id = 'no-auth-screen';
      noAuthEl.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:9999';
      document.body.appendChild(noAuthEl);
    }
    noAuthEl.style.display = 'flex';
    noAuthEl.innerHTML = `
      <div style="text-align:center;max-width:420px;padding:40px 24px">
        <div style="font-size:48px;margin-bottom:16px">🔒</div>
        <div style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:8px">Acceso no autorizado</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:24px;line-height:1.6">
          Tu cuenta <strong>(${currentUser?.email||''})</strong> no está registrada en GestionLab.<br>
          Contacta con el administrador del laboratorio para solicitar acceso.
        </div>
        <button class="btn btn-secondary" onclick="signOut()" style="font-size:14px">↩ Cerrar sesión</button>
      </div>`;
    return;
  }
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const rol = getUserRole();
  const p = PERMISOS[rol] || PERMISOS.Alumno;
  document.getElementById('user-name').textContent = currentUser?.name || currentUser?.email || 'Usuario';
  document.getElementById('user-role').textContent = rol;
  document.getElementById('user-avatar').src = currentUser?.picture || '';

  document.querySelectorAll('.nav-item').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    const match = onclick.match(/showPage\('(\w[\w-]*)'\)/);
    if (match) el.style.display = p.nav.includes(match[1]) ? '' : 'none';
  });

  const labelCatalogo = document.getElementById('label-catalogo');
  if (labelCatalogo) labelCatalogo.style.display = (p.verProveedores || p.verUbicaciones) ? '' : 'none';

  const btnNuevoProv = document.querySelector('#page-proveedores .btn-primary');
  if (btnNuevoProv) btnNuevoProv.style.display = p.crearProveedores ? '' : 'none';

  const navPedidos = document.getElementById('nav-pedidos');
  if (navPedidos) navPedidos.style.display = p.verPedidos ? '' : 'none';

  showPage(p.dashboard ? 'dashboard' : (p.nav[0] || 'equipos'));
  scheduleTokenRenewal();
  _checkPendingNfcAction();
}

function aplicarPermisosUI() {
  const p = getPermisos();
  const btnNuevoEquipo = document.querySelector('#page-equipos .btn-primary');
  if (btnNuevoEquipo) btnNuevoEquipo.style.display = p.editarEquipos ? '' : 'none';
  const btnNuevaInt = document.querySelector('#page-intervenciones .btn-primary');
  if (btnNuevaInt) btnNuevaInt.style.display = p.crearIntervenciones ? '' : 'none';
  const btnNuevoProv = document.querySelector('#page-proveedores .btn-primary');
  if (btnNuevoProv) btnNuevoProv.style.display = p.crearProveedores ? '' : 'none';
  const btnNuevoMat = document.querySelector('#page-material .btn-primary');
  if (btnNuevoMat) btnNuevoMat.style.display = p.editarMaterial ? '' : 'none';
  const btnConsumoMov = document.querySelector('#page-movimientos .btn-secondary');
  if (btnConsumoMov) btnConsumoMov.style.display = p.registrarConsumo ? '' : 'none';
  const btnEntradaMov = document.querySelector('#page-movimientos .btn-primary');
  if (btnEntradaMov) btnEntradaMov.style.display = p.editarMaterial ? '' : 'none';
  const btnNuevoPedido = document.querySelector('#page-pedidos .btn-primary');
  if (btnNuevoPedido) btnNuevoPedido.style.display = p.gestionarPedidos ? '' : 'none';
  const btnNuevoUser = document.querySelector('#page-usuarios .btn-primary');
  if (btnNuevoUser) btnNuevoUser.style.display = p.crearUsuarios ? '' : 'none';
  renderUbicaciones();
}

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  renderDashboard();
  renderTareas();
  renderEquipos();
  renderIntervenciones();
  renderIncidencias();
  renderProveedores();
  renderUbicaciones();
  renderUsuarios();
  renderMaterial();
  renderMovimientos();
  renderSolicitudes();
  renderPedidos();
  renderContabilidad();
  poblarSelects();
  updateBadges();
  aplicarPermisosUI();
  // Auto-archivar solicitudes "Recibido" con más de 1 semana de antigüedad
  if (typeof checkAutoArchivarRecibidas === 'function') checkAutoArchivarRecibidas();
  renderMantenimiento();
  _updateBadgeMantenimiento();
}

// ============================================================
// POBLAR SELECTS
// ============================================================
function poblarSelects() {
  const setOptions = (id, opts) => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Seleccionar...</option>' + opts.map(o => `<option value="${o}">${o}</option>`).join('');
    if (current) el.value = current;
  };

  const ubicNames    = DATA.ubicaciones.filter(u => u.Activa !== 'FALSE').map(u => u.ID_Ubicacion + (u.Laboratorio_Aula ? ' – ' + u.Laboratorio_Aula : ''));
  const usuariosNames = DATA.usuarios.filter(u => u.Activo !== 'FALSE').map(u => u.Nombre);
  const proveedoresNames = DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => p.Nombre_Proveedor);
  const equiposIds   = DATA.equipos.map(e => e.ID_Activo + (e.Tipo_Equipo ? ' – ' + e.Tipo_Equipo : '') + (e.Marca ? ' ' + e.Marca : ''));

  // eq-ubicacion y eq-responsable son autocompletes, no selects estáticos
  ['eq-proveedor-compra', 'eq-proveedor-sat', 'int-proveedor'].forEach(id => setOptions(id, proveedoresNames));
  ['int-realizado-por'].forEach(id => setOptions(id, usuariosNames));
  ['int-equipo-dummy', 'inc-equipo'].forEach(id => setOptions(id, equiposIds));
}

// ============================================================
// NFC — Detección de acción pendiente desde URL
// ============================================================
function _checkPendingNfcAction() {
  const params  = new URLSearchParams(window.location.search);
  const armario = params.get('armario');
  const action  = params.get('action');
  if (!armario || action !== 'transfer') return;
  history.replaceState({}, '', window.location.pathname);
  setTimeout(() => {
    if (typeof openModalTransferenciaArmario === 'function') {
      openModalTransferenciaArmario(armario);
    } else {
      console.warn('NFC: openModalTransferenciaArmario no está definida todavía');
    }
  }, 400);
}

// ============================================================
// ADJUNTOS PDF — upload a Google Drive
// ============================================================
async function uploadFileToDrive(fileData, fileName, fileType) {
  const boundary = '-------GestionLabBoundary';
  const metadata = JSON.stringify({ name: fileName, mimeType: fileType });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${fileType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${fileData}\r\n` +
    `--${boundary}--`;

  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
    body
  });
  const result = await r.json();
  if (!result.id) throw new Error('Error subiendo archivo a Drive');

  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });

  return `https://drive.google.com/file/d/${result.id}/view`;
}
