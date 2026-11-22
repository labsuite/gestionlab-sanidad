// ============================================================
// MUESTRAS CONGELADAS — congelador → caja → casilla
// ============================================================
// Ver docs/modulo-congelados.md. Parte 1: cajas y su cuadrícula. Los
// congeladores no son una tabla propia: son equipos del inventario (congelador,
// frigorífico con congelador, tanque de N₂…). Cada caja tiene filas × columnas
// y las casillas se nombran como en las cajas de crioviales: A1, A2… B1…
//
// Crear, editar y retirar cajas: profesorado (Admin/Gestor/Profesor).
// El alumnado solo consulta.

let _congFiltroEquipo = '';
let _congCajaAbierta = '';
let _congVerRetiradas = false;
let _congEditandoCaja = '';

const _CONG_RE_EQUIPO = /congel|frigor|nevera|nitr[oó]geno|dewar|crioconserv/i;

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

/** Muestras que ocupan casillas de una caja (se rellenan en la parte 2). */
function _congMuestrasDeCaja(idCaja) {
  return (DATA.muestrasCongeladas || []).filter(m => m.ID_Caja === idCaja && m.Estado !== 'Agotada' && m.Estado !== 'Descartada');
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
      <select class="filter" onchange="_congFiltroEquipo=this.value;renderCongelados()" style="max-width:100%">
        <option value="">Todos los congeladores</option>${opcionesEquipo}
      </select>
      ${gestiona ? `<label style="font-size:12px;color:var(--text-soft);display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" ${_congVerRetiradas ? 'checked' : ''} onchange="_congVerRetiradas=this.checked;renderCongelados()"> Ver cajas retiradas</label>` : ''}
      ${gestiona ? `<button class="btn btn-primary" style="margin-left:auto" onclick="openModalCaja()">+ Nueva caja</button>` : ''}
    </div>`;

  if (!equipos.length) {
    el.innerHTML = toolbar + `<div class="empty-state"><div class="empty-state-icon">🧊</div>
      <div class="empty-state-title">No hay ningún congelador en el inventario de equipos</div>
      <div style="font-size:13px;color:var(--text-muted)">Da de alta el congelador (o el tanque de nitrógeno) en Equipos → Inventario para poder colocar cajas en él.</div></div>`;
    return;
  }

  const equiposVista = _congFiltroEquipo ? equipos.filter(e => e.ID_Activo === _congFiltroEquipo) : equipos;
  const conCajas = equiposVista.filter(e => cajas.some(c => c.ID_Equipo === e.ID_Activo));
  const sinCajas = equiposVista.filter(e => !cajas.some(c => c.ID_Equipo === e.ID_Activo));

  let cuerpo = conCajas.map(e => _congRenderEquipo(e, cajas.filter(c => c.ID_Equipo === e.ID_Activo), gestiona)).join('');

  if (!conCajas.length) {
    cuerpo = `<div class="empty-state"><div class="empty-state-icon">📦</div>
      <div class="empty-state-title">Todavía no hay cajas${_congFiltroEquipo ? ' en este congelador' : ''}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Cada caja se coloca en un congelador y tiene su cuadrícula de casillas (A1, B3…) donde irán las muestras.</div>
      ${gestiona ? `<button class="btn btn-primary" onclick="openModalCaja()">+ Nueva caja</button>` : ''}</div>`;
  }
  if (sinCajas.length && conCajas.length) {
    cuerpo += `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Sin cajas: ${sinCajas.map(e => _congEsc(_congNombreEquipo(e.ID_Activo))).join(' · ')}</div>`;
  }

  el.innerHTML = toolbar + cuerpo;
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
  renderCongelados();
}

function _congRenderCaja(c, gestiona) {
  const muestras = _congMuestrasDeCaja(c.ID_Caja);
  const porCasilla = {};
  muestras.forEach(m => { (porCasilla[m.Posicion] = porCasilla[m.Posicion] || []).push(m); });

  let celdas = `<div class="cong-cab"></div>`;
  for (let col = 0; col < c.Columnas; col++) celdas += `<div class="cong-cab">${col + 1}</div>`;
  for (let f = 0; f < c.Filas; f++) {
    celdas += `<div class="cong-cab">${String.fromCharCode(65 + f)}</div>`;
    for (let col = 0; col < c.Columnas; col++) {
      const pos = _congCasilla(f, col);
      const enCasilla = porCasilla[pos] || [];
      celdas += enCasilla.length
        ? `<div class="cong-celda ocupada" title="${_congEsc(pos + ' · ' + enCasilla.map(m => m.Nombre).join(', '))}">${_congEsc((enCasilla[0].Abreviatura || enCasilla[0].Nombre || '').slice(0, 4))}</div>`
        : `<div class="cong-celda" title="${pos} · libre"></div>`;
    }
  }

  const total = c.Filas * c.Columnas;
  const libres = total - Object.keys(porCasilla).length;
  return `
    <div class="cong-caja-detalle">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;font-size:14px">📦 ${_congEsc(c.Nombre)}</div>
          <div style="font-size:12px;color:var(--text-soft)">${[c.Compartimento, `${c.Filas} filas × ${c.Columnas} columnas`, `${libres} casillas libres`].filter(Boolean).map(_congEsc).join(' · ')}</div>
          ${c.Descripcion ? `<div style="font-size:12px;color:var(--text-soft);margin-top:4px">${_congEsc(c.Descripcion)}</div>` : ''}
        </div>
        ${gestiona ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openModalCaja('${_congEsc(c.ID_Caja)}')">✏️ Editar</button>
          ${c.Activa
            ? `<button class="btn btn-secondary btn-sm" onclick="_congRetirarCaja('${_congEsc(c.ID_Caja)}', false)">Retirar</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="_congRetirarCaja('${_congEsc(c.ID_Caja)}', true)">↩︎ Reactivar</button>`}
        </div>` : ''}
      </div>
      <div class="cong-grid-wrap">
        <div class="cong-grid" style="grid-template-columns:22px repeat(${c.Columnas}, minmax(22px, 1fr));max-width:${22 + c.Columnas * 42}px">${celdas}</div>
      </div>
      ${muestras.length ? '' : `<div style="font-size:12px;color:var(--text-muted);margin-top:10px">La caja está vacía. Pronto se podrán registrar aquí las muestras (cepas, líneas celulares, ADN, alícuotas…).</div>`}
    </div>`;
}

// ── Modal de caja ────────────────────────────────────────────

function openModalCaja(idCaja = '') {
  if (!_congPuedeGestionar()) return;
  _congEditandoCaja = idCaja;
  const c = idCaja ? (DATA.cajasCongelado || []).find(x => x.ID_Caja === idCaja) : null;
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
  // Al encoger una caja no puede quedar fuera ninguna muestra
  if (_congEditandoCaja) {
    const fuera = _congMuestrasDeCaja(_congEditandoCaja).filter(m => {
      const f = (m.Posicion || '').charCodeAt(0) - 65, col = parseInt((m.Posicion || '').slice(1), 10) - 1;
      return f >= datos.filas || col >= datos.columnas;
    });
    if (fuera.length) { showToast(`No se puede encoger: hay muestras en ${fuera.map(m => m.Posicion).join(', ')}`, 'error'); return; }
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
  const c = DATA.cajasCongelado.find(x => x.ID_Caja === idCaja);
  if (!c) return;
  if (!reactivar) {
    if (_congMuestrasDeCaja(idCaja).length) { showToast('Antes de retirar la caja, saca o da de baja las muestras que tiene', 'error'); return; }
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
