// ============================================================
// GUARDAR SOLICITUDES
// ============================================================
async function guardarSolicitud() {
  const esNuevo = document.getElementById('btn-source-nuevo').classList.contains('active');
  // Declarar variables comunes ANTES del if/else para evitar problemas de scope
  const cant = v('sol-cantidad');
  if (!cant || parseFloat(cant) <= 0) { showToast('Indica la cantidad', 'error'); return; }
  const id             = genId('SOL-');
  const fecha          = new Date().toISOString().split('T')[0];
  const usuario        = currentUser?.name || 'Usuario';
  const urgencia       = v('sol-urgencia');
  const fechaNecesidad = v('sol-fecha-necesidad');
  const obsBase        = urgencia === 'Urgente' ? '⚠️ URGENTE — ' + v('sol-obs') : v('sol-obs');

  let materialNombre = '', unidadObs = '';
  if (esNuevo) {
    materialNombre = v('sol-material-libre');
    const unidad = v('sol-unidad');
    if (!unidad) { showToast('La unidad es obligatoria para material no catalogado', 'error'); return; }
    if (!materialNombre) { showToast('Indica el material', 'error'); return; }
    // Unidad va solo a observaciones, NO al nombre
    unidadObs = '[Unidad: ' + unidad + '] ';
  } else {
    const materialId = document.getElementById('sol-material-id').value;
    const mat = DATA.material.find(m => m.ID_Material === materialId);
    materialNombre = mat ? mat.Nombre : '';
  }
  if (!materialNombre) { showToast('Indica el material', 'error'); return; }

  const rowSheet = [id, materialNombre, cant, usuario, fecha,
    v('sol-motivo') + (fechaNecesidad ? ' · Necesario: ' + fechaNecesidad : ''),
    v('sol-proveedor'), 'Pendiente', '', unidadObs + obsBase];

  showLoading('Guardando...');
  try {
    await sheetsAppend('Solicitudes', rowSheet);
    const objLocal = { ID_Solicitud: id, Material: materialNombre, Cantidad_Solicitada: cant,
      Solicitante: usuario, Fecha: fecha, Motivo: v('sol-motivo'),
      Proveedor_Requerido: v('sol-proveedor'), Estado: 'Pendiente', Lista_Pedido: '',
      Observaciones: rowSheet[9], Urgencia: urgencia };
    DATA.solicitudes.push(objLocal);
    showToast('Solicitud enviada', 'success');
    closeModal('modal-solicitud'); renderSolicitudes(); updateBadges();
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

async function rechazarSolicitud(solId) {
  if (!confirm('¿Rechazar esta solicitud?')) return;
  const idx = DATA.solicitudes.findIndex(s => s.ID_Solicitud === solId);
  if (idx === -1) return;
  DATA.solicitudes[idx].Estado = 'Rechazado';
  showLoading('Actualizando...');
  try {
    const sol = DATA.solicitudes[idx];
    const row = [sol.ID_Solicitud, sol.Material, sol.Cantidad_Solicitada,
      sol.Solicitante, sol.Fecha, sol.Motivo, sol.Proveedor_Requerido,
      'Rechazado', sol.Lista_Pedido, sol.Observaciones];
    await sheetsUpdate(`Solicitudes!A${idx+2}:J${idx+2}`, row);
    showToast('Solicitud rechazada', 'success'); renderSolicitudes();
  } catch(e) { showToast('Error', 'error'); }
  hideLoading();
}

async function cancelarSolicitud(solId) {
  if (!confirm('¿Cancelar esta solicitud? Se marcará como Cancelada.')) return;
  const idx = DATA.solicitudes.findIndex(s => s.ID_Solicitud === solId);
  if (idx === -1) return;
  const sol = DATA.solicitudes[idx];
  if (sol.Estado !== 'Pendiente') { showToast('Solo se pueden cancelar solicitudes Pendientes', 'error'); return; }
  DATA.solicitudes[idx].Estado = 'Cancelado';
  showLoading('Actualizando...');
  try {
    const row = [sol.ID_Solicitud, sol.Material, sol.Cantidad_Solicitada,
      sol.Solicitante, sol.Fecha, sol.Motivo, sol.Proveedor_Requerido,
      'Cancelado', sol.Lista_Pedido, sol.Observaciones];
    await sheetsUpdate(`Solicitudes!A${idx+2}:J${idx+2}`, row);
    showToast('Solicitud cancelada', 'success'); renderSolicitudes();
  } catch(e) { showToast('Error', 'error'); }
  hideLoading();
}

async function solicitudAPedido(solId) {
  const pedidosAbiertos = DATA.pedidos.filter(p => p.Estado === 'Abierto');
  if (!pedidosAbiertos.length) {
    const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
    if (sol) _pendingSolicitudParaPedido = { tipo: 'sol', solId, matNombre: sol.Material, cantidad: sol.Cantidad_Solicitada };
    openModalNuevoPedido(); return;
  }
  document.getElementById('sel-ped-sol-id').value = solId;
  const lista = document.getElementById('sel-ped-lista');
  lista.innerHTML = pedidosAbiertos.map(p => {
    const nLineas = DATA.lineasPedido.filter(l => l.Pedido === p.ID_Pedido).length;
    return `<div class="pedido-opcion" onclick="confirmarSolicitudAPedido('${p.ID_Pedido}')"><div><div class="pedido-opcion-nombre">${p.Nombre_Lista}</div><div class="pedido-opcion-meta">${p.Proveedor||'Sin proveedor asignado'} · ${nLineas} línea(s)</div></div><span style="color:var(--accent);font-size:18px">→</span></div>`;
  }).join('');
  openModal('modal-seleccionar-pedido');
}

async function confirmarSolicitudAPedido(pedidoId) {
  const solId = document.getElementById('sel-ped-sol-id').value;
  closeModal('modal-seleccionar-pedido');
  const pedido = DATA.pedidos.find(p => p.ID_Pedido === pedidoId);
  const sol    = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!pedido || !sol) { showToast('Error al añadir al pedido', 'error'); return; }
  const idLinea  = genId('LIN-');
  const rowLinea = [idLinea, pedidoId, sol.Material, sol.Cantidad_Solicitada, '0', 'Pendiente', 'Desde solicitud ' + solId];
  showLoading('Añadiendo al pedido...');
  try {
    await sheetsAppend('Lineas_Pedido', rowLinea);
    DATA.lineasPedido.push(rowToObj(rowLinea, 'lineasPedido'));
    const solIdx = DATA.solicitudes.indexOf(sol);
    sol.Estado = 'Añadida a pedido'; sol.Lista_Pedido = pedidoId;
    const rowSol = [sol.ID_Solicitud, sol.Material, sol.Cantidad_Solicitada, sol.Solicitante, sol.Fecha, sol.Motivo, sol.Proveedor_Requerido, 'Añadida a pedido', pedidoId, sol.Observaciones];
    await sheetsUpdate(`Solicitudes!A${solIdx+2}:J${solIdx+2}`, rowSol);
    showToast(`Añadido a "${pedido.Nombre_Lista}"`, 'success');
    renderAll();
    // Ofrecer navegación directa al pedido
    if (typeof mostrarToastConAccion === 'function') {
      mostrarToastConAccion(`✓ Añadido a "${pedido.Nombre_Lista}"`, 'Ver pedido', () => verDetallePedido(pedidoId));
    }
  } catch(e) { showToast('Error', 'error'); console.error(e); }
  hideLoading();
}

function solicitudStockAPedido(matId, cantidadPreset) {
  const mat = DATA.material.find(m => m.ID_Material === matId); if (!mat) return;
  let cantidad;
  if (cantidadPreset !== undefined && cantidadPreset !== '' && parseFloat(cantidadPreset) > 0) {
    cantidad = String(parseFloat(cantidadPreset));
  } else {
    cantidad = prompt(`¿Cuántas unidades (${mat.Unidad||'uds'}) de "${mat.Nombre}" quieres pedir?`, mat.Stock_Optimo||'');
    if (!cantidad || parseFloat(cantidad) <= 0) return;
  }
  const pedidosAbiertos = DATA.pedidos.filter(p => p.Estado === 'Abierto');
  if (!pedidosAbiertos.length) { _pendingSolicitudParaPedido = { tipo: 'stock', matNombre: mat.Nombre, cantidad }; openModalNuevoPedido(); return; }
  document.getElementById('sel-ped-sol-id').value = '__stock__' + matId + '__' + cantidad;
  const lista = document.getElementById('sel-ped-lista');
  lista.innerHTML = pedidosAbiertos.map(p => {
    const nLineas = DATA.lineasPedido.filter(l => l.Pedido === p.ID_Pedido).length;
    return `<div class="pedido-opcion" onclick="confirmarStockAPedido('${p.ID_Pedido}','${mat.Nombre.replace(/'/g,"\\'")}','${cantidad}')"><div><div class="pedido-opcion-nombre">${p.Nombre_Lista}</div><div class="pedido-opcion-meta">${p.Proveedor||'Sin proveedor'} · ${nLineas} línea(s)</div></div><span style="color:var(--accent);font-size:18px">→</span></div>`;
  }).join('');
  openModal('modal-seleccionar-pedido');
}

async function confirmarStockAPedido(pedidoId, matNombre, cantidad) {
  closeModal('modal-seleccionar-pedido');
  const idLinea = genId('LIN-');
  const row = [idLinea, pedidoId, matNombre, cantidad, '0', 'Pendiente', 'Stock bajo mínimo'];
  showLoading('Añadiendo...');
  try { await sheetsAppend('Lineas_Pedido', row); DATA.lineasPedido.push(rowToObj(row, 'lineasPedido')); showToast(`"${matNombre}" añadido al pedido`, 'success'); renderAll(); }
  catch(e) { showToast('Error', 'error'); }
  hideLoading();
}

// ============================================================
// GUARDAR PEDIDOS
// ============================================================
async function guardarNuevoPedido() {
  const nombre = v('ped-nombre');
  if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  const id = genId('PED-');
  const fecha = new Date().toISOString().split('T')[0];
  const tipo = v('ped-tipo') || 'Material';
  const row = [id, nombre, v('ped-proveedor'), fecha, '', '', '', '', '', 'Abierto', '', '', v('ped-obs'), '', '', '', '', '', tipo];
  showLoading('Creando lista...');
  try {
    await sheetsAppend('Pedidos', row);
    DATA.pedidos.push(rowToObj(row, 'pedidos'));
    closeModal('modal-nuevo-pedido');
    if (_pendingSolicitudParaPedido) {
      const { tipo, solId, matNombre, cantidad } = _pendingSolicitudParaPedido;
      _pendingSolicitudParaPedido = null;
      const idLinea  = genId('LIN-');
      const rowLinea = [idLinea, id, matNombre, cantidad, '0', 'Pendiente', tipo === 'sol' ? 'Desde solicitud ' + solId : 'Stock bajo mínimo'];
      await sheetsAppend('Lineas_Pedido', rowLinea);
      DATA.lineasPedido.push(rowToObj(rowLinea, 'lineasPedido'));
      if (tipo === 'sol') {
        const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
        if (sol) {
          const solIdx = DATA.solicitudes.indexOf(sol);
          sol.Estado = 'Añadida a pedido'; sol.Lista_Pedido = id;
          const rowSol = [sol.ID_Solicitud, sol.Material, sol.Cantidad_Solicitada, sol.Solicitante, sol.Fecha, sol.Motivo, sol.Proveedor_Requerido, 'Añadida a pedido', id, sol.Observaciones];
          await sheetsUpdate(`Solicitudes!A${solIdx+2}:J${solIdx+2}`, rowSol);
        }
      }
      showToast(`Lista creada y "${matNombre}" añadido`, 'success');
    } else { showToast('Lista creada', 'success'); }
    renderPedidos(); renderSolicitudes(); renderDashboard(); updateBadges();
  } catch(e) { showToast('Error', 'error'); }
  hideLoading();
}

async function guardarLineaPedido() {
  const pedidoId = v('linea-pedido-id');
  const pedido = DATA.pedidos.find(p => p.ID_Pedido === pedidoId);
  const esServicio = pedido?.Tipo === 'Servicio';
  let materialNombre = '', equipoId = '', eqRowToCreate = null;

  if (esServicio) {
    const esNuevo = document.getElementById('btn-seq-nuevo').classList.contains('active');
    if (esNuevo) {
      const newEqId   = v('linea-nuevo-eq-id').trim();
      const newEqTipo = v('linea-nuevo-eq-tipo').trim();
      const newEqMarca  = v('linea-nuevo-eq-marca').trim();
      const newEqModelo = v('linea-nuevo-eq-modelo').trim();
      if (!newEqId || !newEqTipo) { showToast('El ID y el tipo de equipo son obligatorios', 'error'); return; }
      if (DATA.equipos.find(e => e.ID_Activo === newEqId)) { showToast('Ya existe un equipo con ese ID', 'error'); return; }
      materialNombre = [newEqTipo, newEqMarca, newEqModelo].filter(Boolean).join(' ');
      equipoId = newEqId;
      const eqRow = new Array(23).fill('');
      eqRow[0] = newEqId;   eqRow[1] = newEqTipo;
      eqRow[2] = newEqMarca; eqRow[3] = newEqModelo;
      eqRow[9]  = pedido?.Proveedor || '';
      eqRow[11] = 'En pedido';
      eqRow[17] = 'Creado desde pedido ' + pedidoId;
      eqRow[18] = v('linea-precio') || '';
      eqRowToCreate = eqRow;
    } else {
      materialNombre = v('linea-servicio-desc');
      if (!materialNombre) { showToast('Indica la descripción del servicio', 'error'); return; }
      equipoId = document.getElementById('linea-equipo-id').value;
    }
  } else {
    const esLibre = document.getElementById('btn-lsource-libre').classList.contains('active');
    materialNombre = esLibre ? v('linea-material-libre') : (() => { const id = document.getElementById('linea-material-id').value; const mat = DATA.material.find(m => m.ID_Material === id); return mat ? mat.Nombre : ''; })();
    if (!materialNombre) { showToast('Indica el material', 'error'); return; }
  }

  const cant = v('linea-cantidad');
  if (!cant || parseFloat(cant) <= 0) { showToast('Indica la cantidad', 'error'); return; }
  const precio = v('linea-precio') || '';

  if (eqRowToCreate) {
    showLoading('Creando equipo en inventario...');
    try {
      await sheetsAppend('Equipos', eqRowToCreate);
      DATA.equipos.push(rowToObj(eqRowToCreate, 'equipos'));
    } catch(e) {
      hideLoading(); showToast('Error al crear el equipo en el inventario', 'error'); return;
    }
    hideLoading();
  }

  const id = genId('LIN-');
  const obs = v('linea-obs');
  const row = [id, pedidoId, materialNombre, cant, '0', 'Pendiente', obs, precio, equipoId];
  const objLocal = rowToObj(row, 'lineasPedido');
  DATA.lineasPedido.push(objLocal);
  closeModal('modal-nueva-linea');
  verDetallePedido(pedidoId);
  showToast(eqRowToCreate ? 'Equipo creado en inventario y línea añadida' : 'Línea añadida', 'success');
  try { await sheetsAppend('Lineas_Pedido', row); }
  catch(e) {
    const idx = DATA.lineasPedido.indexOf(objLocal);
    if (idx !== -1) DATA.lineasPedido.splice(idx, 1);
    showToast('Error al guardar la línea. Vuelve a intentarlo.', 'error');
    verDetallePedido(pedidoId);
  }
}

async function guardarEstadoPedido() {
  const pedidoId = v('estado-pedido-id');
  const nuevoEstado = v('estado-pedido-nuevo');
  // Recepción parcial y completa son automáticos — no se pueden poner manualmente
  if (nuevoEstado === 'Recepción parcial' || nuevoEstado === 'Recepción completa') {
    showToast('Este estado se asigna automáticamente al registrar recepciones de líneas', 'error'); return;
  }
  const idx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const p = DATA.pedidos[idx];
  const hoy = new Date().toISOString().split('T')[0];
  p.Estado = nuevoEstado;
  if (nuevoEstado === 'Presupuesto solicitado') p.Fecha_Presupuesto = hoy;
  if (nuevoEstado === 'Presupuesto aprobado')   p.Fecha_Aprobacion = hoy;
  if (nuevoEstado === 'Recepción completa')     p.Fecha_Recepcion_Completa = hoy;
  // Nota: Fecha_Factura se gestiona desde el generador de hoja, no desde este modal
  const numPres = v('estado-num-presupuesto'); if (numPres) p.Numero_Presupuesto = numPres;
  const numFact = v('estado-num-factura');     if (numFact) p.Numero_Factura = numFact;
  const provNew = v('estado-proveedor');       if (provNew) p.Proveedor = provNew;
  const row = [p.ID_Pedido, p.Nombre_Lista, p.Proveedor, p.Fecha_Creacion, p.Fecha_Presupuesto, p.Fecha_Aprobacion, p.Fecha_Pedido_Enviado, p.Fecha_Recepcion_Completa, p.Fecha_Factura, p.Estado, p.Numero_Presupuesto, p.Numero_Factura, p.Observaciones];
  showLoading('Actualizando...');
  try {
    await sheetsUpdate(`Pedidos!A${idx+2}:M${idx+2}`, row);

    // ── Sincronizar estado de las solicitudes vinculadas ────────────────
    // Mapa pedido → solicitud. Los estados finales (Recibido, Rechazado,
    // Archivado) los gestiona guardarRecepcionLinea; aquí no los tocamos.
    const MAPA_SOL = {
      'Presupuesto aprobado': 'En espera de recepción',
    }
    const ESTADOS_FINALES_SOL = ['Recibido', 'Rechazado', 'Cancelado'];
    const nuevoEstadoSol = MAPA_SOL[nuevoEstado];
    if (nuevoEstadoSol) {
      const solsVinculadas = DATA.solicitudes.filter(s =>
        s.Lista_Pedido === pedidoId && !ESTADOS_FINALES_SOL.includes(s.Estado)
      );
      for (const sol of solsVinculadas) {
        const solIdx = DATA.solicitudes.indexOf(sol);
        sol.Estado = nuevoEstadoSol;
        const rowSol = [sol.ID_Solicitud, sol.Material, sol.Cantidad_Solicitada,
          sol.Solicitante, sol.Fecha, sol.Motivo, sol.Proveedor_Requerido,
          nuevoEstadoSol, sol.Lista_Pedido, sol.Observaciones];
        try {
          await sheetsUpdate(`Solicitudes!A${solIdx+2}:J${solIdx+2}`, rowSol);
        } catch(e) { console.warn('No se pudo actualizar solicitud', sol.ID_Solicitud, e); }
      }
    }
    showToast('Estado actualizado', 'success');
    closeModal('modal-estado-pedido'); renderPedidos(); renderSolicitudes();
    if (document.getElementById('page-pedido-detalle').classList.contains('active')) verDetallePedido(pedidoId);
  } catch(e) { showToast('Error', 'error'); }
  hideLoading();
}

async function guardarRecepcionMasiva() {
  const pedidoId = v('recmas-pedido-id');
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId && l.Estado_Linea !== 'Recibido');
  const aRecibir = lineas
    .map(l => ({
      linea: l,
      cantRec: parseFloat(document.getElementById('recmas-cant-' + l.ID_Linea)?.value) || 0,
      obs: document.getElementById('recmas-obs-' + l.ID_Linea)?.value || ''
    }))
    .filter(x => x.cantRec > 0);
  if (!aRecibir.length) { showToast('Introduce al menos una cantidad', 'error'); return; }
  closeModal('modal-recepcion-masiva');
  showLoading('Registrando albarán...');
  let procesadas = 0, errores = 0;
  for (const { linea, cantRec, obs } of aRecibir) {
    const idx = DATA.lineasPedido.indexOf(linea);
    const cantPed = parseFloat(linea.Cantidad_Pedida) || 0;
    const cantRecTotal = (parseFloat(linea.Cantidad_Recibida) || 0) + cantRec;
    const cantRecAntes = linea.Cantidad_Recibida;
    const estadoAntes  = linea.Estado_Linea;
    linea.Cantidad_Recibida = String(cantRecTotal);
    linea.Estado_Linea = cantRecTotal >= cantPed ? 'Recibido' : (cantRecTotal > 0 ? 'Recibido parcialmente' : 'Pendiente');
    if (obs) linea.Observaciones = obs;
    try {
      await _persistirLinea(idx, linea);
      procesadas++;
      const mat = DATA.material.find(m => m.Nombre === linea.Material || linea.Material.startsWith(m.Nombre));
      if (mat && cantRec > 0) {
        try { await _actualizarStockMaterial(mat, cantRec, pedidoId, null); }
        catch(e) { console.warn('[albarán] stock no actualizado para', linea.Material, e); }
      }
      if (linea.Estado_Linea === 'Recibido') {
        try { await _actualizarSolicitudOrigen(linea, pedidoId); }
        catch(e) { console.warn('[albarán] solicitud no actualizada para', linea.ID_Linea, e); }
      }
    } catch(e) {
      linea.Cantidad_Recibida = cantRecAntes;
      linea.Estado_Linea = estadoAntes;
      errores++;
      console.error('[albarán] error persistiendo línea', linea.ID_Linea, e);
    }
  }
  try { await _actualizarEstadoPedidoPostRecepcion(pedidoId); }
  catch(e) { console.warn('[albarán] estado del pedido no actualizado', e); }
  hideLoading();
  if (errores > 0) {
    showToast(`${procesadas} línea(s) procesada(s), ${errores} con error`, errores === aRecibir.length ? 'error' : 'success');
  } else {
    showToast(`Albarán registrado: ${procesadas} línea(s)`, 'success');
  }
  renderMaterial(); renderSolicitudes(); renderPedidos(); renderDashboard(); updateBadges();
  verDetallePedido(pedidoId);
}

async function guardarRecepcionLinea() {
  const lineaId = v('rec-linea-id'), pedidoId = v('rec-pedido-id');
  const idx = DATA.lineasPedido.findIndex(l => l.ID_Linea === lineaId);
  if (idx === -1) return;
  const l = DATA.lineasPedido[idx];
  const cantPed = parseFloat(l.Cantidad_Pedida) || 0;
  // Servicios: confirmar realizado sin actualizar stock
  const pedido = DATA.pedidos.find(p => p.ID_Pedido === pedidoId);
  if (pedido?.Tipo === 'Servicio') {
    const yaRec = parseFloat(l.Cantidad_Recibida) || 0;
    await _completarRecepcionLinea(idx, l, cantPed - yaRec, cantPed, pedidoId, null, v('rec-obs'));
    return;
  }
  const cantRec = parseFloat(v('rec-cantidad')) || 0;
  const mat = DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
  if (!mat && cantRec > 0) {
    closeModal('modal-recepcion-linea');
    _pendingRecepcion = { lineaId, pedidoId, cantRec, obs: v('rec-obs') };
    openModalMaterial(); sv('mat-nombre', l.Material);
    setTimeout(() => {
      const footer = document.querySelector('#modal-material .form-footer');
      if (footer && !document.getElementById('aviso-recepcion-pendiente')) {
        const aviso = document.createElement('div');
        aviso.id = 'aviso-recepcion-pendiente';
        aviso.style.cssText = 'grid-column:1/-1;padding:10px 12px;background:var(--warning-light);border-radius:var(--radius-sm);font-size:12px;color:var(--warning);border:1px solid #e8c98a;margin-bottom:4px';
        aviso.innerHTML = '⚠️ Al guardar, se registrará automáticamente la recepción de <strong>' + cantRec + ' uds de ' + l.Material + '</strong> del pedido ' + pedidoId + '.';
        footer.before(aviso);
      }
    }, 100);
    showToast('Este material no está catalogado. Completa su ficha para continuar.', 'error');
    return;
  }
  await _completarRecepcionLinea(idx, l, cantRec, cantPed, pedidoId, mat, v('rec-obs'));
}

// ── Subfunciones de recepción ─────────────────────────────────

async function _persistirLinea(idx, l) {
  const row = [l.ID_Linea, l.Pedido, l.Material, l.Cantidad_Pedida, l.Cantidad_Recibida, l.Estado_Linea, l.Observaciones];
  await sheetsUpdate(`Lineas_Pedido!A${idx+2}:G${idx+2}`, row);
}

async function _actualizarStockMaterial(mat, cantRec, pedidoId, idUbicacion) {
  const lotesDelMat = DATA.materialUbicaciones.filter(lu => lu.ID_Material === mat.ID_Material);
  if (lotesDelMat.length > 0) {
    const loteTarget = idUbicacion
      ? DATA.materialUbicaciones.find(lu => lu.ID_Material === mat.ID_Material && lu.ID_Ubicacion === idUbicacion)
      : lotesDelMat[0];
    if (loteTarget) {
      const loteIdx = DATA.materialUbicaciones.indexOf(loteTarget);
      const nuevoLocal = (parseFloat(loteTarget.Stock_Local) || 0) + cantRec;
      loteTarget.Stock_Local = String(nuevoLocal);
      await sheetsUpdate(`Material_Ubicaciones!D${loteIdx+2}`, [nuevoLocal]);
    }
  }
  const nuevoStock = lotesDelMat.length > 0
    ? DATA.materialUbicaciones.filter(lu => lu.ID_Material === mat.ID_Material).reduce((s, lu) => s + (parseFloat(lu.Stock_Local)||0), 0)
    : (parseFloat(mat.Stock_Actual)||0) + cantRec;
  const idxMat = DATA.material.indexOf(mat);
  mat.Stock_Actual = String(nuevoStock);
  await sheetsUpdate(`Material!H${idxMat+2}`, [nuevoStock]);
  const movRow = [genId('MOV-'), mat.Nombre, 'Entrada', cantRec, currentUser?.name||'Usuario', new Date().toISOString().split('T')[0], 'Recepción pedido ' + pedidoId, ''];
  await sheetsAppend('Movimientos', movRow);
  DATA.movimientos.push(rowToObj(movRow, 'movimientos'));
}

async function _actualizarEstadoPedidoPostRecepcion(pedidoId) {
  const pedIdx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (pedIdx === -1) return;
  const p = DATA.pedidos[pedIdx];
  const todasLineas    = DATA.lineasPedido.filter(x => x.Pedido === pedidoId);
  const todasRecibidas = todasLineas.every(x => x.Estado_Linea === 'Recibido');
  if (todasRecibidas && p.Estado !== 'Recepción completa' && p.Estado !== 'Factura recibida') {
    p.Estado = 'Recepción completa';
    p.Fecha_Recepcion_Completa = new Date().toISOString().split('T')[0];
    const rowP = [p.ID_Pedido, p.Nombre_Lista, p.Proveedor, p.Fecha_Creacion, p.Fecha_Presupuesto, p.Fecha_Aprobacion, p.Fecha_Pedido_Enviado, p.Fecha_Recepcion_Completa, p.Fecha_Factura, p.Estado, p.Numero_Presupuesto, p.Numero_Factura, p.Observaciones, p.Doc_Hoja_Generada||'', p.Doc_Hoja_Completada||'', p.Doc_Enviada_Jefatura||''];
    await sheetsUpdate(`Pedidos!A${pedIdx+2}:P${pedIdx+2}`, rowP);
    showToast('¡Pedido completo! Estado actualizado automáticamente', 'success');
  } else if (!todasRecibidas && p.Estado === 'Presupuesto aprobado') {
    p.Estado = 'Recepción parcial';
    const rowP = [p.ID_Pedido, p.Nombre_Lista, p.Proveedor, p.Fecha_Creacion, p.Fecha_Presupuesto, p.Fecha_Aprobacion, p.Fecha_Pedido_Enviado, p.Fecha_Recepcion_Completa, p.Fecha_Factura, 'Recepción parcial', p.Numero_Presupuesto, p.Numero_Factura, p.Observaciones];
    await sheetsUpdate(`Pedidos!A${pedIdx+2}:M${pedIdx+2}`, rowP);
  }
}

async function _actualizarSolicitudOrigen(l, pedidoId) {
  const normNombre = n => (n || '').normalize('NFC').replace(/\s*\[.*?\]/g, '').trim().toLowerCase();
  // Intento 1 — match por ID embebido en Observaciones ("Desde solicitud SOL-xxx")
  const solIdMatch = (l.Observaciones || '').match(/Desde solicitud (SOL-\S+)/);
  let solOrigen = solIdMatch
    ? DATA.solicitudes.find(s => s.ID_Solicitud === solIdMatch[1] && s.Estado !== 'Recibido')
    : null;
  // Intento 2 — match por pedidoId + nombre normalizado (cubre líneas añadidas sin solicitud previa)
  if (!solOrigen) {
    solOrigen = DATA.solicitudes.find(s =>
      s.Lista_Pedido === pedidoId &&
      normNombre(s.Material) === normNombre(l.Material) &&
      s.Estado !== 'Recibido'
    );
  }
  if (!solOrigen) {
    console.warn('[pedidos] No se encontró solicitud origen para línea', l.ID_Linea, '— estado de solicitud no actualizado');
    return;
  }
  const solIdx = DATA.solicitudes.indexOf(solOrigen);
  if (!solOrigen.Lista_Pedido) solOrigen.Lista_Pedido = pedidoId;
  const fechaHoy = new Date().toISOString().split('T')[0];
  const obsSinFecha = (solOrigen.Observaciones || '').replace(/\[Recibido:\d{4}-\d{2}-\d{2}\]\s*/g, '').trim();
  solOrigen.Observaciones = (obsSinFecha ? obsSinFecha + ' ' : '') + `[Recibido:${fechaHoy}]`;
  solOrigen.Estado = 'Recibido';
  const rowSol = [solOrigen.ID_Solicitud, solOrigen.Material, solOrigen.Cantidad_Solicitada, solOrigen.Solicitante, solOrigen.Fecha, solOrigen.Motivo, solOrigen.Proveedor_Requerido, 'Recibido', solOrigen.Lista_Pedido, solOrigen.Observaciones];
  try {
    await sheetsUpdate(`Solicitudes!A${solIdx+2}:J${solIdx+2}`, rowSol);
  } catch(e) {
    console.warn('[pedidos] No se pudo actualizar solicitud a Recibido', solOrigen.ID_Solicitud, e);
  }
}

// ── Orquestador principal de recepción ───────────────────────

async function _completarRecepcionLinea(idx, l, cantRec, cantPed, pedidoId, mat, obs, idUbicacion = null) {
  // Guardar estado previo para revertir si el primer paso falla
  const cantRecAntes  = l.Cantidad_Recibida;
  const estadoAntes   = l.Estado_Linea;
  const obsAntes      = l.Observaciones;

  // Acumular sobre lo ya recibido
  const cantRecTotal = (parseFloat(l.Cantidad_Recibida) || 0) + cantRec;
  l.Cantidad_Recibida = String(cantRecTotal);
  l.Estado_Linea = cantRecTotal >= cantPed ? 'Recibido' : (cantRecTotal > 0 ? 'Recibido parcialmente' : 'Pendiente');
  if (obs) l.Observaciones = obs;

  showLoading('Registrando recepción...');

  // Paso 1 — crítico: si falla, revertir memoria y abortar sin haber cambiado nada
  try {
    await _persistirLinea(idx, l);
  } catch(e) {
    l.Cantidad_Recibida = cantRecAntes;
    l.Estado_Linea      = estadoAntes;
    l.Observaciones     = obsAntes;
    showToast('Error al guardar la recepción. No se modificó nada.', 'error');
    console.error('[recepción] fallo en _persistirLinea', e);
    hideLoading(); return;
  }

  // Pasos siguientes — si fallan, la línea ya está guardada correctamente;
  // avisamos con precisión para que el gestor pueda corregir lo que falta.
  if (mat && cantRec > 0) {
    try {
      await _actualizarStockMaterial(mat, cantRec, pedidoId, idUbicacion);
    } catch(e) {
      showToast('⚠️ Recepción guardada, pero el stock no se actualizó. Corrígelo manualmente en el inventario.', 'error');
      console.error('[recepción] fallo en _actualizarStockMaterial', e);
    }
  }

  try {
    await _actualizarEstadoPedidoPostRecepcion(pedidoId);
  } catch(e) {
    showToast('⚠️ Recepción guardada, pero el estado del pedido no se actualizó. Cámbialo manualmente.', 'error');
    console.error('[recepción] fallo en _actualizarEstadoPedidoPostRecepcion', e);
  }

  if (l.Estado_Linea === 'Recibido') await _actualizarSolicitudOrigen(l, pedidoId);

  showToast('Recepción registrada', 'success');
  closeModal('modal-recepcion-linea');
  renderMaterial(); renderSolicitudes(); renderPedidos(); renderDashboard(); updateBadges();
  verDetallePedido(pedidoId);
  hideLoading();
}

async function eliminarLineaPedido(lineaId, pedidoId) {
  if (!confirm('¿Eliminar esta línea del pedido?')) return;
  const idx = DATA.lineasPedido.findIndex(l => l.ID_Linea === lineaId);
  if (idx === -1) return;
  showLoading('Eliminando...');
  try {
    // Vaciamos la fila en Sheets y la eliminamos del array local
    await sheetsClear(`Lineas_Pedido!A${idx+2}:G${idx+2}`);
    DATA.lineasPedido.splice(idx, 1);
    // Filtrar posibles entradas vacías que puedan quedar en el array
    DATA.lineasPedido = DATA.lineasPedido.filter(l => l.ID_Linea);
    showToast('Línea eliminada', 'success');
    verDetallePedido(pedidoId);
  }
  catch(e) { showToast('Error eliminando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// AVANCE SECUENCIAL DE ESTADO DE PEDIDO
// ============================================================
async function avanceEstadoPedido(pedidoId) {
  const idx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const p = DATA.pedidos[idx];
  const posActual = SECUENCIA_ESTADOS.indexOf(p.Estado);
  if (posActual === -1 || posActual >= SECUENCIA_ESTADOS.length - 1) {
    showToast('El pedido ya está en el estado final', 'info'); return;
  }
  const nuevoEstado = SECUENCIA_ESTADOS[posActual + 1];
  const hoy = new Date().toISOString().split('T')[0];
  p.Estado = nuevoEstado;
  if (nuevoEstado === 'Presupuesto solicitado') p.Fecha_Presupuesto = hoy;
  if (nuevoEstado === 'Presupuesto aprobado')   p.Fecha_Aprobacion = hoy;
  if (nuevoEstado === 'Recepción completa')      p.Fecha_Recepcion_Completa = hoy;
  const row = [p.ID_Pedido, p.Nombre_Lista, p.Proveedor, p.Fecha_Creacion, p.Fecha_Presupuesto, p.Fecha_Aprobacion, p.Fecha_Pedido_Enviado, p.Fecha_Recepcion_Completa, p.Fecha_Factura, p.Estado, p.Numero_Presupuesto, p.Numero_Factura, p.Observaciones, p.Doc_Hoja_Generada||'', p.Doc_Hoja_Completada||'', p.Doc_Enviada_Jefatura||''];
  showLoading('Actualizando estado...');
  try {
    await sheetsUpdate(`Pedidos!A${idx+2}:P${idx+2}`, row);
    showToast(`Estado: ${nuevoEstado}`, 'success');
    renderPedidos();
    if (document.getElementById('page-pedido-detalle').classList.contains('active')) verDetallePedido(pedidoId);
  } catch(e) { showToast('Error', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// DOCUMENTACIÓN Y ARCHIVO DE PEDIDOS
// ============================================================
async function toggleDocPedido(pedidoId, campo, valor) {
  const idx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const p = DATA.pedidos[idx];
  p[campo] = valor ? 'TRUE' : '';
  const colMap = { Doc_Hoja_Generada: 'N', Doc_Hoja_Completada: 'O', Doc_Enviada_Jefatura: 'P' };
  const col = colMap[campo];
  showLoading('Guardando...');
  try {
    await sheetsUpdate(`Pedidos!${col}${idx+2}`, [p[campo]]);
    showToast('Documentación actualizada', 'success');
    verDetallePedido(pedidoId);
  } catch(e) { showToast('Error guardando', 'error'); p[campo] = valor ? '' : 'TRUE'; }
  hideLoading();
}

async function archivarPedido(pedidoId) {
  // Archivado directo sin confirmación
  const idx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const p = DATA.pedidos[idx];
  p.Estado = 'Archivado';
  const row = [p.ID_Pedido, p.Nombre_Lista, p.Proveedor, p.Fecha_Creacion, p.Fecha_Presupuesto, p.Fecha_Aprobacion, p.Fecha_Pedido_Enviado, p.Fecha_Recepcion_Completa, p.Fecha_Factura, 'Archivado', p.Numero_Presupuesto, p.Numero_Factura, p.Observaciones, p.Doc_Hoja_Generada, p.Doc_Hoja_Completada, p.Doc_Enviada_Jefatura];
  showLoading('Archivando...');
  try {
    await sheetsUpdate(`Pedidos!A${idx+2}:P${idx+2}`, row);
    showToast('Pedido archivado', 'success');
    showPage('pedidos');
    renderPedidos();
  } catch(e) { showToast('Error archivando', 'error'); p.Estado = 'Recepción completa'; }
  hideLoading();
}

// ============================================================
// EDITAR PROVEEDOR DEL PEDIDO
// ============================================================
function openModalEditarProveedor(pedidoId) {
  sv('edit-prov-pedido-id', pedidoId);
  const p   = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const sel = document.getElementById('edit-prov-select');
  sel.innerHTML = '<option value="">Sin asignar</option>' +
    DATA.proveedores.filter(x => x.Activo !== 'FALSE')
      .map(x => `<option value="${x.Nombre_Proveedor}"${p?.Proveedor === x.Nombre_Proveedor ? ' selected' : ''}>${x.Nombre_Proveedor}</option>`)
      .join('');
  openModal('modal-editar-proveedor');
}

async function guardarProveedorPedido() {
  const pedidoId = v('edit-prov-pedido-id');
  const nuevo    = v('edit-prov-select');
  const idx      = DATA.pedidos.findIndex(x => x.ID_Pedido === pedidoId);
  if (idx === -1) return;
  showLoading('Guardando...');
  try {
    await sheetsUpdate(`Pedidos!C${idx + 2}`, [nuevo]);
    DATA.pedidos[idx].Proveedor = nuevo;
    showToast('Proveedor actualizado', 'success');
    closeModal('modal-editar-proveedor');
    verDetallePedido(pedidoId);
    renderPedidos();
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// EDITAR SOLICITUD (solo Profesor, solo en estado Pendiente)
// ============================================================
function openModalEditarSolicitud(solId) {
  const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!sol || sol.Estado !== 'Pendiente') { showToast('Esta solicitud no se puede editar', 'error'); return; }
  sv('edit-sol-id', solId);
  sv('edit-sol-cantidad', sol.Cantidad_Solicitada);
  sv('edit-sol-urgencia', sol.Urgencia || 'Normal');
  sv('edit-sol-motivo', sol.Motivo || '');
  // Observaciones: limpiar etiqueta interna [Unidad:...] si la hubiera para no mostrarla al usuario
  const obsLimpia = (sol.Observaciones || '').replace(/\[Unidad:[^\]]+\]\s*/g, '').replace(/\[Recibido:[^\]]+\]\s*/g, '').trim();
  sv('edit-sol-obs', obsLimpia);
  const sel = document.getElementById('edit-sol-proveedor');
  if (sel) {
    sel.innerHTML = '<option value="">Sin preferencia</option>' + DATA.proveedores.filter(p => p.Activo !== 'FALSE').map(p => `<option value="${p.Nombre_Proveedor}"${sol.Proveedor_Requerido === p.Nombre_Proveedor ? ' selected' : ''}>${p.Nombre_Proveedor}</option>`).join('');
  }
  // Mostrar nombre del material (solo lectura)
  const matLabel = document.getElementById('edit-sol-material-nombre');
  if (matLabel) matLabel.textContent = sol.Material;
  openModal('modal-editar-solicitud');
}

async function guardarEdicionSolicitud() {
  const solId = v('edit-sol-id');
  const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!sol) { showToast('Error: solicitud no encontrada', 'error'); return; }
  const cant = v('edit-sol-cantidad');
  if (!cant || parseFloat(cant) <= 0) { showToast('Indica la cantidad', 'error'); return; }
  const urgencia = v('edit-sol-urgencia');
  const motivo   = v('edit-sol-motivo');
  const proveedor = v('edit-sol-proveedor');
  const obsBase  = urgencia === 'Urgente' ? '⚠️ URGENTE — ' + v('edit-sol-obs') : v('edit-sol-obs');
  // Preservar etiquetas internas ([Unidad:...]) que pudieran existir en observaciones originales
  const tagUnidad = ((sol.Observaciones || '').match(/\[Unidad:[^\]]+\]/)||[])[0] || '';
  const obsFinal = (tagUnidad ? tagUnidad + ' ' : '') + obsBase;
  sol.Cantidad_Solicitada = cant;
  sol.Urgencia = urgencia;
  sol.Motivo = motivo;
  sol.Proveedor_Requerido = proveedor;
  sol.Observaciones = obsFinal;
  const idx = DATA.solicitudes.indexOf(sol);
  const row = [sol.ID_Solicitud, sol.Material, sol.Cantidad_Solicitada, sol.Solicitante, sol.Fecha, sol.Motivo, sol.Proveedor_Requerido, sol.Estado, sol.Lista_Pedido, sol.Observaciones];
  showLoading('Guardando...');
  try {
    await sheetsUpdate(`Solicitudes!A${idx+2}:J${idx+2}`, row);
    showToast('Solicitud actualizada', 'success');
    closeModal('modal-editar-solicitud');
    renderSolicitudes();
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}
