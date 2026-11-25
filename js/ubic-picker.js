// ============================================================
// SELECTOR DE UBICACIÓN — sustituye al desplegable de ~180 códigos
// ============================================================
// Nadie se sabe "205-ZC-2.3" de memoria: aquí se elige por pasos
// (laboratorio → zona → hueco), viendo siempre la descripción de cada sitio,
// o escribiendo en el buscador ("nevera", "reactivos", "cajón"…). Arriba salen
// los sitios donde el material ya tiene botes, que es lo que se elige casi siempre.
//
// Uso: ubicPickerHTML(id, { matId, unidad, valor }) devuelve el HTML; el valor
// elegido vive en un <input type="hidden" id="{id}">, así que quien guarda lo
// lee con v(id) como si fuese el <select> de antes. onchange opcional:
// ubicPickerHTML(id, { onchange: 'miFuncion' }) llama a miFuncion(id, valor).

const _ubicPicker = {}; // id → { matId, unidad, lab, zona, filtro, abierto, onchange }

const _UBP_SIN_ZONA = '__sin_zona__';

function _ubpTxt(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function _ubpNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

// "1º cajón debajo de AUT-02 · Micropipetas" — el hueco dentro de su zona: posición y uso.
function _ubpDescHueco(u) { return huecoUbicacion(u); }

// "205 - Zona común" → "Lab 205 · Zona común"
function _ubpEtiquetaLab(lab) {
  if (!lab) return 'Sin laboratorio';
  const m = lab.match(/^(\d{3})\s*-\s*(.+)$/);
  if (m) return `Lab ${m[1]} · ${m[2]}`;
  return /^\d{3}$/.test(lab) ? `Lab ${lab}` : lab;
}

// Descripción completa de una ubicación para mostrarla elegida.
function ubicDescripcionLarga(idUbicacion) {
  const u = DATA.ubicaciones.find(x => x.ID_Ubicacion === idUbicacion);
  if (!u) return idUbicacion || '';
  // Va detrás del código: zona · localización · contenido (orden de getNombreUbicacion)
  return descripcionUbicacion(u) || _ubpEtiquetaLab(u.Laboratorio_Aula);
}

function _ubpActivas() {
  return DATA.ubicaciones.filter(u => u.Activa !== 'FALSE');
}

function _ubpOrden(a, b) {
  return (a.ID_Ubicacion || '').localeCompare(b.ID_Ubicacion || '', 'es', { numeric: true });
}

function _ubpStockEn(st, idUbicacion) {
  if (!st.matId) return '';
  const lote = getMatUbics(st.matId).find(l => l.ID_Ubicacion === idUbicacion);
  if (!lote) return '';
  return `${parseFloat(lote.Stock_Local) || 0} ${lote.Unidad_Lote || st.unidad || ''}`.trim();
}

function ubicPickerHTML(id, opts = {}) {
  const valor = opts.valor || '';
  const u = DATA.ubicaciones.find(x => x.ID_Ubicacion === valor);
  _ubicPicker[id] = {
    matId: opts.matId || '', unidad: opts.unidad || '', onchange: opts.onchange || '',
    lab: u ? u.Laboratorio_Aula || '' : null, zona: null, filtro: '', abierto: !valor,
    permitirVacio: !!opts.permitirVacio, valorInicial: valor,
  };
  // Mientras se monta el HTML el hidden aún no está en el DOM (o queda el de
  // una apertura anterior del modal): el valor sale de st, no del DOM.
  _ubicPicker[id].montando = true;
  const cuerpo = _ubpCuerpo(id);
  _ubicPicker[id].montando = false;
  return `<div class="ubp" id="ubp-${id}"><input type="hidden" id="${id}" value="${_ubpTxt(valor)}"><div class="ubp-cuerpo" id="ubp-cuerpo-${id}">${cuerpo}</div></div>`;
}

function _ubpValor(id) {
  const st = _ubicPicker[id];
  if (st?.montando) return st.valorInicial || '';
  return document.getElementById(id)?.value || '';
}

function _ubpPintar(id) {
  const c = document.getElementById('ubp-cuerpo-' + id);
  if (c) c.innerHTML = _ubpCuerpo(id);
}

function _ubpCuerpo(id) {
  const st = _ubicPicker[id];
  if (!st) return '';
  const elegido = _ubpValor(id);

  // Cerrado con un sitio elegido: una línea con la descripción y "Cambiar".
  if (!st.abierto && elegido) {
    const stock = _ubpStockEn(st, elegido);
    return `<div class="ubp-elegido">
      <span class="ubp-elegido-txt">📍 <b>${_ubpTxt(elegido)}</b> <span class="ubp-desc">${_ubpTxt(ubicDescripcionLarga(elegido))}</span>${stock ? ` <span class="ubp-stock">ya hay ${_ubpTxt(stock)}</span>` : ''}</span>
      <button type="button" class="btn btn-secondary ubp-cambiar" onclick="_ubpAbrir('${id}')">Cambiar</button>
    </div>`;
  }
  if (!st.abierto && !elegido && st.permitirVacio) {
    return `<div class="ubp-elegido"><span class="ubp-elegido-txt ubp-desc">Sin ubicar todavía</span>
      <button type="button" class="btn btn-secondary ubp-cambiar" onclick="_ubpAbrir('${id}')">Elegir sitio</button></div>`;
  }

  const activas = _ubpActivas();
  let html = '';

  // 1) Donde ya hay botes de este material.
  const conBote = st.matId ? getMatUbics(st.matId).map(l => l.ID_Ubicacion)
    .filter((x, i, a) => x && a.indexOf(x) === i && activas.some(u => u.ID_Ubicacion === x)) : [];
  if (conBote.length) {
    html += `<div class="ubp-titulo">Donde ya está este material</div><div class="ubp-lista">`
      + conBote.map(x => _ubpBotonHueco(id, activas.find(u => u.ID_Ubicacion === x), true)).join('') + `</div>`;
  }

  // 2) Buscador.
  html += `<input type="search" class="ubp-buscar" placeholder="🔎 Buscar: nevera, reactivos, cajón, 205…" value="${_ubpTxt(st.filtro)}"
    oninput="_ubpFiltrar('${id}', this.value)" autocomplete="off">`;

  html += `<div id="ubp-res-${id}">${_ubpResultados(id)}</div>`;
  if (elegido || st.permitirVacio) {
    html += `<div style="text-align:right;margin-top:6px">${st.permitirVacio && elegido ? `<button type="button" class="btn btn-secondary ubp-cambiar" onclick="_ubpElegir('${id}','')">Quitar ubicación</button> ` : ''}${elegido ? `<button type="button" class="btn btn-secondary ubp-cambiar" onclick="_ubpCerrar('${id}')">Dejar ${_ubpTxt(elegido)}</button>` : ''}</div>`;
  }
  return html;
}

// La parte que cambia al escribir o al tocar un laboratorio/zona (el buscador
// no se repinta, para no perder el foco mientras se escribe).
function _ubpResultados(id) {
  const st = _ubicPicker[id];
  const activas = _ubpActivas();
  let html = '';
  const q = _ubpNorm(st.filtro).trim();
  if (q) {
    const palabras = q.split(/\s+/);
    const hits = activas.filter(u => {
      const t = _ubpNorm([u.ID_Ubicacion, _ubpEtiquetaLab(u.Laboratorio_Aula), u.Zona, u.Subzona, u.Descripcion_Completa].join(' '));
      return palabras.every(p => t.includes(p));
    }).sort(_ubpOrden);
    if (!hits.length) return `<div class="ubp-vacio">Nada coincide con «${_ubpTxt(st.filtro)}».</div>`;
    return `<div class="ubp-lista">${hits.slice(0, 40).map(u => _ubpBotonHueco(id, u, false, true)).join('')}</div>`
      + (hits.length > 40 ? `<div class="ubp-vacio">…y ${hits.length - 40} más: afina la búsqueda.</div>` : '');
  }

  // 3) Laboratorio → zona → hueco.
  const labs = [...new Set(activas.map(u => u.Laboratorio_Aula || ''))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  html += `<div class="ubp-titulo">Laboratorio</div><div class="ubp-chips">`
    + labs.map(l => `<button type="button" class="ubp-chip${st.lab === l ? ' activo' : ''}" onclick="_ubpLab('${id}', ${_ubpArg(l)})">${_ubpTxt(_ubpEtiquetaLab(l))}</button>`).join('') + `</div>`;
  if (st.lab === null) return html;

  const delLab = activas.filter(u => (u.Laboratorio_Aula || '') === st.lab);
  const zonas = [...new Set(delLab.map(u => zonaUbicacion(u) || _UBP_SIN_ZONA))];
  // Si el lab tiene una sola zona, se salta ese paso.
  const zonaActiva = zonas.length === 1 ? zonas[0] : st.zona;
  if (zonas.length > 1) {
    html += `<div class="ubp-titulo">Zona</div><div class="ubp-chips">`
      + zonas.sort((a, b) => a === _UBP_SIN_ZONA ? 1 : b === _UBP_SIN_ZONA ? -1 : a.localeCompare(b, 'es'))
        .map(z => {
          const n = delLab.filter(u => (zonaUbicacion(u) || _UBP_SIN_ZONA) === z).length;
          return `<button type="button" class="ubp-chip${zonaActiva === z ? ' activo' : ''}" onclick="_ubpZona('${id}', ${_ubpArg(z)})">${_ubpTxt(z === _UBP_SIN_ZONA ? 'Sin zona' : z)} <span class="ubp-n">${n}</span></button>`;
        }).join('') + `</div>`;
  }
  if (zonaActiva === null || zonaActiva === undefined) return html;
  const huecos = delLab.filter(u => (zonaUbicacion(u) || _UBP_SIN_ZONA) === zonaActiva).sort(_ubpOrden);
  html += `<div class="ubp-titulo">Sitio</div><div class="ubp-lista">${huecos.map(u => _ubpBotonHueco(id, u)).join('')}</div>`;
  return html;
}

function _ubpArg(s) { return _ubpTxt(JSON.stringify(s)); }

function _ubpBotonHueco(id, u, destacado = false, conContexto = false) {
  if (!u) return '';
  const st = _ubicPicker[id];
  const elegido = _ubpValor(id) === u.ID_Ubicacion;
  const stock = _ubpStockEn(st, u.ID_Ubicacion);
  const desc = conContexto || destacado ? ubicDescripcionLarga(u.ID_Ubicacion) : (_ubpDescHueco(u) || 'sin descripción');
  return `<button type="button" class="ubp-hueco${elegido ? ' activo' : ''}${destacado ? ' destacado' : ''}" onclick="_ubpElegir('${id}', ${_ubpArg(u.ID_Ubicacion)})">
    <span class="ubp-cod">${_ubpTxt(u.ID_Ubicacion)}</span>
    <span class="ubp-desc">${_ubpTxt(desc)}</span>
    ${stock ? `<span class="ubp-stock">ya hay ${_ubpTxt(stock)}</span>` : ''}
  </button>`;
}

function _ubpAbrir(id) { const st = _ubicPicker[id]; if (!st) return; st.abierto = true; _ubpPintar(id); }
function _ubpCerrar(id) { const st = _ubicPicker[id]; if (!st) return; st.abierto = false; _ubpPintar(id); }
function _ubpLab(id, lab) { const st = _ubicPicker[id]; st.lab = st.lab === lab ? null : lab; st.zona = null; _ubpPintarRes(id); }
function _ubpZona(id, zona) { const st = _ubicPicker[id]; st.zona = zona; _ubpPintarRes(id); }
function _ubpFiltrar(id, txt) { _ubicPicker[id].filtro = txt; _ubpPintarRes(id); }
function _ubpPintarRes(id) { const r = document.getElementById('ubp-res-' + id); if (r) r.innerHTML = _ubpResultados(id); }

function _ubpElegir(id, idUbicacion) {
  const st = _ubicPicker[id];
  const input = document.getElementById(id);
  if (!st || !input) return;
  input.value = idUbicacion;
  st.abierto = false; st.filtro = '';
  const u = DATA.ubicaciones.find(x => x.ID_Ubicacion === idUbicacion);
  if (u) st.lab = u.Laboratorio_Aula || '';
  _ubpPintar(id);
  if (st.onchange && typeof window[st.onchange] === 'function') window[st.onchange](id, idUbicacion);
}

// ============================================================
// REPARTO ENTRE VARIOS SITIOS (2026-11-21)
// ============================================================
// Lo que llega a veces se reparte: 4 garrafas al 205 y 2 al 207, a un sitio
// donde ya había botes y a otro donde no había nada (ahí se crea el bote al
// guardar). La cantidad total la pone quien recibe en su propio input
// (totalId); el primer sitio se lleva "el resto" y en los demás se escribe
// cuánto va. Con un solo sitio no hay nada que repartir y no se ve ninguna
// cantidad extra.
//
// repartoHTML(pref, { totalId, matId, unidad, valor }) → HTML
// repartoLeer(pref) → { repartos: [{id_ubicacion, cantidad}] } o { error }
// repartoActualizar(pref) → llamarlo en el oninput del total.

const _reparto = {}; // pref → { totalId, matId, unidad, filas: [n…], next }

function repartoHTML(pref, opts = {}) {
  _reparto[pref] = { totalId: opts.totalId, matId: opts.matId || '', unidad: opts.unidad || '', filas: [0], next: 1 };
  return `<div class="rep" id="rep-${pref}">
    <div id="rep-${pref}-filas">${_repFila(pref, 0, opts.valor || '')}</div>
    <button type="button" class="btn btn-secondary rep-mas" onclick="repartoAnadir('${pref}')">➕ Repartir en otro sitio</button>
  </div>`;
}

function _repFila(pref, n, valor) {
  const st = _reparto[pref];
  return `<div class="rep-fila" id="rep-${pref}-${n}">
    <div class="rep-fila-cab" id="rep-${pref}-${n}-cab" style="display:none">
      <span class="rep-fila-num">Sitio ${n === 0 ? 1 : st.filas.indexOf(n) + 1}</span>
      ${n === 0
        ? `<span class="rep-resto" id="rep-${pref}-${n}-resto"></span>`
        : `<label>Van aquí <input type="number" id="rep-${pref}-${n}-cant" min="0" step="0.01" value="" oninput="repartoActualizar('${pref}')"> ${_ubpTxt(st.unidad)}</label>
           <button type="button" class="rep-quitar" title="Quitar este sitio" onclick="repartoQuitar('${pref}', ${n})">✕</button>`}
    </div>
    ${ubicPickerHTML(`rep-${pref}-${n}-ubic`, { matId: st.matId, unidad: st.unidad, valor })}
  </div>`;
}

function repartoAnadir(pref) {
  const st = _reparto[pref];
  const n = st.next++;
  st.filas.push(n);
  document.getElementById(`rep-${pref}-filas`).insertAdjacentHTML('beforeend', _repFila(pref, n, ''));
  repartoActualizar(pref);
  document.getElementById(`rep-${pref}-${n}-cant`)?.focus();
}

function repartoQuitar(pref, n) {
  const st = _reparto[pref];
  st.filas = st.filas.filter(x => x !== n);
  document.getElementById(`rep-${pref}-${n}`)?.remove();
  delete _ubicPicker[`rep-${pref}-${n}-ubic`];
  repartoActualizar(pref);
}

function _repTotal(st) { return parseFloat(document.getElementById(st.totalId)?.value) || 0; }

function _repCantidades(pref) {
  const st = _reparto[pref];
  const otros = st.filas.slice(1).map(n => parseFloat(document.getElementById(`rep-${pref}-${n}-cant`)?.value) || 0);
  const resto = Math.round((_repTotal(st) - otros.reduce((a, b) => a + b, 0)) * 1000) / 1000;
  return [resto, ...otros];
}

function repartoActualizar(pref) {
  const st = _reparto[pref];
  if (!st) return;
  const varios = st.filas.length > 1;
  st.filas.forEach((n, i) => {
    const cab = document.getElementById(`rep-${pref}-${n}-cab`);
    if (cab) cab.style.display = varios ? '' : 'none';
    const num = cab?.querySelector('.rep-fila-num');
    if (num) num.textContent = `Sitio ${i + 1}`;
    document.getElementById(`rep-${pref}-${n}`)?.classList.toggle('rep-varios', varios);
  });
  if (!varios) return;
  const resto = _repCantidades(pref)[0];
  const el = document.getElementById(`rep-${pref}-${st.filas[0]}-resto`);
  if (el) {
    el.textContent = resto < 0 ? `te pasas en ${-resto} ${st.unidad}` : `van aquí ${resto} ${st.unidad} (el resto)`;
    el.classList.toggle('rep-error', resto < 0);
  }
}

function repartoLeer(pref) {
  const st = _reparto[pref];
  if (!st) return { repartos: [] };
  const cants = _repCantidades(pref);
  if (cants[0] < 0) return { error: 'Lo repartido suma más de lo que llega' };
  const repartos = [];
  for (let i = 0; i < st.filas.length; i++) {
    const c = cants[i];
    if (c <= 0) continue;
    const ubic = _ubpValor(`rep-${pref}-${st.filas[i]}-ubic`);
    if (!ubic) return { error: st.filas.length > 1 ? `Elige el sitio ${i + 1}` : 'Elige dónde se guarda' };
    repartos.push({ id_ubicacion: ubic, cantidad: c });
  }
  return { repartos };
}
