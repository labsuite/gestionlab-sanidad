// ============================================================
// GUARDAR SOLICITUDES
// ============================================================
async function guardarSolicitud() {
  const esNuevo = document.getElementById('btn-source-nuevo').classList.contains('active');
  // Declarar variables comunes ANTES del if/else para evitar problemas de scope
  const cant = v('sol-cantidad');
  if (!cant || parseFloat(cant) <= 0) { showToast('Indica la cantidad', 'error'); return; }
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

  showLoading('Guardando...');
  try {
    const { solicitud } = await callEdgeFunction('gestionar-solicitud', {
      accion: 'crear', material: materialNombre, cantidad_solicitada: cant, solicitante: usuario,
      motivo: v('sol-motivo') + (fechaNecesidad ? ' · Necesario: ' + fechaNecesidad : ''),
      proveedor_requerido: v('sol-proveedor'), observaciones: unidadObs + obsBase,
    });
    const objLocal = _solicitudSbToObj(solicitud);
    objLocal.Urgencia = urgencia;
    DATA.solicitudes.push(objLocal);
    showToast('Solicitud enviada', 'success');
    closeModal('modal-solicitud'); renderSolicitudes(); updateBadges();
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}

async function rechazarSolicitud(solId) {
  if (!confirm('¿Rechazar esta solicitud?')) return;
  const idx = DATA.solicitudes.findIndex(s => s.ID_Solicitud === solId);
  if (idx === -1) return;
  showLoading('Actualizando...');
  try {
    const { solicitud } = await callEdgeFunction('gestionar-solicitud', { accion: 'rechazar', id_solicitud: solId });
    DATA.solicitudes[idx] = { ...DATA.solicitudes[idx], ..._solicitudSbToObj(solicitud) };
    showToast('Solicitud rechazada', 'success'); renderSolicitudes();
  } catch(e) { showToast(e.message || 'Error', 'error'); }
  hideLoading();
}

async function cancelarSolicitud(solId) {
  if (!confirm('¿Cancelar esta solicitud? Se marcará como Cancelada.')) return;
  const idx = DATA.solicitudes.findIndex(s => s.ID_Solicitud === solId);
  if (idx === -1) return;
  const sol = DATA.solicitudes[idx];
  if (sol.Estado !== 'Pendiente') { showToast('Solo se pueden cancelar solicitudes Pendientes', 'error'); return; }
  showLoading('Actualizando...');
  try {
    const { solicitud } = await callEdgeFunction('gestionar-solicitud', { accion: 'cancelar', id_solicitud: solId });
    DATA.solicitudes[idx] = { ...DATA.solicitudes[idx], ..._solicitudSbToObj(solicitud) };
    showToast('Solicitud cancelada', 'success'); renderSolicitudes();
  } catch(e) { showToast(e.message || 'Error', 'error'); }
  hideLoading();
}

// ============================================================
// COMPRADO APARTE — lo pidieron por la app pero alguien lo compró por su
// cuenta (gamuzas en el súper…). Cierra la solicitud sin pasar por un pedido.
// ============================================================
function openModalCompraAparte(solId) {
  const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!sol) return;
  sv('ca-sol-id', solId);
  document.getElementById('ca-material').textContent = `${sol.Material} · ${sol.Cantidad_Solicitada}`;
  sv('ca-fecha', new Date().toISOString().split('T')[0]);
  sv('ca-importe', ''); sv('ca-nota', '');
  const mat = DATA.material.find(m => (sol.ID_Material && m.ID_Material === sol.ID_Material) || m.Nombre === sol.Material);
  document.getElementById('ca-stock-group').style.display = mat ? '' : 'none';
  document.getElementById('ca-sin-catalogo').style.display = mat ? 'none' : '';
  document.getElementById('ca-stock-check').checked = false;
  document.getElementById('ca-stock-campos').style.display = 'none';
  if (mat) {
    sv('ca-stock-cantidad', sol.Cantidad_Solicitada || '');
    const sel = document.getElementById('ca-stock-ubicacion');
    sel.innerHTML = _opcionesUbicacionRecepcion(mat.ID_Material, mat.Unidad);
    const lotes = getMatUbics(mat.ID_Material);
    if (lotes.length === 1) sel.value = lotes[0].ID_Ubicacion;
    else if (mat.Ubicacion) sel.value = mat.Ubicacion;
  }
  openModal('modal-compra-aparte');
}

async function guardarCompraAparte() {
  const solId = v('ca-sol-id');
  const idx = DATA.solicitudes.findIndex(s => s.ID_Solicitud === solId);
  if (idx === -1) return;
  const conStock = document.getElementById('ca-stock-group').style.display !== 'none'
    && document.getElementById('ca-stock-check').checked;
  const body = { accion: 'comprado_aparte', id_solicitud: solId, fecha: v('ca-fecha'), importe: v('ca-importe'), nota: v('ca-nota') };
  if (conStock) {
    const cant = parseFloat(v('ca-stock-cantidad'));
    if (!cant || cant <= 0) { showToast('Indica la cantidad que entra en el inventario', 'error'); return; }
    body.cantidad_stock = cant;
    body.id_ubicacion = v('ca-stock-ubicacion');
  }
  showLoading('Guardando...');
  try {
    const { solicitud, stock } = await callEdgeFunction('gestionar-solicitud', body);
    DATA.solicitudes[idx] = { ...DATA.solicitudes[idx], ..._solicitudSbToObj(solicitud) };
    closeModal('modal-compra-aparte');
    // El stock lo ha tocado el servidor (bote + total + movimiento): recargar
    // para no reimplementar aquí esa cuenta.
    if (stock) await loadAllData();
    renderAll();
    showToast(stock ? `Comprado aparte · +${stock.cantidad} en inventario` : 'Marcado como comprado aparte', 'success');
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// Pedidos a los que todavía se les puede añadir material. "Presupuesto
// solicitado" también vale: en la práctica se siguen metiendo artículos
// después de pedir el presupuesto, y a la casa comercial no le importa. Esas
// líneas quedan marcadas por gestionar-linea-pedido y salen en un apartado
// aparte del detalle, porque hay que solicitarlas por separado. A partir de
// "Presupuesto aprobado" el pedido está cerrado en firme y ya no aparece aquí.
function _pedidosQueAdmitenLineas() {
  return DATA.pedidos.filter(p => p.Estado === 'Abierto' || p.Estado === 'Presupuesto solicitado');
}

function _avisoPedidoPresupuestoSolicitado(p) {
  return p.Estado === 'Presupuesto solicitado'
    ? ` · <span style="color:var(--warning)">presupuesto ya solicitado — irá aparte</span>`
    : '';
}

async function solicitudAPedido(solId) {
  const pedidosAbiertos = _pedidosQueAdmitenLineas();
  if (!pedidosAbiertos.length) {
    const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
    if (sol) _pendingSolicitudParaPedido = { tipo: 'sol', solId, matNombre: sol.Material, cantidad: sol.Cantidad_Solicitada };
    openModalNuevoPedido(); return;
  }
  document.getElementById('sel-ped-sol-id').value = solId;
  const lista = document.getElementById('sel-ped-lista');
  lista.innerHTML = pedidosAbiertos.map(p => {
    const nLineas = DATA.lineasPedido.filter(l => l.Pedido === p.ID_Pedido).length;
    return `<div class="pedido-opcion" onclick="confirmarSolicitudAPedido('${p.ID_Pedido}')"><div><div class="pedido-opcion-nombre">${p.Nombre_Lista}</div><div class="pedido-opcion-meta">${p.Proveedor||'Sin proveedor asignado'} · ${nLineas} línea(s)${_avisoPedidoPresupuestoSolicitado(p)}</div></div><span style="color:var(--accent);font-size:18px">→</span></div>`;
  }).join('');
  openModal('modal-seleccionar-pedido');
}

async function confirmarSolicitudAPedido(pedidoId) {
  const solId = document.getElementById('sel-ped-sol-id').value;
  closeModal('modal-seleccionar-pedido');
  const pedido = DATA.pedidos.find(p => p.ID_Pedido === pedidoId);
  const sol    = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
  if (!pedido || !sol) { showToast('Error al añadir al pedido', 'error'); return; }
  showLoading('Añadiendo al pedido...');
  try {
    const { linea } = await callEdgeFunction('gestionar-linea-pedido', { accion: 'crear', pedido: pedidoId, id_solicitud: solId });
    DATA.lineasPedido.push(_lineaPedidoSbToObj(linea));
    sol.Estado = 'Añadida a pedido'; sol.Lista_Pedido = pedidoId;
    showToast(`Añadido a "${pedido.Nombre_Lista}"`, 'success');
    renderAll();
    // Ofrecer navegación directa al pedido
    if (typeof mostrarToastConAccion === 'function') {
      mostrarToastConAccion(`✓ Añadido a "${pedido.Nombre_Lista}"`, 'Ver pedido', () => verDetallePedido(pedidoId));
    }
  } catch(e) { showToast(e.message || 'Error', 'error'); console.error(e); }
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
  const pedidosAbiertos = _pedidosQueAdmitenLineas();
  if (!pedidosAbiertos.length) { _pendingSolicitudParaPedido = { tipo: 'stock', matNombre: mat.Nombre, cantidad }; openModalNuevoPedido(); return; }
  document.getElementById('sel-ped-sol-id').value = '__stock__' + matId + '__' + cantidad;
  const lista = document.getElementById('sel-ped-lista');
  lista.innerHTML = pedidosAbiertos.map(p => {
    const nLineas = DATA.lineasPedido.filter(l => l.Pedido === p.ID_Pedido).length;
    return `<div class="pedido-opcion" onclick="confirmarStockAPedido('${p.ID_Pedido}','${mat.Nombre.replace(/'/g,"\\'")}','${cantidad}')"><div><div class="pedido-opcion-nombre">${p.Nombre_Lista}</div><div class="pedido-opcion-meta">${p.Proveedor||'Sin proveedor'} · ${nLineas} línea(s)${_avisoPedidoPresupuestoSolicitado(p)}</div></div><span style="color:var(--accent);font-size:18px">→</span></div>`;
  }).join('');
  openModal('modal-seleccionar-pedido');
}

async function confirmarStockAPedido(pedidoId, matNombre, cantidad) {
  closeModal('modal-seleccionar-pedido');
  showLoading('Añadiendo...');
  try {
    const { linea } = await callEdgeFunction('gestionar-linea-pedido', { accion: 'crear', pedido: pedidoId, material: matNombre, cantidad_pedida: cantidad, observaciones: 'Stock bajo mínimo' });
    DATA.lineasPedido.push(_lineaPedidoSbToObj(linea));
    showToast(`"${matNombre}" añadido al pedido`, 'success'); renderAll();
  }
  catch(e) { showToast(e.message || 'Error', 'error'); }
  hideLoading();
}

// ============================================================
// GUARDAR PEDIDOS
// ============================================================
async function guardarNuevoPedido() {
  const nombre = v('ped-nombre');
  if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  const tipo = v('ped-tipo') || 'Material';
  showLoading('Creando lista...');
  try {
    const { pedido: pedidoCreado } = await callEdgeFunction('gestionar-pedido', {
      accion: 'crear', nombre_lista: nombre, proveedor: v('ped-proveedor'), observaciones: v('ped-obs'), tipo,
    });
    DATA.pedidos.push(_pedidoSbToObj(pedidoCreado));
    const id = pedidoCreado.id_pedido;
    closeModal('modal-nuevo-pedido');
    if (_pendingSolicitudParaPedido) {
      const { tipo: tipoPend, solId, matNombre, cantidad } = _pendingSolicitudParaPedido;
      _pendingSolicitudParaPedido = null;
      const bodyLinea = tipoPend === 'sol'
        ? { accion: 'crear', pedido: id, id_solicitud: solId }
        : { accion: 'crear', pedido: id, material: matNombre, cantidad_pedida: cantidad, observaciones: 'Stock bajo mínimo' };
      const { linea } = await callEdgeFunction('gestionar-linea-pedido', bodyLinea);
      DATA.lineasPedido.push(_lineaPedidoSbToObj(linea));
      if (tipoPend === 'sol') {
        const sol = DATA.solicitudes.find(s => s.ID_Solicitud === solId);
        if (sol) { sol.Estado = 'Añadida a pedido'; sol.Lista_Pedido = id; }
      }
      showToast(`Lista creada y "${matNombre}" añadido`, 'success');
    } else { showToast('Lista creada', 'success'); }
    renderPedidos(); renderSolicitudes(); renderDashboard(); updateBadges();
  } catch(e) { showToast(e.message || 'Error', 'error'); console.error(e); }
  hideLoading();
}

async function guardarLineaPedido() {
  const pedidoId = v('linea-pedido-id');
  const pedido = DATA.pedidos.find(p => p.ID_Pedido === pedidoId);
  const esServicio = pedido?.Tipo === 'Servicio';
  let materialNombre = '', equipoId = '', nuevoEquipoDatos = null, unidadLinea = '';

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
      nuevoEquipoDatos = {
        id_activo: newEqId, tipo_equipo: newEqTipo, marca: newEqMarca, modelo: newEqModelo,
        proveedor_compra: pedido?.Proveedor || '',
        estado_operativo: 'En pedido',
        observaciones: 'Creado desde pedido ' + pedidoId,
        coste: v('linea-precio') || '',
      };
    } else {
      materialNombre = v('linea-servicio-desc');
      if (!materialNombre) { showToast('Indica la descripción del servicio', 'error'); return; }
      equipoId = document.getElementById('linea-equipo-id').value;
    }
  } else {
    const esLibre = document.getElementById('btn-lsource-libre').classList.contains('active');
    materialNombre = esLibre ? v('linea-material-libre') : (() => { const id = document.getElementById('linea-material-id').value; const mat = DATA.material.find(m => m.ID_Material === id); return mat ? mat.Nombre : ''; })();
    if (!materialNombre) { showToast('Indica el material', 'error'); return; }
    // Unidad pedida: texto libre en material no catalogado, o el desplegable
    // si el material catalogado tiene más de un tipo de unidad (ver _mostrarSelectorUnidadLinea)
    if (esLibre) {
      unidadLinea = v('linea-material-unidades');
    } else {
      const grupoUnidad = document.getElementById('linea-catalogo-unidad-group');
      if (grupoUnidad && grupoUnidad.style.display !== 'none') unidadLinea = v('linea-catalogo-unidad');
    }
  }

  const cant = v('linea-cantidad');
  if (!cant || parseFloat(cant) <= 0) { showToast('Indica la cantidad', 'error'); return; }
  const precio = v('linea-precio') || '';

  if (nuevoEquipoDatos) {
    showLoading('Creando equipo en inventario...');
    try {
      const { equipo } = await callEdgeFunction('gestionar-equipo', { accion: 'crear', ...nuevoEquipoDatos });
      DATA.equipos.push(_equipoSbToObj(equipo));
    } catch(e) {
      hideLoading(); showToast('Error al crear el equipo en el inventario', 'error'); return;
    }
    hideLoading();
  }

  const obs = v('linea-obs');
  showLoading('Guardando línea...');
  try {
    const { linea } = await callEdgeFunction('gestionar-linea-pedido', {
      accion: 'crear', pedido: pedidoId, material: materialNombre, cantidad_pedida: cant,
      observaciones: obs, precio_unitario: precio, id_equipo: equipoId, unidad: unidadLinea,
    });
    DATA.lineasPedido.push(_lineaPedidoSbToObj(linea));
    closeModal('modal-nueva-linea');
    verDetallePedido(pedidoId);
    showToast(nuevoEquipoDatos ? 'Equipo creado en inventario y línea añadida' : 'Línea añadida', 'success');
  } catch(e) {
    showToast(e.message || 'Error al guardar la línea. Vuelve a intentarlo.', 'error');
    console.error(e);
  }
  hideLoading();
}

// La usuaria ya le ha pedido a la casa comercial el presupuesto de las líneas
// que estaban en el apartado aparte: dejan de estar pendientes y se juntan con
// el resto del pedido. Es un "ya está hecho" que marca ella, no algo que la app
// pueda deducir sola.
async function marcarPresupuestoSolicitado(pedidoId) {
  const pendientes = DATA.lineasPedido.filter(l => l.Pedido === pedidoId && l.Presupuesto_Pendiente === 'Sí');
  if (!pendientes.length) return;
  if (!confirm(`¿Ya le has pedido presupuesto a la casa comercial de ${pendientes.length === 1 ? 'este artículo' : 'estos ' + pendientes.length + ' artículos'}? Se juntarán con el resto del pedido.`)) return;
  showLoading('Actualizando...');
  try {
    await callEdgeFunction('gestionar-linea-pedido', { accion: 'marcar_presupuesto_solicitado', pedido: pedidoId });
    pendientes.forEach(l => { l.Presupuesto_Pendiente = 'No'; });
    showToast('Presupuesto marcado como solicitado', 'success');
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error', 'error'); console.error(e); }
  hideLoading();
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
  const numPres = v('estado-num-presupuesto');
  const numFact = v('estado-num-factura');
  const provNew = v('estado-proveedor');
  showLoading('Actualizando...');
  try {
    await callEdgeFunction('gestionar-pedido', {
      accion: 'actualizar_estado', id_pedido: pedidoId, estado: nuevoEstado,
      numero_presupuesto: numPres || undefined, numero_factura: numFact || undefined, proveedor: provNew || undefined,
    });
    await loadAllData();
    showToast('Estado actualizado', 'success');
    closeModal('modal-estado-pedido'); renderPedidos(); renderSolicitudes();
    if (document.getElementById('page-pedido-detalle').classList.contains('active')) verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error', 'error'); console.error(e); }
  hideLoading();
}

async function guardarRecepcionMasiva() {
  const pedidoId = v('recmas-pedido-id');
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId && l.Estado_Linea !== 'Recibido');
  const aRecibir = lineas
    .map(l => ({
      id_linea: l.ID_Linea,
      cantidad: parseFloat(document.getElementById('recmas-cant-' + l.ID_Linea)?.value) || 0,
      observaciones: document.getElementById('recmas-obs-' + l.ID_Linea)?.value || '',
      id_ubicacion: document.getElementById('recmas-ubic-' + l.ID_Linea)?.value || ''
    }))
    .filter(x => x.cantidad > 0);
  if (!aRecibir.length) { showToast('Introduce al menos una cantidad', 'error'); return; }
  closeModal('modal-recepcion-masiva');
  showLoading('Registrando albarán...');
  try {
    const { procesadas, errores } = await callEdgeFunction('gestionar-linea-pedido', { accion: 'recepcion_masiva', pedido: pedidoId, lineas: aRecibir });
    await loadAllData();
    if (errores > 0) {
      showToast(`${procesadas} línea(s) procesada(s), ${errores} con error`, errores === aRecibir.length ? 'error' : 'success');
    } else {
      showToast(`Albarán registrado: ${procesadas} línea(s)`, 'success');
    }
    renderMaterial(); renderSolicitudes(); renderPedidos(); renderDashboard(); updateBadges();
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error registrando el albarán', 'error'); console.error(e); }
  hideLoading();
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
    await _completarRecepcionLinea(lineaId, pedidoId, cantPed - yaRec, v('rec-obs'));
    return;
  }
  const cantRec = parseFloat(v('rec-cantidad')) || 0;
  const idUbicacion = document.getElementById('rec-ubicacion-group')?.style.display !== 'none' ? v('rec-ubicacion-sel') : '';
  const mat = _materialDeLinea(l);
  if (!mat && cantRec > 0) {
    closeModal('modal-recepcion-linea');
    _pendingRecepcion = { lineaId, pedidoId, cantRec, obs: v('rec-obs'), idUbicacion };
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
  await _completarRecepcionLinea(lineaId, pedidoId, cantRec, v('rec-obs'), idUbicacion);
}

// ── Orquestador principal de recepción ───────────────────────
// Toda la lógica (stock, lote, movimiento, estado del pedido, solicitud
// origen) vive ahora server-side en gestionar-linea-pedido (accion:
// 'recepcion') — aquí solo se llama y se refresca DATA desde el servidor,
// que es la fuente de verdad tras una operación que toca varias tablas.
async function _completarRecepcionLinea(lineaId, pedidoId, cantRec, obs, idUbicacion, idMaterial) {
  showLoading('Registrando recepción...');
  try {
    await callEdgeFunction('gestionar-linea-pedido', { accion: 'recepcion', id_linea: lineaId, cantidad: cantRec, observaciones: obs, id_ubicacion: idUbicacion || undefined, id_material: idMaterial || undefined });
    await loadAllData();
    showToast('Recepción registrada', 'success');
    closeModal('modal-recepcion-linea');
    renderMaterial(); renderSolicitudes(); renderPedidos(); renderDashboard(); updateBadges();
    verDetallePedido(pedidoId);
  } catch(e) {
    showToast(e.message || 'Error al guardar la recepción.', 'error');
    console.error('[recepción]', e);
  }
  hideLoading();
}

async function eliminarLineaPedido(lineaId, pedidoId) {
  if (!confirm('¿Eliminar esta línea del pedido?')) return;
  showLoading('Eliminando...');
  try {
    const { solicitud_revertida } = await callEdgeFunction('gestionar-linea-pedido', { accion: 'eliminar', id_linea: lineaId });
    await loadAllData();
    if (solicitud_revertida) {
      showToast(`Línea eliminada. La solicitud ${solicitud_revertida.id_solicitud} volvió a Pendiente.`, 'success');
    } else {
      showToast('Línea eliminada', 'success');
    }
    verDetallePedido(pedidoId);
    renderSolicitudes();
  }
  catch(e) { showToast(e.message || 'Error eliminando', 'error'); console.error(e); }
  hideLoading();
}

// Cambia una sola línea entre material común y del laboratorio. Si el valor
// nuevo coincide con lo que dice la ficha del material, se guarda null para
// que la línea vuelva a heredar (y siga a la ficha si esta cambia).
async function toggleLineaComun(lineaId, pedidoId) {
  const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
  if (!l) return;
  const nuevo = !lineaEsComun(l);
  const mat = _materialDeLinea(l);
  const heredado = !!(mat && mat.Material_Comun === true);
  showLoading('Guardando...');
  try {
    const { linea } = await callEdgeFunction('gestionar-linea-pedido', {
      accion: 'imputacion', id_linea: lineaId, material_comun: nuevo === heredado ? null : nuevo,
    });
    const idx = DATA.lineasPedido.findIndex(x => x.ID_Linea === lineaId);
    if (idx !== -1) DATA.lineasPedido[idx] = _lineaPedidoSbToObj(linea);
    const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
    const aviso = (p?.Trebello_Pedido_Id || p?.Trebello_Pedido_Comun_Id) ? ' Reenvía a Trebello para que allí cambie también.' : '';
    showToast((nuevo ? 'Línea marcada como material común.' : 'Línea imputada al laboratorio.') + aviso, 'success');
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// Cómo figura una línea en la factura. Solo lo usa la hoja de pedido (Word y
// Trebello); en el resto de la app la línea sigue con su nombre. Se puede
// tocar en cualquier estado de la línea, porque la factura suele llegar
// cuando ya está recibida.
let _concFacTemp = [];

// El mismo editor sirve para dos cosas (hidden concfac-modo):
//  · 'linea'  — 🧾 de una línea: cómo se nombra ESA línea en la hoja (otra
//              forma de expresarlo, referencias…). lineas_pedido.conceptos_factura.
//  · 'pedido' — 🧾 Hoja como la factura: artículos que sustituyen a TODAS las
//              líneas en la hoja. pedidos.hoja_factura.
function _abrirEditorConceptos(modo, pedidoId, lineaId, titulo, subtitulo, conceptos, ayuda) {
  sv('concfac-modo', modo);
  sv('concfac-id', lineaId || '');
  sv('concfac-pedido-id', pedidoId);
  document.getElementById('concfac-titulo').textContent = titulo;
  document.getElementById('concfac-material').innerHTML = subtitulo;
  document.getElementById('concfac-ayuda').textContent = ayuda;
  _concFacTemp = (conceptos || []).map(c => ({ ...c }));
  if (!_concFacTemp.length) _concFacTemp.push({ concepto: '', cantidad: null, precio_unitario: null });
  _pintarConceptosFactura();
  openModal('modal-concepto-factura');
}

function _importeLineas(lineas) {
  return lineas.reduce((s, l) => s + (parseFloat(l.Precio_Unitario) || 0) * (parseFloat(l.Cantidad_Pedida) || 0), 0);
}

function openModalConceptoFactura(lineaId, pedidoId) {
  const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
  if (!l) return;
  const imp = _importeLineas([l]);
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  const avisoPedido = (p?.Hoja_Factura || []).length ? '<div style="margin-top:6px;font-size:12px;color:var(--warning,#b45309)">⚠ Ahora mismo la hoja usa los artículos de la factura del pedido entero, así que esto no se verá hasta que en la ficha elijas «Las líneas del pedido».</div>' : '';
  _abrirEditorConceptos('linea', pedidoId, lineaId, '🧾 Cómo figura en la hoja',
    `Línea del pedido: <strong>${_escAttr(l.Material)}${imp ? ` (${imp.toFixed(2)} € sin IVA)` : ''}</strong>${avisoPedido}`,
    l.Conceptos_Factura,
    'Solo cambia cómo sale ESTA línea en la hoja de pedido (otra forma de expresarlo, la referencia…). En el inventario, las solicitudes y el resto de la app la línea sigue igual. Para cambiar solo el nombre basta una fila sin cantidad ni precio (usa los de la línea). Sin filas = la hoja usa la línea.');
}

function openModalHojaFactura(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  const imp = _importeLineas(DATA.lineasPedido.filter(l => l.Pedido === pedidoId));
  // Si todavía no hay nada y una factura leída trae artículos sin línea, se precargan.
  let conceptos = p.Hoja_Factura || [];
  let precargado = '';
  if (!conceptos.length) {
    const doc = DATA.documentosProveedor.filter(d => d.Pedido === pedidoId && (d.Datos_Extraidos?.sin_match || []).length).pop();
    if (doc) {
      conceptos = doc.Datos_Extraidos.sin_match.map(i => ({ concepto: i.material, cantidad: i.cantidad ?? null, unidad: i.unidad || null, precio_unitario: i.precio_unitario ?? null }));
      precargado = `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">Precargado con lo leído en ${_escAttr(doc.Nombre_Archivo || 'la factura')} — revísalo y pulsa Guardar.</div>`;
    }
  }
  _abrirEditorConceptos('pedido', pedidoId, '', '🧾 Hoja como la factura',
    `Pedido: <strong>${_escAttr(p.Nombre_Lista)}</strong>${imp ? ` · las líneas suman ${imp.toFixed(2)} € sin IVA` : ''}${precargado}`,
    conceptos,
    'Para cuando la casa comercial factura el pedido con otros artículos: en la hoja de pedido (Word y Trebello) salen estos en lugar de todas las líneas. Las líneas, el inventario y la contabilidad no cambian. Sin filas = la hoja vuelve a usar las líneas.');
}

// El selector "¿Qué artículos salen en la hoja?" de la ficha del pedido. Es
// una decisión, no una acción: "factura" abre el editor de artículos (hace
// falta saber cuáles) y "lineas" quita los que hubiera.
async function elegirArticulosHoja(pedidoId, opcion) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  const conHojaFactura = (p.Hoja_Factura || []).length > 0;
  if (opcion === 'factura') { openModalHojaFactura(pedidoId); return; }
  if (!conHojaFactura) return;
  if (!confirm(`La hoja dejará de llevar los ${p.Hoja_Factura.length} artículos de la factura y volverá a usar las líneas del pedido. Se pierden los artículos tecleados.\n\n¿Seguir?`)) return;
  showLoading('Guardando...');
  try {
    await _guardarHojaFactura(pedidoId, []);
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}

function _pintarConceptosFactura() {
  const cont = document.getElementById('concfac-filas');
  cont.innerHTML = _concFacTemp.map((c, i) => `<div style="display:grid;grid-template-columns:1fr 64px 84px 28px;gap:6px;align-items:center">
      <input type="text" placeholder="Texto de la factura" value="${_escAttr(c.concepto || '')}" oninput="_concFacTemp[${i}].concepto=this.value">
      <input type="number" min="0" step="any" placeholder="Cant." value="${c.cantidad ?? ''}" oninput="_concFacTemp[${i}].cantidad=this.value===''?null:Number(this.value);_sumaConceptosFactura()">
      <input type="number" min="0" step="0.01" placeholder="€/ud" value="${c.precio_unitario ?? ''}" oninput="_concFacTemp[${i}].precio_unitario=this.value===''?null:Number(this.value);_sumaConceptosFactura()">
      <button class="icon-btn danger" title="Quitar" onclick="_concFacTemp.splice(${i},1);_pintarConceptosFactura()">✕</button>
    </div>`).join('');
  _sumaConceptosFactura();
}

function _sumaConceptosFactura() {
  const el = document.getElementById('concfac-suma');
  const conCifras = _concFacTemp.filter(c => c.precio_unitario != null);
  if (!conCifras.length) { el.textContent = ''; return; }
  const suma = conCifras.reduce((s, c) => s + c.precio_unitario * (c.cantidad != null ? c.cantidad : 1), 0);
  const modo = v('concfac-modo');
  const lineas = modo === 'pedido'
    ? DATA.lineasPedido.filter(x => x.Pedido === v('concfac-pedido-id'))
    : DATA.lineasPedido.filter(x => x.ID_Linea === v('concfac-id'));
  const imp = _importeLineas(lineas);
  const ref = modo === 'pedido' ? 'las líneas suman' : 'la línea es de';
  el.innerHTML = `Suma: <strong>${suma.toFixed(2)} €</strong> sin IVA${imp ? (Math.abs(suma - imp) < 0.01 ? ` · ✓ cuadra con ${modo === 'pedido' ? 'las líneas' : 'la línea'}` : ` · ⚠ ${ref} ${imp.toFixed(2)} €`) : ''}`;
}

function anadirFilaConceptoFactura() {
  _concFacTemp.push({ concepto: '', cantidad: null, precio_unitario: null });
  _pintarConceptosFactura();
}

function _avisoTrebello(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  return (p?.Trebello_Pedido_Id || p?.Trebello_Pedido_Comun_Id) ? ' Pulsa «↻ Actualizar en Trebello» para que la hoja de allí cambie también.' : '';
}

async function _guardarConceptosLinea(lineaId, pedidoId, conceptos) {
  const { linea } = await callEdgeFunction('gestionar-linea-pedido', { accion: 'concepto_factura', id_linea: lineaId, conceptos });
  const idx = DATA.lineasPedido.findIndex(x => x.ID_Linea === lineaId);
  if (idx !== -1) DATA.lineasPedido[idx] = _lineaPedidoSbToObj(linea);
  showToast(((linea.conceptos_factura || []).length ? 'Guardado cómo sale esta línea en la hoja.' : 'La hoja usará la línea tal cual.') + _avisoTrebello(pedidoId), 'success');
}

async function _guardarHojaFactura(pedidoId, conceptos) {
  const { pedido } = await callEdgeFunction('gestionar-pedido', { accion: 'hoja_factura', id_pedido: pedidoId, conceptos });
  const idx = DATA.pedidos.findIndex(x => x.ID_Pedido === pedidoId);
  if (idx !== -1) Object.assign(DATA.pedidos[idx], _pedidoSbToObj(pedido));
  showToast(((pedido.hoja_factura || []).length ? `La hoja llevará los ${pedido.hoja_factura.length} artículos de la factura en lugar de las líneas.` : 'La hoja vuelve a usar las líneas del pedido.') + _avisoTrebello(pedidoId), 'success');
}

async function guardarConceptoFactura() {
  const modo = v('concfac-modo');
  const pedidoId = v('concfac-pedido-id');
  const conceptos = _concFacTemp.map(c => ({ ...c, concepto: String(c.concepto || '').trim() })).filter(c => c.concepto);
  showLoading('Guardando...');
  try {
    if (modo === 'pedido') await _guardarHojaFactura(pedidoId, conceptos);
    else await _guardarConceptosLinea(v('concfac-id'), pedidoId, conceptos);
    closeModal('modal-concepto-factura');
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// Desde la revisión de la factura: los artículos sin línea coincidente que
// en realidad sustituyen a todo el pedido en la hoja (pedidos.hoja_factura).
async function asignarSinMatchAHoja() {
  if (!_revExtraccionActual) return;
  const { pedidoId, r } = _revExtraccionActual;
  const items = Array.from(document.querySelectorAll('#revision-extraccion-contenido .revext-sm-check'))
    .filter(chk => chk.checked).map(chk => r.sin_match[Number(chk.dataset.idx)]).filter(Boolean);
  if (!items.length) { showToast('Marca los artículos de la factura que deben salir en la hoja', 'info'); return; }
  const conceptos = items.map(i => ({ concepto: i.material, cantidad: i.cantidad ?? null, unidad: i.unidad || null, precio_unitario: i.precio_unitario ?? null }));
  showLoading('Guardando...');
  try {
    await _guardarHojaFactura(pedidoId, conceptos);
    closeModal('modal-revision-extraccion');
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
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
  showLoading('Actualizando estado...');
  try {
    await callEdgeFunction('gestionar-pedido', { accion: 'avanzar_estado', id_pedido: pedidoId });
    await loadAllData();
    showToast(`Estado: ${nuevoEstado}`, 'success');
    renderPedidos();
    if (document.getElementById('page-pedido-detalle').classList.contains('active')) verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error', 'error'); console.error(e); }
  hideLoading();
}

async function eliminarPedido(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const hayRecibidas = lineas.some(l => l.Estado_Linea === 'Recibido' || l.Estado_Linea === 'Recibido parcialmente');
  const aviso = hayRecibidas ? '\n⚠️ Hay líneas ya recibidas. Esta acción no revertirá el stock.' : (lineas.length ? `\nSe eliminarán también sus ${lineas.length} línea(s).` : '');
  if (!confirm(`¿Eliminar el pedido "${p.Nombre_Lista}" (${p.ID_Pedido})?${aviso}\n\nEsta acción no se puede deshacer.`)) return;
  showLoading('Eliminando...');
  try {
    // Las líneas de Lineas_Pedido caen en cascada al eliminar el pedido.
    await callEdgeFunction('gestionar-pedido', { accion: 'eliminar', id_pedido: pedidoId });
    DATA.lineasPedido = DATA.lineasPedido.filter(l => l.Pedido !== pedidoId);
    DATA.pedidos = DATA.pedidos.filter(x => x.ID_Pedido !== pedidoId);
    showToast('Pedido eliminado', 'success');
    showPage('pedidos');
    renderPedidos();
  } catch(e) { showToast(e.message || 'Error al eliminar', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// DOCUMENTACIÓN Y ARCHIVO DE PEDIDOS
// ============================================================
async function toggleDocPedido(pedidoId, campo, valor) {
  const idx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const p = DATA.pedidos[idx];
  const campoApi = { Doc_Hoja_Generada: 'doc_hoja_generada', Doc_Enviada_Jefatura: 'doc_enviada_jefatura' }[campo];
  showLoading('Guardando...');
  try {
    await callEdgeFunction('gestionar-pedido', { accion: 'actualizar_campos', id_pedido: pedidoId, campos: { [campoApi]: valor } });
    p[campo] = valor ? 'TRUE' : '';
    hideLoading();
    // La hoja ya está en secretaría: el trámite es el último paso, el pedido se
    // da por terminado (ver _darPedidoPorTerminado).
    if (campo === 'Doc_Enviada_Jefatura' && valor) return _darPedidoPorTerminado(pedidoId);
    showToast('Documentación actualizada', 'success');
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); }
  hideLoading();
}

// Enviar a Trebello o mandar la hoja a secretaría es el último paso del pedido,
// esté en el estado que esté: en reparaciones y servicios el pedido se hace con
// la factura ya en la mano y nunca se pasa por «Presupuesto aprobado» ni por la
// recepción. Por eso se archiva directamente. Solo se pregunta si quedan líneas
// de material sin recibir, porque archivado ya no se puede recibir el albarán y
// ese material no entraría en el inventario.
async function _darPedidoPorTerminado(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p || p.Estado === 'Archivado') { verDetallePedido(pedidoId); return; }
  const sinRecibir = p.Tipo === 'Servicio' ? [] :
    DATA.lineasPedido.filter(l => l.Pedido === pedidoId && l.Estado_Linea !== 'Recibido');
  if (sinRecibir.length && !confirm(
    `El pedido queda tramitado y se va a archivar.\n\n` +
    `Ojo: hay ${sinRecibir.length} línea(s) sin recibir. Archivado ya no se puede registrar ` +
    `el albarán, así que ese material no entrará en el inventario.\n\n` +
    `¿Archivarlo igualmente? (Cancelar = se queda abierto para recibirlo)`
  )) { verDetallePedido(pedidoId); return; }
  return archivarPedido(pedidoId);
}

// Deposita el pedido (datos + facturas del proveedor) en el módulo Compras de
// Trebello, que es donde la jefa tramita todos los pedidos del departamento.
// Ella genera allí la hoja en PDF, la firma y la tramita — aquí no se firma ni
// se envía ningún correo. Ver docs/modulo-pedidos.md.
async function enviarPedidoATrebello(pedidoId) {
  const idx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const p = DATA.pedidos[idx];

  // Reenviar actualiza el pedido que ya está en Trebello; se avisa porque si la
  // jefa ya firmó la hoja con los datos viejos, esa firma deja de valer.
  if ((p.Trebello_Pedido_Id || p.Trebello_Pedido_Comun_Id) && !confirm(
    'Este pedido ya se envió a Trebello.\n\n' +
    'Volver a enviarlo actualiza el que hay allí con los datos actuales. ' +
    'Si la jefa ya firmó la hoja, tendrá que volver a generarla y firmarla.\n\n' +
    '¿Actualizarlo en Trebello?'
  )) return;

  showLoading('Enviando a Trebello...');
  try {
    const r = await callEdgeFunction('enviar-a-trebello', { id_pedido: pedidoId });
    p.Trebello_Pedido_Id   = r.trebello_pedido_id || p.Trebello_Pedido_Id || '';
    p.Trebello_Pedido_Comun_Id = r.trebello_pedido_comun_id || p.Trebello_Pedido_Comun_Id || '';
    p.Fecha_Envio_Trebello = new Date().toISOString();
    p.Doc_Enviada_Jefatura = 'TRUE';

    // Las que no viajaron no son un error del envío: el pedido ya está allí y
    // la factura se puede subir a mano. Pero hay que decirlo, no tragárselo.
    // Con material común el pedido llega a Trebello como dos hojas (misma factura).
    const hojas = r.hojas > 1 ? ' en dos hojas (laboratorio + material común)' : (r.lineas_comunes ? ' como material común' : '');
    const problemas = [...(r.facturas_no_enviadas || []), ...(r.facturas_rechazadas || [])];
    if (r.avisos?.length) {
      showToast(`Pedido enviado${hojas}. Ojo: ${r.avisos.join('; ')}.`, 'warning');
    } else if (problemas.length) {
      showToast(`Pedido enviado, pero ${problemas.length} archivo(s) no: ${problemas.join('; ')}`, 'warning');
    } else {
      const n = r.facturas_enviadas || 0;
      showToast(r.nuevo
        ? `Pedido enviado a Trebello${hojas}${n ? ` con ${n} factura(s)` : ' (sin facturas)'}`
        : `Pedido actualizado en Trebello${hojas}`, 'success');
    }
    hideLoading();
    if (r.nuevo) return _darPedidoPorTerminado(pedidoId);
    verDetallePedido(pedidoId);
    if (typeof renderPedidos === 'function') renderPedidos();
  } catch(e) {
    showToast(e.message || 'Error enviando a Trebello', 'error');
  }
  hideLoading();
}

async function archivarPedido(pedidoId) {
  // Archivado directo sin confirmación
  const idx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const p = DATA.pedidos[idx];
  showLoading('Archivando...');
  try {
    await callEdgeFunction('gestionar-pedido', { accion: 'archivar', id_pedido: pedidoId });
    p.Estado = 'Archivado';
    showToast('Pedido terminado y archivado (📦 Ver archivo en Pedidos)', 'success');
    showPage('pedidos');
    renderPedidos();
  } catch(e) { showToast(e.message || 'Error archivando', 'error'); }
  hideLoading();
}

// Excepcional a propósito: un pedido tramitado está terminado. Solo para
// arreglar un archivado por error (p.ej. quedaba material sin recibir). Doble
// barrera: aviso + teclear DESARCHIVAR. El estado lo deduce el servidor.
async function desarchivarPedido(pedidoId) {
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p || p.Estado !== 'Archivado') return;
  if (!confirm(
    '⚠️ ACCIÓN EXCEPCIONAL ⚠️\n\n' +
    'Este pedido ya está tramitado y terminado. Sacarlo del archivo solo tiene sentido ' +
    'si se archivó por error (por ejemplo, quedaba material sin recibir).\n\n' +
    'No cambia nada en Trebello ni en secretaría.\n\n¿Seguro que quieres continuar?'
  )) return;
  const txt = prompt('Para confirmar, escribe DESARCHIVAR en mayúsculas:');
  if ((txt || '').trim() !== 'DESARCHIVAR') {
    if (txt !== null) showToast('No coincide: el pedido sigue archivado', 'warning');
    return;
  }
  showLoading('Sacando del archivo...');
  try {
    const { pedido } = await callEdgeFunction('gestionar-pedido', { accion: 'desarchivar', id_pedido: pedidoId });
    Object.assign(p, _pedidoSbToObj(pedido));
    showToast(`Pedido fuera del archivo · estado: ${p.Estado}`, 'warning');
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error desarchivando', 'error'); }
  hideLoading();
}

// ============================================================
// LECTURA CON IA DE DOCUMENTOS DEL PROVEEDOR
// ============================================================
// Dispara leer-documento-proveedor (Gemini) sobre un archivo ya subido por
// el proveedor vía el link público. Solo extrae y guarda el resultado
// (documentos_proveedor.datos_extraidos) — no toca cantidad_recibida ni
// precio_unitario de ninguna línea; eso lo hace el Gestor a mano desde el
// modal de revisión (abrirModalRevisionExtraccion en pedidos-render.js).
async function leerDocumentoConIA(idDocumento, pedidoId) {
  showLoading('Leyendo documento con IA...');
  try {
    const { resultado, pedido } = await callEdgeFunction('leer-documento-proveedor', { id_documento: idDocumento });
    const doc = DATA.documentosProveedor.find(d => d.ID_Documento === idDocumento);
    if (doc) { doc.Datos_Extraidos = resultado; doc.Extraido_En = resultado.generado_en; }
    // Número y fecha de factura detectados ya se guardaron directamente en
    // el pedido (sin paso manual) — solo falta reflejarlo en DATA local.
    if (pedido) {
      const pedIdx = DATA.pedidos.findIndex(p => p.ID_Pedido === pedidoId);
      if (pedIdx !== -1) Object.assign(DATA.pedidos[pedIdx], _pedidoSbToObj(pedido));
    }
    verDetallePedido(pedidoId);
    // La factura ya está leída: baja el contador del menú y el banner del dashboard
    // sin esperar a que se recargue la app.
    renderDashboard(); updateBadges();
    abrirModalRevisionExtraccion(idDocumento, pedidoId);
  } catch (e) { showToast('Error leyendo el documento: ' + e.message, 'error'); console.error(e); }
  hideLoading();
}

async function eliminarDocumentoProveedor(idDocumento, pedidoId) {
  if (!confirm('¿Eliminar este documento? No se puede deshacer.')) return;
  showLoading('Eliminando...');
  try {
    await callEdgeFunction('gestionar-pedido', { accion: 'eliminar_documento', id_pedido: pedidoId, id_documento: idDocumento });
    DATA.documentosProveedor = DATA.documentosProveedor.filter(d => d.ID_Documento !== idDocumento);
    showToast('Documento eliminado', 'success');
    verDetallePedido(pedidoId);
    renderPedidos(); renderDashboard(); updateBadges();
  } catch (e) { showToast('Error eliminando: ' + e.message, 'error'); console.error(e); }
  hideLoading();
}

// Aplica en lote los precios marcados en el modal de revisión — misma
// acción actualizar_precio que ya usa 💶 Precios (js/contabilidad.js), así
// que también queda registrado en historico_precio. Nunca toca
// cantidad_recibida ni cantidad_pedida desde aquí (ver abrirModalRevisionExtraccion).
async function aplicarPreciosExtraccion() {
  const pedidoId = v('revext-pedido-id');
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  if (!p) return;
  const checks = Array.from(document.querySelectorAll('#revision-extraccion-contenido .revext-check'));
  const lineasBody = [];
  for (const chk of checks) {
    if (!chk.checked) continue;
    const idLinea = chk.dataset.idLinea;
    const input = document.querySelector(`#revision-extraccion-contenido .revext-precio[data-id-linea="${idLinea}"]`);
    const precio = input ? input.value.trim() : '';
    if (!precio) continue;
    lineasBody.push({ id_linea: idLinea, precio_unitario: precio });
  }
  // Texto de la factura para la hoja de pedido (solo las casillas marcadas).
  const conceptos = Array.from(document.querySelectorAll('#revision-extraccion-contenido .revext-concepto-check'))
    .filter(chk => chk.checked)
    .map(chk => {
      const input = document.querySelector(`#revision-extraccion-contenido .revext-concepto[data-id-linea="${chk.dataset.idLinea}"]`);
      const texto = input ? input.value.trim() : '';
      return { id_linea: chk.dataset.idLinea, conceptos: texto ? [{ concepto: texto }] : [] };
    });
  if (!lineasBody.length && !conceptos.length) { showToast('No has seleccionado nada para aplicar', 'info'); return; }

  showLoading('Aplicando...');
  try {
    if (lineasBody.length) await callEdgeFunction('gestionar-linea-pedido', { accion: 'actualizar_precio', pedido: pedidoId, proveedor: p.Proveedor || '', lineas: lineasBody });
    if (conceptos.length) await callEdgeFunction('gestionar-linea-pedido', { accion: 'concepto_factura', lineas: conceptos });
    await loadAllData();
    const partes = [];
    if (lineasBody.length) partes.push(`${lineasBody.length} precio(s)`);
    if (conceptos.length) partes.push(`${conceptos.length} texto(s) de factura para la hoja`);
    showToast(`Guardado: ${partes.join(' y ')}`, 'success');
    closeModal('modal-revision-extraccion');
    verDetallePedido(pedidoId);
    renderContabilidad(); renderMaterial();
  } catch (e) { showToast('Error aplicando precios: ' + e.message, 'error'); console.error(e); }
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
    await callEdgeFunction('gestionar-pedido', { accion: 'actualizar_campos', id_pedido: pedidoId, campos: { proveedor: nuevo } });
    DATA.pedidos[idx].Proveedor = nuevo;
    showToast('Proveedor actualizado', 'success');
    closeModal('modal-editar-proveedor');
    verDetallePedido(pedidoId);
    renderPedidos();
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// GASTO EXTRA DEL PEDIDO (transporte, tasas...)
// ============================================================
function openModalGastoExtra(pedidoId, conceptoSugerido, importeSugerido) {
  sv('gasto-extra-pedido-id', pedidoId);
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  sv('gasto-extra-concepto', p?.Gasto_Extra_Concepto || conceptoSugerido || '');
  sv('gasto-extra-importe', p?.Gasto_Extra_Importe || (importeSugerido != null ? importeSugerido : ''));
  openModal('modal-gasto-extra');
}

async function guardarGastoExtraPedido() {
  const pedidoId = v('gasto-extra-pedido-id');
  const idx = DATA.pedidos.findIndex(x => x.ID_Pedido === pedidoId);
  if (idx === -1) return;
  const importe = parseFloat(v('gasto-extra-importe')) || 0;
  const concepto = importe > 0 ? (v('gasto-extra-concepto').trim() || 'Gasto extra') : '';
  showLoading('Guardando...');
  try {
    await callEdgeFunction('gestionar-pedido', {
      accion: 'actualizar_campos', id_pedido: pedidoId,
      campos: { gasto_extra_concepto: concepto, gasto_extra_importe: importe > 0 ? importe : '' },
    });
    DATA.pedidos[idx].Gasto_Extra_Concepto = concepto;
    DATA.pedidos[idx].Gasto_Extra_Importe = importe > 0 ? String(importe) : '';
    showToast('Gasto extra actualizado', 'success');
    closeModal('modal-gasto-extra');
    verDetallePedido(pedidoId);
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}

function openModalEditarLinea(lineaId, pedidoId) {
  const l = DATA.lineasPedido.find(x => x.ID_Linea === lineaId);
  if (!l) return;
  sv('edlinea-id', lineaId);
  sv('edlinea-pedido-id', pedidoId);
  const unidad = _unidadLineaPedido(l);
  sv('edlinea-material', l.Material || '');
  sv('edlinea-cantidad', l.Cantidad_Pedida || '');
  sv('edlinea-precio', l.Precio_Unitario || '');
  sv('edlinea-obs', l.Observaciones || '');

  // Unidad pedida: combo (input + datalist) siempre visible, mismo criterio que
  // la unidad de un lote en el modal de material (ver _unidadesSugeridas). Antes
  // era un <select> que solo aparecía si el material catalogado declaraba más de
  // una unidad, así que en la mayoría de las líneas la unidad no se podía
  // corregir — ni cuando la había heredado mal de la solicitud.
  const mat = _materialDeLinea(l);
  const extra = (mat?.Unidades_Extra || '').split(',').map(u => u.trim()).filter(Boolean);
  const sugerencias = _unidadesSugeridas(mat?.Unidad || '', extra);
  const dl = document.getElementById('edlinea-unidades-list');
  if (dl) dl.innerHTML = sugerencias.map(u => `<option value="${_escAttr(u)}"></option>`).join('');
  sv('edlinea-unidad', unidad);
  openModal('modal-editar-linea-pedido');
}

async function guardarEdicionLinea() {
  const lineaId = v('edlinea-id');
  const pedidoId = v('edlinea-pedido-id');
  const idx = DATA.lineasPedido.findIndex(x => x.ID_Linea === lineaId);
  if (idx === -1) return;
  const cantidad = parseFloat(v('edlinea-cantidad'));
  if (!cantidad || cantidad <= 0) { showToast('Indica una cantidad válida', 'error'); return; }
  const precio = v('edlinea-precio');
  const obs = v('edlinea-obs');
  const unidad = v('edlinea-unidad').trim();
  const material = v('edlinea-material').trim();
  if (!material) { showToast('Indica el material', 'error'); return; }
  showLoading('Guardando...');
  try {
    const { linea, solicitud } = await callEdgeFunction('gestionar-linea-pedido', {
      accion: 'editar', id_linea: lineaId, material,
      cantidad_pedida: cantidad, precio_unitario: precio, observaciones: obs, unidad,
    });
    DATA.lineasPedido[idx] = _lineaPedidoSbToObj(linea);
    if (solicitud) {
      const iSol = DATA.solicitudes.findIndex(s => s.ID_Solicitud === solicitud.id_solicitud);
      if (iSol !== -1) DATA.solicitudes[iSol] = { ...DATA.solicitudes[iSol], ..._solicitudSbToObj(solicitud) };
    }
    showToast('Línea actualizada', 'success');
    closeModal('modal-editar-linea-pedido');
    verDetallePedido(pedidoId);
  } catch(e) { showToast('Error: ' + e.message, 'error'); console.error(e); }
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
  // Material: editable solo si el ítem todavía no está catalogado (evita desincronizar de un Material ya existente)
  const esItemNuevo = !DATA.material.some(m => m.Nombre === sol.Material || sol.Material.startsWith(m.Nombre));
  const matLabel = document.getElementById('edit-sol-material-nombre');
  const matInput = document.getElementById('edit-sol-material-input');
  const matHint  = document.getElementById('edit-sol-material-hint');
  if (matLabel) matLabel.style.display = esItemNuevo ? 'none' : '';
  if (matInput) { matInput.style.display = esItemNuevo ? '' : 'none'; matInput.value = sol.Material; }
  if (matHint)  matHint.style.display = esItemNuevo ? '' : 'none';
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
  const matInput = document.getElementById('edit-sol-material-input');
  if (matInput && matInput.style.display !== 'none') {
    const nombreNuevo = matInput.value.trim();
    if (!nombreNuevo) { showToast('Indica el nombre del material', 'error'); return; }
    sol.Material = nombreNuevo;
  }
  showLoading('Guardando...');
  try {
    await callEdgeFunction('gestionar-solicitud', {
      accion: 'editar', id_solicitud: sol.ID_Solicitud, cantidad_solicitada: cant,
      motivo, proveedor_requerido: proveedor, observaciones: obsFinal,
      material: (matInput && matInput.style.display !== 'none') ? sol.Material : undefined,
    });
    sol.Cantidad_Solicitada = cant;
    sol.Urgencia = urgencia;
    sol.Motivo = motivo;
    sol.Proveedor_Requerido = proveedor;
    sol.Observaciones = obsFinal;
    showToast('Solicitud actualizada', 'success');
    closeModal('modal-editar-solicitud');
    renderSolicitudes();
  } catch(e) { showToast(e.message || 'Error guardando', 'error'); console.error(e); }
  hideLoading();
}
