// Importación masiva de alumnado desde la app "Sanidad CMA". Solo Admin/Gestor.
// POST { accion: 'preview' }                -> lista de alumnos de Sanidad CMA + si ya existen en `usuarios`
// POST { accion: 'importar', emails: [...] } -> por cada email: fila en `usuarios` (catálogo) +
//   cuenta real de Supabase Auth con contraseña temporal + fila en `public.users` (login/rol server-side).
// Mismo patrón que scripts/importar_alumnos.py — sin esto el alumno no podría iniciar sesión.
import { requireAdminOrGestor, jsonError, jsonOk, generarPasswordTemporal, handleCorsPreflight } from "../_shared/auth.ts";

interface AlumnoCMA {
  nombre: string;
  email: string;
  ciclo: string;
  modulo: string;
  laboratorio: string;
}

async function fetchAlumnosCMA(): Promise<AlumnoCMA[]> {
  const baseUrl = Deno.env.get("SANIDAD_CMA_API_URL")!;
  const apiKey = Deno.env.get("SANIDAD_CMA_API_KEY")!;
  const res = await fetch(`${baseUrl}/api/bioDesk/alumnos`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Sanidad CMA respondió ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.alumnos ?? []);
}

function genId(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Método no permitido", 405);

  const { error: authError, supabaseAdmin } = await requireAdminOrGestor(req);
  if (authError) return authError;

  let body: { accion?: string; emails?: string[] };
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }
  const accion = body.accion || "preview";

  // ── Preview: lista de alumnos de Sanidad CMA + si ya existen en el catálogo `usuarios` ──
  if (accion === "preview") {
    let alumnos: AlumnoCMA[];
    try {
      alumnos = await fetchAlumnosCMA();
    } catch (e) {
      return jsonError(`No se pudo consultar Sanidad CMA: ${(e as Error).message}`, 502);
    }

    const emails = alumnos.map((a) => a.email.toLowerCase().trim());
    const { data: existentes } = await supabaseAdmin.from("usuarios").select("email").in("email", emails);
    const yaExisten = new Set((existentes ?? []).map((u: { email: string }) => (u.email || "").toLowerCase().trim()));

    const conEstado = alumnos.map((a) => ({ ...a, existe: yaExisten.has(a.email.toLowerCase().trim()) }));
    return jsonOk({ alumnos: conEstado });
  }

  // ── Importar: crea fila en `usuarios` + cuenta Auth + fila en `public.users` para los seleccionados ──
  if (accion === "importar") {
    const seleccionados = new Set((body.emails ?? []).map((e) => e.toLowerCase().trim()));
    if (!seleccionados.size) return jsonError("No se seleccionó ningún alumno", 400);

    let alumnos: AlumnoCMA[];
    try {
      alumnos = await fetchAlumnosCMA();
    } catch (e) {
      return jsonError(`No se pudo consultar Sanidad CMA: ${(e as Error).message}`, 502);
    }

    const aImportar = alumnos.filter((a) => seleccionados.has(a.email.toLowerCase().trim()));
    const resultados: Array<
      { email: string; ok: boolean; motivo?: string; password_temporal?: string }
    > = [];

    for (const a of aImportar) {
      const email = a.email.toLowerCase().trim();

      const { data: yaExiste } = await supabaseAdmin.from("usuarios").select("id_usuario").eq("email", email)
        .maybeSingle();
      if (yaExiste) {
        resultados.push({ email, ok: false, motivo: "Ya existía, omitido" });
        continue;
      }

      // 1. Fila en el catálogo `usuarios` (lo que ve/edita la página Usuarios)
      const idUsuario = genId("USR-");
      const { error: catalogoErr } = await supabaseAdmin.from("usuarios").insert({
        id_usuario: idUsuario,
        nombre: a.nombre,
        email,
        rol: "Alumno",
        activo: true,
        ubicaciones_asignadas: a.laboratorio || "",
        modulo: a.modulo || "",
        ciclo_principal: a.ciclo || "",
        puede_revisar_inventario: false,
      });
      if (catalogoErr) {
        resultados.push({ email, ok: false, motivo: catalogoErr.message });
        continue;
      }

      // 2. Cuenta real de Supabase Auth (sin esto el alumno no puede acceder a la app)
      const password = generarPasswordTemporal();
      const { data: authUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !authUser?.user) {
        resultados.push({
          email,
          ok: false,
          motivo: `Catálogo creado pero falló la cuenta de acceso: ${createErr?.message ?? "error desconocido"}`,
        });
        continue;
      }
      const userId = authUser.user.id;

      // 3. Resolver/crear ciclo y dar de alta en public.users (verificación de rol server-side)
      let cicloId: string | null = null;
      if (a.ciclo) {
        let { data: ciclo } = await supabaseAdmin.from("ciclos").select("id").eq("nombre", a.ciclo).maybeSingle();
        if (!ciclo) {
          const { data: nuevoCiclo } = await supabaseAdmin.from("ciclos").insert({ nombre: a.ciclo }).select("id")
            .single();
          ciclo = nuevoCiclo;
        }
        cicloId = ciclo?.id ?? null;
      }

      const { error: profileErr } = await supabaseAdmin.from("users").insert({
        id: userId,
        gestionlab_id: idUsuario,
        nombre: a.nombre,
        email,
        rol: "Alumno",
        activo: true,
        ciclo_principal_id: cicloId,
        puede_revisar_inventario: false,
      });
      if (profileErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        resultados.push({
          email,
          ok: false,
          motivo: `Catálogo creado pero falló el alta de acceso: ${profileErr.message}`,
        });
        continue;
      }

      resultados.push({ email, ok: true, password_temporal: password });
    }

    return jsonOk({ resultados });
  }

  return jsonError("accion debe ser 'preview' o 'importar'", 400);
});
