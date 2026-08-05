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
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
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
  } catch(e) { showToast('Error', 'error'); }
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
  showLoading('Añadiendo...');
  try {
    const { linea } = await callEdgeFunction('gestionar-linea-pedido', { accion: 'crear', pedido: pedidoId, material: matNombre, cantidad_pedida: cantidad, observaciones: 'Stock bajo mínimo' });
    DATA.lineasPedido.push(_lineaPedidoSbToObj(linea));
    showToast(`"${matNombre}" añadido al pedido`, 'success'); renderAll();
  }
  catch(e) { showToast('Error', 'error'); }
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
  } catch(e) { showToast('Error', 'error'); console.error(e); }
  hideLoading();
}

async function guardarLineaPedido() {
  const pedidoId = v('linea-pedido-id');
  const pedido = DATA.pedidos.find(p => p.ID_Pedido === pedidoId);
  const esServicio = pedido?.Tipo === 'Servicio';
  let materialNombre = '', equipoId = '', nuevoEquipoDatos = null;

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
      observaciones: obs, precio_unitario: precio, id_equipo: equipoId,
    });
    DATA.lineasPedido.push(_lineaPedidoSbToObj(linea));
    closeModal('modal-nueva-linea');
    verDetallePedido(pedidoId);
    showToast(nuevoEquipoDatos ? 'Equipo creado en inventario y línea añadida' : 'Línea añadida', 'success');
  } catch(e) {
    showToast('Error al guardar la línea. Vuelve a intentarlo.', 'error');
    console.error(e);
  }
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
  } catch(e) { showToast('Error', 'error'); console.error(e); }
  hideLoading();
}

async function guardarRecepcionMasiva() {
  const pedidoId = v('recmas-pedido-id');
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId && l.Estado_Linea !== 'Recibido');
  const aRecibir = lineas
    .map(l => ({
      id_linea: l.ID_Linea,
      cantidad: parseFloat(document.getElementById('recmas-cant-' + l.ID_Linea)?.value) || 0,
      observaciones: document.getElementById('recmas-obs-' + l.ID_Linea)?.value || ''
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
  } catch(e) { showToast('Error registrando el albarán', 'error'); console.error(e); }
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
  await _completarRecepcionLinea(lineaId, pedidoId, cantRec, v('rec-obs'));
}

// ── Orquestador principal de recepción ───────────────────────
// Toda la lógica (stock, lote, movimiento, estado del pedido, solicitud
// origen) vive ahora server-side en gestionar-linea-pedido (accion:
// 'recepcion') — aquí solo se llama y se refresca DATA desde el servidor,
// que es la fuente de verdad tras una operación que toca varias tablas.
async function _completarRecepcionLinea(lineaId, pedidoId, cantRec, obs) {
  showLoading('Registrando recepción...');
  try {
    await callEdgeFunction('gestionar-linea-pedido', { accion: 'recepcion', id_linea: lineaId, cantidad: cantRec, observaciones: obs });
    await loadAllData();
    showToast('Recepción registrada', 'success');
    closeModal('modal-recepcion-linea');
    renderMaterial(); renderSolicitudes(); renderPedidos(); renderDashboard(); updateBadges();
    verDetallePedido(pedidoId);
  } catch(e) {
    showToast('Error al guardar la recepción. No se modificó nada.', 'error');
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
  showLoading('Actualizando estado...');
  try {
    await callEdgeFunction('gestionar-pedido', { accion: 'avanzar_estado', id_pedido: pedidoId });
    await loadAllData();
    showToast(`Estado: ${nuevoEstado}`, 'success');
    renderPedidos();
    if (document.getElementById('page-pedido-detalle').classList.contains('active')) verDetallePedido(pedidoId);
  } catch(e) { showToast('Error', 'error'); console.error(e); }
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
  } catch(e) { showToast('Error al eliminar', 'error'); console.error(e); }
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
    showToast('Documentación actualizada', 'success');
    verDetallePedido(pedidoId);
  } catch(e) { showToast('Error guardando', 'error'); }
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
    showToast('Pedido archivado', 'success');
    showPage('pedidos');
    renderPedidos();
  } catch(e) { showToast('Error archivando', 'error'); }
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
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}

// ============================================================
// GASTO EXTRA DEL PEDIDO (transporte, tasas...)
// ============================================================
function openModalGastoExtra(pedidoId) {
  sv('gasto-extra-pedido-id', pedidoId);
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);
  sv('gasto-extra-concepto', p?.Gasto_Extra_Concepto || '');
  sv('gasto-extra-importe', p?.Gasto_Extra_Importe || '');
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
  } catch(e) { showToast('Error guardando', 'error'); console.error(e); }
  hideLoading();
}
