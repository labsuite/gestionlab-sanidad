// ============================================================
// INVENTARIAR MATERIAL FUNGIBLE — inventario colaborativo, fase B
// ============================================================
// El principio de todo esto: quien propone un material NO escribe su nombre.
// Elige categoría y tipo de producto de listas cerradas, rellena los atributos
// que importan de ese tipo (ficha `atributos_material`) y el nombre se compone
// solo. Así no puede colar el nombre comercial en lugar del genérico, que es el
// problema que originó el módulo. Lo que pone literalmente en el bote va a su
// propio campo, "lo que pone en la etiqueta", donde sí es información útil.
//
// Nada entra en `material` hasta que el profesorado lo resuelve: aceptar (se
// crea), fusionar (ya existía) o rechazar con motivo.
//
// NO es una sección fija del menú — igual que "Ubicar equipos", es una
// herramienta puntual que se abre desde el Inventario de material fungible.

let _invMatPaso = 1;
let _invMat = null;   // borrador en curso

// `.card` no trae padding: el contenido libre necesita el suyo.
const INVMAT_PAD = 'padding:16px 20px';

function _invMatNuevo() {
  return {
    categoria: '', tipoBase: '', nombreBase: '',
    atributos: {}, textoEtiqueta: '',
    cantidad: '', unidad: '', idUbicacion: '', observaciones: '',
    fotoPath: '', fotoNombre: '',
    iaExtraido: null, iaNoVisibles: [], iaError: '',
  };
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/** Las 12 categorías canónicas, leídas del select del modal de material. */
function _invMatCategorias() {
  const sel = document.getElementById('mat-categoria');
  const delSelect = sel ? [...sel.options].map(o => o.value).filter(Boolean) : [];
  if (delSelect.length) return delSelect;
  return [...new Set(DATA.material.map(m => m.Categoria).filter(Boolean))].sort();
}

/** Prefijo de la categoría, que es con lo que casa la ficha ("Reactivo químico — …" → "Reactivo químico"). */
function _invMatPrefijoCat(categoria) {
  return String(categoria || '').split(' — ')[0].trim();
}

function _invMatFichasDe(categoria) {
  const pref = _invMatPrefijoCat(categoria);
  return DATA.fichasAtributos.filter(f => f.Activa !== false && f.Categoria === pref);
}

function _invMatFichaActual() {
  if (!_invMat?.tipoBase) return null;
  return _invMatFichasDe(_invMat.categoria).find(f => f.Tipo_Base === _invMat.tipoBase) || null;
}

/** Nombres base ya usados en el catálogo, para el autocompletado. */
function _invMatBasesConocidas() {
  const delCatalogo = DATA.material.map(m => String(m.Nombre || '').split(',')[0].trim());
  const deFichas = DATA.fichasAtributos.map(f => f.Nombre_Base).filter(Boolean);
  return [...new Set([...deFichas, ...delCatalogo].filter(Boolean))].sort();
}

/** Punto decimal y sin ceros sobrantes: 0.5 → "0.5", 10.0 → "10". */
function _invMatNum(v) {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? '');
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * Copia EN CLIENTE del compositor de nombres. La versión que manda es la del
 * servidor (supabase/functions/_shared/material.ts, componerNombreMaterial):
 * esta solo alimenta la vista previa en vivo. Si se toca una, tocar la otra.
 */
function componerNombreMaterial(nombreBase, ficha, valores) {
  let txt = String(nombreBase || '').trim();
  for (const a of (ficha || [])) {
    const n = a.nombre || {};
    const sep = n.sep || 'coma';
    if (sep === 'omitir') continue;
    const v = valores?.[a.clave];
    if (v === null || v === undefined || v === '' || v === false) continue;
    let trozo;
    if (a.tipo === 'booleano')   trozo = String(n.textoSi || a.etiqueta || '');
    else if (a.tipo === 'numero') trozo = `${n.prefijo || ''}${_invMatNum(v)}${n.sufijo || ''}`;
    else                          trozo = `${n.prefijo || ''}${String(v)}${n.sufijo || ''}`;
    trozo = trozo.trim();
    if (!trozo) continue;
    txt += (sep === 'espacio' ? ' ' : ', ') + trozo;
  }
  return txt.trim();
}

function _invMatNombreGenerado() {
  const ficha = _invMatFichaActual();
  const base = _invMat?.nombreBase || ficha?.Nombre_Base || '';
  if (!base) return '';
  return componerNombreMaterial(base, ficha?.Atributos || [], _invMat?.atributos || {});
}

/** Qué impide enviar la propuesta, en una frase. Vacío = se puede enviar. */
function _invMatQueFalta() {
  const falta = [];
  if (!_invMat?.fotoPath) falta.push('la foto de la etiqueta');
  if (!_invMat?.categoria) falta.push('la categoría');
  if (!_invMat?.tipoBase) falta.push('el tipo de producto');
  if (!falta.length) return '';
  return falta.length === 1 ? falta[0] : falta.slice(0, -1).join(', ') + ' y ' + falta[falta.length - 1];
}

function _invMatPendientes() {
  return DATA.propuestasMaterial.filter(p => p.Estado === 'pendiente');
}

/** Unidades ya usadas, para el desplegable de unidad (mismo criterio que los botes). */
function _invMatUnidades() {
  const delCatalogo = DATA.material.flatMap(m =>
    [m.Unidad, ...String(m.Unidades_Extra || '').split(',')].map(u => (u || '').trim()));
  const deLotes = DATA.materialUbicaciones.map(l => (l.Unidad_Lote || '').trim());
  return [...new Set([...delCatalogo, ...deLotes].filter(Boolean))].sort();
}

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------

function renderInventariarMaterial() {
  const cont = document.getElementById('page-inventariar-material');
  if (!cont) return;
  if (!_invMat) _invMat = _invMatNuevo();
  const esStaff = getUserRole() !== 'Alumno';

  cont.innerHTML =
    `<div style="margin-bottom:16px">
       <button class="btn btn-secondary" onclick="showPage('material')">← Volver al inventario</button>
     </div>` +
    (esStaff ? _invMatRenderPanelValidacion() : '') +
    _invMatRenderFormulario() +
    (esStaff ? '' : _invMatRenderMisPropuestas());
}

function _invMatRenderFormulario() {
  const ficha = _invMatFichaActual();
  const nombre = _invMatNombreGenerado();
  const fichas = _invMatFichasDe(_invMat.categoria);
  const necesitaBase = !ficha?.Nombre_Base;

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">➕ Material encontrado que no está en la app</div>
        ${_invMat.fotoPath || _invMat.categoria ? `
          <div class="card-actions">
            <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" onclick="_invMatReiniciar()">Empezar de cero</button>
          </div>` : ''}
      </div>
      <div style="${INVMAT_PAD}">

        <!-- 1 · FOTO ─────────────────────────────────────────── -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;margin-bottom:16px">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">
            1 · Foto de la etiqueta <span style="color:var(--danger)">*</span>
          </label>
          ${_invMat.fotoPath ? `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:13px;color:var(--success)">✓ Foto subida${_invMat.fotoNombre ? ` — ${_esc(_invMat.fotoNombre)}` : ''}</span>
              <button class="btn btn-secondary" style="font-size:11px;padding:3px 10px" onclick="_invMatQuitarFoto()">Cambiar</button>
              <button class="btn btn-primary" style="font-size:11px;padding:3px 10px" onclick="_invMatLeerEtiqueta()">✨ Leer la etiqueta</button>
            </div>
            ${_invMat.iaError ? `<div style="font-size:11px;color:var(--warning);margin-top:8px">No se pudo leer la etiqueta automáticamente (${_esc(_invMat.iaError)}). Rellena los datos a mano.</div>` : ''}
            ${_invMat.iaExtraido ? `<div style="font-size:11px;color:var(--success);margin-top:8px">Leído de la etiqueta y rellenado abajo. Revísalo: lo que no se veía se ha dejado en blanco.</div>` : ''}
          ` : `
            <input type="file" accept="image/*" capture="environment" onchange="_invMatSubirFoto(this)" style="width:100%;font-size:13px">
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;line-height:1.5">
              Sin foto no se puede proponer: es lo que permite comprobar los datos sin bajar al laboratorio.
            </div>
          `}
        </div>

        <!-- 2 · QUÉ ES ───────────────────────────────────────── -->
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">2 · ¿Qué es?</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px">
          <select onchange="_invMatCambiarCategoria(this.value)">
            <option value="">Categoría…</option>
            ${_invMatCategorias().map(c => `<option value="${_escAttr(c)}" ${c === _invMat.categoria ? 'selected' : ''}>${_esc(c.split(' — ')[0])}</option>`).join('')}
          </select>
          ${_invMat.categoria ? `
            <select onchange="_invMatCambiarTipo(this.value)">
              <option value="">Tipo de producto…</option>
              ${fichas.map(f => `<option value="${_escAttr(f.Tipo_Base)}" ${f.Tipo_Base === _invMat.tipoBase ? 'selected' : ''}>${_esc(f.Tipo_Base)}</option>`).join('')}
              <option value="__otro__" ${_invMat.tipoBase === '__otro__' ? 'selected' : ''}>No está en la lista</option>
            </select>` : ''}
        </div>

        ${_invMat.tipoBase === '__otro__' ? `
          <div style="background:var(--warning-light);border:1px solid #e8c98a;border-radius:var(--radius-sm);padding:10px 14px;font-size:12px;line-height:1.6;margin-bottom:14px">
            Sin tipo no hay atributos que rellenar: describe lo que puedas en "lo que pone en la etiqueta"
            y en observaciones, y el profesorado decidirá cómo catalogarlo.
          </div>` : ''}

        <!-- 3 · DATOS ────────────────────────────────────────── -->
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">3 · Datos del producto</label>
        ${!_invMat.tipoBase ? `
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:14px">
            Elige arriba la categoría y el tipo de producto: según lo que sea, aquí aparecerán
            los datos que hay que anotar (volumen, diámetro, talla…).
          </div>` : ''}
        ${_invMat.tipoBase ? `
          ${necesitaBase ? `
            <div class="form-group" style="margin-bottom:10px">
              <label style="font-size:11px;color:var(--text-muted)">¿Cómo se llama? (nombre común, no el comercial)</label>
              <input list="invmat-bases" value="${_escAttr(_invMat.nombreBase)}" placeholder="Ej: Ácido clorhídrico"
                     oninput="_invMat.nombreBase=this.value; _invMatRefrescarNombre()">
              <datalist id="invmat-bases">
                ${_invMatBasesConocidas().map(b => `<option value="${_escAttr(b)}"></option>`).join('')}
              </datalist>
            </div>` : ''}

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px">
            ${(ficha?.Atributos || []).map(a => _invMatCampoAtributo(a)).join('')}
          </div>
        ` : ''}

        <!-- LO QUE PONE EN EL BOTE — no depende del tipo ────── -->
        <div class="form-group" style="margin-bottom:14px">
            <label style="font-size:12px;font-weight:600">Lo que pone en la etiqueta</label>
            <input value="${_escAttr(_invMat.textoEtiqueta)}" placeholder="Copia el nombre comercial y la referencia tal cual"
                   oninput="_invMat.textoEtiqueta=this.value">
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.5">
            Aquí sí va el nombre de marca y el código del proveedor. No es el nombre del material,
            pero ayuda a identificarlo y a volver a pedirlo.
          </div>
        </div>

        <!-- 4 · CUÁNTO Y DÓNDE ──────────────────────────────── -->
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">4 · ¿Cuánto hay y dónde?</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px">
            <input type="number" min="0" step="0.01" value="${_escAttr(_invMat.cantidad)}" placeholder="Cantidad"
                   oninput="_invMat.cantidad=this.value">
            <input list="invmat-unidades" value="${_escAttr(_invMat.unidad)}" placeholder="Unidad (caja, bote…)"
                   oninput="_invMat.unidad=this.value">
            <datalist id="invmat-unidades">
              ${_invMatUnidades().map(u => `<option value="${_escAttr(u)}"></option>`).join('')}
            </datalist>
            <select onchange="_invMat.idUbicacion=this.value">
              <option value="">¿Dónde está?</option>
              ${_invMatOpcionesUbicacion()}
            </select>
          </div>
        <div class="form-group" style="margin-bottom:14px">
          <textarea rows="2" placeholder="Observaciones (opcional)" oninput="_invMat.observaciones=this.value">${_esc(_invMat.observaciones)}</textarea>
        </div>

        <!-- VISTA PREVIA + ENVIAR ───────────────────────────── -->
        ${nombre ? `
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:14px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Se llamará</div>
            <div id="invmat-preview" style="font-size:15px;font-weight:600">${_esc(nombre)}</div>
            ${_invMatAvisoDuplicado(nombre)}
          </div>` : ''}

        ${_invMatQueFalta() ? `<div style="font-size:12px;color:var(--warning);margin-bottom:8px">
          Falta ${_esc(_invMatQueFalta())} para poder enviarlo.
        </div>` : ''}
        <button class="btn btn-primary" onclick="enviarPropuestaMaterial()"
                ${_invMatQueFalta() ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
          📨 Enviar propuesta
        </button>
      </div>
    </div>`;
}

/** Un campo de formulario a partir de la definición del atributo. */
function _invMatCampoAtributo(a) {
  const v = _invMat.atributos[a.clave];
  const noVisible = (_invMat.iaNoVisibles || []).includes(a.clave);
  const marca = noVisible
    ? `<span title="Gemini no lo vio en la etiqueta" style="color:var(--warning);font-size:11px;margin-left:4px">· no se ve en la foto</span>`
    : '';
  const etiqueta = `<label style="font-size:11px;color:var(--text-muted)">${_esc(a.etiqueta)}${a.obligatorio ? ' <span style="color:var(--danger)">*</span>' : ''}${a.unidad ? ` (${_esc(a.unidad)})` : ''}${marca}</label>`;
  const set = `_invMatSetAtributo('${_escAttr(a.clave)}', this`;

  if (a.tipo === 'booleano') {
    return `<div class="form-group"><label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding-top:14px">
      <input type="checkbox" ${v ? 'checked' : ''} onchange="${set}.checked)" style="width:16px;height:16px">
      ${_esc(a.etiqueta)}${marca}
    </label></div>`;
  }
  if (a.tipo === 'opcion') {
    return `<div class="form-group">${etiqueta}
      <select onchange="${set}.value)">
        <option value="">—</option>
        ${(a.opciones || []).map(o => `<option value="${_escAttr(o)}" ${o === v ? 'selected' : ''}>${_esc(o)}</option>`).join('')}
      </select></div>`;
  }
  if (a.tipo === 'numero') {
    return `<div class="form-group">${etiqueta}
      <input type="number" step="any" value="${_escAttr(v ?? '')}" oninput="${set}.value)"></div>`;
  }
  return `<div class="form-group">${etiqueta}
    <input value="${_escAttr(v ?? '')}" oninput="${set}.value)"></div>`;
}

function _invMatOpcionesUbicacion() {
  const ubics = DATA.ubicaciones.filter(u => u.Activa !== 'FALSE');
  const zonas = [...new Set(ubics.map(u => u.Laboratorio_Aula || 'Otros'))].sort();
  return zonas.map(z => `
    <optgroup label="${_escAttr(z)}">
      ${ubics.filter(u => (u.Laboratorio_Aula || 'Otros') === z).map(u =>
        `<option value="${_escAttr(u.ID_Ubicacion)}" ${u.ID_Ubicacion === _invMat.idUbicacion ? 'selected' : ''}>${_esc([u.Zona, u.Subzona].filter(Boolean).join(' · ') || u.ID_Ubicacion)} · ${_esc(u.ID_Ubicacion)}</option>`
      ).join('')}
    </optgroup>`).join('');
}

/** Aviso en vivo si el nombre que se está componiendo ya existe en el catálogo. */
function _invMatAvisoDuplicado(nombre) {
  const clave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const k = clave(nombre);
  const ya = DATA.material.find(m => clave(m.Nombre) === k);
  if (!ya) return '';
  return `<div style="font-size:12px;color:var(--warning);margin-top:8px;line-height:1.5">
    ⚠️ Esto ya está en el inventario como <strong>${_esc(ya.Nombre)}</strong>.
    Si es lo mismo, no hace falta darlo de alta: mejor contar su stock desde el inventario.
  </div>`;
}

/** Lo que ha propuesto el alumnado, con el estado de cada propuesta. */
function _invMatRenderMisPropuestas() {
  const email = getEffectiveUser().email;
  const mias = DATA.propuestasMaterial
    .filter(p => (p.Email_Propuesto_Por || '').toLowerCase() === email)
    .sort((a, b) => (b.Fecha || '').localeCompare(a.Fecha || ''))
    .slice(0, 20);
  if (!mias.length) return '';
  const etiqueta = {
    pendiente: '<span class="badge badge-orange">Pendiente de validar</span>',
    aceptada:  '<span class="badge badge-green">Aceptada</span>',
    fusionada: '<span class="badge badge-gray">Ya existía</span>',
    rechazada: '<span class="badge badge-red">No aceptada</span>',
  };
  return `
    <div class="card" style="margin-top:18px">
      <div class="card-header"><div class="card-title">📨 Lo que has propuesto</div></div>
      <div style="${INVMAT_PAD};display:flex;flex-direction:column;gap:6px">
        ${mias.map(p => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm)">
            <div style="flex:1;min-width:160px">
              <div style="font-size:12px;font-weight:500">${_esc(p.Nombre_Generado || p.Texto_Etiqueta || '—')}</div>
              <div style="font-size:11px;color:var(--text-muted)">${formatDate(p.Fecha) || p.Fecha}</div>
              ${p.Notas_Revision ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:2px">${_esc(p.Notas_Revision)}</div>` : ''}
            </div>
            <div style="font-size:11px">${etiqueta[p.Estado] || p.Estado}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/**
 * Materiales del catálogo que comparten nombre base con la propuesta.
 * El antiduplicados del servidor es estricto a propósito (prefiere un alta de
 * más a fusionar dos cosas distintas), así que "Placas Petri estériles, 90 mm"
 * NO casa con "Placas Petri". Pero quien valida sí quiere verlo: puede ser el
 * mismo producto al que nunca se le anotó el diámetro.
 */
function _invMatMismaBase(p) {
  const clave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = clave(p.Nombre_Base);
  if (!base) return [];
  return DATA.material
    .filter(m => clave(String(m.Nombre).split(',')[0]) === base)
    .filter(m => m.ID_Material !== p.ID_Material_Sugerido)
    .slice(0, 4);
}

/** Panel de validación (Profesor / Gestor / Administrador). */
function _invMatRenderPanelValidacion() {
  const pendientes = _invMatPendientes();
  if (!pendientes.length) return '';

  return `
    <div class="card" style="margin-bottom:18px;border-left:3px solid var(--accent)">
      <div class="card-header">
        <div class="card-title">
          ✅ Material propuesto, pendiente de validar
          <span class="badge badge-orange" style="font-size:11px;margin-left:6px">${pendientes.length}</span>
        </div>
      </div>
      <div style="${INVMAT_PAD};display:flex;flex-direction:column;gap:10px">
        ${pendientes.map(p => _invMatFilaValidacion(p)).join('')}
        <div style="font-size:11px;color:var(--text-muted);line-height:1.5">
          Al aceptar se crea el material con el nombre que aparezca en el recuadro (puedes corregirlo),
          su lote en la ubicación indicada y su movimiento de entrada. Tu nombre queda como responsable.
        </div>
      </div>
    </div>`;
}

function _invMatFilaValidacion(p) {
  const yaExiste = p.ID_Material_Sugerido
    ? DATA.material.find(m => m.ID_Material === p.ID_Material_Sugerido) : null;
  const ficha = DATA.fichasAtributos.find(f =>
    f.Categoria === _invMatPrefijoCat(p.Categoria) && f.Tipo_Base === p.Tipo_Base);
  const mismaBase = _invMatMismaBase(p);
  const attrs = Object.entries(p.Atributos || {})
    .filter(([, v]) => v !== '' && v !== null && v !== false)
    .map(([k, v]) => {
      const def = (ficha?.Atributos || []).find(a => a.clave === k);
      return `${def?.etiqueta || k}: <strong>${_esc(String(v === true ? 'sí' : v))}</strong>`;
    }).join(' · ');

  return `
    <div style="border:1px solid ${yaExiste ? 'var(--warning)' : 'var(--border)'};border-radius:var(--radius-sm);padding:12px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex:1;min-width:220px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Se creará como</div>
          <input id="invmat-nombre-${_escAttr(p.ID_Propuesta)}" value="${_escAttr(p.Nombre_Generado || '')}"
                 style="width:100%;font-size:14px;font-weight:600;margin:4px 0 8px">
          <div style="font-size:12px;color:var(--text-soft);line-height:1.6">
            ${_esc(p.Categoria.split(' — ')[0])}${p.Tipo_Base ? ` · ${_esc(p.Tipo_Base)}` : ''}<br>
            ${attrs ? attrs + '<br>' : ''}
            ${p.Cantidad ? `<strong>${_esc(p.Cantidad)}</strong> ${_esc(p.Unidad || '')}` : 'sin cantidad'}
            ${p.ID_Ubicacion ? ` · 📍 ${_esc(getNombreUbicacion(p.ID_Ubicacion))}` : ''}
          </div>
          ${p.Texto_Etiqueta ? `<div style="font-size:12px;margin-top:6px"><span style="color:var(--text-muted)">En la etiqueta:</span> <em>${_esc(p.Texto_Etiqueta)}</em></div>` : ''}
          ${p.Observaciones ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:4px">${_esc(p.Observaciones)}</div>` : ''}
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
            ${_esc(p.Propuesto_Por || '—')} · ${formatDate(p.Fecha) || p.Fecha}
          </div>
          ${p.IA_Avisos ? `<div style="font-size:11px;color:var(--warning);margin-top:6px">⚠️ ${_esc(p.IA_Avisos)}</div>` : ''}
          ${yaExiste ? `<div style="font-size:12px;color:var(--warning);margin-top:6px">
            ⚠️ Se parece a <strong>${_esc(yaExiste.Nombre)}</strong> — ¿es el mismo?</div>` : ''}
          ${mismaBase.length ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.7">
            Ya hay material que empieza igual — ¿es alguno de estos?<br>
            ${mismaBase.map(m => `<button class="btn btn-secondary" style="font-size:11px;padding:2px 8px;margin:2px 4px 0 0"
                onclick="fusionarPropuestaMaterial('${_escAttr(p.ID_Propuesta)}','${_escAttr(m.ID_Material)}')">${_esc(m.Nombre)}</button>`).join('')}
          </div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          ${p.Foto_Path ? `<button class="btn btn-secondary" style="font-size:11px;padding:4px 10px" onclick="abrirDocumento('${_escAttr(p.Foto_Path)}')">🔍 Ver foto</button>` : ''}
          <button class="btn btn-primary" style="font-size:11px;padding:4px 10px" onclick="aceptarPropuestaMaterial('${_escAttr(p.ID_Propuesta)}')">✓ Crear</button>
          ${yaExiste ? `<button class="btn btn-secondary" style="font-size:11px;padding:4px 10px" onclick="fusionarPropuestaMaterial('${_escAttr(p.ID_Propuesta)}','${_escAttr(yaExiste.ID_Material)}')">Ya existía</button>` : ''}
          <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px" onclick="rechazarPropuestaMaterial('${_escAttr(p.ID_Propuesta)}')">Rechazar</button>
        </div>
      </div>
    </div>`;
}

/** Aviso en el Inventario de material cuando hay propuestas esperando. */
function _invMatRenderAviso() {
  const cont = document.getElementById('aviso-propuestas-material');
  if (!cont) return;
  const n = getUserRole() === 'Alumno' ? 0 : _invMatPendientes().length;
  if (!n) { cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <div class="alert-banner" style="cursor:pointer" onclick="showPage('inventariar-material')">
      <div class="alert-icon">🧴</div>
      <div class="alert-content">
        <div class="alert-title">${n} material(es) propuesto(s) esperando tu visto bueno</div>
        <div class="alert-text">Del alumnado que está inventariando. Pulsa aquí para revisarlos.</div>
      </div>
    </div>`;
}

// ------------------------------------------------------------
// INTERACCIÓN
// ------------------------------------------------------------

function _invMatReiniciar() { _invMat = _invMatNuevo(); renderInventariarMaterial(); }

function _invMatCambiarCategoria(v) {
  _invMat.categoria = v; _invMat.tipoBase = ''; _invMat.atributos = {};
  _invMat.nombreBase = ''; _invMat.iaNoVisibles = [];
  renderInventariarMaterial();
}

function _invMatCambiarTipo(v) {
  _invMat.tipoBase = v; _invMat.atributos = {};
  const ficha = _invMatFichaActual();
  _invMat.nombreBase = ficha?.Nombre_Base || '';
  renderInventariarMaterial();
}

function _invMatSetAtributo(clave, valor) {
  _invMat.atributos[clave] = valor;
  _invMatRefrescarNombre();
}

/** Refresca solo la vista previa: re-renderizar entero perdería el foco del campo. */
function _invMatRefrescarNombre() {
  const el = document.getElementById('invmat-preview');
  if (el) el.textContent = _invMatNombreGenerado();
}

function _invMatQuitarFoto() {
  _invMat.fotoPath = ''; _invMat.fotoNombre = '';
  _invMat.iaExtraido = null; _invMat.iaNoVisibles = []; _invMat.iaError = '';
  renderInventariarMaterial();
}

async function _invMatSubirFoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast('La foto pesa más de 10 MB', 'error'); return; }
  showLoading('Subiendo la foto...');
  try {
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const idTemp = 'PROP' + Date.now().toString(36).toUpperCase();
    _invMat.fotoPath = await subirDocumento('etiqueta', idTemp, base64, file.name, file.type);
    _invMat.fotoNombre = file.name;
    showToast('Foto subida', 'success');
  } catch (e) {
    showToast(e.message || 'No se pudo subir la foto', 'error');
    console.error(e);
  }
  hideLoading();
  renderInventariarMaterial();
}

/** Pide a Gemini los campos EXACTOS de la ficha y prerrellena el formulario. */
async function _invMatLeerEtiqueta() {
  if (!_invMat.fotoPath) return;
  if (!_invMat.categoria) { showToast('Elige antes la categoría, así se sabe qué buscar', 'error'); return; }
  showLoading('Leyendo la etiqueta...');
  try {
    const { leido, error_ia } = await callEdgeFunction('gestionar-propuesta-material', {
      accion: 'leer_etiqueta', foto_path: _invMat.fotoPath,
      categoria: _invMatPrefijoCat(_invMat.categoria), tipo_base: _invMat.tipoBase || null,
    });
    if (!leido) {
      _invMat.iaError = error_ia || 'sin respuesta';
    } else {
      _invMat.iaError = '';
      _invMat.iaExtraido = leido;
      _invMat.iaNoVisibles = Array.isArray(leido.atributos_no_visibles) ? leido.atributos_no_visibles : [];
      if (leido.texto_etiqueta && !_invMat.textoEtiqueta) _invMat.textoEtiqueta = leido.texto_etiqueta;
      // Solo se rellena lo que esté vacío: nunca se pisa lo que ya escribió la persona.
      // Y nunca lo que la propia IA marcó como no visible: el esquema de respuesta
      // obliga a devolver un valor de cada tipo, así que ahí cuela un 0 o un "no"
      // que no está en la etiqueta. `atributos_no_visibles` es la señal que manda.
      const noVisibles = new Set(_invMat.iaNoVisibles);
      for (const a of (_invMatFichaActual()?.Atributos || [])) {
        if (noVisibles.has(a.clave)) continue;
        const v = leido[a.clave];
        if (v === null || v === undefined || v === '') continue;
        const actual = _invMat.atributos[a.clave];
        if (actual !== undefined && actual !== '' && actual !== false) continue;
        _invMat.atributos[a.clave] = a.tipo === 'booleano'
          ? /^(si|sí|true|1)$/i.test(String(v))
          : v;
      }
    }
  } catch (e) {
    _invMat.iaError = e.message || 'error';
    console.error(e);
  }
  hideLoading();
  renderInventariarMaterial();
}

async function enviarPropuestaMaterial() {
  if (!_invMat.fotoPath) { showToast('Falta la foto de la etiqueta', 'error'); return; }
  if (!_invMat.categoria) { showToast('Falta la categoría', 'error'); return; }

  showLoading('Enviando propuesta...');
  try {
    const r = await callEdgeFunction('gestionar-propuesta-material', {
      accion: 'crear',
      categoria: _invMatPrefijoCat(_invMat.categoria),
      tipo_base: _invMat.tipoBase === '__otro__' ? null : _invMat.tipoBase,
      nombre_base: _invMat.nombreBase || _invMatFichaActual()?.Nombre_Base || _invMat.textoEtiqueta || 'Sin identificar',
      atributos: _invMat.atributos,
      texto_etiqueta: _invMat.textoEtiqueta,
      unidad: _invMat.unidad, cantidad: _invMat.cantidad,
      id_ubicacion: _invMat.idUbicacion,
      observaciones: _invMat.observaciones,
      foto_path: _invMat.fotoPath,
      ia_extraido: _invMat.iaExtraido,
    });
    await loadAllData();
    _invMat = _invMatNuevo();
    showToast(r.ya_existe
      ? `Enviada. Ojo: se parece a "${r.ya_existe.nombre}" — lo revisará el profesorado.`
      : 'Propuesta enviada. El profesorado la revisará.', 'success');
    renderInventariarMaterial();
    _invMatRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo enviar la propuesta', 'error');
    console.error(e);
  }
  hideLoading();
}

async function aceptarPropuestaMaterial(idPropuesta) {
  const p = DATA.propuestasMaterial.find(x => x.ID_Propuesta === idPropuesta);
  const nombre = document.getElementById(`invmat-nombre-${idPropuesta}`)?.value?.trim() || p?.Nombre_Generado || '';
  if (!nombre) { showToast('El material necesita un nombre', 'error'); return; }
  const unidad = p?.Unidad || prompt(`¿En qué unidad se cuenta "${nombre}"? (caja, bote, unidad…)`, '');
  if (!unidad) { showToast('Hace falta la unidad', 'error'); return; }

  showLoading('Creando el material...');
  try {
    const { material } = await callEdgeFunction('gestionar-propuesta-material', {
      accion: 'aceptar', id_propuesta: idPropuesta, nombre, unidad,
    });
    await loadAllData();
    showToast(`Creado "${material.nombre}"`, 'success');
    renderInventariarMaterial(); renderMaterial(); _invMatRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo crear', 'error');
    console.error(e);
  }
  hideLoading();
}

async function fusionarPropuestaMaterial(idPropuesta, idMaterial) {
  const mat = DATA.material.find(m => m.ID_Material === idMaterial);
  if (!confirm(`¿Es lo mismo que "${mat?.Nombre || idMaterial}"?\n\nNo se creará nada nuevo. Si hay que ajustar el stock, hazlo desde el inventario.`)) return;
  showLoading('Marcando como ya existente...');
  try {
    await callEdgeFunction('gestionar-propuesta-material', {
      accion: 'fusionar', id_propuesta: idPropuesta, id_material: idMaterial,
    });
    await loadAllData();
    showToast('Marcada como ya existente', 'success');
    renderInventariarMaterial(); _invMatRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo fusionar', 'error');
    console.error(e);
  }
  hideLoading();
}

async function rechazarPropuestaMaterial(idPropuesta) {
  const motivo = prompt('¿Por qué la rechazas? (lo verá quien la propuso)', '');
  if (motivo === null) return;
  showLoading('Rechazando...');
  try {
    await callEdgeFunction('gestionar-propuesta-material', {
      accion: 'rechazar', id_propuesta: idPropuesta, notas_revision: motivo,
    });
    await loadAllData();
    showToast('Propuesta rechazada', 'success');
    renderInventariarMaterial(); _invMatRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo rechazar', 'error');
    console.error(e);
  }
  hideLoading();
}
