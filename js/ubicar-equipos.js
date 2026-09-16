// ============================================================
// UBICAR EQUIPOS — inventario colaborativo, fase A
// ============================================================
// El catálogo `ubicaciones` ya tiene el detalle fino (lab / zona / subzona),
// pero la mayoría de equipos siguen con "Lab 205" a secas. Aquí el alumnado
// recorre el laboratorio con el móvil y propone el emparejamiento.
//
// Nada de lo que propone un Alumno toca `equipos`: se guarda como propuesta
// (tabla propuestas_ubicacion_equipo) y la valida el profesorado, salvo que
// dos alumnos distintos coincidan — entonces la Edge Function la aplica sola.
// Para staff (Profesor/Gestor/Admin) la propuesta se aplica en el acto: ya
// son quienes validarían.
//
// NO es una sección fija del menú: es una herramienta puntual que se abre desde
// el Inventario de equipos (botón "📍 Ubicar equipos"). Cuando hay propuestas
// esperando validación, el aviso sale en el propio Inventario — mismo patrón que
// las revisiones de inventario del fungible en js/material.js.
//
// Diseño de la pantalla del alumno: primero eliges DÓNDE ESTÁS (una sola vez)
// y después marcas todos los equipos que hay en ese sitio. Es como se inventaría
// de verdad — de pie delante de una estantería —, no equipo por equipo.

let _ubicLabActivo       = '';
let _ubicUbicacionActual = '';
let _ubicFiltro          = '';
let _ubicSeleccion       = new Set();
let _ubicVerUbicados     = false;

// `.card` no trae padding (está pensada para cabecera + tabla a sangre), así que
// el contenido libre necesita el suyo o queda pegado al borde.
const UBIC_PAD = 'padding:16px 20px';

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/** Nº de laboratorio (3 dígitos) dentro de un texto: "Lab 205", "205-ZC-2.1", "205 - Zona común" */
function _ubicNumLab(texto) {
  const m = String(texto || '').match(/\b(\d{3})\b/);
  return m ? m[1] : '';
}

/** True si la Ubicacion del equipo ya apunta a una fila real del catálogo (ubicación concreta). */
function _ubicEsConcreta(eq) {
  if (!eq.Ubicacion) return false;
  return DATA.ubicaciones.some(u => u.ID_Ubicacion === eq.Ubicacion);
}

/** Laboratorio al que pertenece el equipo, venga de una ubicación concreta o del texto suelto. */
function _ubicLabDeEquipo(eq) {
  const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === eq.Ubicacion);
  if (u) return _ubicNumLab(u.Laboratorio_Aula);
  return _ubicNumLab(eq.Ubicacion);
}

/** Clave de agrupación del equipo: su laboratorio, o SIN_LAB si no se puede deducir. */
const UBIC_SIN_LAB = 'SIN';
function _ubicClaveLab(eq) { return _ubicLabDeEquipo(eq) || UBIC_SIN_LAB; }
function _ubicEtiquetaLab(clave) { return clave === UBIC_SIN_LAB ? 'Sin laboratorio' : `Lab ${clave}`; }

/** Laboratorios en los que puede trabajar el usuario actual. Staff: todos. */
function _ubicLabsUsuario() {
  const todos = [...new Set(DATA.ubicaciones.map(u => _ubicNumLab(u.Laboratorio_Aula)).filter(Boolean))].sort();
  if (getUserRole() !== 'Alumno') {
    // Staff ve también los laboratorios que solo existen en `equipos` y no en el
    // catálogo de ubicaciones (el 209 hoy), y los equipos sin ubicación ninguna.
    // Si no, esos equipos quedarían invisibles aquí y nadie sabría que faltan.
    const deEquipos = DATA.equipos.map(_ubicClaveLab);
    return [...new Set([...todos, ...deEquipos])].sort();
  }
  const misUbic = getUbicacionesAlumno();
  const mios = [...new Set(misUbic
    .map(id => DATA.ubicaciones.find(u => u.ID_Ubicacion === id))
    .filter(Boolean)
    .map(u => _ubicNumLab(u.Laboratorio_Aula))
    .filter(Boolean))].sort();
  return mios.length ? mios : todos;
}

// El ID de ubicación SIEMPRE se muestra. Zona+subzona no identifican el sitio:
// el lab 201 tiene siete "Izquierda / Encimera" distintas (201-1.1, 201-1.3…) y
// sin el código serían siete opciones idénticas en el desplegable.
/** Etiqueta legible de una ubicación concreta: "Derecha · 3º cajón encimera · 203-3.7.3" */
function _ubicEtiqueta(idUbicacion) {
  const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === idUbicacion);
  if (!u) return idUbicacion || '—';
  const partes = [u.Zona, u.Subzona].filter(Boolean);
  if (!partes.length) partes.push(u.Descripcion_Completa || '');
  return [...partes.filter(Boolean), u.ID_Ubicacion].join(' · ');
}

/** Etiqueta corta para el desplegable, ya agrupado por zona: "Encimera · 201-1.1" */
function _ubicEtiquetaCorta(u) {
  return [u.Subzona || u.Descripcion_Completa || '', u.ID_Ubicacion].filter(Boolean).join(' · ');
}

function _ubicNombreEquipo(eq) {
  return [eq.Tipo_Equipo, eq.Marca, eq.Modelo].filter(Boolean).join(' ') || eq.ID_Activo;
}

/** Propuestas pendientes, ya resueltas las que apuntan a equipos borrados. */
function _ubicPendientes() {
  return DATA.propuestasUbicacion
    .filter(p => p.Estado === 'pendiente')
    .filter(p => DATA.equipos.some(e => e.ID_Activo === p.ID_Equipo));
}

/** IDs de equipo con más de una propuesta pendiente apuntando a sitios distintos. */
function _ubicEquiposEnDiscrepancia(pendientes) {
  const porEquipo = {};
  pendientes.filter(p => p.No_Encontrado !== 'TRUE').forEach(p => {
    (porEquipo[p.ID_Equipo] = porEquipo[p.ID_Equipo] || new Set()).add(p.ID_Ubicacion);
  });
  return new Set(Object.keys(porEquipo).filter(id => porEquipo[id].size > 1));
}

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------

function renderUbicarEquipos() {
  const cont = document.getElementById('page-ubicar-equipos');
  if (!cont) return;
  if (!DATA.equipos.length) { cont.innerHTML = ''; return; }

  const esStaff = getUserRole() !== 'Alumno';
  const labs = _ubicLabsUsuario();
  if (!_ubicLabActivo || !labs.includes(_ubicLabActivo)) _ubicLabActivo = labs[0] || '';

  cont.innerHTML =
    `<div style="margin-bottom:16px">
       <button class="btn btn-secondary" onclick="showPage('equipos')">← Volver al inventario</button>
     </div>` +
    (esStaff ? _ubicRenderPanelValidacion() : '') +
    _ubicRenderProgreso(labs) +
    _ubicRenderHerramienta(labs) +
    _ubicRenderBarraAccion() +
    (esStaff ? '' : _ubicRenderMisPropuestas());
}

/** Barra de progreso del curso: cuántos equipos tienen ya ubicación concreta. */
function _ubicRenderProgreso(labs) {
  const delAlcance = DATA.equipos.filter(e => labs.includes(_ubicClaveLab(e)));
  const ubicados = delAlcance.filter(_ubicEsConcreta).length;
  const total = delAlcance.length;
  const pct = total ? Math.round(ubicados / total * 100) : 0;
  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header">
        <div class="card-title">📍 Equipos con ubicación concreta</div>
        <div class="card-actions" style="font-size:13px;color:var(--text-muted)">
          <strong style="color:var(--text)">${ubicados}</strong>&nbsp;de ${total} · ${pct}%
        </div>
      </div>
      <div style="${UBIC_PAD}">
        <div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--success);transition:width .3s"></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:10px;line-height:1.5">
          Una ubicación concreta es la del catálogo (zona y subzona: "Derecha · 3º cajón encimera"),
          no solo el número de laboratorio.
        </div>
      </div>
    </div>`;
}

/** Equipos del laboratorio activo que toca mostrar, ya filtrados. */
function _ubicEquiposDelLab() {
  const filtro = _ubicFiltro.toLowerCase();
  return DATA.equipos
    .filter(e => _ubicClaveLab(e) === _ubicLabActivo)
    .filter(e => _ubicVerUbicados || !_ubicEsConcreta(e))
    .filter(e => !filtro || (e.ID_Activo + ' ' + _ubicNombreEquipo(e)).toLowerCase().includes(filtro))
    .sort((a, b) => (a.Tipo_Equipo || '').localeCompare(b.Tipo_Equipo || '') || a.ID_Activo.localeCompare(b.ID_Activo));
}

/** Herramienta de campo: elegir dónde estás → marcar los equipos que hay ahí. */
function _ubicRenderHerramienta(labs) {
  const ubicacionesLab = DATA.ubicaciones
    .filter(u => _ubicNumLab(u.Laboratorio_Aula) === _ubicLabActivo && u.Activa !== 'FALSE')
    .sort((a, b) => (a.Zona || '').localeCompare(b.Zona || '') || (a.Subzona || '').localeCompare(b.Subzona || ''));

  const zonas = [...new Set(ubicacionesLab.map(u => u.Zona || 'Sin zona'))];
  const opciones = zonas.map(z => `
    <optgroup label="${_escAttr(z)}">
      ${ubicacionesLab.filter(u => (u.Zona || 'Sin zona') === z).map(u => `
        <option value="${_escAttr(u.ID_Ubicacion)}" ${u.ID_Ubicacion === _ubicUbicacionActual ? 'selected' : ''}>
          ${_esc(_ubicEtiquetaCorta(u))}
        </option>`).join('')}
    </optgroup>`).join('');

  const misPendientesIds = new Set(_ubicPendientes()
    .filter(p => (p.Email_Propuesto_Por || '').toLowerCase() === getEffectiveUser().email)
    .map(p => p.ID_Equipo));

  const equiposLab = _ubicEquiposDelLab();
  const sinUbicaciones = !ubicacionesLab.length;

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🔎 Ubicar equipos</div>
        ${labs.length > 1 ? `
          <div class="card-actions">
            <select class="filter" onchange="_ubicCambiarLab(this.value)">
              ${labs.map(l => `<option value="${l}" ${l === _ubicLabActivo ? 'selected' : ''}>${_esc(_ubicEtiquetaLab(l))}</option>`).join('')}
            </select>
          </div>` : ''}
      </div>

      <div style="${UBIC_PAD}">
      ${sinUbicaciones ? `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;font-size:13px;line-height:1.6;color:var(--text-muted)">
          ${_ubicLabActivo === UBIC_SIN_LAB
            ? `Estos <strong>${equiposLab.length} equipo(s)</strong> no tienen ninguna ubicación puesta, ni siquiera
               el laboratorio, así que no se sabe dónde buscarlos. Hay que asignarles un laboratorio desde
               <strong>Inventario</strong> antes de poder ubicarlos aquí.`
            : `El laboratorio ${_ubicLabActivo} todavía no tiene ubicaciones concretas en el catálogo
               (zonas y subzonas). Hay que darlas de alta en <strong>Catálogo → Ubicaciones</strong>
               antes de poder ubicar sus equipos aquí.`}
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
            ${equiposLab.slice(0, 20).map(e => `<div style="font-size:12px">· ${_esc(_ubicNombreEquipo(e))} <span style="opacity:.7">(${_esc(e.ID_Activo)})</span></div>`).join('')}
            ${equiposLab.length > 20 ? `<div style="font-size:12px;opacity:.7">…y ${equiposLab.length - 20} más</div>` : ''}
          </div>
        </div>` : `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:16px">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">1 · ¿Dónde estás ahora?</label>
          <select id="ubic-ubicacion-actual" onchange="_ubicCambiarUbicacion(this.value)" style="width:100%">
            <option value="">Elige la zona concreta…</option>
            ${opciones}
          </select>
          ${_ubicUbicacionActual ? `
            <div style="font-size:12px;color:var(--success);margin-top:8px">
              ✓ Estás en <strong>${_esc(_ubicEtiqueta(_ubicUbicacionActual))}</strong> —
              marca abajo todos los equipos que veas aquí.
            </div>` : ''}
        </div>

        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">
          2 · Marca los equipos que hay en ese sitio
        </label>
        <input type="text" placeholder="Buscar por tipo, marca o ID…" value="${_escAttr(_ubicFiltro)}"
               oninput="_ubicCambiarFiltro(this.value)" style="width:100%;margin-bottom:10px">

        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);margin-bottom:14px;cursor:pointer">
          <input type="checkbox" ${_ubicVerUbicados ? 'checked' : ''} onchange="_ubicToggleVerUbicados(this.checked)">
          Mostrar también los que ya tienen ubicación concreta (para corregirla)
        </label>

        ${equiposLab.length ? `
          <div style="display:flex;flex-direction:column;gap:6px">
            ${equiposLab.map(e => _ubicFilaEquipo(e, misPendientesIds)).join('')}
          </div>` : `
          <div style="text-align:center;padding:28px 12px;color:var(--text-muted);font-size:13px">
            🎉 No queda ningún equipo por ubicar en ${_esc(_ubicEtiquetaLab(_ubicLabActivo))}.
          </div>`}
      `}
      </div>
    </div>`;
}

function _ubicFilaEquipo(eq, misPendientesIds) {
  const marcado = _ubicSeleccion.has(eq.ID_Activo);
  const yaConcreta = _ubicEsConcreta(eq);
  const propuesto = misPendientesIds.has(eq.ID_Activo);
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ${marcado ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);background:${marcado ? 'var(--surface2)' : 'transparent'}">
      <input type="checkbox" ${marcado ? 'checked' : ''} onchange="_ubicToggleEquipo('${_escAttr(eq.ID_Activo)}', this.checked)"
             style="width:20px;height:20px;flex-shrink:0;cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis">${_esc(_ubicNombreEquipo(eq))}</div>
        <div style="font-size:11px;color:var(--text-muted)">
          ${_esc(eq.ID_Activo)}
          ${yaConcreta ? ` · ahora en ${_esc(_ubicEtiqueta(eq.Ubicacion))}` : ''}
          ${propuesto ? ' · <span style="color:var(--warning)">ya propuesto por ti</span>' : ''}
        </div>
      </div>
      <button class="icon-btn" title="No lo encuentro" onclick="marcarEquipoNoEncontrado('${_escAttr(eq.ID_Activo)}')"
              style="flex-shrink:0">❓</button>
    </div>`;
}

/** Barra de acción pegada abajo. Va FUERA de la .card a propósito: `.card` lleva
 *  overflow:hidden, y dentro de un ancestro así `position:sticky` no se pega al
 *  viewport (el navegador lo ancla a una caja que no hace scroll). */
function _ubicRenderBarraAccion() {
  const n = _ubicSeleccion.size;
  if (!n) return '';
  const listo = !!_ubicUbicacionActual;
  return `
    <div style="position:sticky;bottom:0;z-index:5;margin-top:-1px;background:var(--surface);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);padding:12px 20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;box-shadow:0 -2px 8px rgba(0,0,0,.06)">
      <button class="btn btn-primary" onclick="guardarUbicacionesLote()"
              ${listo ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>
        📍 Están aquí (${n})
      </button>
      <button class="btn btn-secondary" onclick="_ubicLimpiarSeleccion()">Quitar selección</button>
      ${listo
        ? `<span style="font-size:12px;color:var(--text-muted)">→ ${_esc(_ubicEtiqueta(_ubicUbicacionActual))}</span>`
        : `<span style="font-size:12px;color:var(--warning)">Elige arriba dónde estás</span>`}
    </div>`;
}

/** Lo que el alumno ha propuesto y aún está esperando validación. */
function _ubicRenderMisPropuestas() {
  const email = getEffectiveUser().email;
  const mias = DATA.propuestasUbicacion
    .filter(p => (p.Email_Propuesto_Por || '').toLowerCase() === email)
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''))
    .slice(0, 30);
  if (!mias.length) return '';

  const etiquetaEstado = {
    pendiente: '<span class="badge badge-orange">Pendiente de validar</span>',
    aceptada:  '<span class="badge badge-green">Aceptada</span>',
    rechazada: '<span class="badge badge-red">No aceptada</span>',
  };

  return `
    <div class="card" style="margin-top:18px">
      <div class="card-header">
        <div class="card-title">📨 Lo que has propuesto</div>
      </div>
      <div style="${UBIC_PAD};display:flex;flex-direction:column;gap:6px">
        ${mias.map(p => {
          const eq = DATA.equipos.find(e => e.ID_Activo === p.ID_Equipo);
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div style="flex:1;min-width:160px">
                <div style="font-size:12px;font-weight:500">${_esc(eq ? _ubicNombreEquipo(eq) : p.ID_Equipo)}</div>
                <div style="font-size:11px;color:var(--text-muted)">
                  ${p.No_Encontrado === 'TRUE' ? '❓ No lo encontraste' : '📍 ' + _esc(_ubicEtiqueta(p.ID_Ubicacion))}
                  · ${formatDate(p.Fecha) || p.Fecha}
                </div>
                ${p.Notas_Revision ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:2px">${_esc(p.Notas_Revision)}</div>` : ''}
              </div>
              <div style="font-size:11px">${etiquetaEstado[p.Estado] || p.Estado}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

/** Panel de validación (Profesor / Gestor / Administrador). */
function _ubicRenderPanelValidacion() {
  const pendientes = _ubicPendientes();
  const propuestas = pendientes.filter(p => p.No_Encontrado !== 'TRUE');
  const avisos     = pendientes.filter(p => p.No_Encontrado === 'TRUE');
  if (!propuestas.length && !avisos.length) return '';

  const discrepantes = _ubicEquiposEnDiscrepancia(pendientes);
  const limpias = propuestas.filter(p => !discrepantes.has(p.ID_Equipo));

  const fila = (p) => {
    const eq = DATA.equipos.find(e => e.ID_Activo === p.ID_Equipo);
    const enConflicto = discrepantes.has(p.ID_Equipo);
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border:1px solid ${enConflicto ? 'var(--warning)' : 'var(--border)'};border-radius:var(--radius-sm)">
        <div style="flex:1;min-width:200px">
          <div style="font-size:13px;font-weight:500">
            ${enConflicto ? '⚠️ ' : ''}${_esc(eq ? _ubicNombreEquipo(eq) : p.ID_Equipo)}
            <span style="font-weight:400;color:var(--text-muted)">· ${_esc(p.ID_Equipo)}</span>
          </div>
          <div style="font-size:12px;color:var(--text-soft);margin-top:2px">
            ${p.No_Encontrado === 'TRUE'
              ? '❓ No lo encuentran'
              : `📍 <strong>${_esc(_ubicEtiqueta(p.ID_Ubicacion))}</strong>
                 <span style="color:var(--text-muted)">(antes: ${_esc(p.Ubicacion_Anterior || '—')})</span>`}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${_esc(p.Propuesto_Por || '—')} · ${formatDate(p.Fecha) || p.Fecha}
            ${p.Observaciones ? ` · <em>${_esc(p.Observaciones)}</em>` : ''}
            ${enConflicto ? ' · <span style="color:var(--warning)">otra persona dice otro sitio</span>' : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-primary" style="font-size:11px;padding:4px 10px"
                  onclick="aceptarPropuestaUbic('${_escAttr(p.ID_Propuesta)}')">${p.No_Encontrado === 'TRUE' ? 'Visto' : 'Aceptar'}</button>
          <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px"
                  onclick="rechazarPropuestaUbic('${_escAttr(p.ID_Propuesta)}')">Rechazar</button>
        </div>
      </div>`;
  };

  return `
    <div class="card" style="margin-bottom:18px;border-left:3px solid var(--accent)">
      <div class="card-header">
        <div class="card-title">
          ✅ Propuestas pendientes de validar
          <span class="badge badge-orange" style="font-size:11px;margin-left:6px">${pendientes.length}</span>
        </div>
        ${limpias.length ? `
          <div class="card-actions">
            <button class="btn btn-primary" style="font-size:12px;padding:5px 12px"
                    onclick="aceptarTodasPropuestasUbic()">✓ Aceptar las ${limpias.length} sin discrepancia</button>
          </div>` : ''}
      </div>

      <div style="${UBIC_PAD}">
        ${propuestas.length ? `<div style="display:flex;flex-direction:column;gap:6px">${propuestas.map(fila).join('')}</div>` : ''}

        ${avisos.length ? `
          <div style="font-size:13px;font-weight:600;margin:16px 0 8px">❓ Equipos que no encuentran (${avisos.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px">${avisos.map(fila).join('')}</div>` : ''}

        <div style="font-size:11px;color:var(--text-muted);margin-top:12px;line-height:1.5">
          Al aceptar, tu nombre queda como responsable de la validación. Las propuestas en las que
          dos personas coinciden se aplican solas y no llegan aquí.
        </div>
      </div>
    </div>`;
}

/**
 * Aviso en el Inventario de equipos cuando hay propuestas esperando.
 * Sustituye al badge del menú: la herramienta ya no tiene sección fija, así que
 * el recordatorio tiene que estar donde la usuaria ya trabaja.
 */
function _ubicRenderAviso() {
  const cont = document.getElementById('aviso-propuestas-ubicacion');
  if (!cont) return;
  const n = getUserRole() === 'Alumno' ? 0 : _ubicPendientes().length;
  if (!n) { cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <div class="alert" style="margin-bottom:16px;cursor:pointer" onclick="showPage('ubicar-equipos')">
      <span class="alert-icon">📍</span>
      <div class="alert-content">
        <div class="alert-title">${n} propuesta(s) de ubicación esperando tu visto bueno</div>
        <div class="alert-text">Del alumnado que está inventariando. Pulsa aquí para revisarlas.</div>
      </div>
    </div>`;
}

// ------------------------------------------------------------
// INTERACCIÓN
// ------------------------------------------------------------

function _ubicCambiarLab(lab)      { _ubicLabActivo = lab; _ubicUbicacionActual = ''; _ubicSeleccion.clear(); renderUbicarEquipos(); }
function _ubicCambiarUbicacion(id) { _ubicUbicacionActual = id; renderUbicarEquipos(); }
function _ubicToggleVerUbicados(v) { _ubicVerUbicados = v; renderUbicarEquipos(); }
function _ubicLimpiarSeleccion()   { _ubicSeleccion.clear(); renderUbicarEquipos(); }

function _ubicToggleEquipo(id, marcado) {
  if (marcado) _ubicSeleccion.add(id); else _ubicSeleccion.delete(id);
  // Re-render solo para refrescar el contador del botón; el foco no está en la lista.
  renderUbicarEquipos();
}

function _ubicCambiarFiltro(texto) {
  _ubicFiltro = texto;
  clearTimeout(_ubicCambiarFiltro._t);
  _ubicCambiarFiltro._t = setTimeout(() => {
    renderUbicarEquipos();
    const input = document.querySelector('#page-ubicar-equipos input[type="text"]');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }, 250);
}

/** Envía una propuesta por cada equipo marcado, todos a la ubicación elegida. */
async function guardarUbicacionesLote() {
  if (!_ubicUbicacionActual) { showToast('Elige primero dónde estás', 'error'); return; }
  const ids = [..._ubicSeleccion];
  if (!ids.length) { showToast('Marca al menos un equipo', 'error'); return; }

  showLoading(`Guardando ${ids.length} equipo(s)...`);
  let aplicadas = 0, propuestas = 0, fallos = 0;
  for (const idEquipo of ids) {
    try {
      const r = await callEdgeFunction('gestionar-propuesta-ubicacion', {
        accion: 'crear', id_equipo: idEquipo, id_ubicacion: _ubicUbicacionActual,
      });
      if (r.aplicada) aplicadas++; else propuestas++;
    } catch (e) { fallos++; console.error(idEquipo, e); }
  }
  _ubicSeleccion.clear();
  await loadAllData();
  hideLoading();

  if (fallos) showToast(`${fallos} equipo(s) no se pudieron guardar`, 'error');
  else if (aplicadas && !propuestas) showToast(`${aplicadas} equipo(s) ubicados`, 'success');
  else if (aplicadas) showToast(`${propuestas} propuesta(s) enviadas y ${aplicadas} confirmada(s)`, 'success');
  else showToast(`${propuestas} propuesta(s) enviadas. El profesorado las revisará.`, 'success');

  renderUbicarEquipos();
  renderEquipos();
  _ubicRenderAviso();
}

async function marcarEquipoNoEncontrado(idEquipo) {
  const eq = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  const obs = prompt(`No encuentras "${eq ? _ubicNombreEquipo(eq) : idEquipo}".\n\n¿Quieres añadir alguna nota? (opcional)`, '');
  if (obs === null) return;   // canceló

  showLoading('Enviando aviso...');
  try {
    await callEdgeFunction('gestionar-propuesta-ubicacion', {
      accion: 'crear', id_equipo: idEquipo, no_encontrado: true, observaciones: obs,
    });
    await loadAllData();
    showToast('Aviso enviado', 'success');
    renderUbicarEquipos();
    _ubicRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo enviar el aviso', 'error');
    console.error(e);
  }
  hideLoading();
}

async function aceptarPropuestaUbic(idPropuesta) {
  showLoading('Aplicando...');
  try {
    await callEdgeFunction('gestionar-propuesta-ubicacion', { accion: 'aceptar', id_propuesta: idPropuesta });
    await loadAllData();
    showToast('Propuesta aceptada', 'success');
    renderUbicarEquipos(); renderEquipos(); _ubicRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo aceptar', 'error');
    console.error(e);
  }
  hideLoading();
}

async function rechazarPropuestaUbic(idPropuesta) {
  const motivo = prompt('¿Por qué la rechazas? (se lo verá quien la propuso)', '');
  if (motivo === null) return;
  showLoading('Rechazando...');
  try {
    await callEdgeFunction('gestionar-propuesta-ubicacion', {
      accion: 'rechazar', id_propuesta: idPropuesta, notas_revision: motivo,
    });
    await loadAllData();
    showToast('Propuesta rechazada', 'success');
    renderUbicarEquipos(); _ubicRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo rechazar', 'error');
    console.error(e);
  }
  hideLoading();
}

/** Acepta de una tacada todas las pendientes que no tienen discrepancia. */
async function aceptarTodasPropuestasUbic() {
  const pendientes = _ubicPendientes();
  const discrepantes = _ubicEquiposEnDiscrepancia(pendientes);
  const ids = pendientes
    .filter(p => p.No_Encontrado !== 'TRUE' && !discrepantes.has(p.ID_Equipo))
    .map(p => p.ID_Propuesta);
  if (!ids.length) return;
  if (!confirm(`Se van a aplicar ${ids.length} ubicación(es) a los equipos. ¿Seguir?`)) return;

  showLoading(`Aplicando ${ids.length} propuesta(s)...`);
  try {
    await callEdgeFunction('gestionar-propuesta-ubicacion', { accion: 'aceptar_varias', ids_propuesta: ids });
    await loadAllData();
    showToast(`${ids.length} equipo(s) ubicados`, 'success');
    renderUbicarEquipos(); renderEquipos(); _ubicRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudieron aplicar', 'error');
    console.error(e);
  }
  hideLoading();
}
