// ============================================================
// GENERACIÓN FOLLA DE PEDIDO (Excel MD84COM07)
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

// Plantilla oficial MD84COM07 (Excel, desde 2026-11-04). El original llegó como
// .xls binario; se guardó como .xlsx con Excel (PREZO con formato 0.00) para
// poder rellenarlo aquí con JSZip. Celdas (hoja única):
//   B13 departamento · F13 profesor/a · B15 ciclo · F15 módulo · J15 data
//   B17 empresa · F17 observacións · B19 nº albarán · F19 nº factura
//   B21:B45 concepto · H cantidade · I prezo · J total  (25 filas)
//   J46 importe total = SUM(J21:J45) · B51 «Asdo:» del solicitante
const HOJA_PEDIDO_PLANTILLA   = './assets/templates/MD84COM07_folla_pedido.xlsx';
const HOJA_PEDIDO_FILAS       = 25;
const HOJA_PEDIDO_DEPARTAMENTO = 'SANIDADE';
const HOJA_PEDIDO_SOLICITANTE = 'Paloma Fernández López';

// Escribe un valor en una celda que ya existe en sheet1.xml, conservando su
// estilo (bordes, formato). Números como número (para que SUM funcione);
// el resto como texto en línea.
function _xlsxSetCell(xml, ref, value, formula) {
  if (value === '' || value == null) return xml;
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  return xml.replace(re, (_m, attrs) => {
    const a = attrs.replace(/\s+t="[^"]*"/, '');
    if (formula) return `<c r="${ref}"${a}><f>${formula}</f><v>${value}</v></c>`;
    if (typeof value === 'number') return `<c r="${ref}"${a}><v>${value}</v></c>`;
    const safe = String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<c r="${ref}"${a} t="inlineStr"><is><t xml:space="preserve">${safe}</t></is></c>`;
  });
}

function _fechaHoja(f) {
  const m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (f || '');
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
    // Si la línea tiene conceptos de factura (cómo la describe la factura, a
    // veces con otros artículos: una "Reparación" facturada como guantes y
    // disolventes), la hoja imprime ESOS en lugar de la línea. Sin cifras
    // propias, un concepto único hereda cantidad y precio de la línea.
    const fmtEur = n => n > 0 ? n.toFixed(2) + ' €' : '';
    // Si la factura sustituye a todo el pedido (p.Hoja_Factura), la hoja lleva
    // esos artículos y no las líneas.
    const hojaFactura = p.Hoja_Factura || [];
    const lineasConPrecios = hojaFactura.length ? hojaFactura.map(c => {
      const cant   = c.cantidad != null ? Number(c.cantidad) : 1;
      const precio = c.precio_unitario != null ? Number(c.precio_unitario) : 0;
      return { concepto: c.concepto, cantidad: String(cant), precio: fmtEur(precio), total: fmtEur(precio * cant), importe: precio * cant, precioNum: precio };
    }) : lineas.flatMap(l => {
      const precioLinea = parseFloat(l.Precio_Unitario) || 0;
      const cantLinea   = parseFloat(l.Cantidad_Pedida) || 0;
      const conceptos = l.Conceptos_Factura || [];
      if (conceptos.length) {
        const uno = conceptos.length === 1;
        return conceptos.map(c => {
          const cant   = c.cantidad != null ? Number(c.cantidad) : (uno ? cantLinea : 1);
          const precio = c.precio_unitario != null ? Number(c.precio_unitario) : (uno ? precioLinea : 0);
          return { concepto: c.concepto, cantidad: c.cantidad != null || uno ? String(cant) : '', precio: fmtEur(precio), total: fmtEur(precio * cant), importe: precio * cant, precioNum: precio };
        });
      }
      const mat = DATA.material.find(m => m.Nombre === l.Material || l.Material.startsWith(m.Nombre));
      let unidad = mat?.Unidad || '';
      if (!unidad) {
        const solIdM = (l.Observaciones || '').match(/Desde solicitud (SOL\S+)/);
        if (solIdM) {
          const solVinc = DATA.solicitudes.find(s => s.ID_Solicitud === solIdM[1]);
          const uMatch  = (solVinc?.Observaciones || '').match(/\[Unidad:\s*([^\]]+)\]/);
          if (uMatch) unidad = uMatch[1].trim();
        }
      }
      const concepto = unidad ? l.Material + ', ' + unidad : l.Material;
      return [{ concepto, cantidad: l.Cantidad_Pedida, precio: fmtEur(precioLinea), total: fmtEur(precioLinea * cantLinea), importe: precioLinea * cantLinea, precioNum: precioLinea }];
    });

    // ── Gasto extra (transporte, tasas...) — se añade como línea más, entra en la base del IVA ──
    const gastoExtraImporte = parseFloat(p.Gasto_Extra_Importe) || 0;
    if (gastoExtraImporte > 0) {
      lineasConPrecios.push({
        concepto: p.Gasto_Extra_Concepto || 'Gasto extra',
        cantidad: '',
        precio:   '',
        total:    gastoExtraImporte.toFixed(2) + ' €',
        importe:  gastoExtraImporte
      });
    }

    // ── Calcular subtotal, IVA y total ──
    // Se suma lo que va impreso (el gasto extra ya está como fila), así el total
    // de la hoja cuadra con sus filas aunque vengan de los conceptos de factura.
    const subtotal    = lineasConPrecios.reduce((sum, lp) => sum + (lp.importe || 0), 0);
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
      const tplResp = await fetch(HOJA_PEDIDO_PLANTILLA);
      if (!tplResp.ok) throw new Error('HTTP ' + tplResp.status);
      templateBuffer = await tplResp.arrayBuffer();
    } catch(e) {
      throw new Error('No se pudo cargar la plantilla (' + e.message + '). Comprueba que el archivo existe en assets/templates/.');
    }

    // La tabla tiene 25 filas y la del IVA va justo detrás de los artículos.
    const filasNecesarias = lineasConPrecios.length + (hayPrecios ? 1 : 0);
    if (filasNecesarias > HOJA_PEDIDO_FILAS) {
      throw new Error(`La hoja solo tiene ${HOJA_PEDIDO_FILAS} filas y este pedido necesita ${filasNecesarias}${hayPrecios ? ' (artículos + IVA)' : ''}. Agrupa artículos en «🧾 Hoja como la factura» o divide el pedido.`);
    }

    const zip = await JSZip.loadAsync(templateBuffer);
    const sheetPath = 'xl/worksheets/sheet1.xml';
    let xml = await zip.file(sheetPath).async('string');
    const num = x => { const n = parseFloat(String(x ?? '').replace(',', '.')); return isNaN(n) ? '' : n; };
    const r2 = n => Math.round(n * 100) / 100;

    xml = _xlsxSetCell(xml, 'B13', HOJA_PEDIDO_DEPARTAMENTO);
    xml = _xlsxSetCell(xml, 'F13', HOJA_PEDIDO_SOLICITANTE);
    xml = _xlsxSetCell(xml, 'B15', cicloNuevo);
    xml = _xlsxSetCell(xml, 'F15', moduloNuevo);
    xml = _xlsxSetCell(xml, 'J15', _fechaHoja(fechaDoc));
    xml = _xlsxSetCell(xml, 'B17', p.Proveedor || '');
    xml = _xlsxSetCell(xml, 'F19', numFactura);
    lineasConPrecios.forEach((lp, i) => {
      const fila = 21 + i;
      xml = _xlsxSetCell(xml, 'B' + fila, String(lp.concepto || ''));
      xml = _xlsxSetCell(xml, 'H' + fila, num(lp.cantidad));
      if (lp.precioNum > 0) xml = _xlsxSetCell(xml, 'I' + fila, r2(lp.precioNum));
      if (lp.importe > 0)   xml = _xlsxSetCell(xml, 'J' + fila, r2(lp.importe));
    });
    if (hayPrecios) {
      const filaIva = 21 + lineasConPrecios.length;
      xml = _xlsxSetCell(xml, 'B' + filaIva, 'IVA (21%)');
      xml = _xlsxSetCell(xml, 'J' + filaIva, r2(ivaAmount));
      xml = _xlsxSetCell(xml, 'J46', r2(totalConIva), 'SUM(J21:J45)');
    }
    xml = _xlsxSetCell(xml, 'B51', 'Asdo: ' + HOJA_PEDIDO_SOLICITANTE);
    zip.file(sheetPath, xml);
    // Que Excel recalcule al abrir (el total lleva fórmula).
    let wbXml = await zip.file('xl/workbook.xml').async('string');
    wbXml = wbXml.replace(/<calcPr([^>]*?)\s*\/>/, (m, a) => a.includes('fullCalcOnLoad') ? m : `<calcPr${a} fullCalcOnLoad="1"/>`);
    zip.file('xl/workbook.xml', wbXml);

    const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const docxBlob = await zip.generateAsync({ type:'blob', mimeType: XLSX_MIME });

    setGenEstado('☁️ Subiendo documento...', 'info');
    const fileName = `Folla_Pedido_${p.Nombre_Lista.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const base64data = e.target.result.split(',')[1];
        const path = await subirDocumento('documento', pedidoId, base64data, fileName, XLSX_MIME);
        setGenEstado(`✅ Listo. <a href="#" onclick="abrirDocumento('${path}'); return false;" style="color:var(--accent);font-weight:600;text-decoration:underline">📥 Abrir documento</a>`, 'ok');
        // Guardar la ruta de la hoja generada. Se conserva solo la última
        // (subir-documento ya borró la anterior de este pedido); se reescribe
        // en cada regeneración para que la ficha del pedido pueda reabrirla,
        // no solo el enlace efímero de este modal.
        if (pedIdx !== -1) {
          DATA.pedidos[pedIdx].Doc_Hoja_Generada = 'TRUE';
          DATA.pedidos[pedIdx].Doc_Hoja_Path = path;
          try { await callEdgeFunction('gestionar-pedido', { accion: 'actualizar_campos', id_pedido: pedidoId, campos: { doc_hoja_generada: true, doc_hoja_path: path } }); } catch(e) { console.warn('No se pudo guardar la hoja generada', e); }
          if (document.getElementById('page-pedido-detalle').classList.contains('active')) verDetallePedido(pedidoId);
          if (typeof renderPedidos === 'function') renderPedidos(); // refrescar la lista (badge 📄) sin esperar a recargar

        }
      } catch(err) { setGenEstado('Error subiendo el documento: ' + err.message, 'error'); }
      btn.disabled = false; btn.textContent = 'Generar hoja';
    };
    reader.readAsDataURL(docxBlob);
  } catch(e) {
    console.error(e); setGenEstado('Error: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = 'Generar hoja';
  }
}
