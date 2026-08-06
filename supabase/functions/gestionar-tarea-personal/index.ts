// Tareas personales (recordatorios propios, hoja Tareas_Usuario / tabla
// tareas_personales) — siempre del propio usuario. El email se toma del
// token verificado, nunca del body, para que nadie pueda crear/editar/
// borrar tareas de otra persona (mismo tipo de comprobación de "dueño" ya
// usado en gestionar-reserva/gestionar-registro-uso).
import { requireValidSession, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function generarId(): string {
  return "TAR-" + Date.now().toString(36).toUpperCase().slice(-6);
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

  const { error: authError, email, supabaseAdmin } = await requireValidSession(req);
  if (authError) return authError;

  const accion = String(body.accion || "");

  if (accion === "crear") {
    const texto = String(body.texto || "").trim();
    if (!texto) return jsonError("texto es obligatorio", 400);
    const datos = {
      id_tarea: generarId(), email, texto,
      fecha_limite: body.fecha_limite ? String(body.fecha_limite) : null,
      completada: false,
    };
    const { data, error } = await supabaseAdmin.from("tareas_personales").insert(datos).select().single();
    if (error) return jsonError(`No se pudo guardar la tarea: ${error.message}`, 400);
    return jsonOk({ tarea: data });
  }

  const idTarea = String(body.id_tarea || "").trim();
  if (!idTarea) return jsonError("id_tarea es obligatorio", 400);

  const { data: tarea, error: errBusqueda } = await supabaseAdmin
    .from("tareas_personales").select("email").eq("id_tarea", idTarea).maybeSingle();
  if (errBusqueda) return jsonError(`Error al buscar la tarea: ${errBusqueda.message}`, 400);
  if (!tarea) return jsonError(`No se encontró la tarea "${idTarea}"`, 404);
  if (tarea.email !== email) return jsonError("No puedes modificar una tarea de otra persona", 403);

  if (accion === "toggle") {
    const { data, error } = await supabaseAdmin.from("tareas_personales")
      .update({ completada: body.completada === true }).eq("id_tarea", idTarea).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    return jsonOk({ tarea: data });
  }

  if (accion === "eliminar") {
    const { error } = await supabaseAdmin.from("tareas_personales").delete().eq("id_tarea", idTarea);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: idTarea });
  }

  return jsonError("accion debe ser 'crear', 'toggle' o 'eliminar'", 400);
});
