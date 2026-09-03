// Módulo Pedidos — ver docs/modulo-pedidos.md. Todas las acciones son
// Admin/Gestor (`gestionarPedidos` en PERMISOS, js/ui.js) — Profesor no ve
// la página de pedidos en absoluto.
import { requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);
const hoy = () => new Date().toISOString().split("T")[0];

// Al aprobar presupuesto, las solicitudes vinculadas pasan a "En espera de
// recepción" — mismo mapa que MAPA_SOL en pedidos-acciones.js. Los estados
// finales (Recibido/Rechazado/Cancelado) no se tocan aquí.
const ESTADOS_FINALES_SOL = ["Recibido", "Rechazado", "Cancelado"];
async function cascadaSolicitudes(supabaseAdmin: any, idPedido: string, nuevoEstadoPedido: string) {
  const mapa: Record<string, string> = { "Presupuesto aprobado": "En espera de recepción" };
  const nuevoEstadoSol = mapa[nuevoEstadoPedido];
  if (!nuevoEstadoSol) return;
  const { data: sols } = await supabaseAdmin.from("solicitudes").select("id_solicitud, estado").eq("lista_pedido", idPedido);
  for (const s of sols || []) {
    if (ESTADOS_FINALES_SOL.includes(s.estado)) continue;
    await supabaseAdmin.from("solicitudes").update({ estado: nuevoEstadoSol }).eq("id_solicitud", s.id_solicitud);
  }
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
  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  if (accion === "crear") {
    const nombreLista = String(body.nombre_lista || "").trim();
    if (!nombreLista) return jsonError("El nombre es obligatorio", 400);
    const datos = {
      id_pedido: genId("PED"), nombre_lista: nombreLista, proveedor: strField(body.proveedor),
      fecha_creacion: hoy(), estado: "Abierto", observaciones: strField(body.observaciones),
      tipo: String(body.tipo || "Material"),
    };
    const { data, error } = await supabaseAdmin.from("pedidos").insert(datos).select().single();
    if (error) return jsonError(`No se pudo crear la lista: ${error.message}`, 400);
    return jsonOk({ pedido: data });
  }

  const idPedido = String(body.id_pedido || "").trim();
  if (!idPedido) return jsonError("id_pedido es obligatorio", 400);

  if (accion === "actualizar_estado" || accion === "avanzar_estado") {
    const { data: p } = await supabaseAdmin.from("pedidos").select("*").eq("id_pedido", idPedido).maybeSingle();
    if (!p) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);

    let nuevoEstado: string;
    if (accion === "avanzar_estado") {
      const secuencia = ["Abierto", "Presupuesto solicitado", "Presupuesto aprobado", "Recepción parcial", "Recepción completa"];
      const pos = secuencia.indexOf(p.estado);
      if (pos === -1 || pos >= secuencia.length - 1) return jsonError("El pedido ya está en el estado final", 400);
      nuevoEstado = secuencia[pos + 1];
    } else {
      nuevoEstado = String(body.estado || "").trim();
      if (nuevoEstado === "Recepción parcial" || nuevoEstado === "Recepción completa") {
        return jsonError("Este estado se asigna automáticamente al registrar recepciones de líneas", 400);
      }
      if (!nuevoEstado) return jsonError("estado es obligatorio", 400);
    }

    const datos: Record<string, unknown> = { estado: nuevoEstado };
    if (nuevoEstado === "Presupuesto solicitado") datos.fecha_presupuesto = hoy();
    if (nuevoEstado === "Presupuesto aprobado") datos.fecha_aprobacion = hoy();
    if (nuevoEstado === "Recepción completa") datos.fecha_recepcion_completa = hoy();
    if (accion === "actualizar_estado") {
      if (body.numero_presupuesto) datos.numero_presupuesto = String(body.numero_presupuesto);
      if (body.numero_factura) datos.numero_factura = String(body.numero_factura);
      if (body.proveedor) datos.proveedor = String(body.proveedor);
    }

    const { data, error } = await supabaseAdmin.from("pedidos").update(datos).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    await cascadaSolicitudes(supabaseAdmin, idPedido, nuevoEstado);
    return jsonOk({ pedido: data });
  }

  if (accion === "archivar") {
    const { data, error } = await supabaseAdmin.from("pedidos").update({ estado: "Archivado" }).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo archivar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);
    return jsonOk({ pedido: data });
  }

  if (accion === "actualizar_campos") {
    // Whitelist — cubre proveedor, gasto extra, ciclo/módulo, factura, docs.
    const permitidos = [
      "proveedor", "gasto_extra_concepto", "gasto_extra_importe", "ciclo", "modulo",
      "numero_factura", "fecha_factura", "numero_presupuesto", "doc_hoja_generada", "doc_hoja_path", "doc_enviada_jefatura",
    ];
    const campos = (body.campos && typeof body.campos === "object") ? body.campos as Record<string, unknown> : {};
    const datos: Record<string, unknown> = {};
    for (const k of permitidos) {
      if (!(k in campos)) continue;
      if (k === "doc_hoja_generada" || k === "doc_enviada_jefatura") {
        datos[k] = campos[k] === true || campos[k] === "TRUE";
      } else if (k === "gasto_extra_importe") {
        datos[k] = campos[k] === "" || campos[k] === null ? null : Number(campos[k]);
      } else {
        datos[k] = strField(campos[k]);
      }
    }
    if (!Object.keys(datos).length) return jsonError("Nada que actualizar", 400);
    const { data, error } = await supabaseAdmin.from("pedidos").update(datos).eq("id_pedido", idPedido).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);
    return jsonOk({ pedido: data });
  }

  if (accion === "generar_link_publico") {
    const { data: p } = await supabaseAdmin.from("pedidos").select("token_publico").eq("id_pedido", idPedido).maybeSingle();
    if (!p) return jsonError(`No se encontró el pedido "${idPedido}"`, 404);
    if (p.token_publico) return jsonOk({ token: p.token_publico });

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "");

    const { error } = await supabaseAdmin.from("pedidos").update({ token_publico: token }).eq("id_pedido", idPedido);
    if (error) return jsonError(`No se pudo generar el link: ${error.message}`, 400);
    return jsonOk({ token });
  }

  if (accion === "eliminar") {
    // Las líneas de Lineas_Pedido caen en cascada (FK on delete cascade).
    const { error } = await supabaseAdmin.from("pedidos").delete().eq("id_pedido", idPedido);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idPedido });
  }

  if (accion === "eliminar_documento") {
    // Para cuando el proveedor sube el archivo equivocado (o duplicado) por
    // el link público — borra el archivo de Storage además de la fila.
    const idDocumento = String(body.id_documento || "").trim();
    if (!idDocumento) return jsonError("id_documento es obligatorio", 400);
    const { data: doc } = await supabaseAdmin.from("documentos_proveedor").select("*").eq("id_documento", idDocumento).eq("pedido", idPedido).maybeSingle();
    if (!doc) return jsonError("Documento no encontrado", 404);
    await supabaseAdmin.storage.from("documentos").remove([doc.path]); // best-effort: si falla, no bloquea el borrado de la fila
    const { error } = await supabaseAdmin.from("documentos_proveedor").delete().eq("id_documento", idDocumento);
    if (error) return jsonError(`No se pudo eliminar el documento: ${error.message}`, 400);
    return jsonOk({ eliminado: idDocumento });
  }

  return jsonError("accion no reconocida", 400);
});
