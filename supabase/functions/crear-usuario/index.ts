// Tarea #5 — Alta individual de usuario desde la app.
// Solo Admin/Gestor (comprobado en _shared/auth.ts). Crea la cuenta con
// contraseña temporal + el perfil en public.users + sus módulos si se indican.
import { requireAdminOrGestor, jsonError, jsonOk, generarPasswordTemporal, handleCorsPreflight } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo de la petición inválido (se esperaba JSON)", 400);
  }

  const nombre = String(body.nombre || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const rol = String(body.rol || "").trim();
  const cicloPrincipal = body.ciclo_principal ? String(body.ciclo_principal).trim() : null;
  const modulos = Array.isArray(body.modulos) ? body.modulos.map(String) : [];
  const puedeRevisarInventario = !!body.puede_revisar_inventario;

  if (!nombre || !email || !rol) {
    return jsonError("Faltan campos obligatorios: nombre, email, rol", 400);
  }
  if (!["Administrador", "Gestor", "Profesor", "Alumno"].includes(rol)) {
    return jsonError(`Rol no válido: ${rol}`, 400);
  }

  const password = generarPasswordTemporal();

  const { data: authUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !authUser?.user) {
    return jsonError(`No se pudo crear la cuenta: ${createErr?.message ?? "error desconocido"}`, 400);
  }
  const userId = authUser.user.id;

  // Resolver/crear ciclo
  let cicloId: string | null = null;
  if (cicloPrincipal) {
    const { data: ciclo } = await supabaseAdmin.from("ciclos").select("id").eq("nombre", cicloPrincipal).maybeSingle();
    if (ciclo) {
      cicloId = ciclo.id;
    } else {
      const { data: nuevoCiclo, error: cicloErr } = await supabaseAdmin
        .from("ciclos").insert({ nombre: cicloPrincipal }).select("id").single();
      if (cicloErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return jsonError(`No se pudo crear el ciclo "${cicloPrincipal}": ${cicloErr.message}`, 400);
      }
      cicloId = nuevoCiclo.id;
    }
  }

  const { error: profileErr } = await supabaseAdmin.from("users").insert({
    id: userId,
    nombre,
    email,
    rol,
    activo: true,
    ciclo_principal_id: cicloId,
    puede_revisar_inventario: puedeRevisarInventario,
  });
  if (profileErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return jsonError(`No se pudo crear el perfil: ${profileErr.message}`, 400);
  }

  // Resolver/crear módulos y vincularlos
  const cursoAcademico = _cursoAcademicoActual();
  for (const nombreModulo of modulos) {
    let { data: modulo } = await supabaseAdmin.from("modulos").select("id").eq("nombre", nombreModulo).maybeSingle();
    if (!modulo) {
      const { data: nuevoModulo, error: moduloErr } = await supabaseAdmin
        .from("modulos").insert({ nombre: nombreModulo }).select("id").single();
      if (moduloErr) continue; // no bloquea el alta por un módulo suelto que falle
      modulo = nuevoModulo;
    }
    await supabaseAdmin.from("user_modulos").insert({
      user_id: userId,
      modulo_id: modulo.id,
      curso_academico: cursoAcademico,
    });
  }

  return jsonOk({ id: userId, email, password_temporal: password });
});

function _cursoAcademicoActual(): string {
  const hoy = new Date();
  const anioInicio = hoy.getMonth() >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1; // curso empieza en sept (mes 8)
  return `${anioInicio}-${anioInicio + 1}`;
}
