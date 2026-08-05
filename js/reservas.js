// ============================================================
// RESERVAS DE EQUIPOS
// ============================================================

let _reservaTab         = 'disponibilidad';
let _reservaEquipoDisp  = '';
let _reservaEditandoId  = null;
let _gestionReservaId   = null;
let _cfgParamsTemp      = [];

// ── Helpers ───────────────────────────────────────────────────

function _nombreEquipoReserva(idEquipo) {
  const eq = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  return eq ? `${idEquipo} — ${eq.Tipo_Equipo}` : idEquipo;
}

function _solapan(i1, f1, i2, f2) {
  return new Date(i1) < new Date(f2) && new Date(f1) > new Date(i2);
}

function _fmtReservaTs(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function _fmtHoraR(dtStr) {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function _condLabel(condJson) {
  if (!condJson) return '';
  let cond; try { cond = JSON.parse(condJson); } catch { return ''; }
  return Object.entries(cond).filter(([,v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`).join(' · ');
}

function _estadoBadgeR(estado) {
  const map = { 'Pendiente':'badge-orange','Confirmada':'badge-green','Activa':'badge-blue','Rechazada':'badge-red','En conflicto':'badge-orange','Completada':'badge-gray','Cancelada':'badge-gray' };
  return `<span class="badge ${map[estado]||'badge-gray'}">${estado}</span>`;
}

function _nextIdReserva() {
  const nums = DATA.reservas.map(r => parseInt((r.ID_Reserva||'').replace('RSV-',''))||0);
  return 'RSV-' + String(Math.max(0,...nums) + 1).padStart(3,'0');
}

// ── Badge nav ─────────────────────────────────────────────────

function _updateBadgeReservas() {
  const el = document.getElementById('badge-reservas');
  if (!el) return;
  if (!puedeHacer('gestionarReservas')) { el.style.display = 'none'; return; }
  const n = DATA.reservas.filter(r => r.Estado === 'Pendiente').length;
  el.textContent = n;
  el.style.display = n > 0 ? '' : 'none';
}

// ── Render principal ──────────────────────────────────────────

function renderReservas() {
  const el = document.getElementById('page-reservas');
  if (!el) return;

  const esGestor  = puedeHacer('gestionarReservas');
  const pendientes = DATA.reservas.filter(r => r.Estado === 'Pendiente').length;

  const tabBtn = (id, label, badge) => {
    const base = 'padding:8px 18px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;margin-bottom:-2px;';
    const style = base + (_reservaTab === id
      ? 'border-bottom:2px solid var(--primary);color:var(--primary)'
      : 'border-bottom:2px solid transparent;color:var(--text-muted)');
    const bdg = badge
      ? `<span style="font-size:11px;background:#f97316;color:#fff;border-radius:99px;padding:1px 7px;margin-left:4px">${badge}</span>`
      : '';
    return `<button onclick="_switchTabReserva('${id}')" style="${style}">${label}${bdg}</button>`;
  };

  el.innerHTML = `
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;flex-wrap:wrap">
      ${tabBtn('disponibilidad','Disponibilidad')}
      ${tabBtn('mis-reservas','Mis reservas')}
      ${esGestor ? tabBtn('gestion','Gestión',pendientes||null) : ''}
    </div>
    <div id="reserva-tab-disponibilidad">${_renderTabDisponibilidad()}</div>
    <div id="reserva-tab-mis-reservas" style="display:none">${_renderTabMisReservas()}</div>
    ${esGestor ? `<div id="reserva-tab-gestion" style="display:none">${_renderTabGestion()}</div>` : ''}
  `;

  _switchTabReserva(_reservaTab);
}

function _switchTabReserva(tab) {
  _reservaTab = tab;
  ['disponibilidad','mis-reservas','gestion'].forEach(t => {
    const p = document.getElementById(`reserva-tab-${t}`);
    if (p) p.style.display = t === tab ? '' : 'none';
  });
}

// ── Tab: Disponibilidad ───────────────────────────────────────

function _renderTabDisponibilidad() {
  const opciones = DATA.configReservas.map(c => {
    const sel = c.ID_Equipo === _reservaEquipoDisp ? 'selected' : '';
    return `<option value="${c.ID_Equipo}" ${sel}>${_nombreEquipoReserva(c.ID_Equipo)}</option>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px">
      <select class="filter" id="disp-equipo-sel" style="min-width:240px" onchange="_onDispEquipoCambio(this.value)">
        <option value="">— Seleccionar equipo —</option>
        ${opciones}
      </select>
      <button class="btn btn-primary" onclick="openModalNuevaReserva(_reservaEquipoDisp||'')">+ Nueva reserva</button>
      ${puedeHacer('configurarReservas')
        ? `<button class="btn btn-secondary" onclick="openModalConfigEquipo(_reservaEquipoDisp||'')" style="margin-left:auto">⚙️ Configurar equipo</button>`
        : ''}
    </div>
    <div id="disp-timeline-container">${_renderTimeline(_reservaEquipoDisp)}</div>`;
}

function _onDispEquipoCambio(idEquipo) {
  _reservaEquipoDisp = idEquipo;
  const sel = document.getElementById('disp-equipo-sel');
  if (sel) sel.value = idEquipo;
  const el = document.getElementById('disp-timeline-container');
  if (el) el.innerHTML = _renderTimeline(idEquipo);
}

function _renderVisionGeneral() {
  const ahora  = new Date();
  const hoy    = new Date(ahora); hoy.setHours(0,0,0,0);
  const hoyFin = new Date(hoy);   hoyFin.setHours(23,59,59,999);
  const limite = new Date(hoy);   limite.setDate(hoy.getDate() + 14);

  const estadosActivos = ['Confirmada','Activa','Pendiente','En conflicto'];
  const proximas = DATA.reservas
    .filter(r => estadosActivos.includes(r.Estado) && new Date(r.Fecha_Fin) >= ahora && new Date(r.Fecha_Inicio) <= limite)
    .sort((a,b) => new Date(a.Fecha_Inicio) - new Date(b.Fecha_Inicio));

  if (!proximas.length) return `
    <div class="empty-state">
      <div class="empty-state-icon">📅</div>
      <div class="empty-state-title">Sin reservas próximas</div>
      <div class="empty-state-text">No hay reservas en los próximos 14 días · Selecciona un equipo para ver su disponibilidad</div>
    </div>`;

  // Stats
  const enUso      = proximas.filter(r => r.Estado === 'Activa').length;
  const hoyCount   = proximas.filter(r => _solapan(r.Fecha_Inicio, r.Fecha_Fin, hoy.toISOString(), hoyFin.toISOString())).length;
  const futCount   = proximas.filter(r => new Date(r.Fecha_Inicio) > hoyFin).length;

  let html = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">`;
  if (enUso) html += `<div class="card" style="padding:10px 18px;flex:1;min-width:120px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--accent)">${enUso}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">En uso ahora</div></div>`;
  html += `<div class="card" style="padding:10px 18px;flex:1;min-width:120px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--primary)">${hoyCount}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">Reservas hoy</div></div>`;
  html += `<div class="card" style="padding:10px 18px;flex:1;min-width:120px;text-align:center"><div style="font-size:22px;font-weight:700">${futCount}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">Próximas (14 días)</div></div>`;
  html += `</div>`;

  // Agrupar por día (si empezó antes de hoy, aparece bajo "Hoy")
  const grupos = new Map();
  proximas.forEach(r => {
    const ini     = new Date(r.Fecha_Inicio);
    const dayDate = ini < hoy ? hoy : new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
    const key     = dayDate.getTime();
    if (!grupos.has(key)) grupos.set(key, { date: dayDate, reservas: [] });
    grupos.get(key).reservas.push(r);
  });

  let primerGrupo = true;
  for (const [, { date, reservas }] of [...grupos].sort((a,b) => a[0]-b[0])) {
    const esHoy    = date.getTime() === hoy.getTime();
    const labelDia = (esHoy ? 'Hoy · ' : '') +
      date.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });

    html += `<div style="font-size:12px;font-weight:600;color:${esHoy?'var(--primary)':'var(--text-muted)'};text-transform:uppercase;letter-spacing:.5px;margin:${primerGrupo?'0':'20px'} 0 8px">${labelDia}</div>`;
    primerGrupo = false;

    reservas.forEach(r => {
      const eq       = DATA.equipos.find(e => e.ID_Activo === r.ID_Equipo);
      const conds    = _condLabel(r.Condiciones);
      const multiDia = new Date(r.Fecha_Inicio).toDateString() !== new Date(r.Fecha_Fin).toDateString();
      const rango    = multiDia
        ? `${_fmtReservaTs(r.Fecha_Inicio)} → ${_fmtReservaTs(r.Fecha_Fin)}`
        : `${_fmtHoraR(r.Fecha_Inicio)} – ${_fmtHoraR(r.Fecha_Fin)}`;
      const detalle  = [r.Usuario ? r.Usuario.split('@')[0] : '', r.Proposito, conds].filter(Boolean).join(' · ');

      html += `<div class="card" style="padding:11px 16px;margin-bottom:6px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;cursor:pointer" onclick="_onDispEquipoCambio('${r.ID_Equipo}')" title="Ver disponibilidad de ${r.ID_Equipo}">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${eq?.Tipo_Equipo||r.ID_Equipo} <span style="font-size:11px;font-weight:400;color:var(--text-muted)">${r.ID_Equipo}</span></div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${rango}${detalle?' · '+detalle:''}</div>
        </div>
        ${_estadoBadgeR(r.Estado)}
      </div>`;
    });
  }

  html += `<div style="font-size:11px;color:var(--text-muted);margin-top:16px;text-align:center">Haz clic en una reserva para ver la disponibilidad completa del equipo</div>`;
  return html;
}

function _renderTimeline(idEquipo) {
  if (!idEquipo) return _renderVisionGeneral();

  const config = DATA.configReservas.find(c => c.ID_Equipo === idEquipo);
  const eq = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  if (!config) return `<div class="empty-state"><div class="empty-state-title">Equipo no configurado</div></div>`;

  const RANGE_START = 7;   // 07:00
  const RANGE_HOURS = 15;  // hasta 22:00

  const colores = { 'Pendiente':'#f97316','Confirmada':'#22c55e','Activa':'#3b82f6','En conflicto':'#ef4444' };
  const politicaLabel = config.Politica === 'BLOCK'
    ? `<span style="font-size:11px;background:#fee2e2;color:#991b1b;border-radius:4px;padding:2px 7px">Uso exclusivo</span>`
    : `<span style="font-size:11px;background:#dcfce7;color:#166534;border-radius:4px;padding:2px 7px">Condiciones compatibles</span>`;

  const today = new Date(); today.setHours(0,0,0,0);
  const reservasEquipo = DATA.reservas.filter(r =>
    r.ID_Equipo === idEquipo && colores[r.Estado]
  );

  let html = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <strong style="font-size:14px">${eq?.Tipo_Equipo||idEquipo}</strong>
      <span style="font-size:13px;color:var(--text-muted)">${[eq?.Marca,eq?.Modelo].filter(Boolean).join(' ')}</span>
      ${politicaLabel}
    </div>
    <div style="display:flex;font-size:10px;color:var(--text-muted);margin-bottom:4px;padding-left:64px">
      ${['07:00','10:00','13:00','16:00','19:00','22:00'].map((h,i) =>
        `<span style="flex:1;${i===0?'':'text-align:center'}">${h}</span>`).join('')}
    </div>`;

  for (let i = 0; i < 14; i++) {
    const day = new Date(today); day.setDate(today.getDate() + i);
    const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999);
    const label = day.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' });
    const esHoy = i === 0;

    const bloques = reservasEquipo
      .filter(r => r.Fecha_Inicio && r.Fecha_Fin && _solapan(r.Fecha_Inicio, r.Fecha_Fin, day.toISOString(), dayEnd.toISOString()))
      .map(r => {
        const ini = new Date(r.Fecha_Inicio);
        const fin = new Date(r.Fecha_Fin);
        const iniDay = new Date(ini); iniDay.setHours(0,0,0,0);
        const finDay = new Date(fin); finDay.setHours(0,0,0,0);
        const startsToday = iniDay.getTime() === day.getTime();
        const endsToday   = finDay.getTime() === day.getTime();
        const sH = startsToday ? Math.max(RANGE_START, ini.getHours() + ini.getMinutes()/60) : RANGE_START;
        const eH = endsToday   ? Math.min(RANGE_START + RANGE_HOURS, fin.getHours() + fin.getMinutes()/60) : RANGE_START + RANGE_HOURS;
        if (eH <= sH) return '';
        const left  = (sH - RANGE_START) / RANGE_HOURS * 100;
        const width = (eH - sH) / RANGE_HOURS * 100;
        const color = colores[r.Estado];
        const tip   = `${_fmtHoraR(r.Fecha_Inicio)}–${_fmtHoraR(r.Fecha_Fin)} · ${r.Usuario.split('@')[0]} · ${r.Proposito||''}`;
        return `<div title="${tip}" style="position:absolute;left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;height:100%;background:${color};border-radius:3px;opacity:0.85;overflow:hidden;display:flex;align-items:center;padding:0 4px">
          <span style="font-size:9px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_fmtHoraR(r.Fecha_Inicio)}–${_fmtHoraR(r.Fecha_Fin)} ${r.Usuario.split('@')[0]}</span>
        </div>`;
      }).join('');

    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px${esHoy?';font-weight:600':''}">
      <div style="min-width:60px;font-size:11px;color:${esHoy?'var(--primary)':'var(--text-muted)'};text-align:right">${label}</div>
      <div style="flex:1;position:relative;height:22px;background:var(--surface2);border-radius:4px;border:1px solid var(--border)">
        ${bloques || '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text-muted)">Libre</span>'}
      </div>
    </div>`;
  }

  html += `<div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap">
    ${Object.entries(colores).map(([k,v]) =>
      `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted)"><div style="width:12px;height:12px;background:${v};border-radius:2px;opacity:0.85"></div>${k}</div>`
    ).join('')}
  </div>`;

  return html;
}

// ── Tab: Mis reservas ─────────────────────────────────────────

function _renderTabMisReservas() {
  const email    = (currentUser?.email||'').toLowerCase().trim();
  const esGestor = puedeHacer('gestionarReservas');
  const ahora    = new Date();

  let reservas = (esGestor ? DATA.reservas : DATA.reservas.filter(r => (r.Usuario||'').toLowerCase().trim() === email))
    .slice().sort((a,b) => new Date(a.Fecha_Inicio) - new Date(b.Fecha_Inicio));

  if (!reservas.length) return `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">Sin reservas</div><div class="empty-state-text">Usa la pestaña Disponibilidad para reservar un equipo</div></div>`;

  const activas  = reservas.filter(r => r.Estado === 'Activa');
  const proximas = reservas.filter(r => ['Pendiente','Confirmada','En conflicto'].includes(r.Estado) && new Date(r.Fecha_Fin) >= ahora);
  const pasadas  = reservas.filter(r => ['Completada','Rechazada','Cancelada'].includes(r.Estado) || (['Pendiente','Confirmada','En conflicto'].includes(r.Estado) && new Date(r.Fecha_Fin) < ahora));

  const renderCard = r => {
    const esPropia = (r.Usuario||'').toLowerCase().trim() === email;
    const eq = DATA.equipos.find(e => e.ID_Activo === r.ID_Equipo);
    const conds = _condLabel(r.Condiciones);
    const puedeIniciar   = r.Estado === 'Confirmada' && esPropia;
    const puedeFinalizar = r.Estado === 'Activa' && esPropia;
    const puedeCancelar  = ['Pendiente','Confirmada','En conflicto'].includes(r.Estado) && esPropia && new Date(r.Fecha_Inicio) > ahora;

    return `<div class="card" style="padding:16px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:14px;font-weight:600;margin-bottom:2px">${eq?.Tipo_Equipo||r.ID_Equipo} <span style="font-size:12px;color:var(--text-muted);font-weight:400">${r.ID_Equipo}</span></div>
          <div style="font-size:13px;color:var(--text-muted)">${_fmtReservaTs(r.Fecha_Inicio)} → ${_fmtHoraR(r.Fecha_Fin)}</div>
          ${r.Proposito ? `<div style="font-size:12px;margin-top:4px">${r.Proposito}</div>` : ''}
          ${conds ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Condiciones: ${conds}</div>` : ''}
          ${!esPropia && esGestor ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">👤 ${r.Usuario}</div>` : ''}
          ${r.Observaciones_Admin ? `<div style="font-size:11px;background:var(--surface2);border-radius:4px;padding:4px 8px;margin-top:6px">${r.Observaciones_Admin}</div>` : ''}
          ${r.Inicio_Real ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">▶ Inicio real: ${_fmtReservaTs(r.Inicio_Real)}</div>` : ''}
          ${r.Fin_Real    ? `<div style="font-size:11px;color:var(--text-muted)">■ Fin real: ${_fmtReservaTs(r.Fin_Real)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          ${_estadoBadgeR(r.Estado)}
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            ${puedeIniciar   ? `<button class="btn btn-sm btn-primary"   onclick="iniciarUso('${r.ID_Reserva}')">▶ Iniciar uso</button>` : ''}
            ${puedeFinalizar ? `<button class="btn btn-sm btn-primary"   onclick="finalizarUso('${r.ID_Reserva}')">■ Finalizar</button>` : ''}
            ${puedeCancelar  ? `<button class="btn btn-sm btn-secondary" onclick="cancelarReserva('${r.ID_Reserva}')">Cancelar</button>` : ''}
            ${esGestor && ['Pendiente','En conflicto'].includes(r.Estado) ? `<button class="btn btn-sm btn-secondary" onclick="openModalGestionReserva('${r.ID_Reserva}')">Gestionar</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  };

  let html = '';
  if (activas.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">En uso ahora</div>${activas.map(renderCard).join('')}`;
  }
  if (proximas.length) {
    html += `<div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin:${activas.length?'20px':'0'} 0 8px">Próximas</div>${proximas.map(renderCard).join('')}`;
  }
  if (pasadas.length) {
    html += `<details style="margin-top:20px">
      <summary style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;cursor:pointer">Historial (${pasadas.length})</summary>
      <div style="margin-top:8px">${pasadas.map(renderCard).join('')}</div>
    </details>`;
  }
  return html;
}

// ── Tab: Gestión ──────────────────────────────────────────────

function _renderTabGestion() {
  const pendientes = DATA.reservas.filter(r => r.Estado === 'Pendiente');
  const conflicto  = DATA.reservas.filter(r => r.Estado === 'En conflicto');
  const activas    = DATA.reservas.filter(r => ['Confirmada','Activa'].includes(r.Estado));

  const renderFila = r => {
    const eq = DATA.equipos.find(e => e.ID_Activo === r.ID_Equipo);
    const conds = _condLabel(r.Condiciones);
    return `<tr>
      <td><strong>${r.ID_Equipo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${eq?.Tipo_Equipo||''}</span></td>
      <td style="font-size:12px">${r.Usuario}</td>
      <td style="font-size:12px;white-space:nowrap">${_fmtReservaTs(r.Fecha_Inicio)}<br><span style="color:var(--text-muted)">hasta ${_fmtHoraR(r.Fecha_Fin)}</span></td>
      <td style="font-size:12px">${r.Proposito||'—'}<br><span style="color:var(--text-muted)">${conds}</span></td>
      <td>${_estadoBadgeR(r.Estado)}</td>
      <td onclick="event.stopPropagation()"><div class="row-actions">
        <button class="icon-btn" onclick="openModalGestionReserva('${r.ID_Reserva}')" title="Gestionar">⚙️</button>
      </div></td>
    </tr>`;
  };

  if (!pendientes.length && !conflicto.length && !activas.length)
    return `<div class="empty-state"><div class="empty-state-icon">✓</div><div class="empty-state-title">Sin reservas activas</div></div>`;

  const seccion = (titulo, lista) => {
    if (!lista.length) return '';
    return `<div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin:20px 0 8px">${titulo}</div>
    <div class="card" style="padding:0;overflow:hidden">
      <table><thead><tr><th>Equipo</th><th>Solicitante</th><th>Tramo</th><th>Propósito / Condiciones</th><th>Estado</th><th></th></tr></thead>
      <tbody>${lista.map(renderFila).join('')}</tbody></table>
    </div>`;
  };

  return seccion('Pendientes de revisión', pendientes)
    + seccion('En conflicto', conflicto)
    + seccion('Confirmadas / En uso', activas);
}

// ── Modal: Nueva reserva ──────────────────────────────────────

function openModalNuevaReserva(idEquipo = '') {
  _reservaEditandoId = null;

  const sel = document.getElementById('reserva-equipo');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar equipo…</option>' +
      DATA.configReservas.map(c => `<option value="${c.ID_Equipo}" ${c.ID_Equipo===idEquipo?'selected':''}>${_nombreEquipoReserva(c.ID_Equipo)}</option>`).join('');
    sel.value = idEquipo;
  }

  const hoy = new Date().toISOString().split('T')[0];
  sv('reserva-fecha', hoy);
  sv('reserva-fecha-fin', hoy);

  const ahora = new Date(); ahora.setMinutes(0,0,0); ahora.setHours(ahora.getHours()+1);
  sv('reserva-hora-inicio', ahora.toTimeString().slice(0,5));
  ahora.setHours(ahora.getHours()+2);
  sv('reserva-hora-fin', ahora.toTimeString().slice(0,5));
  sv('reserva-proposito', '');

  if (idEquipo) {
    _renderParamsReserva(idEquipo);
    _actualizarVerificacion();
  } else {
    const par = document.getElementById('reserva-params-container');
    const res = document.getElementById('reserva-disponibilidad-result');
    if (par) par.innerHTML = '';
    if (res) res.innerHTML = '';
  }

  document.getElementById('modal-reserva-title').textContent = 'Nueva reserva';
  openModal('modal-nueva-reserva');
}

function _onFechaInicioChange() {
  // Sincronizar fecha fin si es anterior
  const fi = v('reserva-fecha');
  const ff = v('reserva-fecha-fin');
  if (!ff || ff < fi) sv('reserva-fecha-fin', fi);
  _actualizarVerificacion();
}

function _onCambioEquipoReserva(idEquipo) {
  _renderParamsReserva(idEquipo);
  _actualizarVerificacion();
}

function _renderParamsReserva(idEquipo) {
  const el = document.getElementById('reserva-params-container');
  if (!el) return;
  const config = DATA.configReservas.find(c => c.ID_Equipo === idEquipo);
  if (!config || config.Politica === 'BLOCK') { el.innerHTML = ''; return; }

  let template; try { template = JSON.parse(config.Params_Template||'[]'); } catch { template = []; }
  if (!template.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div style="margin-top:12px;padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Condiciones requeridas</div>
      <div class="form-grid-2">
        ${template.map(p => `
          <div class="form-group">
            <label>${p.label}${p.type==='number'&&p.tolerance>0?`<span style="font-size:11px;font-weight:400;color:var(--text-muted)"> (tol. ±${p.tolerance})</span>`:''}</label>
            ${p.type==='number'
              ? `<input type="number" data-param-key="${p.key}" ${p.min!==undefined?`min="${p.min}"`:''}  ${p.max!==undefined?`max="${p.max}"`:''}  step="0.1" placeholder="${p.min??''}–${p.max??''}" oninput="_actualizarVerificacion()">`
              : `<input type="text" data-param-key="${p.key}" oninput="_actualizarVerificacion()">`}
          </div>`).join('')}
      </div>
    </div>`;
}

function _leerCondicionesModal() {
  const conds = {};
  document.querySelectorAll('#reserva-params-container [data-param-key]').forEach(inp => {
    const val = inp.value.trim();
    if (val !== '') conds[inp.dataset.paramKey] = inp.type === 'number' ? parseFloat(val) : val;
  });
  return conds;
}

function _actualizarVerificacion() {
  const idEquipo = v('reserva-equipo');
  const fecha    = v('reserva-fecha');
  const fechaFin = v('reserva-fecha-fin') || fecha;
  const hI       = v('reserva-hora-inicio');
  const hF       = v('reserva-hora-fin');
  const el = document.getElementById('reserva-disponibilidad-result');
  if (!el) return;

  if (!idEquipo || !fecha || !hI || !hF) { el.innerHTML = ''; return; }

  const inicio = `${fecha}T${hI}`;
  const fin    = `${fechaFin}T${hF}`;

  if (new Date(fin) <= new Date(inicio)) {
    el.innerHTML = _alertaR('error','La hora/fecha de fin debe ser posterior al inicio'); return;
  }

  const config = DATA.configReservas.find(c => c.ID_Equipo === idEquipo);
  if (config?.Max_Horas) {
    const durH = (new Date(fin) - new Date(inicio)) / 3600000;
    if (durH > parseFloat(config.Max_Horas)) {
      el.innerHTML = _alertaR('warning', `La duración supera el máximo configurado (${config.Max_Horas}h)`); return;
    }
  }
  if (config?.Antelacion_Min_Horas) {
    const minTime = new Date(Date.now() + parseFloat(config.Antelacion_Min_Horas) * 3600000);
    if (new Date(inicio) < minTime) {
      el.innerHTML = _alertaR('warning', `Se requieren ${config.Antelacion_Min_Horas}h de antelación mínima`); return;
    }
  }

  const condiciones = _leerCondicionesModal();
  const res = _verificarConflicto(idEquipo, inicio, fin, condiciones, _reservaEditandoId);

  el.innerHTML = res.ok
    ? _alertaR('success', res.compatible ? `✓ Disponible — ${res.mensaje}` : '✓ Disponible en ese tramo horario')
    : _alertaR('error', `✗ ${res.mensaje}`);
}

function _alertaR(type, msg) {
  const c = { success:['#f0fdf4','#86efac','#166534'], warning:['#fffbeb','#fcd34d','#92400e'], error:['#fef2f2','#fca5a5','#991b1b'] }[type];
  return `<div style="padding:8px 12px;border-radius:6px;font-size:13px;border:1px solid ${c[1]};background:${c[0]};color:${c[2]}">${msg}</div>`;
}

// ── Verificación de conflictos ─────────────────────────────────

function _verificarConflicto(idEquipo, inicioStr, finStr, condiciones, excludeId = null) {
  const config = DATA.configReservas.find(c => c.ID_Equipo === idEquipo);
  if (!config) return { ok: true };

  const solapadas = DATA.reservas.filter(r =>
    r.ID_Equipo === idEquipo &&
    r.ID_Reserva !== excludeId &&
    ['Pendiente','Confirmada','Activa'].includes(r.Estado) &&
    _solapan(r.Fecha_Inicio, r.Fecha_Fin, inicioStr, finStr)
  );
  if (!solapadas.length) return { ok: true };

  if (config.Politica === 'BLOCK') {
    const otra = solapadas[0];
    return { ok:false, tipo:'bloqueo', mensaje:`Ocupado — ${otra.Usuario.split('@')[0]} · ${_fmtHoraR(otra.Fecha_Inicio)}–${_fmtHoraR(otra.Fecha_Fin)} (${otra.Estado})` };
  }

  let template; try { template = JSON.parse(config.Params_Template||'[]'); } catch { template = []; }

  for (const reserva of solapadas) {
    let condExist; try { condExist = JSON.parse(reserva.Condiciones||'{}'); } catch { condExist = {}; }
    for (const param of template) {
      const v1 = condiciones[param.key];
      const v2 = condExist[param.key];
      if (v1 === undefined || v1 === '' || v2 === undefined || v2 === '') continue;
      if (param.type === 'number') {
        if (Math.abs(parseFloat(v1) - parseFloat(v2)) > (param.tolerance ?? 0)) {
          return { ok:false, tipo:'condiciones', mensaje:`Incompatible en "${param.label}": ${reserva.Usuario.split('@')[0]} requiere ${v2}, tú solicitas ${v1}` };
        }
      } else {
        if (String(v1).toLowerCase() !== String(v2).toLowerCase()) {
          return { ok:false, tipo:'condiciones', mensaje:`Incompatible en "${param.label}": ${reserva.Usuario.split('@')[0]} requiere "${v2}", tú solicitas "${v1}"` };
        }
      }
    }
  }

  const usuarios = [...new Set(solapadas.map(r => r.Usuario.split('@')[0]))].join(', ');
  return { ok:true, compatible:true, mensaje:`Condiciones compatibles con ${solapadas.length} reserva${solapadas.length>1?'s':''} de ${usuarios}` };
}

// ── Guardar reserva ───────────────────────────────────────────

async function guardarReserva() {
  const idEquipo  = v('reserva-equipo');
  const fecha     = v('reserva-fecha');
  const fechaFin  = v('reserva-fecha-fin') || fecha;
  const hI        = v('reserva-hora-inicio');
  const hF        = v('reserva-hora-fin');
  const proposito = v('reserva-proposito');

  if (!idEquipo || !fecha || !hI || !hF || !proposito) {
    showToast('Completa todos los campos obligatorios', 'error'); return;
  }

  const inicio = `${fecha}T${hI}`;
  const fin    = `${fechaFin}T${hF}`;

  if (new Date(fin) <= new Date(inicio)) {
    showToast('La hora/fecha de fin debe ser posterior al inicio', 'error'); return;
  }

  const condiciones = _leerCondicionesModal();

  showLoading('Guardando reserva…');
  try {
    const { reserva, conflicto } = await callEdgeFunction('gestionar-reserva', {
      accion: 'crear', id_equipo: idEquipo, fecha_inicio: inicio, fecha_fin: fin,
      condiciones, proposito,
    });
    DATA.reservas.push(_reservaSbToObj(reserva));
    closeModal('modal-nueva-reserva');
    renderReservas();
    _updateBadgeReservas();
    if (!conflicto) {
      showToast('Reserva confirmada', 'success');
    } else {
      showToast(`Reserva registrada — pendiente de revisión por conflicto: ${conflicto}`, 'warning');
    }
  } catch(e) {
    showToast('Error al guardar la reserva', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Acciones sobre el estado ──────────────────────────────────

async function cancelarReserva(idReserva) {
  if (!confirm('¿Cancelar esta reserva?')) return;
  await _cambiarEstadoReserva('cancelar', idReserva, 'Reserva cancelada');
}

async function iniciarUso(idReserva) {
  await _cambiarEstadoReserva('iniciar_uso', idReserva, 'Uso iniciado');
}

async function finalizarUso(idReserva) {
  await _cambiarEstadoReserva('finalizar_uso', idReserva, 'Uso finalizado');
}

// ── Modal: Gestión ────────────────────────────────────────────

function openModalGestionReserva(idReserva) {
  _gestionReservaId = idReserva;
  const r = DATA.reservas.find(x => x.ID_Reserva === idReserva);
  if (!r) return;
  const eq = DATA.equipos.find(e => e.ID_Activo === r.ID_Equipo);
  const conds = _condLabel(r.Condiciones);
  const el = document.getElementById('modal-gestion-detalle');
  if (el) el.innerHTML = `
    <div style="background:var(--surface2);border-radius:8px;padding:12px 16px;font-size:13px;display:flex;flex-direction:column;gap:6px">
      <div><strong>${eq?.Tipo_Equipo||r.ID_Equipo}</strong> <span style="color:var(--text-muted);font-size:12px">${r.ID_Equipo}</span></div>
      <div style="color:var(--text-muted)">${_fmtReservaTs(r.Fecha_Inicio)} → ${_fmtHoraR(r.Fecha_Fin)}</div>
      <div>👤 ${r.Usuario}</div>
      ${r.Proposito?`<div>${r.Proposito}</div>`:''}
      ${conds?`<div style="color:var(--text-muted)">Condiciones: ${conds}</div>`:''}
    </div>`;
  sv('gestion-obs', '');
  openModal('modal-gestion-reserva');
}

async function _accionGestion(accion) {
  if (!_gestionReservaId) return;
  const obs = v('gestion-obs');
  if (accion === 'rechazar' && !obs) { showToast('Indica el motivo del rechazo', 'error'); return; }
  const msgs = { aprobar:'Reserva aprobada', rechazar:'Reserva rechazada', conflicto:'Marcada en conflicto' };
  showLoading('Actualizando…');
  try {
    const { reserva } = await callEdgeFunction('gestionar-reserva', { accion: 'gestionar', id_reserva: _gestionReservaId, resultado: accion, observaciones: obs });
    const idx = DATA.reservas.findIndex(r => r.ID_Reserva === _gestionReservaId);
    if (idx !== -1) DATA.reservas[idx] = _reservaSbToObj(reserva);
    showToast(msgs[accion] || 'Estado actualizado', 'success');
    closeModal('modal-gestion-reserva');
    renderReservas();
    _updateBadgeReservas();
  } catch(e) {
    showToast('Error al actualizar la reserva', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Cancelar / iniciar / finalizar (dueño de la reserva) ───────

async function _cambiarEstadoReserva(accionApi, idReserva, mensajeOk) {
  showLoading('Actualizando…');
  try {
    const { reserva } = await callEdgeFunction('gestionar-reserva', { accion: accionApi, id_reserva: idReserva });
    const idx = DATA.reservas.findIndex(r => r.ID_Reserva === idReserva);
    if (idx !== -1) DATA.reservas[idx] = _reservaSbToObj(reserva);
    showToast(mensajeOk, 'success');
    renderReservas();
    _updateBadgeReservas();
  } catch(e) {
    showToast('Error al actualizar la reserva', 'error'); console.error(e);
  } finally { hideLoading(); }
}

// ── Modal: Configurar equipo ──────────────────────────────────

function openModalConfigEquipo(idEquipo = '') {
  _cfgParamsTemp = [];
  const sel = document.getElementById('cfg-equipo');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar equipo…</option>' +
      DATA.equipos.map(e => `<option value="${e.ID_Activo}" ${e.ID_Activo===idEquipo?'selected':''}>${e.ID_Activo} — ${e.Tipo_Equipo}</option>`).join('');
    sel.value = idEquipo;
    if (idEquipo) _onCfgEquipoCambio(idEquipo);
    else {
      sv('cfg-politica','BLOCK'); sv('cfg-max-horas',''); sv('cfg-antelacion','');
      _renderCfgParams();
    }
  }
  openModal('modal-config-equipo-reserva');
}

function _onCfgEquipoCambio(idEquipo) {
  const config = DATA.configReservas.find(c => c.ID_Equipo === idEquipo);
  if (config) {
    sv('cfg-politica', config.Politica || 'BLOCK');
    sv('cfg-max-horas', config.Max_Horas || '');
    sv('cfg-antelacion', config.Antelacion_Min_Horas || '');
    try { _cfgParamsTemp = JSON.parse(config.Params_Template || '[]'); } catch { _cfgParamsTemp = []; }
  } else {
    sv('cfg-politica','BLOCK'); sv('cfg-max-horas',''); sv('cfg-antelacion','');
    _cfgParamsTemp = [];
  }
  _renderCfgParams();
}

function _renderCfgParams() {
  const el = document.getElementById('cfg-params-rows');
  const empty = document.getElementById('cfg-params-empty');
  if (!el) return;
  if (!_cfgParamsTemp.length) { el.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  el.innerHTML = _cfgParamsTemp.map((p, i) => `
    <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;background:var(--surface2);padding:8px;border-radius:6px;border:1px solid var(--border)">
      <div class="form-group" style="flex:2;min-width:120px;margin:0">
        <label style="font-size:11px">Etiqueta</label>
        <input type="text" value="${p.label||''}" oninput="_cfgParamsTemp[${i}].label=this.value;_cfgAutoKey(${i})">
      </div>
      <div class="form-group" style="flex:1;min-width:80px;margin:0">
        <label style="font-size:11px">Tipo</label>
        <select onchange="_cfgParamsTemp[${i}].type=this.value;_renderCfgParams()">
          <option value="number" ${p.type==='number'?'selected':''}>Número</option>
          <option value="text"   ${p.type==='text'  ?'selected':''}>Texto</option>
        </select>
      </div>
      ${p.type==='number' ? `
        <div class="form-group" style="width:60px;margin:0"><label style="font-size:11px">Mín</label><input type="number" value="${p.min??''}" oninput="_cfgParamsTemp[${i}].min=this.value===''?undefined:+this.value"></div>
        <div class="form-group" style="width:60px;margin:0"><label style="font-size:11px">Máx</label><input type="number" value="${p.max??''}" oninput="_cfgParamsTemp[${i}].max=this.value===''?undefined:+this.value"></div>
        <div class="form-group" style="width:75px;margin:0"><label style="font-size:11px">Tolerancia</label><input type="number" min="0" step="0.1" value="${p.tolerance??0}" oninput="_cfgParamsTemp[${i}].tolerance=+this.value"></div>
      ` : ''}
      <button class="icon-btn" style="margin-bottom:2px" onclick="_cfgParamsTemp.splice(${i},1);_renderCfgParams()" title="Eliminar parámetro">🗑️</button>
    </div>`).join('');
}

function _cfgAutoKey(i) {
  const label = _cfgParamsTemp[i]?.label || '';
  _cfgParamsTemp[i].key = label.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
}

function _addParamRow() {
  _cfgParamsTemp.push({ key:'', label:'', type:'number', min:undefined, max:undefined, tolerance:0 });
  _renderCfgParams();
}

async function guardarConfigEquipo() {
  const idEquipo = v('cfg-equipo');
  if (!idEquipo) { showToast('Selecciona un equipo', 'error'); return; }
  _cfgParamsTemp.forEach((_,i) => { if (!_cfgParamsTemp[i].key) _cfgAutoKey(i); });

  showLoading('Guardando…');
  try {
    const { config } = await callEdgeFunction('gestionar-reserva', {
      accion: 'config_equipo', id_equipo: idEquipo, politica: v('cfg-politica') || 'BLOCK',
      params_template: _cfgParamsTemp, max_horas: v('cfg-max-horas') || '', antelacion_min_horas: v('cfg-antelacion') || '',
    });
    const existeIdx = DATA.configReservas.findIndex(c => c.ID_Equipo === idEquipo);
    if (existeIdx >= 0) DATA.configReservas[existeIdx] = _configReservaSbToObj(config);
    else DATA.configReservas.push(_configReservaSbToObj(config));
    closeModal('modal-config-equipo-reserva');
    renderReservas();
    showToast('Configuración guardada', 'success');
  } catch(e) {
    showToast('Error al guardar', 'error'); console.error(e);
  } finally { hideLoading(); }
}
