// Módulo Usuarios (catálogo de la app, hoja Usuarios histórica) — ver
// docs/modulo-usuarios.md. NO confundir con la tabla `users` (esa es solo
// las cuentas con login real de Supabase Auth para verificar rol
// server-side, ver comentario en schema.sql).
//
// crearUsuarios (crear) es solo Admin/Gestor. Profesor puede "usuarios"
// (ver la página) pero solo editar filas con Rol=Alumno, y no puede
// cambiarles el rol — antes esto solo se comprobaba en el cliente
// (js/ubicaciones.js `guardarUsuario`), aquí se fuerza también server-side.
import { requireAdmin, requireAdminOrGestor, requireStaff, jsonError, jsonOk, handleCorsPreflight } from "../_shared/auth.ts";

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

  // ── Eliminar: una persona vive en TRES sitios y hay que quitarla de los tres ──
  // `usuarios` (catálogo que lee el navegador), `public.users` (rol que miran las
  // Edge Functions) y la cuenta de Supabase Auth (login). Si solo se borra el
  // catálogo, esa persona sigue pudiendo entrar y getRealUserRole() la trata como
  // Alumno (ver js/ui.js) — un medio-borrado confuso.
  if (accion === "eliminar") {
    const { error: authError, user, supabaseAdmin } = await requireAdmin(req);
    if (authError) return authError;

    const idUsuario = String(body.id_usuario || "").trim();
    if (!idUsuario) return jsonError("id_usuario es obligatorio", 400);

    const { data: existente } = await supabaseAdmin.from("usuarios").select("*").eq("id_usuario", idUsuario)
      .maybeSingle();
    if (!existente) return jsonError(`No se encontró el usuario "${idUsuario}"`, 404);

    const emailObjetivo = String(existente.email || "").toLowerCase().trim();
    if (emailObjetivo && emailObjetivo === String(user?.email || "").toLowerCase().trim()) {
      return jsonError("No puedes eliminar tu propia cuenta", 400);
    }

    // Igual que un proveedor con pedidos: si es responsable de equipos no se borra,
    // porque `equipos.responsable` guarda el NOMBRE y quedaría apuntando a nadie.
    const nombreObjetivo = String(existente.nombre || "").trim();
    if (nombreObjetivo) {
      const { data: equipos } = await supabaseAdmin.from("equipos").select("id_activo, responsable")
        .ilike("responsable", `%${nombreObjetivo}%`);
      const suyos = (equipos || []).filter((e: { responsable: string | null }) =>
        String(e.responsable || "").split(",").map((x) => x.trim()).includes(nombreObjetivo)
      );
      if (suyos.length) {
        return jsonError(
          `No se puede eliminar: es responsable de ${suyos.length} equipo(s). ` +
            `Reasígnalos a otra persona antes de borrarle.`,
          400,
        );
      }
    }

    // Orden: primero el login (lo que da acceso), luego permisos, luego catálogo.
    let avisoAuth: string | null = null;
    if (emailObjetivo) {
      const { data: perfil } = await supabaseAdmin.from("users").select("id").eq("email", emailObjetivo)
        .maybeSingle();
      let authId: string | null = perfil?.id ?? null;
      if (!authId) {
        // Sin fila en `users` hay que buscar la cuenta por email en Auth
        const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        authId = lista?.users?.find((u: { email?: string }) =>
          String(u.email || "").toLowerCase().trim() === emailObjetivo
        )?.id ?? null;
      }
      if (authId) {
        const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authId);
        if (authDelErr) avisoAuth = `no se pudo borrar la cuenta de acceso: ${authDelErr.message}`;
      }
      await supabaseAdmin.from("users").delete().eq("email", emailObjetivo);
    }

    const { error: delErr } = await supabaseAdmin.from("usuarios").delete().eq("id_usuario", idUsuario);
    if (delErr) return jsonError(`No se pudo eliminar: ${delErr.message}`, 400);

    return jsonOk({ eliminado: idUsuario, aviso: avisoAuth });
  }

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

    // Las Edge Functions comprueban el rol contra `public.users` (ver _shared/auth.ts),
    // no contra este catálogo. Si no se replica aquí, promover a alguien a Gestor desde
    // la app le cambia el rol en la UI pero el servidor lo sigue tratando como Profesor
    // y le rechaza con 403 todo lo que sea de Admin/Gestor. Pasó de verdad con las
    // Gestoras importadas de Sanidad CMA (2026-09-14).
    const { error: syncError } = await supabaseAdmin
      .from("users")
      .update({
        nombre: datos.nombre,
        rol: datos.rol,
        puede_revisar_inventario: datos.puede_revisar_inventario,
      })
      .eq("email", existente.email);
    // Que no exista fila en `users` es normal si la persona aún no tiene cuenta de
    // acceso: el catálogo manda igual, así que no se aborta la actualización.
    if (syncError) console.error(`No se pudo sincronizar public.users para ${existente.email}: ${syncError.message}`);

    return jsonOk({ usuario: data });
  }

  return jsonError("accion debe ser 'crear', 'actualizar' o 'eliminar'", 400);
});
