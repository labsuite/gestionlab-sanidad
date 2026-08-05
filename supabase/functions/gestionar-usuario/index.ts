// Módulo Usuarios (catálogo de la app, hoja Usuarios histórica) — ver
// docs/modulo-usuarios.md. NO confundir con la tabla `users` (esa es solo
// las cuentas con login real de Supabase Auth para verificar rol
// server-side, ver comentario en schema.sql).
//
// crearUsuarios (crear) es solo Admin/Gestor. Profesor puede "usuarios"
// (ver la página) pero solo editar filas con Rol=Alumno, y no puede
// cambiarles el rol — antes esto solo se comprobaba en el cliente
// (js/ubicaciones.js `guardarUsuario`), aquí se fuerza también server-side.
import { requireAdminOrGestor, requireStaff, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);

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

  const nombre = String(body.nombre || "").trim();
  const email = String(body.email || "").trim();
  if (!nombre || !email) return jsonError("Nombre y email son obligatorios", 400);

  const datosBase = {
    nombre, email,
    rol: String(body.rol || "Alumno"),
    ubicaciones_asignadas: strField(body.ubicaciones_asignadas),
    modulo: strField(body.modulo),
    ciclo_principal: strField(body.ciclo_principal),
    puede_revisar_inventario: body.puede_revisar_inventario === true || body.puede_revisar_inventario === "TRUE",
  };

  if (accion === "crear") {
    const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
    if (authError) return authError;
    const datos = { id_usuario: genId("USR-"), activo: true, ...datosBase };
    const { data, error } = await supabaseAdmin.from("usuarios").insert(datos).select().single();
    if (error) return jsonError(`No se pudo crear: ${error.message}`, 400);
    return jsonOk({ usuario: data });
  }

  if (accion === "actualizar") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;
    const idUsuario = String(body.id_usuario || "").trim();
    if (!idUsuario) return jsonError("id_usuario es obligatorio", 400);

    const { data: existente } = await supabaseAdmin.from("usuarios").select("*").eq("id_usuario", idUsuario).maybeSingle();
    if (!existente) return jsonError(`No se encontró el usuario "${idUsuario}"`, 404);

    const datos = { ...datosBase };
    if (user?.rol === "Profesor") {
      if (existente.rol !== "Alumno") return jsonError("Solo puedes modificar usuarios con rol Alumno", 403);
      datos.rol = "Alumno"; // un Profesor no puede cambiarle el rol a nadie, aunque lo mande en el body
    }

    const { data, error } = await supabaseAdmin.from("usuarios").update(datos).eq("id_usuario", idUsuario).select().single();
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);
    return jsonOk({ usuario: data });
  }

  return jsonError("accion debe ser 'crear' o 'actualizar'", 400);
});
