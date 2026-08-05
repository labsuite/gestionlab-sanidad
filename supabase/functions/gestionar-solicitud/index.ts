// Módulo Solicitudes de material — ver docs/modulo-pedidos.md.
// crearSolicitudes (crear/editar/cancelar) lo tiene Profesor además de
// Gestor/Admin (ver PERMISOS en js/ui.js); Alumno no ve la página
// 'solicitudes' en absoluto (no está en su `nav`), así que requireStaff basta
// para todo salvo "rechazar", reservado a quien gestiona pedidos
// (Admin/Gestor, `gestionarPedidos` en PERMISOS).
import { requireAdminOrGestor, requireStaff, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);

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

  if (accion === "rechazar") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const { data, error } = await supabaseAdmin.from("solicitudes").update({ estado: "Rechazado" }).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo rechazar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró la solicitud "${idSolicitud}"`, 404);
    return jsonOk({ solicitud: data });
  }

  const { error: authError, supabaseAdmin } = await requireStaff(req);
  if (authError) return authError;

  if (accion === "crear") {
    const material = String(body.material || "").trim();
    const cantidad = Number(body.cantidad_solicitada);
    if (!material) return jsonError("Indica el material", 400);
    if (!cantidad || cantidad <= 0) return jsonError("Indica la cantidad", 400);
    const datos = {
      id_solicitud: genId("SOL"), material, cantidad_solicitada: cantidad,
      solicitante: String(body.solicitante || "Usuario"),
      motivo: strField(body.motivo), proveedor_requerido: strField(body.proveedor_requerido),
      estado: "Pendiente", observaciones: strField(body.observaciones),
    };
    const { data, error } = await supabaseAdmin.from("solicitudes").insert(datos).select().single();
    if (error) return jsonError(`No se pudo guardar la solicitud: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  if (accion === "editar") {
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const { data: actual } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", idSolicitud).maybeSingle();
    if (!actual) return jsonError("Solicitud no encontrada", 404);
    if (actual.estado !== "Pendiente") return jsonError("Esta solicitud no se puede editar", 400);
    const cantidad = Number(body.cantidad_solicitada);
    if (!cantidad || cantidad <= 0) return jsonError("Indica la cantidad", 400);
    const datos: Record<string, unknown> = {
      cantidad_solicitada: cantidad, motivo: strField(body.motivo),
      proveedor_requerido: strField(body.proveedor_requerido), observaciones: strField(body.observaciones),
    };
    if (body.material) datos.material = String(body.material).trim();
    const { data, error } = await supabaseAdmin.from("solicitudes").update(datos).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  if (accion === "cancelar") {
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const { data: actual } = await supabaseAdmin.from("solicitudes").select("*").eq("id_solicitud", idSolicitud).maybeSingle();
    if (!actual) return jsonError("Solicitud no encontrada", 404);
    if (actual.estado !== "Pendiente") return jsonError("Solo se pueden cancelar solicitudes Pendientes", 400);
    const { data, error } = await supabaseAdmin.from("solicitudes").update({ estado: "Cancelado" }).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo cancelar: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  if (accion === "snooze" || accion === "unsnooze") {
    const idSolicitud = String(body.id_solicitud || "").trim();
    if (!idSolicitud) return jsonError("id_solicitud es obligatorio", 400);
    const snoozeHasta = accion === "snooze" ? String(body.fecha || "").trim() : null;
    if (accion === "snooze" && !snoozeHasta) return jsonError("Indica una fecha", 400);
    const { data, error } = await supabaseAdmin.from("solicitudes").update({ snooze_hasta: snoozeHasta }).eq("id_solicitud", idSolicitud).select().single();
    if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
    return jsonOk({ solicitud: data });
  }

  return jsonError("accion no reconocida", 400);
});
