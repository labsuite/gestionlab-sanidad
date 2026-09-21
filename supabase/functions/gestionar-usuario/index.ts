// Módulo Usuarios (catálogo de la app, hoja Usuarios histórica) — ver
// docs/modulo-usuarios.md. NO confundir con la tabla `users` (esa es solo
// las cuentas con login real de Supabase Auth para verificar rol
// server-side, ver comentario en schema.sql).
//
// crearUsuarios (crear) es solo Admin/Gestor. Profesor puede "usuarios"
// (ver la página) pero solo editar filas con Rol=Alumno, y no puede
// cambiarles el rol — antes esto solo se comprobaba en el cliente
// (js/ubicaciones.js `guardarUsuario`), aquí se fuerza también server-side.
import { requireAdmin, requireAdminOrGestor, requireStaff, jsonError, jsonOk, passwordDesdeEmail, passwordDeGrupo, esCuentaDeGrupo, nombreCorto, handleCorsPreflight } from "../_shared/auth.ts";
import { cifrar, descifrar, hayClaveDeCifrado } from "../_shared/secretos.ts";

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

const strField = (v: unknown) => (v === "" || v === null || v === undefined) ? null : String(v);

/** Mínimo que acepta Supabase Auth; es también el mínimo al escribir una a mano. */
const MIN_PASSWORD = 6;

/** id de Supabase Auth a partir del email: primero `users`, y si no está, el listado de Auth. */
async function authIdDeEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  const { data: perfil } = await supabaseAdmin.from("users").select("id").eq("email", email).maybeSingle();
  if (perfil?.id) return perfil.id;
  const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return lista?.users?.find((u: { email?: string }) =>
    String(u.email || "").toLowerCase().trim() === email
  )?.id ?? null;
}

/**
 * Copia cifrada de la contraseña de una cuenta de GRUPO, para poder consultarla
 * después (ver _shared/secretos.ts). Solo se llama con cuentas de grupo: la
 * contraseña de una persona no se guarda nunca.
 */
async function guardarCopiaPassword(
  supabaseAdmin: any, idUsuario: string, password: string, autor: string,
): Promise<string | null> {
  if (!hayClaveDeCifrado()) return "falta el secreto GRUPO_PASSWORD_KEY";
  const { error } = await supabaseAdmin.from("credenciales_grupo").upsert({
    id_usuario: idUsuario,
    password_cifrada: await cifrar(password),
    actualizado_en: new Date().toISOString(),
    actualizado_por: autor,
  });
  return error?.message ?? null;
}

/**
 * Comprueba que la fila existe y que es de verdad una cuenta de grupo. Quien
 * pregunta ya viene filtrado por requireStaff: la contraseña de un grupo la
 * pueden ver y cambiar Administrador, Gestor y Profesor (la usan en clase).
 */
async function grupoDelBody(supabaseAdmin: any, body: Record<string, unknown>) {
  const idUsuario = String(body.id_usuario || "").trim();
  if (!idUsuario) return { error: jsonError("id_usuario es obligatorio", 400) };

  const { data: fila } = await supabaseAdmin.from("usuarios")
    .select("id_usuario, nombre, email, rol").eq("id_usuario", idUsuario).maybeSingle();
  if (!fila) return { error: jsonError(`No se encontró el usuario "${idUsuario}"`, 404) };

  const email = String(fila.email || "").toLowerCase().trim();
  if (!esCuentaDeGrupo(email)) {
    return {
      error: jsonError(
        "Solo se puede consultar la contraseña de una cuenta de grupo. " +
          "La de una persona no se guarda en ningún sitio: hay que restablecerla.",
        400,
      ),
    };
  }
  return { fila, email };
}

// Acciones en bloque: aceptan `ids: [...]` o un único `id_usuario`.
const _idsDelBody = (body: Record<string, unknown>): string[] =>
  (Array.isArray(body.ids) ? body.ids : [body.id_usuario])
    .map((x) => String(x || "").trim()).filter(Boolean);

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

  // ── Revisar inventario en bloque ──────────────────────────────────────────
  // Mismo dato que la casilla "Puede revisar inventario de material fungible" del
  // modal de usuario, pero para varios alumnos de una vez (botones Todos/Ninguno de
  // cada grupo en la pestaña Alumnos). La casilla individual del modal sigue viajando
  // por la acción `actualizar`, que no se toca.
  if (accion === "revisar_inventario") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;

    const ids = _idsDelBody(body);
    if (!ids.length) return jsonError("No se indicó ningún usuario", 400);
    const valor = body.valor === true || body.valor === "TRUE";

    const { data: filas } = await supabaseAdmin.from("usuarios").select("id_usuario, email, rol").in("id_usuario", ids);
    if (!filas?.length) return jsonError("No se encontró ningún usuario", 404);
    // Un Profesor solo puede tocar alumnado, igual que en `actualizar`
    if (user?.rol === "Profesor" && filas.some((f: { rol: string }) => f.rol !== "Alumno")) {
      return jsonError("Solo puedes modificar usuarios con rol Alumno", 403);
    }

    const idsReales = filas.map((f: { id_usuario: string }) => f.id_usuario);
    const { error } = await supabaseAdmin.from("usuarios")
      .update({ puede_revisar_inventario: valor }).in("id_usuario", idsReales);
    if (error) return jsonError(`No se pudo actualizar: ${error.message}`, 400);

    // Se replica en public.users por lo mismo que en `actualizar`: es la tabla que
    // miran las Edge Functions, el catálogo solo lo lee el navegador.
    const emails = filas.map((f: { email: string | null }) => String(f.email || "").toLowerCase().trim()).filter(Boolean);
    if (emails.length) {
      const { error: syncError } = await supabaseAdmin.from("users")
        .update({ puede_revisar_inventario: valor }).in("email", emails);
      if (syncError) console.error(`No se pudo sincronizar public.users: ${syncError.message}`);
    }

    return jsonOk({ actualizados: idsReales, valor });
  }

  // ── Contraseña de una cuenta de GRUPO: consultarla ────────────────────────
  // La cuenta de un grupo es compartida a propósito, así que su contraseña no es
  // un secreto personal: el profesorado tiene que poder dictársela a su grupo.
  // Como Auth solo guarda el hash, se guarda aparte una copia cifrada
  // (`credenciales_grupo`, ver _shared/secretos.ts) que solo se descifra aquí.
  if (accion === "ver_password_grupo") {
    const { error: authError, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;

    const g = await grupoDelBody(supabaseAdmin, body);
    if ("error" in g) return g.error;

    if (!hayClaveDeCifrado()) {
      return jsonError("Falta el secreto GRUPO_PASSWORD_KEY en las Edge Functions", 500);
    }

    const { data: cred } = await supabaseAdmin.from("credenciales_grupo")
      .select("password_cifrada, actualizado_en, actualizado_por")
      .eq("id_usuario", g.fila.id_usuario).maybeSingle();

    // Los grupos creados antes de esto (scripts/crear_grupos_alumnado.py) no
    // tienen copia guardada: no hay forma de recuperar la que tengan, solo poner
    // una nueva.
    if (!cred) return jsonOk({ sin_guardar: true });

    try {
      return jsonOk({
        password: await descifrar(cred.password_cifrada),
        actualizado_en: cred.actualizado_en,
        actualizado_por: cred.actualizado_por,
      });
    } catch {
      return jsonError("No se pudo descifrar la contraseña guardada", 500);
    }
  }

  // ── Contraseña de una cuenta de GRUPO: cambiarla ──────────────────────────
  // Sin `password` genera una nueva dictable ("praza-verde-482"); con `password`
  // guarda la que haya escrito el profesorado.
  if (accion === "cambiar_password_grupo") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;

    const g = await grupoDelBody(supabaseAdmin, body);
    if ("error" in g) return g.error;

    if (!hayClaveDeCifrado()) {
      return jsonError("Falta el secreto GRUPO_PASSWORD_KEY en las Edge Functions", 500);
    }

    const nueva = String(body.password || "").trim() || passwordDeGrupo();
    if (nueva.length < MIN_PASSWORD) {
      return jsonError(`La contraseña tiene que tener al menos ${MIN_PASSWORD} caracteres`, 400);
    }

    const authId = await authIdDeEmail(supabaseAdmin, g.email);
    if (!authId) return jsonError(`${g.fila.nombre} no tiene cuenta de acceso`, 404);

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authId, { password: nueva });
    if (updErr) return jsonError(`No se pudo cambiar la contraseña: ${updErr.message}`, 400);

    // Si la copia falla, la contraseña YA cambió: hay que devolverla igualmente o
    // el grupo se queda fuera sin que nadie sepa cuál es la nueva.
    const aviso = await guardarCopiaPassword(
      supabaseAdmin, g.fila.id_usuario, nueva, nombreCorto(String(user?.nombre || "")),
    );
    return jsonOk({ password: nueva, aviso });
  }

  // ── Restablecer contraseña ────────────────────────────────────────────────
  // Deja la contraseña de Supabase Auth en la parte del email anterior a "@" (misma
  // convención que TRebello y que el import de alumnado), y la devuelve para poder
  // dictarla en clase. No manda ningún correo: el alumnado no siempre puede leer su
  // buzón de la Xunta desde el aula.
  if (accion === "resetear_password") {
    const { error: authError, user, supabaseAdmin } = await requireStaff(req);
    if (authError) return authError;

    const ids = _idsDelBody(body);
    if (!ids.length) return jsonError("No se indicó ningún usuario", 400);

    const { data: filas } = await supabaseAdmin.from("usuarios").select("id_usuario, nombre, email, rol").in("id_usuario", ids);
    if (!filas?.length) return jsonError("No se encontró ningún usuario", 404);
    if (user?.rol === "Profesor" && filas.some((f: { rol: string }) => f.rol !== "Alumno")) {
      return jsonError("Solo puedes restablecer contraseñas de alumnado", 403);
    }

    // Los ids de Auth se resuelven primero por public.users (una sola consulta);
    // solo si alguien no está ahí se pide el listado completo de Auth, y una vez.
    const emails = filas.map((f: { email: string | null }) => String(f.email || "").toLowerCase().trim()).filter(Boolean);
    const { data: perfiles } = await supabaseAdmin.from("users").select("id, email").in("email", emails);
    const authPorEmail = new Map<string, string>(
      (perfiles ?? []).map((p: { id: string; email: string }) => [String(p.email || "").toLowerCase().trim(), p.id]),
    );
    let listadoAuth: Array<{ id: string; email?: string }> | null = null;

    const resultados: Array<
      { nombre: string; email: string; ok: boolean; password?: string; motivo?: string }
    > = [];

    for (const f of filas) {
      const nombreU = String(f.nombre || "").trim();
      const emailU = String(f.email || "").toLowerCase().trim();
      if (!emailU) {
        resultados.push({ nombre: nombreU, email: "(sin email)", ok: false, motivo: "No tiene email" });
        continue;
      }
      let authId = authPorEmail.get(emailU) ?? null;
      if (!authId) {
        if (!listadoAuth) {
          const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          listadoAuth = lista?.users ?? [];
        }
        authId = listadoAuth.find((u) => String(u.email || "").toLowerCase().trim() === emailU)?.id ?? null;
      }
      if (!authId) {
        resultados.push({ nombre: nombreU, email: emailU, ok: false, motivo: "No tiene cuenta de acceso" });
        continue;
      }
      // Las cuentas de grupo llevan contraseña aleatoria: derivarla del email
      // sería publicarla (la parte local es el nombre del grupo).
      const esGrupo = esCuentaDeGrupo(emailU);
      const password = esGrupo ? passwordDeGrupo() : passwordDesdeEmail(emailU);
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authId, { password });
      if (updErr) {
        resultados.push({ nombre: nombreU, email: emailU, ok: false, motivo: updErr.message });
        continue;
      }
      // La copia consultable de los grupos se actualiza también por aquí: si no,
      // "Ver contraseña" seguiría enseñando la anterior, que ya no vale.
      if (esGrupo && hayClaveDeCifrado()) {
        await guardarCopiaPassword(supabaseAdmin, f.id_usuario, password, nombreCorto(String(user?.nombre || "")));
      }
      resultados.push({ nombre: nombreU, email: emailU, ok: true, password });
    }

    return jsonOk({ resultados });
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

  return jsonError(
    "accion no reconocida (crear, actualizar, eliminar, revisar_inventario, resetear_password, " +
      "ver_password_grupo, cambiar_password_grupo)",
    400,
  );
});
