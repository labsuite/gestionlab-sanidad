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
// Cajas y muestras (alta, edición, stock nuevo, descarte): profesorado
// (Admin/Gestor/Profesor). Apuntar un uso (botón «Usar») y deshacerlo en los 15
// minutos siguientes: cualquiera, también el alumnado (firma el grupo).
//
// Etiquetas NFC/QR: una por caja (abre la caja) y una por congelador (abre sus
// cajas). URL con urlEtiqueta() — nunca window.location (ver CLAUDE.md).

let _congFiltroEquipo = '';
let _congCajaAbierta = '';
let _congVerRetiradas = false;
let _congEditandoCaja = '';
let _congMuestraSel = '';
let _congBusqueda = '';
let _congEditandoMuestra = '';
let _congDescartando = '';
let _congOrigenStock = '';       // tubo del que se hace un stock nuevo (modal de muestra)
let _congUsando = '';            // tubo del modal «Usar»
let _congHistorialCompleto = false;
const _congMisUsos = {};         // id_uso → ms: usos apuntados desde esta pestaña (para «Deshacer»)
const _CONG_MIN_DESHACER = 15;

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
  'Suero o plasma': {
    icono: '🩸', clase: 'suero', formato: 'Volumen', pase: false, caducidad: true,
    phNombre: 'ej. Suero control normal',
    aviso: 'Sin datos de pacientes: ni nombres ni números de historia. Si procede de una persona, solo «suero de donante anónimo».',
    campos: [
      { k: 'contenido', label: 'Qué es', tipo: 'select', otro: true,
        opciones: ['Suero control', 'Plasma control', 'Suero de donante anónimo', 'Suero animal'] },
      { k: 'procedencia', label: 'Procedencia', tipo: 'select', otro: true, opciones: ['Comercial', 'Preparado en el laboratorio'] },
    ],
  },
  'Reactivo': {
    icono: '🧪', clase: 'kit', formato: 'Volumen', pase: false, caducidad: true, material: true,
    phNombre: 'ej. Master mix PCR 2×, ampicilina 100 mg/mL, FBS',
    campos: [
      { k: 'contenido', label: 'Qué es', tipo: 'select', otro: true,
        opciones: ['Master mix', 'Enzima', 'Cebadores', 'Antibiótico', 'Suero fetal bovino (FBS)', 'Suplemento de medio', 'Componente de kit'] },
      { k: 'concentracion', label: 'Concentración', ph: 'ej. 2×, 100 mg/mL, 10 µM' },
      { k: 'lote_comercial', label: 'Lote del fabricante', ph: 'ej. 2405-118' },
    ],
  },
};
const _CONG_FORMATOS = {
  Bolitas: 'Bolitas — cada uso saca una bolita',
  Tubo: 'Tubo o vial de un solo uso',
  Volumen: 'Volumen — se descongela y se va gastando',
};

/**
 * Cómo se usa cada cosa. Se enseña en «Usar» (antes de confirmar), en la ficha
 * del tubo y, el resumen, en el alta bajo el formato. Se combinan las del
 * FORMATO con las del TIPO (y con el grupo de riesgo de las cepas).
 * Redactadas a partir de la práctica habitual: la usuaria puede corregirlas.
 */
const _CONG_INSTRUCCIONES = {
  formato: {
    Bolitas: {
      resumen: 'Se saca una sola bolita cada vez y el tubo no debe llegar a descongelarse.',
      pasos: [
        'Lleva el criovial al puesto en <b>frío</b> (bloque refrigerante, gradilla congelada o hielo) y trabaja rápido.',
        'Saca <b>una sola bolita</b> con asa o pinza estéril, sin tocar las demás.',
        'El tubo <b>no debe descongelarse</b>: no lo calientes con la mano ni lo dejes en la mesa.',
        'Ciérralo y devuélvelo a su casilla <b>enseguida</b> (1–2 minutos fuera como máximo).',
        'Siembra la bolita directamente en la placa o échala en caldo.',
      ],
    },
    Tubo: {
      resumen: 'Se usa entero una sola vez: lo que sobre no se vuelve a congelar.',
      pasos: [
        'El tubo se usa <b>una sola vez</b>: lo que sobre <b>no se vuelve a congelar</b>.',
        'Sácalo solo cuando vayas a usarlo, y comprueba en la etiqueta que es el que buscas antes de abrirlo.',
      ],
    },
    Volumen: {
      resumen: 'Se descongela en hielo, se toma lo justo y vuelve al congelador cuanto antes.',
      pasos: [
        'Descongélalo <b>en hielo</b>, nunca a temperatura ambiente ni con la mano.',
        'Trabaja <b>todo el rato en hielo</b>.',
        'Mézclalo suavemente (pipeteando o con golpecitos) y dale un pulso de centrífuga para bajar las gotas.',
        'Toma <b>solo lo que necesites</b> con punta estéril nueva; nunca devuelvas lo que sobre al tubo.',
        'Vuelve a congelarlo <b>cuanto antes</b>: cada descongelación lo estropea un poco. Si se usa mucho, avisa al profesorado para hacer alícuotas más pequeñas.',
      ],
    },
  },
  tipo: {
    'Cepa': [
      'Trabaja junto al mechero o en la cabina, con técnica aséptica.',
    ],
    'Línea celular': [
      'Ten preparado el medio completo precalentado <b>antes</b> de sacar el vial.',
      'Descongélalo <b>rápido a 37 °C</b> (baño, 1–2 minutos) hasta que quede un cristalito de hielo.',
      'Desinfecta el exterior con etanol 70 % y ábrelo en la cabina de bioseguridad.',
      'Pásalo al medio y centrifuga para quitar el DMSO del medio de congelación.',
      'Un vial de células descongelado <b>no se puede volver a congelar</b>.',
    ],
    'Ácido nucleico': [
      'El ARN se degrada muy deprisa: guantes, material libre de RNasas y siempre en hielo.',
    ],
    'Suero o plasma': [
      'Trátalo como <b>potencialmente infeccioso</b>: guantes y gafas.',
      'Mézclalo por inversión suave, sin hacer espuma.',
    ],
    'Reactivo': [
      'Las enzimas y la master mix van en glicerol y no se congelan del todo: no hace falta esperar a que se descongelen, sácalas solo lo justo y devuélvelas.',
      'Sigue también las instrucciones del fabricante.',
    ],
  },
  riesgo: {
    '2': 'Grupo de riesgo 2: trabaja en la <b>cabina de bioseguridad</b>.',
    '3': 'Grupo de riesgo 3: solo con autorización del profesorado y en la cabina de bioseguridad.',
  },
};

/** Lista de pasos (HTML) para un tubo, o para tipo+formato si aún no existe. */
function _congPasosUso(tipo, formato, datos = {}) {
  const pasos = [];
  const riesgo = _CONG_INSTRUCCIONES.riesgo[datos.grupo_riesgo];
  if (tipo === 'Cepa' && riesgo) pasos.push('⚠️ ' + riesgo);
  // En las líneas celulares de un solo uso, los pasos del tipo ya cubren el uso del vial
  pasos.push(...(_CONG_INSTRUCCIONES.formato[formato]?.pasos || []));
  pasos.push(...(_CONG_INSTRUCCIONES.tipo[tipo] || []));
  return pasos;
}

function _congRenderPasos(tipo, formato, datos, abierto) {
  const pasos = _congPasosUso(tipo, formato, datos);
  if (!pasos.length) return '';
  const lista = `<ul class="cong-pasos">${pasos.map(p => `<li>${p}</li>`).join('')}</ul>`;
  return abierto
    ? `<div class="cong-instrucciones"><div class="cong-instrucciones-tit">📋 Cómo se usa</div>${lista}</div>`
    : `<details class="cong-instrucciones"><summary class="cong-instrucciones-tit">📋 Cómo se usa</summary>${lista}</details>`;
}

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
function _congUsosDelLote(idLote) {
  return (DATA.usosMuestra || []).filter(u => u.ID_Lote === idLote)
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''));
}
function _congFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
/** Recarga desde Supabase los usos de unos lotes (tras acciones que los escriben en el servidor). */
async function _congRecargarUsos(idLotes) {
  const lotes = [...new Set(idLotes.filter(Boolean))];
  if (!lotes.length) return;
  try {
    const { data, error } = await _sbMigracion.from('usos_muestra').select('*').in('id_lote', lotes);
    if (error) throw error;
    DATA.usosMuestra = (DATA.usosMuestra || []).filter(u => !lotes.includes(u.ID_Lote)).concat((data || []).map(_usoMuestraSbToObj));
  } catch (e) { console.warn('No se pudo recargar el historial de usos', e); }
}
function _congUpsertMuestras(filas) {
  (filas || []).map(_muestraCongeladaSbToObj).forEach(obj => {
    const idx = DATA.muestrasCongeladas.findIndex(x => x.ID_Muestra === obj.ID_Muestra);
    if (idx >= 0) DATA.muestrasCongeladas[idx] = obj; else DATA.muestrasCongeladas.push(obj);
  });
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
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px">
        <div style="font-weight:700;font-size:15px;flex:1">🧊 ${_congEsc(_congNombreEquipo(equipo.ID_Activo))}</div>
        ${gestiona ? `<button class="btn btn-secondary btn-sm" title="Etiqueta NFC/QR para la puerta del congelador" onclick="openModalEtiquetaCongelado('congelador','${_congEsc(equipo.ID_Activo)}')">🔗 Etiqueta</button>` : ''}
      </div>
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
          <button class="btn btn-secondary btn-sm" onclick="openModalEtiquetaCongelado('caja','${_congEsc(c.ID_Caja)}')">🔗 Etiqueta</button>
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

  const arbol = _congRenderArbol(m);
  if (arbol) add('Procedencia', arbol);

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
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-primary" onclick="openModalUsarMuestra('${m.ID_Muestra}')">${_congTextoUsar(m)}</button>
      </div>
      ${_congRenderDeshacer(m)}
      ${_congRenderPasos(m.Tipo, m.Formato, m.Datos || {}, false)}
      <div class="cong-ficha-grid">${filas.join('')}</div>
      ${gestiona ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
        ${t.pase || m.Tipo === 'Cepa' || m.Tipo === 'Línea celular' ? `<button class="btn btn-secondary btn-sm" onclick="openModalMuestra('', '', '', '${m.ID_Muestra}')">🌱 Nuevo stock a partir de este</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="openModalMuestra('${m.ID_Muestra}')">✏️ Editar</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalDescartarMuestra('${m.ID_Muestra}')">🗑️ Descartar</button>
      </div>` : ''}
      ${_congRenderHistorial(m)}
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
function openModalMuestra(idMuestra = '', idCaja = '', posicion = '', idOrigen = '') {
  if (!_congPuedeGestionar()) return;
  const m = idMuestra ? _congMuestra(idMuestra) : null;
  _congEditandoMuestra = m ? m.ID_Muestra : '';
  // Stock nuevo: se rellena con los datos del tubo de origen y el pase siguiente
  const origen = !m && idOrigen ? _congMuestra(idOrigen) : null;
  _congOrigenStock = origen ? origen.ID_Muestra : '';
  const base = m || origen;
  const cajas = _congCajasActivas();
  if (!m && !cajas.length) { showToast('Primero crea una caja donde guardar la muestra', 'error'); return; }

  setText('modal-muestra-title', m ? `✏️ Editar ${m.Nombre} (${m.Posicion})`
    : origen ? `🌱 Nuevo stock de ${origen.Nombre}` : '🧊 Nueva muestra');
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

  const tipo = base?.Tipo || 'Cepa';
  sv('muestra-tipo', tipo);
  sv('muestra-nombre', base?.Nombre || '');
  sv('muestra-abreviatura', base?.Abreviatura || '');
  sv('muestra-formato', base?.Formato || _CONG_TIPOS[tipo].formato);
  sv('muestra-unidad', base?.Formato === 'Volumen' ? (base.Unidad || 'µL') : 'µL');
  sv('muestra-cantidad', base ? (base.Cantidad_Inicial ?? '') : '');
  sv('muestra-cantidad-actual', m ? (m.Cantidad_Actual ?? '') : '');
  sv('muestra-pase', origen ? (origen.Pase != null ? origen.Pase + 1 : '') : (m?.Pase ?? ''));
  sv('muestra-fecha', m ? (m.Fecha_Congelacion || '') : new Date().toISOString().slice(0, 10));
  sv('muestra-caducidad', m?.Caducidad || '');
  sv('muestra-observaciones', m?.Observaciones || '');
  const mat = base?.ID_Material ? DATA.material.find(x => x.ID_Material === base.ID_Material) : null;
  sv('muestra-material', mat ? `${mat.Nombre} · ${mat.ID_Material}` : (base?.ID_Material || ''));

  // Bloque «a partir de»: lo que se gasta del tubo de origen
  const bloqueOrigen = document.getElementById('muestra-origen');
  bloqueOrigen.style.display = origen ? '' : 'none';
  if (origen) {
    setText('muestra-origen-texto', `A partir de ${origen.Nombre} (${origen.Posicion}${origen.Pase != null ? ', pase ' + origen.Pase : ''}). `
      + (origen.Formato === 'Bolitas' ? 'Se gastará 1 bolita del tubo de origen.'
        : origen.Formato === 'Tubo' ? 'El tubo de origen se gasta entero y sale de la caja.'
        : 'Indica cuánto has gastado del tubo de origen:'));
    document.getElementById('muestra-origen-cantidad-grupo').style.display = origen.Formato === 'Volumen' ? '' : 'none';
    sv('muestra-origen-cantidad', '');
    setText('muestra-origen-unidad', origen.Unidad || '');
  }

  const cajaIni = m?.ID_Caja || idCaja || origen?.ID_Caja || _congCajaAbierta || cajas[0]?.ID_Caja || '';
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

  _congPintarCamposTipo(base?.Datos || {});
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
  setText('muestra-formato-ayuda', _CONG_INSTRUCCIONES.formato[formato]?.resumen || '');
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
    if (_congOrigenStock) {
      const origen = _congMuestra(_congOrigenStock);
      body.id_muestra_origen = _congOrigenStock;
      if (origen?.Formato === 'Volumen') {
        body.cantidad_origen = v('muestra-origen-cantidad').replace(',', '.');
        if (!(Number(body.cantidad_origen) > 0)) { showToast('Indica cuánto has gastado del tubo de origen', 'error'); return; }
        if (Number(body.cantidad_origen) > Number(origen.Cantidad_Actual)) { showToast(`En el tubo de origen solo quedan ${_congCantidadTexto(origen)}`, 'error'); return; }
      }
    }
  }

  showLoading('Guardando…');
  try {
    const { muestras } = await callEdgeFunction('gestionar-congelados', body);
    _congUpsertMuestras(muestras);
    await _congRecargarUsos((muestras || []).map(x => x.id_lote));
    const nuevos = (muestras || []).filter(x => x.id_muestra !== _congOrigenStock);
    const primera = _congEditandoMuestra || nuevos[0]?.id_muestra;
    const caja = _congCaja(v('muestra-caja'));
    if (caja) { _congCajaAbierta = caja.ID_Caja; if (_congFiltroEquipo && _congFiltroEquipo !== caja.ID_Equipo) _congFiltroEquipo = ''; }
    _congMuestraSel = primera || '';
    _congBusqueda = '';
    closeModal('modal-muestra');
    renderCongelados();
    showToast(_congEditandoMuestra ? 'Muestra actualizada'
      : (nuevos.length > 1 ? `${nuevos.length} tubos guardados` : 'Muestra guardada'), 'success');
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
    _congUpsertMuestras(muestras);
    await _congRecargarUsos((muestras || []).map(x => x.id_lote));
    _congMuestraSel = '';
    closeModal('modal-descartar-muestra');
    renderCongelados();
    showToast(muestras.length > 1 ? `${muestras.length} tubos descartados` : 'Tubo descartado', 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'No se pudo descartar', 'error');
  } finally { hideLoading(); }
}

// ── Usar un tubo ─────────────────────────────────────────────

function _congTextoUsar(m) {
  if (m.Formato === 'Bolitas') return '🧊 Usar · sacar 1 bolita';
  if (m.Formato === 'Tubo') return '🧊 Usar este tubo';
  return '🧊 Usar · apuntar lo gastado';
}

function openModalUsarMuestra(idMuestra) {
  const m = _congMuestra(idMuestra);
  if (!m || m.Estado !== 'Disponible') return;
  _congUsando = idMuestra;
  setText('usar-muestra-titulo', `${(_CONG_TIPOS[m.Tipo] || {}).icono || '🧊'} ${m.Nombre} · ${m.Posicion}`);
  let explica;
  if (m.Formato === 'Bolitas') {
    const quedan = Math.max(0, (m.Cantidad_Actual || 0) - 1);
    explica = `Se saca 1 bolita: quedarán ${_congNum(quedan)} en el tubo.` + (quedan === 0 ? ' Era la última: el tubo sale de la caja.' : '');
  } else if (m.Formato === 'Tubo') {
    explica = 'El tubo se gasta entero: sale de la caja y la casilla queda libre.';
  } else {
    explica = `Quedan ${_congCantidadTexto(m)} · ${m.Descongelaciones || 0} descongelaciones. Se sumará una descongelación.`;
  }
  setText('usar-muestra-explica', explica);
  document.getElementById('usar-muestra-pasos').innerHTML = _congRenderPasos(m.Tipo, m.Formato, m.Datos || {}, true);
  document.getElementById('usar-muestra-cantidad-grupo').style.display = m.Formato === 'Volumen' ? '' : 'none';
  setText('usar-muestra-unidad', m.Unidad || '');
  sv('usar-muestra-cantidad', '');
  sv('usar-muestra-motivo', '');
  sv('usar-muestra-otro', '');
  document.getElementById('usar-muestra-otro').style.display = 'none';
  openModal('modal-usar-muestra');
  if (m.Formato === 'Volumen') setTimeout(() => document.getElementById('usar-muestra-cantidad')?.focus(), 80);
}

async function confirmarUsarMuestra() {
  const m = _congMuestra(_congUsando);
  if (!m) return;
  let motivo = v('usar-muestra-motivo');
  if (motivo === 'Otro') motivo = v('usar-muestra-otro');
  if (!motivo) { showToast('Indica para qué lo usas', 'error'); return; }
  const body = { accion: 'usar_muestra', id_muestra: m.ID_Muestra, motivo };
  if (m.Formato === 'Volumen') {
    body.cantidad = v('usar-muestra-cantidad').replace(',', '.');
    if (!(Number(body.cantidad) > 0)) { showToast('Indica cuánto has gastado', 'error'); return; }
    if (Number(body.cantidad) > Number(m.Cantidad_Actual)) { showToast(`Solo quedan ${_congCantidadTexto(m)}`, 'error'); return; }
  }
  showLoading('Apuntando…');
  try {
    const { muestra, uso } = await callEdgeFunction('gestionar-congelados', body);
    _congUpsertMuestras([muestra]);
    if (uso) {
      DATA.usosMuestra.push(_usoMuestraSbToObj(uso));
      _congMisUsos[uso.id_uso] = Date.now();
    }
    if (muestra.estado !== 'Disponible') _congMuestraSel = '';
    closeModal('modal-usar-muestra');
    renderCongelados();
    const obj = _muestraCongeladaSbToObj(muestra);
    const msg = obj.Estado !== 'Disponible' ? 'Uso apuntado · el tubo sale de la caja'
      : `Uso apuntado · quedan ${_congCantidadTexto(obj)}`;
    if (uso) mostrarToastConAccion(msg, '↩︎ Deshacer', `() => _congDeshacerUso('${uso.id_uso}')`, 8000);
    else showToast(msg, 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'No se pudo apuntar el uso', 'error');
  } finally { hideLoading(); }
}

/** Aviso con «Deshacer» en la ficha si el último uso del tubo lo apuntó esta pestaña hace poco. */
function _congRenderDeshacer(m) {
  const ultimo = (DATA.usosMuestra || []).filter(u => u.ID_Muestra === m.ID_Muestra)
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''))[0];
  if (!ultimo || ultimo.Evento !== 'Uso' || !_congMisUsos[ultimo.ID_Uso]) return '';
  if (Date.now() - _congMisUsos[ultimo.ID_Uso] > _CONG_MIN_DESHACER * 60000) return '';
  return `<div class="cong-aviso-deshacer">✓ Has apuntado un uso (${_congEsc(ultimo.Motivo)}).
    <button class="btn btn-secondary btn-sm" onclick="_congDeshacerUso('${ultimo.ID_Uso}')">↩︎ Deshacer</button></div>`;
}

async function _congDeshacerUso(idUso) {
  showLoading('Deshaciendo…');
  try {
    const { muestra } = await callEdgeFunction('gestionar-congelados', { accion: 'deshacer_uso', id_uso: idUso });
    _congUpsertMuestras([muestra]);
    DATA.usosMuestra = DATA.usosMuestra.filter(u => u.ID_Uso !== idUso);
    delete _congMisUsos[idUso];
    _congCajaAbierta = muestra.id_caja;
    _congMuestraSel = muestra.id_muestra;
    renderCongelados();
    showToast('Uso deshecho', 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'No se pudo deshacer', 'error');
  } finally { hideLoading(); }
}

// ── Historial y árbol de pases ───────────────────────────────

function _congRenderHistorial(m) {
  const usos = _congUsosDelLote(m.ID_Lote);
  const nTubos = new Set((DATA.muestrasCongeladas || []).filter(x => x.ID_Lote === m.ID_Lote).map(x => x.ID_Muestra)).size;
  if (!usos.length) {
    return `<div class="cong-historial"><div class="cong-historial-tit">Historial</div>
      <div style="font-size:12px;color:var(--text-muted)">Todavía no se ha usado${nTubos > 1 ? ' ningún tubo de este stock' : ''}.</div></div>`;
  }
  const iconos = { 'Uso': '🧊', 'Nuevo stock': '🌱', 'Descarte': '🗑️', 'Ajuste': '✏️' };
  const visibles = _congHistorialCompleto ? usos : usos.slice(0, 8);
  const filas = visibles.map(u => {
    const tubo = _congMuestra(u.ID_Muestra);
    const gasto = u.Evento === 'Uso' || u.Evento === 'Nuevo stock'
      ? (u.Cantidad != null ? `−${_congNum(u.Cantidad)} ${u.Unidad === 'tubo' ? 'tubo' : (u.Unidad || '')}`.trim() : '')
      : '';
    const queda = u.Restante != null && u.Unidad !== 'tubo' ? `quedan ${_congNum(u.Restante)} ${u.Unidad || ''}`.trim() : '';
    return `<div class="cong-uso">
      <div class="cong-uso-fecha">${_congEsc(_congFechaHora(u.Fecha))}</div>
      <div style="flex:1;min-width:0">
        <div>${iconos[u.Evento] || '·'} ${_congEsc(u.Motivo || u.Evento)}${nTubos > 1 && tubo ? ` <span class="cong-pos">${_congEsc(tubo.Posicion)}</span>` : ''}</div>
        <div style="font-size:11px;color:var(--text-soft)">${[u.Autor, gasto, queda].filter(Boolean).map(_congEsc).join(' · ')}</div>
      </div>
    </div>`;
  }).join('');
  const mas = usos.length > 8
    ? `<button class="cong-link" style="margin-top:6px" onclick="_congHistorialCompleto=!_congHistorialCompleto;renderCongelados()">${_congHistorialCompleto ? 'Ver menos' : `Ver los ${usos.length}`}</button>`
    : '';
  return `<div class="cong-historial"><div class="cong-historial-tit">Historial${nTubos > 1 ? ' del stock' : ''}</div>${filas}${mas}</div>`;
}

/** Lote → datos para mostrarlo: nombre, pase y un tubo que siga en una caja. */
function _congInfoLote(idLote) {
  const tubos = (DATA.muestrasCongeladas || []).filter(x => x.ID_Lote === idLote);
  if (!tubos.length) return null;
  const vivo = tubos.find(x => x.Estado === 'Disponible');
  return { nombre: tubos[0].Nombre, pase: tubos[0].Pase, origen: tubos[0].ID_Lote_Origen, vivo, n: tubos.filter(x => x.Estado === 'Disponible').length };
}

function _congEnlaceLote(idLote) {
  const info = _congInfoLote(idLote);
  if (!info) return '<span style="color:var(--text-muted)">stock borrado</span>';
  const txt = `${info.pase != null ? 'pase ' + info.pase : info.nombre}${info.n ? '' : ' (agotado)'}`;
  return info.vivo
    ? `<button class="cong-link" onclick="_congIrA('${info.vivo.ID_Muestra}')">${_congEsc(txt)}</button>`
    : `<span class="cong-link" style="cursor:default;opacity:.7">${_congEsc(txt)}</span>`;
}

/** «Procede de pase 2 ← pase 1» y «Stocks hechos a partir de este: pase 4». */
function _congRenderArbol(m) {
  const partes = [];
  const cadena = [];
  let actual = m.ID_Lote_Origen;
  const vistos = new Set([m.ID_Lote]);
  while (actual && !vistos.has(actual) && cadena.length < 10) {
    vistos.add(actual);
    cadena.push(actual);
    actual = _congInfoLote(actual)?.origen;
  }
  if (cadena.length) partes.push('Procede de ' + cadena.map(_congEnlaceLote).join(' ← '));
  const hijos = [...new Set((DATA.muestrasCongeladas || []).filter(x => x.ID_Lote_Origen === m.ID_Lote).map(x => x.ID_Lote))];
  if (hijos.length) partes.push('Stocks hechos a partir de este: ' + hijos.map(_congEnlaceLote).join(' '));
  return partes.join('<br>');
}

// ── Etiquetas NFC / QR ───────────────────────────────────────

function _congUrlEtiqueta(tipo, id) {
  return urlEtiqueta(tipo === 'caja' ? { action: 'congelados', caja: id } : { action: 'congelados', congelador: id });
}

function openModalEtiquetaCongelado(tipo, id) {
  const caja = tipo === 'caja' ? _congCaja(id) : null;
  const titulo = caja ? `📦 ${caja.Nombre} · ${_congNombreEquipo(caja.ID_Equipo, false)}` : `🧊 ${_congNombreEquipo(id)}`;
  const url = _congUrlEtiqueta(tipo, id);
  setText('etiqueta-cong-titulo', titulo);
  setText('etiqueta-cong-url', url);
  setText('etiqueta-cong-explica', caja
    ? 'Al escanearla se abre esta caja con su cuadrícula: se toca el tubo y se pulsa «Usar».'
    : 'Al escanearla se abren las cajas de este congelador, sin tener que abrir la puerta para buscar.');
  setText('etiqueta-cong-consejo', caja
    ? 'Caja a −20 °C: una etiqueta NFC adhesiva en la tapa suele aguantar. A −80 °C o en nitrógeno, mejor el QR impreso en etiqueta criogénica.'
    : 'La puerta es metálica: usa una etiqueta NFC «anti-metal» (on-metal) por fuera, o el QR.');
  const img = document.getElementById('etiqueta-cong-qr');
  img.style.display = '';
  img.src = '';
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(url)}`;
  document.getElementById('modal-etiqueta-congelado').dataset.titulo = caja ? caja.Nombre : _congNombreEquipo(id, false);
  openModal('modal-etiqueta-congelado');
}

async function copiarUrlEtiquetaCongelado() {
  const url = document.getElementById('etiqueta-cong-url').textContent;
  try { await navigator.clipboard.writeText(url); showToast('URL copiada ✓', 'success'); }
  catch { showToast('No se pudo copiar: selecciona la URL y cópiala a mano', 'error'); }
}

/** Abre una hoja con el QR y el nombre, lista para imprimir en una etiqueta. */
function imprimirEtiquetaCongelado() {
  const modal = document.getElementById('modal-etiqueta-congelado');
  const titulo = modal.dataset.titulo || '';
  const qr = document.getElementById('etiqueta-cong-qr').src;
  const w = window.open('', '_blank');
  if (!w) { showToast('El navegador ha bloqueado la ventana de impresión', 'error'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta ${_congEsc(titulo)}</title>
    <style>body{font-family:sans-serif;margin:16px}.et{display:inline-flex;flex-direction:column;align-items:center;border:1px dashed #999;padding:8px 10px}
    .et img{width:30mm;height:30mm}.et div{font-size:10pt;font-weight:bold;margin-top:4px;max-width:40mm;text-align:center}
    @media print{.no{display:none}}</style></head><body>
    <p class="no" style="font-size:12px;color:#555">Recorta la etiqueta (30 mm de QR). Para −80 °C usa papel de etiqueta criogénica.</p>
    <div class="et"><img src="${qr}" alt="QR"><div>${_congEsc(titulo)}</div></div>
    <script>document.querySelector('img').onload = () => setTimeout(() => print(), 200);<\/script></body></html>`);
  w.document.close();
}

/** Entrada desde una etiqueta (?action=congelados&caja=… o &congelador=…). */
function _abrirCongeladosPorNfc(idCaja, idCongelador) {
  _congBusqueda = '';
  _congMuestraSel = '';
  if (idCaja) {
    const caja = _congCaja(idCaja);
    if (!caja) { showPage('congelados'); showToast('Esa caja ya no existe en la app', 'error'); return; }
    _congFiltroEquipo = caja.ID_Equipo;
    _congCajaAbierta = idCaja;
    if (!caja.Activa) _congVerRetiradas = true;
  } else if (idCongelador) {
    _congFiltroEquipo = idCongelador;
    _congCajaAbierta = '';
  }
  showPage('congelados');
  renderCongelados();
}
