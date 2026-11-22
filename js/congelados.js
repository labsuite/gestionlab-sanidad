// ============================================================
// MUESTRAS CONGELADAS — congelador → caja → casilla
// ============================================================
// Ver docs/modulo-congelados.md. Los congeladores no son una tabla propia: son
// equipos del inventario (congelador, frigorífico con congelador, tanque de
// N₂…). Cada caja tiene filas × columnas y las casillas se nombran como en las
// cajas de crioviales: A1, A2… B1…
//
// Cada TUBO es una fila de `muestras_congeladas` y ocupa una casilla; los tubos
// del mismo stock comparten ID_Lote. Nombre, tipo y datos propios son del lote;
// casilla y cantidad que queda, de cada tubo.
//
// Cajas y muestras (alta, edición, descarte): profesorado (Admin/Gestor/Profesor).
// El alumnado consulta.

let _congFiltroEquipo = '';
let _congCajaAbierta = '';
let _congVerRetiradas = false;
let _congEditandoCaja = '';
let _congMuestraSel = '';
let _congBusqueda = '';
let _congEditandoMuestra = '';
let _congDescartando = '';

const _CONG_RE_EQUIPO = /congel|frigor|nevera|nitr[oó]geno|dewar|crioconserv/i;

/**
 * Tipos de muestra. `formato` es el que se propone al elegir el tipo (se puede
 * cambiar en cada muestra). `campos` se guardan en el jsonb `datos`.
 */
const _CONG_TIPOS = {
  'Cepa': {
    icono: '🦠', clase: 'cepa', formato: 'Bolitas', pase: true, caducidad: false,
    phNombre: 'ej. E. coli ATCC 25922',
    campos: [
      { k: 'especie', label: 'Especie / microorganismo', ph: 'ej. Escherichia coli' },
      { k: 'coleccion', label: 'Código de colección', ph: 'ej. ATCC 25922, CECT 434' },
      { k: 'grupo_riesgo', label: 'Grupo de riesgo biológico', tipo: 'select', opciones: ['1', '2', '3'] },
      { k: 'medio', label: 'Medio de criopreservación', tipo: 'select', otro: true,
        opciones: ['Crioviales con bolitas (Microbank o similar)', 'Glicerol 15 %', 'Glicerol 20 %', 'Leche descremada'] },
    ],
  },
  'Línea celular': {
    icono: '🧫', clase: 'celula', formato: 'Tubo', pase: true, caducidad: false,
    phNombre: 'ej. HeLa, Vero',
    campos: [
      { k: 'origen', label: 'Origen (especie y tejido)', ph: 'ej. Humano, adenocarcinoma de cérvix' },
      { k: 'celulas_vial', label: 'Células por vial', ph: 'ej. 1 × 10⁶' },
      { k: 'medio', label: 'Medio de congelación', tipo: 'select', otro: true,
        opciones: ['DMSO 10 % en SFB', 'DMSO 10 % en medio completo', 'Medio comercial de congelación'] },
      { k: 'micoplasma_fecha', label: 'Último test de micoplasma', tipo: 'date' },
      { k: 'micoplasma_resultado', label: 'Resultado', tipo: 'select', opciones: ['Negativo', 'Positivo'] },
    ],
  },
  'Ácido nucleico': {
    icono: '🧬', clase: 'acido', formato: 'Volumen', pase: false, caducidad: false,
    phNombre: 'ej. ADN genómico E. coli — práctica de extracción',
    campos: [
      { k: 'tipo_an', label: 'Tipo', tipo: 'select', otro: true,
        opciones: ['ADN genómico', 'ARN total', 'Plásmido', 'ADNc', 'Producto de PCR'] },
      { k: 'origen', label: 'De qué procede', ph: 'ej. Cultivo de E. coli, práctica 4' },
      { k: 'concentracion', label: 'Concentración (ng/µL)', ph: 'ej. 85' },
      { k: 'a260_280', label: 'Pureza A260/280', ph: 'ej. 1,85' },
    ],
  },
  'Suero, plasma o alícuota': {
    icono: '🩸', clase: 'suero', formato: 'Volumen', pase: false, caducidad: true,
    phNombre: 'ej. Suero control normal, Taq polimerasa',
    aviso: 'Sin datos de pacientes: ni nombres ni números de historia. Si procede de una persona, solo «suero de donante anónimo».',
    campos: [
      { k: 'contenido', label: 'Qué es', ph: 'ej. Suero control, enzima, cebador, anticuerpo' },
      { k: 'procedencia', label: 'Procedencia', tipo: 'select', otro: true, opciones: ['Comercial', 'Preparado en el laboratorio'] },
    ],
  },
  'Kit o master mix': {
    icono: '🧪', clase: 'kit', formato: 'Volumen', pase: false, caducidad: true, material: true,
    phNombre: 'ej. Master mix PCR 2×',
    campos: [
      { k: 'lote_comercial', label: 'Lote del fabricante', ph: 'ej. 2405-118' },
    ],
  },
};
const _CONG_FORMATOS = {
  Bolitas: 'Bolitas — cada uso saca una bolita',
  Tubo: 'Tubo o vial de un solo uso',
  Volumen: 'Volumen — se descongela y se va gastando',
};

function _congPuedeGestionar() { return ['Administrador', 'Gestor', 'Profesor'].includes(getUserRole()); }

/** Equipos donde puede haber cajas congeladas: congeladores, frigoríficos (su
 *  compartimento congelador) y tanques de nitrógeno. Excluye los dados de baja. */
function _congEquipos() {
  return DATA.equipos
    .filter(e => _CONG_RE_EQUIPO.test(e.Tipo_Equipo || '') && !/baja/i.test(e.Estado_Operativo || ''))
    .sort((a, b) => _congOrdenEquipo(a) - _congOrdenEquipo(b) || (a.ID_Activo || '').localeCompare(b.ID_Activo || ''));
}
function _congOrdenEquipo(e) {
  const t = (e.Tipo_Equipo || '').toLowerCase();
  if (/nitr|dewar|crioconserv/.test(t)) return 0;
  if (/congel/.test(t)) return 1;
  return 2;
}

function _congNombreEquipo(idEquipo, conUbicacion = true) {
  const e = DATA.equipos.find(x => x.ID_Activo === idEquipo);
  if (!e) return idEquipo || '—';
  const nombre = [e.Tipo_Equipo, e.Marca, e.Modelo].filter(Boolean).join(' ');
  return `${nombre} (${e.ID_Activo})${conUbicacion && e.Ubicacion ? ' · ' + e.Ubicacion : ''}`;
}

function _congEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Nombre de casilla: fila 0, columna 0 → "A1". */
function _congCasilla(fila, col) { return String.fromCharCode(65 + fila) + (col + 1); }
function _congIndiceCasilla(pos, caja) {
  const m = /^([A-Z])(\d{1,2})$/.exec(String(pos || '').toUpperCase());
  if (!m) return -1;
  const f = m[1].charCodeAt(0) - 65, c = Number(m[2]) - 1;
  if (f >= caja.Filas || c < 0 || c >= caja.Columnas) return -1;
  return f * caja.Columnas + c;
}

function _congCaja(idCaja) { return (DATA.cajasCongelado || []).find(c => c.ID_Caja === idCaja); }
function _congMuestra(id) { return (DATA.muestrasCongeladas || []).find(m => m.ID_Muestra === id); }

/** Tubos que siguen en una caja (los descartados o agotados ya no ocupan casilla). */
function _congMuestrasDeCaja(idCaja) {
  return (DATA.muestrasCongeladas || []).filter(m => m.ID_Caja === idCaja && m.Estado === 'Disponible');
}
function _congTubosDelLote(idLote) {
  return (DATA.muestrasCongeladas || []).filter(m => m.ID_Lote === idLote && m.Estado === 'Disponible');
}

function _congNum(n) {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });
}
/** "18 de 25 bolitas", "320 de 500 µL", "1 tubo". */
function _congCantidadTexto(m) {
  if (m.Formato === 'Tubo') return '1 tubo';
  const ini = m.Cantidad_Inicial != null ? ` de ${_congNum(m.Cantidad_Inicial)}` : '';
  return `${_congNum(m.Cantidad_Actual)}${ini} ${m.Unidad || ''}`.trim();
}
/** Queda menos del 20 % (o 2 bolitas o menos). */
function _congQuedaPoco(m) {
  if (m.Formato === 'Tubo' || m.Cantidad_Actual == null) return false;
  if (m.Formato === 'Bolitas' && m.Cantidad_Actual <= 2) return true;
  return m.Cantidad_Inicial > 0 && m.Cantidad_Actual / m.Cantidad_Inicial < 0.2;
}
function _congEtiqueta(m) {
  return (m.Abreviatura || m.Nombre || '').replace(/\s+/g, '').slice(0, 4);
}

// ── Render principal ─────────────────────────────────────────

function renderCongelados() {
  const el = document.getElementById('page-congelados');
  if (!el) return;
  const gestiona = _congPuedeGestionar();
  const equipos = _congEquipos();
  const cajas = (DATA.cajasCongelado || []).filter(c => _congVerRetiradas || c.Activa);

  const opcionesEquipo = equipos.map(e =>
    `<option value="${_congEsc(e.ID_Activo)}" ${e.ID_Activo === _congFiltroEquipo ? 'selected' : ''}>${_congEsc(_congNombreEquipo(e.ID_Activo))}</option>`).join('');

  const toolbar = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <input type="search" class="filter" id="cong-busqueda" placeholder="🔍 Buscar muestra…" value="${_congEsc(_congBusqueda)}"
        oninput="_congBuscar(this.value)" style="flex:1;min-width:180px">
      <select class="filter" onchange="_congFiltroEquipo=this.value;renderCongelados()" style="max-width:100%">
        <option value="">Todos los congeladores</option>${opcionesEquipo}
      </select>
      ${gestiona ? `<label style="font-size:12px;color:var(--text-soft);display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" ${_congVerRetiradas ? 'checked' : ''} onchange="_congVerRetiradas=this.checked;renderCongelados()"> Ver cajas retiradas</label>` : ''}
      ${gestiona ? `<div style="display:flex;gap:8px;margin-left:auto">
        <button class="btn btn-secondary" onclick="openModalCaja()">+ Nueva caja</button>
        <button class="btn btn-primary" onclick="openModalMuestra()">+ Nueva muestra</button></div>` : ''}
    </div>`;

  if (!equipos.length) {
    el.innerHTML = toolbar + `<div class="empty-state"><div class="empty-state-icon">🧊</div>
      <div class="empty-state-title">No hay ningún congelador en el inventario de equipos</div>
      <div style="font-size:13px;color:var(--text-muted)">Da de alta el congelador (o el tanque de nitrógeno) en Equipos → Inventario para poder colocar cajas en él.</div></div>`;
    return;
  }

  el.innerHTML = toolbar + `<div id="cong-cuerpo">${_congRenderCuerpo(equipos, cajas, gestiona)}</div>`;
}

function _congRenderCuerpo(equipos, cajas, gestiona) {
  if (_congBusqueda.trim()) return _congRenderBusqueda();

  const equiposVista = _congFiltroEquipo ? equipos.filter(e => e.ID_Activo === _congFiltroEquipo) : equipos;
  const conCajas = equiposVista.filter(e => cajas.some(c => c.ID_Equipo === e.ID_Activo));
  const sinCajas = equiposVista.filter(e => !cajas.some(c => c.ID_Equipo === e.ID_Activo));

  let cuerpo = conCajas.map(e => _congRenderEquipo(e, cajas.filter(c => c.ID_Equipo === e.ID_Activo), gestiona)).join('');
  if (!conCajas.length) {
    cuerpo = `<div class="empty-state"><div class="empty-state-icon">📦</div>
      <div class="empty-state-title">Todavía no hay cajas${_congFiltroEquipo ? ' en este congelador' : ''}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Cada caja se coloca en un congelador y tiene su cuadrícula de casillas (A1, B3…) donde van las muestras.</div>
      ${gestiona ? `<button class="btn btn-primary" onclick="openModalCaja()">+ Nueva caja</button>` : ''}</div>`;
  }
  if (sinCajas.length && conCajas.length) {
    cuerpo += `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Sin cajas: ${sinCajas.map(e => _congEsc(_congNombreEquipo(e.ID_Activo))).join(' · ')}</div>`;
  }
  return cuerpo;
}

function _congRenderEquipo(equipo, cajas, gestiona) {
  cajas.sort((a, b) => (a.Compartimento || '').localeCompare(b.Compartimento || '', 'es', { numeric: true })
    || a.Nombre.localeCompare(b.Nombre, 'es', { numeric: true }));
  const abierta = cajas.find(c => c.ID_Caja === _congCajaAbierta);
  return `
    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="font-weight:700;font-size:15px;margin-bottom:12px">🧊 ${_congEsc(_congNombreEquipo(equipo.ID_Activo))}</div>
      <div class="cong-cajas">
        ${cajas.map(c => _congRenderChipCaja(c)).join('')}
      </div>
      ${abierta ? _congRenderCaja(abierta, gestiona) : ''}
    </div>`;
}

function _congRenderChipCaja(c) {
  const total = c.Filas * c.Columnas;
  const ocupadas = new Set(_congMuestrasDeCaja(c.ID_Caja).map(m => m.Posicion)).size;
  const activa = c.ID_Caja === _congCajaAbierta;
  return `
    <button class="cong-chip${activa ? ' activa' : ''}${c.Activa ? '' : ' retirada'}" onclick="_congToggleCaja('${_congEsc(c.ID_Caja)}')">
      <div style="font-weight:700">📦 ${_congEsc(c.Nombre)}${c.Activa ? '' : ' <span style="font-weight:400">(retirada)</span>'}</div>
      ${c.Compartimento ? `<div class="cong-chip-sub">${_congEsc(c.Compartimento)}</div>` : ''}
      <div class="cong-chip-sub">${ocupadas}/${total} ocupadas · ${c.Filas}×${c.Columnas}</div>
    </button>`;
}

function _congToggleCaja(idCaja) {
  _congCajaAbierta = _congCajaAbierta === idCaja ? '' : idCaja;
  _congMuestraSel = '';
  renderCongelados();
}

function _congRenderCaja(c, gestiona) {
  const muestras = _congMuestrasDeCaja(c.ID_Caja);
  const porCasilla = {};
  muestras.forEach(m => { porCasilla[m.Posicion] = m; });
  const sel = _congMuestra(_congMuestraSel);

  let celdas = `<div class="cong-cab"></div>`;
  for (let col = 0; col < c.Columnas; col++) celdas += `<div class="cong-cab">${col + 1}</div>`;
  for (let f = 0; f < c.Filas; f++) {
    celdas += `<div class="cong-cab">${String.fromCharCode(65 + f)}</div>`;
    for (let col = 0; col < c.Columnas; col++) {
      const pos = _congCasilla(f, col);
      const m = porCasilla[pos];
      if (m) {
        const t = _CONG_TIPOS[m.Tipo] || {};
        const clases = ['cong-celda', 'ocupada', 'cong-t-' + (t.clase || 'otro')];
        if (m.ID_Muestra === _congMuestraSel) clases.push('sel');
        else if (sel && m.ID_Lote === sel.ID_Lote) clases.push('mismo-lote');
        if (_congQuedaPoco(m)) clases.push('poco');
        celdas += `<button class="${clases.join(' ')}" title="${_congEsc(`${pos} · ${m.Nombre} · ${_congCantidadTexto(m)}`)}"
          onclick="_congSelMuestra('${m.ID_Muestra}')">${_congEsc(_congEtiqueta(m))}</button>`;
      } else {
        celdas += gestiona && c.Activa
          ? `<button class="cong-celda libre" title="${pos} · libre — añadir muestra aquí" onclick="openModalMuestra('', '${_congEsc(c.ID_Caja)}', '${pos}')"></button>`
          : `<div class="cong-celda" title="${pos} · libre"></div>`;
      }
    }
  }

  const total = c.Filas * c.Columnas;
  const libres = total - Object.keys(porCasilla).length;
  const tiposEnCaja = [...new Set(muestras.map(m => m.Tipo))];
  return `
    <div class="cong-caja-detalle">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;font-size:14px">📦 ${_congEsc(c.Nombre)}</div>
          <div style="font-size:12px;color:var(--text-soft)">${[c.Compartimento, `${c.Filas} filas × ${c.Columnas} columnas`, `${libres} casillas libres`].filter(Boolean).map(_congEsc).join(' · ')}</div>
          ${c.Descripcion ? `<div style="font-size:12px;color:var(--text-soft);margin-top:4px">${_congEsc(c.Descripcion)}</div>` : ''}
        </div>
        ${gestiona ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openModalCaja('${_congEsc(c.ID_Caja)}')">✏️ Editar caja</button>
          ${c.Activa
            ? `<button class="btn btn-secondary btn-sm" onclick="_congRetirarCaja('${_congEsc(c.ID_Caja)}', false)">Retirar</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="_congRetirarCaja('${_congEsc(c.ID_Caja)}', true)">↩︎ Reactivar</button>`}
        </div>` : ''}
      </div>
      <div class="cong-grid-wrap">
        <div class="cong-grid" style="grid-template-columns:22px repeat(${c.Columnas}, minmax(24px, 1fr));max-width:${22 + c.Columnas * 44}px">${celdas}</div>
      </div>
      ${tiposEnCaja.length ? `<div class="cong-leyenda">${tiposEnCaja.map(t => `<span><i class="cong-t-${(_CONG_TIPOS[t] || {}).clase || 'otro'}"></i>${_congEsc(t)}</span>`).join('')}<span><i class="poco"></i>Queda poco</span></div>` : ''}
      ${!muestras.length ? `<div style="font-size:12px;color:var(--text-muted);margin-top:10px">La caja está vacía.${gestiona && c.Activa ? ' Pulsa una casilla para añadir una muestra en ella.' : ''}</div>` : ''}
      ${sel && sel.ID_Caja === c.ID_Caja ? _congRenderFicha(sel, gestiona) : (muestras.length ? `<div style="font-size:12px;color:var(--text-muted);margin-top:10px">Pulsa un tubo para ver su ficha${gestiona && c.Activa ? '; una casilla vacía, para añadir una muestra' : ''}.</div>` : '')}
    </div>`;
}

function _congSelMuestra(id) {
  _congMuestraSel = _congMuestraSel === id ? '' : id;
  renderCongelados();
  if (_congMuestraSel) document.getElementById('cong-ficha')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _congRenderFicha(m, gestiona) {
  const t = _CONG_TIPOS[m.Tipo] || { campos: [] };
  const filas = [];
  const add = (label, valor) => { if (valor !== '' && valor != null) filas.push(`<div class="cong-ficha-k">${_congEsc(label)}</div><div>${valor}</div>`); };

  let cantidad = _congEsc(_congCantidadTexto(m));
  if (_congQuedaPoco(m)) cantidad += ' <span class="badge badge-orange" style="margin-left:4px">queda poco</span>';
  add('Queda', cantidad);
  if (m.Formato === 'Volumen') add('Descongelaciones', _congEsc(m.Descongelaciones || 0));
  add('Formato', _congEsc(_CONG_FORMATOS[m.Formato] || m.Formato));
  if (t.pase && m.Pase != null) add('Pase', _congEsc(m.Pase));
  if (t.material && m.ID_Material) {
    const mat = DATA.material.find(x => x.ID_Material === m.ID_Material);
    add('Material del inventario', `🧴 ${_congEsc(mat ? mat.Nombre : m.ID_Material)} <span style="color:var(--text-muted)">(${_congEsc(m.ID_Material)})</span>`);
  }
  t.campos.forEach(c => {
    let val = m.Datos?.[c.k];
    if (val && c.tipo === 'date') val = _congFecha(val);
    if (c.k === 'grupo_riesgo' && val) val = 'Grupo ' + val;
    add(c.label, _congEsc(val || ''));
  });
  add('Congelado el', _congEsc(_congFecha(m.Fecha_Congelacion)));
  if (m.Caducidad) {
    const caducado = m.Caducidad < new Date().toISOString().slice(0, 10);
    add('Caducidad', _congEsc(_congFecha(m.Caducidad)) + (caducado ? ' <span class="badge badge-red" style="margin-left:4px">caducado</span>' : ''));
  }
  add('Observaciones', _congEsc(m.Observaciones));
  add('Dado de alta por', _congEsc([m.Creado_Por, _congFecha((m.Fecha_Alta || '').slice(0, 10))].filter(Boolean).join(' · ')));

  const hermanos = _congTubosDelLote(m.ID_Lote);
  const otros = hermanos.filter(x => x.ID_Muestra !== m.ID_Muestra);
  const posTexto = x => {
    const caja = _congCaja(x.ID_Caja);
    return x.ID_Caja === m.ID_Caja ? x.Posicion : `${caja ? caja.Nombre : x.ID_Caja} ${x.Posicion}`;
  };

  return `
    <div class="cong-ficha" id="cong-ficha">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;font-size:15px">${t.icono || '🧊'} ${_congEsc(m.Nombre)} <span class="cong-pos">${_congEsc(m.Posicion)}</span></div>
          <div style="font-size:12px;color:var(--text-soft)">${_congEsc(m.Tipo)}${otros.length ? ` · stock de ${hermanos.length} tubos (también en ${otros.map(x => _congEsc(posTexto(x))).join(', ')})` : ''}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="_congSelMuestra('')">✕</button>
      </div>
      <div class="cong-ficha-grid">${filas.join('')}</div>
      ${gestiona ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-secondary btn-sm" onclick="openModalMuestra('${m.ID_Muestra}')">✏️ Editar</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalDescartarMuestra('${m.ID_Muestra}')">🗑️ Descartar</button>
      </div>` : ''}
    </div>`;
}

function _congFecha(iso) {
  if (!iso) return '';
  const [a, mm, d] = String(iso).slice(0, 10).split('-');
  return d && mm && a ? `${d}/${mm}/${a}` : iso;
}

// ── Búsqueda ─────────────────────────────────────────────────

function _congBuscar(texto) {
  _congBusqueda = texto;
  const cuerpo = document.getElementById('cong-cuerpo');
  if (!cuerpo) return renderCongelados();
  const cajas = (DATA.cajasCongelado || []).filter(c => _congVerRetiradas || c.Activa);
  cuerpo.innerHTML = _congRenderCuerpo(_congEquipos(), cajas, _congPuedeGestionar());
}

function _congNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function _congRenderBusqueda() {
  const q = _congNorm(_congBusqueda.trim());
  const coincide = m => {
    const caja = _congCaja(m.ID_Caja);
    const mat = m.ID_Material ? DATA.material.find(x => x.ID_Material === m.ID_Material) : null;
    return _congNorm([m.Nombre, m.Abreviatura, m.Tipo, caja?.Nombre, mat?.Nombre, ...Object.values(m.Datos || {})].join(' ')).includes(q);
  };
  const tubos = (DATA.muestrasCongeladas || []).filter(m => m.Estado === 'Disponible' && coincide(m));
  if (!tubos.length) {
    return `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">Ninguna muestra coincide con «${_congEsc(_congBusqueda.trim())}»</div></div>`;
  }
  const lotes = {};
  tubos.forEach(m => { (lotes[m.ID_Lote] = lotes[m.ID_Lote] || []).push(m); });
  const filas = Object.values(lotes)
    .sort((a, b) => a[0].Nombre.localeCompare(b[0].Nombre, 'es'))
    .map(grupo => {
      grupo.sort((a, b) => a.ID_Caja.localeCompare(b.ID_Caja)
        || _congIndiceCasilla(a.Posicion, _congCaja(a.ID_Caja) || { Filas: 26, Columnas: 26 })
         - _congIndiceCasilla(b.Posicion, _congCaja(b.ID_Caja) || { Filas: 26, Columnas: 26 }));
      const m = grupo[0];
      const t = _CONG_TIPOS[m.Tipo] || {};
      const sitios = grupo.map(x => {
        const caja = _congCaja(x.ID_Caja);
        return `<button class="cong-link" onclick="_congIrA('${x.ID_Muestra}')">${_congEsc(caja ? caja.Nombre : x.ID_Caja)} · ${_congEsc(x.Posicion)}</button>`;
      }).join(' ');
      const caja = _congCaja(m.ID_Caja);
      const cantidad = m.Formato === 'Tubo' ? `${grupo.length} tubo${grupo.length > 1 ? 's' : ''}` : grupo.map(_congCantidadTexto).join(' · ');
      return `<div class="cong-resultado">
        <div style="font-weight:700">${t.icono || '🧊'} ${_congEsc(m.Nombre)}</div>
        <div style="font-size:12px;color:var(--text-soft)">${_congEsc(m.Tipo)} · ${_congEsc(caja ? _congNombreEquipo(caja.ID_Equipo) : '')}</div>
        <div style="font-size:12px;margin-top:4px">${sitios}</div>
        <div style="font-size:12px;color:var(--text-soft);margin-top:2px">Queda: ${_congEsc(cantidad)}</div>
      </div>`;
    });
  return `<div class="card" style="padding:8px 16px">${filas.join('')}</div>`;
}

/** Abre la caja de un tubo y lo selecciona. */
function _congIrA(idMuestra) {
  const m = _congMuestra(idMuestra);
  if (!m) return;
  const caja = _congCaja(m.ID_Caja);
  _congBusqueda = '';
  _congFiltroEquipo = '';
  if (caja && !caja.Activa) _congVerRetiradas = true;
  _congCajaAbierta = m.ID_Caja;
  _congMuestraSel = idMuestra;
  renderCongelados();
  document.getElementById('cong-ficha')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Modal de caja ────────────────────────────────────────────

function openModalCaja(idCaja = '') {
  if (!_congPuedeGestionar()) return;
  _congEditandoCaja = idCaja;
  const c = idCaja ? _congCaja(idCaja) : null;
  setText('modal-caja-title', c ? `✏️ Editar caja «${c.Nombre}»` : '📦 Nueva caja');

  const sel = document.getElementById('caja-equipo');
  const equipos = _congEquipos();
  // Al editar, que siga apareciendo el equipo actual aunque ya no pase el filtro
  if (c && !equipos.some(e => e.ID_Activo === c.ID_Equipo)) {
    const actual = DATA.equipos.find(e => e.ID_Activo === c.ID_Equipo);
    if (actual) equipos.push(actual);
  }
  sel.innerHTML = `<option value="">Seleccionar congelador…</option>` +
    equipos.map(e => `<option value="${_congEsc(e.ID_Activo)}">${_congEsc(_congNombreEquipo(e.ID_Activo))}</option>`).join('');

  sv('caja-nombre', c?.Nombre || '');
  sv('caja-equipo', c?.ID_Equipo || _congFiltroEquipo || (equipos.length === 1 ? equipos[0].ID_Activo : ''));
  sv('caja-compartimento', c?.Compartimento || '');
  sv('caja-filas', c?.Filas || 9);
  sv('caja-columnas', c?.Columnas || 9);
  sv('caja-descripcion', c?.Descripcion || '');
  _congSincronizarFormato();
  openModal('modal-caja');
}

function _congAplicarFormato(valor) {
  if (!valor) return;
  const [f, c] = valor.split('x');
  sv('caja-filas', f);
  sv('caja-columnas', c);
}

/** Marca en el desplegable el formato que corresponde a filas × columnas. */
function _congSincronizarFormato() {
  const sel = document.getElementById('caja-formato');
  if (!sel) return;
  const valor = `${v('caja-filas')}x${v('caja-columnas')}`;
  sel.value = [...sel.options].some(o => o.value === valor) ? valor : '';
}

async function guardarCaja() {
  const datos = {
    nombre: v('caja-nombre'), id_equipo: v('caja-equipo'), compartimento: v('caja-compartimento'),
    filas: parseInt(v('caja-filas'), 10), columnas: parseInt(v('caja-columnas'), 10),
    descripcion: v('caja-descripcion'),
  };
  if (!datos.nombre) { showToast('Ponle un nombre a la caja', 'error'); return; }
  if (!datos.id_equipo) { showToast('Elige en qué congelador está', 'error'); return; }
  for (const [k, n] of [['filas', 'Filas'], ['columnas', 'Columnas']]) {
    if (!Number.isInteger(datos[k]) || datos[k] < 1 || datos[k] > 26) { showToast(`${n}: entre 1 y 26`, 'error'); return; }
  }
  // Al encoger una caja no puede quedar fuera ningún tubo
  if (_congEditandoCaja) {
    const fuera = _congMuestrasDeCaja(_congEditandoCaja)
      .filter(m => _congIndiceCasilla(m.Posicion, { Filas: datos.filas, Columnas: datos.columnas }) < 0);
    if (fuera.length) { showToast(`No se puede encoger: hay tubos en ${fuera.map(m => m.Posicion).join(', ')}`, 'error'); return; }
  }

  showLoading('Guardando caja…');
  try {
    const { caja } = await callEdgeFunction('gestionar-congelados',
      _congEditandoCaja ? { accion: 'editar_caja', id_caja: _congEditandoCaja, ...datos } : { accion: 'crear_caja', ...datos });
    const obj = _cajaCongeladoSbToObj(caja);
    const idx = DATA.cajasCongelado.findIndex(x => x.ID_Caja === obj.ID_Caja);
    if (idx >= 0) DATA.cajasCongelado[idx] = obj; else DATA.cajasCongelado.push(obj);
    _congCajaAbierta = obj.ID_Caja;
    closeModal('modal-caja');
    renderCongelados();
    showToast(_congEditandoCaja ? 'Caja actualizada' : 'Caja creada', 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'No se pudo guardar la caja', 'error');
  } finally { hideLoading(); }
}

async function _congRetirarCaja(idCaja, reactivar) {
  const c = _congCaja(idCaja);
  if (!c) return;
  if (!reactivar) {
    if (_congMuestrasDeCaja(idCaja).length) { showToast('Antes de retirar la caja, saca o descarta los tubos que tiene', 'error'); return; }
    if (!confirm(`¿Retirar la caja «${c.Nombre}»? Dejará de aparecer, pero no se borra: se puede reactivar con «Ver cajas retiradas».`)) return;
  }
  showLoading(reactivar ? 'Reactivando…' : 'Retirando…');
  try {
    const { caja } = await callEdgeFunction('gestionar-congelados', { accion: reactivar ? 'reactivar_caja' : 'retirar_caja', id_caja: idCaja });
    const idx = DATA.cajasCongelado.findIndex(x => x.ID_Caja === idCaja);
    if (idx >= 0) DATA.cajasCongelado[idx] = _cajaCongeladoSbToObj(caja);
    if (!reactivar && !_congVerRetiradas) _congCajaAbierta = '';
    renderCongelados();
    showToast(reactivar ? 'Caja reactivada' : 'Caja retirada', 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'No se pudo actualizar la caja', 'error');
  } finally { hideLoading(); }
}

// ── Modal de muestra (alta y edición) ────────────────────────

function _congCajasActivas() {
  return (DATA.cajasCongelado || []).filter(c => c.Activa)
    .sort((a, b) => a.ID_Equipo.localeCompare(b.ID_Equipo) || a.Nombre.localeCompare(b.Nombre, 'es', { numeric: true }));
}

/**
 * Alta: `idCaja`/`posicion` vienen de la casilla pulsada (opcionales).
 * Edición: `idMuestra` del tubo; los datos comunes se guardan para todo su lote.
 */
function openModalMuestra(idMuestra = '', idCaja = '', posicion = '') {
  if (!_congPuedeGestionar()) return;
  const m = idMuestra ? _congMuestra(idMuestra) : null;
  _congEditandoMuestra = m ? m.ID_Muestra : '';
  const cajas = _congCajasActivas();
  if (!m && !cajas.length) { showToast('Primero crea una caja donde guardar la muestra', 'error'); return; }

  setText('modal-muestra-title', m ? `✏️ Editar ${m.Nombre} (${m.Posicion})` : '🧊 Nueva muestra');
  const selTipo = document.getElementById('muestra-tipo');
  selTipo.innerHTML = Object.entries(_CONG_TIPOS).map(([k, t]) => `<option value="${_congEsc(k)}">${t.icono} ${_congEsc(k)}</option>`).join('');
  const selFormato = document.getElementById('muestra-formato');
  selFormato.innerHTML = Object.entries(_CONG_FORMATOS).map(([k, l]) => `<option value="${k}">${_congEsc(l)}</option>`).join('');
  const selCaja = document.getElementById('muestra-caja');
  const opcCajas = [...cajas];
  if (m && !opcCajas.some(c => c.ID_Caja === m.ID_Caja)) { const c = _congCaja(m.ID_Caja); if (c) opcCajas.push(c); }
  selCaja.innerHTML = opcCajas.map(c =>
    `<option value="${_congEsc(c.ID_Caja)}">${_congEsc(c.Nombre)} — ${_congEsc(_congNombreEquipo(c.ID_Equipo, false))}${c.Compartimento ? ' · ' + _congEsc(c.Compartimento) : ''}</option>`).join('');

  // Lista de materiales para enlazar kits y master mix
  document.getElementById('muestra-material-lista').innerHTML = DATA.material
    .slice().sort((a, b) => a.Nombre.localeCompare(b.Nombre, 'es'))
    .map(x => `<option value="${_congEsc(x.Nombre + ' · ' + x.ID_Material)}">`).join('');

  const tipo = m?.Tipo || 'Cepa';
  sv('muestra-tipo', tipo);
  sv('muestra-nombre', m?.Nombre || '');
  sv('muestra-abreviatura', m?.Abreviatura || '');
  sv('muestra-formato', m?.Formato || _CONG_TIPOS[tipo].formato);
  sv('muestra-unidad', m?.Formato === 'Volumen' ? (m.Unidad || 'µL') : 'µL');
  sv('muestra-cantidad', m ? (m.Cantidad_Inicial ?? '') : '');
  sv('muestra-cantidad-actual', m ? (m.Cantidad_Actual ?? '') : '');
  sv('muestra-pase', m?.Pase ?? '');
  sv('muestra-fecha', m ? (m.Fecha_Congelacion || '') : new Date().toISOString().slice(0, 10));
  sv('muestra-caducidad', m?.Caducidad || '');
  sv('muestra-observaciones', m?.Observaciones || '');
  const mat = m?.ID_Material ? DATA.material.find(x => x.ID_Material === m.ID_Material) : null;
  sv('muestra-material', mat ? `${mat.Nombre} · ${mat.ID_Material}` : (m?.ID_Material || ''));

  const cajaIni = m?.ID_Caja || idCaja || _congCajaAbierta || cajas[0]?.ID_Caja || '';
  sv('muestra-caja', opcCajas.some(c => c.ID_Caja === cajaIni) ? cajaIni : (opcCajas[0]?.ID_Caja || ''));
  sv('muestra-posicion', m?.Posicion || posicion || '');
  sv('muestra-num-tubos', 1);
  if (!m && !posicion) _congPrimeraLibre();

  document.getElementById('muestra-num-tubos-grupo').style.display = m ? 'none' : '';
  document.getElementById('muestra-cantidad-actual-grupo').style.display = 'none';
  const nLote = m ? _congTubosDelLote(m.ID_Lote).length : 0;
  const nota = document.getElementById('muestra-nota-lote');
  nota.style.display = nLote > 1 ? '' : 'none';
  nota.textContent = nLote > 1 ? `Este tubo es de un stock de ${nLote} tubos: nombre, tipo, formato, fechas y datos se cambian en los ${nLote}. La casilla y lo que queda, solo en este.` : '';

  _congPintarCamposTipo(m?.Datos || {});
  _congActualizarFormato();
  _congPrevisualizarCasillas();
  openModal('modal-muestra');
}

function _congCambiarTipo() {
  const t = _CONG_TIPOS[v('muestra-tipo')];
  if (t && !_congEditandoMuestra) sv('muestra-formato', t.formato);
  _congPintarCamposTipo({});
  _congActualizarFormato();
}

function _congPintarCamposTipo(datos) {
  const t = _CONG_TIPOS[v('muestra-tipo')] || { campos: [] };
  document.getElementById('muestra-nombre').placeholder = t.phNombre || '';
  document.getElementById('muestra-pase-grupo').style.display = t.pase ? '' : 'none';
  document.getElementById('muestra-caducidad-grupo').style.display = t.caducidad ? '' : 'none';
  document.getElementById('muestra-material-grupo').style.display = t.material ? '' : 'none';
  const aviso = document.getElementById('muestra-aviso-tipo');
  aviso.style.display = t.aviso ? '' : 'none';
  aviso.textContent = t.aviso || '';

  document.getElementById('muestra-campos-tipo').innerHTML = t.campos.map(c => {
    const id = 'muestra-dato-' + c.k;
    const val = datos[c.k] || '';
    let input;
    if (c.tipo === 'select') {
      const opts = [...c.opciones];
      const esOtro = val && !opts.includes(val);
      input = `<select id="${id}" onchange="_congOtro('${c.k}')">
          <option value="">—</option>
          ${opts.map(o => `<option value="${_congEsc(o)}" ${o === val ? 'selected' : ''}>${_congEsc(o)}</option>`).join('')}
          ${c.otro ? `<option value="__otro" ${esOtro ? 'selected' : ''}>Otro…</option>` : ''}
        </select>
        ${c.otro ? `<input type="text" id="${id}-otro" placeholder="Escríbelo" value="${esOtro ? _congEsc(val) : ''}" style="margin-top:6px;${esOtro ? '' : 'display:none'}">` : ''}`;
    } else {
      input = `<input type="${c.tipo === 'date' ? 'date' : 'text'}" id="${id}" value="${_congEsc(val)}" placeholder="${_congEsc(c.ph || '')}">`;
    }
    return `<div class="form-group"><label>${_congEsc(c.label)}</label>${input}</div>`;
  }).join('');
}

function _congOtro(k) {
  const otro = document.getElementById(`muestra-dato-${k}-otro`);
  if (otro) otro.style.display = v('muestra-dato-' + k) === '__otro' ? '' : 'none';
}

function _congActualizarFormato() {
  const formato = v('muestra-formato');
  const grupoCant = document.getElementById('muestra-cantidad-grupo');
  const lbl = document.getElementById('muestra-cantidad-label');
  const unidad = document.getElementById('muestra-unidad');
  grupoCant.style.display = formato === 'Tubo' ? 'none' : '';
  unidad.style.display = formato === 'Volumen' ? '' : 'none';
  lbl.textContent = formato === 'Bolitas' ? 'Bolitas por tubo *' : 'Volumen de cada tubo *';
  if (formato === 'Bolitas' && !v('muestra-cantidad') && !_congEditandoMuestra) sv('muestra-cantidad', 25);
  const grupoActual = document.getElementById('muestra-cantidad-actual-grupo');
  grupoActual.style.display = _congEditandoMuestra && formato !== 'Tubo' ? '' : 'none';
  setText('muestra-cantidad-actual-label', formato === 'Bolitas' ? 'Bolitas que quedan en este tubo' : 'Volumen que queda en este tubo');
}

/** Pone en «casilla» la primera libre de la caja elegida. */
function _congPrimeraLibre() {
  const caja = _congCaja(v('muestra-caja'));
  if (!caja) return;
  const libres = _congCasillasLibres(caja, '', 1);
  sv('muestra-posicion', libres ? libres[0] : '');
}

/**
 * `n` casillas libres seguidas (por filas: A1, A2… B1…) desde `desde` (incluida).
 * Devuelve null si no caben.
 */
function _congCasillasLibres(caja, desde, n, excluir = '') {
  const ocupadas = new Set(_congMuestrasDeCaja(caja.ID_Caja).filter(m => m.ID_Muestra !== excluir).map(m => m.Posicion));
  const ini = desde ? _congIndiceCasilla(desde, caja) : 0;
  if (ini < 0) return null;
  const res = [];
  for (let i = ini; i < caja.Filas * caja.Columnas && res.length < n; i++) {
    const pos = _congCasilla(Math.floor(i / caja.Columnas), i % caja.Columnas);
    if (!ocupadas.has(pos)) res.push(pos);
  }
  return res.length === n ? res : null;
}

function _congPrevisualizarCasillas() {
  const el = document.getElementById('muestra-casillas-preview');
  const caja = _congCaja(v('muestra-caja'));
  const pos = v('muestra-posicion').toUpperCase();
  const n = _congEditandoMuestra ? 1 : Math.max(1, parseInt(v('muestra-num-tubos'), 10) || 1);
  if (!caja) { el.textContent = ''; return null; }
  if (!pos) { el.innerHTML = `<span style="color:var(--danger)">Indica la casilla</span>`; return null; }
  if (_congIndiceCasilla(pos, caja) < 0) {
    el.innerHTML = `<span style="color:var(--danger)">${_congEsc(pos)} no existe en esta caja (va de A1 a ${_congCasilla(caja.Filas - 1, caja.Columnas - 1)})</span>`;
    return null;
  }
  const ocupante = _congMuestrasDeCaja(caja.ID_Caja).find(m => m.Posicion === pos && m.ID_Muestra !== _congEditandoMuestra);
  if (ocupante) {
    el.innerHTML = `<span style="color:var(--danger)">${_congEsc(pos)} está ocupada por ${_congEsc(ocupante.Nombre)}</span>`;
    return null;
  }
  const casillas = _congCasillasLibres(caja, pos, n, _congEditandoMuestra);
  if (!casillas) {
    el.innerHTML = `<span style="color:var(--danger)">No caben ${n} tubos desde ${_congEsc(pos)}: elige una casilla anterior u otra caja</span>`;
    return null;
  }
  el.innerHTML = n > 1 ? `Ocupará: <strong>${casillas.join(', ')}</strong>` : '';
  return casillas;
}

function _congLeerDatosTipo() {
  const t = _CONG_TIPOS[v('muestra-tipo')] || { campos: [] };
  const datos = {};
  t.campos.forEach(c => {
    let val = v('muestra-dato-' + c.k);
    if (val === '__otro') val = v(`muestra-dato-${c.k}-otro`);
    if (val) datos[c.k] = val;
  });
  return datos;
}

async function guardarMuestra() {
  const tipo = v('muestra-tipo');
  const t = _CONG_TIPOS[tipo];
  const formato = v('muestra-formato');
  const nombre = v('muestra-nombre');
  if (!nombre) { showToast('Ponle un nombre a la muestra', 'error'); return; }

  let idMaterial = '';
  if (t.material && v('muestra-material')) {
    const texto = v('muestra-material');
    const mat = DATA.material.find(x => texto.endsWith('· ' + x.ID_Material) || x.ID_Material === texto || x.Nombre === texto);
    if (!mat) { showToast('Elige el material de la lista (o deja el campo vacío)', 'error'); return; }
    idMaterial = mat.ID_Material;
  }

  const casillas = _congPrevisualizarCasillas();
  if (!casillas) { showToast('Revisa la casilla', 'error'); return; }

  const cantidad = v('muestra-cantidad').replace(',', '.');
  if (formato !== 'Tubo' && !(Number(cantidad) > 0)) {
    showToast(formato === 'Bolitas' ? 'Indica cuántas bolitas tiene cada tubo' : 'Indica el volumen de cada tubo', 'error');
    return;
  }

  const lote = {
    tipo, nombre, abreviatura: v('muestra-abreviatura'), formato,
    unidad: formato === 'Volumen' ? v('muestra-unidad') : '',
    pase: t.pase ? v('muestra-pase') : '',
    fecha_congelacion: v('muestra-fecha'),
    caducidad: t.caducidad ? v('muestra-caducidad') : '',
    id_material: idMaterial,
    datos: _congLeerDatosTipo(),
    observaciones: v('muestra-observaciones'),
  };

  let body;
  if (_congEditandoMuestra) {
    body = { accion: 'editar_muestra', id_muestra: _congEditandoMuestra, ...lote,
      id_caja: v('muestra-caja'), posicion: casillas[0] };
    if (formato !== 'Tubo') {
      const actual = v('muestra-cantidad-actual').replace(',', '.');
      body.cantidad_inicial = cantidad;
      body.cantidad_actual = actual === '' ? cantidad : actual;
      if (Number(body.cantidad_actual) > Number(cantidad)) { showToast('Lo que queda no puede ser más que lo inicial', 'error'); return; }
    }
  } else {
    body = { accion: 'crear_muestras', ...lote, cantidad_inicial: cantidad, id_caja: v('muestra-caja'), posiciones: casillas };
  }

  showLoading('Guardando…');
  try {
    const { muestras } = await callEdgeFunction('gestionar-congelados', body);
    (muestras || []).map(_muestraCongeladaSbToObj).forEach(obj => {
      const idx = DATA.muestrasCongeladas.findIndex(x => x.ID_Muestra === obj.ID_Muestra);
      if (idx >= 0) DATA.muestrasCongeladas[idx] = obj; else DATA.muestrasCongeladas.push(obj);
    });
    const primera = _congEditandoMuestra || muestras?.[0]?.id_muestra;
    const caja = _congCaja(v('muestra-caja'));
    if (caja) { _congCajaAbierta = caja.ID_Caja; if (_congFiltroEquipo && _congFiltroEquipo !== caja.ID_Equipo) _congFiltroEquipo = ''; }
    _congMuestraSel = primera || '';
    _congBusqueda = '';
    closeModal('modal-muestra');
    renderCongelados();
    showToast(_congEditandoMuestra ? 'Muestra actualizada'
      : (muestras.length > 1 ? `${muestras.length} tubos guardados` : 'Muestra guardada'), 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'No se pudo guardar la muestra', 'error');
  } finally { hideLoading(); }
}

// ── Descartar ────────────────────────────────────────────────

function openModalDescartarMuestra(idMuestra) {
  const m = _congMuestra(idMuestra);
  if (!m || !_congPuedeGestionar()) return;
  _congDescartando = idMuestra;
  const n = _congTubosDelLote(m.ID_Lote).length;
  setText('descartar-muestra-titulo', `${m.Nombre} · ${m.Posicion}`);
  sv('descartar-muestra-motivo', '');
  sv('descartar-muestra-otro', '');
  document.getElementById('descartar-muestra-otro').style.display = 'none';
  const chk = document.getElementById('descartar-muestra-lote');
  chk.checked = false;
  document.getElementById('descartar-muestra-lote-grupo').style.display = n > 1 ? '' : 'none';
  setText('descartar-muestra-lote-texto', `Descartar los ${n} tubos de este stock`);
  openModal('modal-descartar-muestra');
}

async function confirmarDescartarMuestra() {
  let motivo = v('descartar-muestra-motivo');
  if (motivo === 'Otro') motivo = v('descartar-muestra-otro');
  if (!motivo) { showToast('Indica el motivo', 'error'); return; }
  const todo = document.getElementById('descartar-muestra-lote').checked;
  showLoading('Descartando…');
  try {
    const { muestras } = await callEdgeFunction('gestionar-congelados',
      { accion: 'descartar_muestra', id_muestra: _congDescartando, motivo, todo_el_lote: todo });
    (muestras || []).map(_muestraCongeladaSbToObj).forEach(obj => {
      const idx = DATA.muestrasCongeladas.findIndex(x => x.ID_Muestra === obj.ID_Muestra);
      if (idx >= 0) DATA.muestrasCongeladas[idx] = obj;
    });
    _congMuestraSel = '';
    closeModal('modal-descartar-muestra');
    renderCongelados();
    showToast(muestras.length > 1 ? `${muestras.length} tubos descartados` : 'Tubo descartado', 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'No se pudo descartar', 'error');
  } finally { hideLoading(); }
}
