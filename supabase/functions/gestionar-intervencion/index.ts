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
  return "Resuelto parcialmente";
}

function calcularEstadoIntervencion(resultadoAgregado: string, esExterna: boolean): string {
  if (!resultadoAgregado) return "Planificada";
  if (resultadoAgregado === "Pendiente" || resultadoAgregado === "Resuelto parcialmente") return "En gestión";
  if (resultadoAgregado === "Resuelto" && esExterna) return "Pendiente factura";
  return "Cerrada";
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
      estado: strField(body.estado) || "Planificada",
      coste_intervencion: numField(body.coste_intervencion),
      url_adjunto: strField(body.url_adjunto),
      nombre_adjunto: strField(body.nombre_adjunto),
      actuacion_finalizada: boolField(body.actuacion_finalizada) ?? false,
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
      "coste_intervencion"];
    const datos: Record<string, unknown> = {};
    for (const c of CAMPOS) if (c in body) datos[c] = (c === "coste_intervencion") ? numField(body[c]) : strField(body[c]);
    if ("equipo_operativo_tras_intervencion" in body) datos.equipo_operativo_tras_intervencion = boolField(body.equipo_operativo_tras_intervencion);
    if ("actualiza_proximo_preventivo" in body) datos.actualiza_proximo_preventivo = boolField(body.actualiza_proximo_preventivo);
    // "Finalizar actuación" — marca explícita de la usuaria, independiente de `estado`
    // (que se deriva de las tareas). boolField devuelve false tal cual, para poder reabrir.
    if ("actuacion_finalizada" in body) datos.actuacion_finalizada = boolField(body.actuacion_finalizada);

    const { data: intervencion, error } = await supabaseAdmin.from("intervenciones")
      .update(datos).eq("id_intervencion", idIntervencion).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    if (!intervencion) return jsonError(`No se encontró la intervención "${idIntervencion}"`, 404);

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
    const esExterna = !!intervencion.proveedor;
    const estadoAgg = calcularEstadoIntervencion(resultadoAgg, esExterna);

    const { data: intervencionActualizada } = await supabaseAdmin.from("intervenciones")
      .update({ resultado: resultadoAgg, estado: estadoAgg }).eq("id_intervencion", idIntervencion).select().single();

    if (datosTarea.operativo !== null) {
      const estadoEquipo = (resultadoAgg === "Resuelto" || resultadoAgg === "Descartado")
        ? (datosTarea.operativo ? "Operativo" : "No operativo")
        : (datosTarea.operativo ? "Operativo con fallos" : "No operativo");
      await actualizarEstadoEquipoSiProcede(intervencion.id_equipo, estadoEquipo);
    }

    const nuevoEstadoInc = estadoAgg === "Cerrada" ? (resultadoAgg === "Descartado" ? "Descartada" : "Resuelta") : "En gestión";
    await actualizarIncidenciaVinculada(idIntervencion, nuevoEstadoInc);

    return jsonOk({ tarea, intervencion: intervencionActualizada, resultadoAgg, estadoAgg });
  }

  return jsonError("accion debe ser 'crear', 'actualizar' o 'guardar_tarea'", 400);
});
