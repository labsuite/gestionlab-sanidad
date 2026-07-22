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
  const eqRow = [eq.ID_Activo, eq.Tipo_Equipo, eq.Marca, eq.Modelo, eq.Numero_Serie,
    eq.Ubicacion, eq.Responsable, eq.Fecha_Adquisicion, eq.Origen_Financiacion,
    eq.Proveedor_Compra, eq.Proveedor_Servicio_Tecnico, nuevoEstado,
    eq.Periodicidad_Mantenimiento, eq.Periodicidad_Custom, eq.Fecha_Ultimo_Preventivo,
    eq.Fecha_Proximo_Preventivo, eq.Manual_Ficha_Tecnica, eq.Observaciones, eq.Coste||'',
    eq.Protocolo_Uso||'', eq.Tipo_Mantenimiento||'', eq.Mes_Inicio_Temporada||'', eq.Mes_Fin_Temporada||''];
  await sheetsUpdate(`Equipos!A${eqIdx + 2}:W${eqIdx + 2}`, eqRow);
}

// ============================================================
// MODALES EQUIPOS
// ============================================================
function openModalEquipo() {
  editingRow = null; pendingEqFileBase64 = null;
  document.getElementById('modal-equipo-title').textContent = 'Nuevo equipo';
  const idFieldN = document.getElementById('eq-id');
  idFieldN.value = ''; idFieldN.readOnly = false; idFieldN.style.opacity = '';
  ['eq-marca','eq-modelo','eq-serie','eq-fecha-adq','eq-coste','eq-observaciones'].forEach(id => sv(id,''));
  ['eq-tipo','eq-financiacion','eq-proveedor-compra','eq-proveedor-sat'].forEach(id => sv(id,''));
  _initResponsables(''); // limpia tags responsable
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
  idField.readOnly = true;
  idField.style.opacity = '0.6';
  sv('eq-tipo',e.Tipo_Equipo); sv('eq-marca',e.Marca);
  sv('eq-modelo',e.Modelo); sv('eq-serie',e.Numero_Serie); sv('eq-ubicacion',e.Ubicacion);
  _initResponsables(e.Responsable); sv('eq-fecha-adq',e.Fecha_Adquisicion);
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

async function eliminarEquipo() {
  const e = DATA.equipos[editingRow.rowIndex];
  if (!confirm(`¿Eliminar "${e.ID_Activo} — ${e.Marca} ${e.Modelo}" del inventario? Esta acción no se puede deshacer.`)) return;
  showLoading('Eliminando...');
  try {
    await sheetsDeleteRow('Equipos', editingRow.rowIndex);
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
  const label = document.getElementById('plan-inc-label');
  if (label) label.textContent = incId + ' (' + equipo + ')';
  const intro = document.getElementById('plan-intro-texto');
  const titulo = document.getElementById('plan-modal-title');
  const ayuda  = document.getElementById('plan-ayuda-texto');
  const pendWrap  = document.getElementById('plan-pendientes-wrap');
  const pendLista = document.getElementById('plan-pendientes-lista');
  if (origenIntId) {
    if (intro) intro.textContent = 'Programando una nueva visita de seguimiento sobre la incidencia';
    if (titulo) titulo.textContent = '📅 Programar próxima visita';
    if (ayuda) ayuda.innerHTML = 'Esta incidencia sigue abierta y hace falta volver otro día. Marca abajo lo pendiente que corresponda a esta visita — puede que no sea todo (p.ej. si hay tareas para especialistas distintos).';
    const sinResolver = t => ['Pendiente', 'Resuelto parcialmente', 'No resuelto'].includes(t.Resultado);
    const pendientes = getTareasIntervencion(origenIntId).filter(sinResolver);
    if (pendWrap && pendLista) {
      if (pendientes.length) {
        pendWrap.style.display = '';
        pendLista.innerHTML = pendientes.map((t, idx) => `<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:13px">
          <input type="checkbox" class="plan-pendiente-check" value="${t.Descripcion.replace(/"/g, '&quot;')}" style="margin-top:2px">
          <span>${t.Descripcion} <span class="badge ${_RESULTADO_BADGE[t.Resultado]||'badge-gray'}" style="font-size:10px">${t.Resultado}</span></span>
        </label>`).join('');
      } else {
        pendWrap.style.display = 'none';
        pendLista.innerHTML = '';
      }
    }
  } else {
    if (intro) intro.textContent = 'Creando intervención en respuesta a la incidencia';
    if (titulo) titulo.textContent = '🗓 Responder a la incidencia';
    if (ayuda) ayuda.innerHTML = 'Esto solo deja anotado "esto se va a atender" — no hace falta que ya sepas cuándo. Cuando la visita ocurra, la registrarás como una <strong>Intervención</strong> con sus <strong>Tareas</strong> desde "Ejecutar", en "Próximas visitas".';
    if (pendWrap) pendWrap.style.display = 'none';
    if (pendLista) pendLista.innerHTML = '';
  }
  sv('plan-tipo', 'Correctivo');
  sv('plan-fecha', '');
  sv('plan-descripcion', '');
  sv('plan-tareas-previstas', '');

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

  openModal('modal-planificar-intervencion');
}

function _toggleEjecucionPlan(tipo) {
  const intGrp = document.getElementById('plan-interna-group');
  const extGrp = document.getElementById('plan-externa-group');
  if (intGrp) intGrp.style.display = tipo === 'Interna' ? '' : 'none';
  if (extGrp) extGrp.style.display = tipo === 'Externa' ? '' : 'none';
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

async function guardarPlanificacion() {
  const incId  = v('plan-inc-id');
  const equipo = v('plan-equipo');
  const fecha  = v('plan-fecha');
  const origenIntId = v('plan-origen-int');
  const tipoEjecPlan = document.querySelector('input[name="plan-tipo-ejec"]:checked')?.value || 'Interna';
  const realizadoPorPlan = tipoEjecPlan === 'Interna' ? v('plan-realizado-por') : '';
  const proveedorPlan    = tipoEjecPlan === 'Externa' ? v('plan-proveedor-ext') : '';

  const id  = genId('INT-');
  const row = [
    id,            // A ID_Intervencion
    equipo,        // B Equipo
    v('plan-tipo'),// C Tipo
    origenIntId ? ('Seguimiento de ' + origenIntId) : 'Incidencia reportada', // D Origen
    fecha,         // E Fecha_Planificada
    '',            // F Fecha_Realizacion
    realizadoPorPlan, // G Realizado_Por
    '',            // H Tecnico_Externo
    proveedorPlan, // I Proveedor
    '',            // J Descripcion_Actuacion  (vacío hasta registrar)
    '',            // K Resultado
    '',            // L Equipo_Operativo
    '',            // M URL_Adjunto
    '',            // N Factura_Asociada
    '',            // O (legacy)
    v('plan-descripcion'), // P Observaciones
    '',            // Q Nombre_Adjunto
    'Planificada', // R Estado
    '',            // S Fecha_Estimada_Resolucion (ya no se pide al planificar)
    ''             // T Coste_Intervencion
  ];

  showLoading('Guardando...');
  try {
    await sheetsAppend('Intervenciones', row);
    DATA.intervenciones.push(rowToObj(row, 'intervenciones'));

    // Tareas ya previstas para esa visita: las marcadas de "pendiente de la visita
    // anterior" + las escritas a mano. Se guardan como Pendiente, sin tocar los
    // datos de ejecución (fecha real, quién...) — eso se rellena al ejecutar.
    const pendientesMarcadas = Array.from(document.querySelectorAll('.plan-pendiente-check:checked')).map(el => el.value);
    const tareasEscritas = v('plan-tareas-previstas').split('\n').map(s => s.trim()).filter(Boolean);
    for (const desc of [...pendientesMarcadas, ...tareasEscritas]) {
      await _guardarTareaIntervencion(id, desc, 'Pendiente', '', '');
    }

    // Actualizar incidencia: Estado → En gestión, y apuntar siempre a esta intervención
    // (tanto en la planificación inicial como al programar una visita de seguimiento).
    const incIdx = DATA.incidencias.findIndex(x => x.ID_Incidencia === incId);
    if (incIdx !== -1) {
      const inc = DATA.incidencias[incIdx];
      inc.Estado = 'En gestión';
      inc.Intervencion_Generada = id;
      const incRow = [inc.ID_Incidencia, inc.Equipo, inc.Reportado_Por, inc.Fecha_Hora, inc.Descripcion_Problema, inc.Impacto, inc.Urgencia, inc.Estado, inc.Intervencion_Generada, inc.Relacionada_Con || ''];
      await sheetsUpdate(`Incidencias!A${incIdx + 2}:J${incIdx + 2}`, incRow);
    }

    showToast('Intervención planificada. Incidencia → En gestión', 'success');
    // El equipo ya debería estar En mantenimiento desde guardarIncidencia,
    // pero lo reforzamos aquí por si la incidencia llegó por otra vía.
    try { await actualizarEstadoEquipo(equipo, 'Revisión planificada'); } catch(e) { console.warn(e); }
    closeModal('modal-planificar-intervencion');
    renderAll();
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

function calcularResultadoAgregado(tareas) {
  if (!tareas.length) return '';
  if (tareas.some(t => t.Resultado === 'Pendiente')) return 'Pendiente';
  if (tareas.every(t => t.Resultado === 'Resuelto' || t.Resultado === 'Descartado')) {
    return tareas.some(t => t.Resultado === 'Resuelto') ? 'Resuelto' : 'Descartado';
  }
  return 'Resuelto parcialmente';
}

function calcularEstadoIntervencion(resultadoAgregado, tipoEjec) {
  if (!resultadoAgregado) return 'Planificada';
  if (resultadoAgregado === 'Pendiente' || resultadoAgregado === 'Resuelto parcialmente') return 'En gestión';
  if (resultadoAgregado === 'Resuelto' && tipoEjec === 'Externa') return 'Pendiente factura';
  return 'Cerrada'; // Resuelto interno, o Descartado
}

// tareaOrigenId: si se pasa, actualiza esa fila de Tareas_Intervencion en vez de
// crear una nueva — lo usa marcarResultadoTarea() para fijar el resultado de una
// tarea ya guardada (p.ej. una prevista al planificar, ver plan-tareas-previstas).
async function _guardarTareaIntervencion(intId, descripcion, resultado, operativo, observaciones, tareaOrigenId) {
  if (tareaOrigenId) {
    const idx = DATA.tareasIntervencion.findIndex(t => t.ID_Tarea === tareaOrigenId && t.ID_Intervencion === intId);
    if (idx !== -1) {
      const row = [tareaOrigenId, intId, descripcion, resultado, operativo, observaciones || ''];
      await sheetsUpdate(`Tareas_Intervencion!A${idx + 2}:F${idx + 2}`, row);
      DATA.tareasIntervencion[idx] = rowToObj(row, 'tareasIntervencion');
      return tareaOrigenId;
    }
  }
  const idTarea = genId('TSK-');
  const row = [idTarea, intId, descripcion, resultado, operativo, observaciones || ''];
  await sheetsAppend('Tareas_Intervencion', row);
  DATA.tareasIntervencion.push(rowToObj(row, 'tareasIntervencion'));
  return idTarea;
}

const _RESULTADO_BADGE = {'Resuelto':'badge-green','Resuelto parcialmente':'badge-orange','Pendiente':'badge-blue','No resuelto':'badge-red','Descartado':'badge-gray'};

function _renderTareasEnModal(intId) {
  const cont = document.getElementById('act-tareas-lista');
  if (!cont) return;
  const tareas = getTareasIntervencion(intId);
  if (!tareas.length) {
    cont.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Aún no hay tareas registradas en esta visita.</div>';
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

  // Los campos de visita (fecha, ejecución, coste) solo se piden la primera vez;
  // si la visita ya empezó, se muestran fijos para no reescribirlos por accidente.
  const visitaIniciada = !!i.Fecha_Realizacion;
  const camposVisita = ['act-fecha-real','act-ejec-interna','act-ejec-externa','act-realizado-por','act-proveedor-ext','act-coste'];
  camposVisita.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = visitaIniciada; });

  if (visitaIniciada) {
    sv('act-fecha-real', i.Fecha_Realizacion);
    sv('act-coste', i.Coste_Intervencion || '');
    const esExterna = !!i.Proveedor;
    const radInterna = document.getElementById('act-ejec-interna');
    const radExterna = document.getElementById('act-ejec-externa');
    if (esExterna) { if (radExterna) radExterna.checked = true; sv('act-proveedor-ext', i.Proveedor); }
    else { if (radInterna) radInterna.checked = true; sv('act-realizado-por', i.Realizado_Por); }
    toggleActEjecucion(esExterna ? 'Externa' : 'Interna');
  } else {
    sv('act-fecha-real', new Date().toISOString().split('T')[0]);
    sv('act-coste', '');
    // Si ya se indicó quién la haría al planificar, se precarga aquí (editable, por si cambia)
    const esExternaPlan = !!i.Proveedor;
    const radInterna = document.getElementById('act-ejec-interna');
    const radExterna = document.getElementById('act-ejec-externa');
    if (esExternaPlan) { if (radExterna) radExterna.checked = true; sv('act-proveedor-ext', i.Proveedor); }
    else { if (radInterna) radInterna.checked = true; if (i.Realizado_Por) sv('act-realizado-por', i.Realizado_Por); }
    toggleActEjecucion(esExternaPlan ? 'Externa' : 'Interna');
  }

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

// ============================================================
// SINCRONIZAR INTERVENCIÓN — recalcula Resultado/Estado a partir de las
// tareas actuales, guarda la fila y propaga a Estado_Operativo del equipo
// y al estado de la incidencia vinculada. Se llama tras cualquier cambio
// en las tareas (añadir una, o marcar el resultado de una ya existente).
// ============================================================
async function _sincronizarIntervencion(intIdx, operativoTarea) {
  const i = DATA.intervenciones[intIdx];
  const tareas       = getTareasIntervencion(i.ID_Intervencion);
  const resultadoAgg = calcularResultadoAgregado(tareas);
  const tipoEjec      = i.Proveedor ? 'Externa' : 'Interna';
  const estadoAgg     = calcularEstadoIntervencion(resultadoAgg, tipoEjec);

  const updatedRow = [
    i.ID_Intervencion, i.Equipo, i.Tipo,
    i.Origen || 'Incidencia reportada',
    i.Fecha_Planificada || '', i.Fecha_Realizacion || '', i.Realizado_Por || '', '', i.Proveedor || '',
    i.Descripcion_Actuacion || '', // legado — solo relevante en intervenciones previas a este cambio
    resultadoAgg, operativoTarea || i.Equipo_Operativo_Tras_Intervencion || '',
    i.URL_Adjunto || '', '', '',
    i.Observaciones || '', i.Nombre_Adjunto || '', estadoAgg,
    i.Fecha_Estimada_Resolucion || '', i.Coste_Intervencion || ''
  ];
  await sheetsUpdate(`Intervenciones!A${intIdx + 2}:T${intIdx + 2}`, updatedRow);
  DATA.intervenciones[intIdx] = rowToObj(updatedRow, 'intervenciones');

  if (operativoTarea) {
    const estadoEquipo = (resultadoAgg === 'Resuelto' || resultadoAgg === 'Descartado')
      ? (operativoTarea === 'Sí' ? 'Operativo' : 'No operativo')
      : (operativoTarea === 'Sí' ? 'Operativo con fallos' : 'No operativo');
    try { await actualizarEstadoEquipo(i.Equipo, estadoEquipo); } catch(e) { console.warn(e); }
  }

  const incIdx = DATA.incidencias.findIndex(x => x.Intervencion_Generada === i.ID_Intervencion);
  if (incIdx !== -1) {
    const inc = DATA.incidencias[incIdx];
    if (!['Resuelta','Descartada'].includes(inc.Estado)) {
      const nuevoEstadoInc = estadoAgg === 'Cerrada' ? (resultadoAgg === 'Descartado' ? 'Descartada' : 'Resuelta') : 'En gestión';
      if (nuevoEstadoInc !== inc.Estado) {
        inc.Estado = nuevoEstadoInc;
        const incRow = [inc.ID_Incidencia, inc.Equipo, inc.Reportado_Por, inc.Fecha_Hora, inc.Descripcion_Problema, inc.Impacto, inc.Urgencia, inc.Estado, inc.Intervencion_Generada, inc.Relacionada_Con || ''];
        await sheetsUpdate(`Incidencias!A${incIdx + 2}:J${incIdx + 2}`, incRow);
      }
    }
  }
  return { resultadoAgg, estadoAgg };
}

// Marca el resultado de una tarea YA guardada, desde su botón en la lista.
async function marcarResultadoTarea(tareaId, resultado) {
  const tarea = DATA.tareasIntervencion.find(t => t.ID_Tarea === tareaId);
  if (!tarea) return;
  const intIdx = DATA.intervenciones.findIndex(x => x.ID_Intervencion === tarea.ID_Intervencion);
  if (intIdx === -1) return;
  const operativo = _OPERATIVO_POR_DEFECTO[resultado] || 'Sí';
  showLoading('Actualizando...');
  try {
    await _guardarTareaIntervencion(tarea.ID_Intervencion, tarea.Descripcion, resultado, operativo, tarea.Observaciones, tareaId);
    const { estadoAgg } = await _sincronizarIntervencion(intIdx, operativo);
    _renderTareasEnModal(tarea.ID_Intervencion);
    showToast(`Tarea → ${resultado}. Visita → ${estadoAgg}`, 'success');
    renderEquipos(); renderProximasVisitas(); renderIntervenciones(); renderIncidencias(); renderDashboard(); updateBadges();
  } catch(e) { showToast('Error actualizando la tarea', 'error'); console.error(e); }
  hideLoading();
}

async function guardarActuacion(finalizar) {
  const equipoDirecto = v('act-equipo-directo');
  const desc = v('act-descripcion');

  // Nada nuevo que anotar: si solo se pide finalizar, cerramos sin más.
  if (!desc) {
    if (finalizar) { closeModal('modal-registrar-actuacion'); renderAll(); }
    else showToast('Escribe una descripción para añadir la tarea', 'error');
    return;
  }

  // ── MODO DIRECTO: crear nueva intervención + primera tarea (Pendiente) ───
  if (equipoDirecto) {
    const fechaReal = v('act-fecha-real');
    if (!fechaReal) { showToast('La fecha de realización es obligatoria', 'error'); return; }
    const tipoEjec     = document.querySelector('input[name="act-tipo-ejec"]:checked')?.value || 'Interna';
    const realizadoPor = tipoEjec === 'Interna' ? v('act-realizado-por') : '';
    const proveedorExt = tipoEjec === 'Externa' ? v('act-proveedor-ext') : '';
    const coste        = tipoEjec === 'Externa' ? (v('act-coste') || '') : '';
    const tipoInt = v('act-tipo-int') || 'Correctivo';
    const nuevoId = genId('INT-');
    let urlAdjunto = '', nombreAdjunto = '';
    if (_pendingActFileBase64) {
      showLoading('Subiendo documento...');
      try {
        urlAdjunto    = await uploadFileToDrive(_pendingActFileBase64.data, _pendingActFileBase64.name, _pendingActFileBase64.type);
        nombreAdjunto = _pendingActFileBase64.name;
      } catch(e) { showToast('Error subiendo el PDF', 'error'); hideLoading(); return; }
      _pendingActFileBase64 = null;
    }
    const row = [
      nuevoId, equipoDirecto, tipoInt, 'Manual', '',
      fechaReal, realizadoPor, '', proveedorExt, '',
      '', '', urlAdjunto, '', '',
      '', nombreAdjunto, 'Planificada', '', coste
    ];
    showLoading('Guardando intervención...');
    try {
      await sheetsAppend('Intervenciones', row);
      DATA.intervenciones.push(rowToObj(row, 'intervenciones'));
      const intIdx = DATA.intervenciones.length - 1;
      await _guardarTareaIntervencion(nuevoId, desc, 'Pendiente', '', v('act-observaciones'));
      await _sincronizarIntervencion(intIdx);
      closeModal('modal-registrar-actuacion');
      showToast(`Intervención ${nuevoId} registrada. Tarea → Pendiente`, 'success');
      renderAll();
    } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
    hideLoading();
    return;
  }

  // ── MODO VINCULADO: añadir una tarea a una intervención existente ────────
  const intIdx = parseInt(v('act-int-idx'));
  const i = DATA.intervenciones[intIdx];
  if (!i) { showToast('Intervención no encontrada', 'error'); return; }

  const visitaIniciada = !!i.Fecha_Realizacion;

  if (!visitaIniciada) {
    const fechaReal = v('act-fecha-real');
    if (!fechaReal) { showToast('La fecha de realización es obligatoria', 'error'); return; }
    const tipoEjec     = document.querySelector('input[name="act-tipo-ejec"]:checked')?.value || 'Interna';
    const realizadoPor = tipoEjec === 'Interna' ? v('act-realizado-por') : '';
    const proveedorExt = tipoEjec === 'Externa' ? v('act-proveedor-ext') : '';
    const coste        = tipoEjec === 'Externa' ? (v('act-coste') || '') : '';
    showLoading('Guardando...');
    // Fijar los datos de la visita ahora, la primera vez — el resultado de las
    // tareas se marca luego, una a una, desde la lista.
    const rowVisita = [
      i.ID_Intervencion, i.Equipo, i.Tipo, i.Origen || 'Incidencia reportada',
      i.Fecha_Planificada || '', fechaReal, realizadoPor, '', proveedorExt,
      i.Descripcion_Actuacion || '', i.Resultado || '', i.Equipo_Operativo_Tras_Intervencion || '',
      i.URL_Adjunto || '', '', '', i.Observaciones || '', i.Nombre_Adjunto || '', i.Estado || 'Planificada',
      i.Fecha_Estimada_Resolucion || '', coste
    ];
    await sheetsUpdate(`Intervenciones!A${intIdx + 2}:T${intIdx + 2}`, rowVisita);
    DATA.intervenciones[intIdx] = rowToObj(rowVisita, 'intervenciones');
  }

  if (_pendingActFileBase64) {
    showLoading('Subiendo documento...');
    let urlAdjunto, nombreAdjunto;
    try {
      urlAdjunto    = await uploadFileToDrive(_pendingActFileBase64.data, _pendingActFileBase64.name, _pendingActFileBase64.type);
      nombreAdjunto = _pendingActFileBase64.name;
    } catch(e) { showToast('Error subiendo el PDF', 'error'); hideLoading(); return; }
    _pendingActFileBase64 = null;
    const iAct = DATA.intervenciones[intIdx];
    const rowAdj = [
      iAct.ID_Intervencion, iAct.Equipo, iAct.Tipo, iAct.Origen, iAct.Fecha_Planificada || '',
      iAct.Fecha_Realizacion || '', iAct.Realizado_Por || '', '', iAct.Proveedor || '',
      iAct.Descripcion_Actuacion || '', iAct.Resultado || '', iAct.Equipo_Operativo_Tras_Intervencion || '',
      urlAdjunto, '', '', iAct.Observaciones || '', nombreAdjunto, iAct.Estado,
      iAct.Fecha_Estimada_Resolucion || '', iAct.Coste_Intervencion || ''
    ];
    await sheetsUpdate(`Intervenciones!A${intIdx + 2}:T${intIdx + 2}`, rowAdj);
    DATA.intervenciones[intIdx] = rowToObj(rowAdj, 'intervenciones');
  }

  showLoading('Guardando tarea...');
  try {
    await _guardarTareaIntervencion(i.ID_Intervencion, desc, 'Pendiente', '', v('act-observaciones'));
    await _sincronizarIntervencion(intIdx);

    if (finalizar) {
      closeModal('modal-registrar-actuacion');
      showToast('Tarea añadida como Pendiente. Márcala desde la ficha cuando toque.', 'success');
      renderAll();
    } else {
      _resetCamposTarea();
      ['act-fecha-real','act-ejec-interna','act-ejec-externa','act-realizado-por','act-proveedor-ext','act-coste'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
      _renderTareasEnModal(i.ID_Intervencion);
      showToast('Tarea añadida como Pendiente. Márcala con ✓ cuando sepas el resultado.', 'success');
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
    try { manualUrl = await uploadFileToDrive(pendingEqFileBase64.data, pendingEqFileBase64.name, pendingEqFileBase64.type); }
    catch(e) { showToast('Error subiendo el PDF. Guardando sin él.', 'error'); }
    pendingEqFileBase64 = null;
  }

  // Columnas M-P (Periodicidad_Mantenimiento, Periodicidad_Custom, Fecha_Ultimo_Preventivo, Fecha_Proximo_Preventivo)
  // gestionadas ahora por Planes_Mantenimiento + Registro_Mantenimientos — se mantienen vacías
  // Columna U (Tipo_Mantenimiento) eliminada del modal — se deja vacía
  const row = [id, tipo, marca, v('eq-modelo'), v('eq-serie'), v('eq-ubicacion'), v('eq-responsable'), v('eq-fecha-adq'), v('eq-financiacion'), v('eq-proveedor-compra'), v('eq-proveedor-sat'), v('eq-estado'), '', '', '', '', manualUrl, v('eq-observaciones'), v('eq-coste'), v('eq-protocolo-uso'), '', v('eq-mes-inicio'), v('eq-mes-fin')];

  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Equipos') {
      await sheetsUpdate(`Equipos!A${editingRow.rowIndex + 2}:W${editingRow.rowIndex + 2}`, row);
      DATA.equipos[editingRow.rowIndex] = rowToObj(row, 'equipos');
      showToast('Equipo actualizado', 'success');
    } else {
      await sheetsAppend('Equipos', row);
      DATA.equipos.push(rowToObj(row, 'equipos'));
      showToast('Equipo guardado', 'success');
    }
    closeModal('modal-equipo'); renderAll();
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading(); editingRow = null;
}

// ============================================================
// GUARDAR INCIDENCIA
// ============================================================
async function guardarIncidencia() {
  const equipo = v('inc-equipo'); const desc = v('inc-descripcion');
  if (!equipo || !desc) { showToast('Equipo y descripción son obligatorios', 'error'); return; }
  const id  = genId('INC-');
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const usuarioApp = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  const reportadoPor = usuarioApp?.Nombre || currentUser?.name || 'Usuario';
  const row = [id, equipo, reportadoPor, new Date().toISOString().replace('T',' ').slice(0,16), desc, v('inc-impacto'), v('inc-urgencia'), 'Abierta', '', v('inc-relacionada') || ''];
  showLoading('Guardando...');
  try {
    await sheetsAppend('Incidencias', row);
    DATA.incidencias.push(rowToObj(row, 'incidencias'));
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
    await sheetsDeleteRow('Incidencias', idx);
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
      urlAdjunto    = await uploadFileToDrive(_pendingFacturaBase64.data, _pendingFacturaBase64.name, _pendingFacturaBase64.type);
      nombreAdjunto = _pendingFacturaBase64.name;
    } catch(e) { showToast('Error subiendo la factura', 'error'); hideLoading(); return; }
    _pendingFacturaBase64 = null;
  }

  showLoading('Cerrando intervención...');
  try {
    const updatedRow = [
      i.ID_Intervencion, i.Equipo, i.Tipo, i.Origen,
      i.Fecha_Planificada, i.Fecha_Realizacion,
      i.Realizado_Por, i.Tecnico_Externo, i.Proveedor,
      i.Descripcion_Actuacion, i.Resultado, i.Equipo_Operativo_Tras_Intervencion,
      urlAdjunto, i.Factura_Asociada, '',
      i.Observaciones, nombreAdjunto, 'Cerrada',
      i.Fecha_Estimada_Resolucion || '', i.Coste_Intervencion || ''
    ];
    await sheetsUpdate(`Intervenciones!A${intIdx + 2}:T${intIdx + 2}`, updatedRow);
    DATA.intervenciones[intIdx] = rowToObj(updatedRow, 'intervenciones');

    // Cerrar incidencia vinculada
    const incIdx = DATA.incidencias.findIndex(x => x.Intervencion_Generada === i.ID_Intervencion);
    if (incIdx !== -1) {
      const inc = DATA.incidencias[incIdx];
      if (!['Resuelta','Descartada'].includes(inc.Estado)) {
        inc.Estado = 'Resuelta';
        const incRow = [inc.ID_Incidencia, inc.Equipo, inc.Reportado_Por, inc.Fecha_Hora,
          inc.Descripcion_Problema, inc.Impacto, inc.Urgencia, 'Resuelta', inc.Intervencion_Generada, inc.Relacionada_Con || ''];
        await sheetsUpdate(`Incidencias!A${incIdx + 2}:J${incIdx + 2}`, incRow);
      }
    }

    // Restaurar estado del equipo
    const operativo = i.Equipo_Operativo_Tras_Intervencion;
    try { await actualizarEstadoEquipo(i.Equipo, operativo === 'No' ? 'No operativo' : 'Operativo'); } catch(e) { console.warn(e); }

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

  const e = DATA.equipos.find(eq => eq.ID_Activo === equipoId);
  const equipo = e ? equipoId + ' – ' + [e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' ') : equipoId;
  const id  = genId('INC-');
  const row = [id, equipo, currentUser?.name || 'Usuario',
    new Date().toISOString().replace('T',' ').slice(0,16),
    desc, impacto, 'Normal', 'Abierta', '', ''];

  showLoading('Enviando aviso...');
  try {
    await sheetsAppend('Incidencias', row);
    DATA.incidencias.push(rowToObj(row, 'incidencias'));
    showToast('Aviso enviado. El profesorado será notificado.', 'success');
    closeModal('modal-aviso-alumno');
    renderIncidencias();
    renderDashboard();
    updateBadges();
  } catch(e) { showToast('Error enviando el aviso', 'error'); console.error(e); }
  hideLoading();
}
