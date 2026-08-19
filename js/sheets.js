// ============================================================
// SUPABASE — carga de datos y llamadas a Edge Functions
// ============================================================

// ----------------------------------------------------------------
// callEdgeFunction — wrapper para las Edge Functions de Supabase que hacen
// de "servidor" de GestionLab (crear-usuario, gestionar-proveedor...).
// Reenvía el access_token de la sesión de Supabase Auth actual: el gateway
// de Edge Functions lo usa para verificar la firma, y la propia función
// vuelve a comprobarlo (auth.getUser) para identificar el rol server-side.
// ----------------------------------------------------------------
async function callEdgeFunction(nombre, body) {
  if (previewRole) throw new Error('Estás en vista previa — sal de ese modo para guardar cambios reales');
  const { data: { session } } = await _sbMigracion.auth.getSession();
  const r = await fetch(`${SUPABASE_MIGRACION_URL}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token || SUPABASE_MIGRACION_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Error del servidor (${r.status})`);
  return data;
}

// ----------------------------------------------------------------
// subirDocumento / abrirDocumento — Storage privado de Supabase (bucket
// "documentos"), sustituye a la subida directa a Google Drive de antes de
// la migración de login. subirDocumento devuelve una ruta interna (no una
// URL pública, el bucket es privado); abrirDocumento pide un enlace firmado
// de 1h justo antes de abrirlo. Los valores ya guardados con el sistema
// antiguo son URLs de Drive completas (http…) — abrirDocumento las abre
// directamente sin pasar por el bucket.
// ----------------------------------------------------------------
async function subirDocumento(tipo, id, fileData, fileName, fileType) {
  const { path } = await callEdgeFunction('subir-documento', {
    tipo, id, nombre_archivo: fileName, tipo_mime: fileType, contenido_base64: fileData,
  });
  return path;
}

async function abrirDocumento(path) {
  if (!path) return;
  if (/^https?:\/\//i.test(path)) { window.open(path, '_blank'); return; }
  try {
    const { data: { session } } = await _sbMigracion.auth.getSession();
    const r = await fetch(`${SUPABASE_MIGRACION_URL}/functions/v1/obtener-documento?path=${encodeURIComponent(path)}`, {
      headers: { 'Authorization': `Bearer ${session?.access_token || SUPABASE_MIGRACION_ANON}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Error del servidor (${r.status})`);
    window.open(data.url, '_blank');
  } catch(e) { showToast(e.message || 'No se pudo abrir el documento', 'error'); }
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

function _planMantenimientoSbToObj(p) {
  return {
    ID_Plan: p.id_plan || '',
    ID_Equipo: p.id_equipo || '',
    Tipo_Intervencion: p.tipo_intervencion || '',
    Periodicidad: p.periodicidad || '',
    Operacion: p.operacion || '',
    Activo: p.activo ? 'TRUE' : 'FALSE',
    Instrucciones: p.instrucciones || '',
    Con_Alumnado: p.con_alumnado ? 'Sí' : 'No',
  };
}

function _registroMantSbToObj(r) {
  return {
    ID_Registro: r.id_registro || '',
    ID_Plan: r.id_plan || '',
    ID_Equipo: r.id_equipo || '',
    Curso_Academico: r.curso_academico || '',
    Periodo: r.periodo || '',
    Fecha_Realizacion: r.fecha_realizacion || '',
    Realizado_Por: r.realizado_por || '',
    Supervisado_Por: r.supervisado_por || '',
    Observaciones: r.observaciones || '',
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

function _materialSbToObj(m) {
  return {
    ID_Material: m.id_material || '',
    Nombre: m.nombre || '',
    Categoria: m.categoria || '',
    Referencia_Proveedor: m.referencia_proveedor || '',
    Proveedor: m.proveedor || '',
    Unidad: m.unidad || '',
    Unidades_Extra: m.unidades_extra || '',
    Ubicacion: m.ubicacion || '',
    Stock_Actual: m.stock_actual != null ? String(m.stock_actual) : '0',
    Stock_Minimo: m.stock_minimo != null ? String(m.stock_minimo) : '0',
    Stock_Optimo: m.stock_optimo != null ? String(m.stock_optimo) : '0',
    Observaciones: m.observaciones || '',
    Gestion_Automatica: m.gestion_automatica ? 'TRUE' : 'FALSE',
  };
}

function _materialUbicacionSbToObj(l) {
  return {
    ID: l.id || '',
    ID_Material: l.id_material || '',
    ID_Ubicacion: l.id_ubicacion || '',
    Stock_Local: l.stock_local != null ? String(l.stock_local) : '0',
    Stock_Minimo_Local: l.stock_minimo_local != null ? String(l.stock_minimo_local) : '',
    Stock_Optimo_Local: l.stock_optimo_local != null ? String(l.stock_optimo_local) : '',
    ID_Lote_Padre: l.id_lote_padre || '',
    Unidad_Lote: l.unidad_lote || '',
  };
}

function _pedidoSbToObj(p) {
  return {
    ID_Pedido: p.id_pedido || '',
    Nombre_Lista: p.nombre_lista || '',
    Proveedor: p.proveedor || '',
    Fecha_Creacion: p.fecha_creacion || '',
    Fecha_Presupuesto: p.fecha_presupuesto || '',
    Fecha_Aprobacion: p.fecha_aprobacion || '',
    Fecha_Pedido_Enviado: p.fecha_pedido_enviado || '',
    Fecha_Recepcion_Completa: p.fecha_recepcion_completa || '',
    Fecha_Factura: p.fecha_factura || '',
    Estado: p.estado || 'Abierto',
    Numero_Presupuesto: p.numero_presupuesto || '',
    Numero_Factura: p.numero_factura || '',
    Observaciones: p.observaciones || '',
    Doc_Hoja_Generada: p.doc_hoja_generada ? 'TRUE' : '',
    Doc_Hoja_Completada: '',
    Doc_Enviada_Jefatura: p.doc_enviada_jefatura ? 'TRUE' : '',
    Ciclo: p.ciclo || '',
    Modulo: p.modulo || '',
    Tipo: p.tipo || 'Material',
    Gasto_Extra_Concepto: p.gasto_extra_concepto || '',
    Gasto_Extra_Importe: p.gasto_extra_importe != null ? String(p.gasto_extra_importe) : '',
    Token_Publico: p.token_publico || '',
  };
}

function _documentoProveedorSbToObj(d) {
  return {
    ID_Documento: d.id_documento || '',
    Pedido: d.pedido || '',
    Nombre_Archivo: d.nombre_archivo || '',
    Path: d.path || '',
    Tamano_Bytes: d.tamano_bytes != null ? String(d.tamano_bytes) : '',
    Fecha_Subida: d.fecha_subida || '',
    Datos_Extraidos: d.datos_extraidos || null,
    Extraido_En: d.extraido_en || '',
  };
}

function _lineaPedidoSbToObj(l) {
  return {
    ID_Linea: l.id_linea || '',
    Pedido: l.pedido || '',
    Material: l.material || '',
    Cantidad_Pedida: l.cantidad_pedida != null ? String(l.cantidad_pedida) : '',
    Cantidad_Recibida: l.cantidad_recibida != null ? String(l.cantidad_recibida) : '0',
    Estado_Linea: l.estado_linea || '',
    Observaciones: l.observaciones || '',
    Precio_Unitario: l.precio_unitario != null ? String(l.precio_unitario) : '',
    ID_Equipo: l.id_equipo || '',
    Unidad: l.unidad || '',
  };
}

function _solicitudSbToObj(s) {
  return {
    ID_Solicitud: s.id_solicitud || '',
    Material: s.material || '',
    Cantidad_Solicitada: s.cantidad_solicitada != null ? String(s.cantidad_solicitada) : '',
    Solicitante: s.solicitante || '',
    Fecha: (s.fecha || '').slice(0, 10),
    Motivo: s.motivo || '',
    Proveedor_Requerido: s.proveedor_requerido || '',
    Estado: s.estado || 'Pendiente',
    Lista_Pedido: s.lista_pedido || '',
    Observaciones: s.observaciones || '',
    Snooze_Hasta: s.snooze_hasta || '',
  };
}

function _historicoPrecioSbToObj(h) {
  return {
    ID_Historico: h.id_historico || '',
    Nombre_Material: h.nombre_material || '',
    ID_Pedido: h.id_pedido || '',
    Proveedor: h.proveedor || '',
    Fecha: h.fecha || '',
    Precio_Unitario: h.precio_unitario != null ? String(h.precio_unitario) : '',
  };
}

function _movimientoSbToObj(m) {
  return {
    ID_Movimiento: m.id_movimiento || '',
    Material: m.material || '',
    Tipo: m.tipo || '',
    Cantidad: m.cantidad != null ? String(m.cantidad) : '',
    Usuario: m.usuario || '',
    Fecha: (m.fecha || '').slice(0, 10),
    Motivo: m.motivo || '',
    Observaciones: m.observaciones || '',
  };
}

function _revisionInventarioSbToObj(r) {
  return {
    ID_Revision: r.id_revision || '',
    Fecha: (r.fecha || '').slice(0, 10),
    ID_Material: r.id_material || '',
    Nombre_Material: r.nombre_material || '',
    Stock_App: r.stock_app != null ? String(r.stock_app) : '',
    Stock_Real: r.stock_real != null ? String(r.stock_real) : '',
    Diferencia: r.diferencia != null ? String(r.diferencia) : '',
    Usuario: r.usuario || '',
    Observaciones: r.observaciones || '',
  };
}

function _tipoResiduoSbToObj(t) {
  return {
    ID_Residuo: t.id_residuo || '',
    Nombre: t.nombre || '',
    Descripcion: t.descripcion || '',
    Riesgo: t.riesgo || '',
    Contenedor_Tipo: t.contenedor_tipo || '',
    Lab: t.lab || '',
    Zona: t.zona || '',
  };
}

function _contenedorResiduoSbToObj(c) {
  return {
    ID_Contenedor: c.id_contenedor || '',
    Categoria: c.categoria || '',
    Lab: c.lab || '',
    Zona: c.zona || '',
    Nivel: c.nivel || '',
    Estado: c.estado || 'activo',
    Fecha_Apertura: c.fecha_apertura || '',
    Fecha_Cierre: c.fecha_cierre || '',
    Fecha_Actualizacion: (c.fecha_actualizacion || '').slice(0, 10),
    Actualizado_Por: c.actualizado_por || '',
    Formato: c.formato || '',
  };
}

function _adicionResiduoSbToObj(a) {
  return {
    ID_Adicion: a.id_adicion || '',
    ID_Contenedor: a.id_contenedor || '',
    ID_Residuo: a.id_residuo || '',
    Fecha: (a.fecha || '').slice(0, 10),
    Usuario: a.usuario || '',
    Observaciones: a.observaciones || '',
  };
}

function _tareaPersonalSbToObj(t) {
  return {
    ID_Tarea: t.id_tarea || '',
    Email: t.email || '',
    Texto: t.texto || '',
    Fecha_Limite: t.fecha_limite || '',
    Completada: t.completada ? 'true' : 'false',
    Fecha_Creacion: (t.fecha_creacion || '').slice(0, 10),
  };
}

function _consultaResiduoSbToObj(c) {
  return {
    ID_Consulta: c.id_consulta || '',
    Fecha: (c.fecha || '').slice(0, 10),
    Usuario: c.usuario || '',
    Descripcion: c.descripcion || '',
    Ubicacion_Dejado: c.ubicacion_dejado || '',
    Estado: c.estado || 'Pendiente',
  };
}

function _configReservaSbToObj(c) {
  return {
    ID_Equipo: c.id_equipo || '',
    Politica: c.politica || 'BLOCK',
    Params_Template: JSON.stringify(c.params_template || []),
    Max_Horas: c.max_horas != null ? String(c.max_horas) : '',
    Antelacion_Min_Horas: c.antelacion_min_horas != null ? String(c.antelacion_min_horas) : '',
  };
}

function _reservaSbToObj(r) {
  return {
    ID_Reserva: r.id_reserva || '',
    ID_Equipo: r.id_equipo || '',
    Usuario: r.usuario || '',
    Fecha_Inicio: r.fecha_inicio || '',
    Fecha_Fin: r.fecha_fin || '',
    Condiciones: JSON.stringify(r.condiciones || {}),
    Proposito: r.proposito || '',
    Estado: r.estado || 'Confirmada',
    Aprobado_Por: r.aprobado_por || '',
    Observaciones_Admin: r.observaciones_admin || '',
    Inicio_Real: r.inicio_real || '',
    Fin_Real: r.fin_real || '',
  };
}

function _registroCabinaSbToObj(r) {
  return {
    ID_Registro: r.id_registro || '',
    ID_Equipo: r.id_equipo || '',
    Usuario: r.usuario || '',
    Fecha: r.fecha || '',
    Hora_Inicio: (r.hora_inicio || '').slice(0, 5),
    Hora_Fin: (r.hora_fin || '').slice(0, 5),
    Practica_Tecnica: r.practica_tecnica || '',
    Nivel_Riesgo: r.nivel_riesgo || '',
    Verificacion_Previa: r.verificacion_previa || '',
    Descontaminacion_Posterior: r.descontaminacion_posterior || '',
    Incidencias: r.incidencias || '',
    Estado: r.estado || 'Abierta',
  };
}

function _registroAutoclaveSbToObj(r) {
  return {
    ID_Registro: r.id_registro || '',
    ID_Equipo: r.id_equipo || '',
    Usuario: r.usuario || '',
    Fecha: r.fecha || '',
    Hora_Inicio: (r.hora_inicio || '').slice(0, 5),
    Hora_Fin: (r.hora_fin || '').slice(0, 5),
    Programa_Ciclo: r.programa_ciclo || '',
    Tipo_Carga: r.tipo_carga || '',
    Resultado_Control: r.resultado_control || '',
    Incidencias: r.incidencias || '',
    Estado: r.estado || 'Cerrada',
  };
}

function _usuarioSbToObj(u) {
  return {
    ID_Usuario: u.id_usuario || '',
    Nombre: u.nombre || '',
    Email: u.email || '',
    Rol: u.rol || 'Alumno',
    Activo: u.activo ? 'TRUE' : 'FALSE',
    Ubicaciones_Asignadas: u.ubicaciones_asignadas || '',
    Modulo: u.modulo || '',
    Ciclo_Principal: u.ciclo_principal || '',
    Puede_Revisar_Inventario: u.puede_revisar_inventario ? 'TRUE' : '',
  };
}

// ============================================================
// CARGAR TODOS LOS DATOS
// ============================================================
async function loadAllData() {
  showLoading('Cargando datos...');
  try {
    const [sbCiclosRes, sbModulosRes, sbModuloCicloRes, sbUserModulosRes, sbUsuariosRes,
           sbProveedoresRes, sbUbicacionesRes, sbEquiposRes,
           sbIntervencionesRes, sbIncidenciasRes, sbTareasRes,
           sbPlanesRes, sbRegistroMantRes,
           sbMaterialRes, sbMaterialUbicacionesRes, sbPedidosRes, sbLineasPedidoRes, sbDocumentosProveedorRes,
           sbSolicitudesRes, sbHistoricoPrecioRes, sbMovimientosRes, sbRevisionesRes,
           sbConfigReservasRes, sbReservasRes,
           sbRegistrosCabinaRes, sbRegistrosAutoclaveRes, sbUsuariosCatalogoRes,
           sbTiposResiduoRes, sbContenedoresResiduoRes, sbAdicionesResiduoRes, sbConsultasResiduoRes,
           sbTareasPersonalesRes] = await Promise.all([
      // .then(r=>r, fallback) porque el builder de Supabase no tiene .catch()
      _sb.from('ciclos').select('id,nombre').then(r => r, () => ({ data: [] })),
      _sb.from('modulos').select('id,nombre,lab_teoria,lab_practicas').then(r => r, () => ({ data: [] })),
      _sb.from('modulo_ciclo').select('modulo_id,ciclo_id').then(r => r, () => ({ data: [] })),
      _sb.from('user_modulos').select('user_id,modulo_id,curso_academico').then(r => r, () => ({ data: [] })),
      // 'email' se quitó del select: esa columna ya no existe en public.users del proyecto
      // compartido (probablemente movida a auth.users por la otra app) — el select fallaba
      // con 400 (42703). Sin poder leer el email no se puede casar por email de todas formas,
      // así que este bloque queda inerte hasta averiguar el nombre real de la columna con quien
      // mantenga ese proyecto (Sanidad CMA / app de Vercel). La tabla devuelve 0 filas hoy.
      _sb.from('users').select('id,full_name,role,ciclo_principal,is_active,puede_revisar_inventario').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('proveedores').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('ubicaciones').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('equipos').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('intervenciones').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('incidencias').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('tareas_intervencion').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('planes_mantenimiento').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('registro_mantenimientos').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('material').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('material_ubicaciones').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('pedidos').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('lineas_pedido').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('documentos_proveedor').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('solicitudes').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('historico_precio').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('movimientos').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('revisiones_inventario').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('config_reservas').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('reservas_equipos').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('registros_cabina').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('registros_autoclave').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('usuarios').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('tipos_residuo').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('contenedores_residuo').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('adiciones_residuo').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('consultas_residuo').select('*').then(r => r, () => ({ data: [] })),
      _sbMigracion.from('tareas_personales').select('*').then(r => r, () => ({ data: [] }))
    ]);

    DATA.equipos                 = (sbEquiposRes?.data || []).map(_equipoSbToObj);
    DATA.intervenciones          = (sbIntervencionesRes?.data || []).map(_intervencionSbToObj);
    DATA.incidencias             = (sbIncidenciasRes?.data || []).map(_incidenciaSbToObj);
    DATA.tareasIntervencion      = (sbTareasRes?.data || []).map(_tareaSbToObj);
    DATA.proveedores             = (sbProveedoresRes?.data || []).map(_proveedorSbToObj);
    DATA.ubicaciones             = (sbUbicacionesRes?.data || []).map(_ubicacionSbToObj);
    DATA.usuarios                = (sbUsuariosCatalogoRes?.data || []).map(_usuarioSbToObj);
    DATA.material                = (sbMaterialRes?.data || []).map(_materialSbToObj);
    DATA.movimientos             = (sbMovimientosRes?.data || []).map(_movimientoSbToObj);
    DATA.solicitudes             = (sbSolicitudesRes?.data || []).map(_solicitudSbToObj);
    DATA.pedidos                 = (sbPedidosRes?.data || []).map(_pedidoSbToObj);
    DATA.lineasPedido            = (sbLineasPedidoRes?.data || []).map(_lineaPedidoSbToObj);
    DATA.documentosProveedor     = (sbDocumentosProveedorRes?.data || []).map(_documentoProveedorSbToObj);
    DATA.ciclosModulos           = []; // se construye más abajo desde la tabla pivot modulo_ciclo
    DATA.materialUbicaciones     = (sbMaterialUbicacionesRes?.data || []).map(_materialUbicacionSbToObj);
    DATA.historicoPrecio         = (sbHistoricoPrecioRes?.data || []).map(_historicoPrecioSbToObj);
    DATA.tareas                  = (sbTareasPersonalesRes?.data || []).map(_tareaPersonalSbToObj);
    DATA.planesMantenimiento     = (sbPlanesRes?.data || []).map(_planMantenimientoSbToObj);
    DATA.registroMantenimientos  = (sbRegistroMantRes?.data || []).map(_registroMantSbToObj);
    DATA.tiposResiduo            = (sbTiposResiduoRes?.data || []).map(_tipoResiduoSbToObj);
    DATA.contenedoresResiduo     = (sbContenedoresResiduoRes?.data || []).map(_contenedorResiduoSbToObj);
    DATA.adicionesResiduo        = (sbAdicionesResiduoRes?.data || []).map(_adicionResiduoSbToObj);
    DATA.revisionesInventario    = (sbRevisionesRes?.data || []).map(_revisionInventarioSbToObj);
    DATA.consultasResiduo        = (sbConsultasResiduoRes?.data || []).map(_consultaResiduoSbToObj);
    DATA.configReservas          = (sbConfigReservasRes?.data || []).map(_configReservaSbToObj);
    DATA.reservas                = (sbReservasRes?.data || []).map(_reservaSbToObj);
    DATA.registrosCabina         = (sbRegistrosCabinaRes?.data || []).map(_registroCabinaSbToObj);
    DATA.registrosAutoclave      = (sbRegistrosAutoclaveRes?.data || []).map(_registroAutoclaveSbToObj);

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
    showToast('Error cargando datos. Comprueba tu conexión.', 'error');
    console.error(e);
  }
  hideLoading();
}
