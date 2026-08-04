// Módulo Ubicaciones — mismo patrón que gestionar-proveedor. Solo Admin/Gestor.
// A diferencia de Proveedores, el ID_Ubicacion lo escribe la persona a mano
// (no se genera solo) y puede cambiarlo al editar — por eso "actualizar"
// necesita id_original (la fila que se edita) además de id_ubicacion (el
// valor nuevo, que puede ser el mismo o uno corregido).
import { requireAdminOrGestor, jsonError, jsonOk } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }

  const accion = String(body.accion || "");
  const idUbicacion = String(body.id_ubicacion || "").trim();
  const laboratorioAula = String(body.laboratorio_aula || "").trim();

  if (accion !== "crear" && accion !== "actualizar") {
    return jsonError("accion debe ser 'crear' o 'actualizar'", 400);
  }
  if (!idUbicacion || !laboratorioAula) {
    return jsonError("id_ubicacion y laboratorio_aula son obligatorios", 400);
  }

  const datos = {
    id_ubicacion: idUbicacion,
    laboratorio_aula: laboratorioAula,
    zona: body.zona ? String(body.zona) : null,
    subzona: body.subzona ? String(body.subzona) : null,
    descripcion_completa: body.descripcion_completa ? String(body.descripcion_completa) : null,
  };

  if (accion === "crear") {
    const { data, error } = await supabaseAdmin.from("ubicaciones")
      .insert({ ...datos, activa: true }).select().single();
    if (error) {
      if (error.code === "23505") return jsonError(`Ya existe una ubicación con el ID "${idUbicacion}"`, 409);
      return jsonError(`No se pudo crear: ${error.message}`, 400);
    }
    return jsonOk({ ubicacion: data });
  }

  // actualizar
  const idOriginal = String(body.id_original || "").trim();
  if (!idOriginal) return jsonError("Falta id_original para actualizar", 400);

  const { data, error } = await supabaseAdmin.from("ubicaciones")
    .update(datos).eq("id_ubicacion", idOriginal).select().single();
  if (error) {
    if (error.code === "23505") return jsonError(`Ya existe una ubicación con el ID "${idUbicacion}"`, 409);
    return jsonError(`No se pudo actualizar: ${error.message}`, 400);
  }
  if (!data) return jsonError(`No se encontró la ubicación "${idOriginal}"`, 404);
  return jsonOk({ ubicacion: data });
});
