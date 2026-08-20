// Módulo Lineas_Pedido — crear, eliminar y recepción de líneas. Todo
// Admin/Gestor (mismo `gestionarPedidos` de PERMISOS que gestionar-pedido).
// La recepción es la pieza más delicada: reimplementa server-side todo lo
// que antes hacía _completarRecepcionLinea + subfunciones en
// js/pedidos-acciones.js (stock, movimiento, estado del pedido y de la
// solicitud origen) como una sola operación atómica.
import { requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}
const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);
const hoy = () => new Date().toISOString().split("T")[0];
const normNombre = (n: string) => (n || "").normalize("NFC").replace(/\s*\[.*?\]/g, "").trim().toLowerCase();

async function buscarMaterialPorNombre(supabaseAdmin: any, nombreLinea: string) {
  const { data: exacto } = await supabaseAdmin.from("material").select("*").eq("nombre", nombreLinea).maybeSingle();
  if (exacto) return exacto;
  const { data: todos } = await supabaseAdmin.from("material").select("*");
  return (todos || []).find((m: any) => nombreLinea.startsWith(m.nombre)) || null;
}

async function actualizarStockMaterial(supabaseAdmin: any, mat: any, cantRec: number, pedidoId: string, usuario: string, unidadLinea: string | null) {
  const { data: lotes } = await supabaseAdmin.from("material_ubicaciones").select("*").eq("id_material", mat.id_material);
  if ((lotes || []).length > 0) {
    const loteTarget = lotes[0];
    const nuevoLocal = (Number(loteTarget.stock_local) || 0) + cantRec;
    const datosLote: Record<string, unknown> = { stock_local: nuevoLocal };
    if (unidadLinea) datosLote.unidad_lote = unidadLinea;
    await supabaseAdmin.from("material_ubicaciones").update(datosLote).eq("id", loteTarget.id);
    const nuevoTotal = lotes.reduce((s: number, l: any) => s + (l.id === loteTarget.id ? nuevoLocal : (Number(l.stock_local) || 0)), 0);
    await supabaseAdmin.from("material").update({ stock_actual: nuevoTotal }).eq("id_material", mat.id_material);
  } else {
    const nuevoStock = (Number(mat.stock_actual) || 0) + cantRec;
    const datosMat: Record<string, unknown> = { stock_actual: nuevoStock };
    if (unidadLinea) datosMat.unidad = unidadLinea;
    await supabaseAdmin.from("material").update(datosMat).eq("id_material", mat.id_material);
  }
  await supabaseAdmin.from("movimientos").insert({
    id_movimiento: genId("MOV"), material: mat.nombre, tipo: "Entrada", cantidad: cantRec,
    usuario, motivo: `Recepción pedido ${pedidoId}`,
  });
}

async function actualizarEstadoPedidoPostRecepcion(supabaseAdmin: any, pedidoId: string) {
  const { data: p } = await supabaseAdmin.from("pedidos").select("*").eq("id_pedido", pedidoId).maybeSingle();
  if (!p) return;
  const { data: lineas } = await supabaseAdmin.from("lineas_pedido").select("estado_linea").eq("pedido", pedidoId);
  const todasRecibidas = (lineas || []).length > 0 && lineas.every((l: any) => l.estado_linea === "Recibido");
  if (todasRecibidas && p.estado !== "Recepción completa" && p.estado !== "Factura recibida") {
    await supabaseAdmin.from("pedidos").update({ estado: "Recepción completa", fecha_recepcion_completa: hoy() }).eq("id_pedido", pedidoId);
  } else if (!todasRecibidas && p.estado === "Presupuesto aprobado") {
    await supabaseAdmin.from("pedidos").update({ estado: "Recepción parcial" }).eq("id_pedido", pedidoId);
  }
}

async function actualizarSolicitudOrigen(supabaseAdmin: any, linea: any, pedidoId: string) {
  const solIdMatch = (linea.observaciones || "").match(/Desde solicitud (SOL-\S+)/);
  let solOrigen = null;
  if (solIdMatch) {
    const { data } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", solIdMatch[1]).neq("estado", "Recibido").maybeSingle();
    solOrigen = data;
  }
  if (!solOrigen) {
    const { data: candidatas } = await supabaseAdmin.from("solicitudes").select("*").eq("lista_pedido", pedidoId).neq("estado", "Recibido");
    solOrigen = (candidatas || []).find((s: any) => normNombre(s.material) === normNombre(linea.material)) || null;
  }
  if (!solOrigen) return;
  const obsSinFecha = (solOrigen.observaciones || "").replace(/\[Recibido:\d{4}-\d{2}-\d{2}\]\s*/g, "").trim();
  const nuevaObs = (obsSinFecha ? obsSinFecha + " " : "") + `[Recibido:${hoy()}]`;
  await supabaseAdmin.from("solicitudes").update({
    estado: "Recibido", observaciones: nuevaObs,
    lista_pedido: solOrigen.lista_pedido || pedidoId,
  }).eq("id_solicitud", solOrigen.id_solicitud);
}

async function completarRecepcion(supabaseAdmin: any, idLinea: string, cantRec: number, observaciones: string | null, usuario: string) {
  const { data: linea } = await supabaseAdmin.from("lineas_pedido").select("*").eq("id_linea", idLinea).maybeSingle();
  if (!linea) return { error: jsonError(`No se encontró la línea "${idLinea}"`, 404) };
  const { data: pedido } = await supabaseAdmin.from("pedidos").select("*").eq("id_pedido", linea.pedido).maybeSingle();
  if (!pedido) return { error: jsonError("Pedido no encontrado", 404) };

  const cantPed = Number(linea.cantidad_pedida) || 0;
  const cantRecTotal = (Number(linea.cantidad_recibida) || 0) + cantRec;
  const estadoLinea = cantRecTotal >= cantPed ? "Recibido" : (cantRecTotal > 0 ? "Recibido parcialmente" : "Pendiente");
  const datosLinea: Record<string, unknown> = { cantidad_recibida: cantRecTotal, estado_linea: estadoLinea };
  if (observaciones) datosLinea.observaciones = observaciones;

  const { data: lineaActualizada, error } = await supabaseAdmin.from("lineas_pedido").update(datosLinea).eq("id_linea", idLinea).select().single();
  if (error) return { error: jsonError(`No se pudo guardar la recepción: ${error.message}`, 400) };

  // Servicios: no hay stock que tocar.
  if (pedido.tipo !== "Servicio" && cantRec > 0) {
    const mat = await buscarMaterialPorNombre(supabaseAdmin, linea.material);
    if (mat) await actualizarStockMaterial(supabaseAdmin, mat, cantRec, linea.pedido, usuario, linea.unidad || null);
  }
  await actualizarEstadoPedidoPostRecepcion(supabaseAdmin, linea.pedido);
  if (estadoLinea === "Recibido") await actualizarSolicitudOrigen(supabaseAdmin, lineaActualizada, linea.pedido);

  return { linea: lineaActualizada };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const accion = String(body.accion || "");
  const { error: authError, supabaseAdmin, user } = await requireAdminOrGestor(req);
  if (authError) return authError;
  const usuarioNombre = String(body.usuario || user?.nombre || user?.email || "Usuario");

  if (accion === "crear") {
    const pedidoId = String(body.pedido || "").trim();
    if (!pedidoId) return jsonError("pedido es obligatorio", 400);
    const idSolicitud = strField(body.id_solicitud);

    let material: string, cantidadPedida: number, observaciones: string | null;
    if (idSolicitud) {
      const { data: sol } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", idSolicitud).maybeSingle();
      if (!sol) return jsonError(`No se encontró la solicitud "${idSolicitud}"`, 404);
      material = sol.material;
      cantidadPedida = Number(sol.cantidad_solicitada);
      observaciones = `Desde solicitud ${idSolicitud}`;
    } else {
      material = String(body.material || "").trim();
      cantidadPedida = Number(body.cantidad_pedida);
      observaciones = strField(body.observaciones);
      if (!material) return jsonError("Indica el material", 400);
    }
    if (!cantidadPedida || cantidadPedida <= 0) return jsonError("Indica la cantidad", 400);

    const datos = {
      id_linea: genId("LIN"), pedido: pedidoId, material, cantidad_pedida: cantidadPedida,
      cantidad_recibida: 0, estado_linea: "Pendiente", observaciones,
      precio_unitario: body.precio_unitario ? Number(body.precio_unitario) : null,
      id_equipo: strField(body.id_equipo),
      unidad: strField(body.unidad),
    };
    const { data, error } = await supabaseAdmin.from("lineas_pedido").insert(datos).select().single();
    if (error) return jsonError(`No se pudo añadir la línea: ${error.message}`, 400);

    if (idSolicitud) {
      await supabaseAdmin.from("solicitudes").update({ estado: "Añadida a pedido", lista_pedido: pedidoId }).eq("id_solicitud", idSolicitud);
    }
    return jsonOk({ linea: data });
  }

  if (accion === "eliminar") {
    const idLinea = String(body.id_linea || "").trim();
    if (!idLinea) return jsonError("id_linea es obligatorio", 400);
    const { data: linea } = await supabaseAdmin.from("lineas_pedido").select("*").eq("id_linea", idLinea).maybeSingle();
    if (!linea) return jsonError("Línea no encontrada", 404);

    const { error } = await supabaseAdmin.from("lineas_pedido").delete().eq("id_linea", idLinea);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);

    // Revertir solicitud vinculada si procede (2 intentos, igual que en recepción).
    const estadosRevertibles = ["Añadida a pedido", "En espera de recepción"];
    let solOrigen = null;
    const solIdMatch = (linea.observaciones || "").match(/Desde solicitud (SOL-\S+)/);
    if (solIdMatch) {
      const { data } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", solIdMatch[1]).in("estado", estadosRevertibles).maybeSingle();
      solOrigen = data;
    }
    if (!solOrigen) {
      const { data: candidatas } = await supabaseAdmin.from("solicitudes").select("*").eq("lista_pedido", linea.pedido).in("estado", estadosRevertibles);
      solOrigen = (candidatas || []).find((s: any) => normNombre(s.material) === normNombre(linea.material)) || null;
    }
    let solRevertida = null;
    if (solOrigen) {
      const { data } = await supabaseAdmin.from("solicitudes").update({ estado: "Pendiente", lista_pedido: null }).eq("id_solicitud", solOrigen.id_solicitud).select().single();
      solRevertida = data;
    }
    return jsonOk({ eliminada: idLinea, solicitud_revertida: solRevertida });
  }

  if (accion === "editar") {
    const idLinea = String(body.id_linea || "").trim();
    if (!idLinea) return jsonError("id_linea es obligatorio", 400);
    const { data: linea } = await supabaseAdmin.from("lineas_pedido").select("*").eq("id_linea", idLinea).maybeSingle();
    if (!linea) return jsonError("Línea no encontrada", 404);
    // Se bloquea por el estado de la LÍNEA, no del pedido entero — un pedido
    // pasa a "Recepción parcial" en cuanto se recibe UNA línea cualquiera, y
    // eso no debe impedir editar otras líneas del mismo pedido que siguen
    // sin recibirse (p.ej. mientras se completa un pedido con "Pedido súper
    // atrasado" y llegan los artículos en varios envíos).
    if (linea.estado_linea && linea.estado_linea !== "Pendiente") {
      return jsonError("Esta línea ya tiene recepción registrada y no admite cambios", 400);
    }

    const datos: Record<string, unknown> = {};
    if (body.cantidad_pedida !== undefined) {
      const cant = Number(body.cantidad_pedida);
      if (!cant || cant <= 0) return jsonError("Indica una cantidad válida", 400);
      datos.cantidad_pedida = cant;
    }
    if (body.precio_unitario !== undefined) {
      datos.precio_unitario = body.precio_unitario === "" || body.precio_unitario === null ? null : Number(body.precio_unitario);
    }
    if (body.observaciones !== undefined) datos.observaciones = strField(body.observaciones);
    if (body.unidad !== undefined) datos.unidad = strField(body.unidad);
    if (!Object.keys(datos).length) return jsonError("Nada que actualizar", 400);

    const { data, error } = await supabaseAdmin.from("lineas_pedido").update(datos).eq("id_linea", idLinea).select().single();
    if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
    return jsonOk({ linea: data });
  }

  if (accion === "recepcion") {
    const idLinea = String(body.id_linea || "").trim();
    const cantRec = Number(body.cantidad);
    if (!idLinea) return jsonError("id_linea es obligatorio", 400);
    if (!cantRec || cantRec <= 0) return jsonError("Indica una cantidad válida", 400);
    const resultado = await completarRecepcion(supabaseAdmin, idLinea, cantRec, strField(body.observaciones), usuarioNombre);
    if (resultado.error) return resultado.error;
    return jsonOk(resultado);
  }

  if (accion === "recepcion_masiva") {
    const pedidoId = String(body.pedido || "").trim();
    const lineas = Array.isArray(body.lineas) ? body.lineas as Record<string, unknown>[] : [];
    if (!pedidoId) return jsonError("pedido es obligatorio", 400);
    if (!lineas.length) return jsonError("Introduce al menos una cantidad", 400);
    const resultados = [];
    let procesadas = 0, errores = 0;
    for (const l of lineas) {
      const cantRec = Number(l.cantidad);
      if (!cantRec || cantRec <= 0) continue;
      const r = await completarRecepcion(supabaseAdmin, String(l.id_linea), cantRec, strField(l.observaciones), usuarioNombre);
      if (r.error) { errores++; resultados.push({ id_linea: l.id_linea, ok: false }); }
      else { procesadas++; resultados.push({ id_linea: l.id_linea, ok: true }); }
    }
    return jsonOk({ procesadas, errores, resultados });
  }

  if (accion === "actualizar_precio") {
    const pedidoId = String(body.pedido || "").trim();
    const proveedor = strField(body.proveedor);
    const lineas = Array.isArray(body.lineas) ? body.lineas as Record<string, unknown>[] : [];
    if (!pedidoId || !lineas.length) return jsonError("pedido y lineas son obligatorios", 400);
    const actualizadas = [];
    for (const l of lineas) {
      const idLinea = String(l.id_linea || "");
      const precio = strField(l.precio_unitario);
      if (!idLinea || !precio) continue;
      const { data: linea, error } = await supabaseAdmin.from("lineas_pedido").update({ precio_unitario: Number(precio) }).eq("id_linea", idLinea).select().single();
      if (error || !linea) continue;
      const hist = {
        id_historico: genId("HP"), nombre_material: linea.material, id_pedido: pedidoId,
        proveedor, fecha: hoy(), precio_unitario: Number(precio),
      };
      await supabaseAdmin.from("historico_precio").insert(hist);
      actualizadas.push(linea);
    }
    return jsonOk({ actualizadas });
  }

  return jsonError("accion no reconocida", 400);
});
