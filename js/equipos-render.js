// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const residuosPendientes = (DATA.contenedoresResiduo.filter(c => c.Estado === 'cerrado' || c.Nivel === '75%' || c.Nivel === 'lleno').length)
    + (DATA.consultasResiduo.filter(c => c.Estado === 'Pendiente').length);
  setText('stat-residuos-pendientes', residuosPendientes);

  const hoy  = new Date();
  const en30 = new Date(); en30.setDate(hoy.getDate() + 30);
  const miNombre = currentUser?.name || '';
  const esProfesor    = getUserRole() === 'Profesor';
  const esAlumno      = getUserRole() === 'Alumno';
  const esGestorAdmin = !esProfesor && !esAlumno;
  // Profesor: solo sus equipos (por responsabilidad). Alumno: equipos de sus ubicaciones asignadas + zona común.
  const misEquipos = esProfesor
    ? DATA.equipos.filter(e => esResponsableDeEquipo(e))
    : esAlumno
      ? DATA.equipos.filter(e => getUbicacionesAlumno().includes(e.Ubicacion))
      : DATA.equipos;
  const curso = getCursoAcademico();
  let pendientesMant = 0;
  misEquipos.forEach(eq => {
    DATA.planesMantenimiento.filter(p => p.ID_Equipo === eq.ID_Activo && p.Activo !== 'FALSE').forEach(plan => {
      getPeriodosEsperados(plan, eq, curso).forEach(p => { if (!getRegistroMant(plan.ID_Plan, curso, p)) pendientesMant++; });
    });
  });
  setText('stat-preventivos', pendientesMant);

  const incAbiertas = DATA.incidencias.filter(i => i.Estado === 'Abierta' || i.Estado === 'En gestión');
  setText('stat-incidencias', incAbiertas.length);

  const alertas = document.getElementById('alertas-container');
  if (!alertas) return;
  alertas.innerHTML = '';

  const averiados = DATA.equipos.filter(e => e.Estado_Operativo === 'Averiado' || e.Estado_Operativo === 'Fuera de servicio');

  if (averiados.length && esGestorAdmin) alertas.innerHTML += `<div class="alert-banner danger"><div class="alert-icon">🔴</div><div class="alert-content"><div class="alert-title">${averiados.length} equipo(s) fuera de servicio o averiado(s)</div><div class="alert-text">${averiados.map(e => e.ID_Activo + ' – ' + (e.Tipo_Equipo||'') + ' ' + (e.Marca||'')).join(' · ')}</div></div></div>`;
  if (pendientesMant > 0 && (esGestorAdmin || esProfesor)) alertas.innerHTML += `<div class="alert-banner" style="cursor:pointer" onclick="showPage('mantenimiento')"><div class="alert-icon">🛡️</div><div class="alert-content"><div class="alert-title">${pendientesMant} mantenimiento(s) preventivo(s) pendiente(s) en el curso actual</div><div class="alert-text">Ve a la sección Mantenimiento para registrarlos</div></div></div>`;
  const incVisibles = esGestorAdmin
    ? incAbiertas
    : esProfesor
      ? incAbiertas.filter(i => { const eq = DATA.equipos.find(e => i.Equipo && i.Equipo.startsWith(e.ID_Activo)); return eq ? esResponsableDeEquipo(eq) : false; })
      : [];
  if (incVisibles.length) alertas.innerHTML += `<div class="alert-banner" style="cursor:pointer" onclick="showPage('incidencias')"><div class="alert-icon">⚠️</div><div class="alert-content"><div class="alert-title">${incVisibles.length} incidencia(s) pendiente(s) de resolución</div><div class="alert-text">${incVisibles.slice(0,3).map(i => i.ID_Incidencia + ' · ' + i.Equipo).join(' – ')}${incVisibles.length > 3 ? ' y ' + (incVisibles.length-3) + ' más...' : ''}</div></div></div>`;

  const solPendientes = DATA.solicitudes.filter(s => s.Estado === 'Pendiente');
  if (solPendientes.length && puedeHacer('gestionarPedidos')) {
    alertas.innerHTML += `<div class="alert-banner" style="cursor:pointer" onclick="showPage('solicitudes')"><div class="alert-icon">📋</div><div class="alert-content"><div class="alert-title">${solPendientes.length} solicitud(es) de material pendiente(s) de gestión</div><div class="alert-text">${solPendientes.slice(0,4).map(s => s.Material + ' · ' + s.Solicitante).join(' – ')}${solPendientes.length > 4 ? ' y ' + (solPendientes.length-4) + ' más...' : ''}</div></div></div>`;
  }

  const facturasSinLeer = DATA.documentosProveedor.filter(d => !d.Extraido_En && DATA.pedidos.some(p => p.ID_Pedido === d.Pedido && p.Estado !== 'Archivado'));
  if (facturasSinLeer.length && puedeHacer('gestionarPedidos')) {
    const nombresPedidos = [...new Set(facturasSinLeer.map(d => { const p = DATA.pedidos.find(x => x.ID_Pedido === d.Pedido); return p ? p.Nombre_Lista : d.Pedido; }))];
    alertas.innerHTML += `<div class="alert-banner" style="cursor:pointer" onclick="showPage('pedidos')"><div class="alert-icon">📎</div><div class="alert-content"><div class="alert-title">${facturasSinLeer.length} factura(s) de proveedor sin leer</div><div class="alert-text">${nombresPedidos.slice(0,4).join(' – ')}${nombresPedidos.length > 4 ? ' y ' + (nombresPedidos.length-4) + ' más...' : ''}</div></div></div>`;
  }

  const consultasRes = DATA.consultasResiduo.filter(c => c.Estado === 'Pendiente');
  const rolDash = getUserRole();
  if (consultasRes.length && (rolDash === 'Administrador' || rolDash === 'Gestor')) {
    alertas.innerHTML += `<div class="alert-banner" style="cursor:pointer" onclick="showPage('residuos-guia')"><div class="alert-icon">♻️</div><div class="alert-content"><div class="alert-title">${consultasRes.length} consulta${consultasRes.length > 1 ? 's' : ''} de residuo pendiente${consultasRes.length > 1 ? 's' : ''} de clasificar</div><div class="alert-text">${consultasRes.slice(0,3).map(c => c.Usuario + ': ' + (c.Descripcion||'').slice(0,40)).join(' – ')}${consultasRes.length > 3 ? ' y ' + (consultasRes.length-3) + ' más...' : ''}</div></div></div>`;
  }

  const bajominimo = DATA.material.filter(m => stockBajoMinimo(m));
  setText('stat-stock-bajo', bajominimo.length);

  const alertasStock = document.getElementById('alertas-stock-container');
  if (!alertasStock) return;
  alertasStock.innerHTML = '';
  if (bajominimo.length && esGestorAdmin) {
    const yaEnPedido = m => {
      if (DATA.solicitudes.some(s => s.Material === m.Nombre && (s.Estado === 'Pendiente' || s.Estado === 'Añadida a pedido' || s.Estado === 'En espera de recepción'))) return true;
      return DATA.lineasPedido.some(l => {
        if (l.Material !== m.Nombre || l.Estado_Linea === 'Recibido') return false;
        const ped = DATA.pedidos.find(p => p.ID_Pedido === l.Pedido);
        return ped && ped.Estado !== 'Archivado';
      });
    };
    const criticos = bajominimo.filter(m => getStockTotal(m) === 0 && !yaEnPedido(m));
    const puedeGestionar = puedeHacer('gestionarPedidos');
    const renderItemsStock = items => items.slice(0,5).map(m => {
      const stock = getStockTotal(m);
      const opt   = parseFloat(m.Stock_Optimo) || 0;
      const falta = opt > 0 ? Math.max(0, opt - stock) : 0;
      const btnPedido = puedeGestionar
        ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();solicitudStockAPedido('${m.ID_Material}',${falta||''})">+ Pedido${falta ? ' (' + falta + ')' : ''}</button>`
        : '';
      return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:8px">${m.Nombre} (${stock} ${m.Unidad||''}) ${btnPedido}</span>`;
    }).join('');
    if (criticos.length) alertasStock.innerHTML += `<div class="alert-banner danger"><div class="alert-icon">🔴</div><div class="alert-content"><div class="alert-title">${criticos.length} material(es) sin stock</div><div class="alert-text" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px">${renderItemsStock(criticos)}${criticos.length > 5 ? ' y ' + (criticos.length-5) + ' más...' : ''}</div></div></div>`;
  }

  // Alertas específicas de zona común (almacén central)
  const yaEnPedidoZC = m => {
    if (DATA.solicitudes.some(s => s.Material === m.Nombre && (s.Estado === 'Pendiente' || s.Estado === 'Añadida a pedido' || s.Estado === 'En espera de recepción'))) return true;
    return DATA.lineasPedido.some(l => {
      if (l.Material !== m.Nombre || l.Estado_Linea === 'Recibido') return false;
      const ped = DATA.pedidos.find(p => p.ID_Pedido === l.Pedido);
      return ped && ped.Estado !== 'Archivado';
    });
  };
  const alertasZC = DATA.material
    .map(m => ({ m, lotes: getLotesZonaComunBajoMinimo(m) }))
    .filter(({ m, lotes }) => lotes.some(l => parseFloat(l.Stock_Local) === 0) && !yaEnPedidoZC(m));
  if (alertasZC.length && esGestorAdmin) {
    const puedeGestionar = puedeHacer('gestionarPedidos');
    const itemsZC = alertasZC.slice(0, 6).map(({ m, lotes }) => {
      const stock = lotes.reduce((s, l) => s + (parseFloat(l.Stock_Local) || 0), 0);
      const opt   = parseFloat(m.Stock_Optimo) || 0;
      const total = getStockTotal(m);
      const falta = opt > 0 ? Math.max(0, opt - total) : 0;
      const btnPedido = puedeGestionar
        ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();solicitudStockAPedido('${m.ID_Material}',${falta||''})">+ Pedido${falta ? ' (' + falta + ')' : ''}</button>`
        : '';
      return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:8px">${m.Nombre} (zona común: ${stock} ${m.Unidad||''}) ${btnPedido}</span>`;
    }).join('');
    alertasStock.innerHTML += `<div class="alert-banner" style="border-left:3px solid var(--accent);background:var(--accent-light)"><div class="alert-icon">🏬</div><div class="alert-content"><div class="alert-title" style="color:var(--accent)">${alertasZC.length} material(es) bajo mínimo en la zona común (almacén)</div><div class="alert-text" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px">${itemsZC}${alertasZC.length > 6 ? ' y ' + (alertasZC.length-6) + ' más...' : ''}</div></div></div>`;
  }

  const tbody = document.getElementById('tabla-proximos');
  if (esAlumno) { tbody.innerHTML = ''; return; }
  const pendientesList = [];
  misEquipos.forEach(eq => {
    DATA.planesMantenimiento.filter(p => p.ID_Equipo === eq.ID_Activo && p.Activo !== 'FALSE').forEach(plan => {
      getPeriodosEsperados(plan, eq, curso).forEach(periodo => {
        if (!getRegistroMant(plan.ID_Plan, curso, periodo)) pendientesList.push({ eq, plan, periodo });
      });
    });
  });
  if (!pendientesList.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Sin mantenimientos pendientes</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = pendientesList.slice(0, 8).map(({ eq, plan, periodo }) => {
    const tipoBadge = plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
    return `<tr>
      <td><strong>${eq.ID_Activo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${eq.Tipo_Equipo||''} ${eq.Marca||''}</span></td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</td>
      <td><span class="badge ${tipoBadge}" style="font-size:10px">${plan.Tipo_Intervencion}</span></td>
      <td>${labelPeriodo(periodo)}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// EQUIPOS — RENDER
// ============================================================
let _filtroEquipos = '', _filtroEquiposEstado = '', _filtroEquiposModulo = '', _filtroEquiposUbicacion = '';

function renderEquipos(filtro, filtroEstado, filtroModulo, filtroUbicacion) {
  if (filtro !== undefined) _filtroEquipos = filtro;
  if (filtroEstado !== undefined) _filtroEquiposEstado = filtroEstado;
  if (filtroModulo !== undefined) _filtroEquiposModulo = filtroModulo;
  if (filtroUbicacion !== undefined) _filtroEquiposUbicacion = filtroUbicacion;
  const tbody = document.getElementById('tabla-equipos');
  let items = DATA.equipos;
  if (_filtroEquipos) items = items.filter(e => JSON.stringify(e).toLowerCase().includes(_filtroEquipos.toLowerCase()));
  if (_filtroEquiposEstado) items = items.filter(e => e.Estado_Operativo === _filtroEquiposEstado);
  if (_filtroEquiposModulo) {
    const q = _filtroEquiposModulo.toLowerCase();
    items = items.filter(e => (e.Modulos_Responsables || '').toLowerCase().includes(q));
  }
  if (_filtroEquiposUbicacion) {
    const q = _filtroEquiposUbicacion.toLowerCase();
    items = items.filter(e => (e.Ubicacion || '').toLowerCase().includes(q));
  }

  const dlModulos = document.getElementById('equipos-modulos-datalist');
  if (dlModulos) {
    const modulos = [...new Set(DATA.equipos.flatMap(e => (e.Modulos_Responsables || '').split(',').map(s => s.trim()).filter(Boolean)))].sort();
    dlModulos.innerHTML = modulos.map(m => `<option value="${_escAttr(m)}">`).join('');
  }
  const dlUbicaciones = document.getElementById('equipos-ubicaciones-datalist');
  if (dlUbicaciones) {
    const ubicaciones = [...new Set(DATA.equipos.map(e => e.Ubicacion).filter(Boolean))].sort();
    dlUbicaciones.innerHTML = ubicaciones.map(u => `<option value="${_escAttr(u)}">`).join('');
  }

  if (!items.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">🔬</div><div class="empty-state-title">Sin equipos registrados</div><div class="empty-state-text">Añade el primer equipo con el botón superior</div></div></td></tr>`; return; }

  tbody.innerHTML = items.map(e => {
    const estadoBadge = {
      'Operativo':            'badge-green',
      'Operativo con fallos': 'badge-orange',
      'En revisión':          'badge-orange',
      'Revisión planificada': 'badge-blue',
      'No operativo':         'badge-red',
      'Averiado':             'badge-red',
      'Fuera de servicio':    'badge-gray'
    }[e.Estado_Operativo] || 'badge-gray';

    // Etiqueta adicional: impacto si hay incidencia abierta, o fecha si hay revisión planificada
    const incAbierta = DATA.incidencias.find(i =>
      (i.Estado === 'Abierta' || i.Estado === 'En gestión') &&
      i.Equipo && (i.Equipo === e.ID_Activo || i.Equipo.startsWith(e.ID_Activo + ' '))
    );
    let impactoBadge = '';
    if (incAbierta) {
      impactoBadge = `<span class="badge badge-orange" style="font-size:10px;margin-left:4px" title="Incidencia ${incAbierta.ID_Incidencia}">⚠️ ${incAbierta.Impacto}</span>`;
    } else if (e.Estado_Operativo === 'Revisión planificada') {
      // Buscar la intervención planificada más reciente para este equipo
      // (las que tienen fecha van primero, ordenadas; las que no, al final)
      const intPlan = DATA.intervenciones
        .filter(i => i.Equipo && i.Equipo.startsWith(e.ID_Activo) && i.Estado === 'Planificada')
        .sort((a, b) => {
          if (!a.Fecha_Planificada && !b.Fecha_Planificada) return 0;
          if (!a.Fecha_Planificada) return 1;
          if (!b.Fecha_Planificada) return -1;
          return new Date(a.Fecha_Planificada) - new Date(b.Fecha_Planificada);
        })[0];
      if (intPlan) {
        const fechaTxt = intPlan.Fecha_Planificada ? formatDate(intPlan.Fecha_Planificada) : 'Por concretar';
        impactoBadge = `<span class="badge badge-blue" style="font-size:10px;margin-left:4px">📅 ${fechaTxt}</span>`;
      }
    }
    const planStatus = (() => {
      const planes = DATA.planesMantenimiento.filter(p => p.ID_Equipo === e.ID_Activo && p.Activo !== 'FALSE');
      if (!planes.length) return '<span class="text-muted">—</span>';
      const curso = getCursoAcademico();
      let pendientes = 0, total = 0;
      planes.forEach(plan => {
        const periodos = getPeriodosEsperados(plan, e, curso);
        total += periodos.length;
        periodos.forEach(p => { if (!getRegistroMant(plan.ID_Plan, curso, p)) pendientes++; });
      });
      if (total === 0) return '<span class="text-muted">Sin periodos aún</span>';
      if (pendientes === 0) return `<span class="badge badge-green">✓ Al día</span>`;
      return `<span class="badge badge-orange">${pendientes} pendiente${pendientes > 1 ? 's' : ''}</span>`;
    })();
    const expandId = 'eq-expand-' + e.ID_Activo.replace(/[^a-zA-Z0-9]/g,'_');
    const manualLink = e.Manual_Ficha_Tecnica ? `<a href="#" onclick="abrirDocumento('${e.Manual_Ficha_Tecnica}'); return false;" class="icon-btn" title="Ver manual">📄</a>` : '';
    // Profesor puede editar e intervenir solo en equipos donde es responsable
    const puedeEditarEste   = puedeHacer('editarEquipos') ||
      (getUserRole() === 'Profesor' && esResponsableDeEquipo(e));
    const puedeIntervenir = puedeHacer('crearIntervenciones') &&
      (getUserRole() !== 'Profesor' || esResponsableDeEquipo(e));
    return `<tr style="cursor:pointer" onclick="toggleEquipoExpand('${expandId}')">
      <td><strong>${e.ID_Activo}</strong></td>
      <td>${e.Tipo_Equipo||'—'}</td>
      <td>${[e.Marca,e.Modelo].filter(Boolean).join(' · ')||'—'}</td>
      <td>${e.Ubicacion||'—'}</td>
      <td>${e.Responsable||'—'}</td>
      <td><span class="badge ${estadoBadge}"><span class="dot"></span>${e.Estado_Operativo||'—'}</span>${impactoBadge}</td>
      <td>${planStatus}</td>
      <td onclick="event.stopPropagation()"><div class="row-actions">
        ${manualLink}
        ${puedeEditarEste ? `<button class="icon-btn" onclick="editEquipo(${DATA.equipos.indexOf(e)})" title="Editar">✏️</button>` : ''}
        ${puedeIntervenir ? `<button class="icon-btn" onclick="openModalRegistrarActuacionDirecta('${e.ID_Activo}')" title="Registrar actuación">🔧</button>` : ''}
        ${puedeHacer('crearIncidencias') ? `<button class="icon-btn" onclick="openModalIncidenciaEquipo('${e.ID_Activo}')" title="Reportar incidencia">⚠️</button>` : ''}
        ${getUserRole() === 'Alumno' ? `<button class="icon-btn" onclick="openModalAvisoAlumno('${e.ID_Activo}')" title="Notificar aviso">🚨</button>` : ''}
      </div></td>
    </tr>
    <tr class="equipo-row-expand" id="${expandId}"><td colspan="8"><div class="equipo-expand-inner">${buildIntervencionesEquipo(e.ID_Activo)}</div></td></tr>`;
  }).join('');
}

// Resumen de una intervención para vistas de tabla: usa las tareas registradas
// (modelo nuevo) o cae al campo de descripción legado (intervenciones previas al cambio).
function _resumenIntervencion(i) {
  const tareas = getTareasIntervencion(i.ID_Intervencion);
  if (tareas.length) {
    const ultima = tareas[tareas.length - 1];
    return tareas.length > 1 ? `${tareas.length} tareas · última: ${ultima.Descripcion}` : ultima.Descripcion;
  }
  return i.Descripcion_Actuacion || i.Observaciones || '—';
}

function toggleEquipoExpand(id) {
  const row = document.getElementById(id);
  if (!row) return;
  row.classList.toggle('open');
}

function buildIntervencionesEquipo(equipoId) {
  const equipo = DATA.equipos.find(e => e.ID_Activo === equipoId) || {};

  // ── Panel de detalles del equipo ────────────────────────────
  const costeStr = equipo.Coste
    ? parseFloat(equipo.Coste).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
    : '—';
  const manualBtn = equipo.Manual_Ficha_Tecnica
    ? `<a href="#" onclick="abrirDocumento('${equipo.Manual_Ficha_Tecnica}'); return false;" style="color:var(--accent);font-size:12px;text-decoration:none">📄 Ver manual</a>`
    : '<span style="color:var(--text-muted)">—</span>';
  const detalle = (label, valor) =>
    `<div><div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">${label}</div><div style="font-size:12px">${valor||'—'}</div></div>`;

  const panelDetalles = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 16px;padding:10px 12px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:14px">
      <div class="detail-mobile-only">${detalle('Marca / Modelo', [equipo.Marca, equipo.Modelo].filter(Boolean).join(' · '))}</div>
      <div class="detail-mobile-only">${detalle('Ubicación', equipo.Ubicacion)}</div>
      <div class="detail-mobile-only">${detalle('Responsable', equipo.Responsable)}</div>
      ${detalle('Nº de serie', equipo.Numero_Serie)}
      ${detalle('Origen financiación', equipo.Origen_Financiacion)}
      ${detalle('Coste', costeStr)}
      ${detalle('Proveedor compra', equipo.Proveedor_Compra)}
      ${detalle('Servicio técnico', equipo.Proveedor_Servicio_Tecnico)}
      <div>${detalle('Manual / Ficha técnica', '')}<div style="margin-top:2px">${manualBtn}</div></div>
    </div>`;
  const ints = DATA.intervenciones
    .filter(i => i.Equipo && i.Equipo.startsWith(equipoId))
    .map(i => ({ i, origIdx: DATA.intervenciones.indexOf(i) }))
    .sort((a, b) => {
      const dA = new Date(a.i.Fecha_Realizacion || a.i.Fecha_Planificada || 0);
      const dB = new Date(b.i.Fecha_Realizacion || b.i.Fecha_Planificada || 0);
      if (dB - dA !== 0) return dB - dA;       // fecha descendente
      return b.origIdx - a.origIdx;             // mismo día → mayor índice (más reciente) primero
    })
    .slice(0, 8);
  // Envuelto en min-width:0 + overflow-x:auto por el mismo motivo que las intervenciones:
  // que su min-content sea 0 y las filas del plan no expandan la tabla exterior.
  const _mantHtml = buildMantenimientoEquipo(equipoId);
  const mantSection = _mantHtml ? `<div style="min-width:0;overflow-x:auto">${_mantHtml}</div>` : '';

  if (!ints.length) return panelDetalles + mantSection + `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin intervenciones registradas para este equipo.</div>`;
  const tipoBadge    = {'Correctivo':'badge-red','Calibración':'badge-blue','Verificación funcional':'badge-blue','Validación':'badge-blue','Limpieza':'badge-gray','Descontaminación':'badge-gray','Sustitución de pieza':'badge-orange','Cambio de consumibles':'badge-orange','Control de temperatura':'badge-blue','Puesta en marcha':'badge-green','Actualización de software':'badge-blue'};
  const estadoBadgeI = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};
  // El wrapper con min-width:0 + overflow-x:auto contiene el grid de columnas fijas
  // para que su min-content sea 0 y no expanda la tabla exterior.
  return panelDetalles + mantSection + `<div style="min-width:0;overflow-x:auto">
    <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Últimas intervenciones</div>
    <div class="intervenciones-mini-header"><span>Tipo</span><span>Estado</span><span>Fecha</span><span>Quién</span><span>Descripción</span><span>Resultado</span><span></span></div>
    ${ints.map(({ i, origIdx }) => {
      const intIdx = origIdx;
      const _puedeAct = puedeHacer('crearIntervenciones') &&
        (getUserRole() !== 'Profesor' || esResponsableDeEquipo(DATA.equipos.find(eq => eq.ID_Activo === equipoId) || {}));
      const puedeRegistrar   = _puedeAct && (i.Estado === 'Planificada' || i.Estado === 'En gestión' || !i.Estado);
      const pendienteFactura = _puedeAct && i.Estado === 'Pendiente factura';
      const btnLabel = i.Estado === 'Planificada' ? '🔧 Ejecutar' : '📋 Añadir tarea';
      const quien = i.Realizado_Por || i.Tecnico_Externo || i.Proveedor || '—';
      const resumen = _resumenIntervencion(i);
      return `<div class="intervencion-mini-row">
        <span><span class="badge ${tipoBadge[i.Tipo]||'badge-gray'}" style="font-size:10px">${i.Tipo||'—'}</span></span>
        <span>${i.Estado ? `<span class="badge ${estadoBadgeI[i.Estado]||'badge-gray'}" style="font-size:10px">${i.Estado}</span>` : '—'}</span>
        <span>${formatDate(i.Fecha_Realizacion)||formatDate(i.Fecha_Planificada)||'—'}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${quien}">${quien}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)" title="${resumen}">${resumen}</span>
        <span>${i.Resultado||'—'}</span>
        <span style="white-space:nowrap">
          ${puedeRegistrar ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();openModalActuacionDerivada(${intIdx})">${btnLabel}</button>` : ''}
          ${pendienteFactura ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();openModalAdjuntarFactura(${intIdx})">📎 Factura</button>` : ''}
          <button class="icon-btn" style="font-size:11px;margin-left:2px" onclick="event.stopPropagation();openFichaIntervencion(${intIdx})" title="Ver ficha">🔍</button>
        </span>
      </div>`;
    }).join('')}
  </div>`;
}

function filtrarEquipos(val)       { renderEquipos(val, undefined); }
function filtrarEquiposEstado(val) { renderEquipos(undefined, val); }
function filtrarEquiposModulo(val) { renderEquipos(undefined, undefined, val); }
function filtrarEquiposUbicacion(val) { renderEquipos(undefined, undefined, undefined, val); }

// ============================================================
// INTERVENCIONES — RENDER
// ============================================================
// ============================================================
// PRÓXIMAS VISITAS — intervenciones aún sin ejecutar (Estado='Planificada'),
// separadas de la tabla principal para que no se pierdan entre las que ya
// tienen datos reales, y agrupadas por incidencia para no dispersar una
// misma cadena de visitas.
// ============================================================
function renderProximasVisitas() {
  const card = document.getElementById('card-proximas-visitas');
  const tbody = document.getElementById('tabla-proximas-visitas');
  if (!card || !tbody) return;
  const rol = getUserRole();
  let items = DATA.intervenciones.filter(i => i.Estado === 'Planificada');
  if (rol === 'Profesor') {
    items = items.filter(i => {
      const equipo = DATA.equipos.find(e => i.Equipo && i.Equipo.startsWith(e.ID_Activo));
      return equipo ? esResponsableDeEquipo(equipo) : false;
    });
  }
  if (!items.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  // Agrupar por incidencia vinculada (cada incidencia solo tiene una visita activa a la vez)
  const grupos = items.map(i => {
    const inc = DATA.incidencias.find(x => x.Intervencion_Generada === i.ID_Intervencion);
    return { i, inc };
  }).sort((a, b) => {
    if (!a.i.Fecha_Planificada && !b.i.Fecha_Planificada) return 0;
    if (!a.i.Fecha_Planificada) return 1;
    if (!b.i.Fecha_Planificada) return -1;
    return new Date(a.i.Fecha_Planificada) - new Date(b.i.Fecha_Planificada);
  });

  const tipoBadge = {'Correctivo':'badge-red','Calibración':'badge-blue','Verificación funcional':'badge-blue','Validación':'badge-blue','Limpieza':'badge-gray','Descontaminación':'badge-gray','Sustitución de pieza':'badge-orange','Cambio de consumibles':'badge-orange','Control de temperatura':'badge-blue','Puesta en marcha':'badge-green','Actualización de software':'badge-blue'};
  tbody.innerHTML = grupos.map(({ i, inc }) => {
    const intIdx = DATA.intervenciones.indexOf(i);
    const nTareas = getTareasIntervencion(i.ID_Intervencion).length;
    const puedeEjecutar = puedeHacer('crearIntervenciones') &&
      (rol !== 'Profesor' || esResponsableDeEquipo(DATA.equipos.find(e => i.Equipo && i.Equipo.startsWith(e.ID_Activo)) || {}));
    return `<tr>
      <td>${i.Equipo||'—'}</td>
      <td><span class="badge ${tipoBadge[i.Tipo]||'badge-gray'}">${i.Tipo||'—'}</span>${nTareas ? ` <span class="badge badge-blue" style="font-size:10px">${nTareas} prevista${nTareas>1?'s':''}</span>` : ''}</td>
      <td>${i.Fecha_Planificada ? formatDate(i.Fecha_Planificada) : '<span class="text-muted">Por concretar</span>'}</td>
      <td>${inc ? `<span class="badge badge-orange" style="font-size:10px;cursor:pointer" onclick="abrirHiloIncidencia('${inc.ID_Incidencia}')" title="Ver hilo completo">🔗 ${inc.ID_Incidencia}</span>` : '<span class="text-muted">—</span>'}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openFichaIntervencion(${intIdx})" title="Ver ficha">🔍</button>
        ${puedeEjecutar ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModalActuacionDerivada(${intIdx})">🔧 Ejecutar</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}

// ============================================================
// REGISTRO DE INTERVENCIONES — solo las que ya se han ejecutado (o están en
// gestión/cerradas/pendientes de factura); las Planificadas viven arriba,
// en "Próximas visitas", para no mezclarse con filas sin datos aún.
// ============================================================
function renderIntervenciones(filtroTipo = '') {
  const tbody = document.getElementById('tabla-intervenciones');
  let items = DATA.intervenciones.filter(i => i.Estado !== 'Planificada');
  const rol = getUserRole();
  // Profesor: ve todas las intervenciones de los equipos de los que es responsable
  // (no solo las que él mismo creó — así puede ejecutar intervenciones planificadas por Gestores)
  if (rol === 'Profesor') {
    items = items.filter(i => {
      const equipo = DATA.equipos.find(e => i.Equipo && i.Equipo.startsWith(e.ID_Activo));
      return equipo ? esResponsableDeEquipo(equipo) : false;
    });
  }
  if (filtroTipo) items = items.filter(i => i.Tipo === filtroTipo);

  // Agrupar por cadena (misma incidencia) para que las visitas relacionadas no se
  // pierdan dispersas por fecha entre el resto — dentro de cada cadena, orden
  // cronológico (para leer la historia en orden); los grupos se ordenan por su
  // actividad más reciente, como el orden por fecha de siempre.
  const fechaOrden = i => new Date(i.Fecha_Realizacion || i.Fecha_Planificada || 0).getTime();
  const grupos = new Map();
  items.forEach(i => {
    const chain = getChainIntervencion(i.ID_Intervencion);
    const rootId = chain.length ? chain[0].ID_Intervencion : i.ID_Intervencion;
    if (!grupos.has(rootId)) grupos.set(rootId, []);
    grupos.get(rootId).push(i);
  });
  const gruposOrdenados = [...grupos.values()]
    .map(g => [...g].sort((a, b) => fechaOrden(a) - fechaOrden(b)))
    .sort((ga, gb) => Math.max(...gb.map(fechaOrden)) - Math.max(...ga.map(fechaOrden)));
  items = gruposOrdenados.flat();

  if (!items.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">🔧</div><div class="empty-state-title">Sin intervenciones registradas</div></div></td></tr>`; return; }
  const tipoBadge  = {'Preventivo':'badge-green','Correctivo':'badge-red','Calibración':'badge-blue','Verificación funcional':'badge-blue','Limpieza':'badge-gray','Sustitución de pieza':'badge-orange','Control de temperatura':'badge-blue'};
  const estadoBadge = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};
  tbody.innerHTML = items.map(i => {
    const pdfLink = i.URL_Adjunto ? `<a href="#" onclick="abrirDocumento('${i.URL_Adjunto}'); return false;" title="${i.Nombre_Adjunto||'Ver documento'}" class="icon-btn">📄</a>` : '';
    const intIdx  = DATA.intervenciones.indexOf(i);
    const puedeRegistrar    = puedeHacer('crearIntervenciones') && i.Estado === 'En gestión';
    const actFinalizada     = i.Actuacion_Finalizada === 'Sí';
    const pendienteFactura  = i.Estado === 'Pendiente factura' && puedeHacer('crearIntervenciones');

    const chain = getChainIntervencion(i.ID_Intervencion);
    const posicion = chain.findIndex(c => c.ID_Intervencion === i.ID_Intervencion) + 1;
    const esContinuacion = chain.length > 1 && posicion > 1;
    const inc = DATA.incidencias.find(x => chain.some(c => c.ID_Intervencion === x.Intervencion_Generada));
    const incCelda = inc
      ? `<span style="white-space:nowrap"><span class="badge badge-orange" style="font-size:10px">${inc.ID_Incidencia}</span>${chain.length > 1 ? ` <span class="text-muted" style="font-size:10px">${posicion}/${chain.length}</span>` : ''}</span>`
      : '<span class="text-muted">—</span>';
    const idCelda = esContinuacion ? `<span style="color:var(--text-muted)">↳</span> ${i.ID_Intervencion}` : `<strong>${i.ID_Intervencion}</strong>`;
    const operativoIcono = i.Equipo_Operativo_Tras_Intervencion === 'Sí' ? ' 🟢' : i.Equipo_Operativo_Tras_Intervencion === 'No' ? ' 🔴' : '';

    return `<tr${esContinuacion ? ' style="background:var(--surface2)"' : ''}>
      <td style="white-space:nowrap">${idCelda}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${i.Equipo||''}">${i.Equipo||'—'}</td>
      <td>${incCelda}</td>
      <td><span class="badge ${tipoBadge[i.Tipo]||'badge-gray'}">${i.Tipo||'—'}</span></td>
      <td>${i.Estado ? `<span class="badge ${estadoBadge[i.Estado]||'badge-gray'}">${i.Estado}</span>` : '—'}</td>
      <td style="white-space:nowrap">${formatDate(i.Fecha_Realizacion)||formatDate(i.Fecha_Planificada)||'—'}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${i.Realizado_Por||i.Tecnico_Externo||i.Proveedor||''}">${i.Realizado_Por||i.Tecnico_Externo||i.Proveedor||'—'}</td>
      <td style="white-space:nowrap">${i.Resultado||'—'}${operativoIcono}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openFichaIntervencion(${intIdx})" title="Ver ficha">🔍</button>
        ${pdfLink}
        ${puedeRegistrar ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModalActuacionDerivada(${intIdx})">${actFinalizada ? '✏️ Editar actuación' : '📋 Añadir tarea'}</button>` : ''}
        ${pendienteFactura ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModalAdjuntarFactura(${intIdx})">📎 Factura</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}
function filtrarIntervencionesTipo(val) { renderIntervenciones(val); }

// ============================================================
// INCIDENCIAS — RENDER
// ============================================================
function renderIncidencias(filtroEstado = '') {
  const container = document.getElementById('lista-incidencias');
  const rol = getUserRole();
  let items = DATA.incidencias;
  if (rol === 'Profesor') {
    const miNombre = (getEffectiveUser().name || '').toLowerCase().trim();
    items = items.filter(i => {
      if ((i.Reportado_Por || '').toLowerCase().trim() === miNombre) return true;
      const equipo = DATA.equipos.find(e => i.Equipo && i.Equipo.startsWith(e.ID_Activo));
      return equipo ? esResponsableDeEquipo(equipo) : false;
    });
  }
  if (filtroEstado) items = items.filter(i => i.Estado === filtroEstado);
  else items = items.filter(i => !['Resuelta','Descartada'].includes(i.Estado));
  items = [...items].sort((a,b) => new Date(b.Fecha_Hora) - new Date(a.Fecha_Hora));
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Sin incidencias pendientes</div></div>`;
    return;
  }
  const estadoBadge  = {'Abierta':'badge-red','En gestión':'badge-orange','Resuelta':'badge-green','Descartada':'badge-gray'};
  const impactoBadge = {'Equipo fuera de servicio':'badge-red','Uso limitado':'badge-orange','No bloquea':'badge-gray'};
  const esProfesor = getUserRole() === 'Profesor';
  container.innerHTML = items.map(i => {
    let btnAccion = '';
    let metaGestion = '';
    if (i.Estado === 'En gestión' && i.Intervencion_Generada) {
      const intEnl = DATA.intervenciones.find(x => x.ID_Intervencion === i.Intervencion_Generada);
      const intIdx = intEnl ? DATA.intervenciones.indexOf(intEnl) : -1;
      if (intEnl) {
        const tareasEnl = getTareasIntervencion(intEnl.ID_Intervencion);
        metaGestion = tareasEnl.length
          ? `<span class="inc-fecha">${tareasEnl.filter(t => t.Resultado==='Resuelto'||t.Resultado==='Descartado').length}/${tareasEnl.length} tareas</span>`
          : `<span class="inc-fecha">📅 ${intEnl.Fecha_Planificada ? formatDate(intEnl.Fecha_Planificada) : 'Por concretar'}</span>`;
      }
      if (puedeHacer('crearIntervenciones') && !esProfesor) {
        if (intEnl && intEnl.Estado === 'Pendiente factura') {
          btnAccion = intIdx >= 0
            ? `<button class="btn btn-secondary btn-sm" onclick="openModalAdjuntarFactura(${intIdx})">📎 Adjuntar factura</button>`
            : `<span class="text-muted" style="font-size:11px">${i.Intervencion_Generada}</span>`;
        } else if (intEnl && intEnl.Actuacion_Finalizada === 'Sí') {
          // Actuación finalizada: la edición se hace SOLO desde el hilo. Una incidencia
          // puede acumular varias actuaciones, así que un botón "Editar actuación" aquí
          // sería ambiguo (¿cuál se edita?). El botón "🔗 Hilo" ya da acceso a todas.
          btnAccion = '';
        } else {
          btnAccion = intIdx >= 0
            ? `<button class="btn btn-secondary btn-sm" onclick="openModalActuacionDerivada(${intIdx})">Ver / Actuar</button>`
            : `<span class="text-muted" style="font-size:11px">${i.Intervencion_Generada}</span>`;
        }
      }
    } else if (i.Estado === 'Abierta' && puedeHacer('crearIntervenciones') && !esProfesor) {
      btnAccion = `<button class="btn btn-secondary btn-sm" onclick="abrirPlanificacion('${i.ID_Incidencia}','${i.Equipo}')">Responder</button>`;
    }
    const urgenteCls = i.Urgencia === 'Urgente' ? ' inc-urgente' : '';
    const btnHilo = i.Intervencion_Generada
      ? `<button class="btn btn-secondary btn-sm" onclick="abrirHiloIncidencia('${i.ID_Incidencia}')">🔗 Hilo</button>`
      : '';
    const btnEliminar = puedeHacer('eliminarItems') && !['Resuelta','Descartada'].includes(i.Estado)
      ? `<button class="btn btn-danger btn-sm" onclick="eliminarIncidencia('${i.ID_Incidencia}')">Eliminar</button>`
      : '';
    const relacionada = i.Relacionada_Con
      ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">↳ continúa de ${i.Relacionada_Con}</div>`
      : '';
    return `
<div class="inc-card${urgenteCls}">
  <div class="inc-card-top">
    <div class="inc-card-ident">
      <span class="inc-id">${i.ID_Incidencia}</span>
      <span class="inc-equipo">${i.Equipo || '—'}</span>
    </div>
    <div class="inc-card-meta">
      ${i.Urgencia === 'Urgente' ? '<span class="badge badge-red">Urgente</span>' : ''}
      <span class="badge ${estadoBadge[i.Estado] || 'badge-gray'}">${i.Estado || '—'}</span>
      ${metaGestion}
      <span class="inc-fecha">${formatDate(i.Fecha_Hora) || '—'}</span>
    </div>
  </div>
  <div class="inc-problema">${i.Descripcion_Problema || '—'}</div>
  ${relacionada}
  <div class="inc-card-footer">
    <div class="inc-footer-meta">
      <span class="badge ${impactoBadge[i.Impacto] || 'badge-gray'}">${i.Impacto || '—'}</span>
      <span class="inc-reporter">👤 ${i.Reportado_Por || '—'}</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center">${btnHilo}${btnAccion}${btnEliminar}</div>
  </div>
</div>`;
  }).join('');
}
function filtrarIncidenciasEstado(val) { renderIncidencias(val); }

// ============================================================
// HELPER — cadena de intervenciones vinculadas a una incidencia
// ============================================================
function getChainIntervencion(intId) {
  const all = DATA.intervenciones;
  const thisInt = all.find(i => i.ID_Intervencion === intId);
  if (!thisInt) return [];

  // Subir hasta la raíz siguiendo "Seguimiento de X"
  let root = thisInt;
  const visited = new Set();
  while (root.Origen && root.Origen.startsWith('Seguimiento de ')) {
    const parentId = root.Origen.replace('Seguimiento de ', '');
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = all.find(i => i.ID_Intervencion === parentId);
    if (!parent) break;
    root = parent;
  }

  // Bajar desde la raíz construyendo la cadena
  const chain = [root];
  const seen = new Set([root.ID_Intervencion]);
  let current = root;
  while (true) {
    const next = all.find(i => i.Origen === 'Seguimiento de ' + current.ID_Intervencion);
    if (!next || seen.has(next.ID_Intervencion)) break;
    chain.push(next);
    seen.add(next.ID_Intervencion);
    current = next;
  }
  return chain;
}

// ============================================================
// FICHA DE INTERVENCIÓN — modal de solo lectura con acciones
// ============================================================
function _buildTimelineIncidencia(inc, chain, currentIntId) {
  const estadoBadge = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};
  const nodos = [];
  if (inc) {
    nodos.push({
      titulo: 'Incidencia',
      fecha: formatDate(inc.Fecha_Hora) || '—',
      detalle: inc.Impacto || '',
      current: false
    });
  }
  chain.forEach((c, idx) => {
    const quien = c.Proveedor ? `SAT: ${c.Proveedor}` : (c.Realizado_Por ? `Interna: ${c.Realizado_Por}` : '');
    const fecha = c.Fecha_Realizacion
      ? formatDate(c.Fecha_Realizacion)
      : (c.Fecha_Planificada ? formatDate(c.Fecha_Planificada) + ' (prevista)' : 'Por concretar');
    const tareasC = getTareasIntervencion(c.ID_Intervencion);
    const resueltas = tareasC.filter(t => t.Resultado === 'Resuelto' || t.Resultado === 'Descartado').length;
    nodos.push({
      titulo: chain.length > 1 ? `Actuación ${idx + 1}` : 'Actuación',
      fecha,
      detalle: quien,
      tareasTxt: tareasC.length ? `${resueltas}/${tareasC.length} tareas` : '',
      estado: c.Estado,
      current: c.ID_Intervencion === currentIntId
    });
  });

  return `<div style="display:flex;align-items:flex-start;gap:0;margin-bottom:16px;overflow-x:auto">${nodos.map((n, idx) => {
    const ultimo = idx === nodos.length - 1;
    return `<div style="display:flex;align-items:flex-start;${ultimo ? '' : 'flex:1'}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:84px;text-align:center">
        <div style="width:10px;height:10px;border-radius:50%;background:${n.current ? 'var(--accent)' : 'var(--text-muted)'}"></div>
        <span style="font-size:10px;font-weight:600;color:${n.current ? 'var(--text)' : 'var(--text-soft)'}">${n.titulo}</span>
        <span style="font-size:9px;color:var(--text-muted)">${n.fecha}</span>
        ${n.estado ? `<span class="badge ${estadoBadge[n.estado]||'badge-gray'}" style="font-size:9px">${n.estado}</span>` : ''}
        ${n.detalle ? `<span style="font-size:9px;color:var(--text-muted)">${n.detalle}</span>` : ''}
        ${n.tareasTxt ? `<span style="font-size:9px;color:var(--text-muted)">${n.tareasTxt}</span>` : ''}
      </div>
      ${ultimo ? '' : `<div style="flex:1;height:2px;background:var(--border);margin:5px 4px 0"></div>`}
    </div>`;
  }).join('')}</div>`;
}

function openFichaIntervencion(intIdx) {
  const i = DATA.intervenciones[intIdx];
  if (!i) return;
  const tipoBadge  = {'Preventivo':'badge-green','Correctivo':'badge-red','Calibración':'badge-blue','Verificación funcional':'badge-blue','Limpieza':'badge-gray','Sustitución de pieza':'badge-orange','Control de temperatura':'badge-blue'};
  const estadoBadge = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};

  document.getElementById('ficha-int-id').textContent       = i.ID_Intervencion;
  document.getElementById('ficha-int-equipo').textContent   = i.Equipo || '—';
  document.getElementById('ficha-int-tipo').innerHTML       = `<span class="badge ${tipoBadge[i.Tipo]||'badge-gray'}">${i.Tipo||'—'}</span>`;
  document.getElementById('ficha-int-estado').innerHTML     = i.Estado ? `<span class="badge ${estadoBadge[i.Estado]||'badge-gray'}">${i.Estado}</span>` : '—';

  // Incidencia vinculada — buscar por cadena (la incidencia puede apuntar a otra INT del hilo)
  const chain = getChainIntervencion(i.ID_Intervencion);
  const chainIds = chain.map(c => c.ID_Intervencion);
  const incVinculada = DATA.incidencias.find(x => chainIds.includes(x.Intervencion_Generada));
  const elInc = document.getElementById('ficha-int-incidencia');
  if (elInc) elInc.innerHTML = incVinculada
    ? `<span class="badge badge-orange">${incVinculada.ID_Incidencia} · ${incVinculada.Impacto} · ${incVinculada.Estado}</span>`
    : '<span style="color:var(--text-muted);font-size:12px">—</span>';

  const tareas = getTareasIntervencion(i.ID_Intervencion);
  const timelineEl = document.getElementById('ficha-int-timeline');
  if (timelineEl) timelineEl.innerHTML = _buildTimelineIncidencia(incVinculada, chain, i.ID_Intervencion);

  document.getElementById('ficha-int-fecha-plan').textContent     = formatDate(i.Fecha_Planificada) || '—';
  document.getElementById('ficha-int-fecha-estimada').textContent = formatDate(i.Fecha_Estimada_Resolucion) || '—';
  document.getElementById('ficha-int-fecha-real').textContent     = formatDate(i.Fecha_Realizacion) || '—';
  const quienRealizo = i.Realizado_Por || (i.Proveedor ? 'SAT: ' + i.Proveedor : '') || i.Tecnico_Externo || '—';
  document.getElementById('ficha-int-realizado').textContent      = quienRealizo;
  document.getElementById('ficha-int-resultado').textContent      = i.Resultado || '—';
  document.getElementById('ficha-int-operativo').innerHTML        = i.Equipo_Operativo_Tras_Intervencion === 'Sí'
    ? '<span class="badge badge-green">Sí</span>'
    : i.Equipo_Operativo_Tras_Intervencion === 'No'
      ? '<span class="badge badge-red">No</span>'
      : '—';

  // Tareas de esta visita (o descripción legada si es una intervención previa a este cambio)
  const elTareas = document.getElementById('ficha-int-tareas');
  if (elTareas) {
    elTareas.innerHTML = tareas.length
      ? tareas.map(t => `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1">${t.Descripcion}${t.Observaciones ? `<div style="color:var(--text-muted);font-size:11px;margin-top:2px">${t.Observaciones}</div>` : ''}</span>
          <span class="badge ${_RESULTADO_BADGE[t.Resultado]||'badge-gray'}" style="font-size:10px;white-space:nowrap">${t.Resultado}</span>
        </div>`).join('')
      : `<span style="color:var(--text-muted)">${i.Descripcion_Actuacion || i.Observaciones || 'Sin tareas registradas'}</span>`;
  }

  // Coste total de la incidencia, sumando todas las visitas del hilo
  const costeTotal = chain.reduce((sum, c) => sum + (parseFloat(c.Coste_Intervencion) || 0), 0);
  document.getElementById('ficha-int-coste').textContent = costeTotal
    ? costeTotal.toLocaleString('es-ES', { style:'currency', currency:'EUR' }) + (chain.length > 1 ? ' (total del hilo)' : '')
    : '—';
  document.getElementById('ficha-int-observaciones').textContent = i.Observaciones || '—';
  document.getElementById('ficha-int-doc').innerHTML = i.URL_Adjunto
    ? `<a href="#" onclick="abrirDocumento('${i.URL_Adjunto}'); return false;" class="btn btn-secondary" style="font-size:12px">📄 ${i.Nombre_Adjunto || 'Ver documento'}</a>`
    : '<span style="color:var(--text-muted);font-size:12px">Sin documento adjunto</span>';

  // Botones de acción
  const actFinalizada = i.Actuacion_Finalizada === 'Sí';
  const puedeRegistrar = puedeHacer('crearIntervenciones') &&
    (i.Estado === 'Planificada' || i.Estado === 'En gestión' || !i.Estado);
  // Una actuación finalizada se puede reabrir/editar aunque ya esté Cerrada — a veces
  // se registra algo mal y hay que corregirlo (el modal lo deja claro y ofrece "Reabrir").
  const puedeEditarFinalizada = puedeHacer('crearIntervenciones') && actFinalizada;
  const pendienteFactura = i.Estado === 'Pendiente factura';
  // "Pendiente factura" solo significa que esta visita concreta se factura — no que el
  // problema esté resuelto (una tarea puede quedar Resuelto siendo solo un diagnóstico).
  // Por eso también se puede programar otra visita en ese estado, no solo desde "En gestión".
  const puedeNuevaVisita = puedeHacer('crearIntervenciones') && (i.Estado !== 'Cerrada' || actFinalizada);
  const equipoIdFicha = (i.Equipo || '').split(' – ')[0].trim();
  const btnLabel = actFinalizada ? '✏️ Editar actuación' : (i.Estado === 'Planificada' ? '🔧 Ejecutar' : '📋 Añadir tarea');
  const acciones = document.getElementById('ficha-int-acciones');
  let btns = '';
  if (puedeRegistrar || puedeEditarFinalizada)
    btns += `<button class="btn ${actFinalizada ? 'btn-secondary' : 'btn-primary'}" onclick="closeModal('modal-ficha-intervencion');openModalActuacionDerivada(${intIdx})">${btnLabel}</button>`;
  if (pendienteFactura && puedeHacer('crearIntervenciones'))
    btns += `<button class="btn btn-primary" onclick="closeModal('modal-ficha-intervencion');openModalAdjuntarFactura(${intIdx})">📎 Adjuntar factura y cerrar</button>`;
  if (puedeNuevaVisita)
    btns += `<button class="btn ${actFinalizada ? 'btn-primary' : 'btn-secondary'}" onclick="closeModal('modal-ficha-intervencion');${incVinculada ? `programarOtraVisita(${intIdx})` : `openModalRegistrarActuacionDirecta('${equipoIdFicha}')`}">${incVinculada ? '📅 Programar otra actuación' : '🔧 Registrar otra actuación'}</button>`;
  if (incVinculada)
    btns += `<button class="btn btn-secondary" onclick="closeModal('modal-ficha-intervencion');abrirHiloIncidencia('${incVinculada.ID_Incidencia}')">🔗 Ver hilo completo</button>`;
  acciones.innerHTML = btns;

  openModal('modal-ficha-intervencion');
}
