// ============================================================
// CONFIGURACIÓN
// ============================================================
const CLIENT_ID = '617390713769-milqb8jfdk9l6bd63bh52bbronivablb.apps.googleusercontent.com';
const SHEET_ID  = '1YeoIPn3UqvcljptbgJIX-1CdrDLwIiT_3vcOy8k2Acg';
const SCOPES    = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file profile email';

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
  tiposResiduo: [], contenedoresResiduo: []
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
  usuarios:           ['ID_Usuario','Nombre','Email','Rol','Activo','Ubicaciones_Asignadas'],
  material:           ['ID_Material','Nombre','Categoria','Referencia_Proveedor','Proveedor','Unidad','Ubicacion','Stock_Actual','Stock_Minimo','Stock_Optimo','Observaciones','Gestion_Automatica'],
  movimientos:        ['ID_Movimiento','Material','Tipo','Cantidad','Usuario','Fecha','Motivo','Observaciones'],
  solicitudes:        ['ID_Solicitud','Material','Cantidad_Solicitada','Solicitante','Fecha','Motivo','Proveedor_Requerido','Estado','Lista_Pedido','Observaciones'],
  pedidos:            ['ID_Pedido','Nombre_Lista','Proveedor','Fecha_Creacion','Fecha_Presupuesto','Fecha_Aprobacion','Fecha_Pedido_Enviado','Fecha_Recepcion_Completa','Fecha_Factura','Estado','Numero_Presupuesto','Numero_Factura','Observaciones','Doc_Hoja_Generada','Doc_Hoja_Completada','Doc_Enviada_Jefatura','Ciclo','Modulo'],
  lineasPedido:       ['ID_Linea','Pedido','Material','Cantidad_Pedida','Cantidad_Recibida','Estado_Linea','Observaciones','Precio_Unitario'],
  ciclosModulos:      ['Ciclo','Modulo'],
  materialUbicaciones:['ID','ID_Material','ID_Ubicacion','Stock_Local','Stock_Minimo_Local','Stock_Optimo_Local'],
  historicoPrecio:    ['ID_Historico','Nombre_Material','ID_Pedido','Proveedor','Fecha','Precio_Unitario'],
  tareas:             ['ID_Tarea','Email','Texto','Fecha_Limite','Completada','Fecha_Creacion'],
  planesMantenimiento:    ['ID_Plan','ID_Equipo','Tipo_Intervencion','Periodicidad','Operacion','Activo','Instrucciones'],
  registroMantenimientos: ['ID_Registro','ID_Plan','ID_Equipo','Curso_Academico','Periodo','Fecha_Realizacion','Realizado_Por','Supervisado_Por','Observaciones'],
  tiposResiduo:           ['ID_Residuo','Nombre','Descripcion','Riesgo','Contenedor_Tipo','Lab','Zona'],
  contenedoresResiduo:    ['ID_Contenedor','ID_Residuo','Lab','Zona','Nivel','Fecha_Actualizacion','Actualizado_Por']
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
 * Devuelve los ID_Ubicacion accesibles para el Alumno actual:
 * - Los de su campo Ubicaciones_Asignadas (columna F en hoja Usuarios)
 * - Más todas las ubicaciones cuyo Laboratorio_Aula === '205 - Zona común'
 */
function getUbicacionesAlumno() {
  const emailNorm = (currentUser?.email || '').toLowerCase().trim();
  const u = DATA.usuarios.find(u => (u.Email || '').toLowerCase().trim() === emailNorm);
  const asignadas = (u?.Ubicaciones_Asignadas || '').split(',').map(s => s.trim()).filter(Boolean);
  const zonasComun = DATA.ubicaciones
    .filter(ub => (ub.Laboratorio_Aula || '').trim() === '205 - Zona común')
    .map(ub => ub.ID_Ubicacion);
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
