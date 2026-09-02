// Módulo Mantenimiento. "registrar" (dejar constancia de que se hizo un
// mantenimiento) lo puede hacer también el Profesor responsable del equipo
// (mismo permiso que crearIntervenciones, ver js/mantenimiento.js `canLog`).
// "crear_plan"/"actualizar_plan"/"eliminar_plan" quedan solo para Admin/Gestor
// (comentario "MODAL GESTIONAR PLANES (Admin/Gestor)" en el código original).
import { requireStaff, requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function generarIdRegistro(): string {
  return "RM" + Date.now().toString(36).toUpperCase().slice(-6);
}
function generarIdPlan(): string {
  return "PM" + Date.now().toString(36).toUpperCase().slice(-6);
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

  // Ejecución de un mantenimiento: "guardar_progreso" deja/actualiza una fila 'en_curso'
  // con el checklist a medias (compartida entre todo el personal, para retomarla en otra
  // sesión); "finalizar" (alias antiguo: "registrar") la cierra fijando la fecha. Todo lo
  // puede hacer también el Profesor responsable (requireStaff, igual que antes).
  if (accion === "registrar" || accion === "finalizar" ||
      accion === "guardar_progreso" || accion === "descartar_ejecucion") {
    const { error: authError, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;

    if (accion === "descartar_ejecucion") {
      const idRegistro = String(body.id_registro || "").trim();
      if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
      const { error } = await supabaseAdmin.from("registro_mantenimientos")
        .delete().eq("id_registro", idRegistro).eq("estado", "en_curso");
      if (error) return jsonError(`No se pudo descartar la ejecución: ${error.message}`, 400);
      return jsonOk({ descartado: idRegistro });
    }

    const idPlan = String(body.id_plan || "").trim();
    const idEquipo = String(body.id_equipo || "").trim();
    if (!idPlan || !idEquipo) return jsonError("id_plan e id_equipo son obligatorios", 400);
    const curso = body.curso_academico ? String(body.curso_academico) : null;
    const periodo = body.periodo ? String(body.periodo) : null;

    const pasos = Array.isArray(body.pasos)
      ? (body.pasos as unknown[]).map((p) => {
          const o = (p ?? {}) as Record<string, unknown>;
          return { texto: String(o.texto ?? ""), hecho: o.hecho === true };
        })
      : null;

    // ¿Hay ya una ejecución en curso de este mismo mantenimiento?
    let enCurso: Record<string, unknown> | null = null;
    {
      let q = supabaseAdmin.from("registro_mantenimientos").select("*")
        .eq("id_plan", idPlan).eq("estado", "en_curso");
      q = curso === null ? q.is("curso_academico", null) : q.eq("curso_academico", curso);
      q = periodo === null ? q.is("periodo", null) : q.eq("periodo", periodo);
      const { data } = await q.limit(1);
      enCurso = data && data[0] ? data[0] : null;
    }

    if (accion === "guardar_progreso") {
      const ahora = new Date().toISOString();
      if (enCurso) {
        const { data, error } = await supabaseAdmin.from("registro_mantenimientos")
          .update({ pasos, actualizado_en: ahora })
          .eq("id_registro", enCurso.id_registro as string).select().single();
        if (error) return jsonError(`No se pudo guardar el progreso: ${error.message}`, 400);
        return jsonOk({ registro: data });
      }
      const datos = {
        id_registro: generarIdRegistro(), id_plan: idPlan, id_equipo: idEquipo,
        curso_academico: curso, periodo,
        estado: "en_curso", pasos,
        fecha_inicio: ahora.slice(0, 10),
        iniciado_por: body.iniciado_por ? String(body.iniciado_por) : null,
        actualizado_en: ahora,
      };
      const { data, error } = await supabaseAdmin.from("registro_mantenimientos").insert(datos).select().single();
      if (error) return jsonError(`No se pudo guardar el progreso: ${error.message}`, 400);
      return jsonOk({ registro: data });
    }

    // accion === "finalizar" | "registrar"
    const fecha = String(body.fecha_realizacion || "").trim();
    const realizadoPor = String(body.realizado_por || "").trim();
    if (!fecha || !realizadoPor) {
      return jsonError("fecha_realizacion y realizado_por son obligatorios", 400);
    }
    const comun: Record<string, unknown> = {
      id_equipo: idEquipo, curso_academico: curso, periodo,
      fecha_realizacion: fecha, realizado_por: realizadoPor,
      supervisado_por: body.supervisado_por ? String(body.supervisado_por) : null,
      observaciones: body.observaciones ? String(body.observaciones) : null,
      estado: "finalizado",
      actualizado_en: new Date().toISOString(),
    };
    if (pasos) comun.pasos = pasos;
    if (enCurso) {
      const { data, error } = await supabaseAdmin.from("registro_mantenimientos")
        .update(comun).eq("id_registro", enCurso.id_registro as string).select().single();
      if (error) return jsonError(`No se pudo finalizar: ${error.message}`, 400);
      return jsonOk({ registro: data });
    }
    const { data, error } = await supabaseAdmin.from("registro_mantenimientos")
      .insert({ id_registro: generarIdRegistro(), id_plan: idPlan, ...comun }).select().single();
    if (error) return jsonError(`No se pudo registrar: ${error.message}`, 400);
    return jsonOk({ registro: data });
  }

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  if (accion === "crear_plan" || accion === "actualizar_plan") {
    const idEquipo = String(body.id_equipo || "").trim();
    const operacion = String(body.operacion || "").trim();
    if (!idEquipo) return jsonError("id_equipo es obligatorio", 400);
    if (!operacion) return jsonError("El título de la operación es obligatorio", 400);
    const datos = {
      tipo_intervencion: body.tipo_intervencion ? String(body.tipo_intervencion) : null,
      periodicidad: body.periodicidad ? String(body.periodicidad) : null,
      operacion,
      instrucciones: body.instrucciones ? String(body.instrucciones) : null,
      con_alumnado: body.con_alumnado === true || body.con_alumnado === "Sí",
    };
    if (accion === "crear_plan") {
      const { data, error } = await supabaseAdmin.from("planes_mantenimiento")
        .insert({ id_plan: generarIdPlan(), id_equipo: idEquipo, activo: true, ...datos }).select().single();
      if (error) return jsonError(`No se pudo crear el plan: ${error.message}`, 400);
      return jsonOk({ plan: data });
    } else {
      const idPlan = String(body.id_plan || "").trim();
      if (!idPlan) return jsonError("id_plan es obligatorio para actualizar", 400);
      const { data, error } = await supabaseAdmin.from("planes_mantenimiento")
        .update(datos).eq("id_plan", idPlan).select().single();
      if (error) return jsonError(`No se pudo actualizar el plan: ${error.message}`, 400);
      if (!data) return jsonError(`No se encontró el plan "${idPlan}"`, 404);
      return jsonOk({ plan: data });
    }
  }

  if (accion === "eliminar_plan") {
    const idPlan = String(body.id_plan || "").trim();
    if (!idPlan) return jsonError("id_plan es obligatorio", 400);
    const { error } = await supabaseAdmin.from("planes_mantenimiento").delete().eq("id_plan", idPlan);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idPlan });
  }

  return jsonError("accion debe ser 'guardar_progreso', 'finalizar', 'registrar', 'descartar_ejecucion', 'crear_plan', 'actualizar_plan' o 'eliminar_plan'", 400);
});
