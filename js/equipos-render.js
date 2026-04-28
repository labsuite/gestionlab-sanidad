// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  setText('stat-equipos', DATA.equipos.length);

  const hoy  = new Date();
  const en30 = new Date(); en30.setDate(hoy.getDate() + 30);
  const miNombre = currentUser?.name || '';
  const esProfesor = getUserRole() === 'Profesor';
  // Profesor solo ve sus propios equipos en el dashboard de preventivos (multi-responsable)
  const misEquipos = esProfesor
    ? DATA.equipos.filter(e => esResponsableDeEquipo(e))
    : DATA.equipos;
  const preventivos = misEquipos.filter(e => e.Fecha_Proximo_Preventivo && new Date(e.Fecha_Proximo_Preventivo) <= en30);
  setText('stat-preventivos', preventivos.length);

  const incAbiertas = DATA.incidencias.filter(i => i.Estado === 'Abierta' || i.Estado === 'En gestión');
  setText('stat-incidencias', incAbiertas.length);

  const alertas = document.getElementById('alertas-container');
  if (!alertas) return;
  alertas.innerHTML = '';

  const vencidos  = DATA.equipos.filter(e => e.Fecha_Proximo_Preventivo && new Date(e.Fecha_Proximo_Preventivo) < hoy);
  const averiados = DATA.equipos.filter(e => e.Estado_Operativo === 'Averiado' || e.Estado_Operativo === 'Fuera de servicio');

  if (averiados.length) alertas.innerHTML += `<div class="alert-banner danger"><div class="alert-icon">🔴</div><div class="alert-content"><div class="alert-title">${averiados.length} equipo(s) fuera de servicio o averiado(s)</div><div class="alert-text">${averiados.map(e => e.ID_Activo + ' – ' + (e.Tipo_Equipo||'') + ' ' + (e.Marca||'')).join(' · ')}</div></div></div>`;
  if (vencidos.length)  alertas.innerHTML += `<div class="alert-banner danger"><div class="alert-icon">🔴</div><div class="alert-content"><div class="alert-title">${vencidos.length} equipo(s) con mantenimiento preventivo vencido</div><div class="alert-text">${vencidos.map(e => e.ID_Activo + ' – ' + (e.Tipo_Equipo||'') + ' ' + (e.Marca||'')).join(' · ')}</div></div></div>`;
  if (incAbiertas.length) alertas.innerHTML += `<div class="alert-banner"><div class="alert-icon">⚠️</div><div class="alert-content"><div class="alert-title">${incAbiertas.length} incidencia(s) pendiente(s) de resolución</div><div class="alert-text">${incAbiertas.map(i => i.ID_Incidencia + ' · ' + i.Equipo).join(' – ')}</div></div></div>`;

  const solPendientes = DATA.solicitudes.filter(s => s.Estado === 'Pendiente');
  if (solPendientes.length && puedeHacer('gestionarPedidos')) {
    alertas.innerHTML += `<div class="alert-banner" style="cursor:pointer" onclick="showPage('solicitudes')"><div class="alert-icon">📋</div><div class="alert-content"><div class="alert-title">${solPendientes.length} solicitud(es) de material pendiente(s) de gestión</div><div class="alert-text">${solPendientes.slice(0,4).map(s => s.Material + ' · ' + s.Solicitante).join(' – ')}${solPendientes.length > 4 ? ' y ' + (solPendientes.length-4) + ' más...' : ''}</div></div></div>`;
  }

  const bajominimo = DATA.material.filter(m => stockBajoMinimo(m));
  setText('stat-stock-bajo', bajominimo.length);

  const alertasStock = document.getElementById('alertas-stock-container');
  if (!alertasStock) return;
  alertasStock.innerHTML = '';
  if (bajominimo.length) {
    const criticos = bajominimo.filter(m => getStockTotal(m) === 0);
    const bajos    = bajominimo.filter(m => getStockTotal(m) > 0);
    const puedeGestionar = puedeHacer('gestionarPedidos');
    const renderItemsStock = items => items.slice(0,5).map(m => {
      const stock = getStockTotal(m);
      const opt   = parseFloat(m.Stock_Optimo) || 0;
      const falta = opt > 0 ? Math.max(0, opt - stock) : 0;
      const solPedido = DATA.solicitudes.find(s => s.Material === m.Nombre && (s.Estado === 'En pedido' || s.Estado === 'En camino'));
      const btnPedido = puedeGestionar
        ? (solPedido && solPedido.Lista_Pedido
            ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();verDetallePedido('${solPedido.Lista_Pedido}')">Ver pedido</button>`
            : `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();solicitudStockAPedido('${m.ID_Material}',${falta||''})">+ Pedido${falta ? ' (' + falta + ')' : ''}</button>`)
        : '';
      return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:8px">${m.Nombre} (${stock} ${m.Unidad||''}) ${btnPedido}</span>`;
    }).join('');
    if (criticos.length) alertasStock.innerHTML += `<div class="alert-banner danger"><div class="alert-icon">🔴</div><div class="alert-content"><div class="alert-title">${criticos.length} material(es) sin stock</div><div class="alert-text" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px">${renderItemsStock(criticos)}${criticos.length > 5 ? ' y ' + (criticos.length-5) + ' más...' : ''}</div></div></div>`;
    if (bajos.length)    alertasStock.innerHTML += `<div class="alert-banner"><div class="alert-icon">🟡</div><div class="alert-content"><div class="alert-title">${bajos.length} material(es) por debajo del mínimo</div><div class="alert-text" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px">${renderItemsStock(bajos)}${bajos.length > 5 ? ' y ' + (bajos.length-5) + ' más...' : ''}</div></div></div>`;
  }

  // Alertas específicas de zona común (almacén central)
  const alertasZC = DATA.material
    .map(m => ({ m, lotes: getLotesZonaComunBajoMinimo(m) }))
    .filter(({ lotes }) => lotes.length > 0);
  if (alertasZC.length) {
    const puedeGestionar = puedeHacer('gestionarPedidos');
    const itemsZC = alertasZC.slice(0, 6).map(({ m, lotes }) => {
      const stock = lotes.reduce((s, l) => s + (parseFloat(l.Stock_Local) || 0), 0);
      const solPedido = DATA.solicitudes.find(s => s.Material === m.Nombre && (s.Estado === 'En pedido' || s.Estado === 'En camino'));
      const opt   = parseFloat(m.Stock_Optimo) || 0;
      const total = getStockTotal(m);
      const falta = opt > 0 ? Math.max(0, opt - total) : 0;
      const btnPedido = puedeGestionar
        ? (solPedido && solPedido.Lista_Pedido
            ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();verDetallePedido('${solPedido.Lista_Pedido}')">Ver pedido</button>`
            : `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();solicitudStockAPedido('${m.ID_Material}',${falta||''})">+ Pedido${falta ? ' (' + falta + ')' : ''}</button>`)
        : '';
      return `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:8px">${m.Nombre} (zona común: ${stock} ${m.Unidad||''}) ${btnPedido}</span>`;
    }).join('');
    alertasStock.innerHTML += `<div class="alert-banner" style="border-left:3px solid var(--accent);background:var(--accent-light)"><div class="alert-icon">🏬</div><div class="alert-content"><div class="alert-title" style="color:var(--accent)">${alertasZC.length} material(es) bajo mínimo en la zona común (almacén)</div><div class="alert-text" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px">${itemsZC}${alertasZC.length > 6 ? ' y ' + (alertasZC.length-6) + ' más...' : ''}</div></div></div>`;
  }

  const proximos = misEquipos.filter(e => e.Fecha_Proximo_Preventivo).sort((a,b) => new Date(a.Fecha_Proximo_Preventivo) - new Date(b.Fecha_Proximo_Preventivo)).slice(0, 8);
  const tbody = document.getElementById('tabla-proximos');
  if (!proximos.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">Sin preventivos programados</div><div class="empty-state-text">Asigna fechas de próximo preventivo en el inventario</div></div></td></tr>`; return; }
  tbody.innerHTML = proximos.map(e => {
    const f = new Date(e.Fecha_Proximo_Preventivo);
    const diffDias = Math.ceil((f - hoy) / 86400000);
    let badge, estado;
    if (diffDias < 0)      { badge = 'badge-red';    estado = 'Vencido hace ' + Math.abs(diffDias) + 'd'; }
    else if (diffDias <= 7) { badge = 'badge-red';    estado = 'En ' + diffDias + ' días'; }
    else if (diffDias <= 30){ badge = 'badge-orange'; estado = 'En ' + diffDias + ' días'; }
    else                   { badge = 'badge-green';  estado = 'En ' + diffDias + ' días'; }
    return `<tr><td><strong>${e.ID_Activo}</strong></td><td>${e.Tipo_Equipo||'—'} ${e.Marca ? '· ' + e.Marca : ''}</td><td>${e.Ubicacion||'—'}</td><td>${formatDate(e.Fecha_Proximo_Preventivo)}</td><td><span class="badge ${badge}">${estado}</span></td></tr>`;
  }).join('');
}

// ============================================================
// EQUIPOS — RENDER
// ============================================================
let _filtroEquipos = '', _filtroEquiposEstado = '';

function renderEquipos(filtro, filtroEstado) {
  if (filtro !== undefined) _filtroEquipos = filtro;
  if (filtroEstado !== undefined) _filtroEquiposEstado = filtroEstado;
  const tbody = document.getElementById('tabla-equipos');
  let items = DATA.equipos;
  if (_filtroEquipos) items = items.filter(e => JSON.stringify(e).toLowerCase().includes(_filtroEquipos.toLowerCase()));
  if (_filtroEquiposEstado) items = items.filter(e => e.Estado_Operativo === _filtroEquiposEstado);

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
      const intPlan = DATA.intervenciones
        .filter(i => i.Equipo && i.Equipo.startsWith(e.ID_Activo) && i.Estado === 'Planificada' && i.Fecha_Planificada)
        .sort((a, b) => new Date(a.Fecha_Planificada) - new Date(b.Fecha_Planificada))[0];
      if (intPlan) {
        impactoBadge = `<span class="badge badge-blue" style="font-size:10px;margin-left:4px">📅 ${formatDate(intPlan.Fecha_Planificada)}</span>`;
      }
    }
    const proxPreventivo = e.Fecha_Proximo_Preventivo ? (() => {
      const diffDias = Math.ceil((new Date(e.Fecha_Proximo_Preventivo) - new Date()) / 86400000);
      if (diffDias < 0)    return `<span class="badge badge-red">Vencido</span>`;
      if (diffDias <= 30)  return `<span class="badge badge-orange">${formatDate(e.Fecha_Proximo_Preventivo)}</span>`;
      return `<span class="text-muted">${formatDate(e.Fecha_Proximo_Preventivo)}</span>`;
    })() : '<span class="text-muted">—</span>';
    const expandId = 'eq-expand-' + e.ID_Activo.replace(/[^a-zA-Z0-9]/g,'_');
    const manualLink = e.Manual_Ficha_Tecnica ? `<a href="${e.Manual_Ficha_Tecnica}" target="_blank" class="icon-btn" title="Ver manual">📄</a>` : '';
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
      <td>${proxPreventivo}</td>
      <td onclick="event.stopPropagation()"><div class="row-actions">
        ${manualLink}
        ${puedeEditarEste ? `<button class="icon-btn" onclick="editEquipo(${DATA.equipos.indexOf(e)})" title="Editar">✏️</button>` : ''}
        ${puedeIntervenir ? `<button class="icon-btn" onclick="openModalIntervencionEquipo('${e.ID_Activo}')" title="Nueva intervención">🔧</button>` : ''}
        <button class="icon-btn" onclick="openModalIncidenciaEquipo('${e.ID_Activo}')" title="Reportar incidencia">⚠️</button>
      </div></td>
    </tr>
    <tr class="equipo-row-expand" id="${expandId}"><td colspan="8"><div class="equipo-expand-inner">${buildIntervencionesEquipo(e.ID_Activo)}</div></td></tr>`;
  }).join('');
}

function toggleEquipoExpand(id) { const row = document.getElementById(id); if (row) row.classList.toggle('open'); }

function buildIntervencionesEquipo(equipoId) {
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
  if (!ints.length) return `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin intervenciones registradas para este equipo.</div>`;
  const tipoBadge    = {'Preventivo':'badge-green','Correctivo':'badge-red','Calibración':'badge-blue','Verificación funcional':'badge-blue','Limpieza':'badge-gray','Sustitución de pieza':'badge-orange','Control de temperatura':'badge-blue'};
  const estadoBadgeI = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};
  return `<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Últimas intervenciones</div>
    <div class="intervenciones-mini-header"><span>Tipo</span><span>Estado</span><span>Fecha</span><span>Quién</span><span>Descripción</span><span>Resultado</span><span></span></div>
    ${ints.map(({ i, origIdx }) => {
      const intIdx = origIdx;
      const puedeRegistrar = puedeHacer('crearIntervenciones') &&
        (getUserRole() !== 'Profesor' || esResponsableDeEquipo(DATA.equipos.find(eq => eq.ID_Activo === equipoId) || {})) &&
        (i.Estado === 'Planificada' || i.Estado === 'En gestión' || !i.Estado) &&
        i.Resultado !== 'Resuelto';
      const btnLabel = i.Estado === 'Planificada' ? '🔧 Ejecutar' : '📋 Añadir actuación';
      const quien = i.Realizado_Por || i.Tecnico_Externo || i.Proveedor || '—';
      return `<div class="intervencion-mini-row">
        <span><span class="badge ${tipoBadge[i.Tipo]||'badge-gray'}" style="font-size:10px">${i.Tipo||'—'}</span></span>
        <span>${i.Estado ? `<span class="badge ${estadoBadgeI[i.Estado]||'badge-gray'}" style="font-size:10px">${i.Estado}</span>` : '—'}</span>
        <span>${formatDate(i.Fecha_Realizacion)||formatDate(i.Fecha_Planificada)||'—'}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${quien}">${quien}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)" title="${i.Descripcion_Actuacion||i.Descripcion_Planificada||''}">${i.Descripcion_Actuacion||i.Descripcion_Planificada||'—'}</span>
        <span>${i.Resultado||'—'}</span>
        <span style="white-space:nowrap">${puedeRegistrar ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();openModalActuacionDerivada(${intIdx})">${btnLabel}</button>` : ''}<button class="icon-btn" style="font-size:11px;margin-left:2px" onclick="event.stopPropagation();openFichaIntervencion(${intIdx})" title="Ver ficha">🔍</button></span>
      </div>`;
    }).join('')}`;
}

function filtrarEquipos(val)       { renderEquipos(val, undefined); }
function filtrarEquiposEstado(val) { renderEquipos(undefined, val); }

// ============================================================
// INTERVENCIONES — RENDER
// ============================================================
function renderIntervenciones(filtroTipo = '') {
  const tbody = document.getElementById('tabla-intervenciones');
  let items = DATA.intervenciones;
  const rol = getUserRole();
  // Profesor: solo ve las intervenciones que él mismo creó (Realizado_Por)
  // sobre equipos de los que es responsable
  if (rol === 'Profesor') {
    const miNombre = (currentUser?.name || '').toLowerCase().trim();
    items = items.filter(i => {
      const creadaPorMi = (i.Realizado_Por || '').toLowerCase().trim() === miNombre;
      const equipo = DATA.equipos.find(e => i.Equipo && i.Equipo.startsWith(e.ID_Activo));
      const esDesuEquipo = equipo ? esResponsableDeEquipo(equipo) : false;
      return creadaPorMi && esDesuEquipo;
    });
  }
  if (filtroTipo) items = items.filter(i => i.Tipo === filtroTipo);
  items = [...items].map((i, _) => ({ i, origIdx: DATA.intervenciones.indexOf(i) }))
    .sort((a, b) => {
      const dA = new Date(a.i.Fecha_Realizacion || a.i.Fecha_Planificada || 0);
      const dB = new Date(b.i.Fecha_Realizacion || b.i.Fecha_Planificada || 0);
      if (dB - dA !== 0) return dB - dA;
      return b.origIdx - a.origIdx;
    })
    .map(x => x.i);
  if (!items.length) { tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-state-icon">🔧</div><div class="empty-state-title">Sin intervenciones registradas</div></div></td></tr>`; return; }
  const tipoBadge  = {'Preventivo':'badge-green','Correctivo':'badge-red','Calibración':'badge-blue','Verificación funcional':'badge-blue','Limpieza':'badge-gray','Sustitución de pieza':'badge-orange','Control de temperatura':'badge-blue'};
  const estadoBadge = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};
  tbody.innerHTML = items.map(i => {
    const pdfLink = i.URL_Adjunto ? `<a href="${i.URL_Adjunto}" target="_blank" title="${i.Nombre_Adjunto||'Ver documento'}" style="color:var(--accent);font-size:16px">📄</a>` : '<span class="text-muted">—</span>';
    const intIdx  = DATA.intervenciones.indexOf(i);
    const puedeRegistrar = puedeHacer('crearIntervenciones') && (i.Estado === 'Planificada' || i.Estado === 'En gestión' || !i.Estado) && i.Resultado !== 'Resuelto';
    const btnLabel = i.Estado === 'Planificada' ? '🔧 Ejecutar' : '📋 Añadir actuación';
    return `<tr>
      <td><strong>${i.ID_Intervencion}</strong></td>
      <td>${i.Equipo||'—'}</td>
      <td><span class="badge ${tipoBadge[i.Tipo]||'badge-gray'}">${i.Tipo||'—'}</span></td>
      <td>${i.Estado ? `<span class="badge ${estadoBadge[i.Estado]||'badge-gray'}">${i.Estado}</span>` : '—'}</td>
      <td>${formatDate(i.Fecha_Realizacion)||formatDate(i.Fecha_Planificada)||'—'}</td>
      <td>${i.Realizado_Por||i.Tecnico_Externo||'—'}</td>
      <td>${i.Resultado||'—'}</td>
      <td>${i.Equipo_Operativo_Tras_Intervencion==='Sí'?'<span class="badge badge-green">Sí</span>':i.Equipo_Operativo_Tras_Intervencion==='No'?'<span class="badge badge-red">No</span>':'—'}</td>
      <td>${pdfLink}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openFichaIntervencion(${intIdx})" title="Ver ficha">🔍</button>
        ${puedeRegistrar ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModalActuacionDerivada(${intIdx})">${btnLabel}</button>` : ''}
      </div></td>
    </tr>`;
  }).join('');
}
function filtrarIntervencionesTipo(val) { renderIntervenciones(val); }

// ============================================================
// INCIDENCIAS — RENDER
// ============================================================
function renderIncidencias(filtroEstado = '') {
  const tbody = document.getElementById('tabla-incidencias');
  const rol = getUserRole();
  let items = DATA.incidencias;
  if (rol === 'Profesor') { const miNombre = currentUser?.name || ''; items = items.filter(i => i.Reportado_Por === miNombre); }
  if (filtroEstado) items = items.filter(i => i.Estado === filtroEstado);
  // Ocultar incidencias archivadas a menos que se filtre explícitamente
  if (filtroEstado !== 'Archivada') items = items.filter(i => i.Estado !== 'Archivada');
  items = [...items].sort((a,b) => new Date(b.Fecha_Hora) - new Date(a.Fecha_Hora));
  if (!items.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Sin incidencias pendientes</div></div></td></tr>`; return; }
  const estadoBadge  = {'Abierta':'badge-red','En gestión':'badge-orange','Resuelta':'badge-green','Cerrada':'badge-gray'};
  const impactoBadge = {'Equipo fuera de servicio':'badge-red','Uso limitado':'badge-orange','No bloquea':'badge-gray'};
  tbody.innerHTML = items.map(i => {
    const incIdx = DATA.incidencias.indexOf(i);
    // Botón contextual según estado e intervención enlazada
    let btnAccion = '';
    const esProfesor = getUserRole() === 'Profesor';
    if (puedeHacer('crearIntervenciones') && !esProfesor) {
      if (i.Estado === 'Abierta') {
        btnAccion = `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="abrirPlanificacion('${i.ID_Incidencia}','${i.Equipo}')">Responder</button>`;
      } else if ((i.Estado === 'En gestión') && i.Intervencion_Generada) {
        const intEnl = DATA.intervenciones.find(x => x.ID_Intervencion === i.Intervencion_Generada);
        const intIdx = intEnl ? DATA.intervenciones.indexOf(intEnl) : -1;
        btnAccion = intIdx >= 0
          ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px" onclick="openModalActuacionDerivada(${intIdx})">Ver / Actuar</button>`
          : `<span class="text-muted" style="font-size:11px">${i.Intervencion_Generada}</span>`;
      }
    }
    if (!btnAccion && puedeHacer('gestionarIncidencias') && i.Estado !== 'Resuelta' && i.Estado !== 'Cerrada') {
      btnAccion = `<button class="icon-btn" onclick="cambiarEstadoIncidencia(${incIdx})" title="Cambiar estado">🔄</button>`;
    }
    return `<tr>
      <td><strong>${i.ID_Incidencia}</strong></td>
      <td>${i.Equipo||'—'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.Descripcion_Problema||'—'}</td>
      <td><span class="badge ${impactoBadge[i.Impacto]||'badge-gray'}">${i.Impacto||'—'}</span></td>
      <td>${i.Urgencia==='Urgente'?'<span class="badge badge-red">Urgente</span>':'<span class="badge badge-gray">Normal</span>'}</td>
      <td>${i.Reportado_Por||'—'}</td>
      <td>${formatDate(i.Fecha_Hora)||'—'}</td>
      <td><span class="badge ${estadoBadge[i.Estado]||'badge-gray'}">${i.Estado||'—'}</span></td>
      <td><div class="row-actions">${btnAccion}</div></td>
    </tr>`;
  }).join('');
}
function filtrarIncidenciasEstado(val) { renderIncidencias(val); }

// ============================================================
// FICHA DE INTERVENCIÓN — modal de solo lectura con acciones
// ============================================================
function openFichaIntervencion(intIdx) {
  const i = DATA.intervenciones[intIdx];
  if (!i) return;
  const tipoBadge  = {'Preventivo':'badge-green','Correctivo':'badge-red','Calibración':'badge-blue','Verificación funcional':'badge-blue','Limpieza':'badge-gray','Sustitución de pieza':'badge-orange','Control de temperatura':'badge-blue'};
  const estadoBadge = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};

  document.getElementById('ficha-int-id').textContent       = i.ID_Intervencion;
  document.getElementById('ficha-int-equipo').textContent   = i.Equipo || '—';
  document.getElementById('ficha-int-tipo').innerHTML       = `<span class="badge ${tipoBadge[i.Tipo]||'badge-gray'}">${i.Tipo||'—'}</span>`;
  document.getElementById('ficha-int-estado').innerHTML     = i.Estado ? `<span class="badge ${estadoBadge[i.Estado]||'badge-gray'}">${i.Estado}</span>` : '—';
  document.getElementById('ficha-int-origen').textContent   = i.Origen || '—';
  // Incidencia vinculada
  const incVinculada = DATA.incidencias.find(x => x.Intervencion_Generada === i.ID_Intervencion);
  const elInc = document.getElementById('ficha-int-incidencia');
  if (elInc) elInc.innerHTML = incVinculada
    ? `<span class="badge badge-orange" style="cursor:pointer" onclick="closeModal('modal-ficha-intervencion')" title="Incidencia origen">${incVinculada.ID_Incidencia} · ${incVinculada.Impacto}</span>`
    : '<span style="color:var(--text-muted);font-size:12px">—</span>';
  document.getElementById('ficha-int-fecha-plan').textContent = formatDate(i.Fecha_Planificada) || '—';
  document.getElementById('ficha-int-fecha-real').textContent = formatDate(i.Fecha_Realizacion) || '—';
  const quienRealizo = i.Realizado_Por || (i.Proveedor ? 'SAT: ' + i.Proveedor : '') || i.Tecnico_Externo || '—';
  document.getElementById('ficha-int-realizado').textContent = quienRealizo;
  document.getElementById('ficha-int-descripcion').textContent = i.Descripcion_Actuacion || i.Descripcion_Planificada || '—';
  document.getElementById('ficha-int-resultado').textContent   = i.Resultado || '—';
  document.getElementById('ficha-int-operativo').innerHTML     = i.Equipo_Operativo_Tras_Intervencion === 'Sí'
    ? '<span class="badge badge-green">Sí</span>'
    : i.Equipo_Operativo_Tras_Intervencion === 'No'
      ? '<span class="badge badge-red">No</span>'
      : '—';
  document.getElementById('ficha-int-observaciones').textContent = i.Observaciones || '—';
  document.getElementById('ficha-int-doc').innerHTML = i.URL_Adjunto
    ? `<a href="${i.URL_Adjunto}" target="_blank" class="btn btn-secondary" style="font-size:12px">📄 ${i.Nombre_Adjunto || 'Ver documento'}</a>`
    : '<span style="color:var(--text-muted);font-size:12px">Sin documento adjunto</span>';

  // Botones de acción
  const puedeRegistrar = puedeHacer('crearIntervenciones') && (i.Estado === 'Planificada' || i.Estado === 'En gestión' || !i.Estado) && i.Resultado !== 'Resuelto';
  const btnLabel = i.Estado === 'Planificada' ? '🔧 Ejecutar' : '📋 Añadir actuación';
  const acciones = document.getElementById('ficha-int-acciones');
  let btns = '';
  if (puedeRegistrar) btns += `<button class="btn btn-primary" onclick="closeModal('modal-ficha-intervencion');openModalActuacionDerivada(${intIdx})">${btnLabel}</button>`;
  if (puedeHacer('crearIntervenciones')) btns += `<button class="btn btn-secondary" onclick="closeModal('modal-ficha-intervencion');editIntervencion(${intIdx})">✏️ Editar</button>`;
  acciones.innerHTML = btns;

  openModal('modal-ficha-intervencion');
}
