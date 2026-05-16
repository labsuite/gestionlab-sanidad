// ============================================================
// VARIABLE DE ESTADO — intervención pendiente de archivo
// ============================================================
let _pendingActFileBase64 = null;  // para modal-registrar-actuacion
let _incidenciaOrigen     = null;  // ID incidencia al crear intervención desde ella

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
  openModal('modal-equipo');
}


// ============================================================
// MODAL INTERVENCIÓN (modo manual / edición directa)
// ============================================================
function openModalIntervencion() {
  editingRow = null; pendingFileBase64 = null; _incidenciaOrigen = null; removeFile();
  document.getElementById('modal-intervencion-title').textContent = 'Nueva intervención';
  ['int-realizado-por','int-proveedor','int-tecnico-ext','int-fecha-plan','int-fecha-real','int-descripcion','int-observaciones'].forEach(id => sv(id,''));
  // Limpiar autocomplete de equipo
  sv('int-equipo', '');
  const srch = document.getElementById('int-equipo-search'); if (srch) srch.value = '';
  const sel2 = document.getElementById('int-equipo-selected'); if (sel2) sel2.style.display = 'none';
  const ac = document.getElementById('int-equipo-autocomplete'); if (ac) ac.classList.remove('open');
  sv('int-tipo','Correctivo'); sv('int-resultado','Resuelto');
  sv('int-operativo','Sí'); sv('int-estado-manual','Planificada');
  const grp = document.getElementById('int-equipo-group');
  if (grp) grp.style.display = '';
  poblarSelects(); openModal('modal-intervencion');
}

function openModalIntervencionEquipo(equipoId) {
  openModalIntervencion();
  setTimeout(() => {
    const e = DATA.equipos.find(eq => eq.ID_Activo === equipoId);
    if (e) {
      const label = [e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' ');
      seleccionarEquipoIntervencion(e.ID_Activo, label);
    }
    const grp = document.getElementById('int-equipo-group');
    if (grp) grp.style.display = 'none';
  }, 50);
}

function editIntervencion(idx) {
  const i = DATA.intervenciones[idx];
  editingRow = { sheet: 'Intervenciones', rowIndex: idx };
  poblarSelects();
  document.getElementById('modal-intervencion-title').textContent = 'Editar intervención';
  sv('int-equipo',i.Equipo);
  // Pre-rellenar el autocomplete visual
  const eqObj = DATA.equipos.find(e => (i.Equipo||'').startsWith(e.ID_Activo));
  if (eqObj) {
    const lbl = [eqObj.Tipo_Equipo, eqObj.Marca, eqObj.Modelo].filter(Boolean).join(' ');
    seleccionarEquipoIntervencion(eqObj.ID_Activo, lbl);
  } else if (i.Equipo) {
    const sel2 = document.getElementById('int-equipo-selected');
    const txt2 = document.getElementById('int-equipo-selected-text');
    if (sel2) sel2.style.display = 'flex';
    if (txt2) txt2.textContent = i.Equipo;
  }
  sv('int-tipo',i.Tipo);
  sv('int-fecha-plan',i.Fecha_Planificada); sv('int-fecha-real',i.Fecha_Realizacion);
  sv('int-realizado-por',i.Realizado_Por); sv('int-tecnico-ext',i.Tecnico_Externo);
  sv('int-proveedor',i.Proveedor); sv('int-descripcion',i.Descripcion_Actuacion||i.Descripcion_Planificada||'');
  sv('int-resultado',i.Resultado); sv('int-operativo',i.Equipo_Operativo_Tras_Intervencion);
  sv('int-observaciones',i.Observaciones);
  sv('int-estado-manual',i.Estado||'Planificada');
  sv('int-pdf-url',i.URL_Adjunto||'');
  if (i.URL_Adjunto) { document.getElementById('int-pdf-preview').style.display = 'flex'; document.getElementById('int-pdf-name').textContent = i.Nombre_Adjunto || 'Documento adjunto'; }
  else document.getElementById('int-pdf-preview').style.display = 'none';
  openModal('modal-intervencion');
}

// ============================================================
// MODAL INCIDENCIA
// ============================================================
function openModalIncidencia() {
  editingRow = null;
  ['inc-equipo','inc-descripcion'].forEach(id => sv(id,''));
  sv('inc-impacto','No bloquea'); sv('inc-urgencia','Normal');
  const grp = document.getElementById('inc-equipo-group');
  if (grp) grp.style.display = '';
  poblarSelects(); openModal('modal-incidencia');
}

function openModalIncidenciaEquipo(equipoId) {
  openModalIncidencia();
  setTimeout(() => {
    const sel = document.getElementById('inc-equipo');
    const opt = Array.from(sel.options).find(o => o.value.startsWith(equipoId));
    if (opt) sel.value = opt.value;
    const grp = document.getElementById('inc-equipo-group');
    if (grp) grp.style.display = 'none';
  }, 50);
}

// ============================================================
// FLUJO PASO 1 — Planificar desde incidencia
// ============================================================
function abrirPlanificacion(incId, equipo) {
  sv('plan-inc-id', incId);
  sv('plan-equipo', equipo);
  const label = document.getElementById('plan-inc-label');
  if (label) label.textContent = incId + ' (' + equipo + ')';
  sv('plan-tipo', 'Correctivo');
  sv('plan-fecha', new Date().toISOString().split('T')[0]);
  sv('plan-fecha-estimada', '');
  sv('plan-descripcion', '');
  openModal('modal-planificar-intervencion');
}

async function guardarPlanificacion() {
  const incId  = v('plan-inc-id');
  const equipo = v('plan-equipo');
  const fecha  = v('plan-fecha');
  if (!fecha) { showToast('La fecha planificada es obligatoria', 'error'); return; }

  const id  = genId('INT-');
  const row = [
    id,            // A ID_Intervencion
    equipo,        // B Equipo
    v('plan-tipo'),// C Tipo
    'Incidencia reportada', // D Origen
    fecha,         // E Fecha_Planificada
    '',            // F Fecha_Realizacion
    '',            // G Realizado_Por
    '',            // H Tecnico_Externo
    '',            // I Proveedor
    '',            // J Descripcion_Actuacion  (vacío hasta registrar)
    '',            // K Resultado
    '',            // L Equipo_Operativo
    '',            // M URL_Adjunto
    '',            // N Factura_Asociada
    '',            // O (legacy)
    v('plan-descripcion'), // P Observaciones
    '',            // Q Nombre_Adjunto
    'Planificada', // R Estado
    v('plan-fecha-estimada') || '', // S Fecha_Estimada_Resolucion
    ''             // T Coste_Intervencion
  ];

  showLoading('Guardando...');
  try {
    await sheetsAppend('Intervenciones', row);
    DATA.intervenciones.push(rowToObj(row, 'intervenciones'));
    // Recuperar el obj recién creado para poder leerlo con sus campos
    const newInt = DATA.intervenciones[DATA.intervenciones.length - 1];
    newInt.Descripcion_Planificada = v('plan-descripcion'); // campo virtual para UI

    // Actualizar incidencia: Estado → En gestión
    // Solo actualizar Intervencion_Generada si aún no tiene ninguna (no sobreescribir en derivadas)
    const incIdx = DATA.incidencias.findIndex(x => x.ID_Incidencia === incId);
    if (incIdx !== -1) {
      const inc = DATA.incidencias[incIdx];
      const yaEnGestion = inc.Estado === 'En gestión';
      inc.Estado = 'En gestión';
      if (!inc.Intervencion_Generada) inc.Intervencion_Generada = id;
      if (!yaEnGestion) {
        const incRow = [inc.ID_Incidencia, inc.Equipo, inc.Reportado_Por, inc.Fecha_Hora, inc.Descripcion_Problema, inc.Impacto, inc.Urgencia, inc.Estado, inc.Intervencion_Generada];
        await sheetsUpdate(`Incidencias!A${incIdx + 2}:I${incIdx + 2}`, incRow);
      }
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
// FLUJO PASO 2 — Registrar actuación
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

  // Fecha por defecto = hoy
  sv('act-fecha-real', new Date().toISOString().split('T')[0]);
  sv('act-descripcion', '');
  sv('act-observaciones', '');
  sv('act-resultado', 'Resuelto');
  sv('act-operativo', 'Sí');
  sv('act-coste', '');
  sv('act-pdf-url', '');

  // Poblar selects
  poblarSelects();
  const selUser = document.getElementById('act-realizado-por');
  if (selUser) {
    selUser.innerHTML = '<option value="">Seleccionar usuario...</option>' +
      DATA.usuarios.filter(u => u.Activo !== 'FALSE').map(u => `<option value="${u.Nombre}">${u.Nombre}</option>`).join('');
  }
  const selProv = document.getElementById('act-proveedor-ext');
  if (selProv) {
    selProv.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
      DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">${p.Nombre_Proveedor}</option>`).join('');
  }

  // Restablecer radio a Interna
  const radInterna = document.getElementById('act-ejec-interna');
  if (radInterna) { radInterna.checked = true; toggleActEjecucion('Interna'); }

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

function toggleActResultado(val) {
  // Reservado para lógica futura de mostrar/ocultar campos según resultado
}

async function guardarActuacion() {
  const equipoDirecto = v('act-equipo-directo');
  const fechaReal = v('act-fecha-real');
  const desc      = v('act-descripcion');
  if (!fechaReal) { showToast('La fecha de realización es obligatoria', 'error'); return; }
  if (!desc)      { showToast('La descripción es obligatoria', 'error'); return; }

  const tipoEjec     = document.querySelector('input[name="act-tipo-ejec"]:checked')?.value || 'Interna';
  const realizadoPor = tipoEjec === 'Interna' ? v('act-realizado-por') : '';
  const proveedorExt = tipoEjec === 'Externa' ? v('act-proveedor-ext') : '';
  const resultado    = v('act-resultado');
  const operativo    = v('act-operativo');
  const coste        = tipoEjec === 'Externa' ? (v('act-coste') || '') : '';

  // ── MODO DIRECTO: crear nueva intervención desde el equipo ───────────────
  if (equipoDirecto) {
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
    const nuevoEstado = (tipoEjec === 'Externa' && resultado === 'Resuelto') ? 'Pendiente factura' : 'Cerrada';
    const row = [
      nuevoId, equipoDirecto, tipoInt, 'Manual', '',
      fechaReal, realizadoPor, '', proveedorExt, desc,
      resultado, operativo, urlAdjunto, '', '',
      v('act-observaciones'), nombreAdjunto, nuevoEstado, '', coste
    ];
    showLoading('Guardando intervención...');
    try {
      await sheetsAppend('Intervenciones', row);
      DATA.intervenciones.push(rowToObj(row, 'intervenciones'));
      if (resultado === 'Resuelto') {
        try { await actualizarEstadoEquipo(equipoDirecto, operativo === 'Sí' ? 'Operativo' : 'No operativo'); } catch(e) { console.warn(e); }
      }
      closeModal('modal-registrar-actuacion');
      showToast(`Intervención ${nuevoId} registrada`, 'success');
      renderAll();
    } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
    hideLoading();
    return;
  }

  // ── MODO VINCULADO: actualizar intervención existente ───────────────────
  const intIdx = parseInt(v('act-int-idx'));
  const i = DATA.intervenciones[intIdx];
  if (!i) { showToast('Intervención no encontrada', 'error'); return; }

  // Determinar nuevo estado según reglas de cierre
  let nuevoEstadoInt, nuevoEstadoInc;
  if (resultado === 'Resuelto') {
    if (tipoEjec === 'Interna') {
      nuevoEstadoInt = 'Cerrada';
      nuevoEstadoInc = 'Resuelta';
    } else {
      nuevoEstadoInt = 'Pendiente factura';
      nuevoEstadoInc = 'En gestión'; // sigue hasta adjuntar factura
    }
  } else if (resultado === 'Resuelto parcialmente') {
    // Pregunta diferida — se hace después de guardar
    nuevoEstadoInt = 'En gestión';
    nuevoEstadoInc = 'En gestión';
  } else {
    nuevoEstadoInt = 'En gestión';
    nuevoEstadoInc = 'En gestión';
  }

  // Subir adjunto si hay
  let urlAdjunto = v('act-pdf-url') || '', nombreAdjunto = '';
  if (_pendingActFileBase64) {
    showLoading('Subiendo documento...');
    try {
      urlAdjunto    = await uploadFileToDrive(_pendingActFileBase64.data, _pendingActFileBase64.name, _pendingActFileBase64.type);
      nombreAdjunto = _pendingActFileBase64.name;
    } catch(e) { showToast('Error subiendo el PDF', 'error'); hideLoading(); return; }
    _pendingActFileBase64 = null;
  }

  // Acumular descripción: si hay actuaciones previas (Resuelto parcialmente), añadir con separador
  const descAnterior = i.Descripcion_Actuacion || i.Descripcion_Planificada || '';
  const descAcumulada = (descAnterior && resultado === 'Resuelto parcialmente' && descAnterior !== desc)
    ? descAnterior + '\n── ' + fechaReal + ' ──\n' + desc
    : desc;

  const updatedRow = [
    i.ID_Intervencion,           // A
    i.Equipo,                    // B
    i.Tipo,                      // C
    i.Origen || 'Incidencia reportada', // D
    i.Fecha_Planificada || '',   // E
    fechaReal,                   // F Fecha_Realizacion
    realizadoPor,                // G Realizado_Por
    '',                          // H Tecnico_Externo
    proveedorExt,                // I Proveedor
    descAcumulada,               // J Descripcion_Actuacion (acumulada)
    resultado,                   // K Resultado
    operativo,                   // L Equipo_Operativo
    urlAdjunto,                  // M URL_Adjunto
    '',                          // N Factura_Asociada
    '',                          // O (legacy)
    v('act-observaciones'),      // P Observaciones
    nombreAdjunto,               // Q Nombre_Adjunto
    nuevoEstadoInt,              // R Estado
    i.Fecha_Estimada_Resolucion || '', // S Fecha_Estimada_Resolucion (se preserva)
    coste                        // T Coste_Intervencion
  ];

  showLoading('Guardando actuación...');
  try {
    // ── Guardar datos de la actuación en la intervención actual ────────────
    await sheetsUpdate(`Intervenciones!A${intIdx + 2}:T${intIdx + 2}`, updatedRow);
    DATA.intervenciones[intIdx] = rowToObj(updatedRow, 'intervenciones');

    // ── Estado operativo del equipo según resultado + campo operativo ─────
    if (resultado === 'Resuelto') {
      try { await actualizarEstadoEquipo(i.Equipo, operativo === 'Sí' ? 'Operativo' : 'No operativo'); } catch(e) { console.warn(e); }
    } else if (resultado === 'Pendiente' || resultado === 'Resuelto parcialmente') {
      try { await actualizarEstadoEquipo(i.Equipo, operativo === 'Sí' ? 'Operativo con fallos' : 'No operativo'); } catch(e) { console.warn(e); }
    }


    // ── Si el resultado NO es definitivo: crear nueva intervención de seguimiento ──
    // Así cada actuación queda como registro histórico independiente y la cadena
    // es trazable. La incidencia apunta siempre a la última intervención activa.
    if (resultado === 'Pendiente' || resultado === 'Resuelto parcialmente') {
      const nuevaId  = genId('INT-');
      const nuevaRow = [
        nuevaId,                          // A ID
        i.Equipo,                         // B Equipo
        i.Tipo,                           // C Tipo
        'Seguimiento de ' + i.ID_Intervencion, // D Origen
        '',                               // E Fecha_Planificada
        '', '', '', '',                   // F-I vacíos
        '',                               // J Descripción
        '', '', '', '', '',               // K-O
        '',                               // P Observaciones
        '',                               // Q Nombre_Adjunto
        'En gestión',                     // R Estado
        i.Fecha_Estimada_Resolucion || '', // S (heredada del padre)
        ''                                // T Coste
      ];
      await sheetsAppend('Intervenciones', nuevaRow);
      const nuevaObj = rowToObj(nuevaRow, 'intervenciones');
      DATA.intervenciones.push(nuevaObj);

      // Actualizar incidencia vinculada → apuntar a la nueva intervención
      const incId = DATA.incidencias.findIndex(x => x.Intervencion_Generada === i.ID_Intervencion);
      if (incId !== -1) {
        const inc = DATA.incidencias[incId];
        inc.Intervencion_Generada = nuevaId;
        const incRow = [inc.ID_Incidencia, inc.Equipo, inc.Reportado_Por, inc.Fecha_Hora, inc.Descripcion_Problema, inc.Impacto, inc.Urgencia, 'En gestión', nuevaId];
        await sheetsUpdate(`Incidencias!A${incId + 2}:I${incId + 2}`, incRow);
      }

      closeModal('modal-registrar-actuacion');
      const msg = resultado === 'Resuelto parcialmente'
        ? `Actuación guardada. Creada nueva intervención de seguimiento (${nuevaId}).`
        : `Actuación guardada como pendiente. Creada nueva intervención (${nuevaId}).`;
      showToast(msg, 'success');
      renderAll();
      hideLoading();
      return;
    }

    // ── Resultado definitivo (Resuelto): cerrar incidencia ─────────────────
    const incId = DATA.incidencias.findIndex(x => x.Intervencion_Generada === i.ID_Intervencion);
    if (incId !== -1) {
      const inc = DATA.incidencias[incId];
      if (!['Resuelta','Cerrada','Archivada'].includes(inc.Estado)) {
        const nuevoEstadoInc = nuevoEstadoInt === 'Cerrada' ? 'Archivada' : 'En gestión';
        inc.Estado = nuevoEstadoInc;
        const incRow = [inc.ID_Incidencia, inc.Equipo, inc.Reportado_Por, inc.Fecha_Hora, inc.Descripcion_Problema, inc.Impacto, inc.Urgencia, nuevoEstadoInc, inc.Intervencion_Generada];
        await sheetsUpdate(`Incidencias!A${incId + 2}:I${incId + 2}`, incRow);
      }
    }

    closeModal('modal-registrar-actuacion');
    const msgFinal = nuevoEstadoInt === 'Pendiente factura'
      ? 'Actuación registrada. Intervención queda "Pendiente factura"'
      : `Actuación registrada. Intervención → ${nuevoEstadoInt}`;
    showToast(msgFinal, 'success');
    renderAll();
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// FLUJO PASO 3b — Resolución parcial
// ============================================================
// resolverParcialSeguir / resolverParcialCerrar ya no se usan:
// el nuevo flujo crea directamente una intervención de seguimiento en guardarActuacion().
// Se mantienen como stubs para evitar errores si el modal antiguo sigue en el HTML.
function resolverParcialSeguir() { closeModal('modal-resolucion-parcial'); renderAll(); }
function resolverParcialCerrar() { closeModal('modal-resolucion-parcial'); renderAll(); }

// ============================================================
// ADJUNTOS — INTERVENCIÓN MANUAL
// ============================================================
function handleFileSelect(input) {
  const file = input.files[0]; if (!file) return;
  document.getElementById('int-pdf-name').textContent = file.name;
  document.getElementById('int-pdf-preview').style.display = 'flex';
  const reader = new FileReader();
  reader.onload = e => { pendingFileBase64 = { name: file.name, type: file.type, data: e.target.result.split(',')[1] }; };
  reader.readAsDataURL(file);
}
function removeFile() {
  pendingFileBase64 = null;
  const preview = document.getElementById('int-pdf-preview');
  const name    = document.getElementById('int-pdf-name');
  const input   = document.getElementById('int-pdf-input');
  const url     = document.getElementById('int-pdf-url');
  if (preview) preview.style.display = 'none';
  if (name)    name.textContent = '';
  if (input)   input.value = '';
  if (url)     url.value = '';
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
// GUARDAR INTERVENCIÓN (modal manual / edición directa)
// ============================================================
async function guardarIntervencion() {
  const equipo = v('int-equipo'); const desc = v('int-descripcion');
  if (!equipo || !desc) { showToast('Equipo y descripción son obligatorios', 'error'); return; }

  const fechaReal = v('int-fecha-real') || new Date().toISOString().split('T')[0];
  let urlAdjunto = v('int-pdf-url') || '', nombreAdjunto = '';

  if (pendingFileBase64) {
    showLoading('Subiendo documento...');
    try { urlAdjunto = await uploadFileToDrive(pendingFileBase64.data, pendingFileBase64.name, pendingFileBase64.type); nombreAdjunto = pendingFileBase64.name; }
    catch(e) { showToast('Error subiendo el PDF. Revisa permisos de Drive.', 'error'); hideLoading(); return; }
  }

  const tipo    = v('int-tipo');
  const estado  = v('int-estado-manual') || 'Planificada';
  const existente = editingRow ? DATA.intervenciones[editingRow.rowIndex] : null;
  const row     = [
    existente ? existente.ID_Intervencion : genId('INT-'),
    equipo, tipo, '',
    v('int-fecha-plan'), fechaReal,
    v('int-realizado-por'), v('int-tecnico-ext'), v('int-proveedor'),
    desc, v('int-resultado'), v('int-operativo'),
    urlAdjunto, '', '',
    v('int-observaciones'), nombreAdjunto, estado,
    existente ? (existente.Fecha_Estimada_Resolucion || '') : '', // S
    existente ? (existente.Coste_Intervencion || '') : ''         // T
  ];

  showLoading('Guardando...');
  try {
    if (editingRow && editingRow.sheet === 'Intervenciones') {
      await sheetsUpdate(`Intervenciones!A${editingRow.rowIndex + 2}:T${editingRow.rowIndex + 2}`, row);
      DATA.intervenciones[editingRow.rowIndex] = rowToObj(row, 'intervenciones');
      showToast('Intervención actualizada', 'success');
    } else {
      await sheetsAppend('Intervenciones', row);
      DATA.intervenciones.push(rowToObj(row, 'intervenciones'));
      showToast('Intervención guardada', 'success');
    }

    // Actualizar Estado_Operativo del equipo según resultado
    const resultadoInt = v('int-resultado');
    const operativoInt = v('int-operativo');
    if (resultadoInt === 'Resuelto') {
      try { await actualizarEstadoEquipo(equipo, operativoInt === 'Sí' ? 'Operativo' : 'No operativo'); } catch(e) { console.warn(e); }
    } else if (resultadoInt === 'Pendiente' || resultadoInt === 'Resuelto parcialmente') {
      try { await actualizarEstadoEquipo(equipo, operativoInt === 'Sí' ? 'Operativo con fallos' : 'No operativo'); } catch(e) { console.warn(e); }
    }
    // Nota: el cierre de incidencias solo se gestiona desde el flujo guiado (guardarActuacion)
    // para evitar cerrar incidencias equivocadas en equipos con múltiples incidencias abiertas.

    pendingFileBase64 = null;
    closeModal('modal-intervencion'); renderAll();
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
  const row = [id, equipo, currentUser?.name || 'Usuario', new Date().toISOString().replace('T',' ').slice(0,16), desc, v('inc-impacto'), v('inc-urgencia'), 'Abierta', ''];
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

async function cambiarEstadoIncidencia(idx) {
  const i = DATA.incidencias[idx];
  const estados = ['Abierta','En gestión','Resuelta','Cerrada'];
  const next = estados[(estados.indexOf(i.Estado) + 1) % estados.length];
  if (!confirm(`¿Cambiar estado de "${i.ID_Incidencia}" a "${next}"?`)) return;
  i.Estado = next;
  const row = [i.ID_Incidencia, i.Equipo, i.Reportado_Por, i.Fecha_Hora, i.Descripcion_Problema, i.Impacto, i.Urgencia, i.Estado, i.Intervencion_Generada];
  showLoading('Actualizando...');
  try { await sheetsUpdate(`Incidencias!A${idx + 2}:I${idx + 2}`, row); showToast('Estado actualizado', 'success'); renderAll(); }
  catch(e) { showToast('Error', 'error'); }
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

  sv('act-fecha-real',    new Date().toISOString().split('T')[0]);
  sv('act-descripcion',   '');
  sv('act-observaciones', '');
  sv('act-resultado',     'Resuelto');
  sv('act-operativo',     'Sí');
  sv('act-coste',         '');
  sv('act-pdf-url',       '');

  poblarSelects();
  const selUser = document.getElementById('act-realizado-por');
  if (selUser) {
    selUser.innerHTML = '<option value="">Seleccionar usuario...</option>' +
      DATA.usuarios.filter(u => u.Activo !== 'FALSE').map(u => `<option value="${u.Nombre}">${u.Nombre}</option>`).join('');
  }
  const selProv = document.getElementById('act-proveedor-ext');
  if (selProv) {
    selProv.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
      DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}">${p.Nombre_Proveedor}</option>`).join('');
  }

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
      if (!['Resuelta','Cerrada','Archivada'].includes(inc.Estado)) {
        inc.Estado = 'Archivada';
        const incRow = [inc.ID_Incidencia, inc.Equipo, inc.Reportado_Por, inc.Fecha_Hora,
          inc.Descripcion_Problema, inc.Impacto, inc.Urgencia, 'Archivada', inc.Intervencion_Generada];
        await sheetsUpdate(`Incidencias!A${incIdx + 2}:I${incIdx + 2}`, incRow);
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
// AUTOCOMPLETE EQUIPO EN INTERVENCIÓN
// ============================================================
function buscarEquipoIntervencion(query) {
  const list = document.getElementById('int-equipo-autocomplete');
  if (!list) return;
  if (!query || query.length < 1) { list.classList.remove('open'); return; }
  const q = query.toLowerCase();
  // Profesor: solo puede intervenir en equipos de los que es responsable
  const pool = getUserRole() === 'Profesor'
    ? DATA.equipos.filter(e => esResponsableDeEquipo(e))
    : DATA.equipos;
  const resultados = pool.filter(e =>
    e.ID_Activo.toLowerCase().includes(q) ||
    (e.Tipo_Equipo || '').toLowerCase().includes(q) ||
    (e.Marca || '').toLowerCase().includes(q) ||
    (e.Modelo || '').toLowerCase().includes(q) ||
    (e.Ubicacion || '').toLowerCase().includes(q)
  ).slice(0, 8);
  if (!resultados.length) { list.classList.remove('open'); return; }
  list.innerHTML = resultados.map(e => {
    const label = [e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' ');
    const meta  = e.Ubicacion || '';
    return `<div class="autocomplete-item" onclick="seleccionarEquipoIntervencion('${e.ID_Activo}','${label.replace(/'/g,"\\'")}')">
      <div>
        <div class="autocomplete-item-name">${e.ID_Activo} – ${label}</div>
        ${meta ? `<div class="autocomplete-item-meta">${meta}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  list.classList.add('open');
}

function seleccionarEquipoIntervencion(id, label) {
  document.getElementById('int-equipo').value = id + (label ? ' – ' + label : '');
  const srch = document.getElementById('int-equipo-search'); if (srch) srch.value = '';
  const sel  = document.getElementById('int-equipo-selected');
  const txt  = document.getElementById('int-equipo-selected-text');
  if (sel) sel.style.display = 'flex';
  if (txt) txt.textContent = id + (label ? ' – ' + label : '');
  const list = document.getElementById('int-equipo-autocomplete');
  if (list) list.classList.remove('open');
}

function limpiarEquipoIntervencion() {
  sv('int-equipo', '');
  const srch = document.getElementById('int-equipo-search'); if (srch) srch.value = '';
  const sel  = document.getElementById('int-equipo-selected'); if (sel) sel.style.display = 'none';
  const list = document.getElementById('int-equipo-autocomplete'); if (list) list.classList.remove('open');
  document.getElementById('int-equipo-search')?.focus();
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
    desc, impacto, 'Normal', 'Abierta', ''];

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
