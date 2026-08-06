// Importación masiva de profesorado desde la app "Sanidad CMA". Solo Admin/Gestor.
// POST { accion: 'preview' } -> lista de ASIGNACIONES de Sanidad CMA (una fila por profesor×módulo,
//   cada módulo trae su propio lab, puede venir null si el módulo no tiene aula asignada aún en
//   Sanidad CMA) + si ya existen en `usuarios`.
// POST { accion: 'importar', profesores: [{nombre,email,ciclo,modulo,laboratorio,equipos_responsable}, ...] }
//   -> por cada profesor ya fusionado por el cliente (igual que importar-alumnos): fila en `usuarios`
//   (catálogo) + cuenta real de Supabase Auth con contraseña temporal + fila en `public.users`, y
//   además añade su nombre al campo `responsable` de cada equipo en `equipos_responsable` (los
//   equipos de los labs de sus módulos, confirmados por la usuaria en el checklist) sin pisar los
//   responsables que ya hubiera.
import { requireAdminOrGestor, jsonError, jsonOk, generarPasswordTemporal, handleCorsPreflight } from "../_shared/auth.ts";

interface ProfesorCMA {
  nombre: string;
  email: string;
  ciclo: string;
  modulo: string;
  laboratorio: string | null;
}

interface ProfesorImportar {
  nombre?: string;
  email?: string;
  ciclo?: string;
  modulo?: string;
  laboratorio?: string;
  equipos_responsable?: string[];
}

async function fetchProfesoresCMA(): Promise<ProfesorCMA[]> {
  const baseUrl = Deno.env.get("SANIDAD_CMA_API_URL")!;
  const apiKey = Deno.env.get("SANIDAD_CMA_API_KEY")!;
  const res = await fetch(`${baseUrl}/api/bioDesk/profesores`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Sanidad CMA respondió ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.profesores ?? []);
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

  let body: { accion?: string; profesores?: ProfesorImportar[] };
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido (se esperaba JSON)", 400);
  }
  const accion = body.accion || "preview";

  // ── Preview: lista de profesorado de Sanidad CMA + si ya existen en el catálogo `usuarios` ──
  if (accion === "preview") {
    let profesores: ProfesorCMA[];
    try {
      profesores = await fetchProfesoresCMA();
    } catch (e) {
      return jsonError(`No se pudo consultar Sanidad CMA: ${(e as Error).message}`, 502);
    }

    const emails = profesores.map((p) => p.email.toLowerCase().trim());
    const { data: existentes } = await supabaseAdmin.from("usuarios").select("email").in("email", emails);
    const yaExisten = new Set((existentes ?? []).map((u: { email: string }) => (u.email || "").toLowerCase().trim()));

    const conEstado = profesores.map((p) => ({ ...p, existe: yaExisten.has(p.email.toLowerCase().trim()) }));
    return jsonOk({ profesores: conEstado });
  }

  // ── Importar: crea fila en `usuarios` + cuenta Auth + fila en `public.users`, y añade el
  // profesor como responsable de los equipos confirmados por la usuaria en el checklist ──
  if (accion === "importar") {
    const aImportar = Array.isArray(body.profesores) ? body.profesores : [];
    if (!aImportar.length) return jsonError("No se seleccionó ningún profesor", 400);

    const resultados: Array<
      { email: string; ok: boolean; motivo?: string; password_temporal?: string; equipos_actualizados?: number }
    > = [];

    for (const p of aImportar) {
      const email = (p.email || "").toLowerCase().trim();
      const nombre = (p.nombre || "").trim();
      if (!email || !nombre) {
        resultados.push({ email: email || "(sin email)", ok: false, motivo: "Faltan nombre o email" });
        continue;
      }

      const { data: yaExiste } = await supabaseAdmin.from("usuarios").select("id_usuario").eq("email", email)
        .maybeSingle();
      if (yaExiste) {
        resultados.push({ email, ok: false, motivo: "Ya existía, omitido" });
        continue;
      }

      // 1. Fila en el catálogo `usuarios`
      const idUsuario = genId("USR-");
      const { error: catalogoErr } = await supabaseAdmin.from("usuarios").insert({
        id_usuario: idUsuario,
        nombre,
        email,
        rol: "Profesor",
        activo: true,
        ubicaciones_asignadas: p.laboratorio || "",
        modulo: p.modulo || "",
        ciclo_principal: p.ciclo || "",
        puede_revisar_inventario: false,
      });
      if (catalogoErr) {
        resultados.push({ email, ok: false, motivo: catalogoErr.message });
        continue;
      }

      // 2. Cuenta real de Supabase Auth (sin esto el profesor no puede acceder a la app)
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
      if (p.ciclo) {
        let { data: ciclo } = await supabaseAdmin.from("ciclos").select("id").eq("nombre", p.ciclo).maybeSingle();
        if (!ciclo) {
          const { data: nuevoCiclo } = await supabaseAdmin.from("ciclos").insert({ nombre: p.ciclo }).select("id")
            .single();
          ciclo = nuevoCiclo;
        }
        cicloId = ciclo?.id ?? null;
      }

      const { error: profileErr } = await supabaseAdmin.from("users").insert({
        id: userId,
        gestionlab_id: idUsuario,
        nombre,
        email,
        rol: "Profesor",
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

      // 4. Añadir como responsable a los equipos confirmados (sin pisar los que ya hubiera)
      const equiposIds = Array.isArray(p.equipos_responsable) ? p.equipos_responsable : [];
      let equiposActualizados = 0;
      for (const idActivo of equiposIds) {
        const { data: equipo } = await supabaseAdmin.from("equipos").select("responsable").eq("id_activo", idActivo)
          .maybeSingle();
        if (!equipo) continue;
        const actuales = (equipo.responsable || "").split(",").map((r: string) => r.trim()).filter(Boolean);
        if (actuales.includes(nombre)) continue; // ya estaba
        actuales.push(nombre);
        const { error: eqErr } = await supabaseAdmin.from("equipos").update({ responsable: actuales.join(", ") })
          .eq("id_activo", idActivo);
        if (!eqErr) equiposActualizados++;
      }

      resultados.push({ email, ok: true, password_temporal: password, equipos_actualizados: equiposActualizados });
    }

    return jsonOk({ resultados });
  }

  return jsonError("accion debe ser 'preview' o 'importar'", 400);
});
