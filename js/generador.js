// ============================================================
// GENERACIÓN FOLLA DE PEDIDO (Word + IA)
// ============================================================

function abrirGeneradorHoja(pedidoId) {
  sv('gen-pedido-id', pedidoId);
  sv('gen-modulo','');
  sv('gen-num-factura',''); sv('gen-fecha-factura','');

  // Resolver el pedido PRIMERO para evitar zona muerta temporal
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId);

  // Poblar ciclos dinámicamente desde DATA.ciclosModulos
  const selCiclo = document.getElementById('gen-ciclo');
  const ciclos = [...new Set(DATA.ciclosModulos.map(cm => (cm.Ciclo||'').normalize('NFC').trim()).filter(Boolean))].sort();
  DATA.ciclosModulos.forEach(cm => { cm.Ciclo = (cm.Ciclo||'').normalize('NFC').trim(); cm.Modulo = (cm.Modulo||'').normalize('NFC').trim(); });
  selCiclo.innerHTML = '<option value="">Seleccionar...</option>' + ciclos.map(c => `<option value="${c}">${c}</option>`).join('') + '<option value="Laboratorios">Laboratorios</option>';
  selCiclo.value = '';

  // Pre-rellenar ciclo/módulo y datos de factura si ya están guardados
  if (p) {
    if (p.Ciclo)          { selCiclo.value = (p.Ciclo||'').normalize('NFC').trim(); actualizarModulos(); }
    if (p.Modulo)           setTimeout(() => sv('gen-modulo', (p.Modulo||'').normalize('NFC').trim()), 50);
    if (p.Numero_Factura)   sv('gen-num-factura', p.Numero_Factura);
    if (p.Fecha_Factura)    sv('gen-fecha-factura', p.Fecha_Factura);
  }

  document.getElementById('gen-estado-container').style.display = 'none';
  actualizarModulos();
  openModal('modal-generar-hoja');
}

function actualizarModulos() {
  const ciclo = v('gen-ciclo');
  const sel   = document.getElementById('gen-modulo');
  const norm  = s => (s || '').normalize('NFC').trim();
  const modulos = DATA.ciclosModulos
    .filter(cm => norm(cm.Ciclo) === norm(ciclo))
    .map(cm => cm.Modulo)
    .filter(Boolean);
  sel.innerHTML = '<option value="">— (dejar vacío si es para varios) —</option>' + modulos.map(m => `<option value="${m}">${m}</option>`).join('');
}

function setGenEstado(msg, tipo = 'info') {
  const cont = document.getElementById('gen-estado-container');
  const txt  = document.getElementById('gen-estado-text');
  if (!cont || !txt) return;
  cont.style.display = '';
  const colors     = { info:'var(--accent-light)', error:'var(--danger-light)', ok:'var(--success-light)' };
  const textColors = { info:'var(--accent)',        error:'var(--danger)',       ok:'var(--success)' };
  cont.querySelector('div').style.background = colors[tipo] || colors.info;
  cont.querySelector('div').style.color      = textColors[tipo] || textColors.info;
  txt.innerHTML = msg;
}

function injectTextIntoRow(rowXml, texts) {
  if (!texts || !texts.some(t => t)) return rowXml;
  const cells = rowXml.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) || [];
  if (!cells.length) return rowXml;
  let result = rowXml;
  cells.forEach((cell, idx) => {
    if (idx >= texts.length) return;
    const text = texts[idx];
    if (!text) return;
    const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const run = `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${safe}</w:t></w:r>`;
    const newCell = cell.replace(/<\/w:p>/, run + '</w:p>');
    result = result.replace(cell, newCell);
  });
  return result;
}

async function generarHojaPedido() {
  const pedidoId = v('gen-pedido-id');
  const ciclo    = v('gen-ciclo');
  if (!ciclo) { showToast('Selecciona el ciclo', 'error'); return; }
  if (!v('gen-num-factura')) { showToast('El número de factura es obligatorio', 'error'); return; }
  if (!v('gen-fecha-factura')) { showToast('La fecha de factura es obligatoria', 'error'); return; }
  const p = DATA.pedidos.find(x => x.ID_Pedido === pedidoId); if (!p) return;
  const lineas = DATA.lineasPedido.filter(l => l.Pedido === pedidoId);
  const btn = document.getElementById('btn-generar-hoja');
  btn.disabled = true; btn.textContent = '⏳ Generando...';

  // ── Guardar Numero_Factura y Fecha_Factura en Sheets antes de generar ──
  const numFacturaNuevo  = v('gen-num-factura')  || '';
  const fechaFacturaNuevo = v('gen-fecha-factura') || '';
  const pedIdx = DATA.pedidos.findIndex(x => x.ID_Pedido === pedidoId);

  if (pedIdx !== -1) {
    const cambiado = numFacturaNuevo !== (p.Numero_Factura || '') || fechaFacturaNuevo !== (p.Fecha_Factura || '');
    if (cambiado) {
      try {
        await callEdgeFunction('gestionar-pedido', {
          accion: 'actualizar_campos', id_pedido: pedidoId,
          campos: { numero_factura: numFacturaNuevo, fecha_factura: fechaFacturaNuevo },
        });
        DATA.pedidos[pedIdx].Numero_Factura = numFacturaNuevo;
        DATA.pedidos[pedIdx].Fecha_Factura  = fechaFacturaNuevo;
      } catch(e) {
        console.warn('No se pudieron guardar los datos de factura', e);
      }
    }
  }

  try {
    // ── Guardar Ciclo y Módulo en Sheets si cambiaron ──
    const cicloNuevo  = ciclo;
    const moduloNuevo = v('gen-modulo');
    if (pedIdx !== -1) {
      const cicloActual  = DATA.pedidos[pedIdx].Ciclo  || '';
      const moduloActual = DATA.pedidos[pedIdx].Modulo || '';
      if (cicloNuevo !== cicloActual || moduloNuevo !== moduloActual) {
        try {
          await callEdgeFunction('gestionar-pedido', { accion: 'actualizar_campos', id_pedido: pedidoId, campos: { ciclo: cicloNuevo, modulo: moduloNuevo } });
          DATA.pedidos[pedIdx].Ciclo  = cicloNuevo;
          DATA.pedidos[pedIdx].Modulo = moduloNuevo;
          // Refrescar contabilidad en caliente sin esperar recarga
          if (typeof renderContabilidad === 'function') renderContabilidad();
        } catch(e) { console.warn('No se pudo guardar ciclo/módulo', e); }
      }
    }

    // ── Construir líneas con precios desde Lineas_Pedido.Precio_Unitario ──
    const lineasConPrecios = lineas.map(l => {
      const mat = DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
      let unidad = mat?.Unidad || '';
      if (!unidad) {
        const solIdM = (l.Observaciones || '').match(/Desde solicitud (SOL-\S+)/);
        if (solIdM) {
          const solVinc = DATA.solicitudes.find(s => s.ID_Solicitud === solIdM[1]);
          const uMatch  = (solVinc?.Observaciones || '').match(/\[Unidad:\s*([^\]]+)\]/);
          if (uMatch) unidad = uMatch[1].trim();
        }
      }
      const concepto = unidad ? l.Material + ', ' + unidad : l.Material;
      const precio   = parseFloat(l.Precio_Unitario) || 0;
      const cant     = parseFloat(l.Cantidad_Pedida) || 0;
      const total    = precio * cant;
      return {
        concepto,
        cantidad: l.Cantidad_Pedida,
        precio:   precio > 0 ? precio.toFixed(2) + ' \u20AC' : '',
        total:    total  > 0 ? total.toFixed(2)  + ' \u20AC' : ''
      };
    });

    // ── Gasto extra (transporte, tasas...) — se añade como línea más, entra en la base del IVA ──
    const gastoExtraImporte = parseFloat(p.Gasto_Extra_Importe) || 0;
    if (gastoExtraImporte > 0) {
      lineasConPrecios.push({
        concepto: p.Gasto_Extra_Concepto || 'Gasto extra',
        cantidad: '',
        precio:   '',
        total:    gastoExtraImporte.toFixed(2) + ' €'
      });
    }

    // ── Calcular subtotal, IVA y total ──
    const subtotal    = lineas.reduce((sum, l) => sum + (parseFloat(l.Precio_Unitario)||0) * (parseFloat(l.Cantidad_Pedida)||0), gastoExtraImporte);
    const ivaAmount   = subtotal * 0.21;
    const totalConIva = subtotal + ivaAmount;
    const hayPrecios  = subtotal > 0;

    const numFactura = DATA.pedidos[pedIdx]?.Numero_Factura || numFacturaNuevo || '';
    const fechaDoc   = DATA.pedidos[pedIdx]?.Fecha_Factura  || fechaFacturaNuevo
                        || p.Fecha_Recepcion_Completa
                        || new Date().toLocaleDateString('es-ES');

    setGenEstado('📝 Generando documento...', 'info');
    let templateBuffer;
    try {
      const tplResp = await fetch('./assets/templates/Folla%20de%20Pedido%20_%20modelo.docx');
      if (!tplResp.ok) throw new Error('HTTP ' + tplResp.status);
      templateBuffer = await tplResp.arrayBuffer();
    } catch(e) {
      throw new Error('No se pudo cargar la plantilla (' + e.message + '). Comprueba que el archivo existe en assets/templates/.');
    }

    const zip    = await JSZip.loadAsync(templateBuffer);
    let docXml   = await zip.file('word/document.xml').async('string');
    const rows   = docXml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
    const mod    = [...rows];

    if (rows[4])  mod[4]  = injectTextIntoRow(rows[4],  [cicloNuevo, moduloNuevo, fechaDoc]);
    if (rows[6])  mod[6]  = injectTextIntoRow(rows[6],  [p.Proveedor||'', '']);
    if (rows[8])  mod[8]  = injectTextIntoRow(rows[8],  ['', numFactura]);
    for (let i = 0; i < 25 && rows[10+i]; i++) {
      if (i < lineasConPrecios.length) {
        const lp = lineasConPrecios[i];
        mod[10+i] = injectTextIntoRow(rows[10+i], [String(lp.concepto||''), String(lp.cantidad||''), lp.precio, lp.total]);
      } else if (hayPrecios && i === lineasConPrecios.length) {
        // Fila de IVA — siempre en posición fija tras el último ítem (ignorar al leer la hoja de pedido)
        mod[10+i] = injectTextIntoRow(rows[10+i], ['IVA (21%)', '', '', ivaAmount.toFixed(2) + ' \u20AC']);
      }
    }
    if (rows[35]) mod[35] = injectTextIntoRow(rows[35], ['', hayPrecios ? totalConIva.toFixed(2) + ' \u20AC' : '']);

    let newXml = docXml;
    rows.forEach((old, i) => { if (mod[i] !== old) newXml = newXml.replace(old, mod[i]); });
    zip.file('word/document.xml', newXml);

    const docxBlob = await zip.generateAsync({ type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    setGenEstado('☁️ Subiendo a Drive...', 'info');
    const fileName = `Folla_Pedido_${p.Nombre_Lista.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const base64data = e.target.result.split(',')[1];
        const url = await uploadFileToDrive(base64data, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        setGenEstado(`✅ Listo. <a href="${url}" target="_blank" style="color:var(--accent);font-weight:600;text-decoration:underline">📥 Abrir documento en Drive</a>`, 'ok');
        // Marcar Doc_Hoja_Generada
        if (pedIdx !== -1 && DATA.pedidos[pedIdx].Doc_Hoja_Generada !== 'TRUE') {
          DATA.pedidos[pedIdx].Doc_Hoja_Generada = 'TRUE';
          try { await callEdgeFunction('gestionar-pedido', { accion: 'actualizar_campos', id_pedido: pedidoId, campos: { doc_hoja_generada: true } }); } catch(e) { console.warn('No se pudo marcar Doc_Hoja_Generada', e); }
          if (document.getElementById('page-pedido-detalle').classList.contains('active')) verDetallePedido(pedidoId);
        }
      } catch(err) { setGenEstado('Error subiendo a Drive: ' + err.message, 'error'); }
      btn.disabled = false; btn.textContent = 'Generar Word';
    };
    reader.readAsDataURL(docxBlob);
  } catch(e) {
    console.error(e); setGenEstado('Error: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = 'Generar Word';
  }
}
