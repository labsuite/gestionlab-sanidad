// Módulo Incidencias. "crear" acepta cualquier sesión válida porque lo usan
// tanto Profesor/Gestor/Admin (openModalIncidencia) como el propio Alumno
// (aviso de problema con un equipo, openModalAvisoAlumno — ver equipos-render.js
// getUserRole()==='Alumno'). "eliminar" queda restringido a Admin/Gestor.
import { requireValidSession, requireAdminOrGestor, requireStaff, autorRegistro, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function generarIdIncidencia(): string {
  return "INC-" + Date.now().toString(36).toUpperCase().slice(-6);
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

  if (accion === "crear") {
    const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    const idEquipo = String(body.id_equipo || "").trim();
    const descripcionProblema = String(body.descripcion_problema || "").trim();
    if (!idEquipo || !descripcionProblema) return jsonError("id_equipo y descripcion_problema son obligatorios", 400);

    // Un aviso de alumnado queda como "Alumnado": lo que hace falta para
    // atenderlo es el equipo y la descripción, no quién lo vio (RGPD, ver
    // docs/proteccion-datos.md). El profesorado sí firma con su nombre.
    const { autor } = await autorRegistro(supabaseAdmin, email, body.reportado_por);

    const datos = {
      id_incidencia: generarIdIncidencia(),
      id_equipo: idEquipo,
      reportado_por: autor,
      descripcion_problema: descripcionProblema,
      impacto: body.impacto ? String(body.impacto) : null,
      urgencia: body.urgencia ? String(body.urgencia) : "Normal",
      estado: "Abierta",
      relacionada_con: body.relacionada_con ? String(body.relacionada_con) : null,
    };
    const { data, error } = await supabaseAdmin.from("incidencias").insert(datos).select().single();
    if (error) return jsonError(`No se pudo crear: ${error.message}`, 400);
    return jsonOk({ incidencia: data });
  }

  // Cierre (o reapertura) EXPLÍCITO de la incidencia desde su hilo. Nada cierra
  // una incidencia sola: ni completar las tareas de una actuación ni adjuntar la
  // factura. Aquí es donde además se devuelve el equipo a "Operativo", también
  // a propósito — ver docs/modulo-incidencias.md.
  if (accion === "cerrar") {
    const { error: authError, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;

    const idIncidencia = String(body.id_incidencia || "").trim();
    const estado = String(body.estado || "").trim();
    const ESTADOS = ["Resuelta", "Descartada", "En gestión", "Abierta"];
    if (!idIncidencia) return jsonError("id_incidencia es obligatorio", 400);
    if (!ESTADOS.includes(estado)) return jsonError(`estado debe ser uno de: ${ESTADOS.join(", ")}`, 400);

    const { data: incidencia, error } = await supabaseAdmin.from("incidencias")
      .update({ estado }).eq("id_incidencia", idIncidencia).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    if (!incidencia) return jsonError(`No se encontró la incidencia "${idIncidencia}"`, 404);

    const estadoEquipo = body.estado_equipo ? String(body.estado_equipo) : "";
    if (estadoEquipo) {
      await supabaseAdmin.from("equipos")
        .update({ estado_operativo: estadoEquipo }).eq("id_activo", incidencia.id_equipo);
    }
    return jsonOk({ incidencia, id_equipo: incidencia.id_equipo, estado_equipo: estadoEquipo });
  }

  if (accion === "eliminar") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idIncidencia = String(body.id_incidencia || "").trim();
    if (!idIncidencia) return jsonError("id_incidencia es obligatorio", 400);
    const { error } = await supabaseAdmin.from("incidencias").delete().eq("id_incidencia", idIncidencia);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idIncidencia });
  }

  return jsonError("accion debe ser 'crear', 'cerrar' o 'eliminar'", 400);
});
