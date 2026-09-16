// Módulo Mantenimiento. "registrar" (dejar constancia de que se hizo un
// mantenimiento) lo puede hacer también el Profesor responsable del equipo
// (mismo permiso que crearIntervenciones, ver js/mantenimiento.js `canLog`).
// "crear_plan"/"actualizar_plan"/"eliminar_plan": Admin/Gestor cualquier equipo,
// Profesor solo los equipos de los que es responsable (campo `responsable`).
// "editar_registro" (corregir un mantenimiento ya finalizado): solo Admin/Gestor.
import { requireStaff, requireAdminOrGestor, requireValidSession, identificarUsuario, ES_STAFF, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

// Parsea el checklist [{texto, hecho}] recibido en el cuerpo.
function parsePasos(v: unknown): { texto: string; hecho: boolean }[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return { texto: String(o.texto ?? ""), hecho: o.hecho === true };
  });
}

// Meses de temporada: "" o ausente → null; si no, número.
function numOrNull(v: unknown): number | null {
  return (v === "" || v === null || v === undefined) ? null : Number(v);
}

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
  // con el checklist a medias (compartida, para retomarla en otra sesión); "finalizar"
  // (alias antiguo: "registrar") la cierra fijando la fecha.
  //
  // Abierto también al ALUMNADO, pero solo en planes marcados `con_alumnado`, y lo que
  // finalizan NO entra como 'finalizado': queda en 'pendiente_vb' hasta que un docente le
  // da el visto bueno (acción "visto_bueno"). Importa porque `registro_mantenimientos`
  // alimenta el Excel del modelo de calidad, donde la firma del supervisor es lo que da
  // validez al documento — ahí no puede entrar nada sin revisar.
  if (accion === "registrar" || accion === "finalizar" ||
      accion === "guardar_progreso" || accion === "descartar_ejecucion") {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;
    const { nombre: nombreUsuario, rol } = await identificarUsuario(supabaseAdmin, email);
    const esStaff = ES_STAFF(rol);

    if (!esStaff) {
      // Descartar la ejecución a medias de otra persona es decisión de gestión.
      if (accion === "descartar_ejecucion") {
        return jsonError("Solo el profesorado puede descartar una ejecución empezada", 403);
      }
      const idPlanAlum = String(body.id_plan || "").trim();
      const { data: planAlum } = await supabaseAdmin
        .from("planes_mantenimiento").select("con_alumnado, activo").eq("id_plan", idPlanAlum).maybeSingle();
      if (!planAlum || planAlum.activo === false || !planAlum.con_alumnado) {
        return jsonError("Este mantenimiento no está habilitado para realizarse con alumnado", 403);
      }
    }

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
      // Empezar a ejecutar deja sin efecto un marcador no_aplica/aplazado previo.
      {
        let d = supabaseAdmin.from("registro_mantenimientos").delete()
          .eq("id_plan", idPlan).in("estado", ["no_aplica", "aplazado"]);
        d = curso === null ? d.is("curso_academico", null) : d.eq("curso_academico", curso);
        d = periodo === null ? d.is("periodo", null) : d.eq("periodo", periodo);
        await d;
      }
      const datos = {
        id_registro: generarIdRegistro(), id_plan: idPlan, id_equipo: idEquipo,
        curso_academico: curso, periodo,
        estado: "en_curso", pasos,
        fecha_inicio: ahora.slice(0, 10),
        iniciado_por: esStaff ? (body.iniciado_por ? String(body.iniciado_por) : null) : nombreUsuario,
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
    // Un alumno firma siempre con su propio nombre (no el que venga del cliente) y deja
    // el registro esperando visto bueno, sin supervisor: lo pone quien lo valide.
    const comun: Record<string, unknown> = {
      id_equipo: idEquipo, curso_academico: curso, periodo,
      fecha_realizacion: fecha,
      realizado_por: esStaff ? realizadoPor : nombreUsuario,
      supervisado_por: esStaff && body.supervisado_por ? String(body.supervisado_por) : null,
      observaciones: body.observaciones ? String(body.observaciones) : null,
      estado: esStaff ? "finalizado" : "pendiente_vb",
      actualizado_en: new Date().toISOString(),
    };
    if (pasos) comun.pasos = pasos;

    // Un marcador 'no_aplica'/'aplazado' del mismo periodo deja de tener sentido
    // en cuanto se registra como hecho: se elimina.
    {
      let d = supabaseAdmin.from("registro_mantenimientos").delete()
        .eq("id_plan", idPlan).in("estado", ["no_aplica", "aplazado"]);
      d = curso === null ? d.is("curso_academico", null) : d.eq("curso_academico", curso);
      d = periodo === null ? d.is("periodo", null) : d.eq("periodo", periodo);
      await d;
    }

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

  // ── Visto bueno a un mantenimiento registrado por alumnado ────────────
  // `supervisado_por` lo escribe el SERVIDOR con el nombre de quien valida; nunca
  // llega del cliente. Es la firma del supervisor en el documento de calidad, así que
  // no puede ser un campo que alguien teclee a mano.
  if (accion === "visto_bueno") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;
    const idRegistro = String(body.id_registro || "").trim();
    if (!idRegistro) return jsonError("id_registro es obligatorio", 400);

    const { data: reg } = await supabaseAdmin.from("registro_mantenimientos")
      .select("*").eq("id_registro", idRegistro).maybeSingle();
    if (!reg) return jsonError("Registro no encontrado", 404);
    if (reg.estado !== "pendiente_vb") {
      return jsonError("Este registro no está esperando visto bueno", 400);
    }

    const ahora = new Date().toISOString();
    const revisor = user.nombre || user.email;

    if (body.aceptar === false) {
      // Devolver: vuelve a 'en_curso' con el checklist intacto, para rehacerlo.
      const motivo = String(body.motivo || "").trim();
      const obs = [reg.observaciones, `↩ Devuelto por ${revisor}${motivo ? ": " + motivo : ""}`]
        .filter(Boolean).join("\n");
      const { data, error } = await supabaseAdmin.from("registro_mantenimientos")
        .update({ estado: "en_curso", fecha_realizacion: null, supervisado_por: null,
                  observaciones: obs, actualizado_en: ahora })
        .eq("id_registro", idRegistro).select().single();
      if (error) return jsonError(`No se pudo devolver: ${error.message}`, 400);
      return jsonOk({ registro: data, devuelto: true, revisado_por: revisor });
    }

    const { data, error } = await supabaseAdmin.from("registro_mantenimientos")
      .update({ estado: "finalizado", supervisado_por: revisor, actualizado_en: ahora })
      .eq("id_registro", idRegistro).select().single();
    if (error) return jsonError(`No se pudo dar el visto bueno: ${error.message}`, 400);
    return jsonOk({ registro: data, supervisado_por: revisor });
  }

  // ── Marcar un periodo programado como 'no_aplica' o 'aplazado' ────────
  // Ambos exigen motivo (se guarda en observaciones). 'aplazado' guarda además
  // el mes destino (aplazado_a). "revertir_periodo" borra el marcador y el
  // periodo vuelve a estar pendiente. Lo puede hacer todo el personal
  // (requireStaff), igual que finalizar.
  if (accion === "marcar_periodo" || accion === "revertir_periodo") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;

    if (accion === "revertir_periodo") {
      const idRegistro = String(body.id_registro || "").trim();
      if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
      const { error } = await supabaseAdmin.from("registro_mantenimientos")
        .delete().eq("id_registro", idRegistro).in("estado", ["no_aplica", "aplazado"]);
      if (error) return jsonError(`No se pudo revertir el marcador: ${error.message}`, 400);
      return jsonOk({ revertido: idRegistro });
    }

    const idPlan = String(body.id_plan || "").trim();
    const idEquipo = String(body.id_equipo || "").trim();
    if (!idPlan || !idEquipo) return jsonError("id_plan e id_equipo son obligatorios", 400);
    const curso = body.curso_academico ? String(body.curso_academico) : null;
    const periodo = body.periodo ? String(body.periodo) : null;
    const tipo = String(body.tipo || "").trim();
    if (tipo !== "no_aplica" && tipo !== "aplazado") {
      return jsonError("tipo debe ser 'no_aplica' o 'aplazado'", 400);
    }
    const motivo = String(body.motivo || "").trim();
    if (!motivo) return jsonError("El motivo es obligatorio", 400);
    let aplazadoA: string | null = null;
    if (tipo === "aplazado") {
      aplazadoA = String(body.aplazado_a || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(aplazadoA)) {
        return jsonError("aplazado_a debe ser una fecha (YYYY-MM-DD) para aplazar", 400);
      }
    }

    // Si el periodo ya está registrado como realizado, no se puede marcar.
    {
      let q = supabaseAdmin.from("registro_mantenimientos").select("id_registro")
        .eq("id_plan", idPlan).eq("estado", "finalizado");
      q = curso === null ? q.is("curso_academico", null) : q.eq("curso_academico", curso);
      q = periodo === null ? q.is("periodo", null) : q.eq("periodo", periodo);
      const { data } = await q.limit(1);
      if (data && data[0]) {
        return jsonError("Este periodo ya está registrado como realizado; no se puede marcar como no aplica ni aplazar.", 400);
      }
    }

    // Sustituye cualquier ejecución a medias o marcador previo del mismo periodo.
    {
      let d = supabaseAdmin.from("registro_mantenimientos").delete()
        .eq("id_plan", idPlan).in("estado", ["en_curso", "no_aplica", "aplazado"]);
      d = curso === null ? d.is("curso_academico", null) : d.eq("curso_academico", curso);
      d = periodo === null ? d.is("periodo", null) : d.eq("periodo", periodo);
      await d;
    }

    const ahora = new Date().toISOString();
    const datos = {
      id_registro: generarIdRegistro(), id_plan: idPlan, id_equipo: idEquipo,
      curso_academico: curso, periodo,
      estado: tipo, observaciones: motivo, aplazado_a: aplazadoA,
      fecha_inicio: ahora.slice(0, 10),
      iniciado_por: body.marcado_por ? String(body.marcado_por) : (user.nombre || null),
      actualizado_en: ahora,
    };
    const { data, error } = await supabaseAdmin.from("registro_mantenimientos")
      .insert(datos).select().single();
    if (error) return jsonError(`No se pudo marcar el periodo: ${error.message}`, 400);
    return jsonOk({ registro: data });
  }

  // ── Corregir un mantenimiento YA finalizado ──────────────────────────
  if (accion === "editar_registro") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;

    const idRegistro = String(body.id_registro || "").trim();
    if (!idRegistro) return jsonError("id_registro es obligatorio", 400);
    const fecha = String(body.fecha_realizacion || "").trim();
    const realizadoPor = String(body.realizado_por || "").trim();
    if (!fecha || !realizadoPor) {
      return jsonError("fecha_realizacion y realizado_por son obligatorios", 400);
    }
    const upd: Record<string, unknown> = {
      fecha_realizacion: fecha,
      realizado_por: realizadoPor,
      supervisado_por: body.supervisado_por ? String(body.supervisado_por) : null,
      observaciones: body.observaciones ? String(body.observaciones) : null,
      actualizado_en: new Date().toISOString(),
    };
    const pasosEd = parsePasos(body.pasos);
    if (pasosEd) upd.pasos = pasosEd;

    const { data, error } = await supabaseAdmin.from("registro_mantenimientos")
      .update(upd).eq("id_registro", idRegistro).eq("estado", "finalizado").select().single();
    if (error) return jsonError(`No se pudo actualizar el registro: ${error.message}`, 400);
    if (!data) return jsonError(`No se encontró un mantenimiento finalizado "${idRegistro}"`, 404);
    return jsonOk({ registro: data });
  }

  // ── Alta / edición / borrado de planes ───────────────────────────────
  const { error: authError, user, supabaseAdmin } = await requireStaff(req);
  if (authError) return authError;

  // El Profesor solo puede tocar planes de equipos de los que es responsable.
  async function profesorAutorizado(idEquipo: string): Promise<boolean> {
    if (user.rol !== "Profesor") return true;
    const miNombre = String(user.nombre || "").toLowerCase().trim();
    if (!miNombre) return false;
    const { data } = await supabaseAdmin.from("equipos")
      .select("responsable").eq("id_activo", idEquipo).maybeSingle();
    return String(data?.responsable || "").toLowerCase()
      .split(",").map((r) => r.trim()).includes(miNombre);
  }

  if (accion === "crear_plan" || accion === "actualizar_plan") {
    const operacion = String(body.operacion || "").trim();
    if (!operacion) return jsonError("El título de la operación es obligatorio", 400);
    const datos = {
      tipo_intervencion: body.tipo_intervencion ? String(body.tipo_intervencion) : null,
      periodicidad: body.periodicidad ? String(body.periodicidad) : null,
      operacion,
      instrucciones: body.instrucciones ? String(body.instrucciones) : null,
      con_alumnado: body.con_alumnado === true || body.con_alumnado === "Sí",
    };
    // Meses de temporada: se guardan en el equipo, no en el plan (llegan solo
    // cuando la periodicidad es Pretemporada/Posttemporada).
    const tocaTemporada = body.mes_inicio_temporada !== undefined || body.mes_fin_temporada !== undefined;

    if (accion === "crear_plan") {
      const idEquipo = String(body.id_equipo || "").trim();
      if (!idEquipo) return jsonError("id_equipo es obligatorio", 400);
      if (!(await profesorAutorizado(idEquipo))) {
        return jsonError("Solo puedes crear planes de equipos de los que eres responsable", 403);
      }
      const { data, error } = await supabaseAdmin.from("planes_mantenimiento")
        .insert({ id_plan: generarIdPlan(), id_equipo: idEquipo, activo: true, ...datos }).select().single();
      if (error) return jsonError(`No se pudo crear el plan: ${error.message}`, 400);
      if (tocaTemporada) {
        await supabaseAdmin.from("equipos").update({
          mes_inicio_temporada: numOrNull(body.mes_inicio_temporada),
          mes_fin_temporada: numOrNull(body.mes_fin_temporada),
        }).eq("id_activo", idEquipo);
      }
      return jsonOk({ plan: data });
    } else {
      const idPlan = String(body.id_plan || "").trim();
      if (!idPlan) return jsonError("id_plan es obligatorio para actualizar", 400);
      const { data: planExistente } = await supabaseAdmin.from("planes_mantenimiento")
        .select("id_equipo").eq("id_plan", idPlan).maybeSingle();
      if (!planExistente) return jsonError(`No se encontró el plan "${idPlan}"`, 404);
      const idEquipo = String(planExistente.id_equipo);
      if (!(await profesorAutorizado(idEquipo))) {
        return jsonError("Solo puedes editar planes de equipos de los que eres responsable", 403);
      }
      const { data, error } = await supabaseAdmin.from("planes_mantenimiento")
        .update(datos).eq("id_plan", idPlan).select().single();
      if (error) return jsonError(`No se pudo actualizar el plan: ${error.message}`, 400);
      if (tocaTemporada) {
        await supabaseAdmin.from("equipos").update({
          mes_inicio_temporada: numOrNull(body.mes_inicio_temporada),
          mes_fin_temporada: numOrNull(body.mes_fin_temporada),
        }).eq("id_activo", idEquipo);
      }
      return jsonOk({ plan: data });
    }
  }

  if (accion === "eliminar_plan") {
    const idPlan = String(body.id_plan || "").trim();
    if (!idPlan) return jsonError("id_plan es obligatorio", 400);
    const { data: planExistente } = await supabaseAdmin.from("planes_mantenimiento")
      .select("id_equipo").eq("id_plan", idPlan).maybeSingle();
    if (!planExistente) return jsonOk({ eliminado: idPlan }); // ya no existe
    if (!(await profesorAutorizado(String(planExistente.id_equipo)))) {
      return jsonError("Solo puedes eliminar planes de equipos de los que eres responsable", 403);
    }
    const { error } = await supabaseAdmin.from("planes_mantenimiento").delete().eq("id_plan", idPlan);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idPlan });
  }

  return jsonError("accion debe ser 'guardar_progreso', 'finalizar', 'registrar', 'descartar_ejecucion', 'marcar_periodo', 'revertir_periodo', 'editar_registro', 'crear_plan', 'actualizar_plan' o 'eliminar_plan'", 400);
});
