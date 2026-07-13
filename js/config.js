// ============================================================
// CONFIGURACIÓN
// ============================================================
const CLIENT_ID = '617390713769-milqb8jfdk9l6bd63bh52bbronivablb.apps.googleusercontent.com';
const SHEET_ID  = '1YeoIPn3UqvcljptbgJIX-1CdrDLwIiT_3vcOy8k2Acg';
const SCOPES    = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file profile email';

const SUPABASE_URL  = 'https://clxcjsvkmaydpxvtqesv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseGNqc3ZrbWF5ZHB4dnRxZXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDI1OTEsImV4cCI6MjA5NDYxODU5MX0._uu-RO_AtA88mh3eC8oPBf7ikD2X5w-otl91pHSJ7GA';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// ESTADO GLOBAL
// ============================================================
let accessToken;  // tokenClient se declara en auth.js
let currentUser  = null;
let editingRow   = null;
let pendingFileBase64   = null;
let pendingEqFileBase64 = null;
let _pendingSolicitudParaPedido = null;
let _pendingRecepcion           = null;

let DATA = {
  equipos: [], intervenciones: [], incidencias: [],
  proveedores: [], ubicaciones: [], usuarios: [],
  material: [], movimientos: [], solicitudes: [],
  pedidos: [], lineasPedido: [], ciclosModulos: [],
  materialUbicaciones: [], historicoPrecio: [], tareas: [],
  planesMantenimiento: [], registroMantenimientos: [],
  tiposResiduo: [], contenedoresResiduo: [], adicionesResiduo: [],
  revisionesInventario: [], consultasResiduo: [],
  configReservas: [], reservas: [],
  // Supabase
  sbUsuarios: [],   // usuarios de Supabase (id uuid, email, role, ciclo_principal…)
  userModulos: []   // asignaciones usuario→módulo enriquecidas con labs
};

// ============================================================
// MAPAS DE COLUMNAS
// ============================================================
const COLS = {
  equipos:            ['ID_Activo','Tipo_Equipo','Marca','Modelo','Numero_Serie','Ubicacion','Responsable','Fecha_Adquisicion','Origen_Financiacion','Proveedor_Compra','Proveedor_Servicio_Tecnico','Estado_Operativo','Periodicidad_Mantenimiento','Periodicidad_Custom','Fecha_Ultimo_Preventivo','Fecha_Proximo_Preventivo','Manual_Ficha_Tecnica','Observaciones','Coste','Protocolo_Uso','Tipo_Mantenimiento','Mes_Inicio_Temporada','Mes_Fin_Temporada'],
  intervenciones:     ['ID_Intervencion','Equipo','Tipo','Origen','Fecha_Planificada','Fecha_Realizacion','Realizado_Por','Tecnico_Externo','Proveedor','Descripcion_Actuacion','Resultado','Equipo_Operativo_Tras_Intervencion','URL_Adjunto','Factura_Asociada','Actualiza_Proximo_Preventivo','Observaciones','Nombre_Adjunto','Estado','Fecha_Estimada_Resolucion','Coste_Intervencion'],
  incidencias:        ['ID_Incidencia','Equipo','Reportado_Por','Fecha_Hora','Descripcion_Problema','Impacto','Urgencia','Estado','Intervencion_Generada'],
  proveedores:        ['ID_Proveedor','Nombre_Proveedor','Tipo_Proveedor','Persona_Contacto','Email_Contacto','Telefono','Web','Observaciones','Activo'],
  ubicaciones:        ['ID_Ubicacion','Laboratorio_Aula','Zona','Subzona','Descripcion_Completa','Activa'],
  usuarios:           ['ID_Usuario','Nombre','Email','Rol','Activo','Ubicaciones_Asignadas','Modulo','Ciclo_Principal','Puede_Revisar_Inventario'],
  material:           ['ID_Material','Nombre','Categoria','Referencia_Proveedor','Proveedor','Unidad','Ubicacion','Stock_Actual','Stock_Minimo','Stock_Optimo','Observaciones','Gestion_Automatica'],
  movimientos:        ['ID_Movimiento','Material','Tipo','Cantidad','Usuario','Fecha','Motivo','Observaciones'],
  solicitudes:        ['ID_Solicitud','Material','Cantidad_Solicitada','Solicitante','Fecha','Motivo','Proveedor_Requerido','Estado','Lista_Pedido','Observaciones'],
  pedidos:            ['ID_Pedido','Nombre_Lista','Proveedor','Fecha_Creacion','Fecha_Presupuesto','Fecha_Aprobacion','Fecha_Pedido_Enviado','Fecha_Recepcion_Completa','Fecha_Factura','Estado','Numero_Presupuesto','Numero_Factura','Observaciones','Doc_Hoja_Generada','Doc_Hoja_Completada','Doc_Enviada_Jefatura','Ciclo','Modulo','Tipo','Gasto_Extra_Concepto','Gasto_Extra_Importe'],
  lineasPedido:       ['ID_Linea','Pedido','Material','Cantidad_Pedida','Cantidad_Recibida','Estado_Linea','Observaciones','Precio_Unitario','ID_Equipo'],
  ciclosModulos:      ['Ciclo','Modulo'],
  materialUbicaciones:['ID','ID_Material','ID_Ubicacion','Stock_Local','Stock_Minimo_Local','Stock_Optimo_Local','ID_Lote_Padre'],
  historicoPrecio:    ['ID_Historico','Nombre_Material','ID_Pedido','Proveedor','Fecha','Precio_Unitario'],
  tareas:             ['ID_Tarea','Email','Texto','Fecha_Limite','Completada','Fecha_Creacion'],
  planesMantenimiento:    ['ID_Plan','ID_Equipo','Tipo_Intervencion','Periodicidad','Operacion','Activo','Instrucciones','Con_Alumnado'],
  registroMantenimientos: ['ID_Registro','ID_Plan','ID_Equipo','Curso_Academico','Periodo','Fecha_Realizacion','Realizado_Por','Supervisado_Por','Observaciones'],
  tiposResiduo:           ['ID_Residuo','Nombre','Descripcion','Riesgo','Contenedor_Tipo','Lab','Zona'],
  contenedoresResiduo:    ['ID_Contenedor','Categoria','Lab','Zona','Nivel','Estado','Fecha_Apertura','Fecha_Cierre','Fecha_Actualizacion','Actualizado_Por','Formato'],
  adicionesResiduo:       ['ID_Adicion','ID_Contenedor','ID_Residuo','Fecha','Usuario','Observaciones'],
  revisionesInventario:   ['ID_Revision','Fecha','ID_Material','Nombre_Material','Stock_App','Stock_Real','Diferencia','Usuario','Observaciones'],
  consultasResiduo:       ['ID_Consulta','Fecha','Usuario','Descripcion','Ubicacion_Dejado','Estado'],
  configReservas:         ['ID_Equipo','Politica','Params_Template','Max_Horas','Antelacion_Min_Horas'],
  reservas:               ['ID_Reserva','ID_Equipo','Usuario','Fecha_Inicio','Fecha_Fin','Condiciones','Proposito','Estado','Aprobado_Por','Observaciones_Admin','Inicio_Real','Fin_Real']
};

function rowToObj(row, type) {
  const keys = COLS[type];
  const o = {};
  keys.forEach((k, i) => o[k] = row[i] || '');
  return o;
}

function genId(prefix) {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6);
}

// ============================================================
// HELPERS DE MATERIAL_UBICACIONES
// ============================================================

/** Devuelve los lotes por ubicación de un ID_Material */
function getMatUbics(idMaterial) {
  return DATA.materialUbicaciones.filter(u => u.ID_Material === idMaterial);
}

/** Calcula el stock total sumando los lotes. Si no hay lotes, usa Stock_Actual del ítem */
function getStockTotal(mat) {
  const lotes = getMatUbics(mat.ID_Material);
  if (!lotes.length) return parseFloat(mat.Stock_Actual) || 0;
  return lotes.reduce((sum, l) => sum + (parseFloat(l.Stock_Local) || 0), 0);
}

/** Calcula el stock mínimo total. Si no hay lotes, usa Stock_Minimo del ítem */
function getStockMinTotal(mat) {
  const lotes = getMatUbics(mat.ID_Material);
  if (!lotes.length) return parseFloat(mat.Stock_Minimo) || 0;
  return lotes.reduce((sum, l) => sum + (parseFloat(l.Stock_Minimo_Local) || 0), 0);
}

/** True si el ítem está por debajo del mínimo */
function stockBajoMinimo(mat) {
  const total = getStockTotal(mat);
  const min   = getStockMinTotal(mat);
  return min > 0 && total <= min;
}

/** Nombre de la ubicación a partir de su ID */
function getNombreUbicacion(idUbicacion) {
  const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === idUbicacion);
  if (!u) return idUbicacion;
  return u.Laboratorio_Aula ? `${u.ID_Ubicacion} – ${u.Laboratorio_Aula}` : u.ID_Ubicacion;
}

// ============================================================
// ZONA COMÚN — almacén central de suministro
// ============================================================
/** Palabras clave que identifican la ubicación "zona común" / almacén */
const ZONA_COMUN_KEYWORDS = ['zona común', 'zona comun', 'almacén', 'almacen', 'común', 'comun'];

/** True si una ubicación es la zona común / almacén central */
function esZonaComun(idUbicacion) {
  const u = DATA.ubicaciones.find(u => u.ID_Ubicacion === idUbicacion);
  if (!u) return false;
  const texto = [u.Laboratorio_Aula, u.Zona, u.Subzona, u.Descripcion_Completa].join(' ').toLowerCase();
  return ZONA_COMUN_KEYWORDS.some(k => texto.includes(k));
}

/**
 * True si el usuario actual (currentUser.name) figura como responsable del equipo.
 * El campo Responsable admite varios nombres separados por comas.
 */
function esResponsableDeEquipo(equipo) {
  if (!currentUser?.email) return false;
  // Usar el Nombre de la tabla Usuarios (no currentUser.name de Google),
  // porque el campo Responsable almacena exactamente ese valor.
  const emailNorm = currentUser.email.toLowerCase().trim();
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  if (!u) return false;
  const miNombre = (u.Nombre || '').toLowerCase().trim();
  if (!miNombre) return false;
  const responsables = (equipo.Responsable || '').split(',').map(r => r.trim().toLowerCase());
  return responsables.some(r => r === miNombre);
}

/**
 * Devuelve los ID_Ubicacion accesibles para el Alumno actual.
 * Primero intenta derivar los labs desde los módulos asignados en Supabase (user_modulos).
 * Si no hay datos en Supabase (migración pendiente), usa el campo Ubicaciones_Asignadas de Sheets.
 * La zona común se incluye siempre automáticamente.
 */
function getUbicacionesAlumno() {
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const zonasComun = DATA.ubicaciones
    .filter(ub => (ub.Laboratorio_Aula || '').trim() === '205 - Zona común')
    .map(ub => ub.ID_Ubicacion);

  // Fuente primaria: módulos asignados en Supabase
  const sbUser = DATA.sbUsuarios.find(u => (u.email || '').toLowerCase() === emailNorm);
  if (sbUser && DATA.userModulos.length) {
    const misModulos = DATA.userModulos.filter(um => um.user_id === sbUser.id);
    const labNums = [...new Set(misModulos.flatMap(um =>
      [um.lab_teoria, um.lab_practicas].filter(Boolean)
    ))];
    if (labNums.length) {
      const asignadas = labNums.flatMap(lab =>
        DATA.ubicaciones.filter(ub => (ub.Laboratorio_Aula || '').includes(lab)).map(ub => ub.ID_Ubicacion)
      );
      return [...new Set([...asignadas, ...zonasComun])];
    }
  }

  // Fallback: Ubicaciones_Asignadas de Sheets
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  const raw = (u?.Ubicaciones_Asignadas || '').split(',').map(s => s.trim()).filter(Boolean);
  const asignadas = raw.flatMap(val => {
    if (/^\d{3}$/.test(val)) {
      return DATA.ubicaciones.filter(ub => (ub.Laboratorio_Aula || '').includes(val)).map(ub => ub.ID_Ubicacion);
    }
    return [val];
  });
  return [...new Set([...asignadas, ...zonasComun])];
}

/** Devuelve los lotes de zona común de un material cuyo stock está bajo el mínimo local */
function getLotesZonaComunBajoMinimo(mat) {
  const lotes = getMatUbics(mat.ID_Material);
  return lotes.filter(l =>
    esZonaComun(l.ID_Ubicacion) &&
    parseFloat(l.Stock_Minimo_Local) > 0 &&
    parseFloat(l.Stock_Local) <= parseFloat(l.Stock_Minimo_Local)
  );
}
