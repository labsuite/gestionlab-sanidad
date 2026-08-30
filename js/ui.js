// ============================================================
// CARGA DINÁMICA DE MODALES
// ============================================================
// Reintenta un fetch varias veces antes de rendirse — los 503 de GitHub Pages
// suelen ser puntuales (CDN propagando un despliegue reciente) y desaparecen
// al segundo intento.
async function _fetchConReintentos(url, intentos = 3, esperaMs = 500) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i === intentos) throw e;
      await new Promise(res => setTimeout(res, esperaMs * i));
    }
  }
}

async function loadModales() {
  const archivos = [
    'html/modales-equipos.html',
    'html/modales-catalogo.html',
    'html/modales-material.html',
    'html/modales-pedidos.html',
    'html/modales-mantenimiento.html',
    'html/modales-residuos.html',
    'html/modales-reservas.html',
    'html/modales-registros.html',
    'html/modal-vista-previa.html'
  ];
  try {
    const htmls = await Promise.all(archivos.map(f => _fetchConReintentos(f)));
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

  const _hoy = new Date().toISOString().split('T')[0];
  const _snoozes = JSON.parse(localStorage.getItem('glab_sol_snooze') || '{}');
  const pendientes = DATA.solicitudes.filter(s => s.Estado === 'Pendiente' && !(_snoozes[s.ID_Solicitud] && _snoozes[s.ID_Solicitud] > _hoy)).length;
  const badgeSol = document.getElementById('badge-solicitudes');
  if (badgeSol) { badgeSol.textContent = pendientes; badgeSol.style.display = pendientes > 0 ? '' : 'none'; }
}

function _updateBadgeResiduos() {
  const badge = document.getElementById('badge-residuos');
  if (!badge) return;
  const nContenedores = DATA.contenedoresResiduo.filter(c =>
    c.Estado === 'cerrado' || c.Nivel === '75%' || c.Nivel === 'lleno'
  ).length;
  const nConsultas = DATA.consultasResiduo.filter(c => c.Estado === 'Pendiente').length;
  const n = nContenedores + nConsultas;
  badge.textContent = n;
  badge.style.display = n > 0 ? '' : 'none';
}

function _updateBadgeMantenimiento() {
  const badgeMant = document.getElementById('badge-mantenimiento');
  if (!badgeMant) return;
  const curso = getCursoAcademico();
  const esAlumno = getUserRole() === 'Alumno';
  const mesActual = new Date().getMonth() + 1;
  const enPeriodoAlumno = mesActual >= 10 || mesActual <= 5;
  let pendientes = 0;
  DATA.equipos.forEach(eq => {
    DATA.planesMantenimiento
      .filter(p => {
        if (p.ID_Equipo !== eq.ID_Activo || p.Activo === 'FALSE') return false;
        if (esAlumno && (p.Con_Alumnado !== 'Sí' || !enPeriodoAlumno)) return false;
        return true;
      })
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
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'material', 'ubicaciones', 'mantenimiento', 'residuos-guia', 'residuos-contenedores', 'reservas', 'registros-uso', 'perfil'],
    verIntervenciones: false, editarEquipos: false, crearIntervenciones: false,
    crearIncidencias: false,
    gestionarIncidencias: false, configuracion: false, usuarios: false, dashboard: true,
    verProveedores: false, verUbicaciones: true, crearProveedores: false,
    verMaterial: true, editarMaterial: false, registrarConsumo: true,
    verPedidos: false, gestionarPedidos: false, crearSolicitudes: false, verTareas: false,
    reservarEquipos: true, gestionarReservas: false, configurarReservas: false,
  },
  Profesor: {
    // Páginas visibles
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'intervenciones', 'incidencias',
          'material', 'solicitudes', 'proveedores', 'proveedor-detalle',
          'ubicaciones', 'usuarios', 'residuos-guia', 'residuos-contenedores', 'reservas', 'registros-uso', 'perfil'],
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
    reservarEquipos: true, gestionarReservas: false, configurarReservas: false,
  },
  Gestor: {
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'intervenciones', 'incidencias', 'material', 'solicitudes', 'pedidos', 'pedido-detalle', 'proveedores', 'proveedor-detalle', 'ubicaciones', 'usuarios', 'contabilidad', 'mantenimiento', 'residuos-guia', 'residuos-contenedores', 'reservas', 'registros-uso', 'perfil'],
    verIntervenciones: true, editarEquipos: true, crearIntervenciones: true, crearIncidencias: true,
    gestionarIncidencias: true, configuracion: true, usuarios: true, dashboard: true,
    verProveedores: true, verUbicaciones: true, crearProveedores: true,
    verMaterial: true, editarMaterial: true, registrarConsumo: true,
    verPedidos: true, gestionarPedidos: true, crearSolicitudes: true, verTareas: true,
    usuarios: true, crearUsuarios: true,
    reservarEquipos: true, gestionarReservas: true, configurarReservas: true,
  },
  Administrador: {
    nav: ['dashboard', 'equipos', 'equipo-detalle', 'intervenciones', 'incidencias', 'material', 'solicitudes', 'pedidos', 'pedido-detalle', 'proveedores', 'proveedor-detalle', 'ubicaciones', 'usuarios', 'contabilidad', 'mantenimiento', 'residuos-guia', 'residuos-contenedores', 'reservas', 'registros-uso', 'perfil'],
    verIntervenciones: true, editarEquipos: true, crearIntervenciones: true, crearIncidencias: true,
    gestionarIncidencias: true, configuracion: true, usuarios: true, dashboard: true,
    verProveedores: true, verUbicaciones: true, crearProveedores: true,
    verMaterial: true, editarMaterial: true, registrarConsumo: true,
    verPedidos: true, gestionarPedidos: true, crearSolicitudes: true, verTareas: true,
    usuarios: true, crearUsuarios: true,
    reservarEquipos: true, gestionarReservas: true, configurarReservas: true,
    eliminarItems: true,
  }
};

function getPermisos() { return PERMISOS[getUserRole()] || PERMISOS.Alumno; }
function puedeHacer(accion) { return getPermisos()[accion] === true; }

// ============================================================
// VISTA PREVIA DE ROL (solo Administrador)
// ============================================================
// Simula la app tal como la vería otro rol/usuario sin necesidad de otra
// cuenta. La sesión real de Supabase sigue siendo la del Administrador, así
// que las escrituras se bloquean mientras dure la vista previa (ver
// callEdgeFunction en sheets.js) — es un modo de solo lectura. No persiste
// entre recargas (variables en memoria, no sessionStorage): un F5 siempre
// vuelve a la vista real.
let previewRole = null;   // 'Alumno' | 'Profesor' | 'Gestor' | null
let previewUser = null;   // fila de DATA.usuarios simulada, o null

function getRealUserRole() {
  if (!currentUser?.email) return 'Alumno';
  const emailNorm = currentUser.email.toLowerCase().trim();
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  if (u) return u?.Rol || 'Alumno';
  const sbU = DATA.sbUsuarios?.find(u => (u.email || '').toLowerCase().trim() === emailNorm);
  return sbU?.role || 'Alumno';
}

function getUserRole() {
  if (previewRole) return previewRole;
  return getRealUserRole();
}

/** Identidad usada para filtrar "mis" datos (incidencias, reservas, tareas...): la
 *  simulada durante la vista previa, o la real en caso contrario. */
function getEffectiveUser() {
  if (previewUser) return { email: (previewUser.Email || '').toLowerCase().trim(), name: previewUser.Nombre || '' };
  return { email: currentUser?.email || '', name: currentUser?.name || '' };
}

function abrirVistaPrevia() {
  if (getRealUserRole() !== 'Administrador') return;
  const selRol = document.getElementById('vp-rol');
  if (selRol) selRol.value = '';
  _poblarUsuariosVistaPrevia();
  openModal('modal-vista-previa');
}

function _poblarUsuariosVistaPrevia() {
  const rol = v('vp-rol');
  const selU = document.getElementById('vp-usuario');
  if (!selU) return;
  if (!rol) { selU.innerHTML = '<option value="">Elige un rol primero</option>'; selU.disabled = true; return; }
  const candidatos = DATA.usuarios
    .filter(u => u.Rol === rol && u.Activo !== 'FALSE')
    .sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || ''));
  selU.disabled = false;
  selU.innerHTML = candidatos.length
    ? candidatos.map(u => `<option value="${u.ID_Usuario}">${u.Nombre}</option>`).join('')
    : '<option value="">No hay usuarios activos con ese rol</option>';
}

function activarVistaPrevia() {
  const rol = v('vp-rol');
  const idUsuario = v('vp-usuario');
  if (!rol || !idUsuario) { showToast('Elige un rol y un usuario', 'error'); return; }
  const usuario = DATA.usuarios.find(u => u.ID_Usuario === idUsuario);
  if (!usuario) { showToast('Usuario no encontrado', 'error'); return; }
  previewRole = rol;
  previewUser = usuario;
  closeModal('modal-vista-previa');
  showApp();
  renderAll();
  showToast(`Viendo la app como ${usuario.Nombre} (${rol})`, '');
}

function salirVistaPrevia() {
  previewRole = null;
  previewUser = null;
  showApp();
  renderAll();
  showToast('Vista previa desactivada', '');
}

function _actualizarBannerVistaPrevia() {
  const banner = document.getElementById('banner-vista-previa');
  const btnAbrir = document.getElementById('btn-vista-previa');
  if (btnAbrir) btnAbrir.style.display = getRealUserRole() === 'Administrador' ? '' : 'none';
  if (!banner) return;
  if (previewRole && previewUser) {
    banner.style.display = 'flex';
    banner.querySelector('#banner-vista-previa-texto').textContent =
      `👁 Vista previa: viendo la app como ${previewUser.Nombre} (${previewRole})`;
  } else {
    banner.style.display = 'none';
  }
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
    contabilidad: 'Contabilidad', mantenimiento: 'Mantenimiento preventivo',
    'residuos-guia': 'Guía de residuos', 'residuos-contenedores': 'Contenedores de residuos',
    reservas: 'Reservas de equipos', 'registros-uso': 'Registros de uso', perfil: 'Mi perfil'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  if (page === 'perfil' && typeof renderPerfil === 'function') renderPerfil();
}

function showApp() {
  // ── Bloqueo estricto: email no registrado → pantalla no autorizado ──────
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const userInDb  = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm)
    || DATA.sbUsuarios?.find(u => (u.email || '').toLowerCase().trim() === emailNorm && u.is_active !== false);
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
  const _rec = document.getElementById('recovery-screen'); if (_rec) _rec.style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const rol = getUserRole();
  const p = PERMISOS[rol] || PERMISOS.Alumno;
  document.getElementById('user-name').textContent = currentUser?.name || currentUser?.email || 'Usuario';
  // Ojo: el chip de usuario siempre muestra el rol REAL (no el simulado en vista
  // previa) — quien está viendo la app sigue siendo el Administrador real.
  document.getElementById('user-role').textContent = getRealUserRole();
  const avatarEl = document.getElementById('user-avatar');
  avatarEl.style.display = currentUser?.picture ? '' : 'none';
  avatarEl.src = currentUser?.picture || '';
  _actualizarBannerVistaPrevia();

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
  renderProximasVisitas();
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
  renderMantenimiento();
  _updateBadgeMantenimiento();
  renderResiduosGuia();
  renderResiduosContenedores();
  _updateBadgeResiduos();
  renderReservas();
  _updateBadgeReservas();
  renderRegistrosUso();
  _updateBadgeRegistrosUso();
  renderPerfil();
  _avisarSesionesAbiertasAntiguas();
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
  const proveedoresNames = DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => p.Nombre_Proveedor);

  // eq-ubicacion y eq-responsable son autocompletes, no selects estáticos
  ['eq-proveedor-compra', 'eq-proveedor-sat'].forEach(id => setOptions(id, proveedoresNames));
}

// ============================================================
// NFC — Detección de acción pendiente desde URL
// ============================================================
function _checkPendingNfcAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  if (!action) return;
  history.replaceState({}, '', window.location.pathname);

  if (action === 'transfer') {
    const armario = params.get('armario');
    if (!armario) return;
    setTimeout(() => {
      if (typeof openModalTransferenciaArmario === 'function') {
        openModalTransferenciaArmario(armario);
      }
    }, 400);
  }

  if (action === 'adicion') {
    const categoria = params.get('cont-cat');
    const lab       = params.get('cont-lab');
    if (!categoria || !lab) return;
    setTimeout(() => {
      if (typeof _abrirAdicionPorNfc === 'function') {
        _abrirAdicionPorNfc(categoria, lab);
      }
    }, 400);
  }

  if (action === 'registro-uso') {
    const tipo   = params.get('tipo');
    const equipo = params.get('equipo');
    if (!tipo || !equipo) return;
    setTimeout(() => {
      if (typeof _abrirRegistroPorNfc === 'function') {
        _abrirRegistroPorNfc(tipo, equipo);
      }
    }, 400);
  }
}

