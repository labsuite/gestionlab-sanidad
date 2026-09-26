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

// Los dos <input type="file"> viven fuera de la vista y se disparan desde un
// botón de verdad. El input crudo se pintaba como un "Seleccionar archivo" gris
// diminuto, y con `capture` puesto el navegador se saltaba el selector y abría
// la cámara directamente: si el permiso de cámara estaba denegado (tablets
// compartidas, navegador dentro de otra app) el toque no hacía absolutamente
// nada, sin aviso ninguno. Con dos botones siempre queda la vía de la galería.
const INVMAT_FOTO_OCULTA =
  'position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0)';

/** Abre la cámara ('camara') o el selector de archivos ('archivo'). */
function _invMatPedirFoto(cual) {
  const input = document.getElementById('invmat-foto-' + cual);
  if (!input) return;
  input.value = '';   // permite volver a elegir la misma foto tras un fallo
  try {
    input.click();
  } catch (e) {
    showToast('Este navegador no deja abrir la cámara ni los archivos. Abre la app en Chrome.', 'error');
  }
}

/** Navegadores incrustados en otra app (Classroom, Instagram, un lector de QR...),
 *  donde el selector de archivos muchas veces no responde. */
function _invMatEsNavegadorEmbebido() {
  const ua = navigator.userAgent || '';
  if (/\bwv\b|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|GSA\//i.test(ua)) return true;
  return /iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && !/Safari|CriOS|FxiOS/.test(ua);
}

function _invMatNuevo() {
  return {
    categoria: '', tipoBase: '', nombreBase: '',
    atributos: {}, textoEtiqueta: '',
    cantidad: '', unidad: '', idUbicacion: _invMatSitioActual().idUbicacion, observaciones: '',
    fotoPath: '', fotoNombre: '',
    iaExtraido: null, iaNoVisibles: [], iaError: '',
  };
}

// ------------------------------------------------------------
// DÓNDE SE ESTÁ INVENTARIANDO — se elige una vez, no en cada bote
// ------------------------------------------------------------
// El alumnado va armario por armario: saca un bote, lo propone, saca el
// siguiente. Con el desplegable de ubicaciones dentro del formulario había que
// volver a buscar el mismo sitio entre las ~180 ubicaciones del centro para
// cada bote, y eso era el mayor coste de la tanda. Ahora el sitio es de quien
// inventaría, no de la propuesta: se elige arriba (primero el laboratorio y
// solo entonces sus zonas), sobrevive al envío y se recuerda en el navegador
// por si la tablet se bloquea o se recarga la página a media tanda.
const INVMAT_SITIO_KEY = 'gestionlab_invmat_sitio';
let _invMatSitio = null;   // { lab, idUbicacion }

/** El sitio actual, validado contra el catálogo (puede haberse desactivado). */
function _invMatSitioActual() {
  if (!_invMatSitio) {
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(INVMAT_SITIO_KEY) || 'null'); } catch (e) { /* modo privado */ }
    _invMatSitio = { lab: guardado?.lab || '', idUbicacion: guardado?.idUbicacion || '' };
  }
  const u = DATA.ubicaciones.find(x => x.ID_Ubicacion === _invMatSitio.idUbicacion && x.Activa !== 'FALSE');
  if (u) _invMatSitio.lab = u.Laboratorio_Aula || 'Otros';
  else if (_invMatSitio.idUbicacion) _invMatSitio.idUbicacion = '';
  return _invMatSitio;
}

function _invMatFijarSitio(cambios) {
  const sitio = Object.assign(_invMatSitioActual(), cambios);
  try { localStorage.setItem(INVMAT_SITIO_KEY, JSON.stringify(sitio)); } catch (e) { /* modo privado */ }
  if (_invMat) _invMat.idUbicacion = sitio.idUbicacion;   // el bote en curso se muda con quien lo cuenta
  renderInventariarMaterial();
}

function _invMatCambiarLabSitio(v)  { _invMatFijarSitio({ lab: v, idUbicacion: '' }); }
function _invMatCambiarUbicSitio(v) { _invMatFijarSitio({ idUbicacion: v }); }

/** Laboratorios con ubicaciones activas, tal cual están en el catálogo. */
function _invMatLabsSitio() {
  return [...new Set(DATA.ubicaciones
    .filter(u => u.Activa !== 'FALSE')
    .map(u => u.Laboratorio_Aula || 'Otros'))].sort();
}

/** Etiqueta legible de una ubicación. El ID siempre se muestra: zona y subzona
 *  solas no identifican el sitio (hay quince "Encimera" por laboratorio). */
function _invMatEtiquetaUbic(idUbicacion) {
  const u = DATA.ubicaciones.find(x => x.ID_Ubicacion === idUbicacion);
  if (!u) return idUbicacion || '';
  return [...[u.Zona, u.Subzona].filter(Boolean), u.ID_Ubicacion].join(' · ');
}

/** La tarjeta de arriba: el laboratorio y, dentro, la zona concreta. */
function _invMatRenderSitio() {
  const sitio = _invMatSitioActual();
  const labs = _invMatLabsSitio();
  const ubics = DATA.ubicaciones
    .filter(u => u.Activa !== 'FALSE' && (u.Laboratorio_Aula || 'Otros') === sitio.lab);
  const zonas = [...new Set(ubics.map(u => u.Zona || 'Sin zona'))].sort();

  return `
    <div class="card" id="invmat-sitio" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">📍 ¿Dónde estás inventariando?</div>
      </div>
      <div style="${INVMAT_PAD}">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
          <select onchange="_invMatCambiarLabSitio(this.value)">
            <option value="">Laboratorio…</option>
            ${labs.map(l => `<option value="${_escAttr(l)}" ${l === sitio.lab ? 'selected' : ''}>${_esc(l)}</option>`).join('')}
          </select>
          ${sitio.lab ? `
            <select onchange="_invMatCambiarUbicSitio(this.value)">
              <option value="">Armario, cajón o estante…</option>
              ${zonas.map(z => `
                <optgroup label="${_escAttr(z)}">
                  ${ubics.filter(u => (u.Zona || 'Sin zona') === z).map(u =>
                    `<option value="${_escAttr(u.ID_Ubicacion)}" ${u.ID_Ubicacion === sitio.idUbicacion ? 'selected' : ''}>${_esc([u.Subzona, u.Descripcion_Completa].filter(Boolean)[0] || u.Zona || u.ID_Ubicacion)} · ${_esc(u.ID_Ubicacion)}</option>`
                  ).join('')}
                </optgroup>`).join('')}
            </select>` : ''}
        </div>
        <div style="font-size:12px;margin-top:10px;line-height:1.6;color:${sitio.idUbicacion ? 'var(--success)' : 'var(--text-muted)'}">
          ${sitio.idUbicacion
            ? `✓ Todo lo que envíes se guardará en <strong>${_esc(_invMatEtiquetaUbic(sitio.idUbicacion))}</strong>.
               No hay que volver a elegirlo en cada bote: cámbialo solo cuando te muevas de sitio.`
            : 'Elige el sitio una sola vez, antes de empezar. Se queda puesto para todos los botes de esa estantería; solo hay que cambiarlo al moverse.'}
        </div>
      </div>
    </div>`;
}

// ------------------------------------------------------------
// CÁMARA DENTRO DE LA PROPIA PÁGINA
// ------------------------------------------------------------
// `capture="environment"` en un <input type="file"> no vale para esto: el
// navegador se salta el selector y delega en la app de cámara del sistema, y si
// el permiso está denegado —o no hay ninguna app que atienda— el toque no hace
// absolutamente nada y no avisa de nada. Con getUserMedia el permiso se pide de
// verdad, el fallo tiene nombre y se le puede explicar a quien está delante.
// El <input> con `capture` se queda solo como último recurso para navegadores
// sin getUserMedia.

let _invMatCamStream = null;
let _invMatCamFacing = 'environment';

/** z-index: por encima de los modales (1000) y por debajo del cargando (2000). */
const INVMAT_CAM_Z = 1500;

async function _invMatAbrirCamara() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _invMatPedirFoto('camara');   // WebView viejo: que lo intente el input
    return;
  }
  _invMatPintarCamara();
  try {
    await _invMatArrancarCamara('environment');
  } catch (e) {
    _invMatCerrarCamara();
    showToast(_invMatMensajeErrorCamara(e), 'error');
    console.error('[camara]', e);
  }
}

function _invMatPintarCamara() {
  if (document.getElementById('invmat-cam')) return;
  const cap = document.createElement('div');
  cap.id = 'invmat-cam';
  cap.style.cssText =
    'position:fixed;inset:0;z-index:' + INVMAT_CAM_Z + ';background:#000;' +
    'display:flex;flex-direction:column';
  cap.innerHTML =
    '<video id="invmat-cam-video" autoplay playsinline muted ' +
           'style="flex:1;min-height:0;width:100%;object-fit:contain;background:#000"></video>' +
    '<div id="invmat-cam-aviso" style="color:#fff;text-align:center;font-size:13px;padding:10px 16px">' +
      'Abriendo la cámara…</div>' +
    '<div style="display:flex;gap:10px;justify-content:center;align-items:center;' +
         'padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:#111">' +
      '<button class="btn btn-secondary" onclick="_invMatCerrarCamara()">Cancelar</button>' +
      '<button class="btn btn-primary" id="invmat-cam-disparo" disabled ' +
              'style="font-size:16px;padding:12px 28px" onclick="_invMatCapturar()">📷 Capturar</button>' +
      '<button class="btn btn-secondary" id="invmat-cam-girar" style="display:none" ' +
              'onclick="_invMatGirarCamara()" title="Cambiar de cámara">🔄</button>' +
    '</div>';
  document.body.appendChild(cap);
  document.addEventListener('keydown', _invMatCamEscape);
}

function _invMatCamEscape(ev) { if (ev.key === 'Escape') _invMatCerrarCamara(); }

async function _invMatArrancarCamara(facing) {
  _invMatPararStream();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  _invMatCamStream = stream;
  _invMatCamFacing = facing;
  const video = document.getElementById('invmat-cam-video');
  if (!video) { _invMatPararStream(); return; }
  video.srcObject = stream;
  // iOS a veces rechaza el play() y aun así pinta; y en navegadores viejos
  // play() no devuelve promesa, de ahí el Promise.resolve.
  await Promise.resolve(video.play()).catch(() => {});

  const aviso = document.getElementById('invmat-cam-aviso');
  if (aviso) aviso.textContent = 'Encuadra la etiqueta y pulsa Capturar.';
  const disparo = document.getElementById('invmat-cam-disparo');
  if (disparo) disparo.disabled = false;

  // El botón de girar solo tiene sentido si hay más de una cámara.
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const camaras = dispositivos.filter(d => d.kind === 'videoinput');
    const girar = document.getElementById('invmat-cam-girar');
    if (girar && camaras.length > 1) girar.style.display = '';
  } catch { /* enumerateDevices puede fallar; el botón se queda oculto */ }
}

async function _invMatGirarCamara() {
  const otra = _invMatCamFacing === 'environment' ? 'user' : 'environment';
  try {
    await _invMatArrancarCamara(otra);
  } catch (e) {
    showToast(_invMatMensajeErrorCamara(e), 'error');
  }
}

function _invMatPararStream() {
  if (!_invMatCamStream) return;
  _invMatCamStream.getTracks().forEach(t => t.stop());
  _invMatCamStream = null;
}

function _invMatCerrarCamara() {
  _invMatPararStream();
  document.removeEventListener('keydown', _invMatCamEscape);
  document.getElementById('invmat-cam')?.remove();
}

/** Congela el fotograma actual y lo sube como si fuese un archivo elegido. */
function _invMatCapturar() {
  const video = document.getElementById('invmat-cam-video');
  if (!video || !video.videoWidth) { showToast('La cámara aún no está lista', 'error'); return; }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    _invMatCerrarCamara();
    if (!blob) { showToast('No se pudo capturar la foto', 'error'); return; }
    const nombre = 'etiqueta-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.jpg';
    _invMatProcesarFoto(new File([blob], nombre, { type: 'image/jpeg' }));
  }, 'image/jpeg', 0.9);
}

/** Traduce el fallo de getUserMedia a algo que se pueda leer en el laboratorio. */
function _invMatMensajeErrorCamara(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'El permiso de cámara está bloqueado en este navegador. Tócalo en el candado 🔒 de la barra de direcciones → Permisos → Cámara → Permitir, y vuelve a intentarlo.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError')
    return 'Este dispositivo no tiene cámara disponible. Haz la foto con el móvil y súbela con "Elegir una foto ya hecha".';
  if (n === 'NotReadableError')
    return 'La cámara la está usando otra aplicación. Ciérrala y vuelve a intentarlo.';
  return 'No se pudo abrir la cámara' + (e && e.message ? ' (' + e.message + ')' : '') + '. Puedes subir una foto ya hecha.';
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
    _invMatRenderSitio() +
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
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary" style="flex:1 1 160px" onclick="_invMatAbrirCamara()">📷 Hacer una foto</button>
              <button class="btn btn-secondary" style="flex:1 1 160px" onclick="_invMatPedirFoto('archivo')">🖼️ Elegir una foto ya hecha</button>
            </div>
            <input type="file" id="invmat-foto-camara" accept="image/*" capture="environment"
                   onchange="_invMatSubirFoto(this)" style="${INVMAT_FOTO_OCULTA}">
            <input type="file" id="invmat-foto-archivo" accept="image/*"
                   onchange="_invMatSubirFoto(this)" style="${INVMAT_FOTO_OCULTA}">
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">
              Sin foto no se puede proponer: es lo que permite comprobar los datos sin bajar al laboratorio.
            </div>
            ${_invMatEsNavegadorEmbebido() ? `
              <div style="background:var(--warning-light);border:1px solid #e8c98a;border-radius:var(--radius-sm);padding:10px 12px;font-size:11px;line-height:1.6;margin-top:8px">
                Estás viendo la app dentro de otra aplicación, y ahí la cámara y la galería
                suelen estar bloqueadas. Si al pulsar no pasa nada, abre esta página en Chrome o Safari
                (menú ⋮ → “Abrir en el navegador”) y vuelve a intentarlo.
              </div>` : ''}
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

        <!-- 4 · CUÁNTO ───────────────────────────────────────── -->
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">4 · ¿Cuánto hay?</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:10px">
            <input type="number" min="0" step="0.01" value="${_escAttr(_invMat.cantidad)}" placeholder="Cantidad"
                   oninput="_invMat.cantidad=this.value">
            <input list="invmat-unidades" value="${_escAttr(_invMat.unidad)}" placeholder="Unidad (caja, bote…)"
                   oninput="_invMat.unidad=this.value">
            <datalist id="invmat-unidades">
              ${_invMatUnidades().map(u => `<option value="${_escAttr(u)}"></option>`).join('')}
            </datalist>
          </div>
        <!-- El sitio no se pregunta aquí: sale de la tarjeta de arriba y es el
             mismo para toda la tanda. Solo se recuerda dónde va a quedar. -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;margin-bottom:14px;
                    background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px">
          ${_invMat.idUbicacion
            ? `<span>📍 Se guardará en <strong>${_esc(_invMatEtiquetaUbic(_invMat.idUbicacion))}</strong></span>`
            : `<span style="color:var(--warning)">📍 Falta decir dónde está — elígelo arriba</span>`}
          <button class="btn btn-secondary" style="font-size:11px;padding:3px 10px" onclick="_invMatIrAlSitio()">
            Cambiar de sitio
          </button>
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

/** Texto de material para los desplegables: el ID va detrás porque es lo que
 *  desambigua dos botes que se llaman casi igual. */
function _invMatEtiquetaMaterial(m) {
  return `${m.Nombre} · ${m.ID_Material}`;
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

/** Lleva la vista a la tarjeta del sitio y la resalta un momento: desde el
 *  paso 4, en el móvil, queda muy arriba y no se ve que ha cambiado nada. */
function _invMatIrAlSitio() {
  const card = document.getElementById('invmat-sitio');
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.style.transition = 'box-shadow .3s';
  card.style.boxShadow = '0 0 0 3px var(--accent)';
  setTimeout(() => { card.style.boxShadow = ''; }, 1200);
}

/** Aviso en vivo si el nombre que se está componiendo ya existe en el catálogo. */
function _invMatAvisoDuplicado(nombre) {
  const clave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const k = clave(nombre);
  const ya = DATA.material.find(m => clave(m.Nombre) === k);
  if (!ya) return '';
  return `<div style="font-size:12px;color:var(--warning);margin-top:8px;line-height:1.6">
    ⚠️ Se parece a <strong>${_esc(ya.Nombre)}</strong>, que ya está en el inventario.
    Envíalo igual con su foto: el profesorado mirará si es ese mismo y, si lo es,
    lo apuntará en el sitio donde lo has encontrado sin duplicarlo.
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
          Si ya estaba en el inventario, "🔗 Ya existía…" no duplica nada: le añade el bote en el sitio
          donde lo han encontrado, o lo cuelga como alícuota del bote del que salió.
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
          <button class="btn btn-primary" style="font-size:11px;padding:4px 10px"
                  onclick="aceptarPropuestaMaterial('${_escAttr(p.ID_Propuesta)}')">✓ Crear</button>
          <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px"
                  onclick="fusionarPropuestaMaterial('${_escAttr(p.ID_Propuesta)}','${_escAttr(yaExiste ? yaExiste.ID_Material : '')}')">🔗 Ya existía…</button>
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

function _invMatSubirFoto(input) {
  const file = input.files?.[0];
  input.value = '';   // si no, elegir la misma foto otra vez no dispara `change`
  if (file) _invMatProcesarFoto(file);
}

/** Sube la foto, venga del selector de archivos o de la cámara de la página. */
async function _invMatProcesarFoto(file) {
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

// ------------------------------------------------------------
// "YA EXISTÍA" — qué se hace con lo que se contó
// ------------------------------------------------------------
// Marcar la propuesta como fusionada y no tocar nada era tirar el trabajo del
// recuento: el bote sigue en ese armario y la app sigue sin saberlo. Aquí se
// decide qué era de verdad — un bote más de ese material en ese sitio, una
// alícuota de otro bote, o un recuento de uno que ya estaba fichado ahí.
// En ningún caso se crea una segunda entrada de catálogo.

let _invMatFusion = null;   // { idPropuesta, idMaterial, texto, modo, idLote, idLotePadre }

function fusionarPropuestaMaterial(idPropuesta, idMaterial) {
  const p = DATA.propuestasMaterial.find(x => x.ID_Propuesta === idPropuesta);
  if (!p) { showToast('Propuesta no encontrada', 'error'); return; }
  const id = idMaterial || p.ID_Material_Relacionado || p.ID_Material_Sugerido || '';
  const mat = DATA.material.find(m => m.ID_Material === id) || null;
  _invMatFusion = {
    idPropuesta, idMaterial: mat ? mat.ID_Material : '',
    texto: mat ? _invMatEtiquetaMaterial(mat) : '',
    modo: '', idLote: '', idLotePadre: '',
  };
  _invMatFusionModoPorDefecto();
  _invMatPintarFusion();
  openModal('modal-fusion-propuesta');
}

/** El modo que se propone de entrada. Si ya hay un bote fichado en ese mismo
 *  sitio, lo que ha contado el alumnado ES lo que hay ahora en ese bote: se
 *  sustituye, no se suma (sumar contaría dos veces el mismo bote). */
function _invMatFusionModoPorDefecto() {
  const f = _invMatFusion;
  const p = DATA.propuestasMaterial.find(x => x.ID_Propuesta === f.idPropuesta);
  const lotes = f.idMaterial ? getMatUbics(f.idMaterial) : [];
  const enSitio = lotes.filter(l => l.ID_Ubicacion === p.ID_Ubicacion);
  f.idLotePadre = lotes.length ? (lotes.find(l => !l.ID_Lote_Padre) || lotes[0]).ID : '';
  f.idLote = enSitio.length ? enSitio[0].ID : '';
  if (!p.ID_Ubicacion) f.modo = 'ninguno';
  else if (enSitio.length) f.modo = 'reemplazar';
  else f.modo = 'nuevo_lote';
}

function _invMatFusionMaterial(v) {
  const f = _invMatFusion; if (!f) return;
  f.texto = v;
  const txt = String(v || '').trim();
  const id = txt.includes('·') ? txt.split('·').pop().trim() : '';
  const m = (id && DATA.material.find(x => x.ID_Material === id))
    || DATA.material.find(x => String(x.Nombre).toLowerCase() === txt.toLowerCase());
  const antes = f.idMaterial;
  f.idMaterial = m ? m.ID_Material : '';
  if (f.idMaterial !== antes) {
    f.idLote = ''; f.idLotePadre = '';
    _invMatFusionModoPorDefecto();
    _invMatPintarFusion();
  }
}

function _invMatFusionModo(v) { _invMatFusion.modo = v; _invMatPintarFusion(); }

function _invMatEtiquetaLote(l, mat) {
  const unidad = l.Unidad_Lote || (mat ? mat.Unidad : '') || '';
  const hija = l.ID_Lote_Padre ? ' (bote de uso)' : '';
  return `${getNombreUbicacion(l.ID_Ubicacion)} — ${l.Stock_Local} ${unidad}${hija}`.trim();
}

function _invMatPintarFusion() {
  const cont = document.getElementById('fusion-prop-body');
  const f = _invMatFusion;
  if (!cont || !f) return;
  const p = DATA.propuestasMaterial.find(x => x.ID_Propuesta === f.idPropuesta);
  if (!p) return;
  const mat = DATA.material.find(m => m.ID_Material === f.idMaterial) || null;
  const lotes = mat ? getMatUbics(mat.ID_Material) : [];
  const enSitio = lotes.filter(l => l.ID_Ubicacion === p.ID_Ubicacion);
  const cant = parseFloat(p.Cantidad) || 0;
  const unidad = p.Unidad || (mat ? mat.Unidad : '') || '';
  const sitio = p.ID_Ubicacion ? getNombreUbicacion(p.ID_Ubicacion) : '';

  const opcion = (v, disponible, titulo, ayuda, extra) => !disponible ? '' : `
    <label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer;padding:10px 12px;line-height:1.45;
                  border:1px solid ${f.modo === v ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-sm);
                  background:${f.modo === v ? 'var(--surface2)' : 'transparent'}">
      <input type="radio" name="fusion-modo" ${f.modo === v ? 'checked' : ''}
             onchange="_invMatFusionModo('${v}')" style="margin-top:3px;flex-shrink:0">
      <span style="flex:1"><span style="font-size:13px;font-weight:500">${titulo}</span>
        <span style="display:block;font-size:11px;color:var(--text-muted)">${ayuda}</span>
        ${f.modo === v ? (extra || '') : ''}</span>
    </label>`;

  const selLotes = (lista, id, onchange) => `
    <select onchange="${onchange}" style="margin-top:8px;font-size:12px">
      ${lista.map(l => `<option value="${_escAttr(l.ID)}" ${l.ID === id ? 'selected' : ''}>${_esc(_invMatEtiquetaLote(l, mat))}</option>`).join('')}
    </select>`;

  cont.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:14px;line-height:1.6">
      <div style="font-size:13px;font-weight:600">${_esc(p.Nombre_Generado || p.Texto_Etiqueta || '—')}</div>
      <div style="font-size:12px;color:var(--text-soft)">
        Contado: <strong>${cant || '—'}</strong> ${_esc(unidad)}
        ${sitio ? ` · 📍 ${_esc(sitio)}` : ' · sin sitio anotado'}
        · ${_esc(p.Propuesto_Por || '—')}
      </div>
    </div>

    <div class="form-group" style="margin-bottom:14px">
      <label>¿Cuál es el material que ya existe? *</label>
      <input list="invmat-materiales-fusion" value="${_escAttr(f.texto)}"
             placeholder="Escribe el nombre y elígelo de la lista" oninput="_invMatFusionMaterial(this.value)">
      <datalist id="invmat-materiales-fusion">
        ${DATA.material.map(m => `<option value="${_escAttr(_invMatEtiquetaMaterial(m))}"></option>`).join('')}
      </datalist>
    </div>

    ${!mat ? `<div style="font-size:12px;color:var(--warning);line-height:1.6">
      Elige un material de la lista para poder decidir qué se hace con lo contado.
    </div>` : `
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">¿Qué se hace con lo que se contó?</label>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${opcion('reemplazar', enSitio.length > 0,
          '🔄 Es el bote que ya estaba fichado ahí — actualizar la cantidad',
          `Lo contado es lo que hay ahora: ${_esc(String(enSitio.length ? enSitio[0].Stock_Local : ''))} → <strong>${cant || 0}</strong> ${_esc(unidad)}. No se suma, se sustituye.`,
          selLotes(enSitio, f.idLote, '_invMatFusion.idLote=this.value; _invMatPintarFusion()'))}
        ${opcion('nuevo_lote', !!p.ID_Ubicacion,
          `📍 Es el mismo, pero en ${_esc(sitio)}`,
          `Se le añade un bote de ${cant || 0} ${_esc(unidad)} ahí. No se crea ninguna entrada nueva de inventario.`
          + (enSitio.length ? ' Ojo: ahí ya hay un bote fichado de este material — si es ese mismo, usa la opción de arriba.' : ''))}
        ${opcion('alicuota', lotes.length > 0,
          '💧 Es una alícuota de uno de sus botes',
          `Se cuelga como bote de uso${sitio ? ` en ${_esc(sitio)}` : ''}. El bote del que salió no se descuenta: si hay que ajustarlo, se hace desde el inventario.`,
          selLotes(lotes, f.idLotePadre, '_invMatFusion.idLotePadre=this.value'))}
        ${opcion('sumar', enSitio.length > 0,
          '➕ Es otro bote distinto: sumarlo al que ya estaba',
          `Suma ${cant || 0} ${_esc(unidad)} al bote elegido. Solo si de verdad son dos botes guardados en el mismo sitio.`,
          selLotes(enSitio, f.idLote, '_invMatFusion.idLote=this.value; _invMatPintarFusion()'))}
        ${opcion('ninguno', true,
          '🚫 Solo marcarla — no tocar el stock',
          'Queda resuelta como "ya existía" y el inventario se queda como está.')}
      </div>`}

    <div class="form-footer">
      <button class="btn btn-secondary" onclick="closeModal('modal-fusion-propuesta')">Cancelar</button>
      <button class="btn btn-primary" ${mat ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}
              onclick="_invMatConfirmarFusion()">Resolver</button>
    </div>`;
}

async function _invMatConfirmarFusion() {
  const f = _invMatFusion;
  if (!f || !f.idMaterial) { showToast('Elige el material que ya existe', 'error'); return; }
  const cuerpo = {
    accion: 'fusionar', id_propuesta: f.idPropuesta, id_material: f.idMaterial,
    modo_stock: f.modo || 'ninguno',
  };
  if (f.modo === 'sumar' || f.modo === 'reemplazar') {
    if (!f.idLote) { showToast('Elige de qué bote se trata', 'error'); return; }
    cuerpo.id_lote = f.idLote;
  }
  if (f.modo === 'alicuota') {
    if (!f.idLotePadre) { showToast('Elige de qué bote salió la alícuota', 'error'); return; }
    cuerpo.id_lote_padre = f.idLotePadre;
  }
  showLoading('Resolviendo...');
  try {
    await callEdgeFunction('gestionar-propuesta-material', cuerpo);
    await loadAllData();
    closeModal('modal-fusion-propuesta');
    _invMatFusion = null;
    showToast(cuerpo.modo_stock === 'ninguno'
      ? 'Marcada como ya existente'
      : 'Resuelta: el bote ya está en el inventario', 'success');
    renderInventariarMaterial();
    if (typeof renderMaterial === 'function') renderMaterial();
    _invMatRenderAviso();
  } catch (e) {
    showToast(e.message || 'No se pudo resolver', 'error');
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
