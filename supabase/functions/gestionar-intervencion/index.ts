// Módulo Intervenciones/Tareas — Admin/Gestor/Profesor (crearIntervenciones
// también lo tiene Profesor para sus propios equipos, ver js/ui.js PERMISOS).
//
// Replica server-side la lógica que antes vivía en js/equipos-acciones.js
// (calcularResultadoAgregado/calcularEstadoIntervencion/_sincronizarIntervencion):
// al guardar una tarea se recalcula el resultado/estado agregado de la
// intervención y se propaga al estado del equipo y de la incidencia vinculada,
// todo en una sola llamada atómica.
import { requireStaff, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function generarIdIntervencion(): string {
  return "INT-" + Date.now().toString(36).toUpperCase().slice(-6);
}
function generarIdTarea(): string {
  return "TSK-" + Date.now().toString(36).toUpperCase().slice(-6);
}

const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);
const numField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : Number(v);
const boolField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : (v === true || v === "Sí" || v === "true");

function calcularResultadoAgregado(tareas: { resultado: string | null }[]): string {
  if (!tareas.length) return "";
  if (tareas.some(t => t.resultado === "Pendiente")) return "Pendiente";
  if (tareas.every(t => t.resultado === "Resuelto" || t.resultado === "Descartado")) {
    return tareas.some(t => t.resultado === "Resuelto") ? "Resuelto" : "Descartado";
  }
  // Ninguna tarea arregló nada (solo "No resuelto", quizá con alguna descartada):
  // no es un resultado parcial, es que el problema sigue igual.
  if (tareas.every(t => t.resultado === "No resuelto" || t.resultado === "Descartado")) return "No resuelto";
  return "Resuelto parcialmente";
}

// El ESTADO de una actuación lo marcan las acciones de la usuaria, no el
// resultado de las tareas (desde 2026-10-01):
//   Planificada → aún no se ha hecho (sin fecha de realización)
//   En gestión  → hecha o empezada, sin cerrar
//   Cerrada     → la usuaria pulsó "Cerrar actuación" (actuacion_finalizada)
// Antes salía de las tareas y una visita terminada con una tarea "No resuelto"
// se quedaba "En gestión" para siempre aunque se hubiese cerrado. El resultado
// (Resuelto / Resuelto parcialmente...) sigue saliendo de las tareas, aparte.
// Tampoco hay ya "Pendiente factura": la factura es opcional (las del SAT suelen
// agrupar varias actuaciones) y se adjunta en el "Documento adjunto".
function calcularEstadoIntervencion(i: { actuacion_finalizada?: boolean | null; fecha_realizacion?: string | null }): string {
  if (i.actuacion_finalizada) return "Cerrada";
  return i.fecha_realizacion ? "En gestión" : "Planificada";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  const { error: authError, supabaseAdmin } = await requireStaff(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const accion = String(body.accion || "");

  // Actualiza el estado operativo del equipo (efecto colateral compartido por
  // varias acciones) sin pasar por gestionar-equipo — mismo cliente service_role.
  async function actualizarEstadoEquipoSiProcede(idEquipo: string | null, estado: unknown) {
    if (!idEquipo || estado === undefined || estado === null || estado === "") return;
    await supabaseAdmin.from("equipos").update({ estado_operativo: String(estado) }).eq("id_activo", idEquipo);
  }

  // Actualiza la incidencia vinculada a esta intervención (si la hay y no está
  // ya cerrada) — mismo guard que el código cliente: nunca reabre Resuelta/Descartada.
  async function actualizarIncidenciaVinculada(idIntervencion: string, nuevoEstado: string) {
    const { data: inc } = await supabaseAdmin.from("incidencias")
      .select("id_incidencia, estado").eq("intervencion_generada", idIntervencion).maybeSingle();
    if (inc && !["Resuelta", "Descartada"].includes(inc.estado) && inc.estado !== nuevoEstado) {
      await supabaseAdmin.from("incidencias").update({ estado: nuevoEstado }).eq("id_incidencia", inc.id_incidencia);
    }
  }

  if (accion === "crear") {
    const idEquipo = strField(body.id_equipo);
    if (!idEquipo) return jsonError("id_equipo es obligatorio", 400);
    const idIntervencion = generarIdIntervencion();
    const datos = {
      id_intervencion: idIntervencion,
      id_equipo: idEquipo,
      tipo: strField(body.tipo),
      origen: strField(body.origen),
      fecha_planificada: strField(body.fecha_planificada),
      fecha_realizacion: strField(body.fecha_realizacion),
      realizado_por: strField(body.realizado_por),
      proveedor: strField(body.proveedor),
      descripcion_actuacion: strField(body.descripcion_actuacion),
      estado: calcularEstadoIntervencion({ fecha_realizacion: strField(body.fecha_realizacion) }),
      coste_intervencion: numField(body.coste_intervencion),
      url_adjunto: strField(body.url_adjunto),
      nombre_adjunto: strField(body.nombre_adjunto),
      // Una intervención recién creada no puede tener tareas todavía, y sin tareas
      // no se finaliza nada: el cliente crea primero, guarda la tarea y solo después
      // manda "actuacion_finalizada" por la acción "actualizar" (que lo comprueba).
      actuacion_finalizada: false,
      lugar_intervencion: strField(body.lugar_intervencion),
      fecha_retirada: strField(body.fecha_retirada),
      fecha_devolucion: strField(body.fecha_devolucion),
    };
    const { data: intervencion, error } = await supabaseAdmin.from("intervenciones").insert(datos).select().single();
    if (error) return jsonError(`No se pudo crear: ${error.message}`, 400);

    let incidencia = null;
    const incidenciaId = strField(body.incidencia_id);
    if (incidenciaId) {
      const { data } = await supabaseAdmin.from("incidencias")
        .update({ estado: "En gestión", intervencion_generada: idIntervencion })
        .eq("id_incidencia", incidenciaId).select().single();
      incidencia = data;
    }
    await actualizarEstadoEquipoSiProcede(idEquipo, body.estado_equipo);
    return jsonOk({ intervencion, incidencia });
  }

  if (accion === "actualizar") {
    const idIntervencion = strField(body.id_intervencion);
    if (!idIntervencion) return jsonError("id_intervencion es obligatorio", 400);
    const CAMPOS = ["tipo", "origen", "fecha_planificada", "fecha_realizacion", "realizado_por",
      "tecnico_externo", "proveedor", "descripcion_actuacion", "resultado", "url_adjunto",
      "factura_asociada", "observaciones", "nombre_adjunto", "estado", "fecha_estimada_resolucion",
      "coste_intervencion", "lugar_intervencion", "fecha_retirada", "fecha_devolucion"];
    const datos: Record<string, unknown> = {};
    for (const c of CAMPOS) if (c in body) datos[c] = (c === "coste_intervencion") ? numField(body[c]) : strField(body[c]);
    if ("equipo_operativo_tras_intervencion" in body) datos.equipo_operativo_tras_intervencion = boolField(body.equipo_operativo_tras_intervencion);
    if ("actualiza_proximo_preventivo" in body) datos.actualiza_proximo_preventivo = boolField(body.actualiza_proximo_preventivo);
    // "Cerrar actuación" — marca explícita de la usuaria; de ella sale `estado`
    // (ver calcularEstadoIntervencion). boolField devuelve false tal cual, para poder reabrir.
    if ("actuacion_finalizada" in body) datos.actuacion_finalizada = boolField(body.actuacion_finalizada);
    // El estado no se escribe a mano: se recalcula abajo tras guardar.
    delete datos.estado;

    // Las tareas son las que dan resultado y cierre a la actuación: sin ninguna,
    // finalizarla deja una visita vacía que no dice qué se hizo. Se comprueba solo
    // al CERRAR (paso de no finalizada a finalizada): las que ya se cerraron sin
    // tareas antes de esta regla se siguen pudiendo corregir, y si se reabren,
    // volver a cerrarlas ya exigirá al menos una tarea.
    if (datos.actuacion_finalizada === true) {
      const { data: previa } = await supabaseAdmin.from("intervenciones")
        .select("actuacion_finalizada").eq("id_intervencion", idIntervencion).maybeSingle();
      if (!previa) return jsonError(`No se encontró la intervención "${idIntervencion}"`, 404);
      if (!previa.actuacion_finalizada) {
        const { count } = await supabaseAdmin.from("tareas_intervencion")
          .select("id_tarea", { count: "exact", head: true }).eq("id_intervencion", idIntervencion);
        if (!count) return jsonError("Una actuación no se cierra sin tareas: añade al menos una tarea antes de cerrarla.", 400);
      }
      // Cerrada significa terminada: no puede quedar ninguna tarea sin resultado.
      const { count: pendientes } = await supabaseAdmin.from("tareas_intervencion")
        .select("id_tarea", { count: "exact", head: true }).eq("id_intervencion", idIntervencion).eq("resultado", "Pendiente");
      if (pendientes) return jsonError(`Quedan ${pendientes} tarea(s) sin resultado: márcalas (Resuelto, No resuelto, Descartado...) antes de cerrar la actuación.`, 400);
    }

    const { data: guardada, error } = await supabaseAdmin.from("intervenciones")
      .update(datos).eq("id_intervencion", idIntervencion).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    if (!guardada) return jsonError(`No se encontró la intervención "${idIntervencion}"`, 404);
    const { data: intervencion } = await supabaseAdmin.from("intervenciones")
      .update({ estado: calcularEstadoIntervencion(guardada) }).eq("id_intervencion", idIntervencion).select().single();

    await actualizarEstadoEquipoSiProcede(intervencion.id_equipo, body.estado_equipo);
    if (strField(body.incidencia_estado)) await actualizarIncidenciaVinculada(idIntervencion, String(body.incidencia_estado));

    return jsonOk({ intervencion });
  }

  if (accion === "guardar_tarea") {
    const idIntervencion = strField(body.id_intervencion);
    const descripcion = strField(body.descripcion);
    if (!idIntervencion || !descripcion) return jsonError("id_intervencion y descripcion son obligatorios", 400);

    const { data: intervencion } = await supabaseAdmin.from("intervenciones").select("*").eq("id_intervencion", idIntervencion).maybeSingle();
    if (!intervencion) return jsonError(`No se encontró la intervención "${idIntervencion}"`, 404);

    const idTarea = strField(body.id_tarea);
    const datosTarea = {
      id_intervencion: idIntervencion,
      descripcion,
      resultado: strField(body.resultado) || "Pendiente",
      operativo: boolField(body.operativo),
      observaciones: strField(body.observaciones),
    };
    let tarea;
    if (idTarea) {
      const { data, error } = await supabaseAdmin.from("tareas_intervencion").update(datosTarea).eq("id_tarea", idTarea).select().single();
      if (error) return jsonError(`No se pudo actualizar la tarea: ${error.message}`, 400);
      tarea = data;
    } else {
      const { data, error } = await supabaseAdmin.from("tareas_intervencion").insert({ id_tarea: generarIdTarea(), ...datosTarea }).select().single();
      if (error) return jsonError(`No se pudo crear la tarea: ${error.message}`, 400);
      tarea = data;
    }

    const { data: tareas } = await supabaseAdmin.from("tareas_intervencion").select("resultado").eq("id_intervencion", idIntervencion);
    const resultadoAgg = calcularResultadoAgregado(tareas || []);
    // Si una tarea de una actuación cerrada vuelve a "Pendiente", la actuación ya
    // no está terminada: se reabre sola (automatizar solo puede degradar; cerrar
    // es siempre a propósito, con el botón).
    const finalizada = !!intervencion.actuacion_finalizada && resultadoAgg !== "Pendiente";
    const estadoAgg = calcularEstadoIntervencion({ ...intervencion, actuacion_finalizada: finalizada });

    const { data: intervencionActualizada } = await supabaseAdmin.from("intervenciones")
      .update({ resultado: resultadoAgg, estado: estadoAgg, actuacion_finalizada: finalizada })
      .eq("id_intervencion", idIntervencion).select().single();

    // El estado del equipo solo se DEGRADA automáticamente desde las tareas
    // ("No operativo" / "Operativo con fallos"). Volver a "Operativo" es una
    // decisión de la usuaria: se marca a propósito al cerrar la incidencia
    // desde su hilo (accion "cerrar" de gestionar-incidencia).
    if (datosTarea.operativo !== null && !datosTarea.operativo) {
      await actualizarEstadoEquipoSiProcede(intervencion.id_equipo, "No operativo");
    }

    // Tampoco se cierra la incidencia sola aunque todas las tareas queden
    // resueltas: se queda "En gestión" hasta que alguien la dé por resuelta
    // (o descartada) desde el hilo.
    await actualizarIncidenciaVinculada(idIntervencion, "En gestión");

    return jsonOk({ tarea, intervencion: intervencionActualizada, resultadoAgg, estadoAgg });
  }

  // Quitar una tarea PREVISTA: solo mientras la actuación sigue planificada (sin
  // fecha de realización) y la tarea no tiene resultado. Al cambiar de idea antes
  // de ir, lo previsto simplemente deja de estarlo; una vez hecha la actuación,
  // lo que no se hizo se marca "Descartado" para que quede constancia.
  if (accion === "eliminar_tarea") {
    const idTarea = strField(body.id_tarea);
    if (!idTarea) return jsonError("id_tarea es obligatorio", 400);
    const { data: tarea } = await supabaseAdmin.from("tareas_intervencion").select("*").eq("id_tarea", idTarea).maybeSingle();
    if (!tarea) return jsonError(`No se encontró la tarea "${idTarea}"`, 404);
    const { data: intervencion } = await supabaseAdmin.from("intervenciones").select("*").eq("id_intervencion", tarea.id_intervencion).maybeSingle();
    if (!intervencion) return jsonError(`No se encontró la intervención "${tarea.id_intervencion}"`, 404);
    if (intervencion.fecha_realizacion || intervencion.actuacion_finalizada)
      return jsonError("La actuación ya se ha realizado: en vez de quitar la tarea, márcala como «Descartado» para que quede constancia.", 400);
    if (tarea.resultado && tarea.resultado !== "Pendiente")
      return jsonError("Esta tarea ya tiene resultado; márcala como «Descartado» en vez de quitarla.", 400);

    const { error } = await supabaseAdmin.from("tareas_intervencion").delete().eq("id_tarea", idTarea);
    if (error) return jsonError(`No se pudo quitar la tarea: ${error.message}`, 400);

    const { data: tareas } = await supabaseAdmin.from("tareas_intervencion").select("resultado").eq("id_intervencion", intervencion.id_intervencion);
    const { data: intervencionActualizada } = await supabaseAdmin.from("intervenciones")
      .update({ resultado: calcularResultadoAgregado(tareas || []) || null })
      .eq("id_intervencion", intervencion.id_intervencion).select().single();
    return jsonOk({ intervencion: intervencionActualizada });
  }

  return jsonError("accion debe ser 'crear', 'actualizar', 'guardar_tarea' o 'eliminar_tarea'", 400);
});
