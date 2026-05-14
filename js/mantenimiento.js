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
              const instrKey = `${plan.ID_Plan}-${periodo}`.replace(/[^a-z0-9]/gi,'_');
              const instrBtn = plan.Instrucciones
                ? `<button class="btn btn-secondary" style="padding:2px 6px;font-size:11px" title="Ver instrucciones"
                    onclick="event.stopPropagation();toggleMantInstr('${instrKey}')">▸ Cómo</button>`
                : '';
              const instrDiv = plan.Instrucciones
                ? `<div id="mant-instr-${instrKey}" style="display:none;grid-column:1/-1;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;font-size:12px;white-space:pre-line;line-height:1.6;color:var(--text);margin-top:2px">${plan.Instrucciones}</div>`
                : '';
              return `<div class="mant-plan-row">
                <span class="badge ${tipoBadge}" style="font-size:10px;min-width:60px">${plan.Tipo_Intervencion||'—'}</span>
                <span style="font-size:11px;font-weight:500;min-width:90px">${plan.Periodicidad} · ${labelPeriodo(periodo)}</span>
                <span style="font-size:11px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${plan.Operacion}">${plan.Operacion}</span>
                ${instrBtn}
                ${badge}
              </div>${instrDiv}`;
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
  const instrHtml = plan.Instrucciones ? `
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Instrucciones paso a paso</div>
      <div style="white-space:pre-line;line-height:1.7;color:var(--text)">${plan.Instrucciones}</div>
    </div>` : '';
  document.getElementById('mant-info-plan').innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:12px;line-height:1.6">
      <div><strong>Equipo:</strong> ${nombreEquipo}</div>
      <div><strong>Operación:</strong> ${plan.Operacion}</div>
      <div><strong>Tipo:</strong> ${plan.Tipo_Intervencion} · ${plan.Periodicidad} · ${labelPeriodo(periodo)}</div>
      ${instrHtml}
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
      document.getElementById('plan-tipo-int').value      = plan.Tipo_Intervencion;
      document.getElementById('plan-periodicidad').value  = plan.Periodicidad;
      document.getElementById('plan-operacion').value     = plan.Operacion;
      document.getElementById('plan-instrucciones').value = plan.Instrucciones || '';
    }
  } else {
    document.getElementById('plan-tipo-int').value      = 'Interno';
    document.getElementById('plan-periodicidad').value  = 'Anual';
    document.getElementById('plan-operacion').value     = '';
    document.getElementById('plan-instrucciones').value = '';
  }
  openModal('modal-gestionar-plan');
}

async function guardarPlan() {
  const tipo         = document.getElementById('plan-tipo-int').value;
  const period       = document.getElementById('plan-periodicidad').value;
  const operacion    = document.getElementById('plan-operacion').value.trim();
  const instrucciones= document.getElementById('plan-instrucciones').value.trim();
  if (!operacion) { showToast('Escribe el título de la operación', 'error'); return; }

  showLoading('Guardando...');
  try {
    if (_planEditingId) {
      const idx = DATA.planesMantenimiento.findIndex(p => p.ID_Plan === _planEditingId);
      if (idx !== -1) {
        const row = [_planEditingId, _planEditingEquipoId, tipo, period, operacion, 'TRUE', instrucciones];
        await sheetsUpdate(`Planes_Mantenimiento!A${idx + 2}:G${idx + 2}`, row);
        DATA.planesMantenimiento[idx] = rowToObj(row, 'planesMantenimiento');
      }
    } else {
      const id  = genId('PM');
      const row = [id, _planEditingEquipoId, tipo, period, operacion, 'TRUE', instrucciones];
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
              const instrKey = `pend-${s.plan.ID_Plan}-${s.periodo}`.replace(/[^a-z0-9]/gi,'_');
              const instrRow = s.plan.Instrucciones
                ? `<tr id="mant-instr-${instrKey}" style="display:none"><td colspan="6" style="background:var(--bg);padding:10px 14px;font-size:12px;white-space:pre-line;line-height:1.7;border-bottom:2px solid var(--border)">${s.plan.Instrucciones}</td></tr>`
                : '';
              return `<tr>
                <td><strong>${s.equipo.ID_Activo}</strong><br><span style="font-size:11px;color:var(--text-muted)">${s.equipo.Tipo_Equipo||''} ${s.equipo.Marca||''}</span></td>
                <td><span class="badge ${tipoBadge}" style="font-size:10px">${s.plan.Tipo_Intervencion}</span></td>
                <td>${s.plan.Periodicidad}</td>
                <td>${labelPeriodo(s.periodo)}</td>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.plan.Operacion}">${s.plan.Operacion}</td>
                <td style="white-space:nowrap">
                  ${s.plan.Instrucciones ? `<button class="btn btn-secondary" style="padding:2px 6px;font-size:11px" onclick="toggleMantInstr('${instrKey}')">▸ Cómo</button>` : ''}
                  ${canLog ? `<button class="btn btn-secondary" style="padding:2px 8px;font-size:11px"
                      onclick="openModalRegistrarMant('${s.plan.ID_Plan}','${s.equipo.ID_Activo}','${s.periodo}','${s.curso}')">Registrar</button>` : ''}
                </td>
              </tr>${instrRow}`;
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

function toggleMantInstr(key) {
  const el = document.getElementById(`mant-instr-${key}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ============================================================
// EXPORTAR MODELO DE CALIDAD
// ============================================================
function exportarModeloCalidad(cursoAcademico) {
  const curso = cursoAcademico || getCursoAcademico();
  const registros = DATA.registroMantenimientos.filter(r => r.Curso_Academico === curso);
  const planesActivos = DATA.planesMantenimiento.filter(p => p.Activo !== 'FALSE');

  // Detecta el laboratorio de una ubicación por su texto descriptivo
  function detectarLab(idUbicacion) {
    const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === idUbicacion);
    if (!u) return 'Otros';
    const txt = [u.ID_Ubicacion, u.Laboratorio_Aula, u.Zona, u.Subzona, u.Descripcion_Completa].join(' ').toLowerCase();
    if (txt.includes('207')) return 'LAB 207';
    if (txt.includes('205')) return 'LAB 205'; // incluye zona común del 205
    if (txt.includes('203')) return 'LAB 203';
    if (txt.includes('201')) return 'LAB 201';
    return 'Otros';
  }

  // Nombre del equipo para la columna Denominación
  function nombreEquipo(eq) {
    return [eq.Tipo_Equipo, eq.Marca, eq.Modelo, eq.ID_Activo ? `(${eq.ID_Activo})` : ''].filter(Boolean).join(' ');
  }

  // Nombre de ubicación legible
  function nombreUbicacion(idUbicacion) {
    const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === idUbicacion);
    if (!u) return idUbicacion || '—';
    return [u.Laboratorio_Aula, u.Zona, u.Subzona].filter(Boolean).join(' · ') || idUbicacion;
  }

  // Construir filas: máximo 2 filas por equipo (último Interno + último Externo)
  const LAB_ORDER = ['LAB 201', 'LAB 203', 'LAB 205', 'LAB 207', 'Otros'];
  const porLab = {};
  LAB_ORDER.forEach(l => porLab[l] = []);

  // Agrupar planes por equipo
  const planesPorEquipo = {};
  planesActivos.forEach(plan => {
    if (!planesPorEquipo[plan.ID_Equipo]) planesPorEquipo[plan.ID_Equipo] = [];
    planesPorEquipo[plan.ID_Equipo].push(plan);
  });

  Object.entries(planesPorEquipo).forEach(([equipoId, planes]) => {
    const eq = DATA.equipos.find(e => e.ID_Activo === equipoId);
    if (!eq) return;
    const lab = detectarLab(eq.Ubicacion);

    // Para cada tipo (Interno / Externo), una sola fila con el último registro
    ['Interno', 'Externo'].forEach(tipo => {
      const planesDelTipo = planes.filter(p => p.Tipo_Intervencion === tipo);
      if (!planesDelTipo.length) return;

      // Operaciones y periodicidades del tipo (para columnas descriptivas)
      const operaciones  = [...new Set(planesDelTipo.map(p => p.Operacion).filter(Boolean))].join(' / ');
      const periodicidades = [...new Set(planesDelTipo.map(p => p.Periodicidad).filter(Boolean))].join(', ');

      // Todos los registros de este tipo, ordenados por fecha
      const regsDelTipo = registros
        .filter(r => planesDelTipo.some(p => p.ID_Plan === r.ID_Plan))
        .sort((a, b) => new Date(a.Fecha_Realizacion) - new Date(b.Fecha_Realizacion));
      const ultimoReg = regsDelTipo[regsDelTipo.length - 1] || null;

      // Data prevista: último periodo esperado del plan de referencia
      const planRef = planesDelTipo[0];
      const periodos = getPeriodosEsperados(planRef, eq, curso);
      const prevista = periodos.length ? labelPeriodo(periodos[periodos.length - 1]) : '';

      porLab[lab].push({ eq, tipo, operaciones, periodicidades, prevista, regs: regsDelTipo, ultimoReg });
    });
  });

  // Generar una sección HTML por laboratorio
  function seccionLab(labKey, items) {
    if (!items.length) return '';
    const total      = items.length;
    const realizados = items.filter(x => x.reg).length;
    const pendentes = total - realizados;
    const pct = total > 0 ? ((realizados / total) * 100).toFixed(0) : 0;
    const hoy = new Date().toLocaleDateString('es-ES');

    const filas = items.map(({ eq, tipo, operaciones, periodicidades, prevista, regs, ultimoReg }) => {
      const realizada   = regs.map(r => formatDate(r.Fecha_Realizacion)).filter(Boolean).join(', ');
      const supervisado = ultimoReg ? (ultimoReg.Supervisado_Por || '') : '';
      const observacions = ultimoReg ? (ultimoReg.Observaciones || '') : '';
      return `<tr>
        <td>${nombreEquipo(eq)}</td>
        <td>${nombreUbicacion(eq.Ubicacion)}</td>
        <td>${eq.Responsable || ''}</td>
        <td>${tipo}</td>
        <td>${periodicidades}</td>
        <td>${operaciones}</td>
        <td>${prevista}</td>
        <td>${realizada}</td>
        <td>${supervisado}</td>
        <td>${observacions}</td>
      </tr>`;
    }).join('');

    return `
<div class="lab-section">
  <div class="lab-header">
    <div class="lab-title">Plan de Mantemento Preventivo · ${labKey} · CIFP Manuel Antonio · Curso ${curso}</div>
    <div class="lab-meta">
      <span><strong>MD84MAN01</strong></span>
      <span>Data de actualización: ${hoy}</span>
      <span>Total: <strong>${total}</strong></span>
      <span>Realizados: <strong>${realizados}</strong></span>
      <span>Pendentes: <strong>${pendentes}</strong></span>
      <span>% realizado: <strong>${pct}%</strong></span>
    </div>
    <div class="purpose">
      <strong>Serve para:</strong> Definir as instalacións, equipos e servizos de apoio sometidos ao procedemento de mantemento.
      Designar responsables específicos. Determinar as frecuencias de control.<br>
      <em>No caso do mantemento externalizado, o Responsable de mantemento limítase a xestionar a tarefa.</em>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Denominación<br><small>(instalación, equipo, servizo de apoio)</small></th>
      <th>Ubicación do equipo</th>
      <th>Responsable<br>Mantemento</th>
      <th>Mantemento<br>Interno/Externo</th>
      <th>Periodicidade</th>
      <th>Operación a realizar</th>
      <th>Data prevista de realización</th>
      <th>Data de realización</th>
      <th>Supervisado por</th>
      <th>Observacións</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>
</div>`;
  }

  const secciones = LAB_ORDER
    .filter(lab => porLab[lab] && porLab[lab].length)
    .map(lab => seccionLab(lab, porLab[lab]))
    .join('<div class="page-break"></div>');

  const html = `<!DOCTYPE html>
<html lang="gl"><head><meta charset="UTF-8">
<title>Plan de Mantemento Preventivo – ${curso} – CIFP Manuel Antonio</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 16px; color: #111; }
  .lab-section { margin-bottom: 32px; }
  .lab-header { margin-bottom: 8px; }
  .lab-title { font-size: 13px; font-weight: bold; margin-bottom: 6px; }
  .lab-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 10px; margin-bottom: 6px; color: #333; }
  .purpose { font-size: 9px; color: #555; border: 1px solid #ccc; padding: 6px 8px; margin-top: 6px; background: #fafafa; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1a3a6e; color: #fff; }
  th { padding: 5px 6px; text-align: left; font-size: 9px; border: 1px solid #1a3a6e; }
  th small { font-weight: normal; opacity: .85; }
  td { border: 1px solid #bbb; padding: 4px 6px; vertical-align: top; font-size: 9px; }
  tr:nth-child(even) td { background: #f5f7fb; }
  .page-break { page-break-after: always; margin: 0; }
  @media print {
    body { margin: 0; font-size: 9px; }
    .lab-section { page-break-inside: avoid; }
    .page-break { display: block; page-break-after: always; }
  }
</style></head><body>
${secciones}
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
