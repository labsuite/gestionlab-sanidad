// ============================================================
// MANTENIMIENTO PREVENTIVO
// ============================================================

// --- Curso académico ---
function getCursoAcademico(date = new Date()) {
  const mes = date.getMonth() + 1;
  const año = date.getFullYear();
  return mes >= 9 ? `${año}-${año + 1}` : `${año - 1}-${año}`;
}

function getMesesCurso(cursoAcademico) {
  const [añoInicio, añoFin] = cursoAcademico.split('-').map(Number);
  const meses = [];
  for (let m = 9; m <= 12; m++)
    meses.push({ año: añoInicio, mes: m, str: `${añoInicio}-${String(m).padStart(2, '0')}` });
  for (let m = 1; m <= 8; m++)
    meses.push({ año: añoFin, mes: m, str: `${añoFin}-${String(m).padStart(2, '0')}` });
  return meses;
}

function getPeriodosEsperados(plan, equipo, cursoAcademico) {
  const [añoInicio, añoFin] = cursoAcademico.split('-').map(Number);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const todosMeses = getMesesCurso(cursoAcademico);
  const mesesPasados = todosMeses.filter(({ año, mes }) => new Date(año, mes - 1, 1) <= hoy);

  switch (plan.Periodicidad) {
    case 'Mensual':
      return mesesPasados.map(m => m.str);
    case 'Trimestral':
      return mesesPasados.filter((_, i) => i % 3 === 0).map(m => m.str);
    case 'Semestral':
      return mesesPasados.filter((_, i) => i % 6 === 0).map(m => m.str);
    case 'Anual':
    case 'Bianual':
    case 'Cada 2 años':
      return mesesPasados.length > 0 ? [todosMeses[0].str] : [];
    case 'Pretemporada': {
      const mesInicio = parseInt(equipo.Mes_Inicio_Temporada) || 9;
      const dueYear = mesInicio >= 9 ? añoInicio : añoFin;
      const dueDate = new Date(dueYear, mesInicio - 1, 1);
      return hoy >= dueDate ? [`pretemporada-${cursoAcademico}`] : [];
    }
    case 'Posttemporada': {
      const mesFin = parseInt(equipo.Mes_Fin_Temporada) || 5;
      const dueYear = mesFin >= 9 ? añoInicio : añoFin;
      const dueDate = new Date(dueYear, mesFin - 1, 1);
      return hoy >= dueDate ? [`posttemporada-${cursoAcademico}`] : [];
    }
    default:
      return [];
  }
}

function getRegistroMant(idPlan, cursoAcademico, periodo) {
  return DATA.registroMantenimientos.find(r =>
    r.ID_Plan === idPlan && r.Curso_Academico === cursoAcademico && r.Periodo === periodo
  );
}

function getPlanStatusParaEquipo(equipoId) {
  const equipo = DATA.equipos.find(e => e.ID_Activo === equipoId);
  if (!equipo) return [];
  const curso = getCursoAcademico();
  const planes = DATA.planesMantenimiento.filter(
    p => p.ID_Equipo === equipoId && p.Activo !== 'FALSE'
  );
  const resultado = [];
  for (const plan of planes) {
    const periodos = getPeriodosEsperados(plan, equipo, curso);
    for (const periodo of periodos) {
      const reg = getRegistroMant(plan.ID_Plan, curso, periodo);
      resultado.push({ plan, periodo, curso, hecho: !!reg, registro: reg || null });
    }
  }
  return resultado;
}

function labelPeriodo(periodo) {
  if (periodo.startsWith('pretemporada')) return 'Pre-temporada';
  if (periodo.startsWith('posttemporada')) return 'Post-temporada';
  const [y, m] = periodo.split('-');
  try {
    return new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  } catch { return periodo; }
}

// ============================================================
// SECCIÓN DE MANTENIMIENTO EN LA TARJETA DEL EQUIPO
// ============================================================
function buildMantenimientoEquipo(equipoId) {
  const equipo = DATA.equipos.find(e => e.ID_Activo === equipoId);
  if (!equipo) return '';

  const canEdit = puedeHacer('editarEquipos') ||
    (getUserRole() === 'Profesor' && esResponsableDeEquipo(equipo));
  const canLog  = puedeHacer('crearIntervenciones') ||
    (getUserRole() === 'Profesor' && esResponsableDeEquipo(equipo));

  const secciones = [];

  // Protocolo de uso
  if (equipo.Protocolo_Uso) {
    secciones.push(`
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">
          Protocolo de uso
        </div>
        <div style="font-size:12px;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;white-space:pre-line;line-height:1.5">${equipo.Protocolo_Uso}</div>
      </div>`);
  }

  // Planes de mantenimiento
  const planes = DATA.planesMantenimiento.filter(p => p.ID_Equipo === equipoId && p.Activo !== 'FALSE');
  if (!planes.length) {
    if (canEdit) {
      secciones.push(`
        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Plan de mantenimiento</div>
          <div style="font-size:12px;color:var(--text-muted);padding:8px 0">Sin planes configurados.
            <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;margin-left:8px"
              onclick="event.stopPropagation();openModalPlan('${equipoId.replace(/'/g, "\\'")}')">+ Añadir plan</button>
          </div>
        </div>`);
    }
  } else {
    const curso = getCursoAcademico();
    const statusList = getPlanStatusParaEquipo(equipoId);
    const pendientes = statusList.filter(s => !s.hecho);
    const hechos     = statusList.filter(s => s.hecho);

    secciones.push(`
      <div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">
            Plan de mantenimiento · Curso ${curso}
            <span style="font-weight:400;text-transform:none;margin-left:6px">
              ${hechos.length}/${statusList.length} completados
            </span>
          </div>
          ${canEdit ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px"
            onclick="event.stopPropagation();openModalPlan('${equipoId.replace(/'/g, "\\'")}')">+ Plan</button>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${planes.map(plan => {
            const periodos = getPeriodosEsperados(plan, equipo, curso);
            if (!periodos.length) {
              return `<div class="mant-plan-row" style="opacity:.6">
                <span class="badge badge-gray" style="font-size:10px;min-width:80px">${plan.Tipo_Intervencion||'—'}</span>
                <span style="font-size:11px;font-weight:500;flex:1">${plan.Periodicidad}</span>
                <span style="font-size:11px;color:var(--text-muted);flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</span>
                <span class="badge badge-gray" style="font-size:10px">No aplica aún</span>
              </div>`;
            }
            return periodos.map(periodo => {
              const reg = getRegistroMant(plan.ID_Plan, curso, periodo);
              const hecho = !!reg;
              const badge = hecho
                ? `<span class="badge badge-green" style="font-size:10px">✓ ${formatDate(reg.Fecha_Realizacion)||'Hecho'}</span>`
                : (canLog
                  ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;white-space:nowrap"
                      onclick="event.stopPropagation();openModalRegistrarMant('${plan.ID_Plan}','${equipoId.replace(/'/g,"\\'")}','${periodo}','${curso}')">Registrar</button>`
                  : `<span class="badge badge-orange" style="font-size:10px">Pendiente</span>`);
              const tipoBadge = plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
              return `<div class="mant-plan-row">
                <span class="badge ${tipoBadge}" style="font-size:10px;min-width:60px">${plan.Tipo_Intervencion||'—'}</span>
                <span style="font-size:11px;font-weight:500;min-width:90px">${plan.Periodicidad} · ${labelPeriodo(periodo)}</span>
                <span style="font-size:11px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</span>
                ${badge}
              </div>`;
            }).join('');
          }).join('')}
        </div>
      </div>`);
  }

  return secciones.join('');
}

// ============================================================
// MODAL REGISTRAR MANTENIMIENTO
// ============================================================
function openModalRegistrarMant(idPlan, idEquipo, periodo, curso) {
  const plan   = DATA.planesMantenimiento.find(p => p.ID_Plan === idPlan);
  const equipo = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  if (!plan || !equipo) return;

  const nombreEquipo = `${equipo.ID_Activo} – ${equipo.Tipo_Equipo || ''} ${equipo.Marca || ''}`.trim();
  document.getElementById('mant-info-plan').innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:12px;line-height:1.6">
      <div><strong>Equipo:</strong> ${nombreEquipo}</div>
      <div><strong>Operación:</strong> ${plan.Operacion}</div>
      <div><strong>Tipo:</strong> ${plan.Tipo_Intervencion} · ${plan.Periodicidad} · ${labelPeriodo(periodo)}</div>
    </div>`;

  document.getElementById('mant-id-plan').value    = idPlan;
  document.getElementById('mant-id-equipo').value  = idEquipo;
  document.getElementById('mant-periodo').value     = periodo;
  document.getElementById('mant-curso').value       = curso;

  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('mant-fecha').value = hoy;

  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  document.getElementById('mant-realizado-por').value = u?.Nombre || currentUser?.name || '';
  document.getElementById('mant-supervisado-por').value = '';
  document.getElementById('mant-observaciones').value   = '';

  openModal('modal-registrar-mant');
}

async function guardarRegistroMant() {
  const idPlan    = document.getElementById('mant-id-plan').value;
  const idEquipo  = document.getElementById('mant-id-equipo').value;
  const periodo   = document.getElementById('mant-periodo').value;
  const curso     = document.getElementById('mant-curso').value;
  const fecha     = document.getElementById('mant-fecha').value;
  const quien     = document.getElementById('mant-realizado-por').value.trim();

  if (!fecha) { showToast('Indica la fecha de realización', 'error'); return; }
  if (!quien) { showToast('Indica quién realizó el mantenimiento', 'error'); return; }

  const id  = genId('RM');
  const row = [id, idPlan, idEquipo, curso, periodo, fecha, quien,
    document.getElementById('mant-supervisado-por').value.trim(),
    document.getElementById('mant-observaciones').value.trim()];

  showLoading('Guardando...');
  try {
    await sheetsAppend('Registro_Mantenimientos', row);
    DATA.registroMantenimientos.push(rowToObj(row, 'registroMantenimientos'));
    closeModal('modal-registrar-mant');
    showToast('Mantenimiento registrado', 'success');
    renderEquipos();
    if (document.getElementById('page-mantenimiento').classList.contains('active')) {
      renderMantenimiento();
    }
  } catch (e) {
    showToast('Error guardando el registro', 'error');
    console.error(e);
  }
  hideLoading();
}

// ============================================================
// MODAL GESTIONAR PLANES (Admin/Gestor)
// ============================================================
let _planEditingId = null;
let _planEditingEquipoId = null;

function openModalPlan(equipoId, idPlan = null) {
  _planEditingEquipoId = equipoId;
  _planEditingId = idPlan;

  const equipo = DATA.equipos.find(e => e.ID_Activo === equipoId);
  const titulo = equipo ? `${equipo.ID_Activo} – ${equipo.Tipo_Equipo || ''} ${equipo.Marca || ''}`.trim() : equipoId;
  document.getElementById('modal-plan-equipo-nombre').textContent = titulo;

  if (idPlan) {
    const plan = DATA.planesMantenimiento.find(p => p.ID_Plan === idPlan);
    if (plan) {
      document.getElementById('plan-tipo-int').value    = plan.Tipo_Intervencion;
      document.getElementById('plan-periodicidad').value = plan.Periodicidad;
      document.getElementById('plan-operacion').value   = plan.Operacion;
    }
  } else {
    document.getElementById('plan-tipo-int').value    = 'Interno';
    document.getElementById('plan-periodicidad').value = 'Anual';
    document.getElementById('plan-operacion').value   = '';
  }
  openModal('modal-gestionar-plan');
}

async function guardarPlan() {
  const tipo      = document.getElementById('plan-tipo-int').value;
  const period    = document.getElementById('plan-periodicidad').value;
  const operacion = document.getElementById('plan-operacion').value.trim();
  if (!operacion) { showToast('Describe la operación a realizar', 'error'); return; }

  showLoading('Guardando...');
  try {
    if (_planEditingId) {
      // Update existing
      const idx = DATA.planesMantenimiento.findIndex(p => p.ID_Plan === _planEditingId);
      if (idx !== -1) {
        const row = [_planEditingId, _planEditingEquipoId, tipo, period, operacion, 'TRUE'];
        await sheetsUpdate(`Planes_Mantenimiento!A${idx + 2}:F${idx + 2}`, row);
        DATA.planesMantenimiento[idx] = rowToObj(row, 'planesMantenimiento');
      }
    } else {
      const id  = genId('PM');
      const row = [id, _planEditingEquipoId, tipo, period, operacion, 'TRUE'];
      await sheetsAppend('Planes_Mantenimiento', row);
      DATA.planesMantenimiento.push(rowToObj(row, 'planesMantenimiento'));
    }
    closeModal('modal-gestionar-plan');
    showToast('Plan guardado', 'success');
    renderEquipos();
    if (document.getElementById('page-mantenimiento').classList.contains('active')) {
      renderMantenimiento();
    }
  } catch (e) {
    showToast('Error guardando el plan', 'error');
    console.error(e);
  }
  hideLoading();
}

async function eliminarPlan(idPlan) {
  if (!confirm('¿Eliminar este plan de mantenimiento?')) return;
  const idx = DATA.planesMantenimiento.findIndex(p => p.ID_Plan === idPlan);
  if (idx === -1) return;
  showLoading('Eliminando...');
  try {
    await sheetsDeleteRow('Planes_Mantenimiento', idx);
    DATA.planesMantenimiento.splice(idx, 1);
    showToast('Plan eliminado', 'success');
    renderMantenimiento();
  } catch (e) {
    showToast('Error eliminando el plan', 'error');
    console.error(e);
  }
  hideLoading();
}

// ============================================================
// PÁGINA DE MANTENIMIENTO
// ============================================================
function renderMantenimiento() {
  const container = document.getElementById('mantenimiento-contenido');
  if (!container) return;

  const curso = getCursoAcademico();
  const canEdit = puedeHacer('editarEquipos');
  const canLog  = puedeHacer('crearIntervenciones');

  // Calcular todos los status del curso actual
  const todoStatus = [];
  DATA.equipos.forEach(eq => {
    const planes = DATA.planesMantenimiento.filter(p => p.ID_Equipo === eq.ID_Activo && p.Activo !== 'FALSE');
    planes.forEach(plan => {
      const periodos = getPeriodosEsperados(plan, eq, curso);
      periodos.forEach(periodo => {
        const reg = getRegistroMant(plan.ID_Plan, curso, periodo);
        todoStatus.push({ equipo: eq, plan, periodo, curso, hecho: !!reg, registro: reg || null });
      });
    });
  });

  const total     = todoStatus.length;
  const hechos    = todoStatus.filter(s => s.hecho).length;
  const pendientes= total - hechos;
  const pct       = total > 0 ? Math.round(hechos / total * 100) : 0;

  const pendientesList = todoStatus.filter(s => !s.hecho);

  container.innerHTML = `
    <!-- Resumen -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-value">${pct}%</div><div class="stat-label">Completado curso ${curso}</div></div>
      <div class="stat-card"><div class="stat-value">${hechos}</div><div class="stat-label">Realizados</div></div>
      <div class="stat-card"><div class="stat-value" style="color:${pendientes>0?'var(--danger)':'var(--success)'}">${pendientes}</div><div class="stat-label">Pendientes</div></div>
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total esperados</div></div>
    </div>

    <!-- Acciones -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <button class="btn btn-secondary" onclick="exportarModeloCalidad('${curso}')">📄 Exportar modelo de calidad ${curso}</button>
    </div>

    <!-- Pendientes -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">Mantenimientos pendientes — Curso ${curso}</div>
      </div>
      ${pendientesList.length === 0
        ? `<div style="padding:20px;text-align:center;color:var(--text-muted)">✅ Sin mantenimientos pendientes por el momento.</div>`
        : `<table>
            <thead><tr>
              <th>Equipo</th><th>Tipo</th><th>Periodicidad</th><th>Período</th><th>Operación</th><th></th>
            </tr></thead>
            <tbody>${pendientesList.map(s => {
              const tipoBadge = s.plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
              return `<tr>
                <td><strong>${s.equipo.ID_Activo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${s.equipo.Tipo_Equipo||''} ${s.equipo.Marca||''}</span></td>
                <td><span class="badge ${tipoBadge}" style="font-size:10px">${s.plan.Tipo_Intervencion}</span></td>
                <td>${s.plan.Periodicidad}</td>
                <td>${labelPeriodo(s.periodo)}</td>
                <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.plan.Operacion}">${s.plan.Operacion}</td>
                <td>${canLog
                  ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px"
                      onclick="openModalRegistrarMant('${s.plan.ID_Plan}','${s.equipo.ID_Activo}','${s.periodo}','${s.curso}')">Registrar</button>`
                  : ''}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>`}
    </div>

    <!-- Todos los planes (Admin/Gestor) -->
    ${canEdit ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Planes de mantenimiento configurados</div>
        <div class="card-actions">
          <div class="search-input">
            <span>🔍</span>
            <input type="text" placeholder="Buscar equipo..." oninput="filtrarPlanesTabla(this.value)" id="filter-planes">
          </div>
        </div>
      </div>
      <table id="tabla-planes-mant">
        <thead><tr>
          <th>Equipo</th><th>Tipo</th><th>Periodicidad</th><th>Operación</th><th></th>
        </tr></thead>
        <tbody>${_renderFilasPlanesTabla()}</tbody>
      </table>
    </div>` : ''}`;
}

function _renderFilasPlanesTabla(filtro = '') {
  const canEdit = puedeHacer('editarEquipos');
  return DATA.planesMantenimiento.map(plan => {
    const eq = DATA.equipos.find(e => e.ID_Activo === plan.ID_Equipo);
    const label = eq ? `${eq.ID_Activo} – ${eq.Tipo_Equipo || ''} ${eq.Marca || ''}`.trim() : plan.ID_Equipo;
    if (filtro && !label.toLowerCase().includes(filtro.toLowerCase()) &&
        !plan.Operacion.toLowerCase().includes(filtro.toLowerCase())) return '';
    const tipoBadge = plan.Tipo_Intervencion === 'Externo' ? 'badge-blue' : 'badge-gray';
    return `<tr>
      <td><strong>${label}</strong></td>
      <td><span class="badge ${tipoBadge}" style="font-size:10px">${plan.Tipo_Intervencion}</span></td>
      <td>${plan.Periodicidad}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</td>
      <td style="white-space:nowrap">
        ${canEdit ? `<button class="icon-btn" onclick="openModalPlan('${plan.ID_Equipo}','${plan.ID_Plan}')" title="Editar">✏️</button>
          <button class="icon-btn" onclick="eliminarPlan('${plan.ID_Plan}')" title="Eliminar">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function filtrarPlanesTabla(val) {
  const tbody = document.querySelector('#tabla-planes-mant tbody');
  if (tbody) tbody.innerHTML = _renderFilasPlanesTabla(val);
}

// ============================================================
// EXPORTAR MODELO DE CALIDAD
// ============================================================
function exportarModeloCalidad(cursoAcademico) {
  const curso = cursoAcademico || getCursoAcademico();
  const [añoInicio, añoFin] = curso.split('-').map(Number);

  const registros = DATA.registroMantenimientos.filter(r => r.Curso_Academico === curso);
  const planes    = DATA.planesMantenimiento.filter(p => p.Activo !== 'FALSE');
  const total     = planes.reduce((acc, plan) => {
    const eq = DATA.equipos.find(e => e.ID_Activo === plan.ID_Equipo);
    return acc + (eq ? getPeriodosEsperados(plan, eq, curso).length : 0);
  }, 0);
  const realizados = registros.length;
  const pct = total > 0 ? ((realizados / total) * 100).toFixed(0) : 0;

  // Agrupar por laboratorio
  const porLab = {};
  planes.forEach(plan => {
    const eq = DATA.equipos.find(e => e.ID_Activo === plan.ID_Equipo);
    if (!eq) return;
    const lab = eq.Ubicacion || 'Sin ubicación';
    if (!porLab[lab]) porLab[lab] = [];
    const periodos = getPeriodosEsperados(plan, eq, curso);
    const labPeriodoItems = periodos.map(periodo => {
      const reg = registros.find(r => r.ID_Plan === plan.ID_Plan && r.Periodo === periodo);
      return { eq, plan, periodo, reg };
    });
    if (!periodos.length) {
      porLab[lab].push({ eq, plan, periodo: null, reg: null });
    } else {
      labPeriodoItems.forEach(item => porLab[lab].push(item));
    }
  });

  const filasPorLab = Object.entries(porLab).sort(([a], [b]) => a.localeCompare(b)).map(([lab, items]) => {
    const filas = items.map(({ eq, plan, periodo, reg }) => `
      <tr>
        <td>${eq.Tipo_Equipo || ''} ${eq.Marca || ''} ${eq.Modelo || ''}</td>
        <td>${lab}</td>
        <td>${eq.Responsable || ''}</td>
        <td>${plan.Tipo_Intervencion || ''}</td>
        <td>${plan.Periodicidad || ''}${periodo ? ' · ' + labelPeriodo(periodo) : ''}</td>
        <td style="max-width:300px">${plan.Operacion || ''}</td>
        <td>${periodo ? labelPeriodo(periodo) : ''}</td>
        <td>${reg ? formatDate(reg.Fecha_Realizacion) : ''}</td>
        <td>${reg ? (reg.Supervisado_Por || reg.Realizado_Por || '') : ''}</td>
        <td>${reg ? (reg.Observaciones || '') : ''}</td>
      </tr>`).join('');
    return `<tr style="background:#f0f4ff"><td colspan="10"><strong>${lab}</strong></td></tr>${filas}`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Plan de Mantemento Preventivo – ${curso} – CIFP Manuel Antonio</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #222; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  h2 { font-size: 13px; color: #444; margin-top: 0; }
  .stats { display: flex; gap: 30px; margin: 12px 0; font-size: 12px; }
  .stat-item strong { display: block; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #2b4c9b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { border: 1px solid #ddd; padding: 5px 7px; vertical-align: top; }
  tr:nth-child(even) { background: #f9f9f9; }
  .purpose { font-size: 10px; color: #555; border: 1px solid #ddd; padding: 8px; margin: 10px 0; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>Plan de Mantemento Preventivo</h1>
<h2>CIFP Manuel Antonio · Vigo · Curso ${curso}</h2>
<div class="purpose">
  <strong>Serve para:</strong> Definir as instalacións, equipos e servizos de apoio sometidos ao procedemento de mantemento.
  Designar responsables específicos. Determinar as frecuencias de control.<br>
  <em>No caso do mantemento externalizado, o Responsable de mantemento limítase a xestionar a tarefa.</em>
</div>
<div class="stats">
  <div class="stat-item"><strong>${pct}%</strong>% realizado</div>
  <div class="stat-item"><strong>${total}</strong>Total mantenementos</div>
  <div class="stat-item"><strong>${realizados}</strong>Realizados</div>
  <div class="stat-item"><strong>${total - realizados}</strong>Pendentes</div>
</div>
<table>
  <thead><tr>
    <th>Denominación (instalación, equipo)</th>
    <th>Ubicación</th>
    <th>Responsable</th>
    <th>Mant. Interno/Externo</th>
    <th>Periodicidade</th>
    <th>Operación a realizar</th>
    <th>Data prevista</th>
    <th>Data realización</th>
    <th>Supervisado por</th>
    <th>Observacións</th>
  </tr></thead>
  <tbody>${filasPorLab}</tbody>
</table>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  } else {
    showToast('Activa las ventanas emergentes para exportar', 'error');
  }
}
