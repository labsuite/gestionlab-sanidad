// Módulo Incidencias. "crear" acepta cualquier sesión válida porque lo usan
// tanto Profesor/Gestor/Admin (openModalIncidencia) como el propio Alumno
// (aviso de problema con un equipo, openModalAvisoAlumno — ver equipos-render.js
// getUserRole()==='Alumno'). "eliminar" queda restringido a Admin/Gestor.
import { requireValidSession, requireAdminOrGestor, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

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
    const { error: authError, supabaseAdmin } = await requireValidSession(req);
    if (authError) return authError;

    const idEquipo = String(body.id_equipo || "").trim();
    const descripcionProblema = String(body.descripcion_problema || "").trim();
    if (!idEquipo || !descripcionProblema) return jsonError("id_equipo y descripcion_problema son obligatorios", 400);

    const datos = {
      id_incidencia: generarIdIncidencia(),
      id_equipo: idEquipo,
      reportado_por: body.reportado_por ? String(body.reportado_por) : null,
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

  if (accion === "eliminar") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const idIncidencia = String(body.id_incidencia || "").trim();
    if (!idIncidencia) return jsonError("id_incidencia es obligatorio", 400);
    const { error } = await supabaseAdmin.from("incidencias").delete().eq("id_incidencia", idIncidencia);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idIncidencia });
  }

  return jsonError("accion debe ser 'crear' o 'eliminar'", 400);
});
