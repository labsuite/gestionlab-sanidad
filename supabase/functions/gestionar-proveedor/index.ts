// Módulo Proveedores — primer módulo migrado (tarea #6, plantilla para el resto).
// Solo Admin/Gestor. Las lecturas van directas desde el navegador vía RLS
// (proveedores es catálogo, no datos sensibles — mismo criterio que
// ciclos/modulos hoy); solo las escrituras pasan por aquí, porque el
// navegador aún no tiene sesión real de Supabase Auth (eso es la tarea #8).
import { requireAdminOrGestor, jsonError, jsonOk } from "../_shared/auth.ts";

function generarIdProveedor(): string {
  return "PRV-" + Date.now().toString(36).toUpperCase().slice(-6);
}

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

  if (accion === "crear" || accion === "actualizar") {
    const nombreProveedor = String(body.nombre_proveedor || "").trim();
    if (!nombreProveedor) return jsonError("El nombre es obligatorio", 400);

    const datos = {
      nombre_proveedor: nombreProveedor,
      tipo_proveedor: body.tipo_proveedor ? String(body.tipo_proveedor) : null,
      persona_contacto: body.persona_contacto ? String(body.persona_contacto) : null,
      email_contacto: body.email_contacto ? String(body.email_contacto) : null,
      telefono: body.telefono ? String(body.telefono) : null,
      web: body.web ? String(body.web) : null,
      observaciones: body.observaciones ? String(body.observaciones) : null,
    };

    if (accion === "crear") {
      const id_proveedor = generarIdProveedor();
      const { data, error } = await supabaseAdmin.from("proveedores")
        .insert({ id_proveedor, activo: true, ...datos })
        .select().single();
      if (error) return jsonError(`No se pudo crear: ${error.message}`, 400);
      return jsonOk({ proveedor: data });
    } else {
      const id_proveedor = String(body.id_proveedor || "");
      if (!id_proveedor) return jsonError("Falta id_proveedor para actualizar", 400);
      const { data, error } = await supabaseAdmin.from("proveedores")
        .update(datos).eq("id_proveedor", id_proveedor).select().single();
      if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
      return jsonOk({ proveedor: data });
    }
  }

  if (accion === "eliminar") {
    const id_proveedor = String(body.id_proveedor || "");
    if (!id_proveedor) return jsonError("Falta id_proveedor", 400);
    const { error } = await supabaseAdmin.from("proveedores").delete().eq("id_proveedor", id_proveedor);
    if (error) return jsonError(`No se pudo eliminar: ${error.message}`, 400);
    return jsonOk({ eliminado: id_proveedor });
  }

  return jsonError("accion debe ser 'crear', 'actualizar' o 'eliminar'", 400);
});
