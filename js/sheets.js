// ============================================================
// SHEETS API
// ============================================================

// ----------------------------------------------------------------
// authFetch — wrapper central para todas las llamadas a la API.
// Inyecta el Bearer token, y si recibe un 401 intenta renovar el
// token una vez antes de rendirse y redirigir al login.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// authFetch — wrapper central para todas las llamadas a la API.
// Google Sheets devuelve 401 o 403 cuando el token ha expirado.
// Con el flujo GIS no hay renovación silenciosa posible:
// limpiamos sesión, mostramos UN toast y enviamos al login.
// El flag _sessionExpired evita la tormenta de mensajes cuando
// Promise.all lanza varias peticiones en paralelo.
// ----------------------------------------------------------------
let _sessionExpired = false;

async function authFetch(url, options = {}) {
  options.headers = { ...options.headers, Authorization: `Bearer ${accessToken}` };
  const r = await fetch(url, options);

  if (r.status === 401 || r.status === 403) {
    if (!_sessionExpired) {
      _sessionExpired = true;
      clearSession();
      accessToken = null;
      showToast('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      setTimeout(() => {
        _sessionExpired = false;
        document.getElementById('app').style.display  = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
      }, 1500);
    }
    throw new Error('Sesión expirada');
  }
  return r;
}

async function sheetsGet(range) {
  const r = await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`
  );
  const d = await r.json();
  return d.values || [];
}

async function sheetsAppend(sheet, row) {
  await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheet + '!A1')}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
}

async function sheetsUpdate(range, row) {
  await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
}

async function sheetsClear(range) {
  await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:clear`,
    { method: 'POST' }
  );
}

// ============================================================
// HELPERS MATERIAL_UBICACIONES
// ============================================================

/**
 * Actualiza el Stock_Local de un lote existente.
 * loteIndex: posición en DATA.materialUbicaciones (0-based → fila = loteIndex + 2)
 */
async function actualizarStockLocal(loteIndex, nuevoStock) {
  const fila = loteIndex + 2;
  await sheetsUpdate(`Material_Ubicaciones!D${fila}`, [String(nuevoStock)]);
  DATA.materialUbicaciones[loteIndex].Stock_Local = String(nuevoStock);
}

/**
 * Añade un nuevo lote a Material_Ubicaciones y lo registra en DATA.
 * Devuelve el objeto lote creado.
 */
async function añadirLote(idMaterial, idUbicacion, stockLocal, stockMin, stockOpt) {
  const id = genId('LU');
  const row = [id, idMaterial, idUbicacion, String(stockLocal), String(stockMin || 0), String(stockOpt || 0)];
  await sheetsAppend('Material_Ubicaciones', row);
  const lote = rowToObj(row, 'materialUbicaciones');
  DATA.materialUbicaciones.push(lote);
  return lote;
}

/**
 * Elimina un lote de Material_Ubicaciones (pone fila en blanco).
 * En Sheets no hay borrado real de filas via API REST sin Batchupdate,
 * así que vaciamos los valores. La fila vacía se ignora en loadAllData (filtro r[0]).
 */
async function eliminarLote(loteIndex) {
  const fila = loteIndex + 2;
  await sheetsUpdate(`Material_Ubicaciones!A${fila}:F${fila}`, ['', '', '', '', '', '']);
  DATA.materialUbicaciones.splice(loteIndex, 1);
}

// ============================================================
// CARGAR TODOS LOS DATOS
// ============================================================
async function loadAllData() {
  showLoading('Cargando datos...');
  try {
    const [equipos, intervenciones, incidencias, proveedores, ubicaciones, usuarios,
           material, movimientos, solicitudes, pedidos, lineasPedido, ciclosModulos,
           materialUbicaciones, historicoPrecio, tareas,
           planesMantenimiento, registroMantenimientos,
           tiposResiduo, contenedoresResiduo, adicionesResiduo,
           revisionesInventario, consultasResiduo,
           configReservas, reservas,
           sbCiclosRes, sbModulosRes, sbModuloCicloRes, sbUserModulosRes, sbUsuariosRes] = await Promise.all([
      sheetsGet('Equipos!A2:W'),
      sheetsGet('Intervenciones!A2:T'),
      sheetsGet('Incidencias!A2:I'),
      sheetsGet('Proveedores!A2:I'),
      sheetsGet('Ubicaciones!A2:F'),
      sheetsGet('Usuarios!A2:I'),
      sheetsGet('Material!A2:L'),
      sheetsGet('Movimientos!A2:H'),
      sheetsGet('Solicitudes!A2:J'),
      sheetsGet('Pedidos!A2:S'),
      sheetsGet('Lineas_Pedido!A2:I'),
      sheetsGet('Ciclos_Modulos!A2:B'),
      sheetsGet('Material_Ubicaciones!A2:F'),
      sheetsGet('Historico_Precios!A2:F').catch(() => []),
      sheetsGet('Tareas_Usuario!A2:F').catch(() => []),
      sheetsGet('Planes_Mantenimiento!A2:G').catch(e => { console.warn('Planes_Mantenimiento no cargó:', e); return []; }),
      sheetsGet('Registro_Mantenimientos!A2:I').catch(e => { console.warn('Registro_Mantenimientos no cargó:', e); return []; }),
      sheetsGet('Tipos_Residuo!A2:G').catch(() => []),
      sheetsGet('Contenedores_Residuo!A2:K').catch(() => []),
      sheetsGet('Adiciones_Residuo!A2:F').catch(() => []),
      sheetsGet('Revisiones_Inventario!A2:I').catch(() => []),
      sheetsGet('Consultas_Residuo!A2:F').catch(() => []),
      sheetsGet('Config_Reservas!A2:E').catch(() => []),
      sheetsGet('Reservas_Equipos!A2:L').catch(() => []),
      // Supabase — en paralelo con Sheets (usar .then(r=>r, fallback) porque el builder no tiene .catch())
      _sb.from('ciclos').select('id,nombre').then(r => r, () => ({ data: [] })),
      _sb.from('modulos').select('id,nombre,lab_teoria,lab_practicas').then(r => r, () => ({ data: [] })),
      _sb.from('modulo_ciclo').select('modulo_id,ciclo_id').then(r => r, () => ({ data: [] })),
      _sb.from('user_modulos').select('user_id,modulo_id,curso_academico').then(r => r, () => ({ data: [] })),
      _sb.from('users').select('id,email,full_name,role,ciclo_principal,is_active,puede_revisar_inventario').then(r => r, () => ({ data: [] }))
    ]);

    const toObj = (rows, type) => rows.filter(r => r.length && r[0]).map(r => rowToObj(r, type));

    DATA.equipos             = toObj(equipos,             'equipos');
    DATA.intervenciones      = toObj(intervenciones,      'intervenciones');
    DATA.incidencias         = toObj(incidencias,         'incidencias');
    DATA.proveedores         = toObj(proveedores,         'proveedores');
    DATA.ubicaciones         = toObj(ubicaciones,         'ubicaciones');
    DATA.usuarios            = toObj(usuarios,            'usuarios');
    DATA.material            = toObj(material,            'material');
    DATA.movimientos         = toObj(movimientos,         'movimientos');
    DATA.solicitudes         = toObj(solicitudes,         'solicitudes');
    DATA.pedidos             = toObj(pedidos,             'pedidos');
    DATA.lineasPedido        = toObj(lineasPedido,        'lineasPedido');
    DATA.ciclosModulos = ciclosModulos
      .filter(r => r.length && r.some(Boolean))  // mantener filas con col A vacía (módulos sin ciclo repetido)
      .map(r => rowToObj(r, 'ciclosModulos'));
    // Propagar Ciclo hacia abajo: celdas vacías heredan el ciclo de la fila anterior
    let ultimoCiclo = '';
    DATA.ciclosModulos.forEach(cm => {
      if (cm.Ciclo) { ultimoCiclo = cm.Ciclo; } else { cm.Ciclo = ultimoCiclo; }
    });
    DATA.materialUbicaciones = toObj(materialUbicaciones, 'materialUbicaciones');
    DATA.historicoPrecio        = toObj(historicoPrecio        || [], 'historicoPrecio');
    DATA.tareas                 = toObj(tareas                 || [], 'tareas');
    DATA.planesMantenimiento    = toObj(planesMantenimiento    || [], 'planesMantenimiento');
    DATA.registroMantenimientos = toObj(registroMantenimientos || [], 'registroMantenimientos');
    DATA.tiposResiduo           = toObj(tiposResiduo           || [], 'tiposResiduo');
    DATA.contenedoresResiduo    = toObj(contenedoresResiduo    || [], 'contenedoresResiduo');
    DATA.adicionesResiduo       = toObj(adicionesResiduo       || [], 'adicionesResiduo');
    DATA.revisionesInventario   = toObj(revisionesInventario   || [], 'revisionesInventario');
    DATA.consultasResiduo       = toObj(consultasResiduo       || [], 'consultasResiduo');
    DATA.configReservas         = toObj(configReservas         || [], 'configReservas');
    DATA.reservas               = toObj(reservas               || [], 'reservas');

    // Supabase: ciclos, módulos y asignaciones usuario→módulo
    const sbCiclos      = sbCiclosRes?.data      || [];
    const sbModulos     = sbModulosRes?.data     || [];
    const sbModuloCiclo = sbModuloCicloRes?.data || [];
    const sbUserModulos = sbUserModulosRes?.data || [];
    const sbUsuarios    = sbUsuariosRes?.data    || [];

    DATA.sbUsuarios = sbUsuarios;

    if (sbModuloCiclo.length && sbModulos.length) {
      // Construir ciclosModulos desde la tabla pivot modulo_ciclo (muchos-a-muchos)
      DATA.ciclosModulos = sbModuloCiclo.map(mc => {
        const mod   = sbModulos.find(m => m.id === mc.modulo_id);
        const ciclo = sbCiclos.find(c => c.id === mc.ciclo_id);
        return {
          Ciclo:        ciclo?.nombre         || '',
          Modulo:       mod?.nombre           || '',
          _sbModuloId:  mc.modulo_id,
          lab_teoria:   mod?.lab_teoria       || '',
          lab_practicas: mod?.lab_practicas   || ''
        };
      }).filter(cm => cm.Ciclo && cm.Modulo);
    }

    DATA.userModulos = sbUserModulos.map(um => {
      const mod = sbModulos.find(m => m.id === um.modulo_id);
      const ciclosDelMod = sbModuloCiclo
        .filter(mc => mc.modulo_id === um.modulo_id)
        .map(mc => sbCiclos.find(c => c.id === mc.ciclo_id)?.nombre || '')
        .filter(Boolean);
      return {
        user_id:         um.user_id,
        modulo_id:       um.modulo_id,
        curso_academico: um.curso_academico,
        nombre_modulo:   mod?.nombre          || '',
        nombre_ciclos:   ciclosDelMod,
        lab_teoria:      mod?.lab_teoria      || '',
        lab_practicas:   mod?.lab_practicas   || ''
      };
    });

    renderAll();
  } catch(e) {
    showToast('Error cargando datos. Comprueba los permisos del Sheet.', 'error');
    console.error(e);
  }
  hideLoading();
}

// ── sheetsDeleteRow ──────────────────────────────────────────
// Elimina físicamente una fila de una hoja (rowIndex: 0-based en DATA, sin contar cabecera).
// Obtiene el sheetId numérico dinámicamente para no depender de IDs hardcodeados.
async function sheetsDeleteRow(sheetName, rowIndex) {
  const meta = await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`
  );
  const data = await meta.json();
  const sheet = data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada`);
  const sheetId = sheet.properties.sheetId;
  await authFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS',
              startIndex: rowIndex + 1,  // +1 por la fila de cabecera
              endIndex:   rowIndex + 2
            }
          }
        }]
      })
    }
  );
}
