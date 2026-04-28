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
           materialUbicaciones, historicoPrecio, tareas] = await Promise.all([
      sheetsGet('Equipos!A2:S'),
      sheetsGet('Intervenciones!A2:R'),
      sheetsGet('Incidencias!A2:I'),
      sheetsGet('Proveedores!A2:I'),
      sheetsGet('Ubicaciones!A2:F'),
      sheetsGet('Usuarios!A2:E'),
      sheetsGet('Material!A2:L'),
      sheetsGet('Movimientos!A2:H'),
      sheetsGet('Solicitudes!A2:J'),
      sheetsGet('Pedidos!A2:R'),
      sheetsGet('Lineas_Pedido!A2:H'),
      sheetsGet('Ciclos_Modulos!A2:B'),
      sheetsGet('Material_Ubicaciones!A2:F'),
      sheetsGet('Historico_Precios!A2:F').catch(() => []),
      sheetsGet('Tareas_Usuario!A2:F').catch(() => [])
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
    DATA.historicoPrecio     = toObj(historicoPrecio || [], 'historicoPrecio');
    DATA.tareas              = toObj(tareas          || [], 'tareas');

    renderAll();
  } catch(e) {
    showToast('Error cargando datos. Comprueba los permisos del Sheet.', 'error');
    console.error(e);
  }
  hideLoading();
}
