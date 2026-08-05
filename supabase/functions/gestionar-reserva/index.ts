// Módulo Reservas de equipos — ver docs/modulo-reservas.md.
// reservarEquipos (crear/cancelar/iniciar/finalizar la propia) lo tiene
// CUALQUIER rol incluido Alumno (ver PERMISOS en js/ui.js) — por eso "crear"
// usa requireValidSession, y cancelar/iniciar/finalizar comprueban que quien
// llama es el dueño de la reserva (antes esto solo se filtraba en la UI).
// gestionarReservas/configurarReservas son solo Gestor/Administrador.
import { requireAdminOrGestor, requireValidSession, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function nextIdReserva(existentes: string[]): string {
  const nums = existentes.map(id => parseInt((id || "").replace("RSV-", "")) || 0);
  const max = nums.length ? Math.max(0, ...nums) : 0;
  return "RSV-" + String(max + 1).padStart(3, "0");
}

function solapan(i1: string, f1: string, i2: string, f2: string): boolean {
  return new Date(i1) < new Date(f2) && new Date(f1) > new Date(i2);
}

type Param = { key: string; label: string; type: "number" | "text"; tolerance?: number };

function verificarConflicto(
  config: { politica: string; params_template: Param[] | null } | null,
  solapadas: { usuario: string; fecha_inicio: string; fecha_fin: string; estado: string; condiciones: Record<string, unknown> | null }[],
  condiciones: Record<string, unknown>,
): { ok: boolean; mensaje?: string } {
  if (!config) return { ok: true };
  if (!solapadas.length) return { ok: true };

  if (config.politica === "BLOCK") {
    const otra = solapadas[0];
    return { ok: false, mensaje: `Ocupado — ${otra.usuario?.split("@")[0]} (${otra.estado})` };
  }

  const template = config.params_template || [];
  for (const reserva of solapadas) {
    const condExist = reserva.condiciones || {};
    for (const param of template) {
      const v1 = condiciones[param.key];
      const v2 = condExist[param.key];
      if (v1 === undefined || v1 === "" || v2 === undefined || v2 === "") continue;
      if (param.type === "number") {
        if (Math.abs(Number(v1) - Number(v2)) > (param.tolerance ?? 0)) {
          return { ok: false, mensaje: `Incompatible en "${param.label}": ${reserva.usuario?.split("@")[0]} requiere ${v2}, se solicita ${v1}` };
        }
      } else if (String(v1).toLowerCase() !== String(v2).toLowerCase()) {
        return { ok: false, mensaje: `Incompatible en "${param.label}": ${reserva.usuario?.split("@")[0]} requiere "${v2}", se solicita "${v1}"` };
      }
    }
  }
  return { ok: true };
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

  // ── crear / cancelar / iniciar_uso / finalizar_uso: cualquier sesión válida ──
  if (["crear", "cancelar", "iniciar_uso", "finalizar_uso"].includes(accion)) {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    if (accion === "crear") {
      const idEquipo = String(body.id_equipo || "").trim();
      const fechaInicio = String(body.fecha_inicio || "").trim();
      const fechaFin = String(body.fecha_fin || "").trim();
      const proposito = String(body.proposito || "").trim();
      if (!idEquipo || !fechaInicio || !fechaFin || !proposito) {
        return jsonError("Completa todos los campos obligatorios", 400);
      }
      if (new Date(fechaFin) <= new Date(fechaInicio)) {
        return jsonError("La hora/fecha de fin debe ser posterior al inicio", 400);
      }
      const condiciones = (body.condiciones && typeof body.condiciones === "object") ? body.condiciones as Record<string, unknown> : {};

      const { data: config } = await supabaseAdmin.from("config_reservas").select("*").eq("id_equipo", idEquipo).maybeSingle();
      const { data: existentes } = await supabaseAdmin.from("reservas_equipos").select("*").eq("id_equipo", idEquipo).in("estado", ["Pendiente", "Confirmada", "Activa"]);
      const solapadas = (existentes || []).filter((r: { fecha_inicio: string; fecha_fin: string }) => solapan(r.fecha_inicio, r.fecha_fin, fechaInicio, fechaFin));
      const conflicto = verificarConflicto(config, solapadas, condiciones);
      const estado = conflicto.ok ? "Confirmada" : "Pendiente";

      const { data: todasIds } = await supabaseAdmin.from("reservas_equipos").select("id_reserva");
      const idReserva = nextIdReserva((todasIds || []).map((r: { id_reserva: string }) => r.id_reserva));

      const datos = {
        id_reserva: idReserva, id_equipo: idEquipo, usuario: email, fecha_inicio: fechaInicio, fecha_fin: fechaFin,
        condiciones, proposito, estado,
      };
      const { data, error } = await supabaseAdmin.from("reservas_equipos").insert(datos).select().single();
      if (error) return jsonError(`No se pudo guardar la reserva: ${error.message}`, 400);
      return jsonOk({ reserva: data, conflicto: conflicto.ok ? null : conflicto.mensaje });
    }

    // cancelar / iniciar_uso / finalizar_uso — solo el dueño de la reserva
    const idReserva = String(body.id_reserva || "").trim();
    if (!idReserva) return jsonError("id_reserva es obligatorio", 400);
    const { data: reserva } = await supabaseAdmin.from("reservas_equipos").select("*").eq("id_reserva", idReserva).maybeSingle();
    if (!reserva) return jsonError("Reserva no encontrada", 404);
    if ((reserva.usuario || "").toLowerCase().trim() !== email.toLowerCase().trim()) {
      return jsonError("Solo el titular de la reserva puede hacer esto", 403);
    }

    const datos: Record<string, unknown> = accion === "cancelar"
      ? { estado: "Cancelada" }
      : accion === "iniciar_uso"
      ? { estado: "Activa", inicio_real: new Date().toISOString() }
      : { estado: "Completada", fin_real: new Date().toISOString() };

    const { data, error } = await supabaseAdmin.from("reservas_equipos").update(datos).eq("id_reserva", idReserva).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    return jsonOk({ reserva: data });
  }

  // ── gestionar / config_equipo: Admin/Gestor ──
  const { error: authError, user, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  if (accion === "gestionar") {
    const idReserva = String(body.id_reserva || "").trim();
    const resultado = String(body.resultado || "");
    const mapaEstado: Record<string, string> = { aprobar: "Confirmada", rechazar: "Rechazada", conflicto: "En conflicto" };
    const nuevoEstado = mapaEstado[resultado];
    if (!idReserva || !nuevoEstado) return jsonError("id_reserva y resultado ('aprobar'|'rechazar'|'conflicto') son obligatorios", 400);
    const observaciones = String(body.observaciones || "");
    if (resultado === "rechazar" && !observaciones) return jsonError("Indica el motivo del rechazo", 400);

    const datos = { estado: nuevoEstado, aprobado_por: user?.email || "", observaciones_admin: observaciones };
    const { data, error } = await supabaseAdmin.from("reservas_equipos").update(datos).eq("id_reserva", idReserva).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró la reserva "${idReserva}"`, 404);
    return jsonOk({ reserva: data });
  }

  if (accion === "config_equipo") {
    const idEquipo = String(body.id_equipo || "").trim();
    if (!idEquipo) return jsonError("Selecciona un equipo", 400);
    const datos = {
      politica: String(body.politica || "BLOCK"),
      params_template: Array.isArray(body.params_template) ? body.params_template : [],
      max_horas: body.max_horas === "" || body.max_horas == null ? null : Number(body.max_horas),
      antelacion_min_horas: body.antelacion_min_horas === "" || body.antelacion_min_horas == null ? null : Number(body.antelacion_min_horas),
    };
    const { data, error } = await supabaseAdmin.from("config_reservas")
      .upsert({ id_equipo: idEquipo, ...datos }).select().single();
    if (error) return jsonError(`No se pudo guardar: ${error.message}`, 400);
    return jsonOk({ config: data });
  }

  return jsonError("accion no reconocida", 400);
});
