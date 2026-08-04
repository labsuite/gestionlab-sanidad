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

// ----------------------------------------------------------------
// callEdgeFunction — wrapper para las Edge Functions de Supabase que hacen
// de "servidor" de GestionLab (crear-usuario, gestionar-proveedor...).
// Reenvía el access_token de Google actual para que la función verifique
// el rol server-side — el navegador nunca habla con Supabase Auth directo
// hasta la migración del login (tarea #8).
// ----------------------------------------------------------------
async function callEdgeFunction(nombre, body) {
  const r = await fetch(`${SUPABASE_MIGRACION_URL}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_MIGRACION_ANON}`,
      'Content-Type': 'application/json',
      'x-google-token': accessToken,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Error del servidor (${r.status})`);
  return data;
}

// ----------------------------------------------------------------
// Mapeo de filas de Supabase → mismo formato de objeto que ya usa la app
// (rowToObj de Sheets), para no tener que tocar el resto del código que
// lee DATA.proveedores con nombres tipo Nombre_Proveedor.
// ----------------------------------------------------------------
function _proveedorSbToObj(p) {
  return {
    ID_Proveedor: p.id_proveedor || '',
    Nombre_Proveedor: p.nombre_proveedor || '',
    Tipo_Proveedor: p.tipo_proveedor || '',
    Persona_Contacto: p.persona_contacto || '',
    Email_Contacto: p.email_contacto || '',
    Telefono: p.telefono || '',
    Web: p.web || '',
    Observaciones: p.observaciones || '',
    Activo: p.activo ? 'TRUE' : 'FALSE',
  };
}

function _ubicacionSbToObj(u) {
  return {
    ID_Ubicacion: u.id_ubicacion || '',
    Laboratorio_Aula: u.laboratorio_aula || '',
    Zona: u.zona || '',
    Subzona: u.subzona || '',
    Descripcion_Completa: u.descripcion_completa || '',
    Activa: u.activa ? 'TRUE' : 'FALSE',
  };
}

function _equipoSbToObj(e) {
  return {
    ID_Activo: e.id_activo || '',
    Tipo_Equipo: e.tipo_equipo || '',
    Marca: e.marca || '',
    Modelo: e.modelo || '',
    Numero_Serie: e.numero_serie || '',
    Ubicacion: e.ubicacion || '',
    Responsable: e.responsable || '',
    Fecha_Adquisicion: e.fecha_adquisicion || '',
    Origen_Financiacion: e.origen_financiacion || '',
    Proveedor_Compra: e.proveedor_compra || '',
    Proveedor_Servicio_Tecnico: e.proveedor_servicio_tecnico || '',
    Estado_Operativo: e.estado_operativo || '',
    Periodicidad_Mantenimiento: '',
    Periodicidad_Custom: '',
    Fecha_Ultimo_Preventivo: '',
    Fecha_Proximo_Preventivo: '',
    Manual_Ficha_Tecnica: e.manual_ficha_tecnica || '',
    Observaciones: e.observaciones || '',
    Coste: e.coste != null ? String(e.coste) : '',
    Protocolo_Uso: e.protocolo_uso || '',
    Tipo_Mantenimiento: e.tipo_mantenimiento || '',
    Mes_Inicio_Temporada: e.mes_inicio_temporada != null ? String(e.mes_inicio_temporada) : '',
    Mes_Fin_Temporada: e.mes_fin_temporada != null ? String(e.mes_fin_temporada) : '',
  };
}

// "ID – Tipo Marca Modelo", igual que ya construía seleccionarEquipoIncidencia()
// a mano — se reconstruye aquí para que el campo Equipo de intervenciones/
// incidencias siga mostrándose igual que antes de migrar (DATA.equipos ya
// está poblado en loadAllData() cuando se llama a esto).
function _equipoConLabel(idEquipo) {
  if (!idEquipo) return '';
  const eq = DATA.equipos.find(e => e.ID_Activo === idEquipo);
  if (!eq) return idEquipo;
  const label = [eq.Tipo_Equipo, eq.Marca, eq.Modelo].filter(Boolean).join(' ');
  return label ? `${idEquipo} – ${label}` : idEquipo;
}

const _boolSb = v => v === true ? 'Sí' : (v === false ? 'No' : '');

function _intervencionSbToObj(i) {
  return {
    ID_Intervencion: i.id_intervencion || '',
    Equipo: _equipoConLabel(i.id_equipo),
    Tipo: i.tipo || '',
    Origen: i.origen || '',
    Fecha_Planificada: i.fecha_planificada || '',
    Fecha_Realizacion: i.fecha_realizacion || '',
    Realizado_Por: i.realizado_por || '',
    Tecnico_Externo: i.tecnico_externo || '',
    Proveedor: i.proveedor || '',
    Descripcion_Actuacion: i.descripcion_actuacion || '',
    Resultado: i.resultado || '',
    Equipo_Operativo_Tras_Intervencion: _boolSb(i.equipo_operativo_tras_intervencion),
    URL_Adjunto: i.url_adjunto || '',
    Factura_Asociada: i.factura_asociada || '',
    Actualiza_Proximo_Preventivo: _boolSb(i.actualiza_proximo_preventivo),
    Observaciones: i.observaciones || '',
    Nombre_Adjunto: i.nombre_adjunto || '',
    Estado: i.estado || '',
    Fecha_Estimada_Resolucion: i.fecha_estimada_resolucion || '',
    Coste_Intervencion: i.coste_intervencion != null ? String(i.coste_intervencion) : '',
  };
}

function _incidenciaSbToObj(i) {
  return {
    ID_Incidencia: i.id_incidencia || '',
    Equipo: _equipoConLabel(i.id_equipo),
    Reportado_Por: i.reportado_por || '',
    Fecha_Hora: (i.fecha_hora || '').replace('T', ' ').slice(0, 16),
    Descripcion_Problema: i.descripcion_problema || '',
    Impacto: i.impacto || '',
    Urgencia: i.urgencia || '',
    Estado: i.estado || '',
    Intervencion_Generada: i.intervencion_generada || '',
    Relacionada_Con: i.relacionada_con || '',
  };
}

function _tareaSbToObj(t) {
  return {
    ID_Tarea: t.id_tarea || '',
    ID_Intervencion: t.id_intervencion || '',
    Descripcion: t.descripcion || '',
    Resultado: t.resultado || '',
    Operativo: _boolSb(t.operativo),
    Observaciones: t.observaciones || '',
  };
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
async function añadirLote(idMaterial, idUbicacion, stockLocal, stockMin, stockOpt, idLotePadre = '', unidadLote = '') {
  const id = genId('LU');
  const row = [id, idMaterial, idUbicacion, String(stockLocal), String(stockMin || 0), String(stockOpt || 0), idLotePadre || '', unidadLote || ''];
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
  await sheetsUpdate(`Material_Ubicaciones!A${fila}:H${fila}`, ['', '', '', '', '', '', '', '']);
  DATA.materialUbicaciones.splice(loteIndex, 1);
}

// ============================================================
// CARGAR TODOS LOS DATOS
// ============================================================
async function loadAllData() {
  showLoading('Cargando datos...');
  try {
    const [equipos, intervenciones, incidencias, tareasIntervencion, proveedores, ubicaciones, usuarios,
           material, movimientos, solicitudes, pedidos, lineasPedido, ciclosModulos,
           materialUbicaciones, historicoPrecio, tareas,
           planesMantenimiento, registroMantenimientos,
           tiposResiduo, contenedoresResiduo, adicionesResiduo,
           revisionesInventario, consultasResiduo,
           configReservas, reservas, registrosCabina, registrosAutoclave,
           sbCiclosRes, sbModulosRes, sbModuloCicloRes, sbUserModulosRes, sbUsuariosRes,
           sbProveedoresRes, sbUbicacionesRes, sbEquiposRes,
           sbIntervencionesRes, sbIncidenciasRes, sbTareasRes] = await Promise.all([
      sheetsGet('Equipos!A2:W'),
      sheetsGet('Intervenciones!A2:T'),
      sheetsGet('Incidencias!A2:J'),
      sheetsGet('Tareas_Intervencion!A2:F').catch(() => []),
      sheetsGet('Proveedores!A2:I'),
      sheetsGet('Ubicaciones!A2:F'),
      sheetsGet('Usuarios!A2:I'),
      sheetsGet('Material!A2:L'),
      sheetsGet('Movimientos!A2:H'),
      sheetsGet('Solicitudes!A2:K'),
      sheetsGet('Pedidos!A2:U'),
      sheetsGet('Lineas_Pedido!A2:I'),
      sheetsGet('Ciclos_Modulos!A2:B'),
      sheetsGet('Material_Ubicaciones!A2:H'),
      sheetsGet('Historico_Precios!A2:F').catch(() => []),
      sheetsGet('Tareas_Usuario!A2:F').catch(() => []),
      sheetsGet('Planes_Mantenimiento!A2:H').catch(e => { console.warn('Planes_Mantenimiento no cargó:', e); return []; }),
      sheetsGet('Registro_Mantenimientos!A2:I').catch(e => { console.warn('Registro_Mantenimientos no cargó:', e); return []; }),
      sheetsGet('Tipos_Residuo!A2:G').catch(() => []),
      sheetsGet('Contenedores_Residuo!A2:K').catch(() => []),
      sheetsGet('Adiciones_Residuo!A2:F').catch(() => []),
      sheetsGet('Revisiones_Inventario!A2:I').catch(() => []),
      sheetsGet('Consultas_Residuo!A2:F').catch(() => []),
      sheetsGet('Config_Reservas!A2:E').catch(() => []),
      sheetsGet('Reservas_Equipos!A2:L').catch(() => []),
      sheetsGet('Registros_Cabina!A2:L').catch(() => []),
      sheetsGet('Registros_Autoclave!A2:K').catch(() => []),
      // Supabase — en paralelo con Sheets (usar .then(r=>r, fallback) porque el builder no tiene .catch())
      _sb.from('ciclos').select('id,nombre').then(r => r, () => ({ data: [] })),
      _sb.from('modulos').select('id,nombre,lab_teoria,lab_practicas').then(r => r, () => ({ data: [] })),
      _sb.from('modulo_ciclo').select('modulo_id,ciclo_id').then(r => r, () => ({ data: [] })),
      _sb.from('user_modulos').select('user_id,modulo_id,curso_academico').then(r => r, () => ({ data: [] })),
      _sb.from('users').select('id,email,full_name,role,ciclo_principal,is_active,puede_revisar_inventario').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('proveedores').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('ubicaciones').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('equipos').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('intervenciones').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('incidencias').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('tareas_intervencion').select('*').then(r => r, () => ({ data: [] }))
    ]);

    const toObj = (rows, type) => rows.filter(r => r.length && r[0]).map(r => rowToObj(r, type));

    DATA.equipos             = toObj(equipos,             'equipos');
    const sbEquipos = sbEquiposRes?.data || [];
    if (sbEquipos.length) {
      DATA.equipos = sbEquipos.map(_equipoSbToObj);
    }
    DATA.intervenciones      = toObj(intervenciones,      'intervenciones');
    const sbIntervenciones = sbIntervencionesRes?.data || [];
    if (sbIntervenciones.length) {
      DATA.intervenciones = sbIntervenciones.map(_intervencionSbToObj);
    }
    DATA.incidencias         = toObj(incidencias,         'incidencias');
    const sbIncidencias = sbIncidenciasRes?.data || [];
    if (sbIncidencias.length) {
      DATA.incidencias = sbIncidencias.map(_incidenciaSbToObj);
    }
    DATA.tareasIntervencion  = toObj(tareasIntervencion || [], 'tareasIntervencion');
    const sbTareas = sbTareasRes?.data || [];
    if (sbTareas.length) {
      DATA.tareasIntervencion = sbTareas.map(_tareaSbToObj);
    }
    DATA.proveedores         = toObj(proveedores,         'proveedores');
    const sbProveedores = sbProveedoresRes?.data || [];
    if (sbProveedores.length) {
      DATA.proveedores = sbProveedores.map(_proveedorSbToObj);
    }
    DATA.ubicaciones         = toObj(ubicaciones,         'ubicaciones');
    const sbUbicaciones = sbUbicacionesRes?.data || [];
    if (sbUbicaciones.length) {
      DATA.ubicaciones = sbUbicaciones.map(_ubicacionSbToObj);
    }
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
    DATA.registrosCabina        = toObj(registrosCabina        || [], 'registrosCabina');
    DATA.registrosAutoclave     = toObj(registrosAutoclave     || [], 'registrosAutoclave');

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

    // Complementar DATA.usuarios con profesores/alumnos de Supabase que tengan módulos con lab asignado
    const _roleMap    = { TEACHER: 'Profesor', STUDENT: 'Alumno' };
    const _emailsSheets = new Set(DATA.usuarios.map(u => (u.Email || '').toLowerCase().trim()));
    sbUsuarios
      .filter(su =>
        (su.role === 'TEACHER' || su.role === 'STUDENT') &&
        DATA.userModulos.some(um => um.user_id === su.id && (um.lab_teoria || um.lab_practicas))
      )
      .forEach(su => {
        if (_emailsSheets.has((su.email || '').toLowerCase().trim())) return;
        const misModulos = DATA.userModulos.filter(um => um.user_id === su.id);
        const labs   = [...new Set(misModulos.flatMap(um => [um.lab_teoria, um.lab_practicas].filter(Boolean)))];
        const modulos = [...new Set(misModulos.map(um => um.nombre_modulo).filter(Boolean))];
        DATA.usuarios.push({
          ID_Usuario:               su.id,
          Nombre:                   su.full_name             || '',
          Email:                    su.email                 || '',
          Rol:                      _roleMap[su.role]        || '',
          Activo:                   su.is_active ? 'TRUE' : 'FALSE',
          Ubicaciones_Asignadas:    labs.join(','),
          Modulo:                   modulos.join(','),
          Ciclo_Principal:          su.ciclo_principal       || '',
          Puede_Revisar_Inventario: su.puede_revisar_inventario ? 'TRUE' : 'FALSE',
          _sbOnly: true
        });
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
