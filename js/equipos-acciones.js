// ============================================================
// VARIABLE DE ESTADO — intervención pendiente de archivo
// ============================================================
let _pendingActFileBase64 = null;  // para modal-registrar-actuacion

// ============================================================
// MULTI-TAG — RESPONSABLE(S) DEL EQUIPO
// Almacena nombres en array y sincroniza con el input oculto #eq-responsable
// ============================================================
let _responsablesSelec = [];

const _ROLES_RESPONSABLE = ['Administrador', 'Gestor', 'Profesor'];

function _syncResponsablesHidden() {
  const hidden = document.getElementById('eq-responsable');
  if (hidden) hidden.value = _responsablesSelec.join(', ');
}

function _renderResponsableTags() {
  const container = document.getElementById('responsable-tags');
  if (!container) return;
  container.innerHTML = _responsablesSelec.map(nombre =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--accent-light);color:var(--accent);border-radius:20px;font-size:12px;font-weight:500">
      ${nombre}
      <span style="cursor:pointer;font-size:14px;line-height:1" onclick="_quitarResponsable('${nombre.replace(/'/g, "\\'")}')">×</span>
    </span>`
  ).join('');
  _syncResponsablesHidden();
}

function _quitarResponsable(nombre) {
  _responsablesSelec = _responsablesSelec.filter(n => n !== nombre);
  _renderResponsableTags();
}

function _agregarResponsable(nombre) {
  if (!_responsablesSelec.includes(nombre)) {
    _responsablesSelec.push(nombre);
    _renderResponsableTags();
  }
  const srch = document.getElementById('responsable-search');
  if (srch) { srch.value = ''; }
  const ac = document.getElementById('responsable-autocomplete');
  if (ac) ac.classList.remove('open');
}

function filtrarResponsables(val) {
  const ac = document.getElementById('responsable-autocomplete');
  if (!ac) return;
  const q = (val || '').toLowerCase().trim();
  const candidatos = DATA.usuarios.filter(u =>
    u.Activo !== 'FALSE' &&
    _ROLES_RESPONSABLE.includes(u.Rol) &&
    !_responsablesSelec.includes(u.Nombre) &&
    (!q || (u.Nombre || '').toLowerCase().includes(q))
  );
  if (!candidatos.length) { ac.classList.remove('open'); return; }
  ac.innerHTML = candidatos.map(u =>
    `<div class="autocomplete-item" onclick="_agregarResponsable('${u.Nombre.replace(/'/g, "\\'")}')">
      <div>
        <div class="autocomplete-item-name">${u.Nombre}</div>
        <div class="autocomplete-item-meta">${u.Rol}</div>
      </div>
    </div>`
  ).join('');
  ac.classList.add('open');
}

function _initResponsables(valor) {
  _responsablesSelec = (valor || '').split(',').map(s => s.trim()).filter(Boolean);
  _renderResponsableTags();
  const srch = document.getElementById('responsable-search');
  if (srch) srch.value = '';
}

// ============================================================
// MULTI-TAG — MÓDULO(S) RESPONSABLE(S) DEL EQUIPO
// Mismo patrón que Responsable(s), pero de qué módulo(s) depende el equipo
// (para premarcar responsables al importar profesorado, ver _pasoDosImportarProfesores).
// Almacena nombres de módulo en array y sincroniza con el input oculto #eq-modulos-responsables
// ============================================================
let _modulosResponsablesSelec = [];

function _syncModulosResponsablesHidden() {
  const hidden = document.getElementById('eq-modulos-responsables');
  if (hidden) hidden.value = _modulosResponsablesSelec.join(', ');
}

function _renderModulosResponsablesTags() {
  const container = document.getElementById('modulos-tags');
  if (!container) return;
  container.innerHTML = _modulosResponsablesSelec.map(nombre =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--accent-light);color:var(--accent);border-radius:20px;font-size:12px;font-weight:500">
      ${nombre}
      <span style="cursor:pointer;font-size:14px;line-height:1" onclick="_quitarModuloResponsable('${nombre.replace(/'/g, "\\'")}')">×</span>
    </span>`
  ).join('');
  _syncModulosResponsablesHidden();
}

function _quitarModuloResponsable(nombre) {
  _modulosResponsablesSelec = _modulosResponsablesSelec.filter(n => n !== nombre);
  _renderModulosResponsablesTags();
}

function _agregarModuloResponsable(nombre) {
  if (!_modulosResponsablesSelec.includes(nombre)) {
    _modulosResponsablesSelec.push(nombre);
    _renderModulosResponsablesTags();
  }
  const srch = document.getElementById('modulos-search');
  if (srch) { srch.value = ''; }
  const ac = document.getElementById('modulos-autocomplete');
  if (ac) ac.classList.remove('open');
}

function filtrarModulosResponsables(val) {
  const ac = document.getElementById('modulos-autocomplete');
  if (!ac) return;
  const q = (val || '').toLowerCase().trim();
  const nombresModulo = [...new Set((DATA.ciclosModulos || []).map(cm => cm.Modulo).filter(Boolean))].sort();
  const candidatos = nombresModulo.filter(m =>
    !_modulosResponsablesSelec.includes(m) &&
    (!q || m.toLowerCase().includes(q))
  );
  if (!candidatos.length) { ac.classList.remove('open'); return; }
  ac.innerHTML = candidatos.map(m =>
    `<div class="autocomplete-item" onclick="_agregarModuloResponsable('${m.replace(/'/g, "\\'")}')">
      <div class="autocomplete-item-name">${m}</div>
    </div>`
  ).join('');
  ac.classList.add('open');
}

function _initModulosResponsables(valor) {
  _modulosResponsablesSelec = (valor || '').split(',').map(s => s.trim()).filter(Boolean);
  _renderModulosResponsablesTags();
  const srch = document.getElementById('modulos-search');
  if (srch) srch.value = '';
}



// ============================================================
// HELPER — Actualiza Estado_Operativo del equipo en Sheets y DATA
// equipoStr: string del campo Equipo ("ID – Nombre" o solo "ID")
// nuevoEstado: 'Operativo' | 'En mantenimiento' | 'Averiado' | 'Fuera de servicio'
// ============================================================
async function actualizarEstadoEquipo(equipoStr, nuevoEstado) {
  const equipoId = (equipoStr || '').split(' – ')[0].trim();
  const eqIdx = DATA.equipos.findIndex(e => e.ID_Activo === equipoId);
  if (eqIdx === -1) return;
  const eq = DATA.equipos[eqIdx];
  if (eq.Estado_Operativo === nuevoEstado) return; // sin cambios
  eq.Estado_Operativo = nuevoEstado;
  await callEdgeFunction('gestionar-equipo', { accion: 'actualizar_estado', id_activo: eq.ID_Activo, estado_operativo: nuevoEstado });
}

// ============================================================
// MODALES EQUIPOS
// ============================================================
function openModalEquipo() {
  editingRow = null; pendingEqFileBase64 = null;
  document.getElementById('modal-equipo-title').textContent = 'Nuevo equipo';
  const idFieldN = document.getElementById('eq-id');
  idFieldN.value = ''; idFieldN.readOnly = false; idFieldN.style.opacity = ''; idFieldN.dataset.original = '';
  const btnDesbloquearIdN = document.getElementById('btn-desbloquear-eq-id');
  if (btnDesbloquearIdN) btnDesbloquearIdN.style.display = 'none';
  ['eq-marca','eq-modelo','eq-serie','eq-fecha-adq','eq-coste','eq-observaciones'].forEach(id => sv(id,''));
  ['eq-tipo','eq-financiacion','eq-proveedor-compra','eq-proveedor-sat'].forEach(id => sv(id,''));
  _initResponsables(''); // limpia tags responsable
  _initModulosResponsables(''); // limpia tags módulos responsables
  sv('eq-estado','Operativo'); sv('eq-pdf-url','');
  sv('eq-protocolo-uso',''); sv('eq-mes-inicio',''); sv('eq-mes-fin','');
  document.getElementById('eq-pdf-preview').style.display = 'none';
  document.getElementById('eq-pdf-name').textContent = '';
  if (document.getElementById('eq-pdf-input')) document.getElementById('eq-pdf-input').value = '';
  // Limpiar autocomplete ubicación
  clearUbicacionEquipo();
  const btnElimEq = document.getElementById('btn-eliminar-equipo');
  if (btnElimEq) btnElimEq.style.display = 'none';
  poblarSelects(); openModal('modal-equipo');
}

function editEquipo(idx) {
  const e = DATA.equipos[idx];
  editingRow = { sheet: 'Equipos', rowIndex: idx };
  pendingEqFileBase64 = null;
  document.getElementById('modal-equipo-title').textContent = 'Editar equipo';
  poblarSelects();
  const idField = document.getElementById('eq-id');
  idField.value = e.ID_Activo;
  idField.dataset.original = e.ID_Activo;
  idField.readOnly = true;
  idField.style.opacity = '0.6';
  const btnDesbloquearId = document.getElementById('btn-desbloquear-eq-id');
  if (btnDesbloquearId) btnDesbloquearId.style.display = puedeHacer('editarEquipos') ? '' : 'none';
  sv('eq-tipo',e.Tipo_Equipo); sv('eq-marca',e.Marca);
  sv('eq-modelo',e.Modelo); sv('eq-serie',e.Numero_Serie); sv('eq-ubicacion',e.Ubicacion);
  _initResponsables(e.Responsable); _initModulosResponsables(e.Modulos_Responsables); sv('eq-fecha-adq',e.Fecha_Adquisicion);
  sv('eq-financiacion',e.Origen_Financiacion); sv('eq-proveedor-compra',e.Proveedor_Compra);
  sv('eq-proveedor-sat',e.Proveedor_Servicio_Tecnico); sv('eq-estado',e.Estado_Operativo);
  sv('eq-observaciones',e.Observaciones);
  sv('eq-coste', e.Coste||'');
  sv('eq-pdf-url', e.Manual_Ficha_Tecnica||'');
  sv('eq-protocolo-uso', e.Protocolo_Uso||'');
  sv('eq-mes-inicio', e.Mes_Inicio_Temporada||'');
  sv('eq-mes-fin', e.Mes_Fin_Temporada||'');
  // Restaurar autocomplete de ubicación
  document.getElementById('eq-ubicacion').value = e.Ubicacion || '';
  document.getElementById('eq-ubicacion-search').value = '';
  const selUbi = document.getElementById('eq-ubicacion-selected');
  const txtUbi = document.getElementById('eq-ubicacion-selected-text');
  if (e.Ubicacion) {
    const uObj = DATA.ubicaciones.find(u => u.ID_Ubicacion === e.Ubicacion);
    const label = uObj ? (uObj.Laboratorio_Aula || '') + (uObj.Zona ? ' · ' + uObj.Zona : '') : '';
    if (selUbi) selUbi.style.display = 'flex';
    if (txtUbi) txtUbi.textContent = e.Ubicacion + (label ? ' – ' + label : '');
  } else {
    if (selUbi) selUbi.style.display = 'none';
  }
  if (e.Manual_Ficha_Tecnica) { document.getElementById('eq-pdf-preview').style.display = 'flex'; document.getElementById('eq-pdf-name').textContent = 'Manual adjunto (ver 📄)'; }
  else document.getElementById('eq-pdf-preview').style.display = 'none';
  const btnElimEqEdit = document.getElementById('btn-eliminar-equipo');
  if (btnElimEqEdit) btnElimEqEdit.style.display = puedeHacer('eliminarItems') ? '' : 'none';
  openModal('modal-equipo');
}

function desbloquearEqId() {
  if (!confirm('Cambiar el ID de este equipo también actualiza sus incidencias, intervenciones, planes de mantenimiento, reservas y líneas de pedido ya asociadas a él. ¿Continuar?')) return;
  const idField = document.getElementById('eq-id');
  idField.readOnly = false;
  idField.style.opacity = '';
  idField.focus();
}

async function eliminarEquipo() {
  const e = DATA.equipos[editingRow.rowIndex];
  if (!confirm(`¿Eliminar "${e.ID_Activo} — ${e.Marca} ${e.Modelo}" del inventario? Esta acción no se puede deshacer.`)) return;
  showLoading('Eliminando...');
  try {
    await callEdgeFunction('gestionar-equipo', { accion: 'eliminar', id_activo: e.ID_Activo });
    DATA.equipos.splice(editingRow.rowIndex, 1);
    closeModal('modal-equipo');
    editingRow = null;
    renderEquipos(); renderDashboard(); updateBadges();
    showToast(`Equipo eliminado del inventario`, 'success');
  } catch(err) {
    showToast('Error al eliminar. Comprueba la consola.', 'error');
    console.error(err);
  }
  hideLoading();
}

// ============================================================
// MODAL INCIDENCIA
// ============================================================
function openModalIncidencia() {
  editingRow = null;
  sv('inc-equipo',''); sv('inc-descripcion',''); sv('inc-relacionada','');
  sv('inc-impacto','No bloquea'); sv('inc-urgencia','Normal');
  const srch = document.getElementById('inc-equipo-search'); if (srch) srch.value = '';
  const sel  = document.getElementById('inc-equipo-selected'); if (sel) sel.style.display = 'none';
  const ac   = document.getElementById('inc-equipo-autocomplete'); if (ac) ac.classList.remove('open');
  const grp  = document.getElementById('inc-equipo-group');
  if (grp) grp.style.display = '';
  poblarIncidenciasRelacionadas('');
  openModal('modal-incidencia');
  setTimeout(() => document.getElementById('inc-equipo-search')?.focus(), 100);
}

// ============================================================
// SELECT — incidencias resueltas/descartadas del mismo equipo,
// para enlazar una reapertura sin reabrir el hilo original
// ============================================================
function poblarIncidenciasRelacionadas(equipoId) {
  const sel = document.getElementById('inc-relacionada');
  if (!sel) return;
  const previas = DATA.incidencias.filter(i =>
    equipoId && i.Equipo && i.Equipo.startsWith(equipoId) &&
    (i.Estado === 'Resuelta' || i.Estado === 'Descartada')
  );
  sel.innerHTML = '<option value="">Ninguna (incidencia nueva)</option>' +
    previas.map(i => `<option value="${i.ID_Incidencia}">${i.ID_Incidencia} · ${formatDate(i.Fecha_Hora)||''} · ${(i.Descripcion_Problema||'').slice(0,40)}</option>`).join('');
}

function openModalIncidenciaEquipo(equipoId) {
  openModalIncidencia();
  setTimeout(() => {
    const eq = DATA.equipos.find(e => e.ID_Activo === equipoId);
    if (!eq) return;
    const label = [eq.Tipo_Equipo, eq.Marca, eq.Modelo].filter(Boolean).join(' ');
    seleccionarEquipoIncidencia(equipoId, label);
    const grp = document.getElementById('inc-equipo-group');
    if (grp) grp.style.display = 'none';
  }, 50);
}

// ============================================================
// FLUJO PASO 1 — Planificar desde incidencia
// ============================================================
function abrirPlanificacion(incId, equipo, origenIntId) {
  sv('plan-inc-id', incId);
  sv('plan-equipo', equipo);
  sv('plan-origen-int', origenIntId || '');
  sv('plan-int-idx', '');
  const label = document.getElementById('plan-inc-label');
  if (label) label.textContent = incId + ' (' + equipo + ')';
  const intro = document.getElementById('plan-intro-texto');
  const titulo = document.getElementById('plan-modal-title');
  const ayuda  = document.getElementById('plan-ayuda-texto');
  const pendWrap  = document.getElementById('plan-pendientes-wrap');
  const pendLista = document.getElementById('plan-pendientes-lista');
  if (origenIntId) {
    if (intro) intro.textContent = 'Programando una nueva actuación de seguimiento sobre la incidencia';
    if (titulo) titulo.textContent = '📅 Programar próxima actuación';
    if (ayuda) ayuda.innerHTML = 'Esta incidencia sigue abierta y hace falta volver otro día. Toca abajo lo pendiente que corresponda a esta actuación — puede que no sea todo (p.ej. si hay tareas para especialistas distintos).';
    const sinResolver = t => ['Pendiente', 'Resuelto parcialmente', 'No resuelto'].includes(t.Resultado);
    const pendientes = getTareasIntervencion(origenIntId).filter(sinResolver);
    if (pendWrap && pendLista) {
      if (pendientes.length) {
        pendWrap.style.display = '';
        pendLista.innerHTML = pendientes.map(t => `<button type="button" class="btn btn-secondary plan-sugerencia-btn" data-desc="${t.Descripcion.replace(/"/g, '&quot;')}" style="text-align:left;font-size:12px" onclick="agregarTareaPrevista(this.dataset.desc, this)">
          ➜ ${t.Descripcion} <span class="badge ${_RESULTADO_BADGE[t.Resultado]||'badge-gray'}" style="font-size:10px;margin-left:6px">${t.Resultado}</span>
        </button>`).join('');
      } else {
        pendWrap.style.display = 'none';
        pendLista.innerHTML = '';
      }
    }
  } else {
    if (intro) intro.textContent = 'Creando intervención en respuesta a la incidencia';
    if (titulo) titulo.textContent = '🗓 Responder a la incidencia';
    if (ayuda) ayuda.innerHTML = 'Esto solo deja anotado "esto se va a atender" — no hace falta que ya sepas cuándo. Cuando la actuación ocurra, la registrarás como una <strong>Intervención</strong> con sus <strong>Tareas</strong> desde "Ejecutar", en "Próximas actuaciones".';
    if (pendWrap) pendWrap.style.display = 'none';
    if (pendLista) pendLista.innerHTML = '';
  }
  sv('plan-tipo', 'Correctivo');
  sv('plan-fecha', '');
  sv('plan-descripcion', '');
  sv('plan-nueva-tarea', '');
  const tareasListaEl = document.getElementById('plan-tareas-lista');
  if (tareasListaEl) tareasListaEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Aún no hay tareas previstas.</div>';

  // Quién la va a hacer (opcional, se puede confirmar/cambiar al ejecutar)
  sv('plan-realizado-por', '');
  sv('plan-proveedor-ext', '');
  const selUserPlan = document.getElementById('plan-realizado-por');
  if (selUserPlan) {
    selUserPlan.innerHTML = '<option value="">Seleccionar usuario...</option>' +
      DATA.usuarios.filter(u => u.Activo !== 'FALSE').map(u => `<option value="${u.Nombre}">${u.Nombre}</option>`).join('');
  }
  const listProvPlan = document.getElementById('plan-proveedor-ext-list');
  if (listProvPlan) {
    listProvPlan.innerHTML = DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">`).join('');
  }
  const radInternaPlan = document.getElementById('plan-ejec-interna');
  if (radInternaPlan) { radInternaPlan.checked = true; _toggleEjecucionPlan('Interna'); }

  const btnCrear = document.getElementById('plan-btn-crear');
  if (btnCrear) btnCrear.textContent = 'Crear intervención planificada';

  openModal('modal-planificar-intervencion');
}

function _toggleEjecucionPlan(tipo) {
  const intGrp = document.getElementById('plan-interna-group');
  const extGrp = document.getElementById('plan-externa-group');
  if (intGrp) intGrp.style.display = tipo === 'Interna' ? '' : 'none';
  if (extGrp) extGrp.style.display = tipo === 'Externa' ? '' : 'none';
}

// ============================================================
// HILO DE LA INCIDENCIA — todas sus visitas (planificadas y ejecutadas) en un
// solo sitio, para no tener que ir a buscarlas por separado en "Próximas
// visitas" y en la tabla de intervenciones.
// ============================================================
function abrirHiloIncidencia(incId) {
  const inc = DATA.incidencias.find(x => x.ID_Incidencia === incId);
  if (!inc) return;
  const label = document.getElementById('hilo-inc-label');
  if (label) label.textContent = `${inc.ID_Incidencia} · ${inc.Equipo || ''} · ${inc.Estado}`;

  const cont = document.getElementById('hilo-lista');
  if (!cont) return;

  if (!inc.Intervencion_Generada) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗓</div><div class="empty-state-title">Aún sin planificar</div><div class="empty-state-text">Pulsa "Responder" en la incidencia para crear la primera actuación.</div></div>`;
    openModal('modal-hilo-incidencia');
    return;
  }

  const chain = getChainIntervencion(inc.Intervencion_Generada);
  const estadoBadge = {'Planificada':'badge-blue','En gestión':'badge-orange','Cerrada':'badge-green','Pendiente factura':'badge-red'};
  cont.innerHTML = chain.map((c, idx) => {
    const cIdx = DATA.intervenciones.indexOf(c);
    const esActiva = c.ID_Intervencion === inc.Intervencion_Generada;
    const tareas = getTareasIntervencion(c.ID_Intervencion);
    const resumenTareas = tareas.length
      ? `${tareas.filter(t => t.Resultado === 'Resuelto' || t.Resultado === 'Descartado').length}/${tareas.length} tareas`
      : 'sin tareas aún';
    const quien = c.Realizado_Por || c.Proveedor || '—';
    const fechaTxt = c.Fecha_Realizacion
      ? formatDate(c.Fecha_Realizacion)
      : (c.Fecha_Planificada ? formatDate(c.Fecha_Planificada) + ' (planificada)' : 'Por concretar');

    let accion = '';
    if (esActiva && puedeHacer('crearIntervenciones')) {
      if (c.Estado === 'Planificada')
        accion += `<button class="btn btn-primary" style="font-size:12px;padding:4px 10px" onclick="closeModal('modal-hilo-incidencia');openModalActuacionDerivada(${cIdx})">🔧 Ejecutar</button>`;
      else if (c.Estado === 'En gestión')
        accion += `<button class="btn btn-primary" style="font-size:12px;padding:4px 10px" onclick="closeModal('modal-hilo-incidencia');openModalActuacionDerivada(${cIdx})">📋 Añadir tarea</button>`;
      else if (c.Estado === 'Pendiente factura')
        accion += `<button class="btn btn-primary" style="font-size:12px;padding:4px 10px" onclick="closeModal('modal-hilo-incidencia');openModalAdjuntarFactura(${cIdx})">📎 Factura</button>`;
      if (c.Estado !== 'Cerrada')
        accion += ` <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" onclick="closeModal('modal-hilo-incidencia');programarOtraVisita(${cIdx})">📅 Otra actuación</button>`;
    }

    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;${idx < chain.length-1 ? 'border-bottom:1px solid var(--border);' : ''}">
      <div style="width:22px;height:22px;border-radius:50%;background:${esActiva ? 'var(--accent)' : 'var(--border)'};color:${esActiva ? '#fff' : 'var(--text-muted)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0">${idx + 1}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
          <strong style="font-size:13px">${c.ID_Intervencion}</strong>
          <span class="badge ${estadoBadge[c.Estado]||'badge-gray'}" style="font-size:10px">${c.Estado||'—'}</span>
          ${esActiva ? '<span class="badge badge-blue" style="font-size:9px">actuación activa</span>' : ''}
        </div>
        <div style="font-size:12px;color:var(--text-soft)">${fechaTxt} · ${quien} · ${resumenTareas}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        <button class="icon-btn" onclick="closeModal('modal-hilo-incidencia');openFichaIntervencion(${cIdx})" title="Ver ficha">🔍</button>
        ${accion}
      </div>
    </div>`;
  }).join('');

  openModal('modal-hilo-incidencia');
}

// Programar una NUEVA visita (otro día, posiblemente otro técnico) sobre una incidencia
// ya en curso — distinto de añadir otra tarea a la visita actual (ver guardarActuacion).
function programarOtraVisita(intIdx) {
  const i = DATA.intervenciones[intIdx];
  if (!i) return;
  const chainIds = getChainIntervencion(i.ID_Intervencion).map(c => c.ID_Intervencion);
  const inc = DATA.incidencias.find(x => chainIds.includes(x.Intervencion_Generada));
  if (!inc) { showToast('No se encontró la incidencia vinculada', 'error'); return; }
  abrirPlanificacion(inc.ID_Incidencia, i.Equipo, i.ID_Intervencion);
}

// Crea la fila de Intervención la primera vez que hace falta guardar algo (botón
// "Guardar sin cerrar", "Crear intervención planificada", o al añadir la primera
// tarea prevista) y devuelve su índice en DATA.intervenciones. Si ya se creó en
// esta misma sesión del modal, simplemente devuelve ese índice.
async function _asegurarIntervencionPlanificada() {
  const idxExistente = v('plan-int-idx');
  if (idxExistente !== '') return parseInt(idxExistente);

  const incId  = v('plan-inc-id');
  const equipo = v('plan-equipo');
  const fecha  = v('plan-fecha');
  const origenIntId = v('plan-origen-int');
  const tipoEjecPlan = document.querySelector('input[name="plan-tipo-ejec"]:checked')?.value || 'Interna';
  const realizadoPorPlan = tipoEjecPlan === 'Interna' ? v('plan-realizado-por') : '';
  const proveedorPlan    = tipoEjecPlan === 'Externa' ? v('plan-proveedor-ext') : '';

  try {
    const { intervencion } = await callEdgeFunction('gestionar-intervencion', {
      accion: 'crear',
      id_equipo: (equipo || '').split(' – ')[0].trim(),
      tipo: v('plan-tipo'),
      origen: origenIntId ? ('Seguimiento de ' + origenIntId) : 'Incidencia reportada',
      fecha_planificada: fecha,
      realizado_por: realizadoPorPlan,
      proveedor: proveedorPlan,
      descripcion_actuacion: v('plan-descripcion'),
      estado: 'Planificada',
      incidencia_id: incId || undefined,
      estado_equipo: 'Revisión planificada',
    });
    DATA.intervenciones.push(_intervencionSbToObj(intervencion));
    const intIdx = DATA.intervenciones.length - 1;
    sv('plan-int-idx', String(intIdx));
    const btnCrear = document.getElementById('plan-btn-crear');
    if (btnCrear) btnCrear.textContent = 'Guardar y cerrar';

    // Reflejar en memoria el cambio que la Edge Function ya hizo en la incidencia
    // (Estado → En gestión, Intervencion_Generada → esta intervención).
    const incIdx = DATA.incidencias.findIndex(x => x.ID_Incidencia === incId);
    if (incIdx !== -1) {
      DATA.incidencias[incIdx].Estado = 'En gestión';
      DATA.incidencias[incIdx].Intervencion_Generada = intervencion.id_intervencion;
    }

    return intIdx;
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); return null; }
}

function _renderTareasPrevistasEnModal(intId) {
  const cont = document.getElementById('plan-tareas-lista');
  if (!cont) return;
  const tareas = getTareasIntervencion(intId);
  if (!tareas.length) { cont.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">Aún no hay tareas previstas.</div>'; return; }
  cont.innerHTML = tareas.map(t => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
    <span style="flex:1">${t.Descripcion}</span>
    <span class="badge ${_RESULTADO_BADGE[t.Resultado]||'badge-gray'}" style="font-size:10px">${t.Resultado}</span>
  </div>`).join('');
}

// Añade una tarea prevista de inmediato (crea la intervención planificada si aún
// no existe). btnSugerencia: si viene de "Pendiente de la visita anterior", se
// desactiva ese botón tras usarlo para no añadirla dos veces.
async function agregarTareaPrevista(descPredefinida, btnSugerencia) {
  const desc = descPredefinida || v('plan-nueva-tarea');
  if (!desc) { showToast('Escribe una tarea', 'error'); return; }
  showLoading('Guardando...');
  const intIdx = await _asegurarIntervencionPlanificada();
  if (intIdx === null) { hideLoading(); return; }
  const i = DATA.intervenciones[intIdx];
  try {
    await _guardarTareaIntervencion(i.ID_Intervencion, desc, 'Pendiente', '', '');
    if (!descPredefinida) sv('plan-nueva-tarea', '');
    if (btnSugerencia) { btnSugerencia.disabled = true; btnSugerencia.style.opacity = '0.4'; }
    _renderTareasPrevistasEnModal(i.ID_Intervencion);
    renderProximasVisitas();
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

async function guardarPlanificacion(finalizar) {
  showLoading('Guardando...');
  const intIdx = await _asegurarIntervencionPlanificada();
  if (intIdx === null) { hideLoading(); return; }
  const i = DATA.intervenciones[intIdx];

  const tipoEjecPlan = document.querySelector('input[name="plan-tipo-ejec"]:checked')?.value || 'Interna';
  const realizadoPorPlan = tipoEjecPlan === 'Interna' ? v('plan-realizado-por') : '';
  const proveedorPlan    = tipoEjecPlan === 'Externa' ? v('plan-proveedor-ext') : '';
  try {
    const { intervencion } = await callEdgeFunction('gestionar-intervencion', {
      accion: 'actualizar', id_intervencion: i.ID_Intervencion,
      tipo: v('plan-tipo'), fecha_planificada: v('plan-fecha'),
      realizado_por: realizadoPorPlan, proveedor: proveedorPlan,
      descripcion_actuacion: v('plan-descripcion'), estado: 'Planificada',
    });
    DATA.intervenciones[intIdx] = _intervencionSbToObj(intervencion);

    if (finalizar) {
      closeModal('modal-planificar-intervencion');
      showToast('Intervención planificada guardada', 'success');
      renderAll();
    } else {
      showToast('Guardado. Puedes seguir añadiendo tareas previstas o cerrar cuando quieras.', 'success');
      renderProximasVisitas(); renderIntervenciones(); renderIncidencias(); renderDashboard(); updateBadges();
    }
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// TAREAS DE INTERVENCIÓN — helpers de agregación
// Una Intervención es una visita; cada Tarea es una acción concreta
// dentro de esa visita, con su propio resultado.
// ============================================================
function getTareasIntervencion(intId) {
  return DATA.tareasIntervencion.filter(t => t.ID_Intervencion === intId);
}

// tareaOrigenId: si se pasa, actualiza esa fila de Tareas_Intervencion en vez de
// crear una nueva — lo usa marcarResultadoTarea() para fijar el resultado de una
// tarea ya guardada (p.ej. una prevista al planificar, ver plan-tareas-previstas).
// Crea o actualiza una tarea. La Edge Function recalcula en el mismo golpe
// el Resultado/Estado agregados de la intervención y los propaga al estado
// del equipo y de la incidencia vinculada (antes era _sincronizarIntervencion,
// una llamada aparte que había que acordarse de hacer después).
async function _guardarTareaIntervencion(intId, descripcion, resultado, operativo, observaciones, tareaOrigenId) {
  const resp = await callEdgeFunction('gestionar-intervencion', {
    accion: 'guardar_tarea', id_intervencion: intId, id_tarea: tareaOrigenId || undefined,
    descripcion, resultado, operativo, observaciones: observaciones || '',
  });
  const idx = DATA.tareasIntervencion.findIndex(t => t.ID_Tarea === resp.tarea.id_tarea);
  const obj = _tareaSbToObj(resp.tarea);
  if (idx !== -1) DATA.tareasIntervencion[idx] = obj; else DATA.tareasIntervencion.push(obj);
  const intIdx = DATA.intervenciones.findIndex(x => x.ID_Intervencion === intId);
  if (intIdx !== -1) DATA.intervenciones[intIdx] = _intervencionSbToObj(resp.intervencion);
  return resp;
}

const _RESULTADO_BADGE = {'Resuelto':'badge-green','Resuelto parcialmente':'badge-orange','Pendiente':'badge-blue','No resuelto':'badge-red','Descartado':'badge-gray'};

function _renderTareasEnModal(intId) {
  const cont = document.getElementById('act-tareas-lista');
  if (!cont) return;
  const tareas = getTareasIntervencion(intId);
  if (!tareas.length) {
    cont.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Aún no hay tareas registradas en esta actuación.</div>';
    return;
  }
  cont.innerHTML = tareas.map(t => {
    const sinResolver = !t.Resultado || t.Resultado === 'Pendiente';
    const controles = sinResolver
      ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary" style="padding:3px 8px;font-size:11px" onclick="marcarResultadoTarea('${t.ID_Tarea}','Resuelto')">✓ Resuelto</button>
          <select style="font-size:11px;padding:3px 6px" onchange="if(this.value) marcarResultadoTarea('${t.ID_Tarea}', this.value); this.value=''">
            <option value="">Otro resultado…</option>
            <option value="Resuelto parcialmente">Resuelto parcialmente</option>
            <option value="No resuelto">No resuelto</option>
            <option value="Descartado">Descartado</option>
          </select>
        </div>`
      : `<span class="badge ${_RESULTADO_BADGE[t.Resultado]||'badge-gray'}" style="font-size:10px">${t.Resultado}</span>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="flex:1;min-width:120px">${t.Descripcion}</span>
      ${controles}
    </div>`;
  }).join('');
}

// ============================================================
// FLUJO PASO 2 — Registrar actuación (tareas de una visita)
// ============================================================
function openModalRegistrarActuacion(intIdx) {
  _pendingActFileBase64 = null;
  removeActFile();
  sv('act-equipo-directo', '');
  const tipoGrp = document.getElementById('act-tipo-int-group');
  if (tipoGrp) tipoGrp.style.display = 'none';
  const i = DATA.intervenciones[intIdx];
  sv('act-int-id',  i.ID_Intervencion);
  sv('act-int-idx', String(intIdx));
  const label  = document.getElementById('act-int-label');
  const eqLbl  = document.getElementById('act-equipo-label');
  if (label) label.textContent = i.ID_Intervencion;
  if (eqLbl) eqLbl.textContent = i.Equipo || '—';

  // Campos de la nueva tarea — siempre en blanco
  _resetCamposTarea();
  sv('act-pdf-url', '');

  poblarSelects();
  const selUser = document.getElementById('act-realizado-por');
  if (selUser) {
    selUser.innerHTML = '<option value="">Seleccionar usuario...</option>' +
      DATA.usuarios.filter(u => u.Activo !== 'FALSE').map(u => `<option value="${u.Nombre}">${u.Nombre}</option>`).join('');
  }
  const listProv = document.getElementById('act-proveedor-ext-list');
  if (listProv) {
    listProv.innerHTML = DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">`).join('');
  }
  sv('act-proveedor-ext', ''); // es un input de texto, no se limpia solo al repoblar el datalist

  // Los campos de visita (fecha, ejecución, quién, coste) se precargan con lo que
  // ya hubiera (de una tarea anterior o de la planificación), pero se quedan
  // siempre editables — por si hace falta corregirlos más adelante.
  sv('act-fecha-real', i.Fecha_Realizacion || new Date().toISOString().split('T')[0]);
  sv('act-coste', i.Coste_Intervencion || '');
  const esExterna = !!i.Proveedor;
  const radInterna = document.getElementById('act-ejec-interna');
  const radExterna = document.getElementById('act-ejec-externa');
  if (esExterna) { if (radExterna) radExterna.checked = true; sv('act-proveedor-ext', i.Proveedor); }
  else { if (radInterna) radInterna.checked = true; if (i.Realizado_Por) sv('act-realizado-por', i.Realizado_Por); }
  toggleActEjecucion(esExterna ? 'Externa' : 'Interna');

  _renderTareasEnModal(i.ID_Intervencion);
  openModal('modal-registrar-actuacion');
}

function toggleActEjecucion(tipo) {
  const intGrp   = document.getElementById('act-interna-group');
  const extGrp   = document.getElementById('act-externa-group');
  const costeGrp = document.getElementById('act-coste-group');
  if (intGrp)   intGrp.style.display   = tipo === 'Interna' ? '' : 'none';
  if (extGrp)   extGrp.style.display   = tipo === 'Externa' ? '' : 'none';
  if (costeGrp) costeGrp.style.display = tipo === 'Externa' ? '' : 'none';
}

// Vuelve a poner el bloque "Nueva tarea" en su estado inicial.
function _resetCamposTarea() {
  sv('act-descripcion', '');
  sv('act-observaciones', '');
}

// Resultado por defecto según el botón/opción elegida en la lista de tareas
// (se puede corregir el estado operativo del equipo a mano desde la ficha del equipo).
const _OPERATIVO_POR_DEFECTO = { 'Resuelto': 'Sí', 'Descartado': 'Sí', 'No resuelto': 'No', 'Resuelto parcialmente': 'Sí', 'Pendiente': 'Sí' };

// Marca el resultado de una tarea YA guardada, desde su botón en la lista.
// La sincronización (Resultado/Estado agregados, equipo, incidencia) ahora
// la hace la Edge Function dentro de _guardarTareaIntervencion.
async function marcarResultadoTarea(tareaId, resultado) {
  const tarea = DATA.tareasIntervencion.find(t => t.ID_Tarea === tareaId);
  if (!tarea) return;
  const operativo = _OPERATIVO_POR_DEFECTO[resultado] || 'Sí';
  showLoading('Actualizando...');
  try {
    const { estadoAgg } = await _guardarTareaIntervencion(tarea.ID_Intervencion, tarea.Descripcion, resultado, operativo, tarea.Observaciones, tareaId);
    _renderTareasEnModal(tarea.ID_Intervencion);
    showToast(`Tarea → ${resultado}. Actuación → ${estadoAgg}`, 'success');
    renderEquipos(); renderProximasVisitas(); renderIntervenciones(); renderIncidencias(); renderDashboard(); updateBadges();
  } catch(e) { showToast('Error actualizando la tarea', 'error'); console.error(e); }
  hideLoading();
}

async function guardarActuacion(finalizar) {
  const equipoDirecto = v('act-equipo-directo');
  const desc = v('act-descripcion');

  // ── MODO DIRECTO: crear nueva intervención + primera tarea (Pendiente) ───
  // Aquí sí hace falta una tarea: sin ella no hay nada que crear todavía.
  if (equipoDirecto) {
    if (!desc) {
      if (finalizar) { closeModal('modal-registrar-actuacion'); renderAll(); }
      return;
    }
    const fechaReal = v('act-fecha-real');
    if (!fechaReal) { showToast('La fecha de realización es obligatoria', 'error'); return; }
    const tipoEjec     = document.querySelector('input[name="act-tipo-ejec"]:checked')?.value || 'Interna';
    const realizadoPor = tipoEjec === 'Interna' ? v('act-realizado-por') : '';
    const proveedorExt = tipoEjec === 'Externa' ? v('act-proveedor-ext') : '';
    const coste        = tipoEjec === 'Externa' ? (v('act-coste') || '') : '';
    const tipoInt = v('act-tipo-int') || 'Correctivo';
    showLoading('Guardando intervención...');
    let intervencion;
    try {
      ({ intervencion } = await callEdgeFunction('gestionar-intervencion', {
        accion: 'crear', id_equipo: equipoDirecto, tipo: tipoInt, origen: 'Manual',
        fecha_realizacion: fechaReal, realizado_por: realizadoPor, proveedor: proveedorExt,
        coste_intervencion: coste, estado: 'Planificada',
      }));
      DATA.intervenciones.push(_intervencionSbToObj(intervencion));
    } catch(e) { showToast('Error guardando', 'error'); console.error(e); hideLoading(); return; }

    // El adjunto se sube DESPUÉS de crear la intervención: la ruta de Storage
    // se organiza por ID_Intervencion, que hasta aquí no existía todavía.
    if (_pendingActFileBase64) {
      showLoading('Subiendo documento...');
      try {
        const path = await subirDocumento('actuacion', intervencion.id_intervencion, _pendingActFileBase64.data, _pendingActFileBase64.name, _pendingActFileBase64.type);
        const { intervencion: actualizada } = await callEdgeFunction('gestionar-intervencion', {
          accion: 'actualizar', id_intervencion: intervencion.id_intervencion,
          url_adjunto: path, nombre_adjunto: _pendingActFileBase64.name,
        });
        DATA.intervenciones[DATA.intervenciones.length - 1] = _intervencionSbToObj(actualizada);
      } catch(e) { showToast('Intervención guardada, pero el documento no se pudo subir', 'error'); }
      _pendingActFileBase64 = null;
    }

    showLoading('Guardando...');
    try {
      await _guardarTareaIntervencion(intervencion.id_intervencion, desc, 'Pendiente', '', v('act-observaciones'));
      closeModal('modal-registrar-actuacion');
      showToast(`Intervención ${intervencion.id_intervencion} registrada. Tarea → Pendiente`, 'success');
      renderAll();
    } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
    hideLoading();
    return;
  }

  // ── MODO VINCULADO: añadir una tarea a una intervención existente ────────
  const intIdx = parseInt(v('act-int-idx'));
  const i = DATA.intervenciones[intIdx];
  if (!i) { showToast('Intervención no encontrada', 'error'); return; }

  // Los campos de visita se leen y se guardan siempre (no solo la primera vez),
  // ya que se quedan editables para poder corregirlos más adelante si hiciera falta.
  const fechaReal = v('act-fecha-real');
  if (!fechaReal) { showToast('La fecha de realización es obligatoria', 'error'); return; }
  const tipoEjec     = document.querySelector('input[name="act-tipo-ejec"]:checked')?.value || 'Interna';
  const realizadoPor = tipoEjec === 'Interna' ? v('act-realizado-por') : '';
  const proveedorExt = tipoEjec === 'Externa' ? v('act-proveedor-ext') : '';
  const coste        = tipoEjec === 'Externa' ? (v('act-coste') || '') : '';
  showLoading('Guardando...');

  let urlAdjunto, nombreAdjunto;
  if (_pendingActFileBase64) {
    showLoading('Subiendo documento...');
    try {
      urlAdjunto    = await subirDocumento('actuacion', i.ID_Intervencion, _pendingActFileBase64.data, _pendingActFileBase64.name, _pendingActFileBase64.type);
      nombreAdjunto = _pendingActFileBase64.name;
    } catch(e) { showToast('Error subiendo el PDF', 'error'); hideLoading(); return; }
    _pendingActFileBase64 = null;
  }

  try {
    const { intervencion } = await callEdgeFunction('gestionar-intervencion', {
      accion: 'actualizar', id_intervencion: i.ID_Intervencion,
      fecha_realizacion: fechaReal, realizado_por: realizadoPor, proveedor: proveedorExt,
      coste_intervencion: coste,
      ...(urlAdjunto ? { url_adjunto: urlAdjunto, nombre_adjunto: nombreAdjunto } : {}),
    });
    DATA.intervenciones[intIdx] = _intervencionSbToObj(intervencion);
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); hideLoading(); return; }

  // La tarea nueva es opcional aquí: "Guardar sin cerrar"/"Guardar y finalizar" deben
  // guardar los datos de la visita (fecha, ejecución, observaciones, adjunto) aunque
  // no se haya escrito ninguna tarea — para eso está el botón aparte "Añadir tarea".
  showLoading(desc ? 'Guardando tarea...' : 'Guardando...');
  try {
    if (desc) await _guardarTareaIntervencion(i.ID_Intervencion, desc, 'Pendiente', '', v('act-observaciones'));

    if (finalizar) {
      closeModal('modal-registrar-actuacion');
      showToast(desc ? 'Tarea añadida como Pendiente. Márcala desde la ficha cuando toque.' : 'Actuación guardada', 'success');
      renderAll();
    } else {
      if (desc) _resetCamposTarea();
      _renderTareasEnModal(i.ID_Intervencion);
      showToast(desc ? 'Tarea añadida como Pendiente. Márcala con ✓ cuando sepas el resultado.' : 'Datos de la actuación guardados', 'success');
      renderEquipos(); renderProximasVisitas(); renderIntervenciones(); renderIncidencias(); renderDashboard(); updateBadges();
    }
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// ADJUNTOS — REGISTRAR ACTUACIÓN
// ============================================================
function handleActFileSelect(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('act-pdf-name').textContent = file.name;
  document.getElementById('act-pdf-preview').style.display = 'flex';
  const reader = new FileReader();
  reader.onload = e => { _pendingActFileBase64 = { name: file.name, type: file.type, data: e.target.result.split(',')[1] }; };
  reader.readAsDataURL(file);
}
function removeActFile() {
  _pendingActFileBase64 = null;
  const preview = document.getElementById('act-pdf-preview');
  const name    = document.getElementById('act-pdf-name');
  const input   = document.getElementById('act-pdf-input');
  const url     = document.getElementById('act-pdf-url');
  if (preview) preview.style.display = 'none';
  if (name)    name.textContent = '';
  if (input)   input.value = '';
  if (url)     url.value = '';
}

// ============================================================
// ADJUNTOS — EQUIPOS
// ============================================================
function handleEqFileSelect(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('eq-pdf-name').textContent = file.name;
  document.getElementById('eq-pdf-preview').style.display = 'flex';
  const reader = new FileReader();
  reader.onload = e => { pendingEqFileBase64 = { name: file.name, type: file.type, data: e.target.result.split(',')[1] }; };
  reader.readAsDataURL(file);
}
function removeEqFile() {
  pendingEqFileBase64 = null;
  document.getElementById('eq-pdf-preview').style.display = 'none';
  document.getElementById('eq-pdf-name').textContent = '';
  document.getElementById('eq-pdf-input').value = '';
  document.getElementById('eq-pdf-url').value = '';
}

// ============================================================
// TIPO DE EQUIPO — campo libre ("Otro")
// Definido aquí para garantizar que siempre esté disponible
// (equipos.js ya no se carga como módulo independiente)
// ============================================================
function toggleTipoEquipoLibre(val) {
  const group = document.getElementById('eq-tipo-libre-group');
  if (group) group.style.display = val === 'Otro' ? '' : 'none';
  if (val !== 'Otro') sv('eq-tipo-libre', '');
}

// ============================================================
// AUTO-ID EQUIPOS
// Genera un ID automático a partir del tipo de equipo,
// siguiendo la misma lógica que autoIdMaterial.
// Solo actúa si el campo ID está vacío o contiene un valor
// que parece auto-generado (patrón PREFIX-NN).
// Si el equipo ya tiene un ID manual, no lo toca.
// ============================================================
function generarIdEquipo(tipo) {
  if (!tipo || tipo === 'Otro') return '';
  const stopWords = ['de','del','la','las','los','el','en','y','a','con','para','por'];
  const palabras = tipo.split(/[\s/]+/).filter(p => p.length > 1 && !stopWords.includes(p.toLowerCase()));
  let prefix = '';
  if (palabras.length >= 2)       prefix = (palabras[0].slice(0, 2) + palabras[1].slice(0, 1)).toUpperCase();
  else if (palabras.length === 1) prefix = palabras[0].slice(0, 3).toUpperCase();
  else                            prefix = tipo.slice(0, 3).toUpperCase();

  const existing = DATA.equipos
    .map(e => e.ID_Activo)
    .filter(id => id && id.startsWith(prefix + '-'))
    .map(id => parseInt(id.split('-')[1]) || 0);
  const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return prefix + '-' + String(nextNum).padStart(2, '0');
}

function autoIdEquipo(tipo) {
  const idField = document.getElementById('eq-id');
  if (!idField) return;
  const currentVal = idField.value;
  // Solo sobreescribir si está vacío o si el valor actual parece auto-generado
  const autoPattern = /^[A-Z]{2,4}-\d{2,}$/;
  if (currentVal && !autoPattern.test(currentVal)) return;
  const newId = generarIdEquipo(tipo);
  if (newId) idField.value = newId;
}

// ============================================================
// VALIDACIÓN DE FORMATO DE ID DE EQUIPO
// ============================================================
const _ID_DIGITOS = {
  2: ['CEN','CAB','REF','PLA','FOT','BAT','EST','PHM','OSM'],
  3: ['BAL','WAT','PIP','PIPR','AUT','AUTC','MICR','PRO']
};

function _validarFormatoIdEquipo(id) {
  const match = (id || '').match(/^([A-Za-z]+)-(\d+)$/);
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  const nDigits = match[2].length;
  for (const [esperados, prefijos] of Object.entries(_ID_DIGITOS)) {
    if (prefijos.includes(prefix) && nDigits !== parseInt(esperados)) {
      return `El ID "${id}" debería tener ${esperados} dígitos para la serie ${prefix} (ej: ${prefix}-${'0'.repeat(parseInt(esperados))}). ¿Guardarlo de todas formas?`;
    }
  }
  return null;
}

// ============================================================
// GUARDAR EQUIPO
// ============================================================
async function guardarEquipo() {
  let id = v('eq-id');
  const idOriginal = document.getElementById('eq-id').dataset.original || '';
  const tipo  = v('eq-tipo');
  const marca = v('eq-marca');
  if (!tipo)  { showToast('El tipo de equipo es obligatorio', 'error'); return; }
  if (!marca) { showToast('La marca es obligatoria', 'error'); return; }
  if (!id && !editingRow) {
    id = generarIdEquipo(tipo);
    if (!id) { showToast('No se pudo generar ID automático. Indícalo manualmente.', 'error'); return; }
    sv('eq-id', id);
  }
  if (!id) { showToast('El ID del equipo es obligatorio', 'error'); return; }

  if (!editingRow) {
    const aviso = _validarFormatoIdEquipo(id);
    if (aviso && !confirm(aviso)) return;
  }

  let manualUrl = v('eq-pdf-url') || '';
  if (pendingEqFileBase64) {
    showLoading('Subiendo manual...');
    try { manualUrl = await subirDocumento('manual', id, pendingEqFileBase64.data, pendingEqFileBase64.name, pendingEqFileBase64.type); }
    catch(e) { showToast('Error subiendo el PDF. Guardando sin él.', 'error'); }
    pendingEqFileBase64 = null;
  }

  // Periodicidad_Mantenimiento/Periodicidad_Custom/Fecha_Ultimo_Preventivo/Fecha_Proximo_Preventivo
  // (legado) gestionadas ahora por Planes_Mantenimiento + Registro_Mantenimientos — no se envían.
  // Tipo_Mantenimiento eliminado del modal — tampoco se envía, se queda vacío.
  const datos = {
    id_activo: id, tipo_equipo: tipo, marca,
    modelo: v('eq-modelo'), numero_serie: v('eq-serie'), ubicacion: v('eq-ubicacion'),
    responsable: v('eq-responsable'), modulos_responsables: v('eq-modulos-responsables'), fecha_adquisicion: v('eq-fecha-adq'),
    origen_financiacion: v('eq-financiacion'), proveedor_compra: v('eq-proveedor-compra'),
    proveedor_servicio_tecnico: v('eq-proveedor-sat'), estado_operativo: v('eq-estado'),
    manual_ficha_tecnica: manualUrl, observaciones: v('eq-observaciones'),
    coste: v('eq-coste'), protocolo_uso: v('eq-protocolo-uso'),
    mes_inicio_temporada: v('eq-mes-inicio'), mes_fin_temporada: v('eq-mes-fin'),
  };

  const cambioId = editingRow && editingRow.sheet === 'Equipos' && idOriginal && id !== idOriginal;

  showLoading('Guardando...');
  try {
    if (cambioId) {
      await callEdgeFunction('gestionar-equipo', { accion: 'cambiar_id', id_activo: idOriginal, nuevo_id_activo: id });
    }
    if (editingRow && editingRow.sheet === 'Equipos') {
      const { equipo } = await callEdgeFunction('gestionar-equipo', { accion: 'actualizar', ...datos });
      if (cambioId) {
        // El ID cambió en varias tablas relacionadas (incidencias, intervenciones,
        // mantenimiento, reservas, líneas de pedido) — recargar todo en vez de
        // parchear DATA.equipos a mano, para no dejar esos arrays con el ID viejo.
        showToast('Equipo actualizado, ID cambiado', 'success');
        closeModal('modal-equipo'); editingRow = null;
        await loadAllData(); renderAll();
        hideLoading();
        return;
      }
      DATA.equipos[editingRow.rowIndex] = _equipoSbToObj(equipo);
      showToast('Equipo actualizado', 'success');
    } else {
      const { equipo } = await callEdgeFunction('gestionar-equipo', { accion: 'crear', ...datos });
      DATA.equipos.push(_equipoSbToObj(equipo));
      showToast('Equipo guardado', 'success');
    }
    closeModal('modal-equipo'); renderAll();
  } catch(e) { showToast('Error guardando: ' + e.message, 'error'); console.error(e); }
  hideLoading(); editingRow = null;
}

// ============================================================
// GUARDAR INCIDENCIA
// ============================================================
async function guardarIncidencia() {
  const equipo = v('inc-equipo'); const desc = v('inc-descripcion');
  if (!equipo || !desc) { showToast('Equipo y descripción son obligatorios', 'error'); return; }
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const usuarioApp = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  const reportadoPor = usuarioApp?.Nombre || currentUser?.name || 'Usuario';
  showLoading('Guardando...');
  try {
    const { incidencia } = await callEdgeFunction('gestionar-incidencia', {
      accion: 'crear',
      id_equipo: (equipo || '').split(' – ')[0].trim(),
      reportado_por: reportadoPor, descripcion_problema: desc,
      impacto: v('inc-impacto'), urgencia: v('inc-urgencia'),
      relacionada_con: v('inc-relacionada') || undefined,
    });
    DATA.incidencias.push(_incidenciaSbToObj(incidencia));
    const estadoXImpacto = v('inc-impacto') === 'Equipo fuera de servicio' ? 'En revisión' : 'Operativo con fallos';
    try { await actualizarEstadoEquipo(equipo, estadoXImpacto); } catch(e) { console.warn('No se pudo actualizar estado equipo', e); }
    showToast('Incidencia reportada', 'success');
    closeModal('modal-incidencia'); renderAll();
  } catch(e) { showToast('Error guardando', 'error'); }
  hideLoading();
}

async function eliminarIncidencia(incId) {
  const idx = DATA.incidencias.findIndex(i => i.ID_Incidencia === incId);
  if (idx === -1) return;
  const inc = DATA.incidencias[idx];
  const msg = inc.Intervencion_Generada
    ? `¿Eliminar la incidencia "${incId}"?\n\nAtención: tiene la intervención ${inc.Intervencion_Generada} vinculada, que NO se eliminará.`
    : `¿Eliminar la incidencia "${incId}"? Esta acción no se puede deshacer.`;
  if (!confirm(msg)) return;
  showLoading('Eliminando...');
  try {
    await callEdgeFunction('gestionar-incidencia', { accion: 'eliminar', id_incidencia: incId });
    DATA.incidencias.splice(idx, 1);
    showToast('Incidencia eliminada', 'success');
    renderIncidencias();
  } catch(e) { showToast('Error eliminando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// ALIAS
// ============================================================
function openModalActuacionDerivada(intIdx) { openModalRegistrarActuacion(intIdx); }

function openModalRegistrarActuacionDirecta(equipoId) {
  _pendingActFileBase64 = null;
  removeActFile();

  const e = DATA.equipos.find(eq => eq.ID_Activo === equipoId);
  const eqLabel = e ? [e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' ') : equipoId;

  sv('act-equipo-directo', equipoId);
  sv('act-int-id',  '');
  sv('act-int-idx', '');

  const label = document.getElementById('act-int-label');
  const eqLbl = document.getElementById('act-equipo-label');
  if (label) label.textContent = '(nueva)';
  if (eqLbl) eqLbl.textContent = eqLabel;

  const tipoGrp = document.getElementById('act-tipo-int-group');
  if (tipoGrp) tipoGrp.style.display = '';
  // Reactivar los campos de visita (una llamada previa a openModalRegistrarActuacion
  // pudo haberlos dejado bloqueados tras registrar una tarea sobre otra intervención)
  ['act-fecha-real','act-ejec-interna','act-ejec-externa','act-realizado-por','act-proveedor-ext','act-coste'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
  const tareasLista = document.getElementById('act-tareas-lista');
  if (tareasLista) tareasLista.innerHTML = '';

  sv('act-fecha-real',    new Date().toISOString().split('T')[0]);
  _resetCamposTarea();
  sv('act-coste',         '');
  sv('act-pdf-url',       '');

  poblarSelects();
  const selUser = document.getElementById('act-realizado-por');
  if (selUser) {
    selUser.innerHTML = '<option value="">Seleccionar usuario...</option>' +
      DATA.usuarios.filter(u => u.Activo !== 'FALSE').map(u => `<option value="${u.Nombre}">${u.Nombre}</option>`).join('');
  }
  const listProv = document.getElementById('act-proveedor-ext-list');
  if (listProv) {
    listProv.innerHTML = DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">`).join('');
  }
  sv('act-proveedor-ext', '');

  const radInterna = document.getElementById('act-ejec-interna');
  if (radInterna) { radInterna.checked = true; toggleActEjecucion('Interna'); }

  openModal('modal-registrar-actuacion');
}

// ============================================================
// ADJUNTAR FACTURA Y CERRAR (intervenciones "Pendiente factura")
// ============================================================
let _pendingFacturaBase64 = null;

function openModalAdjuntarFactura(intIdx) {
  _pendingFacturaBase64 = null;
  sv('factura-int-idx', String(intIdx));
  sv('factura-pdf-url', '');
  document.getElementById('factura-pdf-preview').style.display = 'none';
  const inp = document.getElementById('factura-pdf-input');
  if (inp) inp.value = '';
  openModal('modal-adjuntar-factura');
}

function handleFacturaFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _pendingFacturaBase64 = { data: e.target.result.split(',')[1], name: file.name, type: file.type };
    document.getElementById('factura-pdf-preview').style.display = 'flex';
    document.getElementById('factura-pdf-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function removeFacturaFile() {
  _pendingFacturaBase64 = null;
  sv('factura-pdf-url', '');
  document.getElementById('factura-pdf-preview').style.display = 'none';
  const inp = document.getElementById('factura-pdf-input');
  if (inp) inp.value = '';
}

async function guardarFactura() {
  const intIdx = parseInt(v('factura-int-idx'));
  const i = DATA.intervenciones[intIdx];
  if (!i) { showToast('Intervención no encontrada', 'error'); return; }

  let urlAdjunto = i.URL_Adjunto || '', nombreAdjunto = i.Nombre_Adjunto || '';
  if (_pendingFacturaBase64) {
    showLoading('Subiendo factura...');
    try {
      urlAdjunto    = await subirDocumento('actuacion', i.ID_Intervencion, _pendingFacturaBase64.data, _pendingFacturaBase64.name, _pendingFacturaBase64.type);
      nombreAdjunto = _pendingFacturaBase64.name;
    } catch(e) { showToast('Error subiendo la factura', 'error'); hideLoading(); return; }
    _pendingFacturaBase64 = null;
  }

  showLoading('Cerrando intervención...');
  try {
    const operativo = i.Equipo_Operativo_Tras_Intervencion;
    const { intervencion } = await callEdgeFunction('gestionar-intervencion', {
      accion: 'actualizar', id_intervencion: i.ID_Intervencion,
      url_adjunto: urlAdjunto, nombre_adjunto: nombreAdjunto, estado: 'Cerrada',
      estado_equipo: operativo === 'No' ? 'No operativo' : 'Operativo',
      incidencia_estado: 'Resuelta',
    });
    DATA.intervenciones[intIdx] = _intervencionSbToObj(intervencion);
    const incIdxLocal = DATA.incidencias.findIndex(x => x.Intervencion_Generada === i.ID_Intervencion);
    if (incIdxLocal !== -1 && !['Resuelta','Descartada'].includes(DATA.incidencias[incIdxLocal].Estado)) {
      DATA.incidencias[incIdxLocal].Estado = 'Resuelta';
    }

    closeModal('modal-adjuntar-factura');
    showToast('Intervención cerrada. Factura adjunta.', 'success');
    renderAll();
  } catch(e) { showToast('Error cerrando la intervención', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// AUTOCOMPLETE UBICACIÓN — MODAL EQUIPO
// ============================================================
function buscarUbicacionEquipo(query) {
  const list = document.getElementById('eq-ubicacion-autocomplete');
  if (!list) return;
  if (!query || query.length < 1) { list.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const resultados = DATA.ubicaciones.filter(u =>
    u.Activa !== 'FALSE' &&
    (u.ID_Ubicacion.toLowerCase().includes(q) ||
     (u.Laboratorio_Aula || '').toLowerCase().includes(q) ||
     (u.Zona || '').toLowerCase().includes(q))
  ).slice(0, 8);
  if (!resultados.length) { list.classList.remove('open'); return; }
  list.innerHTML = resultados.map(u => {
    const label = (u.Laboratorio_Aula || '') + (u.Zona ? ' · ' + u.Zona : '');
    return `<div class="autocomplete-item" onclick="seleccionarUbicacionEquipo('${u.ID_Ubicacion}','${label.replace(/'/g,"\\'")}')">
      <div><div class="autocomplete-item-name">${u.ID_Ubicacion}</div><div class="autocomplete-item-meta">${label}</div></div>
    </div>`;
  }).join('');
  list.classList.add('open');
}

function seleccionarUbicacionEquipo(id, label) {
  document.getElementById('eq-ubicacion').value = id;
  document.getElementById('eq-ubicacion-search').value = '';
  const sel = document.getElementById('eq-ubicacion-selected');
  const txt = document.getElementById('eq-ubicacion-selected-text');
  if (sel) sel.style.display = 'flex';
  if (txt) txt.textContent = id + (label ? ' – ' + label : '');
  const list = document.getElementById('eq-ubicacion-autocomplete');
  if (list) list.classList.remove('open');
}

function clearUbicacionEquipo() {
  document.getElementById('eq-ubicacion').value = '';
  document.getElementById('eq-ubicacion-search').value = '';
  const sel = document.getElementById('eq-ubicacion-selected');
  if (sel) sel.style.display = 'none';
}

// ============================================================
// AUTOCOMPLETE EQUIPO EN INCIDENCIA
// ============================================================
function buscarEquipoIncidencia(query) {
  const list = document.getElementById('inc-equipo-autocomplete');
  if (!list) return;
  if (!query || query.length < 1) { list.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const resultados = DATA.equipos.filter(e =>
    e.ID_Activo.toLowerCase().includes(q) ||
    (e.Tipo_Equipo || '').toLowerCase().includes(q) ||
    (e.Marca || '').toLowerCase().includes(q) ||
    (e.Modelo || '').toLowerCase().includes(q) ||
    (e.Ubicacion || '').toLowerCase().includes(q)
  ).slice(0, 8);
  if (!resultados.length) { list.classList.remove('open'); return; }
  list.innerHTML = resultados.map(e => {
    const label = [e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' ');
    const meta  = e.Ubicacion ? getNombreUbicacion(e.Ubicacion) : '';
    return `<div class="autocomplete-item" onclick="seleccionarEquipoIncidencia('${e.ID_Activo}','${label.replace(/'/g,"\\'")}')">
      <div>
        <div class="autocomplete-item-name">${e.ID_Activo} – ${label}</div>
        ${meta ? `<div class="autocomplete-item-meta">${meta}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  list.classList.add('open');
}

function seleccionarEquipoIncidencia(id, label) {
  document.getElementById('inc-equipo').value = id + (label ? ' – ' + label : '');
  const srch = document.getElementById('inc-equipo-search'); if (srch) srch.value = '';
  const sel  = document.getElementById('inc-equipo-selected');
  const txt  = document.getElementById('inc-equipo-selected-text');
  if (sel) sel.style.display = 'flex';
  if (txt) txt.textContent = id + (label ? ' – ' + label : '');
  const list = document.getElementById('inc-equipo-autocomplete');
  if (list) list.classList.remove('open');
  poblarIncidenciasRelacionadas(id);
}

function limpiarEquipoIncidencia() {
  sv('inc-equipo', '');
  const srch = document.getElementById('inc-equipo-search'); if (srch) srch.value = '';
  const sel  = document.getElementById('inc-equipo-selected'); if (sel) sel.style.display = 'none';
  const list = document.getElementById('inc-equipo-autocomplete'); if (list) list.classList.remove('open');
  document.getElementById('inc-equipo-search')?.focus();
}

// ============================================================
// AVISO DE ALUMNO — notificación de problema con equipo
// ============================================================
function openModalAvisoAlumno(equipoId) {
  const e = DATA.equipos.find(eq => eq.ID_Activo === equipoId);
  document.getElementById('aviso-equipo-id').value = equipoId;
  const label = e ? [e.ID_Activo, e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' · ') : equipoId;
  document.getElementById('aviso-equipo-label').textContent = label;
  // Reset form
  document.querySelectorAll('input[name="aviso-uso"]').forEach(r => { r.checked = false; });
  sv('aviso-descripcion', '');
  openModal('modal-aviso-alumno');
}

async function guardarAvisoAlumno() {
  const equipoId  = document.getElementById('aviso-equipo-id').value;
  const impacto   = document.querySelector('input[name="aviso-uso"]:checked')?.value;
  const desc      = v('aviso-descripcion');
  if (!impacto) { showToast('Indica cómo afecta al uso del equipo', 'error'); return; }
  if (!desc)    { showToast('Describe el problema', 'error'); return; }

  showLoading('Enviando aviso...');
  try {
    const { incidencia } = await callEdgeFunction('gestionar-incidencia', {
      accion: 'crear', id_equipo: equipoId,
      reportado_por: currentUser?.name || 'Usuario',
      descripcion_problema: desc, impacto, urgencia: 'Normal',
    });
    DATA.incidencias.push(_incidenciaSbToObj(incidencia));
    showToast('Aviso enviado. El profesorado será notificado.', 'success');
    closeModal('modal-aviso-alumno');
    renderIncidencias();
    renderDashboard();
    updateBadges();
  } catch(e) { showToast('Error enviando el aviso', 'error'); console.error(e); }
  hideLoading();
}
